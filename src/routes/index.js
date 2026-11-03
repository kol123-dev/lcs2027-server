import { Router } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../auth/auth.js";
import { auditAuth } from "../auth/audit.js";
import { rateLimit } from "../auth/rateLimit.js";
import { requireRole } from "../middleware/auth.js";
import { getMe } from "../controllers/me.controller.js";
import baselineRoutes from "./baseline.routes.js";
import wardsRoutes from "./wards.routes.js";
import achievementsRoutes from "./achievements.routes.js";
import roadmapRoutes from "./roadmap.routes.js";
import grassrootsRoutes from "./grassroots.routes.js";
import outreachRoutes from "./outreach.routes.js";
import strategyRoutes from "./strategy.routes.js";
import searchRoutes from "./search.routes.js";
import centresRoutes from "./centres.routes.js";

const router = Router();

// Better Auth endpoints (register / login / session / sign-out) mounted with
// CSRF + audit + rate limiting. Sign-in & sign-up get a tight budget.
router.all(
  "/auth/*",
  auditAuth("auth"),
  rateLimit({ windowMs: 10 * 60 * 1000, max: 30 }),
  (req, res, next) => {
    if (req.path === "/auth/sign-in/username" || req.path === "/auth/sign-up/email") {
      return rateLimit({ windowMs: 5 * 60 * 1000, max: 8 })(req, res, next);
    }
    return next();
  },
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
router.use("/achievements", achievementsRoutes);
router.use("/roadmap", roadmapRoutes);
router.use("/field", grassrootsRoutes);
router.use("/outreach", outreachRoutes);
router.use("/strategy", strategyRoutes);
router.use("/search", searchRoutes);
router.use("/centres", centresRoutes);

export default router;