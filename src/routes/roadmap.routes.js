import { Router } from "express";
import { getRoadmap } from "../controllers/roadmap.controller.js";

const router = Router();

// 10-Month Master Roadmap & Countdown
router.get("/", getRoadmap);

export default router;