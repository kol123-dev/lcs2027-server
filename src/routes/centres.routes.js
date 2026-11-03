import { Router } from "express";
import * as centresCtl from "../controllers/centres.controller.js";
import { staffOnly } from "../middleware/auth.js";

const router = Router();

// Polling-centre content ledger (achievements + campaign message).
// Reads are public; writes require admin/organizer (super-user UI is planned).
router.get("/", centresCtl.listCentres);
router.get("/:id", centresCtl.getCentre);
router.patch("/:id", staffOnly, centresCtl.patchCentre);

export default router;