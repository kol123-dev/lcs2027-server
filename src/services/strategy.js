import context from "../data/context.js";

/**
 * 2027 Target Calculus & Ward Strategy Engine.
 *
 * Every number in the dashboard flows through this module. Planning
 * assumptions are centralised in ASSUMPTIONS and exposed via
 * /api/strategy/assumptions so the campaign team can pressure-test them.
 */

// Two metrics combined, not just raw share: how much Siyoi commands (absolute
// share) AND how far clear she is of the closest rival (the safety gap). Both
// are read off the 2022 valid vote. First match wins:
//   share >= 55% AND gap >= 20pts  ->  Stronghold (safe base)
//   gap < 10pts (either way)       ->  Marginal   (true battleground)
//   share < 40% AND trailing       ->  Opposition (hostile / low-yield)
//   else                           ->  Lean       (ahead, but can slip)
export const CATEGORY_ORDER = ["stronghold", "lean", "marginal", "oppositionBastion"];

export const CATEGORY_META = {
  stronghold: {
    label: "Stronghold",
    blurb: "55%+ share with a 20pt+ lead in 2022 — safe base, minimal deployment.",
    focus: [
      "Protect the vote bank: thank-you tours, sustained ward presence.",
      "Deliver on campaign promises early; bank gratitude before August.",
      "Staff every polling station fully; zero complacency in turnout.",
      "Mobilise women & youth networks to hold share.",
    ],
  },
  lean: {
    label: "Lean",
    blurb: "Secure lead, but not beyond reach — apathy is the real opponent here.",
    focus: [
      "Hold the lead: keep visible presence and service delivery steady.",
      "Guard against apathy — turnout, not persuasion, decides these wards.",
      "Thank-you tours and local champions; no complacency in the base.",
      "Track the gap monthly; escalate to a battleground plan if it closes.",
    ],
  },
  marginal: {
    label: "Marginal",
    blurb: "Inside a 10pt gap — the true battleground; priority for people, money and time.",
    focus: [
      "Pour resources in: this is where the election is actually won.",
      "Targeted delivery wins (bursaries, water, market sheds) on the top-3 issues.",
      "House-to-house canvass with issue scorecards; land local champions.",
      "Raise mobiliser density vs 2022; recruit station captains early.",
    ],
  },
  oppositionBastion: {
    label: "Opposition",
    blurb: "Below 40% share and trailing — hostile or low-yield; persuade selectively.",
    focus: [
      "Damage-limitation: keep the margin tight, do not over-invest.",
      "Court defectors and intra-party malcontents.",
      "Spend only on a handful of winnable stations.",
      "Counter-narratives at market level.",
    ],
  },
};

