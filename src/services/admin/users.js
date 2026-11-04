import prisma from "../../db.js";
import { auth } from "../../auth/auth.js";
import { normalizePhone, isValidKenyanMobile } from "../../auth/phone.js";

/**
 * Superadmin user management.
 *
 * Reads come straight from the `user` table (fast, paged, searchable). Every
 * mutation is delegated to Better Auth's own admin endpoints — `createUser`,
 * `adminUpdateUser`, `setRole`, `banUser`, `unbanUser`, `removeUser`,
 * `setUserPassword` — so passwords are hashed by the same code path as
 * sign-up and the `admin` plugin applies its own permission checks on top of
 * the route-level `adminOnly` guard.
 *
 * `username` (the Kenyan mobile number, 254XXXXXXXXX) remains the identity;
 * the synthetic `${username}@phone.invalid` email mirrors what the public
 * sign-up flow already writes.
 */

export const USER_ROLES = [
  { value: "admin", label: "War-room admin" },
  { value: "organizer", label: "Organizer" },
  { value: "agent", label: "Field agent" },
  { value: "viewer", label: "Viewer" },
];

const USER_SELECT = {
  id: true,
  name: true,
  username: true,
  email: true,
  role: true,
  subCounty: true,
  banned: true,
  banReason: true,
  banExpires: true,
  createdAt: true,
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

/** Better Auth throws `APIError`s whose readable text lives in `body.message`. */
function message(err) {
  return String(err?.body?.message || err?.message || "The request was rejected");
}

const isRole = (role) => USER_ROLES.some((r) => r.value === role);

/** Register-wide account counters, shared by the roster and the console overview. */
export async function userTotals() {
  const [total, admins, organizers, agents, banned] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.user.count({ where: { role: "organizer" } }),
    prisma.user.count({ where: { role: "agent" } }),
    prisma.user.count({ where: { banned: true } }),
  ]);
  return { total, admins, organizers, agents, banned };
}

/** Paged, searchable staff directory with register-wide counters. */
export async function listUsers({ q, role, status, page, pageSize } = {}) {
  const where = {};
  if (role && isRole(role)) where.role = role;
  if (status === "banned") where.banned = true;
  if (status === "active") where.banned = false;

  const needle = typeof q === "string" ? q.trim() : "";
  if (needle) {
    where.OR = [
      { name: { contains: needle } },
      { username: { contains: needle } },
      { email: { contains: needle } },
      { subCounty: { contains: needle } },
    ];
  }

  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE));
  const totalRows = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / size));
  const current = Math.min(Math.max(1, Number(page) || 1), totalPages);

  const [rows, totals] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (current - 1) * size,
      take: size,
      select: USER_SELECT,
    }),
    userTotals(),
  ]);

  return {
    roles: USER_ROLES,
    totals,
    users: rows,
    page: current,
    pageSize: size,
    totalRows,
    totalPages,
  };
}

/** Create a staff account with a mobile-number identity and an initial role. */
export async function createUser(headers, payload = {}) {
  const name = String(payload.name ?? "").trim();
  const username = normalizePhone(String(payload.username ?? payload.phone ?? ""));
  const password = String(payload.password ?? "");
  const role = isRole(payload.role) ? payload.role : "agent";
  const subCounty = payload.subCounty ? String(payload.subCounty).trim().slice(0, 80) : null;

  if (name.length < 2) return { error: "Full name is required" };
  if (!username || !isValidKenyanMobile(username)) {
    return { error: "Enter a valid Kenyan mobile number, e.g. 0712 345 678" };
  }
  if (password.length < 8) return { error: "Password must be at least 8 characters" };

  const clash = await prisma.user.findUnique({ where: { username } });
  if (clash) return { error: "That mobile number is already registered", code: "CONFLICT" };

  try {
    const result = await auth.api.createUser({
      body: {
        email: `${username}@phone.invalid`,
        password,
        name,
        role,
        data: { username, ...(subCounty ? { subCounty } : {}) },
      },
      headers,
    });
    return { user: pick(result?.user) };
  } catch (err) {
    return { error: message(err) };
  }
}

