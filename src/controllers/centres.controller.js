import prisma from "../db.js";
import context from "../data/context.js";
import { auditEvent } from "../auth/audit.js";
import { listActivities } from "../services/roadmap.js";
import { deliveriesForStation } from "../services/projects.js";
import { issuesForWard, nameKey, splitWardIssues, summariseIssues } from "../services/issues.js";

/**
 * Polling-centre content ledger.
 *
 * Every centre carries a `keyAchievements` list (headline wins on the
 * ground) and a `campaignMessage` (the message to deliver there). Both are
 * stored in SQLite and read straight into the advanced-search result; the
 * admin/super-user UI is planned, so staff can already edit them via
 * PATCH /api/centres/:id today.
 *
 * The centre payload also carries the full 2022 tallies (Siyoi, Khatundi,
 * Nakhumicha, share, margin), the deliveries recorded against the centre and
 * the live issues raised there — so a centre view is a complete picture.
 */

const cleanAchievements = (value) =>
  Array.isArray(value)
    ? value.filter((s) => typeof s === "string").map((s) => s.trim()).filter(Boolean).slice(0, 30)
    : [];

const parseJson = (text, fallback) => {
  try {
    const v = JSON.parse(text || "");
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

/** The 2022 race for one centre, read out of its raw candidate JSON. */
const centreTallies = (c) => {
  const candidates = parseJson(c.candidates, {});
  const siyoi = candidates.lcs ?? 0;
  const khatundi = candidates.khatundi ?? 0;
  const nakhumicha = candidates.nakhumicha ?? 0;
  const valid = c.valid ?? 0;
  return {
    siyoi,
    khatundi,
    nakhumicha,
    valid,
    margin: siyoi - khatundi,
    siyoiShare: valid ? siyoi / valid : 0,
    khatundiShare: valid ? khatundi / valid : 0,
    nakhumichaShare: valid ? nakhumicha / valid : 0,
    turnout2022Pct: c.registered ? Math.round(((c.cast ?? 0) / c.registered) * 1000) / 10 : 0,
  };
};

/** Light centre index for browsing / picking a centre (future admin UI). */
export async function listCentres(req, res, next) {
  try {
    const q = (req.query.q || "").trim().toLowerCase();
    const where = q ? { name: { contains: q } } : {};
    const [rows, total, issues] = await Promise.all([
      prisma.centre.findMany({
        where,
        select: {
          id: true, name: true, constituency: true, ward: true, wardId: true, wardCode: true,
          registered: true, cast: true, valid: true, status: true, candidates: true,
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
      prisma.centre.count({ where }),
      // Live issues, indexed by centre name so each row can carry its own count.
      prisma.issue.findMany({ select: { stationName: true, status: true } }),
    ]);

    const issueIndex = new Map();
    for (const i of issues) {
      const key = nameKey(i.stationName);
      if (!key) continue;
      const agg = issueIndex.get(key) ?? { total: 0, open: 0 };
      agg.total += 1;
      if (i.status !== "resolved") agg.open += 1;
      issueIndex.set(key, agg);
    }

    res.json({
      count: total,
      centres: rows.map((c) => {
        const t = centreTallies(c);
        const agg = issueIndex.get(nameKey(c.name));
        return {
          id: c.id,
          name: c.name,
          constituency: c.constituency,
          ward: c.ward,
          wardId: c.wardId,
          wardCode: c.wardCode,
          status: c.status,
          registered: c.registered,
          cast: c.cast ?? 0,
          valid: t.valid,
          siyoi: t.siyoi,
          khatundi: t.khatundi,
          nakhumicha: t.nakhumicha,
          margin: t.margin,
          siyoiShare: t.siyoiShare,
          turnout2022Pct: t.turnout2022Pct,
          issueCount: agg?.total ?? 0,
          openIssueCount: agg?.open ?? 0,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
}

export async function getCentre(req, res, next) {
  try {
    const id = Number(req.params.id);
    const centre = await prisma.centre.findUnique({
      where: { id },
      include: { wardRel: { select: { id: true, name: true } } },
    });
    if (!centre) {
      return res.status(404).json({ error: "Centre not found", code: "NOT_FOUND" });
    }
    // Roadmap rows for this centre's ward — the campaign calendar the centre
    // team works to (Mashamba meetings, church blitzes, blocs nearby…).
    const activities = await listActivities({ ward: centre.wardId });
    // Deliveries recorded against this centre, and the ward's live issues
    // narrowed to the ones actually raised here.
    const [deliveries, wardIssues] = await Promise.all([
      deliveriesForStation({ wardId: centre.wardId, stationName: centre.name }),
      issuesForWard(centre.wardId),
    ]);
    const issues = splitWardIssues(wardIssues, centre.name);
    const tallies = centreTallies(centre);
    const keyAchievements = parseJson(centre.keyAchievements, []);
    const ward = context.wardsById[centre.wardId];

    res.json({
      centre: {
        id: centre.id,
        name: centre.name,
        constituency: centre.constituency,
        wardId: centre.wardId,
        wardName: centre.wardRel?.name ?? centre.ward,
        wardCode: centre.wardCode,
        status: centre.status,
        statusOfficial: centre.statusOfficial,
        registered: centre.registered,
        cast: centre.cast ?? 0,
        rejected: centre.rejected ?? 0,
        valid: tallies.valid,
        siyoi: tallies.siyoi,
        khatundi: tallies.khatundi,
        nakhumicha: tallies.nakhumicha,
        margin: tallies.margin,
        siyoiShare: tallies.siyoiShare,
        khatundiShare: tallies.khatundiShare,
        nakhumichaShare: tallies.nakhumichaShare,
        turnout2022Pct: tallies.turnout2022Pct,
        // Ward context, so the centre reads inside its 2022 geography.
        wardSiyoi: ward?.siyoi ?? null,
        wardKhatundi: ward?.khatundi ?? null,
        wardNakhumicha: ward?.nakhumicha ?? null,
        wardRegistered: ward?.registered ?? null,
        keyAchievements: Array.isArray(keyAchievements) ? keyAchievements : [],
        campaignMessage: centre.campaignMessage || "",
        deliveries,
        deliveryCount: deliveries.length,
        issues,
        issueSummary: summariseIssues(issues),
        wardIssueCount: wardIssues.length,
        activities,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update a centre's content ledger. Both fields are optional so callers can
 * edit just one. Writes to SQLite and mirrors the change into the live
 * in-memory store so search reflects it immediately.
 */
export async function patchCentre(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { keyAchievements, campaignMessage } = req.body ?? {};

    const existing = await prisma.centre.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Centre not found", code: "NOT_FOUND" });
    }

    const data = {};
    if (keyAchievements !== undefined) {
      if (!Array.isArray(keyAchievements)) {
        return res.status(400).json({ error: "keyAchievements must be an array of strings", code: "BAD_REQUEST" });
      }
      data.keyAchievements = JSON.stringify(cleanAchievements(keyAchievements));
    }
    if (campaignMessage !== undefined) {
      if (typeof campaignMessage !== "string") {
        return res.status(400).json({ error: "campaignMessage must be a string", code: "BAD_REQUEST" });
      }
      data.campaignMessage = campaignMessage.trim();
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Nothing to update — send keyAchievements and/or campaignMessage", code: "BAD_REQUEST" });
    }

    const updated = await prisma.centre.update({ where: { id }, data });

    // Mirror into the enriched store so GET /api/search + this controller
    // agree without a server restart.
    const live = context.centres.find((c) => c.id === id);
    if (live) {
      if (data.keyAchievements) live.keyAchievements = cleanAchievements(keyAchievements);
      if (data.campaignMessage !== undefined) live.campaignMessage = data.campaignMessage;
    }

    auditEvent({
      event: "centre.content.update",
      userId: req.session?.user?.id,
      phone: req.session?.user?.username,
      role: req.session?.user?.role,
      centreId: id,
      centre: existing.name,
      changed: Object.keys(data),
    });

    res.json({
      centre: {
        id: updated.id,
        name: updated.name,
        keyAchievements: JSON.parse(updated.keyAchievements || "[]"),
        campaignMessage: updated.campaignMessage || "",
      },
    });
  } catch (err) {
    next(err);
  }
}

export default { listCentres, getCentre, patchCentre };