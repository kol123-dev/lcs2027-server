import { achievements, wardSpeech } from "../services/achievements.js";

export function listAchievements(req, res) {
  const { ward, constituency, category } = req.query;
  res.json(achievements({ ward, constituency, category }));
}

export function getWardSpeech(req, res) {
  const pack = wardSpeech(req.params.wardId);
  if (!pack) return res.status(404).json({ error: "Speech pack not found for ward" });
  res.json(pack);
}