/**
 * The staple catalogue: what the app suggests when the answer is a garment she
 * does not own yet. Seeded from catalogue.seed.json, topped up from real
 * retailers by retail.ts.
 */

import { WardrobeItem } from "../types";
import { Traits, Slot } from "./lexicon";
import { hexToHsl, isNeutral, harmony } from "./colour";
import { StyleGuide } from "./guide";

export interface CatalogueEntry {
  id: string;
  item: string;
  category: string;
  color: string;
  hex: string;
  brand: string;
  fabric: string;
  formality: number;
  warmth: number;
  aesthetics: string[];
  description: string;
  notes: string;
  /** "seed" or a retail source id. */
  source?: string;
  url?: string;
  price?: string;
  fetchedAt?: string;
}

const CATEGORY_SLOT: Record<string, Slot> = {
  Tops: "base",
  Bottoms: "bottom",
  Outerwear: "outer",
  Dresses: "dress",
  Shoes: "shoe",
  Accessories: "accessory",
};

function tokenise(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 2);
}

const STOPWORDS = new Set(["the", "and", "for", "with", "that", "some", "any", "look", "vibe", "style", "wardrobe", "capsule", "want", "need", "something"]);

/**
 * Vibe search. Plain token overlap weighted by which field matched — aesthetic
 * tags count for most, since that is what a vibe query is really asking about.
 */
