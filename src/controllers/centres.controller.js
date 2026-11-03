import prisma from "../db.js";
import context from "../data/context.js";
import { auditEvent } from "../auth/audit.js";

/**
 * Polling-centre content ledger.
 *
 * Every centre carries a `keyAchievements` list (headline wins on the
 * ground) and a `campaignMessage` (the message to deliver there). Both are
 * stored in SQLite and read straight into the advanced-search result; the
 * admin/super-user UI is planned, so staff can already edit them via
 * PATCH /api/centres/:id today.
 */

const cleanAchievements = (value) =>
  Array.isArray(value)
    ? value.filter((s) => typeof s === "string").map((s) => s.trim()).filter(Boolean).slice(0, 30)
    : [];

/** Light centre index for browsing / picking a centre (future admin UI). */
export async function listCentres(req, res, next) {
  try {
    const q = (req.query.q || "").trim().toLowerCase();
    const where = q ? { name: { contains: q } } : {};
    const [rows, total] = await Promise.all([
      prisma.centre.findMany({
        where,
        select: { id: true, name: true, constituency: true, ward: true, wardCode: true, status: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
      prisma.centre.count({ where }),
    ]);
    res.json({ count: total, centres: rows });
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
    res.json({
      centre: {
        id: centre.id,
        name: centre.name,
        constituency: centre.constituency,
        wardId: centre.wardId,
        wardName: centre.wardRel?.name ?? centre.ward,
        status: centre.status,
        registered: centre.registered,
        valid: centre.valid,
        keyAchievements: Array.isArray(JSON.parse(centre.keyAchievements || "[]")) ? JSON.parse(centre.keyAchievements || "[]") : [],
        campaignMessage: centre.campaignMessage || "",
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