import { Router } from "express";
import * as admin from "../controllers/admin.controller.js";
import * as imports from "../controllers/imports.controller.js";
import { adminOnly } from "../middleware/auth.js";

/**
 * Superadmin console API — `admin` role only.
 *
 * Mounted at `/api/admin`. Every request on this router is authenticated AND
 * role-checked; the media/read routes elsewhere in the app stay untouched.
 */
const router = Router();

router.use(adminOnly);

// Registry metadata + relation option lists (wards, sub-counties, programmes…).
router.get("/meta", admin.getMeta);

// Console overview — dataset row counts + account totals for the home panel.
router.get("/stats", admin.getStats);

// Staff accounts. Declared before `/:resource` so "users" is never parsed as
// a dataset key.
router.get("/users", admin.listUsers);
router.post("/users", admin.createUser);
router.patch("/users/:id", admin.updateUser);
router.delete("/users/:id", admin.removeUser);
router.post("/users/:id/ban", admin.banUser);
router.post("/users/:id/unban", admin.unbanUser);
router.post("/users/:id/password", admin.setUserPassword);

// Spreadsheet import for the Projects directory — one template per programme,
// because each programme captures its own extra fields. Declared before
// `/:resource` so "imports" is never parsed as a dataset key.
router.get("/imports/projects/:slug/template", imports.getProjectTemplate);
router.post("/imports/projects/:slug", imports.importProjects);

// Generic datasets (sub-counties, wards, stations, centres, candidates,
// programmes, beneficiaries, activities, agents, readiness, blocs, members).
router.get("/:resource", admin.listResourceRows);
router.post("/:resource", admin.createResourceRow);
router.get("/:resource/:id", admin.getResourceRowHandler);
router.patch("/:resource/:id", admin.updateResourceRow);
router.delete("/:resource/:id", admin.deleteResourceRow);

export default router;
