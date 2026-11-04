import prisma from "../db.js";
import context from "../data/context.js";
import { classifyWard } from "./strategy.js";

/**
 * Field Ops — polling-agent roster and coverage planning.
 *
 * Staffing plan: one primary agent for every polling station, plus a backup
 * tier and a supervisor tier that each cover a block of stations. Targets are
 * derived from the LIVE station count (never a frozen constant) so the plan
 * stays honest if the register changes:
 *
 *   757 stations -> 757 primary + 76 backup + 31 supervisor = 864 team
 */

export const COVERAGE = {
  primaryPerStation: 1,
  stationsPerBackup: 10,
  stationsPerSupervisor: 25,
};

export const AGENT_ROLES = ["primary", "backup", "supervisor"];

const emptyCounts = () => ({ primary: 0, backup: 0, supervisor: 0 });

/** Staffing targets for a given number of polling stations. */
export function coverageTargets(stationCount) {
  const stations = Number(stationCount) || 0;
  const primary = stations * COVERAGE.primaryPerStation;
  const backup = Math.ceil(stations / COVERAGE.stationsPerBackup);
  const supervisor = Math.ceil(stations / COVERAGE.stationsPerSupervisor);
  return { stations, primary, backup, supervisor, total: primary + backup + supervisor };
}

/**
 * Spread `total` posts across wards in proportion to their station counts using
 * the largest-remainder method, so the parts always sum back to `total`.
 * Rounding each ward independently would inflate the county figure
 * (25 wards × ceil(30/25) = 50 supervisors instead of 31).
 */
export function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum || !total) return weights.map(() => 0);
  const exact = weights.map((w) => (w * total) / sum);
  const out = exact.map((v) => Math.floor(v));
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, rem: v - Math.floor(v) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length) {
    out[order[k].i] += 1;
    left -= 1;
  }
  return out;
}

const toAgent = (a) => ({
  id: a.id,
  fullName: a.fullName,
  idNumber: a.idNumber,
  gender: a.gender,
  phone: a.phone,
  altPhone: a.altPhone,
  role: a.role,
  status: a.status,
  stationCode: a.stationCode,
  stationName: a.stationName,
  wardId: a.wardId,
  ward: a.ward?.name ?? null,
  constituency: a.ward?.constituency ?? null,
  createdAt: a.createdAt,
});

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 200;

/**
 * Live roster plus recruited-vs-target coverage.
 *
 * The filters (`role`, `ward`, `centre`, `station`, `q`) and the paging window
 * narrow the ROSTER only — the coverage summary always reflects the whole
 * county, so the headline numbers never move while the list is being filtered.
 *
 * `centre` matches the polling-centre name and `station` the exact IEBC stream
 * code, i.e. the centre is the venue and the station is the stream inside it.
 */
export async function agentRoster({ role, ward, centre, station, q, page, pageSize } = {}) {
  const where = {};
  if (role) where.role = String(role);
  if (ward) where.wardId = String(ward);
  if (centre) where.stationName = String(centre);
  if (station) where.stationCode = String(station);
  if (q) {
    const needle = String(q);
    where.OR = [
      { fullName: { contains: needle } },
      { idNumber: { contains: needle } },
      { phone: { contains: needle } },
      { stationName: { contains: needle } },
    ];
  }

  const perPage = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE));

  // Count first so the page window can be clamped: asking for a page past the
  // end after a filter change returns the last real page instead of nothing.
  const totalRows = await prisma.agent.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / perPage));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);

  const [grouped, rows, wardGroups] = await Promise.all([
    prisma.agent.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.agent.findMany({
      where,
      include: { ward: { select: { name: true, constituency: true } } },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
      skip: (currentPage - 1) * perPage,
      take: perPage,
    }),
    prisma.agent.groupBy({ by: ["wardId", "role"], _count: { _all: true } }),
  ]);

  const counts = emptyCounts();
  for (const g of grouped) if (g.role in counts) counts[g.role] = g._count._all;
  const totalRecruited = counts.primary + counts.backup + counts.supervisor;

  const targets = coverageTargets(context.stationsFlat.length);

  const coverageByRole = AGENT_ROLES.map((r) => ({
    role: r,
    target: targets[r],
    recruited: counts[r],
    gap: Math.max(0, targets[r] - counts[r]),
    fillPct: targets[r] ? Math.round((counts[r] / targets[r]) * 1000) / 10 : 0,
  }));

  const stationCounts = context.wards.map((w) => w.stations.length);
  const backupShares = allocate(targets.backup, stationCounts);
  const supervisorShares = allocate(targets.supervisor, stationCounts);

  const recruitedByWard = new Map();
  for (const g of wardGroups) {
    if (!g.wardId) continue;
    const c = recruitedByWard.get(g.wardId) || emptyCounts();
    if (g.role in c) c[g.role] = g._count._all;
    recruitedByWard.set(g.wardId, c);
  }

  const wards = context.wards.map((w, i) => {
    const c = recruitedByWard.get(w.id) || emptyCounts();
    const wardTargets = {
      primary: stationCounts[i],
      backup: backupShares[i],
      supervisor: supervisorShares[i],
      total: stationCounts[i] + backupShares[i] + supervisorShares[i],
    };
    return {
      wardId: w.id,
      ward: w.name,
      constituency: w.constituency,
      category: classifyWard(w),
      stations: stationCounts[i],
      targets: wardTargets,
      recruited: { ...c, total: c.primary + c.backup + c.supervisor },
    };
  });

  return {
    coverage: COVERAGE,
    roles: AGENT_ROLES,
    targets,
    counts,
    totalRecruited,
    coverageByRole,
    wards,
    roster: rows.map(toAgent),
    page: currentPage,
    pageSize: perPage,
    totalRows,
    totalPages,
  };
}

export default { COVERAGE, AGENT_ROLES, coverageTargets, agentRoster };
