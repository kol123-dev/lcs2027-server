import { Router } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../auth/auth.js";
import { auditAuth } from "../auth/audit.js";
import { rateLimit } from "../auth/rateLimit.js";
import { requireRole } from "../middleware/auth.js";
import { getMe } from "../controllers/me.controller.js";
import baselineRoutes from "./baseline.routes.js";
import wardsRoutes from "./wards.routes.js";
import projectsRoutes from "./projects.routes.js";
import roadmapRoutes from "./roadmap.routes.js";
import grassrootsRoutes from "./grassroots.routes.js";
import outreachRoutes from "./outreach.routes.js";
import strategyRoutes from "./strategy.routes.js";
import searchRoutes from "./search.routes.js";
import centresRoutes from "./centres.routes.js";
import adminRoutes from "./admin.routes.js";

const router = Router();

// Better Auth endpoints (register / login / session / sign-out) mounted with
// CSRF + audit + rate limiting.
//
// Session reads are polled by the SPA on every navigation (and by the Next.js
// middleware on every page load), so they get their own generous budget —
// sharing the credential budget locked everyone out after ~15 page views.
// Instances are created once at module load: a limiter built per-request has a
// fresh bucket map each time and would never limit anything.
const sessionLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 1200 });
const authLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30 });
const credentialLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 8 });
const SESSION_READ_PATHS = new Set(["/auth/get-session", "/auth/session"]);
const CREDENTIAL_PATHS = new Set(["/auth/sign-in/username", "/auth/sign-up/email"]);

router.all(
  "/auth/*",
  auditAuth("auth"),
  (req, res, next) => (SESSION_READ_PATHS.has(req.path) ? sessionLimiter : authLimiter)(req, res, next),
  (req, res, next) => (CREDENTIAL_PATHS.has(req.path) ? credentialLimiter(req, res, next) : next()),
  (req, res) => toNodeHandler(auth)(req, res)
);

// Authenticated identity endpoint (any signed-in user).
router.get("/me", auditAuth("identity"), requireRole([]), getMe);

// Everything below requires an authenticated session. Only sign-in, sign-up
// and the Better Auth session endpoints above (and /health outside /api)
// remain public.
router.use(requireRole([]));

router.use("/baseline", baselineRoutes);
router.use("/wards", wardsRoutes);
router.use("/projects", projectsRoutes);
router.use("/roadmap", roadmapRoutes);
router.use("/field", grassrootsRoutes);
router.use("/outreach", outreachRoutes);
router.use("/strategy", strategyRoutes);
router.use("/search", searchRoutes);
router.use("/centres", centresRoutes);
// Superadmin console — admin role only (guarded again inside the router).
router.use("/admin", adminRoutes);

export default router;