export function searchByVibe(entries: CatalogueEntry[], query: string, limit = 4): CatalogueEntry[] {
  const tokens = tokenise(query).filter(t => !STOPWORDS.has(t));
  if (!tokens.length) return entries.slice(0, limit);

  const scored = entries.map(entry => {
    const fields: [string, number][] = [
      [entry.aesthetics.join(" "), 3],
      [entry.item, 2.5],
      [entry.color, 2],
      [entry.fabric, 2],
      [entry.brand, 1.5],
      [entry.description, 1],
      [entry.notes, 1],
      [entry.category, 1],
    ];
    let score = 0;
    for (const [text, weight] of fields) {
      const haystack = (text || "").toLowerCase();
      for (const t of tokens) if (haystack.includes(t)) score += weight;
    }
    return { entry, score };
  });

  const hits = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  // Spread the results across categories so four suggestions aren't four shirts.
  const chosen: CatalogueEntry[] = [];
  const usedCategories = new Set<string>();
  for (const pass of [1, 2]) {
    for (const { entry } of hits) {
      if (chosen.length >= limit) break;
      if (chosen.includes(entry)) continue;
      if (pass === 1 && usedCategories.has(entry.category)) continue;
      usedCategories.add(entry.category);
      chosen.push(entry);
    }
  }

  // Nothing matched the vibe: fall back to the highest-versatility neutrals
  // rather than returning an empty list.
  if (!chosen.length) {
    return entries.filter(e => isNeutral(hexToHsl(e.hex))).slice(0, limit);
  }
  return chosen.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Gap analysis
// ---------------------------------------------------------------------------

export interface GapRecommendation {
  item: string;
  category: string;
  color: string;
  reason: string;
  brand?: string;
  hex?: string;
  source?: string;
  url?: string;
}

export interface GapReport {
  generalGapAssessment: string;
  suggestedItemsToBuy: GapRecommendation[];
  coverage: { slot: string; count: number }[];
}

const SLOTS_WANTED: Slot[] = ["base", "mid", "outer", "bottom", "shoe"];

/**
 * How many existing garments a candidate could actually be worn with: colour
 * agrees and the formality gap is at most one step. Cheap proxy for "how many
 * new outfits does this unlock", without simulating the whole permutation set.
 */
function pairingsUnlocked(entry: CatalogueEntry, traits: Traits[]): number {
  const hsl = hexToHsl(entry.hex);
  const entrySlot = CATEGORY_SLOT[entry.category] || "base";
  return traits.filter(t => {
    if (t.slot === entrySlot) return false;
    if (Math.abs(t.formality - entry.formality) > 1) return false;
    return harmony(hsl, t.hsl).score >= 0.6;
  }).length;
}

export function analyseGaps(
  items: WardrobeItem[],
  traits: Map<string, Traits>,
  entries: CatalogueEntry[],
  guide: StyleGuide,
  season: string
): GapReport {
  const ts = items.map(i => traits.get(i.id)!).filter(Boolean);
  const target = guide.seasons[season] || guide.seasons.default;

  const counts = new Map<Slot, number>();
  for (const slot of SLOTS_WANTED) counts.set(slot, 0);
  for (const t of ts) counts.set(t.slot, (counts.get(t.slot) || 0) + 1);

  const coverage = SLOTS_WANTED.map(slot => ({ slot, count: counts.get(slot) || 0 }));
  const emptiest = coverage.slice().sort((a, b) => a.count - b.count);

  const neutralRatio = ts.length ? ts.filter(t => t.neutral).length / ts.length : 0;
  const avgWarmth = ts.length ? ts.reduce((a, t) => a + t.warmth, 0) / ts.length : 3;
  const warmthDrift = avgWarmth - target.warmthTarget;

  // Which formality bands can this capsule actually dress for?
  const uncoveredActivities = guide.activities.filter(profile => {
    const [lo, hi] = profile.formality;
    const usable = ts.filter(t => t.formality >= lo && t.formality <= hi);
    const slots = new Set(usable.map(t => t.slot));
    return !(slots.has("bottom") || slots.has("dress")) || !slots.has("shoe");
  });

  // --- assessment prose, built from the two largest actual deficits ---
  const findings: string[] = [];
  const bare = coverage.filter(c => c.count === 0);
  const thin = coverage.filter(c => c.count > 0 && c.count <= 1);

  if (bare.length) {
    findings.push(`there is nothing at all filling the ${bare.map(b => b.slot).join(" or ")} slot`);
  }
  if (thin.length) {
    findings.push(`${thin.map(t => t.slot).join(" and ")} rest on a single garment, so one wash cycle empties the capsule`);
  }
  if (Math.abs(warmthDrift) > target.tolerance) {
    findings.push(
      warmthDrift < 0
        ? `the average weight sits at ${avgWarmth.toFixed(1)} against a ${target.warmthTarget} target — this capsule is under-dressed for the season`
        : `the average weight sits at ${avgWarmth.toFixed(1)} against a ${target.warmthTarget} target — it is heavier than the season needs`
    );
  }
  if (neutralRatio < guide.palette.neutralRatioTarget - 0.15) {
    findings.push(`only ${Math.round(neutralRatio * 100)}% of it is neutral, below the ${Math.round(guide.palette.neutralRatioTarget * 100)}% that keeps pieces interchangeable`);
  }
  if (uncoveredActivities.length) {
    findings.push(`${uncoveredActivities.map(a => a.label.toLowerCase()).join(" and ")} cannot be dressed from this capsule at all`);
  }
  if (!findings.length) {
    findings.push("every slot is covered and the palette is balanced — the gaps here are depth rather than holes");
  }

  const generalGapAssessment = findings
    .slice(0, 2)
    .map(f => f.charAt(0).toUpperCase() + f.slice(1) + ".")
    .join(" ");

  // --- recommendations: fill the emptiest cells, ranked by what they unlock ---
  const wantedSlots = emptiest.slice(0, 3).map(c => c.slot);
  const recommendations: GapRecommendation[] = [];
  const usedCategories = new Set<string>();

  for (const slot of wantedSlots) {
    const forSlot = entries
      .filter(e => (CATEGORY_SLOT[e.category] || "base") === slot || (slot === "mid" && e.category === "Tops" && e.warmth >= 4))
      .filter(e => Math.abs(e.warmth - target.warmthTarget) <= target.tolerance + 1)
      .filter(e => !recommendations.some(r => r.item === e.item));

    // Prefer a different category each time, but a repeat beats returning
    // fewer recommendations than we have gaps.
    const pool = forSlot.filter(e => !usedCategories.has(e.category));
    const candidates = (pool.length ? pool : forSlot)
      .map(e => ({ e, gain: pairingsUnlocked(e, ts), neutral: isNeutral(hexToHsl(e.hex)) }))
      // A neutral fills a hole and works with more of what she owns.
      .sort((a, b) => b.gain + (b.neutral ? 2 : 0) - (a.gain + (a.neutral ? 2 : 0)));

    const best = candidates[0];
    if (!best) continue;
    usedCategories.add(best.e.category);

    const gapNote = (counts.get(slot) || 0) === 0
      ? `nothing currently fills the ${slot} slot`
      : `the ${slot} slot is down to ${counts.get(slot)} piece${counts.get(slot) === 1 ? "" : "s"}`;

    recommendations.push({
      item: best.e.item,
      category: best.e.category,
      color: best.e.color,
      brand: best.e.brand,
      hex: best.e.hex,
      source: best.e.source,
      url: best.e.url,
      reason: `${gapNote.charAt(0).toUpperCase() + gapNote.slice(1)}. In ${best.e.color.toLowerCase()} it pairs cleanly with ${best.gain} garment${best.gain === 1 ? "" : "s"} you already own${best.e.fabric ? `, and ${best.e.fabric} is the right weight for ${season.toLowerCase()}` : ""}.`,
    });

    if (recommendations.length >= 3) break;
  }

  return { generalGapAssessment, suggestedItemsToBuy: recommendations, coverage };
}
