import prisma from "../db.js";
import context from "../data/context.js";
import { normalizePhone } from "../auth/phone.js";

/**
 * Projects, Initiatives & Achievements — the delivery directory.
 *
 * Every programme the campaign runs on the ground (scholarships, tents &
 * chairs, Mama Soko, Pad-a-Girl, Jenga Nyumba, anti-jigger, tools of trade…)
 * is a `Project`. Each beneficiary — a student, a pupil, a women's group, a
 * boda stage, a place of worship — is a `ProjectBeneficiary` row carrying the
 * full delivery SHEET: beneficiary (and parent/guardian), ward/village/nearby
 * polling centre, an active phone number, the quantity or amount issued and
 * any programme-specific extras (`details`, declared per programme via
 * `detailFields`).
 *
 * Read live from MySQL — the same source of truth as every other live dataset.
 * The polling centre is stored denormalised (IEBC code + name strings) so the
 * directory survives the `db:seed` centre/station re-sync, exactly like the
 * bloc and roadmap registers.
 */

export const PROJECT_CATEGORIES = [
  { id: "education", label: "Education & Child Welfare" },
  { id: "enterprise", label: "Enterprise & Livelihoods" },
  { id: "inclusion", label: "Inclusion & Health" },
  { id: "infrastructure", label: "Community Infrastructure" },
  { id: "employment", label: "Employment & Linkages" },
  { id: "sports", label: "Sports & Youth" },
];

export const BENEFICIARY_STATUS = ["issued", "pending"];

export const PROJECT_STATUS = ["active", "planned", "completed"];

const CATEGORY_LABEL = Object.fromEntries(PROJECT_CATEGORIES.map((c) => [c.id, c.label]));

