import { issueRegister } from "../services/issues.js";

/**
 * Issues — the live register of problems raised on the ground (a cattle dip
 * with no acaricide, a water point that has failed, a market with no light).
 * Read-only here; the admin console owns create/update/delete through the
 * generic registry CRUD.
 */
export async function listIssues(req, res, next) {
  try {
    const { ward, bloc, stationCode, category, status, severity, q, page, pageSize } = req.query;
    res.json(await issueRegister({ ward, bloc, stationCode, category, status, severity, q, page, pageSize }));
  } catch (err) {
    next(err);
  }
}

export default { listIssues };
