import prisma from "../db.js";
import context from "../data/context.js";
import env from "../config/env.js";

/**
 * 10-Month Master Roadmap (Nov 2026 -> Aug 2027) tuned to the Kenyan
 * election calendar: IEBC registration windows, church blitzes, market
 * day circuits, party primaries, and a final GOTV sprint.
 *
 * The phase narrative is curated here, but the dated ACTIVITY calendar
 * (Mashamba meetings, ward tours, team tours, harambees, burials, party &
 * coalition work, church blitzes and the fixed key events) is read live from
 * the database (`CampaignActivity`) — the same source of truth as every other
 * live dataset. Each activity carries its own ward / bloc / polling-centre
 * links, which is how the roadmap surfaces inside the bloc, ward and centre
 * views.
 */

const DAY = 86400000;
const today = () => new Date();
const parse = (iso) => new Date(`${iso}T00:00:00`);

const PHASES = [
  {
    id: "p1",
    title: "Foundation & War-Room",
    theme: "Build the machine",
    start: "2026-11-01",
    end: "2026-11-30",
    objectives: [
      "Stand up county war-room & ward secretariats (25 wards).",
      "Recruit station captains for all 365 polling centres.",
      "Load 2022 baseline into every ward dashboard.",
      "Finalise 2027 budget by line item per ward.",
    ],
    tactics: [
      "Ward-by-ward data clinics with 2022 station results.",
      "Recruit county coordinator + 5 sub-county leads + 25 ward leads.",
      "Map partners: churches, boda boda saccos, market associations, women groups.",
      "Brand kits & SMS shortcode onboarding.",
    ],
    milestones: [
      { label: "War-room operational", date: "2026-11-07" },
      { label: "Ward secretariats formed", date: "2026-11-20" },
      { label: "Budget lock", date: "2026-11-30" },
    ],
    kpis: [{ metric: "Ward secretariats", target: "25/25" }, { metric: "Station captains", target: "365" }],
  },
  {
    id: "p2",
    title: "Christmas Blitz, Church Circuit & Registration Drive",
    theme: "Sow, register, reconnect",
    start: "2026-12-01",
    end: "2027-02-28",
    objectives: [
      "Christmas & New Year homecomings across all 25 wards.",
      "Christmas church blitz: 40+ services attended.",
      "IEBC continuous voter registration drives at market & school dates.",
      "Youth entry: boda boda associations, chamas, sports tournaments.",
    ],
    tactics: [
      "Church calendar booking by ward leads; offering-plate greetings.",
      "Reg-drive rovers with IEBC kits at 15 outreach points.",
      "Market-day blitzes (Mama Mboga circuits).",
      "SMS + WhatsApp broadcast onboarding (ward-level groups).",
    ],
    milestones: [
      { label: "Christmas blitz ends", date: "2027-01-05" },
      { label: "Voter roll target reached", date: "2027-02-28" },
    ],
    kpis: [{ metric: "New registered women voters", target: "8,000+" }, { metric: "Church services attended", target: "40" }],
  },
  {
    id: "p3",
    title: "Easter Blitz & Delivery Showcase",
    theme: "Deliver, then tell it",
    start: "2027-03-01",
    end: "2027-04-30",
    objectives: [
      "Easter church blitz (Mar 26 – Apr 5) & women's guilds.",
      "'What We Delivered' ward development record fairs (25).",
      "Bursary & enterprise fund application windows open.",
      "Issue-owning: cost of living, ECDE, water, market sheds.",
    ],
    tactics: [
      "Award ceremonies for bursary beneficiaries (photo-worthy).",
      "Ward record fairs with project scorecards per station.",
      "Farmer field days & dairy cooperative round-tables.",
      "Engage teachers & parents via school open days.",
    ],
    milestones: [
      { label: "Easter blitz ends", date: "2027-04-05" },
      { label: "10 record fairs held", date: "2027-04-20" },
    ],
    kpis: [{ metric: "Record fairs", target: "25" }, { metric: "Bursary applications", target: "12,000" }],
  },
  {
    id: "p4",
    title: "Gatekeeping, Primaries & Coalition Logic",
    theme: "Secure the ticket, unite the base",
    start: "2027-05-01",
    end: "2027-06-30",
    objectives: [
      "Party primaries readiness: polling structures, agent deployment.",
      "Reconcile intra-party factions; fold rivals into the machine.",
      "Manifesto 2027: finalise county women agenda (ECDE, women's funds).",
      "Alliance & endorsement courtships (clergy, elders, county assemblies).",
    ],
    tactics: [
      "Delegate/reps mapping per ward; primary agent rosters.",
      "Dialogue sittings with 2022 rival grassroots networks.",
      "Manifesto drafting workshops with women groups.",
      "Media training for spokespersons.",
    ],
    milestones: [
      { label: "Primaries completed", date: "2027-06-30" },
      { label: "Manifesto 2027 launched", date: "2027-06-20" },
    ],
    kpis: [{ metric: "Primary agents trained", target: "420" }, { metric: "Factions folded in", target: "100%" }],
  },
  {
    id: "p5",
    title: "Homecoming Rallies & Final Sprint",
    theme: "Crescendo",
    start: "2027-07-01",
    end: "2027-07-31",
    objectives: [
      "5 major homecoming rallies (one per sub-county).",
      "Ward-level barazas x2 each (50 events).",
      "Polling agent recruitment completed 100% (2 per station + standbys).",
      "Parallel tally infrastructure dry-run.",
    ],
    tactics: [
      "Megaphone & PA logistics pool shared across wards.",
      "Debate & town-hall prep with issue cards.",
      "Agent contracts, IDs, and deployment grid verified.",
      "Tally-room comms test (radio/SMS protocol).",
    ],
    milestones: [
      { label: "Agents fully deployed grid", date: "2027-07-25" },
      { label: "Tally dry-run 1", date: "2027-07-28" },
    ],
    kpis: [{ metric: "Rallies", target: "5" }, { metric: "Barazas", target: "50" }],
  },
  {
    id: "p6",
    title: "GOTV & Election Day",
    theme: "Deliver the vote",
    start: "2027-08-01",
    end: "2027-08-10",
    objectives: [
      "Door-to-door GOTV on the final weekend (Aug 7–8).",
      "Escorts for elderly/PWD/women at every centre.",
      "Full agent presence at open, close and tally.",
      "Parallel tally cascade: station -> ward -> county -> declaration.",
    ],
    tactics: [
      "Mobiliser rosters grouped by 100-vote blocks.",
      "Boda taxi GOTV squads; market-day convergence.",
      "Form 34A photography + WhatsApp tally relay + physical couriers.",
      "Dispute-response desk at war-room.",
    ],
    milestones: [
      { label: "GOTV weekend", date: "2027-08-07" },
      { label: "ELECTION DAY", date: "2027-08-10" },
    ],
    kpis: [{ metric: "Turnout (swing wards)", target: "55%+" }, { metric: "Stations covered", target: "365/365" }],
  },
];

