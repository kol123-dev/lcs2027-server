import { CATEGORY_META, classifyArea, project2027, safetyGap, wardOpponent, wardOpponentNumber } from "../services/strategy.js";
import context from "../data/context.js";
import { listActivities } from "../services/roadmap.js";
import { beneficiariesForWard, deliverySummaryForWard } from "../services/projects.js";
import { issuesForWard, nameKey, summariseIssues } from "../services/issues.js";

export function listWards(req, res) {
  const { constituency, category, q } = req.query;
  const rows = context.wards.map((w) => {
    const cat = classifyArea(w);
    return {
      id: w.id,
      name: w.name,
      constituency: w.constituency,
      category: cat,
      categoryLabel: CATEGORY_META[cat].label,
      registered: w.registered,
      siyoi: w.siyoi,
      khatundi: w.khatundi,
      nakhumicha: w.nakhumicha,
      valid: w.valid,
      margin: w.margin,
      marginPct: safetyGap(w),
      leader: w.leader,
      siyoiShare: w.siyoiShare,
      turnout2022: w.turnout2022,
      stationCount: w.stationCount,
    };
  });
  const filtered = rows.filter((w) => {
    if (constituency && w.constituency !== constituency) return false;
    if (category && w.category !== category) return false;
    if (q && !w.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  res.json({ wards: filtered, meta: CATEGORY_META, constituencies: context.subCounties.map((s) => s.name) });
}

export async function getWard(req, res, next) {
  try {
    const ward = context.wardsById[req.params.id];
    if (!ward) return res.status(404).json({ error: "Ward not found" });
    const cat = classifyArea(ward);
    const projection = project2027().wardProjections.find((w) => w.id === ward.id)?.projection;
    // Roadmap rows for this ward (Mashamba meetings, ward tour, bloc events…).
    const activities = await listActivities({ ward: ward.id });
    // Delivery sheets recorded in this ward (scholarships, tools, bedding…).
    const beneficiaries = await beneficiariesForWard(ward.id);
    // What the ward has actually received, rolled up per programme.
    const deliveries = await deliverySummaryForWard(ward.id);
    // Live problems raised in this ward (at a bloc, at a centre, or ward-wide).
    const issues = await issuesForWard(ward.id);

    // Index this ward's deliveries + issues by polling centre so each centre
    // row can show what was done there without one query per centre.
    const deliveriesByCentre = new Map();
    for (const b of beneficiaries) {
      const key = nameKey(b.stationName);
      if (!key) continue;
      const list = deliveriesByCentre.get(key) ?? [];
      list.push(b);
      deliveriesByCentre.set(key, list);
    }
    const issuesByCentre = new Map();
    for (const i of issues) {
      const key = nameKey(i.stationName);
      if (!key) continue;
      const list = issuesByCentre.get(key) ?? [];
      list.push(i);
      issuesByCentre.set(key, list);
    }

    res.json({
      ...ward,
      activities,
      beneficiaries,
      deliveries,
      issues,
      issueSummary: summariseIssues(issues),
      stations: ward.stations.map((s) => ({
        ...s,
        turnout2022Pct: Math.round(s.turnout2022 * 1000) / 10,
      })),
      centres: context.centres
        .filter((c) => c.wardId === ward.id)
        .map((c) => {
          const key = nameKey(c.name);
          const centreDeliveries = deliveriesByCentre.get(key) ?? [];
          const centreIssues = issuesByCentre.get(key) ?? [];
          // A centre with no manual target inherits its share of the ward target,
          // weighted by its share of the ward register.
          const wardTarget = projection?.targetVotes ?? 0;
          const derivedCentreTarget = Math.round(wardTarget * ((c.registered || 0) / (ward.registered || 1)));
          const centreCat = classifyArea(c);
          return {
            id: c.id,
            name: c.name,
            registered: c.registered,
            cast: c.cast,
            siyoi: c.siyoi,
            khatundi: c.khatundi,
            nakhumicha: c.nakhumicha,
            valid: c.valid,
            margin: (c.siyoi ?? 0) - (c.khatundi ?? 0),
            marginPct: safetyGap(c),
            category: centreCat,
            categoryLabel: CATEGORY_META[centreCat].label,
            status: c.status,
            statusOfficial: c.statusOfficial,
            siyoiShare: c.siyoiShare,
            turnout2022: c.turnout2022,
            turnout2022Pct: Math.round((c.turnout2022 || 0) * 1000) / 10,
            campaignMessage: c.campaignMessage || "",
            targetOverride: c.targetOverride ?? null,
            derivedTarget: derivedCentreTarget,
            target2027: c.targetOverride ?? derivedCentreTarget,
            deliveryCount: centreDeliveries.length,
            deliveries: centreDeliveries,
            issues: centreIssues,
          };
        }),
      category: cat,
      categoryMeta: CATEGORY_META[cat],
      opponent: wardOpponent(ward),
      opponentNumber: wardOpponentNumber(ward),
      projection: projection
        ? {
            reg27: projection.reg27,
            turnout27: projection.turnout27,
            share22: projection.share22,
            share27: projection.share27,
            target2027: projection.targetVotes,
            derivedTarget: projection.derivedTarget,
            targetOverride: projection.targetOverride,
            delta: projection.delta,
            category: projection.category,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}