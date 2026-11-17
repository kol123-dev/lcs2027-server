import { Router } from "express";
import * as projectsCtl from "../controllers/projects.controller.js";

const router = Router();

// Projects, initiatives & achievements directory — reads only.
//
// Beneficiary sheets are written from the superadmin console
// (`/api/admin/beneficiaries`), which is the app's only CRUD surface: these
// pages exist to view what has been delivered, not to change it.
router.get("/", projectsCtl.getDirectory);
router.get("/:slug", projectsCtl.getProject);

export default router;
