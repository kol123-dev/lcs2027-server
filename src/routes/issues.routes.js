import { Router } from "express";
import * as issuesCtl from "../controllers/issues.controller.js";

const router = Router();

// Live issue register — what people are actually complaining about, by ward,
// by outreach bloc and by polling centre.
router.get("/", issuesCtl.listIssues);

export default router;
