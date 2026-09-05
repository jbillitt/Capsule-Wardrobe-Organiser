/**
 * Derives machine-readable traits from the plain-text fields the spreadsheet
 * already carries. No model, no embeddings: ordered keyword tables.
 */

import { WardrobeItem } from "../types";
import { guessCategory } from "../data";
import { Hsl, ColourRole, hexToHsl, nameToHex, colourRole, isNeutral, isUnknownHex } from "./colour";

/** Finer than the six display categories: layering position matters to scoring. */
export type Slot = "base" | "mid" | "outer" | "bottom" | "dress" | "shoe" | "bag" | "accessory";

export interface Traits {
  id: string;
  slot: Slot;
  category: string;
  /** 1 (athleisure) .. 5 (formal) */
  formality: number;
  /** 1 (linen) .. 5 (puffer) */
  warmth: number;
  textures: string[];
  hex: string;
  hsl: Hsl;
  role: ColourRole;
  neutral: boolean;
  /** 0..1 — how much of this was actually recognised rather than assumed. */
  confidence: number;
}

/** [pattern, slot, formality, warmth] — ordered, first match wins. */
const GARMENTS: [RegExp, Slot, number, number][] = [
  // Outerwear
  [/puffer|down jacket|parka|shearling/, "outer", 2, 5],
  [/wool coat|overcoat|longline coat/, "outer", 4, 5],
  [/trench|mac\b|raincoat/, "outer", 4, 3],
  [/blazer|tailored jacket/, "outer", 4, 3],
  [/denim jacket|jean jacket|shacket|utility jacket/, "outer", 2, 3],
  [/coat|jacket|duster|poncho|cape/, "outer", 3, 4],
  [/gilet|vest\b/, "outer", 2, 3],
  // Mid layers. "Cardi" is how half of New Zealand retail spells it.
  [/cardigan|cardi\b|wrap knit/, "mid", 3, 4],
  [/jumper|sweater|knit|pullover|crewneck|merino/, "mid", 3, 4],
  [/sweatshirt|hoodie|fleece/, "mid", 1, 4],
  // Dresses
  [/shirt dress|midi dress|maxi dress/, "dress", 4, 2],
  [/dress|gown|frock|jumpsuit|playsuit/, "dress", 4, 2],
  [/overall|dungaree|pinafore/, "dress", 3, 3],
  // Bases
  [/button.?down|button.?up|shirt|blouse/, "base", 3, 2],
  [/camisole|cami\b|silk top|bodysuit/, "base", 4, 1],
  [/singlet|tank|vest top/, "base", 2, 1],
  [/henley|polo\b|tunic/, "base", 3, 2],
  [/swim|bikini|togs|one.?piece/, "base", 1, 1],
  [/tee|t.?shirt|top\b/, "base", 2, 2],
  [/breton|stripe top/, "base", 3, 2],
  // Bottoms
  [/legging|track pant|jogger|sweatpant/, "bottom", 1, 3],
  [/tailored trouser|wide leg trouser|dress pant/, "bottom", 4, 3],
  [/trouser|chino|cargo|cul+ot+e/, "bottom", 3, 3],
  [/jean|denim short|denim\b/, "bottom", 2, 3],
  [/short\b|shorts/, "bottom", 2, 1],
  [/skirt/, "bottom", 3, 2],
  [/pant/, "bottom", 3, 3],
  // Shoes
  [/heel|pump|stiletto/, "shoe", 5, 2],
  [/loafer|brogue|oxford|ballet flat/, "shoe", 4, 2],
  [/ankle boot|chelsea|blundstone|martens|boot/, "shoe", 3, 4],
  [/sneaker|trainer|plimsoll/, "shoe", 2, 2],
  [/sandal|slide|jandal|thong/, "shoe", 2, 1],
  [/mule|clog|flats?\b|slingback|shoe/, "shoe", 3, 2],
  // Bags and accessories
  [/tote|handbag|crossbody|clutch|backpack|bag\b|purse/, "bag", 3, 2],
  [/sock|tights|stocking/, "accessory", 2, 3],
  [/\bring\b|bracelet|brooch|bangle/, "accessory", 4, 2],
  [/belt|scarf|hat|cap\b|beanie|sunglasses|jewel|necklace|earring|watch/, "accessory", 3, 2],
];

/**
 * Did any garment pattern actually match, or are we guessing? Retail feeds
 * carry plenty of things that are not clothes at all.
 */
