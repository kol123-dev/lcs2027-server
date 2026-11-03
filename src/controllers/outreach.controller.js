import { outreach, calculateBudget } from "../services/outreach.js";

export function getOutreach(_req, res) {
  res.json(outreach());
}

export function getBudget(req, res) {
  const { counts, perWard } = req.query;
  let parsed = {};
  if (counts) {
    try {
      parsed = JSON.parse(counts);
    } catch {
      return res.status(400).json({ error: "counts must be a JSON object like {\"baraza\":3}" });
    }
  }
  const numeric = Object.fromEntries(
    Object.entries(parsed).map(([k, v]) => [k, Number(v)])
  );
  res.json(calculateBudget({ counts: numeric, perWard: perWard === "true" }));
}