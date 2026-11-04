import cors from "cors";
import env from "./env.js";

// Private-network hostnames (local dev, same-Wi-Fi phone/tablet previews).
const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

/**
 * Single source of truth for which origins may talk to the API:
 * allowlisted via CORS_ORIGINS, plus any LAN/private-network browser in dev
 * so the dashboard can be previewed on a phone without hardcoding IPs.
 */
export function isAllowedOrigin(origin) {
  if (!origin) return true; // non-browser clients (curl, uptime monitors)
  if (env.corsOrigins.includes(origin)) return true;
  if (env.nodeEnv === "development") {
    try {
      return PRIVATE_HOST_RE.test(new URL(origin).hostname);
    } catch {
      return false;
    }
  }
  return false;
}

export default function corsConfig() {
  return cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    // Auth cookies are cross-origin (client :2027 -> API :4000), so the
    // browser must be allowed to send and store them.
    credentials: true,
  });
}