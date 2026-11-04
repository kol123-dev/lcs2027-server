import {
  projectDirectory,
  projectDetail,
  createBeneficiary,
  updateBeneficiary,
  deleteBeneficiary,
} from "../services/projects.js";
import { auditEvent } from "../auth/audit.js";

/**
 * Projects, Initiatives & Achievements — HTTP surface.
 *
 * Reads are open to any signed-in session; the add / edit / delete of a
 * beneficiary sheet is guarded on the route with `staffOnly`.
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

export async function addBeneficiary(req, res, next) {
  try {
    const result = await createBeneficiary(req.params.slug, req.body ?? {});
    if (result.error) return res.status(result.code === "NOT_FOUND" ? 404 : 400).json({ error: result.error, code: result.code ?? "BAD_REQUEST" });

    auditEvent({
      event: "project.beneficiary.create",
      userId: req.session?.user?.id,
      phone: req.session?.user?.username,
      role: req.session?.user?.role,
      project: result.project?.slug,
      beneficiaryId: result.beneficiary.id,
      beneficiary: result.beneficiary.name,
    });

    res.status(201).json({ beneficiary: result.beneficiary });
  } catch (err) {
    next(err);
  }
}

export async function editBeneficiary(req, res, next) {
  try {
    const result = await updateBeneficiary(req.params.id, req.body ?? {});
    if (result.error) return res.status(result.code === "NOT_FOUND" ? 404 : 400).json({ error: result.error, code: result.code ?? "BAD_REQUEST" });

    auditEvent({
      event: "project.beneficiary.update",
      userId: req.session?.user?.id,
      phone: req.session?.user?.username,
      role: req.session?.user?.role,
      beneficiaryId: result.beneficiary.id,
      beneficiary: result.beneficiary.name,
      changed: Object.keys(req.body ?? {}),
    });

    res.json({ beneficiary: result.beneficiary });
  } catch (err) {
    next(err);
  }
}

export async function removeBeneficiary(req, res, next) {
  try {
    const result = await deleteBeneficiary(req.params.id);
    if (result.error) return res.status(result.code === "NOT_FOUND" ? 404 : 400).json({ error: result.error, code: result.code ?? "BAD_REQUEST" });

    auditEvent({
      event: "project.beneficiary.delete",
      userId: req.session?.user?.id,
      phone: req.session?.user?.username,
      role: req.session?.user?.role,
      beneficiaryId: result.id,
      beneficiary: result.name,
    });

    res.json({ deleted: true, id: result.id });
  } catch (err) {
    next(err);
  }
}

export default { getDirectory, getProject, addBeneficiary, editBeneficiary, removeBeneficiary };
