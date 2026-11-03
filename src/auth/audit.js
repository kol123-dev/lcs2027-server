import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Audit log for authentication & privileged actions.
 *
 * Writes one JSON line per event to `data/audit/YYYY-MM-DD.jsonl`.
 * PII discipline: passwords are replaced with [REDACTED] and mobile numbers
 * are masked (25471******) so the log is safe at rest.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_DIR = process.env.AUDIT_DIR || path.join(__dirname, "..", "..", "data", "audit");

function todayFile() {
  const d = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(AUDIT_DIR, `${d}.jsonl`);
}

/** Mask a mobile number: 254712345678 -> 25471****** */
function maskPhone(value) {
  if (typeof value !== "string") return value;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("254")) {
    return `${digits.slice(0, 5)}${"*".repeat(digits.length - 7)}${digits.slice(-2)}`;
  }
  return value.length > 4 ? `${value.slice(0, 3)}***` : "*";
}

/** Strip every credential from a request body for logging. */
export function sanitizeBody(body) {
  if (!body || typeof body !== "object") return body;
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (k.toLowerCase() === "password" || k.toLowerCase() === "confirmpassword") {
      out[k] = "[REDACTED]";
    } else if (k === "username" || k === "phone") {
      out[k] = maskPhone(v);
    } else if (v && typeof v === "object") {
      out[k] = sanitizeBody(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Express middleware that records a completed auth/privileged request.
 * Attach on the routes you want audited; logs after the response finishes.
 */
export function auditAuth(actor = "unknown") {
  return (req, res, next) => {
    const started = Date.now();
    const entry = {
      ts: new Date().toISOString(),
      ip: req.ip || req.socket?.remoteAddress || null,
      method: req.method,
      path: req.originalUrl || req.url,
      actor,
    };
    if (req.body && Object.keys(req.body).length) entry.body = sanitizeBody(req.body);

    res.on("finish", () => {
      entry.status = res.statusCode;
      entry.ms = Date.now() - started;
      const logged = { ...entry, actor: undefined, body: undefined };
      if (entry.actor) logged.actor = entry.actor;
      if (entry.body && Object.keys(entry.body).length) logged.body = entry.body;
      fs.mkdir(AUDIT_DIR, { recursive: true }, () => {
        fs.appendFile(todayFile(), `${JSON.stringify(logged)}\n`, () => {});
      });
    });
    next();
  };
}

/** Append a free-form event (e.g. role change). */
export function auditEvent(event) {
  fs.mkdir(AUDIT_DIR, { recursive: true }, () => {
    fs.appendFile(todayFile(), `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`, () => {});
  });
}