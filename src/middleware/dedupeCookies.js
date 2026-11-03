/**
 * Collapse duplicate cookie names in the `Cookie` header, keeping the last one.
 *
 * Browsers send every cookie that scopes to the request, and when two share a
 * name the earlier-created one is listed first (RFC 6265 §5.4). That happens
 * here: the Better Auth session cookie used to be host-only for
 * api.lilliansiyoi.top and is now issued for the parent domain lilliansiyoi.top
 * (see auth/auth.js crossSubDomainCookies). A browser that signed in before
 * that change holds BOTH, sends the stale host-only one first, and Better Auth —
 * which reads the first occurrence — validated the dead token and answered
 * 401 NO_SESSION even though the user was genuinely signed in.
 *
 * The Cookie header carries no Path or Domain, so duplicates can only be
 * resolved by name. Keeping the last occurrence matches the browser's ordering
 * (newest cookie last), which is the valid one.
 */
export default function dedupeCookies(req, _res, next) {
  const header = req.headers.cookie;
  // Nothing to collapse when there is at most one cookie.
  if (!header || !header.includes(";")) return next();

  const latest = new Map();
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    // Map.set overwrites an existing name, so the last occurrence wins.
    latest.set(part.slice(0, eq).trim(), part.trim());
  }

  if (latest.size > 0) req.headers.cookie = [...latest.values()].join("; ");
  return next();
}
