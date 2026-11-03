import context from "../data/context.js";
import { classifyWard, CATEGORY_META } from "./strategy.js";

/**
 * Ground Achievements & Speech Readiness Engine.
 * Composes filterable, ward-by-ward "speech packs" from the draft
 * content ledger (campaign-content.json) merged with live 2022 data.
 */

function wardContent(ward) {
  return context.content.wards?.[ward.id] ?? null;
}

function speechPack(ward) {
  const c = wardContent(ward);
  const category = classifyWard(ward);
  const catMeta = CATEGORY_META[category];
  if (!c) return null;
  return {
    wardId: ward.id,
    ward: ward.name,
    constituency: ward.constituency,
    category,
    categoryLabel: catMeta.label,
    registered: ward.registered,
    siyoi2022: ward.siyoi,
    margin: ward.margin,
    context: c.context,
    issuesTop: c.issuesTop,
    delivered: c.delivered,
    rallyPoints: c.rallyPoints,
    vision2027: c.vision2027,
    oppositionNarratives: c.oppositionNarratives,
    champions: c.champions,
    source: context.content._meta,
  };
}

export function achievements({ ward, constituency, category, tag } = {}) {
  const county = context.content.county ?? {};
  const packs = context.wards
    .map(speechPack)
    .filter(Boolean)
    .filter((p) => {
      if (ward && p.wardId !== ward) return false;
      if (constituency && p.constituency !== constituency) return false;
      if (category && p.category !== category) return false;
      if (tag === "vision" || tag === "counter" || tag === "delivered" || tag === "rally") return true;
      return true;
    });

  const allDelivered = packs.flatMap((p) => p.delivered);
  const allRally = packs.flatMap((p) => p.rallyPoints);
  const allVision = packs.flatMap((p) => p.vision2027);
  const allCounter = packs.flatMap((p) => p.oppositionNarratives);

  return {
    county: {
      headlinePrograms: county.headlinePrograms ?? [],
      achievements: county.achievements ?? [],
      vision2027: county.vision2027 ?? [],
      counterNarratives: county.counterNarratives ?? [],
    },
    wards: packs,
    aggregate: {
      deliveredCount: allDelivered.length,
      delivered: allDelivered.slice(0, 12),
      rallyPoints: allRally.slice(0, 12),
      vision2027: allVision.slice(0, 8),
      counterNarratives: allCounter.slice(0, 8),
    },
    filters: {
      categories: Object.values(CATEGORY_META).map((m) => m.label),
      constituencies: context.subCounties.map((s) => s.name),
    },
  };
}

/** Single ready-to-deploy speech pack for a ward. */
export function wardSpeech(wardId) {
  const ward = context.wardsById[wardId];
  if (!ward) return null;
  const pack = speechPack(ward);
  const catMeta = CATEGORY_META[classifyWard(ward)];
  return {
    ...pack,
    opening: `${ward.name} — ${pack.context}`,
    closing: pack.rallyPoints[0],
    tactics: catMeta.focus,
  };
}

export default { achievements, wardSpeech };