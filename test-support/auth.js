/**
 * Shared helpers for the auth + RBAC test suites.
 * Lives outside test/ so node --test does not pick it up as a test file.
 */
import assert from "node:assert/strict";
import prisma from "../src/db.js";
import env from "../src/config/env.js";

/** Random valid-looking Kenyan mobile: 2547 + 8 digits. */
export function randomPhone() {
  return `2547${String(Math.floor(10000000 + Math.random() * 90000000))}`;
}

/** Join the Set-Cookie headers into a value usable as a Cookie request header. */
export function parseCookieHeader(response) {
  const raw =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : ([response.headers.get("set-cookie")].filter(Boolean) ?? []);
  return raw.map((c) => c.split(";")[0]).join("; ");
}

/** POST to an /api/auth/* endpoint and return { status, body, cookie }. */
export async function postAuth(base, path, body, cookie) {
  const res = await fetch(`${base}/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Better Auth enforces a CSRF origin check on POSTs; node's fetch does
      // not send an Origin header by default, so supply the trusted client
      // origin like a real browser would.
      origin: env.corsOrigins.find((o) => o.includes("2027")) ?? "http://localhost:2027",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null), cookie: parseCookieHeader(res) };
}

/** Escalate an existing account to admin in the database (privileged op). */
export async function makeAdmin(phone) {
  const user = await prisma.user.findUnique({ where: { username: phone } });
  assert.ok(user, "sign up before escalating");
  await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
  return user;
}