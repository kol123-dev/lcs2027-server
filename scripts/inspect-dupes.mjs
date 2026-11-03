import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "2022-results.json");
const raw = JSON.parse(fs.readFileSync(root, "utf-8"));

const byCode = new Map();
for (const w of raw.wards) {
  for (const s of w.stations) {
    if (!byCode.has(s.code)) byCode.set(s.code, []);
    byCode.get(s.code).push({ ward: w.name, ...s });
  }
}

for (const [code, rows] of byCode) {
  if (rows.length > 1) {
    console.log("CODE", code, "WARD", rows[0].ward, "vs", rows[1].ward);
    console.log("  A:", JSON.stringify(rows[0]));
    console.log("  B:", JSON.stringify(rows[1]));
    console.log("  identical:", JSON.stringify(rows[0]) === JSON.stringify(rows[1]));
  }
}