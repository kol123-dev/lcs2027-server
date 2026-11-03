import env from "../config/env.js";

/**
 * 10-Month Master Roadmap (Nov 2026 -> Aug 2027) tuned to the Kenyan
 * election calendar: IEBC registration windows, church blitzes, market
 * day circuits, party primaries, and a final GOTV sprint.
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
    kpis: [{ metric: "Turnout (swing wards)", target: "58%+" }, { metric: "Stations covered", target: "365/365" }],
  },
];

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

export function roadmap() {
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

  return {
    electionDay: env.electionDay,
    countdown: {
      daysRemaining,
      weeksRemaining,
      monthsRemaining: (daysRemaining / 30).toFixed(1),
      electionWeek: Math.ceil(daysRemaining / 7),
      today: now.toISOString().slice(0, 10),
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
  };
}

export default { roadmap };