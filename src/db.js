import env from "./config/env.js"; // ensures .env is loaded (DATABASE_URL)
import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client for the campaign database (SQLite).
 * Importing this module guarantees DATABASE_URL is present.
 */
const prisma = new PrismaClient();

// Graceful shutdown so the query engine child process is released.
function shutdown() {
  prisma.$disconnect();
  process.exit(0);
}
if (env.nodeEnv !== "test") {
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

export default prisma;