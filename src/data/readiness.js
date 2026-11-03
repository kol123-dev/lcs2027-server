import prisma from "../db.js";

/**
 * Per-ward field-readiness store, persisted to the `WardReadiness` table.
 * A boot-time snapshot is cached in memory so the (synchronous) services can
 * read it; writes go straight through to SQLite and refresh the snapshot.
 * The module deliberately imports nothing from the rest of the app so it can
 * be initialised during the context bootstrap without import cycles.
 */

export const DEFAULT_READINESS = {
  captainsRecruited: 35,
  captainsTrained: 20,
  agentsRecruited: 25,
  agentsTrained: 10,
  parallelTallyReady: 15,
  gotvBriefed: 0,
};

const KEYS = Object.keys(DEFAULT_READINESS);

const snapshot = new Map(); // wardId -> { six readiness counters }

function pick(row) {
  const out = {};
  for (const k of KEYS) out[k] = typeof row[k] === "number" ? row[k] : DEFAULT_READINESS[k];
  return out;
}

/** Replace the in-memory snapshot with rows returned from the database. */
export function initReadinessFromDb(rows = []) {
  snapshot.clear();
  for (const row of rows) snapshot.set(row.wardId, pick(row));
}

export function getReadiness(wardId) {
  return snapshot.get(wardId) ?? { ...DEFAULT_READINESS };
}

export async function persistReadiness(wardId, patch) {
  const data = {};
  for (const k of KEYS) {
    if (typeof patch[k] === "number") data[k] = Math.min(100, Math.max(0, Math.round(patch[k])));
  }
  if (!Object.keys(data).length) return getReadiness(wardId);

  const row = await prisma.wardReadiness.upsert({
    where: { wardId },
    create: { wardId, ...data },
    update: { ...data, updatedAt: new Date() },
  });
  snapshot.set(wardId, pick(row));
  return pick(row);
}

export default { initReadinessFromDb, getReadiness, persistReadiness, DEFAULT_READINESS };