export const ASSUMPTIONS = {
  electionDay: "2027-08-10",
  rollGrowthBySubCounty: {
    Cherangany: 0.05,
    Saboti: 0.06,
    Endebess: 0.04,
    Kwanza: 0.07,
    Kiminini: 0.08,
  },
  turnout: {
    baseWard: 0.55,
    gotvUplift: 0.03, // extra where turnout is the risk (lean/marginal/opposition)
    ceiling: 0.68,
  },
  shareShiftByCategory: {
    stronghold: 0.0,
    lean: 0.03,
    marginal: 0.06,
    oppositionBastion: 0.1,
  },
  // In 2027 the 2022 runner-up's bloc partially erodes; Siyoi's
  // conversion gains are drawn from that erosion.
  runnerUpErosion: 0.35,
  scenarios: [
    { id: "conservative", label: "Conservative", turnoutBump: -0.03, color: "amber" },
    { id: "target", label: "Target", turnoutBump: 0, color: "cyan" },
    { id: "stretch", label: "Stretch", turnoutBump: 0.03, color: "violet" },
  ],
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = Math.round;

/** Strongest 2022 opponent (Khatundi usually; Nakhumicha in Sikhendu). */
export function wardOpponent(ward) {
  return ward.khatundi >= ward.nakhumicha ? "khatundi" : "nakhumicha";
}

export function wardOpponentNumber(ward) {
  return Math.max(ward.khatundi, ward.nakhumicha);
}

/**
 * The safety gap: Siyoi's share minus the closest rival's share (percentage
 * points, as a fraction). Positive means she led the race in 2022.
 */
export function safetyGap(area) {
  const valid = area.valid || area.siyoi + area.khatundi + area.nakhumicha || 0;
  if (!valid) return 0;
  return area.siyoi / valid - wardOpponentNumber(area) / valid;
}

/**
 * The 4-tier classification, applied to any area carrying 2022 tallies
 * (ward, polling centre or sub-county). Reads BOTH metrics — absolute share
 * and the gap to the closest rival — so a comfortable lead at a modest share
 * is not mistaken for an opposition stronghold.
 */
export function classifyArea(area) {
  const valid = area.valid || area.siyoi + area.khatundi + area.nakhumicha || 0;
  const share = valid ? area.siyoi / valid : 0;
  const gap = safetyGap(area);
  if (share >= 0.55 && gap >= 0.2) return "stronghold";
  if (Math.abs(gap) < 0.1) return "marginal";
  if (share < 0.4 && gap < 0) return "oppositionBastion";
  return "lean";
}

function projectWard(ward, scenario) {
  const category = classifyArea(ward);
  const roll = ASSUMPTIONS.rollGrowthBySubCounty[ward.constituency] ?? 0.06;
  const reg27 = round(ward.registered * (1 + roll));
  const isGotv = ["lean", "marginal", "oppositionBastion"].includes(category);
  const turnout27 = clamp(
    ASSUMPTIONS.turnout.baseWard + (isGotv ? ASSUMPTIONS.turnout.gotvUplift : 0) + scenario.turnoutBump,
    0.35,
    ASSUMPTIONS.turnout.ceiling
  );
  const share22 = ward.valid ? ward.siyoi / ward.valid : 0;
  const share27 = clamp(share22 + ASSUMPTIONS.shareShiftByCategory[category], 0.3, 0.8);
  const derivedTarget = round(reg27 * turnout27 * share27);
  // An admin-set override replaces the model in the Target scenario only —
  // Conservative/Stretch stay model-driven so the stress tests stay honest.
  const override = Number.isFinite(ward.targetOverride) ? ward.targetOverride : null;
  const targetVotes = scenario.id === "target" && override !== null ? override : derivedTarget;
  return {
    category,
    reg27,
    turnout27,
    share22,
    share27,
    derivedTarget,
    targetOverride: override,
    targetVotes,
    delta: targetVotes - ward.siyoi,
  };
}

function buildScenario(cfg) {
  const rows = context.wards.map((w) => ({ ward: w, p: projectWard(w, cfg) }));
  const totals = {
    reg22: round(rows.reduce((a, r) => a + r.ward.registered, 0)),
    reg27: round(rows.reduce((a, r) => a + r.p.reg27, 0)),
    siyoi2022: round(rows.reduce((a, r) => a + r.ward.siyoi, 0)),
    siyoi27: round(rows.reduce((a, r) => a + r.p.targetVotes, 0)),
    runnerUp27: round(rows.reduce((a, r) => a + round(wardOpponentNumber(r.ward) * (1 - ASSUMPTIONS.runnerUpErosion)), 0)),
    activeElectorate: round(rows.reduce((a, r) => a + r.p.reg27 * r.p.turnout27, 0)),
  };
  return {
    ...totals,
    deltaVs2022: totals.siyoi27 - totals.siyoi2022,
    projectedMargin: totals.siyoi27 - totals.runnerUp27,
    projectedTurnout: totals.activeElectorate / totals.reg27,
  };
}

export function project2027() {
  const scenarios = Object.fromEntries(
    ASSUMPTIONS.scenarios.map((s) => [s.id, { ...buildScenario(s), label: s.label, id: s.id, color: s.color }])
  );

  const wardProjections = context.wards.map((w) => {
    const p = projectWard(w, ASSUMPTIONS.scenarios[1]);
    return { ...w, projection: p, opponent: wardOpponent(w), opponentNumber: wardOpponentNumber(w) };
  });

  const byCategory = Object.fromEntries(
    CATEGORY_ORDER.map((cat) => {
      const rows = wardProjections.filter((r) => r.projection.category === cat);
      return [
        cat,
        {
          wardCount: rows.length,
          registered22: round(rows.reduce((a, r) => a + r.registered, 0)),
          siyoi2022: round(rows.reduce((a, r) => a + r.siyoi, 0)),
          siyoiTarget27: round(rows.reduce((a, r) => a + r.projection.targetVotes, 0)),
          stations: rows.reduce((a, r) => a + r.stationCount, 0),
        },
      ];
    })
  );

  return { scenarios, wardProjections, byCategory };
}

export function baseline() {
  const p = project2027();
  const t = context.totals;
  return {
    county: {
      registered: t.registered,
      valid: t.valid,
      turnout2022: t.turnoutPct,
      siyoi: t.siyoi,
      khatundi: t.khatundi,
      nakhumicha: t.nakhumicha,
      marginOverSecond: t.marginOverSecond,
      siyoiShare: t.siyoi / t.valid,
      stationCount: context.stationsFlat.length,
    },
    subCounties: context.subCounties.map((sc) => {
      const rows = context.wards.filter((w) => w.constituency === sc.name);
      const growth = ASSUMPTIONS.rollGrowthBySubCounty[sc.name] ?? 0.06;
      const reg27 = round(rows.reduce((a, w) => a + round(w.registered * (1 + growth)), 0));
      const target = p.wardProjections
        .filter((w) => w.constituency === sc.name)
        .reduce((a, w) => a + w.projection.targetVotes, 0);
      const turnout27 = p.wardProjections
        .filter((w) => w.constituency === sc.name)
        .reduce((a, w) => a + w.projection.reg27 * w.projection.turnout27, 0);
      return {
        id: sc.id,
        name: sc.name,
        registered: sc.registered,
        reg27,
        siyoi: sc.siyoi,
        khatundi: sc.khatundi,
        nakhumicha: sc.nakhumicha,
        valid: sc.valid,
        margin: sc.margin,
        siyoiShare: sc.siyoiShare,
        turnout2022: sc.turnout2022,
        turnout2027: reg27 ? round((turnout27 / reg27) * 1000) / 1000 : null,
        stationCount: sc.stationCount,
        wardCount: sc.wards.length,
        target2027: target,
      };
    }),
    scenarios: p.scenarios,
    byCategory: p.byCategory,
  };
}

/** Polling-station level turnout: 2022 actual + 2027 projected (ward target). */
export function turnoutMap() {
  return context.wards.map((w) => {
    const p = projectWard(w, ASSUMPTIONS.scenarios[1]);
    return {
      wardId: w.id,
      ward: w.name,
      constituency: w.constituency,
      turnout2027Target: p.turnout27,
      stations: w.stations.map((s) => ({
        ...s,
        turnout2022Pct: round(s.turnout2022 * 1000) / 10,
      })),
    };
  });
}

export default { baseline, project2027, turnoutMap, classifyArea, safetyGap, CATEGORY_META, ASSUMPTIONS, context };