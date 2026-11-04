import context from "../data/context.js";
import { classifyWard, ASSUMPTIONS } from "./strategy.js";
import { getReadiness, persistReadiness } from "../data/readiness.js";
import { COVERAGE, coverageTargets, allocate } from "./agents.js";

/**
 * Polling Agent & Grassroots Network Manager.
 *
 * Agent coverage follows the plan in services/agents.js — one primary agent
 * per polling station, one backup per 10 stations and one supervisor per 25
 * stations — with targets derived from the live station count. GOTV mobilizer
 * ratios stay voter-based. Readiness state is persisted to the database
 * (WardReadiness) and served from an in-memory snapshot warmed at boot.
 */

export const RATIOS = {
  ...COVERAGE,
  // GOTV mobilizers per voter block
  mobilizerPerVoters: 100,
  minMobilizersPerWard: 8,
};

const mobilizersFor = (ward) =>
  Math.max(RATIOS.minMobilizersPerWard, Math.round(ward.registered / RATIOS.mobilizerPerVoters));

export function network() {
  const county = coverageTargets(context.stationsFlat.length);
  const stationCounts = context.wards.map((w) => w.stations.length);
  const backupShares = allocate(county.backup, stationCounts);
  const supervisorShares = allocate(county.supervisor, stationCounts);

  const rows = context.wards.map((w, i) => ({
    wardId: w.id,
    ward: w.name,
    constituency: w.constituency,
    category: classifyWard(w),
    registered: w.registered,
    turnout2022: w.turnout2022,
    stations: stationCounts[i],
    primaryNeeded: stationCounts[i],
    backupNeeded: backupShares[i],
    supervisorNeeded: supervisorShares[i],
    teamNeeded: stationCounts[i] + backupShares[i] + supervisorShares[i],
    mobilizersNeeded: mobilizersFor(w),
    readiness: getReadiness(w.id),
  }));

  const totals = {
    stations: county.stations,
    primary: county.primary,
    backup: county.backup,
    supervisor: county.supervisor,
    team: county.total,
    mobilizers: rows.reduce((a, r) => a + r.mobilizersNeeded, 0),
  };

  return {
    ratios: RATIOS,
    networkTiering: {
      county: context.subCounties.length,
      subCounties: context.subCounties.map((sc) => ({ name: sc.name, wards: sc.wardCount, stations: sc.stationCount })),
      wards: context.wards.length,
      stations: context.stationsFlat.length,
    },
    totals,
    wards: rows,
    protocols: PARALLEL_TALLY_PROTOCOLS,
  };
}

/**
 * Apply a readiness patch. Writes through to SQLite and refreshes the
 * boot-time snapshot; values are clamped to 0–100. Returns null for an
 * unknown ward id so the controller can 404.
 */
export async function updateReadiness(wardId, patch) {
  if (!context.wards.some((w) => w.id === wardId)) return null;
  return persistReadiness(wardId, patch ?? {});
}

export const PARALLEL_TALLY_PROTOCOLS = {
  chain: [
    "Agent arrives 06:00, logs Presiding Officer presence & kit serial.",
    "At close: observe sorting, counting and first reconciliation.",
    "Photograph Form 34A immediately upon issue (before signatures).",
    "Relay photo via WhatsApp tally group + SMS to ward tally desk.",
    "Physically deliver a copy (boda courier pool) to ward tally room.",
    "Ward desk reconciles against neighbour stations; flags anomalies.",
    "County tally desk streams ward numbers to war-room scripture.",
    "Variance > 3% vs parallel count triggers dispute-response desk.",
  ],
  comms: {
    primary: "WhatsApp ward+sub-county groups (2 reporting clerks each)",
    fallback: "SMS shortcode with station code + numbers",
    courier: "Boda courier rota: 2 riders per sub-county on standby",
    warRoom: "Sixty-second whip rounds every 2 hours from 19:00",
  },
  stashing: [
    "Photograph inside the room immediately; never leave the hall.",
    "Backup photo on a second phone before leaving.",
    "Time-stamp each photo; encode station code in filename.",
    "Two independent witnesses co-sign a scrap tally sheet.",
    "Upload copy to cloud drive at 20:00 every election night.",
  ],
};

export function stationsIndex({ ward, q } = {}) {
  return context.wards
    .filter((w) => (ward ? w.id === ward : true))
    .flatMap((w) =>
      w.stations.map((s) => ({
        name: s.name,
        code: s.code,
        ward: w.name,
        wardId: w.id,
        constituency: w.constituency,
        registered: s.registered,
        cast2022: s.cast,
        turnout2022Pct: s.registered ? Math.round((s.cast / s.registered) * 1000) / 10 : 0,
        primaryNeeded: COVERAGE.primaryPerStation,
      }))
    )
    .filter((s) => (q ? s.name.toLowerCase().includes(q.toLowerCase()) : true));
}

export default { network, updateReadiness, stationsIndex };