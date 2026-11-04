import { network, updateReadiness, stationsIndex } from "../services/grassroots.js";
import { agentRoster } from "../services/agents.js";

export function getNetwork(_req, res) {
  res.json(network());
}

export function getStations(req, res) {
  const { ward, q } = req.query;
  res.json({ count: null, stations: stationsIndex({ ward, q }) });
}

export async function getAgents(req, res, next) {
  try {
    const { role, ward, q } = req.query;
    res.json(await agentRoster({ role, ward, q }));
  } catch (err) {
    next(err);
  }
}

export async function patchReadiness(req, res, next) {
  try {
    const { wardId } = req.params;
    const updated = await updateReadiness(wardId, req.body ?? {});
    if (!updated) return res.status(404).json({ error: "Ward not found" });
    res.json({ wardId, readiness: updated });
  } catch (err) {
    next(err);
  }
}
