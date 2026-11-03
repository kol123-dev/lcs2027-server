import { formatPhone } from "../auth/phone.js";

/** GET /api/me — the authenticated user, trimmed of any sensitive residue. */
export function getMe(req, res) {
  const u = req.session?.user || null;
  if (!u) return res.status(401).json({ user: null });
  res.json({
    user: {
      id: u.id,
      name: u.name,
      phone: u.username,
      phoneDisplay: formatPhone(u.username),
      role: u.role,
      subCounty: u.subCounty || null,
    },
  });
}