/**
 * The standing campaign activities — the vocabulary every roadmap row is typed
 * against. `plan` is the multi-month target (null = the schedule itself is the
 * target, e.g. weekly harambees), and `unit` labels the counter.
 */
export const ACTIVITY_TYPES = [
  {
    id: "mashamba",
    label: "Mashamba Meetings",
    category: "activity",
    cadence: "once",
    plan: 100,
    unit: "meetings",
    blurb: "Indoor, ethnic-group meetings in the former settler-farm subdivisions — 20 per sub-county.",
  },
  { id: "ward-tour", label: "Ward Tours", category: "activity", cadence: "once", plan: 25, unit: "wards", blurb: "One ward a day across all 25 wards." },
  { id: "team-tour", label: "Team Tours", category: "activity", cadence: "once", plan: 12, unit: "visits", blurb: "Selected teams visit special groups." },
  { id: "harambee", label: "Harambees", category: "activity", cadence: "weekly", plan: null, unit: "events", blurb: "Weekly harambees across the wards." },
  { id: "burial", label: "Burials", category: "activity", cadence: "weekly", plan: null, unit: "events", blurb: "Weekly burial dispatch — a team attends." },
  { id: "church-blitz", label: "Church Blitzes", category: "activity", cadence: "weekly", plan: null, unit: "services", blurb: "Weekly Sunday blitzes across the church circuit." },
  { id: "party", label: "Party & Coalition", category: "activity", cadence: "once", plan: null, unit: "events", blurb: "Party primaries, coalition and delegate activities." },
  { id: "key-event", label: "Key Events", category: "key-event", cadence: "once", plan: null, unit: "dates", blurb: "Fixed national and religious calendar anchors." },
];

