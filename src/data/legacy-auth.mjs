import { loadStoreFromDisk } from "../auth/store.js";

/**
 * One-time importer for accounts created with the previous JSON-file auth
 * store (server/data/auth-store.json). Idempotent — natural keys (user /
 * session / account / verification ids) are upserted, so re-running it never
 * duplicates records. Existing session tokens survive, which keeps browsers
 * that were already signed in logged in after the move.
 */
const toDate = (v) => (v ? new Date(v) : new Date());
const clean = (v) => (typeof v === "string" ? v : undefined);

export async function migrateLegacyAuth(prisma) {
  const legacy = loadStoreFromDisk();
  const hasData =
    (legacy.user ?? []).length > 0 ||
    (legacy.session ?? []).length > 0 ||
    (legacy.account ?? []).length > 0;
  if (!hasData) return { users: 0, sessions: 0, accounts: 0, verifications: 0 };

  let users = 0;
  let sessions = 0;
  let accounts = 0;
  let verifications = 0;

  for (const u of legacy.user || []) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        name: clean(u.name),
        email: clean(u.email) ?? null,
        emailVerified: !!u.emailVerified,
        image: clean(u.image),
        username: clean(u.username),
        role: clean(u.role) ?? "agent",
        subCounty: clean(u.subCounty),
        createdAt: toDate(u.createdAt),
        updatedAt: toDate(u.updatedAt),
      },
      update: {
        username: clean(u.username),
        role: clean(u.role) ?? "agent",
        name: clean(u.name),
      },
    });
    users++;
  }

  const seenTokens = new Set();
  for (const s of legacy.session || []) {
    if (seenTokens.has(s.token)) continue;
    seenTokens.add(s.token);
    await prisma.session.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        expiresAt: toDate(s.expiresAt),
        token: s.token,
        createdAt: toDate(s.createdAt),
        updatedAt: toDate(s.updatedAt),
        ipAddress: clean(s.ipAddress),
        userAgent: clean(s.userAgent),
        userId: s.userId,
      },
      update: {
        token: s.token,
        expiresAt: toDate(s.expiresAt),
        userId: s.userId,
      },
    });
    sessions++;
  }

  for (const a of legacy.account || []) {
    await prisma.account.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        accountId: a.accountId,
        providerId: a.providerId,
        userId: a.userId,
        accessToken: clean(a.accessToken),
        refreshToken: clean(a.refreshToken),
        idToken: clean(a.idToken),
        accessTokenExpiresAt: a.accessTokenExpiresAt ? toDate(a.accessTokenExpiresAt) : null,
        refreshTokenExpiresAt: a.refreshTokenExpiresAt ? toDate(a.refreshTokenExpiresAt) : null,
        scope: clean(a.scope),
        password: a.password ?? undefined,
        createdAt: toDate(a.createdAt),
        updatedAt: toDate(a.updatedAt),
      },
      update: { accountId: a.accountId, providerId: a.providerId, userId: a.userId },
    });
    accounts++;
  }

  for (const v of legacy.verification || []) {
    await prisma.verification.upsert({
      where: { id: v.id },
      create: {
        id: v.id,
        identifier: v.identifier,
        value: v.value,
        expiresAt: toDate(v.expiresAt),
        createdAt: toDate(v.createdAt),
        updatedAt: toDate(v.updatedAt),
      },
      update: { identifier: v.identifier, value: v.value, expiresAt: toDate(v.expiresAt) },
    });
    verifications++;
  }

  return { users, sessions, accounts, verifications };
}

export default migrateLegacyAuth;