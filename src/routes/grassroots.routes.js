import { Router } from "express";
import * as grassCtl from "../controllers/grassroots.controller.js";
import { staffOnly } from "../middleware/auth.js";

const router = Router();

// Polling Agent & Grassroots Network Manager
router.get("/", grassCtl.getNetwork);
router.get("/stations", grassCtl.getStations);
// Live polling-agent roster + recruited-vs-target coverage.
router.get("/agents", grassCtl.getAgents);
// Live co-ordinator roster + recruited-vs-plan coverage (5 sub-county + 25 ward posts).
router.get("/coordinators", grassCtl.getCoordinators);
// Only admin/organizer may mutate readiness records.
router.patch("/readiness/:wardId", staffOnly, grassCtl.patchReadiness);

export default router;