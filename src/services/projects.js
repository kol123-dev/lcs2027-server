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
  detailFields: parseFields(p.detailFields),
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
      include: { beneficiaries: { select: { quantity: true, amount: true, status: true } } },
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
  const project = await prisma.project.findUnique({ where: { slug: String(slug) } });
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

/** Resolve and validate one beneficiary sheet from a request body. */
function buildBeneficiary(payload = {}, { partial = false } = {}) {
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
  if (has("details")) {
    const d = payload.details;
    if (d === null || d === undefined) {
      data.details = "{}";
    } else if (typeof d !== "object" || Array.isArray(d)) {
      return { error: "details must be an object" };
    } else {
      const clean = {};
      for (const [k, v] of Object.entries(d)) {
        if (v === null || v === undefined || v === "") continue;
        clean[String(k).slice(0, 60)] = String(v).slice(0, 300);
      }
      data.details = JSON.stringify(clean);
    }
  }
  if (has("notes")) {
    data.notes = payload.notes ? String(payload.notes).trim() : null;
  }

  return { data };
}

/** Record a new beneficiary sheet against a programme. */
export async function createBeneficiary(slug, payload) {
  const project = await prisma.project.findUnique({ where: { slug: String(slug) } });
  if (!project) return { error: "Programme not found", code: "NOT_FOUND" };

  const { data, error, code } = buildBeneficiary(payload);
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
  const existing = await prisma.projectBeneficiary.findUnique({ where: { id: String(id) } });
  if (!existing) return { error: "Beneficiary not found", code: "NOT_FOUND" };

  const { data, error, code } = buildBeneficiary(payload, { partial: true });
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

/**
 * Every delivery recorded in a ward — used by the ward detail view so the
 * constituency map links straight through to what was actually issued there.
 */
export async function beneficiariesForWard(wardId, { limit = 60 } = {}) {
  const rows = await prisma.projectBeneficiary.findMany({
    where: { wardId: String(wardId) },
    include: {
      project: { select: { slug: true, name: true, category: true, unit: true } },
      ward: { select: { name: true, constituency: true } },
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    take: limit,
  });
  return rows.map((b) => ({
    ...toBeneficiary(b),
    projectSlug: b.project?.slug ?? null,
    projectName: b.project?.name ?? null,
    projectCategory: b.project?.category ?? null,
    unit: b.project?.unit ?? "beneficiary",
  }));
}

export default {
  PROJECT_CATEGORIES,
  BENEFICIARY_STATUS,
  PROJECT_STATUS,
  projectDirectory,
  projectDetail,
  createBeneficiary,
  updateBeneficiary,
  deleteBeneficiary,
  beneficiariesForWard,
};
