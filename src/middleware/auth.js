import { auth } from "../auth/auth.js";
import { auditEvent } from "../auth/audit.js";

/**
 * RBAC middleware.
 *
 * requireRole([])  → any authenticated session
 * requireRole([...]) → session whose role is in the list
 */
export function requireRole(roles = []) {
  return async (req, res, next) => {
    try {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) {
        return res.status(401).json({ error: "Authentication required", code: "NO_SESSION" });
      }
      const { user } = session;
      if (roles.length > 0 && !roles.includes(user.role)) {
        auditEvent({ event: "rbac.denied", userId: user.id, phone: user.username, required: roles, role: user.role, path: req.originalUrl });
        return res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN", required: roles });
      }
      req.session = session; // { user, session }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export const adminOnly = requireRole(["admin"]);
export const staffOnly = requireRole(["admin", "organizer"]);