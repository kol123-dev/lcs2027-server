/**
 * One-off: move every programme's sheet shape out of the legacy `detailFields`
 * JSON column and into `ProjectField` rows.
 *
 * Programmes seeded before the field table existed carry their shape (extra
 * columns, relabels, hidden base columns) as a JSON array on the Project row.
 * This reads that array and writes the equivalent rows — same keys, labels,
 * types, choices and order — so nothing about a programme's sheet changes.
 *
 * Idempotent: a programme that already has field rows is left alone, so it is
 * safe to re-run. `detailFields` is not cleared — the column stays as the
 * fallback until the rows are verified in production.
 *
 *   node prisma/backfill-project-fields.mjs            # apply
 *   node prisma/backfill-project-fields.mjs --dry-run  # report only
 */
import prisma from "../src/db.js";
import { fieldRowsFromDefs } from "../src/services/projects.js";

const dryRun = process.argv.includes("--dry-run");

const parse = (text) => {
  try {
    const v = JSON.parse(text || "");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const projects = await prisma.project.findMany({
  select: { id: true, slug: true, detailFields: true, fields: { select: { id: true } } },
  orderBy: { order: "asc" },
});

const written = [];
const skipped = [];

for (const p of projects) {
  const defs = parse(p.detailFields);
  if (!defs.length) continue; // nothing declared — the shared sheet alone
  if (p.fields.length) {
    skipped.push(p.slug);
    continue;
  }

  const rows = fieldRowsFromDefs(defs);
  if (!dryRun) {
    await prisma.projectField.createMany({ data: rows.map((r) => ({ ...r, projectId: p.id })) });
  }
  written.push({ slug: p.slug, fields: rows.length });
}

console.log(`${dryRun ? "[dry run] " : ""}programmes backfilled: ${written.length} | already had rows: ${skipped.length}`);
for (const w of written) console.log(`  + ${w.slug}  (${w.fields} field(s))`);
if (skipped.length) console.log(`  already on file: ${skipped.join(", ")}`);
console.log(`sheet field rows on file: ${await prisma.projectField.count()}`);

await prisma.$disconnect();
