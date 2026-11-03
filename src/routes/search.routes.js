import { Router } from "express";
import * as searchCtl from "../controllers/search.controller.js";

const router = Router();

// Advanced baseline search (centres, wards, candidates, sub-counties)
router.get("/", searchCtl.search);

export default router;