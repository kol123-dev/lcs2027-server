import { roadmap } from "../services/roadmap.js";

export function getRoadmap(_req, res) {
  res.json(roadmap());
}