/** Parse a JSON text column, falling back safely when the value is malformed. */
const parseJson = (text, fallback) => {
  try {
    const v = JSON.parse(text || "");
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

const parseFields = (text) => {
  const v = parseJson(text, []);
  return Array.isArray(v) ? v.filter((f) => f && typeof f.key === "string") : [];
};

const parseDetails = (text) => {
  const v = parseJson(text, {});
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * The shared delivery sheet every programme starts from.
 *
 * `type` drives both the control the console renders and how the value is
 * validated: text | tel | number | date | textarea | select | ward | station.
 * A programme may relabel or hide any of these, but the stored columns never
 * change — so totals stay comparable across every programme.
 */
export const SHEET_BASE_FIELDS = [
  { key: "name", label: "Name of beneficiary / group", type: "text", required: true },
  { key: "parentName", label: "Parent / guardian", type: "text" },
  { key: "phone", label: "Active phone number", type: "tel" },
  { key: "wardId", label: "Ward", type: "ward" },
  { key: "village", label: "Village", type: "text" },
  { key: "stationCode", label: "Nearby polling centre", type: "station" },
  { key: "quantity", label: "Quantity issued", type: "number" },
  { key: "amount", label: "Amount issued (KES)", type: "number" },
  { key: "dateIssued", label: "Date issued", type: "date" },
  { key: "status", label: "Status", type: "select", options: [...BENEFICIARY_STATUS] },
  { key: "notes", label: "Notes", type: "textarea" },
];

const BASE_FIELD_KEYS = new Set(SHEET_BASE_FIELDS.map((f) => f.key));

/** Types a programme may use for its own extra columns. */
export const SHEET_EXTRA_TYPES = ["text", "textarea", "select", "number", "date"];

const EXTRA_KEY_MAX = 60;
const EXTRA_VALUE_MAX = 300;

/** Normalise one programme-defined extra field, dropping anything unusable. */
function normaliseExtraField(f) {
  if (!f || typeof f.key !== "string") return null;
  const key = f.key.trim().slice(0, EXTRA_KEY_MAX);
  if (!key || BASE_FIELD_KEYS.has(key)) return null;

  const declared = SHEET_EXTRA_TYPES.includes(f.type) ? f.type : "text";
  const options = Array.isArray(f.options)
    ? f.options.map((o) => (typeof o === "string" ? o.trim() : "")).filter(Boolean).slice(0, 60)
    : [];
  // A select with no options cannot be answered, so it degrades to free text.
  const type = declared === "select" && options.length === 0 ? "text" : declared;

  return {
    key,
    label: typeof f.label === "string" && f.label.trim() ? f.label.trim() : key,
    type,
    ...(type === "select" ? { options } : {}),
    ...(f.required === true ? { required: true } : {}),
    ...(typeof f.help === "string" && f.help.trim() ? { help: f.help.trim() } : {}),
  };
}

/** A stored `ProjectField` row as the sheet shape `resolveSheet` reads. */
const fieldRow = (r) => ({
  key: r.key,
  label: r.label,
  type: r.type,
  hidden: r.hidden === true,
  required: r.required === true,
  help: r.help ?? undefined,
  options: parseJson(r.options, []),
});

/**
 * Authored definitions -> storable `ProjectField` rows, in list order. The
 * seed, the sync script and the backfill all write the same shape, so a sheet
 * declared in code and one edited in the console are indistinguishable.
 */
export const fieldRowsFromDefs = (defs = []) =>
  (Array.isArray(defs) ? defs : [])
    .filter((f) => f && typeof f.key === "string" && f.key.trim())
    .map((f, i) => ({
      key: f.key.trim(),
      label: typeof f.label === "string" && f.label.trim() ? f.label.trim() : f.key.trim(),
      type: SHEET_EXTRA_TYPES.includes(f.type) ? f.type : "text",
      options: JSON.stringify(Array.isArray(f.options) ? f.options : []),
      required: f.required === true,
      hidden: f.hidden === true,
      help: typeof f.help === "string" && f.help.trim() ? f.help.trim() : null,
      order: i,
    }));

/**
 * A programme's sheet shape.
 *
 * `fields` is the source of truth — the console edits those rows, so a
 * programme's columns are data, not a JSON blob. A programme that predates the
 * table still carries its shape in `detailFields`, which is read until the
 * backfill has run for it.
 */
export function sheetFields(project) {
  if (Array.isArray(project?.fields) && project.fields.length) {
    return project.fields.map(fieldRow);
  }
  return parseFields(project?.detailFields);
}

export const sheetOf = (project) => resolveSheet(sheetFields(project));

/**
 * Turn a programme's declared fields into the sheet the app renders.
 *
 * One list expresses both ideas: an entry whose `key` is a shared field name
 * relabels it (or hides it, with `hidden: true`), while any other key declares
 * a new typed extra column. Splitting them here means the beneficiary form,
 * the console and the spreadsheet importer all read one resolved shape.
 *
 * Accepts either the field rows or the legacy JSON text.
 */
export function resolveSheet(rawFields) {
  const overrides = new Map();
  const extras = [];

  const list = Array.isArray(rawFields) ? rawFields : parseFields(rawFields);
  for (const f of list) {
    if (BASE_FIELD_KEYS.has(f.key)) {
      overrides.set(f.key, f);
      continue;
    }
    const extra = normaliseExtraField(f);
    if (extra && !extras.some((e) => e.key === extra.key)) extras.push(extra);
  }

  const base = SHEET_BASE_FIELDS.filter((b) => overrides.get(b.key)?.hidden !== true).map((b) => {
    const o = overrides.get(b.key);
    return o && typeof o.label === "string" && o.label.trim() ? { ...b, label: o.label.trim() } : { ...b };
  });

  return { base, extras };
}

/**
 * Validate + normalise a beneficiary's programme-specific extras against the
 * programme's own field types. Values stay strings (the `details` convention),
 * so a number or date is enforced here rather than by the column. Keys the
 * programme does not declare pass through untouched, so editing a row never
 * silently drops data captured before a field was retired.
 */
function coerceDetails(rawDetails, extras, { enforceRequired = false } = {}) {
  const src = rawDetails && typeof rawDetails === "object" && !Array.isArray(rawDetails) ? rawDetails : {};
  const byKey = new Map(extras.map((e) => [e.key, e]));
  const out = {};
  const errors = [];

  if (enforceRequired) {
    for (const e of extras) {
      const v = src[e.key];
      if (e.required && (v === undefined || v === null || String(v).trim() === "")) {
        errors.push(`${e.label} is required`);
      }
    }
  }

  for (const [rawKey, rawValue] of Object.entries(src)) {
    if (rawValue === null || rawValue === undefined) continue;
    const text = String(rawValue).trim();
    if (!text) continue;

    const key = String(rawKey).slice(0, EXTRA_KEY_MAX);
    const def = byKey.get(key);
    if (!def) {
      out[key] = text.slice(0, EXTRA_VALUE_MAX);
      continue;
    }

    if (def.type === "number") {
      const n = Number(text.replace(/,/g, ""));
      if (!Number.isFinite(n)) {
        errors.push(`${def.label} must be a number`);
        continue;
      }
      out[key] = String(n);
    } else if (def.type === "date") {
      const d = new Date(text);
      if (Number.isNaN(d.getTime())) {
        errors.push(`${def.label} is not a valid date`);
        continue;
      }
      out[key] = text.slice(0, 10);
    } else if (def.type === "select") {
      const options = def.options ?? [];
      const hit = options.find((o) => o.toLowerCase() === text.toLowerCase());
      if (options.length && !hit) {
        errors.push(`${def.label} must be one of: ${options.join(", ")}`);
        continue;
      }
      out[key] = (hit ?? text).slice(0, EXTRA_VALUE_MAX);
    } else {
      out[key] = text.slice(0, EXTRA_VALUE_MAX);
    }
  }

  return { details: out, errors };
}

const toBeneficiary = (b) => ({
  id: b.id,
  projectId: b.projectId,
  name: b.name,
  parentName: b.parentName,
  phone: b.phone,
  wardId: b.wardId,
  ward: b.ward?.name ?? null,
  constituency: b.ward?.constituency ?? null,
  village: b.village,
  stationCode: b.stationCode,
  stationName: b.stationName,
  quantity: b.quantity,
  amount: b.amount,
  dateIssued: b.dateIssued,
  status: b.status,
  details: parseDetails(b.details),
  notes: b.notes,
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
});

const toProject = (p, agg) => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  category: p.category,
  categoryLabel: CATEGORY_LABEL[p.category] ?? p.category,
  summary: p.summary,
  description: p.description,
  unit: p.unit,
  metric: p.metric,
  fields: (p.fields ?? []).map(fieldRow),
  sheet: sheetOf(p),
  status: p.status,
  startDate: p.startDate,
  order: p.order,
  beneficiaries: agg?.count ?? 0,
  totalQuantity: agg?.quantity ?? 0,
  totalAmount: agg?.amount ?? 0,
});

/** Roll a beneficiary list up into the headline counters shown on a programme card. */
const aggregate = (rows) => {
  let count = 0;
  let quantity = 0;
  let amount = 0;
  let issued = 0;
  for (const r of rows) {
    count += 1;
    quantity += r.quantity ?? 0;
    amount += r.amount ?? 0;
    if (r.status === "issued") issued += 1;
  }
  return { count, quantity, amount: round2(amount), issued, pending: count - issued };
};

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 200;

/**
 * The programme directory: every initiative on file with its headline totals,
 * grouped by family. Small enough (one row per programme) that it is returned
 * whole — the filters narrow the cards, the summary stays register-wide.
 */
export async function projectDirectory({ category, q, status } = {}) {
  const where = {};
  if (category) where.category = String(category);
  if (status) where.status = String(status);
  if (q) {
    const needle = String(q);
    where.OR = [
      { name: { contains: needle } },
      { summary: { contains: needle } },
      { description: { contains: needle } },
    ];
  }

  const [rows, allBeneficiaries, projectCount] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        beneficiaries: { select: { quantity: true, amount: true, status: true } },
        fields: { orderBy: { order: "asc" } },
      },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    // Register-wide figures — deliberately unfiltered so the summary is stable.
    prisma.projectBeneficiary.findMany({
      select: { quantity: true, amount: true, status: true, project: { select: { category: true } } },
    }),
    prisma.project.count(),
  ]);

  const totals = { projects: 0, beneficiaries: 0, quantity: 0, amount: 0, issued: 0, pending: 0 };
  const catAgg = new Map();
  for (const b of allBeneficiaries) {
    totals.beneficiaries += 1;
    totals.quantity += b.quantity ?? 0;
    totals.amount += b.amount ?? 0;
    if (b.status === "issued") totals.issued += 1;
    else totals.pending += 1;
    const cat = b.project?.category ?? "other";
    const agg = catAgg.get(cat) ?? { category: cat, label: CATEGORY_LABEL[cat] ?? cat, projects: 0, beneficiaries: 0, quantity: 0, amount: 0 };
    agg.beneficiaries += 1;
    agg.quantity += b.quantity ?? 0;
    agg.amount += b.amount ?? 0;
    catAgg.set(cat, agg);
  }
  totals.amount = round2(totals.amount);
  totals.projects = projectCount;

  const projectRows = rows.map((p) => toProject(p, aggregate(p.beneficiaries)));

  return {
    categories: PROJECT_CATEGORIES,
    filters: {
      categories: PROJECT_CATEGORIES,
      statuses: PROJECT_STATUS,
    },
    totals,
    byCategory: PROJECT_CATEGORIES.map((c) => {
      const a = catAgg.get(c.id);
      return a
        ? { ...a, amount: round2(a.amount), projects: projectRows.filter((p) => p.category === c.id).length }
        : { category: c.id, label: c.label, projects: 0, beneficiaries: 0, quantity: 0, amount: 0 };
    }),
    projects: projectRows,
  };
}

