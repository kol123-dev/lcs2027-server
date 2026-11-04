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
import { seedAgents } from "./seed-agents.mjs";
import { seedBlocs } from "./seed-blocs.mjs";
import { seedRoadmap } from "./seed-roadmap.mjs";
import { seedProjects } from "./seed-projects.mjs";

const counts = await seedCampaign(prisma);
const migrated = await migrateLegacyAuth(prisma);
const agents = await seedAgents(prisma);
const blocs = await seedBlocs(prisma);
const roadmap = await seedRoadmap(prisma);
const projects = await seedProjects(prisma);

console.log(
  `[db] seeded ${counts.subCounties} sub-counties, ${counts.wards} wards, ` +
    `${counts.stations} stations, ${counts.centres} centres, ${counts.candidates} candidates`
);
console.log(
  `[db] field ops: ${agents.created} agent(s) seeded` +
    (agents.existing ? `, ${agents.existing} already on file` : "") +
    (agents.backfilled ? `, ${agents.backfilled} posted to polling stations` : "")
);
console.log(
  `[db] outreach: ${blocs.created} bloc(s) seeded` +
    (blocs.members ? `, ${blocs.members} member(s) captured` : "") +
    (blocs.existing ? `, ${blocs.existing} already on file` : "")
);
console.log(
  `[db] roadmap: ${roadmap.created} activity(ies) seeded` +
    (roadmap.existing ? `, ${roadmap.existing} already on file` : "") +
    (roadmap.skipped ? " (no wards on file — skipped)" : "")
);
console.log(
  `[db] auth: imported ${migrated.users} user(s), ${migrated.sessions} session(s), ` +
    `${migrated.accounts} account(s), ${migrated.verifications} verification(s)`
);
console.log(
  `[db] projects: ${projects.created} programme(s) seeded` +
    (projects.beneficiaries ? `, ${projects.beneficiaries} demo beneficiary sheet(s)` : "") +
    (projects.existing ? `, ${projects.existing} already on file` : "")
);

await prisma.$disconnect();