import prisma from "../db.js";
import context from "../data/context.js";
import { serializeActivity, activityInclude } from "./roadmap.js";

/**
 * Outreach — the live bloc register.
 *
 * A bloc is an organised community the outreach plan is actually executed
 * against: a farm (Koross, Nakwanga, Sarura…), a traders' association, a boda
 * SACCO, a savings circle. Each bloc carries its population, its official
 * (chairman), the polling centre where the majority of its members vote, the
 * members captured so far and the key messages it hears.
 *
 * `category` groups the blocs into the families the campaign talks about
 * (Farms, Business Community). The register is read from MySQL — the same
 * source of truth as every other live dataset — never from a frozen constant.
 */

export const BLOC_CATEGORIES = [
  { id: "farm", label: "Farms" },
  { id: "business", label: "Business Community" },
];

export const BLOC_STATUS = ["active", "dormant"];

// Every bloc is worked to the same rhythm: three engagements, three issues
// logged, three key messages delivered. The counters live on the row (default
// 0) so the register shows real progress as field teams fill them in; the
// targets stay here as the single knob to tune.
export const BLOC_TARGETS = { engagements: 3, issues: 3, messages: 3 };

const CATEGORY_LABEL = Object.fromEntries(BLOC_CATEGORIES.map((c) => [c.id, c.label]));

const parseMessages = (text) => {
  try {
    const v = JSON.parse(text || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const toMember = (m) => ({
  id: m.id,
  fullName: m.fullName,
  idNumber: m.idNumber,
  gender: m.gender,
  phone: m.phone,
});

const toBloc = (b) => ({
  id: b.id,
  name: b.name,
  category: b.category,
  categoryLabel: CATEGORY_LABEL[b.category] ?? b.category,
  population: b.population,
  engagements: b.engagements,
  issues: b.issues,
  messages: b.messages,
  officialName: b.officialName,
  officialPhone: b.officialPhone,
  officialId: b.officialId,
  stationCode: b.stationCode,
  stationName: b.stationName,
  wardId: b.wardId,
  ward: b.ward?.name ?? null,
  constituency: b.ward?.constituency ?? null,
  keyMessages: parseMessages(b.keyMessages),
  status: b.status,
  membersCaptured: b._count?.members ?? 0,
  members: (b.members ?? []).map(toMember),
  // Roadmap rows tied to this bloc (e.g. its Mashamba meeting) — so the
  // register surfaces the campaign calendar for each community group.
  activities: (b.activities ?? []).map(serializeActivity),
  createdAt: b.createdAt,
});

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 200;

/**
 * Live bloc register plus register-wide totals.
 *
 * The filters (`category`, `ward`, `q`) and the paging window narrow the
 * REGISTER only — the headline totals always reflect every bloc on file, so
 * the summary numbers never move while the list is being filtered.
 */
export async function blocRegister({ category, ward, q, page, pageSize } = {}) {
  const where = {};
  if (category) where.category = String(category);
  if (ward) where.wardId = String(ward);
  if (q) {
    const needle = String(q);
    where.OR = [
      { name: { contains: needle } },
      { officialName: { contains: needle } },
      { officialPhone: { contains: needle } },
      { stationName: { contains: needle } },
    ];
  }

  const perPage = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE));

  // Count first so the page window can be clamped: a filter change that shrinks
  // the result set returns the last real page instead of an empty one.
  const totalRows = await prisma.bloc.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / perPage));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);

  const [rows, allBlocs, genderGroups] = await Promise.all([
    prisma.bloc.findMany({
      where,
      include: {
        ward: { select: { name: true, constituency: true } },
        members: { orderBy: { fullName: "asc" } },
        activities: { include: activityInclude, orderBy: [{ date: "asc" }, { title: "asc" }] },
        _count: { select: { members: true } },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      skip: (currentPage - 1) * perPage,
      take: perPage,
    }),
    // Register-wide figures — deliberately unfiltered so the summary is stable.
    prisma.bloc.findMany({
      select: { category: true, population: true, _count: { select: { members: true } } },
    }),
    prisma.blocMember.groupBy({ by: ["gender"], _count: { _all: true } }),
  ]);

  const totals = { blocs: allBlocs.length, members: 0, population: 0 };
  const catAgg = new Map();
  for (const b of allBlocs) {
    const members = b._count.members;
    totals.members += members;
    totals.population += b.population;
    const agg = catAgg.get(b.category) || { category: b.category, label: CATEGORY_LABEL[b.category] ?? b.category, blocs: 0, members: 0, population: 0 };
    agg.blocs += 1;
    agg.members += members;
    agg.population += b.population;
    catAgg.set(b.category, agg);
  }

  const genderSplit = { male: 0, female: 0 };
  for (const g of genderGroups) if (g.gender in genderSplit) genderSplit[g.gender] = g._count._all;

  return {
    categories: BLOC_CATEGORIES,
    filters: {
      categories: BLOC_CATEGORIES,
      wards: context.wards.map((w) => ({ id: w.id, name: w.name, constituency: w.constituency })),
    },
    targets: BLOC_TARGETS,
    totals,
    byCategory: BLOC_CATEGORIES.map((c) => catAgg.get(c.id)).filter(Boolean),
    genderSplit,
    blocs: rows.map(toBloc),
    page: currentPage,
    pageSize: perPage,
    totalRows,
    totalPages,
  };
}

export default { BLOC_CATEGORIES, BLOC_STATUS, BLOC_TARGETS, blocRegister };
