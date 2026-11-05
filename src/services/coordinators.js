import prisma from "../db.js";
import context from "../data/context.js";

/**
 * Field Ops — area co-ordinator roster.
 *
 * Agents staff the polling stations; co-ordinators own the ground between HQ
 * and those agents. Each co-ordinator is tied to exactly one named area —
 * a whole sub-county, a ward, or a village inside a ward — and the plan is
 * derived from the LIVE geography rather than a frozen constant, so a ward
 * split or a new sub-county can never leave a stale target behind:
 *
 *   5 sub-counties + 25 wards = 30 posts
 *
 * Villages are a deeper, optional tier (the campaign adds them as it goes),
 * so they carry no plan target — only sub-county and ward posts do.
 */

export const COORDINATOR_AREAS = ["subCounty", "ward", "village"];

export const AREA_LABELS = {
  subCounty: "Sub-county",
  ward: "Ward",
  village: "Village",
};

/** Posts needed for a county of `subCountyCount` sub-counties and `wardCount` wards. */
export function coordinatorTargets(
  subCountyCount = context.subCounties.length,
  wardCount = context.wards.length
) {
  return { subCounty: subCountyCount, ward: wardCount, village: 0, total: subCountyCount + wardCount };
}

const emptyCounts = () => ({ subCounty: 0, ward: 0, village: 0 });

/** The single named area a co-ordinator owns, as one readable string. */
function areaOf(c) {
  if (c.areaType === "village") return [c.village, c.ward?.name].filter(Boolean).join(", ") || null;
  if (c.areaType === "subCounty") return c.subCounty?.name ?? null;
  return c.ward?.name ?? null;
}

const toCoordinator = (c) => ({
  id: c.id,
  fullName: c.fullName,
  idNumber: c.idNumber,
  gender: c.gender,
  phone: c.phone,
  altPhone: c.altPhone,
  areaType: c.areaType,
  areaLabel: AREA_LABELS[c.areaType] ?? c.areaType,
  subCountyId: c.subCountyId ?? null,
  subCounty: c.subCounty?.name ?? null,
  wardId: c.wardId ?? null,
  ward: c.ward?.name ?? null,
  constituency: c.ward?.constituency ?? null,
  village: c.village ?? null,
  area: areaOf(c),
  status: c.status,
  createdAt: c.createdAt,
});

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 200;

/** The 30 posts the plan calls for, each with whoever currently holds it. */
function postBoard(rows) {
  const bySubCounty = new Map();
  const byWard = new Map();
  for (const c of rows) {
    if (c.areaType === "subCounty" && c.subCountyId) bySubCounty.set(c.subCountyId, c);
    if (c.areaType === "ward" && c.wardId) byWard.set(c.wardId, c);
  }

  const post = (level, name, row) => ({
    level,
    area: name,
    coordinator: row?.fullName ?? null,
    phone: row?.phone ?? null,
    status: row?.status ?? null,
  });

  // Sub-county posts first, then that sub-county's ward posts — so the board
  // reads down the county in the same order as the rest of the dashboard.
  return context.subCounties.flatMap((sc) => [
    { subCountyId: sc.id, subCounty: sc.name, ...post("Sub-county", sc.name, bySubCounty.get(sc.id)) },
    ...context.wards
      .filter((w) => w.constituency === sc.name)
      .map((w) => ({ subCountyId: sc.id, subCounty: sc.name, wardId: w.id, ...post("Ward", w.name, byWard.get(w.id)) })),
  ]);
}

/**
 * Live roster plus recruited-vs-plan coverage.
 *
 * The filters (`areaType`, `ward`, `subCounty`, `q`) and the paging window
 * narrow the ROSTER only — the coverage summary and the post board always
 * reflect the whole county, so the headline numbers never move while the list
 * is being filtered.
 */
export async function coordinatorRoster({ areaType, ward, subCounty, q, page, pageSize } = {}) {
  const where = {};
  if (areaType) where.areaType = String(areaType);
  if (ward) where.wardId = String(ward);
  if (subCounty) where.subCountyId = String(subCounty);
  if (q) {
    const needle = String(q);
    where.OR = [
      { fullName: { contains: needle } },
      { idNumber: { contains: needle } },
      { phone: { contains: needle } },
      { village: { contains: needle } },
    ];
  }

  const perPage = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE));

  const totalRows = await prisma.coordinator.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / perPage));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);

  const [grouped, rows, all] = await Promise.all([
    prisma.coordinator.groupBy({ by: ["areaType"], _count: { _all: true } }),
    prisma.coordinator.findMany({
      where,
      include: {
        ward: { select: { name: true, constituency: true } },
        subCounty: { select: { name: true } },
      },
      orderBy: [{ areaType: "asc" }, { fullName: "asc" }],
      skip: (currentPage - 1) * perPage,
      take: perPage,
    }),
    // Every row, unpaged: the post board is built from the whole register.
    prisma.coordinator.findMany({
      select: { id: true, fullName: true, phone: true, status: true, areaType: true, wardId: true, subCountyId: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const counts = emptyCounts();
  for (const g of grouped) if (g.areaType in counts) counts[g.areaType] = g._count._all;
  const totalRecruited = counts.subCounty + counts.ward + counts.village;

  const plan = coordinatorTargets();

  const coverageByArea = COORDINATOR_AREAS.map((a) => ({
    areaType: a,
    label: AREA_LABELS[a],
    target: plan[a],
    recruited: counts[a],
    gap: Math.max(0, plan[a] - counts[a]),
    fillPct: plan[a] ? Math.round((counts[a] / plan[a]) * 1000) / 10 : 0,
  }));

  return {
    areas: COORDINATOR_AREAS,
    areaLabels: AREA_LABELS,
    plan,
    counts,
    totalRecruited,
    coverageByArea,
    posts: postBoard(all),
    roster: rows.map(toCoordinator),
    page: currentPage,
    pageSize: perPage,
    totalRows,
    totalPages,
  };
}

export default { COORDINATOR_AREAS, AREA_LABELS, coordinatorTargets, coordinatorRoster };
