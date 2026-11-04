import { Router } from "express";
import * as outCtl from "../controllers/outreach.controller.js";

const router = Router();

// Demographic Outreach & Resource Calculator
router.get("/", outCtl.getOutreach);
router.get("/budget", outCtl.getBudget);
// Live bloc register (farms, business-community groups + their members).
router.get("/blocs", outCtl.getBlocs);

export default router;