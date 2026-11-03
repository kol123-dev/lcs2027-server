import dotenv from "dotenv";
import os from "node:os";

dotenv.config();

// Same-Wi-Fi device previews: every private IPv4 on this machine, e.g.
// http://192.168.1.42:2027 — so a phone can open the dashboard with auth
// working, without hardcoding a DHCP IP.
const lanOrigins = Object.values(os.networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal)
  .map((n) => `http://${n.address}:2027`);

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  corsOrigins: [
    ...new Set([
      "http://localhost:3000",
      "http://localhost:2027",
      ...lanOrigins,
      ...(process.env.CORS_ORIGINS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ]),
  ],
  electionDay: process.env.ELECTION_DAY || "2027-08-10",
  // Better Auth signing secret (used for session JWTs & cookie signing).
  // Override in production with a long random value via AUTH_SECRET.
  authSecret:
    process.env.AUTH_SECRET || "dev-only-war-room-secret-change-me-aiG5Np8zXk2Q9wV1",
  // Public base URL of this API where the Better Auth client points (cookies & CSRF).
  betterAuthUrl: process.env.BETTER_AUTH_URL || "http://localhost:4000",
};

export default env;