/**
 * A single programme plus its beneficiary register (paged) and register-wide
 * totals. The filters (`ward`, `status`, `q`) narrow the REGISTER only.
 */
export async function projectDetail(slug, { ward, status, q, page, pageSize } = {}) {
  const project = await prisma.project.findUnique({
    where: { slug: String(slug) },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  if (!project) return null;

  const where = { projectId: project.id };
  if (ward) where.wardId = String(ward);
  if (status) where.status = String(status);
  if (q) {
    const needle = String(q);
    where.OR = [
      { name: { contains: needle } },
      { parentName: { contains: needle } },
      { phone: { contains: needle } },
      { village: { contains: needle } },
      { stationName: { contains: needle } },
    ];
  }

  const perPage = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE));

  const totalRows = await prisma.projectBeneficiary.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / perPage));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);

  const [rows, allRows] = await Promise.all([
    prisma.projectBeneficiary.findMany({
      where,
      include: { ward: { select: { name: true, constituency: true } } },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      skip: (currentPage - 1) * perPage,
      take: perPage,
    }),
    prisma.projectBeneficiary.findMany({
      where: { projectId: project.id },
      select: { quantity: true, amount: true, status: true },
    }),
  ]);

  return {
    project: toProject(project),
    totals: aggregate(allRows),
    filters: {
      statuses: BENEFICIARY_STATUS,
      wards: context.wards.map((w) => ({ id: w.id, name: w.name, constituency: w.constituency })),
    },
    beneficiaries: rows.map(toBeneficiary),
    page: currentPage,
    pageSize: perPage,
    totalRows,
    totalPages,
  };
}

