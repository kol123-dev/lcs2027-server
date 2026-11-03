import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDatabase, loadBaselineFromDb } from "./bootstrap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Runtime data (content ledger, seed JSON) resolves to <server>/data so the
// app is self-contained on the VPS; override with DATA_DIR to relocate
// (e.g. a shared volume) without touching the code.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "../..", "data");

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, rel), "utf-8"));
}

// The speech/content ledger stays an editable file; the numbers live in SQLite.
let content = {};
try {
  content = loadJson("campaign-content.json");
} catch {
  content = { county: {}, wards: {} };
}

/**
 * Builds the enriched in-memory store from the baseline loaded out of the
 * database. Every controller reads from this single context object — the
 * shape is identical to when it was sourced from the JSON seed.
 */
function buildContext(raw) {
  const stationsFlat = [];
  const wards = raw.wards.map((w) => {
    const valid = w.valid || w.siyoi + w.khatundi + w.nakhumicha;
    const stations = (w.stations || []).map((s) => {
      const cast = s.cast ?? s.siyoi + s.khatundi + s.nakhumicha;
      return {
        ...s,
        cast,
        siyoiShare: s.valid ? s.siyoi / s.valid : 0,
        turnout2022: s.registered ? cast / s.registered : 0,
      };
    });
    stationsFlat.push(...stations);
    return {
      id: w.id,
      name: w.name,
      constituency: w.constituency,
      wardCode: w.wardCode,
      status: w.status,
      candidates: w.candidates,
      registered: w.registered,
      siyoi: w.siyoi,
      khatundi: w.khatundi,
      nakhumicha: w.nakhumicha,
      valid,
      leader: w.leader,
      margin: w.margin,
      siyoiShare: valid ? w.siyoi / valid : 0,
      stationCount: stations.length,
      stations,
      turnout2022: w.registered ? (w.cast || valid) / w.registered : 0,
    };
  });

  const subCounties = raw.subCounties.map((sc) => {
    const wardList = wards.filter((w) => w.constituency === sc.name);
    return {
      ...sc,
      candidates: sc.candidates,
      siyoiShare: sc.valid ? sc.siyoi / sc.valid : 0,
      khatundiShare: sc.valid ? sc.khatundi / sc.valid : 0,
      nakhumichaShare: sc.valid ? sc.nakhumicha / sc.valid : 0,
      turnout2022: sc.registered ? sc.valid / sc.registered : 0,
      wards: wardList,
      stationCount: wardList.reduce((a, w) => a + w.stationCount, 0),
    };
  });

  const totals = {
    registered: raw.meta?.totals?.registered,
    valid: raw.meta?.totals?.valid,
    votesCast: raw.meta?.totals?.votesCast,
    votesCastTurnoutPct: raw.meta?.totals?.turnoutPct,
    rejected: raw.meta?.totals?.rejected,
    turnoutPct: raw.meta?.totals?.turnoutPct,
    siyoi: raw.meta?.totals?.siyoi,
    khatundi: raw.meta?.totals?.khatundi,
    nakhumicha: raw.meta?.totals?.nakhumicha,
    marginOverSecond: raw.meta?.totals?.marginOverSecond,
  };

  // Enrich centres: attach ward id/name + derived status + ward target share.
  const wardsById = Object.fromEntries(wards.map((w) => [w.id, w]));
  const centres = (raw.centres || []).map((c) => {
    const ward = wardsById[c.wardId];
    return {
      ...c,
      name: c.name,
      constituency: c.constituency,
      wardId: c.wardId,
      ward: c.ward,
      wardCode: c.wardCode,
      status: c.status,
      siyoi: c.candidates.lcs ?? 0,
      khatundi: c.candidates.khatundi ?? 0,
      nakhumicha: c.candidates.nakhumicha ?? 0,
      valid: c.valid ?? 0,
      cast: c.cast ?? 0,
      registered: c.registered,
      siyoiShare: c.valid ? (c.candidates.lcs ?? 0) / c.valid : 0,
      turnout2022: c.registered ? (c.cast ?? 0) / c.registered : 0,
      wardSiyoiShare: ward ? ward.siyoiShare : 0,
      wardStatus: ward ? ward.status : null,
    };
  });

  return {
    meta: raw.meta,
    totals,
    subCounties,
    wards,
    centres,
    stationsFlat,
    content,
    wardsById,
    subCountiesById: Object.fromEntries(subCounties.map((s) => [s.id, s])),
  };
}

await ensureDatabase();
const raw = await loadBaselineFromDb();

export default buildContext(raw);