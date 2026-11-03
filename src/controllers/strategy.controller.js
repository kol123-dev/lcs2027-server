import { ASSUMPTIONS, CATEGORY_META } from "../services/strategy.js";

export function getAssumptions(_req, res) {
  res.json({
    assumptions: ASSUMPTIONS,
    categories: CATEGORY_META,
    note: "Reviewable planning assumptions — the target calculus updates automatically.",
  });
}