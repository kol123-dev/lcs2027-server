/**
 * Re-sync the seeded programme DEFINITIONS onto the existing directory.
 *
 * `seedProjects` is insert-only by design, so it never clobbers captured
 * delivery data — which also means a programme created earlier keeps whatever
 * `detailFields` sheet shape it was created with, even after the shape in
 * `seed-projects.mjs` changes. This script closes that gap: it matches
 * programmes by `slug` and updates the definition columns only.
 *
 * Beneficiaries are NEVER touched.
 *
 *   node prisma/sync-project-sheets.mjs            # apply
 *   node prisma/sync-project-sheets.mjs --dry-run  # report only
 */
import prisma from "../src/db.js";
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
  detailFields: JSON.stringify(p.detailFields ?? []),
});

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
    detailFields: true,
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
  if (!changed.length) {
    current.push(p.slug);
    continue;
  }
  if (!dryRun) await prisma.project.update({ where: { id: row.id }, data: want });
  updated.push({ slug: p.slug, changed });
}

const missing = PROGRAMMES.filter((p) => !bySlug.has(p.slug)).map((p) => p.slug);

console.log(
  `${dryRun ? "[dry run] " : ""}programmes synced: ${updated.length} | already current: ${current.length} | not on file: ${missing.length}`
);
for (const u of updated) console.log(`  ~ ${u.slug}  (${u.changed.join(", ")})`);
if (missing.length) console.log(`  not on file (run db:seed to create): ${missing.join(", ")}`);

console.log(`beneficiaries on file (untouched): ${await prisma.projectBeneficiary.count()}`);

await prisma.$disconnect();
