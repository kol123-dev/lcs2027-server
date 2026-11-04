import { roadmap, listActivities } from "../services/roadmap.js";

export async function getRoadmap(_req, res, next) {
  try {
    res.json(await roadmap());
  } catch (err) {
    next(err);
  }
}

/**
 * Filtered, dated activity list. Used by the roadmap calendar and by the
 * linked views (bloc / ward / polling-centre panels) which pass their own
 * `bloc`, `ward` or `station` filter.
 */
export async function getActivities(req, res, next) {
  try {
    const { type, category, subCounty, ward, bloc, station, q, from, to, limit } = req.query;
    res.json({
      activities: await listActivities({ type, category, subCounty, ward, bloc, station, q, from, to, limit }),
    });
  } catch (err) {
    next(err);
  }
}
