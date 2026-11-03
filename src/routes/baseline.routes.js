import { Router } from "express";
import * as baselineCtl from "../controllers/baseline.controller.js";

const router = Router();

// Executive Strategy & Baseline Overview
router.get("/", baselineCtl.getBaseline);
router.get("/turnout", baselineCtl.getTurnout);
router.get("/projections", baselineCtl.getProjections);

export default router;