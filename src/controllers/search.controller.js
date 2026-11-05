import context from "../data/context.js";
import { classifyWard, CATEGORY_META, project2027, wardOpponentNumber } from "../services/strategy.js";
import { beneficiariesForWard, rollupProgrammes } from "../services/projects.js";
import { issuesForWard, nameKey, summariseIssues } from "../services/issues.js";

/**
 * Advanced baseline search. Searches across polling centres, wards,
 * sub-counties and candidates, returning performance, status
 * (Stronghold / Marginal / Opposition), the 2027 target, what has actually
 * been delivered (live from the projects register) and the live issues raised
 * in each place.
 */

const norm = (s = "") =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ");

function trimTo(q, list, key, limit = 5) {
  const qn = norm(q);
  const scored = list
    .map((item) => {
      const v = norm(item[key]);
      const words = qn.split(" ").filter(Boolean);
      let score = 0;
      if (v === qn) score = 100;
      else if (v.startsWith(qn)) score = 80;
      else if (words.every((w) => v.includes(w))) score = 60;
      else if (words.some((w) => v.includes(w))) score = 40;
      else if (qn.split(" ").every((w) => v.includes(w))) score = 55;
      if (!score) return null;
      score -= 0.1 * list.indexOf(item); // stable ordering tie-break
      return { item, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.length ? scored.map((s) => s.item) : [];
}

function statusMeta(level) {
  // level: "Stronghold" | "Marginal" | "Opposition"
  const map = {
    Stronghold: { status: "stronghold", label: "Stronghold", color: "#22d3ee" },
    Marginal: { status: "marginal", label: "Marginal", color: "#f5c518" },
    Opposition: { status: "oppositionBastion", label: "Opposition", color: "#fb7185" },
  };
  return map[level] ?? map.Marginal;
}

function wardResult(ward, projections, { deliveries, issues } = {}) {
  const cat = classifyWard(ward);
  const p = projections[ward.id];
  const opp = wardOpponentNumber(ward);
  return {
    type: "ward",
    id: ward.id,
    name: ward.name,
    constituency: ward.constituency,
    wardCode: ward.wardCode,
    status: statusMeta(ward.status ?? (ward.siyoiShare >= 0.55 ? "Stronghold" : ward.siyoiShare >= 0.4 ? "Marginal" : "Opposition")),
    strategy: { category: cat, categoryLabel: CATEGORY_META[cat].label, focus: CATEGORY_META[cat].focus },
    performance2022: {
      registered: ward.registered,
      valid: ward.valid,
      siyoi: ward.siyoi,
      khatundi: ward.khatundi,
      nakhumicha: ward.nakhumicha,
      leader: ward.leader,
      opponent: p?.opponent ?? "khatundi",
      opponentNumber: opp,
      margin: ward.margin,
      siyoiShare: ward.siyoiShare,
      turnout2022: ward.turnout2022,
      stationCount: ward.stationCount,
    },
    target2027: p
      ? {
          category: p.projection.category,
          reg27: p.projection.reg27,
          turnout27: p.projection.turnout27,
          share22: p.projection.share22,
          share27: p.projection.share27,
          targetVotes: p.projection.targetVotes,
          delta: p.projection.delta,
        }
      : null,
    // Live deliveries (projects register) and live issues — no static lists.
    deliveries: deliveries ?? rollupProgrammes([], { limit: 4 }),
    issues: issues ?? [],
    issueSummary: summariseIssues(issues ?? []),
  };
}

export async function search(req, res, next) {
  try {
    const q = (req.query.q || "").trim();
    if (!q) {
      return res.json({ q, centres: [], wards: [], subCounties: [], candidates: [], total: 0 });
    }

    const projections = Object.fromEntries(project2027().wardProjections.map((w) => [w.id, w]));

    // The matched centres and wards, plus the live delivery + issue data for
    // each unique ward involved (one beneficiaries query and one issues query
    // per ward, never one per result row).
    const matchedCentres = trimTo(q, context.centres, "name", 8);
    const matchedWards = trimTo(q, context.wards, "name", 6);
    const wardIds = [...new Set([...matchedWards.map((w) => w.id), ...matchedCentres.map((c) => c.wardId)].filter(Boolean))];

    const wardData = new Map();
    await Promise.all(
      wardIds.map(async (id) => {
        const [rows, issues] = await Promise.all([
          beneficiariesForWard(id, { limit: 300 }),
          issuesForWard(id),
        ]);
        const byStation = new Map();
        for (const b of rows) {
          const key = nameKey(b.stationName);
          if (!key) continue;
          const list = byStation.get(key) ?? [];
          list.push(b);
          byStation.set(key, list);
        }
        wardData.set(id, { rows, byStation, issues });
      }),
    );

    // ---- polling centres
    const centres = matchedCentres.map((c) => {
      const ward = context.wardsById[c.wardId];
      const p = ward ? projections[ward.id] : null;
      const opp = Math.max(c.khatundi, c.nakhumicha);
      const data = wardData.get(c.wardId);
      const key = nameKey(c.name);
      const centreDeliveries = data?.byStation.get(key) ?? [];
      const centreIssues = (data?.issues ?? []).filter((i) => i.stationName && nameKey(i.stationName) === key);
      return {
        type: "centre",
        id: c.wardCode ? `${c.wardCode}-${norm(c.name).replace(/\s+/g, "-")}` : norm(c.name).replace(/\s+/g, "-"),
        name: c.name,
        constituency: c.constituency,
        ward: ward?.name ?? null,
        wardId: c.wardId,
        status: statusMeta(c.status),
        performance2022: {
          registered: c.registered,
          valid: c.valid,
          siyoi: c.siyoi,
          khatundi: c.khatundi,
          nakhumicha: c.nakhumicha,
          opponentNumber: opp,
          margin: c.siyoi - opp,
          siyoiShare: c.siyoiShare,
          turnout2022: c.turnout2022,
        },
        target2027: p
          ? {
              category: p.projection.category,
              reg27: Math.round(c.registered * (1 + (ROLL_GROWTH[c.constituency] ?? 0.06))),
              turnout27: p.projection.turnout27,
              share22: c.siyoiShare,
              share27: p.projection.share27,
              targetVotes: ward?.valid && c.valid ? Math.round(p.projection.targetVotes * (c.valid / ward.valid)) : null,
              wardTargetVotes: p.projection.targetVotes,
            }
          : null,
        // Per-centre content ledger (staff-editable):
        // centre-specific key achievements + the campaign message to use here.
        // Deliberately no ward-level fallback — a centre card only ever shows
        // content written for that exact polling site (prevents repeating the
        // ward speech pack verbatim). Ward content lives on the ward card/speech.
        content: {
          keyAchievements: Array.isArray(c.keyAchievements) ? c.keyAchievements : [],
          campaignMessage: c.campaignMessage || "",
        },
        // What the projects register has actually delivered at this centre.
        deliveries: centreDeliveries,
        deliveryCount: centreDeliveries.length,
        issues: centreIssues,
        issueSummary: summariseIssues(centreIssues),
      };
    });

    // ---- wards
    const wards = matchedWards.map((w) => {
      const data = wardData.get(w.id);
      return wardResult(w, projections, {
        deliveries: data ? rollupProgrammes(data.rows, { limit: 4 }) : null,
        issues: data?.issues ?? [],
      });
    });

    // ---- sub-counties
    const subCounties = trimTo(q, context.subCounties, "name", 5)
      .map((sc) => {
        const rows = context.wards.filter((w) => w.constituency === sc.name);
        const target = projections
          ? rows.reduce((a, w) => a + (projections[w.id]?.projection.targetVotes ?? 0), 0)
          : null;
        return {
          type: "subCounty",
          id: sc.id,
          name: sc.name,
          status: statusMeta(sc.siyoiShare >= 0.55 ? "Stronghold" : sc.siyoiShare >= 0.4 ? "Marginal" : "Opposition"),
          performance2022: {
            registered: sc.registered,
            valid: sc.valid,
            siyoi: sc.siyoi,
            khatundi: sc.khatundi,
            nakhumicha: sc.nakhumicha,
            margin: sc.margin,
            siyoiShare: sc.siyoiShare,
            turnout2022: sc.turnout2022,
            wardCount: sc.wards.length,
            stationCount: sc.stationCount,
          },
          target2027: { targetVotes: target },
        };
      });

    // ---- candidates (county performance + strongest wards)
    const candidates = context.meta.candidates
      .filter((c) => norm(c.name).includes(norm(q)) || norm(c.short).includes(norm(q)))
      .map((c) => {
        const strongest = [...context.wards]
          .map((w) => ({ ward: w.name, constituency: w.constituency, votes: w.candidates[c.key] ?? 0 }))
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 3);
        const siyoiVotes = context.meta.totals.siyoi;
        return {
          type: "candidate",
          key: c.key,
          name: c.name,
          short: c.short,
          performance2022: {
            votes: c.votes,
            share: c.share,
            rank: c.rank,
            marginVsLeader: c.votes - (c.key === "lcs" ? context.meta.totals.khatundi : siyoiVotes),
          },
          strongestWards: strongest,
          status: null,
          target2027: null,
        };
      });

    const total = centres.length + wards.length + subCounties.length + candidates.length;

    res.json({
      q,
      total,
      statusLegend: { stronghold: "Won decisively", marginal: "Winnable, needs push", oppositionBastion: "Opposition turf" },
      centreCount: context.centres.length,
      wardCount: context.wards.length,
      stationCount: context.stationsFlat.length,
      centres,
      wards,
      subCounties,
      candidates,
    });
  } catch (err) {
    next(err);
  }
}

const ROLL_GROWTH = {
  Cherangany: 0.05,
  Saboti: 0.06,
  Endebess: 0.04,
  Kwanza: 0.07,
  Kiminini: 0.08,
};

export default { search };