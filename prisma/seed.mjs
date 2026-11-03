#!/usr/bin/env node
/**
 * Seed the SQLite database from the verified IEBC 2022 baseline and import
 * any accounts still held by the legacy JSON auth store.
 *
 *   npm run db:seed            (from server/)
 *
 * Idempotent — safe to run repeatedly (upserts + centre re-sync).
 */
import prisma from "../src/db.js";
import seedCampaign from "./seed-data.mjs";
import migrateLegacyAuth from "../src/data/legacy-auth.mjs";

const counts = await seedCampaign(prisma);
const migrated = await migrateLegacyAuth(prisma);

console.log(
  `[db] seeded ${counts.subCounties} sub-counties, ${counts.wards} wards, ` +
    `${counts.stations} stations, ${counts.centres} centres, ${counts.candidates} candidates`
);
console.log(
  `[db] auth: imported ${migrated.users} user(s), ${migrated.sessions} session(s), ` +
    `${migrated.accounts} account(s), ${migrated.verifications} verification(s)`
);

await prisma.$disconnect();