const TYPE_META = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.id, t]));

const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

const activityPhase = (date, status) => {
  if (status === "done") return "done";
  if (status === "cancelled") return "cancelled";
  const t = today().getTime();
  const d = new Date(date);
  const day = isoDay(d);
  if (day === isoDay(today())) return "today";
  return d.getTime() < t ? "past" : "upcoming";
};

const toActivity = (a) => ({
  id: a.id,
  title: a.title,
  type: a.type,
  typeLabel: TYPE_META[a.type]?.label ?? a.type,
  category: a.category,
  description: a.description ?? "",
  cadence: a.cadence,
  date: isoDay(a.date),
  endDate: a.endDate ? isoDay(a.endDate) : null,
  status: a.status,
  phase: activityPhase(a.date, a.status),
  location: a.location ?? null,
  subCountyId: a.subCountyId ?? null,
  wardId: a.wardId ?? null,
  ward: a.ward?.name ?? null,
  constituency: a.ward?.constituency ?? null,
  blocId: a.blocId ?? null,
  bloc: a.bloc?.name ?? null,
  stationCode: a.stationCode ?? null,
  stationName: a.stationName ?? null,
  owner: a.owner ?? null,
  notes: a.notes ?? "",
});

const ACTIVITY_INCLUDE = {
  ward: { select: { name: true, constituency: true } },
  bloc: { select: { name: true } },
};

/** Prisma include used everywhere an activity row is read. */
export const activityInclude = ACTIVITY_INCLUDE;

/**
 * Shared row -> payload serializer so the linked views (bloc / ward / centre
 * panels) render activities with the exact same shape as the roadmap.
 */
export const serializeActivity = toActivity;

/**
 * Filtered, dated activity list — used by the roadmap calendar, the field page
 * and the bloc/ward/centre linking endpoints.
 */
export async function listActivities({ type, category, subCounty, ward, bloc, station, q, from, to, limit } = {}) {
  const where = {};
  if (type) where.type = String(type);
  if (category) where.category = String(category);
  if (subCounty) where.subCountyId = String(subCounty);
  if (ward) where.wardId = String(ward);
  if (bloc) where.blocId = String(bloc);
  if (station) where.stationCode = String(station);
  if (q) where.title = { contains: String(q) };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(`${from}T00:00:00`);
    if (to) where.date.lte = new Date(`${to}T23:59:59`);
  }
  const rows = await prisma.campaignActivity.findMany({
    where,
    include: ACTIVITY_INCLUDE,
    orderBy: [{ date: "asc" }, { title: "asc" }],
    take: limit ? Math.min(500, Math.max(1, Number(limit))) : undefined,
  });
  return rows.map(toActivity);
}

/** Month bucket key + human label ("2027-02" -> February 2027). */
const monthKey = (iso) => iso.slice(0, 7);
const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-KE", { month: "long", year: "numeric", timeZone: "UTC" });
};

function phaseStatus(phase) {
  const now = today();
  const start = parse(phase.start);
  const end = parse(phase.end).getTime() + DAY - 1;
  const t = now.getTime();
  if (t < start.getTime()) return "upcoming";
  if (t > end) return "done";
  return "active";
}

function progressOf(phase) {
  const now = today();
  const total = parse(phase.end).getTime() + DAY - 1 - parse(phase.start).getTime();
  const elapsed = now.getTime() - parse(phase.start).getTime();
  return Math.round(Math.min(1, Math.max(0, elapsed / total)) * 100);
}

