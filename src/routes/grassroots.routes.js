import { Router } from "express";
import * as grassCtl from "../controllers/grassroots.controller.js";

const router = Router();

// Polling Agent & Grassroots Network Manager — reads only.
// Ward readiness records are edited from the superadmin console
// (`/api/admin/readiness`).
router.get("/", grassCtl.getNetwork);
router.get("/stations", grassCtl.getStations);
// Live polling-agent roster + recruited-vs-target coverage.
router.get("/agents", grassCtl.getAgents);
// Live co-ordinator roster + recruited-vs-plan coverage (5 sub-county + 25 ward posts).
router.get("/coordinators", grassCtl.getCoordinators);

export default router;