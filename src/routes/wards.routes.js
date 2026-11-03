import { Router } from "express";
import * as wardsCtl from "../controllers/wards.controller.js";

const router = Router();

// Ward & Swing Vote Strategic Matrix
router.get("/", wardsCtl.listWards);
router.get("/:id", wardsCtl.getWard);

export default router;