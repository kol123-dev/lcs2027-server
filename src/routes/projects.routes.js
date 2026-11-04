import { Router } from "express";
import * as projectsCtl from "../controllers/projects.controller.js";
import { staffOnly } from "../middleware/auth.js";

const router = Router();

// Projects, initiatives & achievements directory.
// Reads: any signed-in session. Writes to a beneficiary sheet: admin/organizer.
router.get("/", projectsCtl.getDirectory);
router.get("/:slug", projectsCtl.getProject);
router.post("/:slug/beneficiaries", staffOnly, projectsCtl.addBeneficiary);
router.patch("/beneficiaries/:id", staffOnly, projectsCtl.editBeneficiary);
router.delete("/beneficiaries/:id", staffOnly, projectsCtl.removeBeneficiary);

export default router;
