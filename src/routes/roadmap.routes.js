import { Router } from "express";
import { getRoadmap, getActivities } from "../controllers/roadmap.controller.js";

const router = Router();

// 10-Month Master Roadmap & Countdown
router.get("/", getRoadmap);
// Dated activity calendar (Mashamba, ward tours, harambees, key events…),
// filterable by type / ward / bloc / station for the linked views.
router.get("/activities", getActivities);

export default router;
