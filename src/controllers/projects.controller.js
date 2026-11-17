import { projectDirectory, projectDetail } from "../services/projects.js";

/**
 * Projects, Initiatives & Achievements — HTTP surface.
 *
 * Reads only: the directory and one programme's beneficiary register. Sheets
 * are written from the superadmin console (`/api/admin/beneficiaries`), which
 * is the app's only CRUD surface.
 */

export async function getDirectory(req, res, next) {
  try {
    const { category, q, status } = req.query;
    res.json(await projectDirectory({ category, q, status }));
  } catch (err) {
    next(err);
  }
}

export async function getProject(req, res, next) {
  try {
    const { ward, status, q, page, pageSize } = req.query;
    const data = await projectDetail(req.params.slug, { ward, status, q, page, pageSize });
    if (!data) return res.status(404).json({ error: "Programme not found", code: "NOT_FOUND" });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export default { getDirectory, getProject };
