import { Router } from "express";
import { getAssumptions } from "../controllers/strategy.controller.js";

const router = Router();

router.get("/assumptions", getAssumptions);

export default router;