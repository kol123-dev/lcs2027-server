import { Router } from "express";
import * as grassCtl from "../controllers/grassroots.controller.js";
import { staffOnly } from "../middleware/auth.js";

const router = Router();

// Polling Agent & Grassroots Network Manager
router.get("/", grassCtl.getNetwork);
router.get("/stations", grassCtl.getStations);
// Only admin/organizer may mutate readiness records.
router.patch("/readiness/:wardId", staffOnly, grassCtl.patchReadiness);

export default router;