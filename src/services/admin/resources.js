import prisma from "../../db.js";
import { RESOURCES, resourceByKey, relationTargets } from "./registry.js";
import { coerceFields } from "./coerce.js";

/**
 * Generic CRUD engine for the superadmin console.
 *
 * Every read and write route in `/api/admin/:resource` funnels through these
 * functions. The shape of each dataset — its key, its searchable columns, the
 * fields a superadmin may edit — comes from `registry.js`; the engine only
 * knows how to talk to Prisma.
 *
 * Adding a dataset therefore needs no new controller, no new route and no new
 * SQL: one registry entry is enough.
 */

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

/** Columns a superadmin may filter a listing by (exact match, when present). */
const EXACT_FILTERS = [
  "wardId",
  "subCountyId",
  "blocId",
  "projectId",
  "category",
  "status",
  "type",
  "role",
  "areaType",
  "gender",
  "constituency",
  "wardCode",
  "metric",
];

/** Coerce a route/body key into the type Prisma expects (autoincrement ids). */
function normalizeKey(resource, raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  if (resource.keyType === "int") {
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return String(raw);
}

function buildWhere(resource, query = {}) {
  const where = {};
  const fieldNames = new Set(resource.fields.map((f) => f.name));

  for (const key of EXACT_FILTERS) {
    if (!fieldNames.has(key)) continue;
    const raw = query[key];
    if (raw === undefined || raw === null || raw === "") continue;
    where[key] = String(raw);
  }

  const q = typeof query.q === "string" ? query.q.trim() : "";
  if (q && resource.searchFields?.length) {
    where.OR = resource.searchFields.map((field) => ({ [field]: { contains: q } }));
  }

  return where;
}

function buildOrderBy(resource, sort, dir) {
  const direction = dir === "desc" ? "desc" : dir === "asc" ? "asc" : null;
  const fieldNames = new Set(resource.fields.map((f) => f.name));
  if (sort && fieldNames.has(sort)) return [{ [sort]: direction ?? "asc" }];
  const fallback = resource.defaultSort;
  return fallback?.field ? [{ [fallback.field]: fallback.dir ?? "asc" }] : undefined;
}

/** Turn a Prisma failure into a sentence a superadmin can act on. */
function prismaMessage(err) {
  const code = err?.code;
  if (code === "P2002") {
    const target = err.meta?.target;
    const field = Array.isArray(target) ? target.join(", ") : target;
    return `A record with this ${field ?? "value"} already exists`;
  }
  if (code === "P2003") return "This record is still referenced by other data — remove those first";
  if (code === "P2025") return "Record not found";
  const line = typeof err?.message === "string" ? err.message.split("\n").filter(Boolean).pop() : null;
  return line || "The database rejected this change";
}

/** Paged listing with search, filters and a server-chosen sort. */
export async function listResource(resource, query = {}) {
  const where = buildWhere(resource, query);
  const orderBy = buildOrderBy(resource, query.sort, query.dir);

  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize) || DEFAULT_PAGE_SIZE));
  const totalRows = await prisma[resource.model].count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const page = Math.min(Math.max(1, Number(query.page) || 1), totalPages);

  const rows = await prisma[resource.model].findMany({
    where,
    orderBy,
    include: resource.include,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return { rows, page, pageSize, totalRows, totalPages };
}

export async function getResourceRow(resource, key) {
  const id = normalizeKey(resource, key);
  if (id === null) return null;
  return prisma[resource.model].findUnique({
    where: { [resource.keyField]: id },
    include: resource.include,
  });
}

/**
 * A relation may name a `companion` column that mirrors the target's label —
 * the beneficiary sheet keeps both the polling centre code and its name. The
 * relation only writes its own column, so the mirror is filled in here.
 */
async function resolveCompanions(resource, data) {
  for (const field of resource.fields) {
    if (!field.companion || !field.relation) continue;
    if (!Object.prototype.hasOwnProperty.call(data, field.name)) continue;

    const raw = data[field.name];
    if (raw === null || raw === "") {
      data[field.companion] = null;
      continue;
    }

    const target = resourceByKey(field.relation.resource);
    const row = target
      ? await prisma[target.model].findFirst({ where: { [field.relation.valueField]: String(raw) } })
      : null;
    data[field.companion] = row ? String(row[field.relation.labelField] ?? raw).slice(0, 160) : null;
  }
}

export async function createResource(resource, payload = {}) {
  const { data, errors } = coerceFields(resource.fields, payload, { partial: false });

  // A hand-written primary key (slug, candidate key, readiness ward) is not an
  // editable field — the registry marks it `readonly` — so it is picked up here.
  if (!resource.keyGenerated) {
    const key = normalizeKey(resource, payload[resource.keyField]);
    if (key === null) errors.push(`${resource.keyField} is required`);
    else data[resource.keyField] = key;
  }

  if (errors.length) return { errors };
  await resolveCompanions(resource, data);
  try {
    const row = await prisma[resource.model].create({ data, include: resource.include });
    return { row };
  } catch (err) {
    return { errors: [prismaMessage(err)] };
  }
}

export async function updateResource(resource, key, payload = {}) {
  const id = normalizeKey(resource, key);
  if (id === null) return { notFound: true };

  const existing = await prisma[resource.model].findUnique({ where: { [resource.keyField]: id } });
  if (!existing) return { notFound: true };

  const { data, errors } = coerceFields(resource.fields, payload, { partial: true });
  if (errors.length) return { errors };
  if (Object.keys(data).length === 0) return { errors: ["Nothing to update"] };

  await resolveCompanions(resource, data);
  try {
    const row = await prisma[resource.model].update({
      where: { [resource.keyField]: id },
      data,
      include: resource.include,
    });
    return { row };
  } catch (err) {
    return { errors: [prismaMessage(err)] };
  }
}

export async function deleteResource(resource, key) {
  const id = normalizeKey(resource, key);
  if (id === null) return { notFound: true };

  const existing = await prisma[resource.model].findUnique({ where: { [resource.keyField]: id } });
  if (!existing) return { notFound: true };

  try {
    await prisma[resource.model].delete({ where: { [resource.keyField]: id } });
    const label = resource.titleField ? existing[resource.titleField] : null;
    return { deleted: true, id, label };
  } catch (err) {
    return { errors: [prismaMessage(err)] };
  }
}

/**
 * Option lists for every `relation` field across the registry.
 *
 * The console loads this once and uses it to render relation selects and to
 * resolve the plain foreign-key columns (`wardId`, `blocId`, …) into names.
 * A target may declare a `scopeField` (polling centres follow their ward), in
 * which case each option carries the scope so the client can narrow the list,
 * and a `labelSuffixField` that is shown beside the label because centre names
 * repeat. Options are de-duplicated — a few IEBC codes repeat across tallies.
 */
export async function buildLookups() {
  const lookups = {};
  for (const target of relationTargets()) {
    const resource = resourceByKey(target.resource);
    if (!resource) continue;
    const orderBy = resource.defaultSort?.field
      ? [{ [resource.defaultSort.field]: resource.defaultSort.dir ?? "asc" }]
      : undefined;
    const rows = await prisma[resource.model].findMany({ orderBy });
    const seen = new Set();
    lookups[target.resource] = rows.reduce((list, row) => {
      const value = String(row[target.valueField]);
      if (seen.has(value)) return list;
      seen.add(value);
      const base = String(row[target.labelField] ?? value);
      const suffix = target.labelSuffixField ? row[target.labelSuffixField] : null;
      const option = { value, label: suffix ? `${base} (${suffix})` : base };
      if (target.scopeField) option.scope = row[target.scopeField] == null ? "" : String(row[target.scopeField]);
      list.push(option);
      return list;
    }, []);
  }
  return lookups;
}

/** Row count for every registered dataset — powers the console overview. */
export async function resourceCounts() {
  const pairs = await Promise.all(RESOURCES.map(async (r) => [r.key, await prisma[r.model].count()]));
  return Object.fromEntries(pairs);
}

export default {
  listResource,
  getResourceRow,
  createResource,
  updateResource,
  deleteResource,
  buildLookups,
  resourceCounts,
};
