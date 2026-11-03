import context from "../data/context.js";
import { classifyWard, ASSUMPTIONS } from "./strategy.js";
import { getReadiness, persistReadiness } from "../data/readiness.js";

/**
 * Polling Agent & Grassroots Network Manager.
 *
 * Agent ratios are configurable so the team can scale staffing to
 * budget. Readiness state is persisted to the database (WardReadiness)
 * and served from an in-memory snapshot warmed at boot.
 */

export const RATIOS = {
  // one agent per N registered voters, with hard minimum per centre
  agentPerVoters: 400,
  minAgentsPerStation: 3,
  maxAgentsPerStation: 12,
  standbyFraction: 0.2,
  // GOTV mobilizers per voter block
  mobilizerPerVoters: 100,
  minMobilizersPerWard: 8,
};

function agentNeeds(station) {
  const calc = Math.ceil(station.registered / RATIOS.agentPerVoters);
  return Math.min(RATIOS.maxAgentsPerStation, Math.max(RATIOS.minAgentsPerStation, calc));
}

export function network() {
  const rows = context.wards.map((w) => {
    const stations = w.stations.map((s) => {
      const agents = agentNeeds(s);
      return {
        name: s.name,
        registered: s.registered,
        cast2022: s.cast,
        agentsNeeded: agents,
        standbysNeeded: Math.max(1, Math.ceil(agents * RATIOS.standbyFraction)),
        mobilizersNeeded: Math.max(RATIOS.minMobilizersPerWard, Math.round(w.registered / RATIOS.mobilizerPerVoters)),
      };
    });
    const agentsNeeded = stations.reduce((a, s) => a + s.agentsNeeded, 0);
    const standbys = stations.reduce((a, s) => a + s.standbysNeeded, 0);
    const mobilizers = Math.max(RATIOS.minMobilizersPerWard, Math.round(w.registered / RATIOS.mobilizerPerVoters));
    return {
      wardId: w.id,
      ward: w.name,
      constituency: w.constituency,
      category: classifyWard(w),
      registered: w.registered,
      turnout2022: w.turnout2022,
      stations: stations.length,
      agentsNeeded,
      standbysNeeded: standbys,
      mobilizersNeeded: mobilizers,
      readiness: getReadiness(w.id),
    };
  });

  const totals = rows.reduce(
    (a, r) => {
      a.stations += r.stations;
      a.agentsNeeded += r.agentsNeeded;
      a.standbys += r.standbysNeeded;
      a.mobilizers += r.mobilizersNeeded;
      return a;
    },
    { stations: 0, agentsNeeded: 0, standbys: 0, mobilizers: 0 }
  );

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
      w.stations.map((s) => {
        const agents = agentNeeds(s);
        return {
          name: s.name,
          ward: w.name,
          wardId: w.id,
          constituency: w.constituency,
          registered: s.registered,
          cast2022: s.cast,
          turnout2022Pct: w.registered ? Math.round((s.cast / s.registered) * 1000) / 10 : 0,
          agentsNeeded: agents,
          standbysNeeded: Math.max(1, Math.ceil(agents * RATIOS.standbyFraction)),
        };
      })
    )
    .filter((s) => (q ? s.name.toLowerCase().includes(q.toLowerCase()) : true));
}

export default { network, updateReadiness, stationsIndex };