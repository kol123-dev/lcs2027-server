import {
  ADMIN_GROUPS,
  RESOURCES,
  resourceByKey,
  publicResource,
} from "../services/admin/registry.js";
import {
  listResource,
  getResourceRow,
  createResource,
  updateResource,
  deleteResource,
  buildLookups,
  resourceCounts,
} from "../services/admin/resources.js";
import * as users from "../services/admin/users.js";
import { auditEvent } from "../auth/audit.js";

/**
 * Superadmin console — HTTP surface.
 *
 *   GET    /api/admin/meta                     registry + relation lookups
 *   GET    /api/admin/users                    staff directory
 *   POST   /api/admin/users                    create a staff account
 *   PATCH  /api/admin/users/:id                edit name / ward / role
 *   POST   /api/admin/users/:id/ban            suspend
 *   POST   /api/admin/users/:id/unban          lift suspension
 *   POST   /api/admin/users/:id/password       reset password
 *   DELETE /api/admin/users/:id                remove
 *   GET    /api/admin/:resource                paged listing
 *   POST   /api/admin/:resource                create a row
 *   GET    /api/admin/:resource/:id            one row
 *   PATCH  /api/admin/:resource/:id            update a row
 *   DELETE /api/admin/:resource/:id            delete a row
 *
 * The whole router sits behind `adminOnly`; nothing here is reachable by an
 * organizer, agent or viewer.
 */

const actor = (req) => ({
  userId: req.session?.user?.id,
  phone: req.session?.user?.username,
  role: req.session?.user?.role,
});

/** 400/404 helper shared by every write handler. */
function sendResultError(res, result) {
  if (result?.notFound) return res.status(404).json({ error: "Record not found", code: "NOT_FOUND" });
  const errors = result?.errors;
  return res.status(400).json({
    error: errors?.[0] ?? result?.error ?? "Request failed",
    code: result?.code ?? "BAD_REQUEST",
    errors,
  });
}

/** Resolve `:resource` or answer 404 — keeps every handler a one-liner. */
function resource(req, res) {
  const found = resourceByKey(req.params.resource);
  if (!found) {
    res.status(404).json({ error: `Unknown dataset "${req.params.resource}"`, code: "NOT_FOUND" });
    return null;
  }
  return found;
}

// ------------------------------------------------------------------ metadata

export async function getMeta(req, res, next) {
  try {
    const lookups = await buildLookups();
    res.json({
      groups: ADMIN_GROUPS,
      resources: RESOURCES.map(publicResource),
      lookups,
      userRoles: users.USER_ROLES,
    });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------------- overview

export async function getStats(req, res, next) {
  try {
    const [counts, totals] = await Promise.all([resourceCounts(), users.userTotals()]);
    res.json({ counts, users: totals });
  } catch (err) {
    next(err);
  }
}

// ----------------------------------------------------------- generic datasets

export async function listResourceRows(req, res, next) {
  try {
    const found = resource(req, res);
    if (!found) return;
    const data = await listResource(found, req.query);
    res.json({ resource: publicResource(found), ...data });
  } catch (err) {
    next(err);
  }
}

export async function getResourceRowHandler(req, res, next) {
  try {
    const found = resource(req, res);
    if (!found) return;
    const row = await getResourceRow(found, req.params.id);
    if (!row) return res.status(404).json({ error: "Record not found", code: "NOT_FOUND" });
    res.json({ row });
  } catch (err) {
    next(err);
  }
}

export async function createResourceRow(req, res, next) {
  try {
    const found = resource(req, res);
    if (!found) return;
    const result = await createResource(found, req.body ?? {});
    if (!result.row) return sendResultError(res, result);

    auditEvent({ event: "admin.create", resource: found.key, ...actor(req), id: result.row[found.keyField] });
    res.status(201).json({ row: result.row });
  } catch (err) {
    next(err);
  }
}

export async function updateResourceRow(req, res, next) {
  try {
    const found = resource(req, res);
    if (!found) return;
    const result = await updateResource(found, req.params.id, req.body ?? {});
    if (!result.row) return sendResultError(res, result);

    auditEvent({
      event: "admin.update",
      resource: found.key,
      ...actor(req),
      id: req.params.id,
      changed: Object.keys(req.body ?? {}),
    });
    res.json({ row: result.row });
  } catch (err) {
    next(err);
  }
}

export async function deleteResourceRow(req, res, next) {
  try {
    const found = resource(req, res);
    if (!found) return;
    const result = await deleteResource(found, req.params.id);
    if (!result.deleted) return sendResultError(res, result);

    auditEvent({ event: "admin.delete", resource: found.key, ...actor(req), id: result.id, label: result.label });
    res.json({ deleted: true, id: result.id });
  } catch (err) {
    next(err);
  }
}

// -------------------------------------------------------------- user accounts

export async function listUsers(req, res, next) {
  try {
    res.json(await users.listUsers(req.query));
  } catch (err) {
    next(err);
  }
}

export async function createUser(req, res, next) {
  try {
    const result = await users.createUser(req.headers, req.body ?? {});
    if (result.error) return sendResultError(res, result);

    auditEvent({
      event: "admin.user.create",
      ...actor(req),
      userId: result.user.id,
      phone: result.user.username,
      newRole: result.user.role,
    });
    res.status(201).json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const result = await users.updateUser(req.headers, req.params.id, {
      ...(req.body ?? {}),
      actorId: req.session?.user?.id,
    });
    if (result.error || result.notFound) return sendResultError(res, result);

    auditEvent({ event: "admin.user.update", ...actor(req), userId: req.params.id, changed: Object.keys(req.body ?? {}) });
    res.json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function banUser(req, res, next) {
  try {
    const result = await users.banUser(req.headers, req.params.id, {
      reason: req.body?.reason,
      actorId: req.session?.user?.id,
    });
    if (result.error || result.notFound) return sendResultError(res, result);

    auditEvent({ event: "admin.user.ban", ...actor(req), userId: req.params.id, reason: req.body?.reason ?? null });
    res.json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function unbanUser(req, res, next) {
  try {
    const result = await users.unbanUser(req.headers, req.params.id);
    if (result.error || result.notFound) return sendResultError(res, result);

    auditEvent({ event: "admin.user.unban", ...actor(req), userId: req.params.id });
    res.json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function setUserPassword(req, res, next) {
  try {
    const result = await users.setUserPassword(req.headers, req.params.id, req.body?.newPassword);
    if (result.error || result.notFound) return sendResultError(res, result);

    auditEvent({ event: "admin.user.password", ...actor(req), userId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function removeUser(req, res, next) {
  try {
    const result = await users.removeUser(req.headers, req.params.id, req.session?.user?.id);
    if (result.error || result.notFound) return sendResultError(res, result);

    auditEvent({ event: "admin.user.delete", ...actor(req), userId: result.id, name: result.label });
    res.json({ deleted: true, id: result.id });
  } catch (err) {
    next(err);
  }
}

export default {
  getMeta,
  getStats,
  listResourceRows,
  getResourceRowHandler,
  createResourceRow,
  updateResourceRow,
  deleteResourceRow,
  listUsers,
  createUser,
  updateUser,
  banUser,
  unbanUser,
  setUserPassword,
  removeUser,
};
