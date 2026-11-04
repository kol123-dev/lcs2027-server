import { CATEGORY_META, classifyWard, project2027, wardOpponent, wardOpponentNumber } from "../services/strategy.js";
import context from "../data/context.js";
import { listActivities } from "../services/roadmap.js";
import { beneficiariesForWard } from "../services/projects.js";

export function listWards(req, res) {
  const { constituency, category, q } = req.query;
  const rows = context.wards.map((w) => {
    const cat = classifyWard(w);
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
    const cat = classifyWard(ward);
    const projection = project2027().wardProjections.find((w) => w.id === ward.id)?.projection;
    // Roadmap rows for this ward (Mashamba meetings, ward tour, bloc events…).
    const activities = await listActivities({ ward: ward.id });
    // Delivery sheets recorded in this ward (scholarships, tools, bedding…).
    const beneficiaries = await beneficiariesForWard(ward.id);
    res.json({
      ...ward,
      activities,
      beneficiaries,
      stations: ward.stations.map((s) => ({
        ...s,
        turnout2022Pct: Math.round(s.turnout2022 * 1000) / 10,
      })),
      centres: context.centres
        .filter((c) => c.wardId === ward.id)
        .map((c) => ({
          id: c.id,
          name: c.name,
          registered: c.registered,
          cast: c.cast,
          siyoi: c.siyoi,
          khatundi: c.khatundi,
          nakhumicha: c.nakhumicha,
          valid: c.valid,
          status: c.status,
          statusOfficial: c.statusOfficial,
          siyoiShare: c.siyoiShare,
          turnout2022: c.turnout2022,
          turnout2022Pct: Math.round((c.turnout2022 || 0) * 1000) / 10,
          campaignMessage: c.campaignMessage || "",
        })),
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
            delta: projection.delta,
            category: projection.category,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}