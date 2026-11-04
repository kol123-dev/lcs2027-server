import prisma from "../db.js";
import context from "../data/context.js";

/**
 * Issues — the live register of problems people are actually living with.
 *
 * An issue is concrete: a cattle dip with no acaricide, a broken water point,
 * a market with no lighting, a road that floods. It is raised where the
 * campaign meets people — at an outreach bloc, at a polling centre, or across
 * a whole ward — and it is read from MySQL like every other live dataset.
 *
 * The polling centre is stored DENORMALISED (IEBC code + name strings) exactly
 * like Bloc/Agent/CampaignActivity/ProjectBeneficiary, so the register
 * survives the `db:seed` centre/station re-sync.
 */

export const ISSUE_CATEGORIES = [
  { id: "water", label: "Water" },
  { id: "agriculture", label: "Agriculture & Livestock" },
  { id: "roads", label: "Roads & Transport" },
  { id: "health", label: "Health" },
  { id: "education", label: "Education" },
  { id: "infrastructure", label: "Infrastructure & Power" },
  { id: "security", label: "Security" },
  { id: "other", label: "Other" },
];

export const ISSUE_SEVERITY = ["low", "medium", "high"];

export const ISSUE_STATUS = ["open", "in-progress", "resolved"];

const CATEGORY_LABEL = Object.fromEntries(ISSUE_CATEGORIES.map((c) => [c.id, c.label]));

/** Case/space-insensitive key used to match a record to a polling centre. */
export const nameKey = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export const issueInclude = {
  ward: { select: { name: true, constituency: true } },
  bloc: { select: { name: true } },
};

export const toIssue = (i) => ({
  id: i.id,
  title: i.title,
  category: i.category,
  categoryLabel: CATEGORY_LABEL[i.category] ?? i.category,
  severity: i.severity,
  status: i.status,
  description: i.description,
  reportedBy: i.reportedBy,
  reportDate: i.reportDate,
  wardId: i.wardId,
  wardName: i.ward?.name ?? null,
  constituency: i.ward?.constituency ?? null,
  blocId: i.blocId,
  blocName: i.bloc?.name ?? null,
  stationCode: i.stationCode,
  stationName: i.stationName,
  resolution: i.resolution,
  resolvedAt: i.resolvedAt,
  createdAt: i.createdAt,
});

/** Headline counters for the cards (open vs closed, and how hot). */
export function summariseIssues(rows = []) {
  const summary = { total: rows.length, open: 0, inProgress: 0, resolved: 0, high: 0, critical: [] };
  for (const i of rows) {
    if (i.status === "resolved") summary.resolved += 1;
    else if (i.status === "in-progress") summary.inProgress += 1;
    else summary.open += 1;
    if (i.severity === "high" && i.status !== "resolved") summary.high += 1;
  }
  summary.critical = rows.filter((i) => i.severity === "high" && i.status !== "resolved").slice(0, 5);
  return summary;
}

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 200;

/**
 * Live issue register plus register-wide totals. The filters and paging window
 * narrow the LIST only — the summary always reflects every issue on file.
 */
export async function issueRegister({ ward, bloc, stationCode, category, status, severity, q, page, pageSize } = {}) {
  const where = {};
  if (ward) where.wardId = String(ward);
  if (bloc) where.blocId = String(bloc);
  if (stationCode) where.stationCode = String(stationCode);
  if (category) where.category = String(category);
  if (status) where.status = String(status);
  if (severity) where.severity = String(severity);
  if (q) {
    const needle = String(q);
    where.OR = [
      { title: { contains: needle } },
      { description: { contains: needle } },
      { reportedBy: { contains: needle } },
      { stationName: { contains: needle } },
    ];
  }

  const perPage = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE));
  const totalRows = await prisma.issue.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / perPage));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);

  const [rows, allRows] = await Promise.all([
    prisma.issue.findMany({
      where,
      include: issueInclude,
      orderBy: [{ status: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
      skip: (currentPage - 1) * perPage,
      take: perPage,
    }),
    // Register-wide figures — deliberately unfiltered so the summary is stable.
    prisma.issue.findMany({ select: { category: true, severity: true, status: true } }),
  ]);

  const byCategory = new Map();
  const byStatus = Object.fromEntries(ISSUE_STATUS.map((s) => [s, 0]));
  const bySeverity = Object.fromEntries(ISSUE_SEVERITY.map((s) => [s, 0]));
  for (const i of allRows) {
    byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
    bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
    byCategory.set(i.category, (byCategory.get(i.category) ?? 0) + 1);
  }

  return {
    categories: ISSUE_CATEGORIES,
    severities: ISSUE_SEVERITY,
    statuses: ISSUE_STATUS,
    filters: {
      wards: context.wards.map((w) => ({ id: w.id, name: w.name, constituency: w.constituency })),
    },
    totals: {
      issues: allRows.length,
      open: byStatus.open ?? 0,
      inProgress: byStatus["in-progress"] ?? 0,
      resolved: byStatus.resolved ?? 0,
    },
    byCategory: ISSUE_CATEGORIES.map((c) => ({ ...c, issues: byCategory.get(c.id) ?? 0 })),
    byStatus: ISSUE_STATUS.map((s) => ({ id: s, label: s, issues: byStatus[s] ?? 0 })),
    bySeverity: ISSUE_SEVERITY.map((s) => ({ id: s, label: s, issues: bySeverity[s] ?? 0 })),
    issues: rows.map(toIssue),
    page: currentPage,
    pageSize: perPage,
    totalRows,
    totalPages,
  };
}

/** Every issue raised in one ward (small enough to return whole). */
export async function issuesForWard(wardId, { limit = 200 } = {}) {
  const rows = await prisma.issue.findMany({
    where: { wardId: String(wardId) },
    include: issueInclude,
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(toIssue);
}

/** The issues raised from one outreach bloc — they hang off the bloc view. */
export async function issuesForBloc(blocId, { limit = 50 } = {}) {
  const rows = await prisma.issue.findMany({
    where: { blocId: String(blocId) },
    include: issueInclude,
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(toIssue);
}

/** Split a ward's issues into those raised at a named polling centre and the rest. */
export function splitWardIssues(issues = [], centreName) {
  const key = nameKey(centreName);
  const atCentre = [];
  for (const i of issues) if (i.stationName && nameKey(i.stationName) === key) atCentre.push(i);
  return atCentre;
}

export default {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITY,
  ISSUE_STATUS,
  nameKey,
  summariseIssues,
  issueRegister,
  issuesForWard,
  issuesForBloc,
  splitWardIssues,
};
