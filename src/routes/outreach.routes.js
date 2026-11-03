import { Router } from "express";
import * as outCtl from "../controllers/outreach.controller.js";

const router = Router();

// Demographic Outreach & Resource Calculator
router.get("/", outCtl.getOutreach);
router.get("/budget", outCtl.getBudget);

export default router;