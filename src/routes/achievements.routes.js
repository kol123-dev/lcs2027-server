import { Router } from "express";
import * as achCtl from "../controllers/achievements.controller.js";

const router = Router();

// Ground Achievements & Speech Readiness Engine
router.get("/", achCtl.listAchievements);
router.get("/speech/:wardId", achCtl.getWardSpeech);

export default router;