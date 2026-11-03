/**
 * Minimal in-memory sliding-window rate limiter for auth endpoints.
 * Sign-in/sign-up get tight budgets; other auth routes a permissive one.
 *
 * Each rateLimit() instance owns its own bucket map so that stacked limiters
 * (e.g. a loose /auth/* guard + a tight sign-up guard) keep independent
 * budgets instead of double-counting the same key.
 */
import env from "../config/env.js";

// Behind Cloudflare -> nginx -> Node, every request reaches the app from
// 127.0.0.1, so `req.ip` alone would bucket every user together. Cloudflare
// always stamps CF-Connecting-IP and nginx forwards it untouched. Only trust
// it when the peer really is our loopback proxy, so a direct connection can't
// spoof a fresh bucket.
const LOOPBACK_RE = /^(::1|127\.|::ffff:127\.)/;
const defaultKeyFor = (req) => {
  const peer = req.socket?.remoteAddress || "";
  if (LOOPBACK_RE.test(peer) && req.headers["cf-connecting-ip"]) {
    return req.headers["cf-connecting-ip"];
  }
  return req.ip;
};

export function rateLimit({ windowMs = 10 * 60 * 1000, max = 20, keyFor = defaultKeyFor }) {
  const buckets = new Map(); // key -> { windowStart, hits }
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (now - b.windowStart > 15 * 60 * 1000) buckets.delete(k);
    }
  }, 60 * 1000).unref();

  return (req, res, next) => {
    if (env.nodeEnv === "test") return next();
    const key = `${keyFor(req)}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart > windowMs) {
      buckets.set(key, { windowStart: now, hits: 1 });
      return next();
    }
    bucket.hits += 1;
    if (bucket.hits > max) {
      res.setHeader("Retry-After", Math.ceil((bucket.windowStart + windowMs - now) / 1000));
      return res.status(429).json({ error: "Too many attempts — please wait a few minutes." });
    }
    return next();
  };
}