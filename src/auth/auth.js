import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { prismaAdapter } from "better-auth/adapters/prisma";
import env from "../config/env.js";
import prisma from "../db.js";
import { normalizePhone, isValidKenyanMobile } from "./phone.js";

/**
 * Campaign war-room authentication.
 *
 * - Identity: the Kenyan mobile number (normalised to 254XXXXXXXXX) doubles
 *   as the username; password login is scrypt-hashed by Better Auth.
 * - Roles: `admin` | `organizer` | `agent` | `viewer`. New sign-ups are always
 *   `agent`; escalation is a privileged server-side operation.
 * - Sessions: httpOnly cookie, 7-day expiry, refreshed on activity. Cookie
 *   signing uses AUTH_SECRET (AES-class secret handled by Better Auth core).
 * - Persistence: SQLite via the bundled Prisma adapter (user/session/account).
 */
export const auth = betterAuth({
  secret: env.authSecret,
  baseURL: env.betterAuthUrl,
  trustedOrigins: env.corsOrigins,

  database: prismaAdapter(prisma, { provider: "sqlite" }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    password: { minLength: 8, maxLength: 128 },
  },

  user: {
    // `role` and `subCounty` are server-managed: `input: false` blocks any
    // client-supplied value, so a sign-up can never self-escalate privileges.
    additionalFields: {
      role: { type: "string", required: true, defaultValue: "agent", input: false },
      subCounty: { type: "string", required: false, input: false },
    },
  },

  plugins: [
    username({
      minUsernameLength: 9,
      maxUsernameLength: 13,
      immutableUsername: true, // a phone number is a phone number
      displayUsername: false,
      usernameNormalization: (u) => normalizePhone(u) || u.replace(/\D/g, "").slice(0, 13),
      usernameValidator: (u) => isValidKenyanMobile(u),
    }),
    // Superadmin user management. `admin` is the only role that may create,
    // edit, ban or delete users; every role below it stays untouched.
    admin({
      defaultRole: "agent",
      adminRoles: ["admin"],
    }),
  ],

  // Hard-assert the "agent" starter role for users created through the PUBLIC
  // sign-up flow. An explicit role (set by a superadmin through the admin
  // plugin, which bypasses `input: false`) is preserved. Better Auth hands the
  // `create.before` hook the row data itself (not wrapped in `{ data }`).
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({ data: { ...user, role: user.role || "agent" } }),
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh rolling expiry once a day
    cookieCache: { enabled: true, maxAge: 60 },
  },

  advanced: {
    useSecureCookies: env.nodeEnv === "production",
    cookiePrefix: "siyoi2027",
    // The dashboard (lilliansiyoi.top) and the API (api.lilliansiyoi.top) are
    // different hosts. Without a shared parent-domain cookie the Next.js
    // middleware never sees the session and bounces the user straight back to
    // sign-in after a successful login.
    crossSubDomainCookies: {
      enabled: env.nodeEnv === "production",
      domain: env.cookieDomain,
    },
  },
});