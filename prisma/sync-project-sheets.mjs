/**
 * Re-sync the seeded programme DEFINITIONS onto the existing directory.
 *
 * `seedProjects` is insert-only by design, so it never clobbers captured
 * delivery data — which also means a programme created earlier keeps whatever
 * sheet shape it was created with, even after the shape in `seed-projects.mjs`
 * changes. This script closes that gap: it matches programmes by `slug` and
 * updates the definition columns and the programme's `ProjectField` rows.
 *
 * Beneficiaries are NEVER touched.
 *
 *   node prisma/sync-project-sheets.mjs            # apply
 *   node prisma/sync-project-sheets.mjs --dry-run  # report only
 */
import prisma from "../src/db.js";
import { fieldRowsFromDefs } from "../src/services/projects.js";
import { PROGRAMMES } from "./seed-projects.mjs";

const dryRun = process.argv.includes("--dry-run");

/** Definition columns owned by the seed (never delivery data). */
const definitionOf = (p, order) => ({
  name: p.name,
  category: p.category,
  summary: p.summary,
  description: p.description,
  unit: p.unit,
  metric: p.metric,
  order,
});

/** Canonical text for a stored field row, so shapes can be compared. */
const rowShape = (r) =>
  [r.key, r.label, r.type, r.options, r.required === true, r.hidden === true, r.help ?? "", r.order].join("|");

const shapeOf = (rows) => rows.map(rowShape).sort().join("\n");

const rows = await prisma.project.findMany({
  select: {
    id: true,
    slug: true,
    name: true,
    category: true,
    summary: true,
    description: true,
    unit: true,
    metric: true,
    order: true,
    fields: { orderBy: { order: "asc" } },
  },
});
const bySlug = new Map(rows.map((r) => [r.slug, r]));

const updated = [];
const current = [];

for (let i = 0; i < PROGRAMMES.length; i++) {
  const p = PROGRAMMES[i];
  const row = bySlug.get(p.slug);
  if (!row) continue; // not on file — `db:seed` creates it

  const want = definitionOf(p, i + 1);
  const changed = Object.keys(want).filter((k) => (row[k] ?? null) !== want[k]);

  const wantFields = fieldRowsFromDefs(p.detailFields);
  const shapeChanged = shapeOf(wantFields) !== shapeOf(row.fields);

  if (!changed.length && !shapeChanged) {
    current.push(p.slug);
    continue;
  }
  if (!dryRun) {
    await prisma.project.update({
      where: { id: row.id },
      data: { ...want, fields: { deleteMany: {}, create: wantFields } },
    });
  }
  updated.push({ slug: p.slug, changed: [...changed, ...(shapeChanged ? ["fields"] : [])] });
}

const missing = PROGRAMMES.filter((p) => !bySlug.has(p.slug)).map((p) => p.slug);

console.log(
  `${dryRun ? "[dry run] " : ""}programmes synced: ${updated.length} | already current: ${current.length} | not on file: ${missing.length}`
);
for (const u of updated) console.log(`  ~ ${u.slug}  (${u.changed.join(", ")})`);
if (missing.length) console.log(`  not on file (run db:seed to create): ${missing.join(", ")}`);

console.log(`beneficiaries on file (untouched): ${await prisma.projectBeneficiary.count()}`);
console.log(`sheet field rows on file: ${await prisma.projectField.count()}`);

await prisma.$disconnect();