export async function roadmap() {
  const election = parse(env.electionDay);
  const now = today();
  const daysRemaining = Math.max(0, Math.ceil((election.getTime() - now.getTime()) / DAY));
  const weeksRemaining = (daysRemaining / 7).toFixed(1);

  const phases = PHASES.map((p) => {
    const status = phaseStatus(p);
    const totalDays = Math.round((parse(p.end).getTime() + DAY - 1 - parse(p.start).getTime()) / DAY) + 1;
    const daysRemainingInPhase =
      status === "done" ? 0 : Math.max(0, Math.ceil((parse(p.end).getTime() + DAY - 1 - now.getTime()) / DAY));
    return {
      ...p,
      status,
      progress: status === "done" ? 100 : status === "upcoming" ? 0 : progressOf(p),
      totalDays,
      daysLeft: status === "done" ? 0 : daysRemainingInPhase,
    };
  });

  const currentPhases = phases.filter((p) => p.status === "active");
  const nextPhase = phases.find((p) => p.status === "upcoming");

  const rows = await prisma.campaignActivity.findMany({
    include: ACTIVITY_INCLUDE,
    orderBy: [{ date: "asc" }, { title: "asc" }],
  });
  const activities = rows.map(toActivity);

  // Per-type plan progress. For types without a fixed plan (weekly work), the
  // schedule itself is the denominator.
  const scheduledByType = {};
  const doneByType = {};
  for (const a of activities) {
    scheduledByType[a.type] = (scheduledByType[a.type] ?? 0) + 1;
    if (a.status === "done") doneByType[a.type] = (doneByType[a.type] ?? 0) + 1;
  }
  const activityPlans = ACTIVITY_TYPES.map((t) => {
    const scheduled = scheduledByType[t.id] ?? 0;
    const done = doneByType[t.id] ?? 0;
    const plan = t.plan ?? scheduled;
    return {
      ...t,
      scheduled,
      done,
      target: plan,
      remaining: Math.max(0, plan - done),
      progress: plan ? Math.round((done / plan) * 1000) / 10 : 0,
    };
  });

  // Group the dated calendar by month, and pull out the next few entries and
  // the fixed key events for their own strip.
  const byMonth = new Map();
  for (const a of activities) {
    const key = monthKey(a.date);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(a);
  }
  const calendar = [...byMonth.entries()].map(([month, list]) => ({
    month,
    label: monthLabel(month),
    count: list.length,
    activities: list,
  }));

  const upcoming = activities
    .filter((a) => a.phase === "upcoming" || a.phase === "today")
    .slice(0, 10);

  const keyEvents = activities.filter((a) => a.category === "key-event");

  return {
    electionDay: env.electionDay,
    countdown: {
      daysRemaining,
      weeksRemaining,
      monthsRemaining: (daysRemaining / 30).toFixed(1),
      electionWeek: Math.ceil(daysRemaining / 7),
      today: isoDay(now),
    },
    phases,
    currentPhase: currentPhases[0] ?? null,
    nextPhase: nextPhase ?? null,
    keyDates: [
      { label: "HELD: 2022 General Election", date: "2022-08-09", type: "past" },
      { label: "Continuous Voter Registration (IEBC)", date: "2026-01-01", type: "ongoing" },
      { label: "Campaign kickoff (10-month mark)", date: "2026-11-01", type: "campaign" },
      { label: "Christmas / New Year Blitz", date: "2026-12-20", type: "campaign" },
      { label: "IEBC Mass Voter Registration Drive", date: "2027-01-15", type: "iebc" },
      { label: "Easter Blitz & Women's Guilds", date: "2027-03-26", type: "campaign" },
      { label: "Official Campaign Period (approx.)", date: "2027-05-12", type: "iebc" },
      { label: "UDA Party Primaries", date: "2027-06-14", type: "party" },
      { label: "Manifesto Launch", date: "2027-06-20", type: "campaign" },
      { label: "GOTV Weekend", date: "2027-08-07", type: "gotv" },
      { label: "ELECTION DAY 2027", date: env.electionDay, type: "election" },
    ],
    // ---- Live, database-backed activity calendar ----
    activityTypes: ACTIVITY_TYPES,
    activityPlans,
    activityTotals: {
      planned: activities.length,
      done: activities.filter((a) => a.status === "done").length,
      upcoming: activities.filter((a) => a.phase === "upcoming" || a.phase === "today").length,
    },
    upcoming,
    calendar,
    keyEvents,
    filters: {
      types: ACTIVITY_TYPES.map((t) => ({ id: t.id, label: t.label, category: t.category })),
      subCounties: context.subCounties.map((s) => ({ id: s.id, name: s.name })),
      wards: context.wards.map((w) => ({ id: w.id, name: w.name, constituency: w.constituency })),
    },
  };
}

export default { roadmap, listActivities, ACTIVITY_TYPES };
