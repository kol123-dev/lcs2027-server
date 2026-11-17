import { Router } from "express";
import * as centresCtl from "../controllers/centres.controller.js";

const router = Router();

// Polling-centre content ledger (achievements + campaign message) — reads only.
// The ledger is edited from the superadmin console (`/api/admin/centres`).
router.get("/", centresCtl.listCentres);
router.get("/:id", centresCtl.getCentre);

export default router;
