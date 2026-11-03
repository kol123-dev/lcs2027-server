import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "2022-results.json");
const raw = JSON.parse(fs.readFileSync(root, "utf-8"));

let total = 0;
const codes = new Map();
const missingRegistered = { stationsIn: 0, registered: 0, siyoi: 0 };

for (const w of raw.wards) {
  for (const s of w.stations) {
    total++;
    codes.set(s.code, (codes.get(s.code) || 0) + 1);
  }
}

const dups = [...codes.entries()].filter(([, n]) => n > 1);
const MISSING = []; // will compute if needed

// Aggregate official numbers from wards (the totals the tests assert)
const agg = raw.wards.reduce(
  (a, w) => {
    a.registered += w.registered || 0;
    a.siyoi += w.siyoi || 0;
    a.stations += w.stationCount || w.stations.length;
    return a;
  },
  { registered: 0, siyoi: 0, stations: 0 }
);

console.log(JSON.stringify(
  {
    file: root,
    totalStationRows: total,
    uniqueCodes: codes.size,
    duplicateCodes: dups,
    wardAggregate: agg,
  },
  null,
  2
));