/**
 * Resolve and validate one beneficiary sheet from a request body.
 *
 * Exported so the spreadsheet importer can validate a row without writing it
 * (its "validate only" pass), keeping a single set of delivery rules.
 */
export function buildBeneficiary(payload = {}, { partial = false, extras = [] } = {}) {
  const data = {};

  const has = (k) => payload[k] !== undefined;

  if (has("name") || !partial) {
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name) return { error: "Beneficiary name is required" };
    if (name.length > 160) return { error: "Beneficiary name is too long" };
    data.name = name;
  }

  if (has("parentName")) {
    data.parentName = payload.parentName ? String(payload.parentName).trim().slice(0, 160) : null;
  }
  if (has("phone")) {
    const raw = payload.phone ? String(payload.phone).trim() : "";
    if (!raw) {
      data.phone = null;
    } else {
      const normalized = normalizePhone(raw);
      // Accept any digits-only fallback so landlines / office lines still save.
      data.phone = normalized ?? raw.replace(/\s+/g, "");
    }
  }
  if (has("village")) {
    data.village = payload.village ? String(payload.village).trim().slice(0, 160) : null;
  }
  if (has("wardId")) {
    const wardId = payload.wardId ? String(payload.wardId) : "";
    if (wardId && !context.wardsById[wardId]) return { error: "Unknown ward", code: "BAD_WARD" };
    data.wardId = wardId || null;
  }
  if (has("stationCode")) {
    data.stationCode = payload.stationCode ? String(payload.stationCode).trim().slice(0, 40) : null;
  }
  if (has("stationName")) {
    data.stationName = payload.stationName ? String(payload.stationName).trim().slice(0, 160) : null;
  }
  if (has("quantity")) {
    if (payload.quantity === null || payload.quantity === "") {
      data.quantity = null;
    } else {
      const n = Number(payload.quantity);
      if (!Number.isFinite(n) || n < 0) return { error: "Quantity must be a non-negative number" };
      data.quantity = Math.round(n);
    }
  }
  if (has("amount")) {
    if (payload.amount === null || payload.amount === "") {
      data.amount = null;
    } else {
      const n = Number(payload.amount);
      if (!Number.isFinite(n) || n < 0) return { error: "Amount must be a non-negative number" };
      data.amount = round2(n);
    }
  }
  if (has("dateIssued")) {
    if (!payload.dateIssued) {
      data.dateIssued = null;
    } else {
      const d = new Date(payload.dateIssued);
      if (Number.isNaN(d.getTime())) return { error: "Invalid date issued" };
      data.dateIssued = d;
    }
  }
  if (has("status")) {
    const s = String(payload.status);
    if (s && !BENEFICIARY_STATUS.includes(s)) return { error: "Status must be issued or pending" };
    data.status = s || "issued";
  }
  if (has("details") || !partial) {
    const { details, errors } = coerceDetails(payload.details ?? {}, extras, { enforceRequired: !partial });
    if (errors.length) return { error: errors[0] };
    data.details = JSON.stringify(details);
  }
  if (has("notes")) {
    data.notes = payload.notes ? String(payload.notes).trim() : null;
  }

  return { data };
}

