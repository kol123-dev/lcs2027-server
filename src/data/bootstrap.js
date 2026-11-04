import prisma from "../db.js";
import seedCampaign from "../../prisma/seed-data.mjs";
import seedAgents from "../../prisma/seed-agents.mjs";
import seedBlocs from "../../prisma/seed-blocs.mjs";
import migrateLegacyAuth from "./legacy-auth.mjs";
import { initReadinessFromDb } from "./readiness.js";

/**
 * Database bootstrap.
 *
 * 1. ensureDatabase() — seeds the IEBC 2022 baseline on first boot, imports
 *    any accounts still sitting in the legacy JSON auth store, and warms the
 *    field-readiness snapshot.
 * 2. loadBaselineFromDb() — reads the baseline tables back out in exactly the
 *    shape `data/2022-results.json` used to have, so context.js can keep
 *    building the enriched store identically while SQLite is now the source
 *    of truth.
 */

export async function ensureDatabase() {
  const subCountyCount = await prisma.subCounty.count();
  if (subCountyCount === 0) {
    const counts = await seedCampaign(prisma);
    process.stdout.write(
      // eslint-disable-next-line no-console
      `[db] seeded baseline ${counts.subCounties} sub-counties / ${counts.wards} wards / ${counts.stations} stations / ${counts.centres} centres\n`
    );
  }
  const migrated = await migrateLegacyAuth(prisma);
  if (migrated.users > 0) {
    process.stdout.write(
      // eslint-disable-next-line no-console
      `[db] imported ${migrated.users} legacy user(s), ${migrated.sessions} session(s), ${migrated.accounts} account(s)\n`
    );
  }
  // Insert- and backfill-only: a non-empty roster is left untouched, so
  // genuinely recruited agents are never clobbered by a boot-time top-up.
  const agents = await seedAgents(prisma);
  if (agents.created > 0) {
    process.stdout.write(
      // eslint-disable-next-line no-console
      `[db] seeded ${agents.created} field-ops agents\n`
    );
  }
  if (agents.backfilled > 0) {
    process.stdout.write(
      // eslint-disable-next-line no-console
      `[db] posted ${agents.backfilled} field-ops agent(s) to polling stations\n`
    );
  }
  // Insert-only: an existing bloc register is left untouched, so real outreach
  // data is never clobbered by a boot-time top-up.
  const blocs = await seedBlocs(prisma);
  if (blocs.created > 0) {
    process.stdout.write(
      // eslint-disable-next-line no-console
      `[db] seeded ${blocs.created} outreach bloc(s), ${blocs.members} member(s) captured\n`
    );
  }
  const readinessRows = await prisma.wardReadiness.findMany();
  initReadinessFromDb(readinessRows);
}

const parseJson = (text) => {
  try {
    return JSON.parse(text || "{}");
  } catch {
    return {};
  }
};

const toStation = (s) => ({
  name: s.name,
  constituency: s.constituency,
  code: s.code,
  registered: s.registered,
  candidates: parseJson(s.candidates),
  siyoi: s.siyoi,
  khatundi: s.khatundi,
  nakhumicha: s.nakhumicha,
  cast: s.cast,
  rejected: s.rejected,
  valid: s.valid,
  verification: s.verification,
});

const toSubCounty = (s) => ({
  id: s.id,
  name: s.name,
  registered: s.registered,
  candidates: parseJson(s.candidates),
  siyoi: s.siyoi,
  khatundi: s.khatundi,
  nakhumicha: s.nakhumicha,
  cast: s.cast,
  rejected: s.rejected,
  valid: s.valid,
  siyoiShare: s.siyoiShare,
  margin: s.margin,
  opponent: s.opponent,
  turnoutPct: s.turnoutPct,
});

const toWard = (w, stations) => ({
  id: w.id,
  name: w.name,
  constituency: w.constituency,
  wardCode: w.wardCode,
  registered: w.registered,
  candidates: parseJson(w.candidates),
  siyoi: w.siyoi,
  khatundi: w.khatundi,
  nakhumicha: w.nakhumicha,
  cast: w.cast,
  rejected: w.rejected,
  valid: w.valid,
  leader: w.leader,
  margin: w.margin,
  siyoiShare: w.siyoiShare,
  status: w.status,
  stationCount: stations.length,
  stations,
});

const toCentre = (c) => ({
  id: c.id,
  name: c.name,
  constituency: c.constituency,
  ward: c.ward,
  wardCode: c.wardCode,
  registered: c.registered,
  candidates: parseJson(c.candidates),
  cast: c.cast,
  rejected: c.rejected,
  valid: c.valid,
  status: c.status,
  statusOfficial: c.statusOfficial,
  wardId: c.wardId,
  // Per-centre content fields (JSON string in DB, array/string in the store).
  keyAchievements: Array.isArray(parseJson(c.keyAchievements)) ? parseJson(c.keyAchievements) : [],
  campaignMessage: c.campaignMessage || "",
});

export async function loadBaselineFromDb(prismaClient = prisma) {
  const promises = [
    prismaClient.metaRow.findUnique({ where: { key: "meta" } }),
    prismaClient.subCounty.findMany(),
    prismaClient.ward.findMany(),
    prismaClient.centre.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ];
  const [metaRow, subCounties, wards, centres] = await Promise.all(promises);
  const stations = await prismaClient.station.findMany({ orderBy: [{ sortOrder: "asc" }] });

  const stationsByWard = new Map();
  for (const s of stations) {
    const list = stationsByWard.get(s.wardId) || [];
    list.push(s);
    stationsByWard.set(s.wardId, list);
  }

  return {
    meta: metaRow ? JSON.parse(metaRow.value) : { candidates: [] },
    subCounties: subCounties.map(toSubCounty),
    wards: wards.map((w) => toWard(w, stationsByWard.get(w.id) || [])),
    centres: centres.map(toCentre),
  };
}

export default { ensureDatabase, loadBaselineFromDb };