/** Edit a staff account's name, ward assignment or role. */
export async function updateUser(headers, userId, payload = {}) {
  const target = await prisma.user.findUnique({ where: { id: String(userId) } });
  if (!target) return { notFound: true };

  const data = {};
  if (payload.name !== undefined) {
    const name = String(payload.name ?? "").trim();
    if (name.length < 2) return { error: "Full name is required" };
    data.name = name;
  }
  if (payload.subCounty !== undefined) {
    data.subCounty = payload.subCounty ? String(payload.subCounty).trim().slice(0, 80) : null;
  }

  let role;
  if (payload.role !== undefined) {
    role = String(payload.role);
    if (!isRole(role)) return { error: "Unknown role" };
    if (role !== target.role && target.id === payload.actorId) {
      return { error: "You cannot change your own role" };
    }
  }

  try {
    if (Object.keys(data).length) {
      await auth.api.adminUpdateUser({ body: { userId: target.id, data }, headers });
    }
    if (role !== undefined && role !== target.role) {
      await auth.api.setRole({ body: { userId: target.id, role }, headers });
    }
    const fresh = await prisma.user.findUnique({ where: { id: target.id }, select: USER_SELECT });
    return { user: fresh };
  } catch (err) {
    return { error: message(err) };
  }
}

/** Suspend an account, with an optional reason. */
export async function banUser(headers, userId, { reason, actorId } = {}) {
  const target = await prisma.user.findUnique({ where: { id: String(userId) } });
  if (!target) return { notFound: true };
  if (target.id === actorId) return { error: "You cannot suspend your own account" };

  try {
    await auth.api.banUser({
      body: { userId: target.id, ...(reason ? { banReason: String(reason).slice(0, 300) } : {}) },
      headers,
    });
    const fresh = await prisma.user.findUnique({ where: { id: target.id }, select: USER_SELECT });
    return { user: fresh };
  } catch (err) {
    return { error: message(err) };
  }
}

/** Lift a suspension. */
export async function unbanUser(headers, userId) {
  const target = await prisma.user.findUnique({ where: { id: String(userId) } });
  if (!target) return { notFound: true };

  try {
    await auth.api.unbanUser({ body: { userId: target.id }, headers });
    const fresh = await prisma.user.findUnique({ where: { id: target.id }, select: USER_SELECT });
    return { user: fresh };
  } catch (err) {
    return { error: message(err) };
  }
}

/** Set a new password for a staff account. */
export async function setUserPassword(headers, userId, newPassword) {
  const target = await prisma.user.findUnique({ where: { id: String(userId) } });
  if (!target) return { notFound: true };

  const password = String(newPassword ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters" };

  try {
    await auth.api.setUserPassword({ body: { userId: target.id, newPassword: password }, headers });
    return { ok: true, user: pick(target) };
  } catch (err) {
    return { error: message(err) };
  }
}

/** Permanently remove a staff account (sessions and credentials cascade). */
export async function removeUser(headers, userId, actorId) {
  const target = await prisma.user.findUnique({ where: { id: String(userId) } });
  if (!target) return { notFound: true };
  if (target.id === actorId) return { error: "You cannot delete your own account" };

  try {
    await auth.api.removeUser({ body: { userId: target.id }, headers });
    return { deleted: true, id: target.id, label: pick(target)?.name ?? null };
  } catch (err) {
    return { error: message(err) };
  }
}

function pick(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name ?? null,
    username: user.username ?? null,
    role: user.role ?? null,
    subCounty: user.subCounty ?? null,
    banned: Boolean(user.banned),
  };
}

export default {
  USER_ROLES,
  listUsers,
  createUser,
  updateUser,
  banUser,
  unbanUser,
  setUserPassword,
  removeUser,
};