/** Record a new beneficiary sheet against a programme. */
export async function createBeneficiary(slug, payload) {
  const project = await prisma.project.findUnique({
    where: { slug: String(slug) },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  if (!project) return { error: "Programme not found", code: "NOT_FOUND" };

  const { extras } = sheetOf(project);
  const { data, error, code } = buildBeneficiary(payload, { extras });
  if (error) return { error, code };
  data.projectId = project.id;

  const row = await prisma.projectBeneficiary.create({
    data,
    include: { ward: { select: { name: true, constituency: true } } },
  });
  return { beneficiary: toBeneficiary(row), project };
}

/** Edit an existing beneficiary sheet. Only the supplied fields change. */
export async function updateBeneficiary(id, payload) {
  const existing = await prisma.projectBeneficiary.findUnique({
    where: { id: String(id) },
    include: { project: { include: { fields: { orderBy: { order: "asc" } } } } },
  });
  if (!existing) return { error: "Beneficiary not found", code: "NOT_FOUND" };

  const { extras } = sheetOf(existing.project);
  const { data, error, code } = buildBeneficiary(payload, { partial: true, extras });
  if (error) return { error, code };
  if (Object.keys(data).length === 0) return { error: "Nothing to update", code: "BAD_REQUEST" };

  const row = await prisma.projectBeneficiary.update({
    where: { id: existing.id },
    data,
    include: { ward: { select: { name: true, constituency: true } } },
  });
  return { beneficiary: toBeneficiary(row) };
}

/** Remove a beneficiary sheet. */
export async function deleteBeneficiary(id) {
  const existing = await prisma.projectBeneficiary.findUnique({ where: { id: String(id) } });
  if (!existing) return { error: "Beneficiary not found", code: "NOT_FOUND" };
  await prisma.projectBeneficiary.delete({ where: { id: existing.id } });
  return { deleted: true, id: existing.id, name: existing.name };
}

/** A beneficiary row flattened with its programme — the shape ward/centre views read. */
const toWardDelivery = (b) => ({
  ...toBeneficiary(b),
  projectSlug: b.project?.slug ?? null,
  projectName: b.project?.name ?? null,
  projectCategory: b.project?.category ?? null,
  unit: b.project?.unit ?? "beneficiary",
});

/** Case/space-insensitive key used to match a delivery to a polling centre. */
const stationKey = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const withProgramme = {
  project: { select: { slug: true, name: true, category: true, unit: true, order: true } },
  ward: { select: { name: true, constituency: true } },
};

/**
 * Every delivery recorded in a ward — used by the ward detail view so the
 * constituency map links straight through to what was actually issued there.
 */
export async function beneficiariesForWard(wardId, { limit = 60 } = {}) {
  const rows = await prisma.projectBeneficiary.findMany({
    where: { wardId: String(wardId) },
    include: withProgramme,
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    take: limit,
  });
  return rows.map(toWardDelivery);
}

/**
 * Roll a list of delivery rows up per programme — the "what has actually been
 * delivered here" summary the ward and search cards read. Pure, so callers
 * that already hold the rows (the search index) reuse it without a query.
 */
export function rollupProgrammes(rows = [], { limit = 8 } = {}) {
  const byProject = new Map();
  for (const r of rows) {
    const key = r.projectSlug ?? r.projectName ?? "__other__";
    const agg =
      byProject.get(key) ??
      {
        projectId: r.projectId,
        projectSlug: r.projectSlug,
        projectName: r.projectName ?? "Unassigned",
        category: r.projectCategory,
        categoryLabel: CATEGORY_LABEL[r.projectCategory] ?? r.projectCategory,
        unit: r.unit ?? "beneficiary",
        beneficiaries: 0,
        quantity: 0,
        amount: 0,
        pending: 0,
      };
    agg.beneficiaries += 1;
    agg.quantity += r.quantity ?? 0;
    agg.amount += r.amount ?? 0;
    if (r.status !== "issued") agg.pending += 1;
    byProject.set(key, agg);
  }

  const programmes = [...byProject.values()].map((a) => ({ ...a, amount: round2(a.amount) }));
  programmes.sort((a, b) => b.beneficiaries - a.beneficiaries || a.projectName.localeCompare(b.projectName));

  const totals = programmes.reduce(
    (t, a) => ({ beneficiaries: t.beneficiaries + a.beneficiaries, quantity: t.quantity + a.quantity, amount: round2(t.amount + a.amount) }),
    { beneficiaries: 0, quantity: 0, amount: 0 },
  );

  return { projects: programmes.length, totals, programmes: programmes.slice(0, limit) };
}

/**
 * What a ward has actually received, rolled up per programme — the live
 * replacement for the hand-written "delivered" bullet lists that used to sit
 * on the ward and search cards.
 */
export async function deliverySummaryForWard(wardId, { limit = 8 } = {}) {
  const rows = await prisma.projectBeneficiary.findMany({
    where: { wardId: String(wardId) },
    include: withProgramme,
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
  });
  return rollupProgrammes(rows.map(toWardDelivery), { limit });
}

/**
 * The deliveries recorded against one polling centre. Centres carry no IEBC
 * code of their own, so rows are matched on the centre name recorded on the
 * beneficiary sheet (scoped to the ward first, so the scan stays tiny).
 */
export async function deliveriesForStation({ wardId, stationName, stationCode }, { limit = 40 } = {}) {
  const key = stationKey(stationName);
  const code = stationCode ? String(stationCode) : "";
  if (!key && !code) return [];

  const rows = await prisma.projectBeneficiary.findMany({
    where: wardId ? { wardId: String(wardId) } : {},
    include: withProgramme,
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
  });

  return rows
    .filter((b) => (code && b.stationCode === code) || (key && stationKey(b.stationName) === key))
    .slice(0, limit)
    .map(toWardDelivery);
}

export default {
  PROJECT_CATEGORIES,
  BENEFICIARY_STATUS,
  PROJECT_STATUS,
  SHEET_BASE_FIELDS,
  SHEET_EXTRA_TYPES,
  resolveSheet,
  sheetOf,
  sheetFields,
  fieldRowsFromDefs,
  projectDirectory,
  projectDetail,
  createBeneficiary,
  updateBeneficiary,
  deleteBeneficiary,
  beneficiariesForWard,
  deliverySummaryForWard,
  deliveriesForStation,
  rollupProgrammes,
};