export function recognisedGarment(name: string): boolean {
  const raw = (name || "").toLowerCase();
  return GARMENTS.some(([pattern]) => pattern.test(raw));
}

/** [pattern, canonical texture word, formality delta, warmth delta] */
const FABRICS: [RegExp, string, number, number][] = [
  [/linen/, "linen", 0, -2],
  [/chambray/, "chambray", 0, -1],
  [/silk|satin/, "silk", 1, -1],
  [/cashmere/, "cashmere", 1, 1],
  [/merino/, "merino", 0, 1],
  [/wool|tweed/, "wool", 1, 1],
  [/corduroy|cord\b/, "corduroy", 0, 1],
  [/leather/, "leather", 1, 1],
  [/suede/, "suede", 1, 1],
  [/denim/, "denim", -1, 0],
  [/cotton|poplin|jersey/, "cotton", 0, 0],
  [/viscose|modal|tencel|rayon/, "viscose", 0, -1],
  [/ribbed|rib knit/, "ribbed", 0, 0],
  [/quilted|padded/, "quilted", -1, 2],
  [/fleece|sherpa/, "fleece", -1, 2],
  [/velvet/, "velvet", 1, 1],
  [/lace|broderie/, "lace", 1, -1],
  [/mesh|technical|activewear|sport/, "technical", -2, 0],
];

/** Words that shift formality regardless of fabric. */
const REGISTER: [RegExp, number][] = [
  [/tailored|structured|sharp|smart|elevated|refined/, 1],
  [/slouchy|relaxed|oversized|casual|worn|distressed|faded/, -1],
  [/evening|occasion|dressy|formal/, 1],
  [/lounge|pyjama|pajama|home\b/, -2],
];

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * The slot table is keyed on the garment name, but her descriptions and notes
 * carry the fabric. Search name first so "linen button down" is a base layer
 * rather than being mistaken for anything in the fabric table.
 */
export function traitsFor(item: WardrobeItem): Traits {
  const name = (item.item || "").toLowerCase();
  const prose = [item.description, item.notes, item.color].filter(Boolean).join(" ").toLowerCase();
  const all = `${name} ${prose}`;

  let slot: Slot = "base";
  let formality = 3;
  let warmth = 3;
  let matchedGarment = false;

  for (const [pattern, s, f, w] of GARMENTS) {
    if (pattern.test(name)) {
      slot = s;
      formality = f;
      warmth = w;
      matchedGarment = true;
      break;
    }
  }

  if (!matchedGarment) {
    // Fall back to the app's existing category guesser rather than a bare default.
    const category = guessCategory(item.item || "", item.season);
    const bySlot: Record<string, Slot> = {
      Outerwear: "outer",
      Bottoms: "bottom",
      Shoes: "shoe",
      Dresses: "dress",
      Accessories: "accessory",
      Tops: "base",
    };
    slot = bySlot[category] || "base";
  }

  const textures: string[] = [];
  for (const [pattern, word, df, dw] of FABRICS) {
    if (pattern.test(all)) {
      textures.push(word);
      formality += df;
      warmth += dw;
    }
  }
  for (const [pattern, df] of REGISTER) {
    if (pattern.test(all)) formality += df;
  }

  // Handbag Inventory is a season, not a garment type.
  if (item.season === "Handbag Inventory") slot = "bag";

  const hex = item.hex && /^#[0-9a-fA-F]{3,6}$/.test(item.hex) ? item.hex : nameToHex(item.color);
  const hsl = hexToHsl(hex);

  const colourKnown = !isUnknownHex(hex);
  const confidence =
    (matchedGarment ? 0.6 : 0.25) + (textures.length ? 0.2 : 0) + (colourKnown ? 0.2 : 0);

  return {
    id: item.id,
    slot,
    category: item.aiSuggestedCategory || guessCategory(item.item || "", item.season),
    formality: clamp(Math.round(formality), 1, 5),
    warmth: clamp(Math.round(warmth), 1, 5),
    textures,
    hex,
    hsl,
    role: colourRole(hsl),
    neutral: isNeutral(hsl),
    confidence: clamp(confidence, 0, 1),
  };
}

export function traitsIndex(items: WardrobeItem[]): Map<string, Traits> {
  return new Map(items.map(i => [i.id, traitsFor(i)]));
}

/** Layering order, outermost last. Used by the layer-weight signal. */
export const SLOT_ORDER: Slot[] = ["base", "mid", "outer"];

export function isLayer(slot: Slot): boolean {
  return SLOT_ORDER.includes(slot);
}
