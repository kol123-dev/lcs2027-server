#!/usr/bin/env node
/**
 * Create (or elevate) a campaign admin account.
 *
 *   node scripts/seed-admin.mjs 0712345678 "Lillian Siyoi" "Your@dminPassw0rd"
 *
 * Environment overrides: ADMIN_PHONE, ADMIN_NAME, ADMIN_PASSWORD.
 * The mobile number becomes the login username; the password is stored as an
 * scrypt hash by Better Auth. New accounts are always seeded as `agent` and
 * this script performs the privileged server-side escalation to `admin`
 * straight in the database.
 */
import { auth } from "../src/auth/auth.js";
import prisma from "../src/db.js";
import { normalizePhone } from "../src/auth/phone.js";
import { auditEvent } from "../src/auth/audit.js";

const phone = normalizePhone(process.argv[2] || process.env.ADMIN_PHONE);
if (!phone) {
  console.error("Missing/ invalid Kenyan mobile. Usage: node scripts/seed-admin.mjs <0712345678> <Name> <password>");
  process.exit(1);
}
const name = process.argv[3] || process.env.ADMIN_NAME || "Lillian Siyoi";
const password = process.argv[4] || process.env.ADMIN_PASSWORD;
if (!password || password.length < 8) {
  console.error("Password must be at least 8 characters (pass it or set ADMIN_PASSWORD).");
  process.exit(1);
}

const escalate = async (userId) => {
  await prisma.user.update({ where: { id: userId }, data: { role: "admin" } });
  auditEvent({ event: "seed.admin.roleGranted", userId, phone });
};

// Already exists? Just guarantee the admin role.
const existing = await prisma.user.findUnique({ where: { username: phone } });
if (existing) {
  if (existing.role !== "admin") {
    await escalate(existing.id);
    console.log(`Account exists — escalated ${phone} to admin.`);
  } else {
    console.log(`${phone} is already admin. Nothing to do.`);
  }
  await prisma.$disconnect();
  process.exit(0);
}

const res = await auth.api.signUpEmail({
  body: {
    email: `${phone}@phone.invalid`,
    username: phone,
    password,
    name,
  },
});

if (res.user?.id) {
  await escalate(res.user.id);
}
auditEvent({ event: "seed.admin.created", userId: res.user?.id, phone });
console.log(`Admin seeded: ${name} — sign in with ${phone} / <your password>.`);

await prisma.$disconnect();