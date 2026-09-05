/**
 * Derives machine-readable traits from the plain-text fields the spreadsheet
 * already carries. No model, no embeddings: ordered keyword tables.
 */

import { WardrobeItem } from "../types";
import { guessCategory } from "../data";
import { Hsl, ColourRole, hexToHsl, nameToHex, colourRole, isNeutral, isUnknownHex } from "./colour";

/** Finer than the six display categories: layering position matters to scoring. */
export type Slot = "base" | "mid" | "outer" | "bottom" | "dress" | "shoe" | "bag" | "accessory";

/**
 * The specific garment, where the slot is only the layering role. Drives the
 * card silhouettes, so a boot gets a boot and a bag gets a bag.
 */
export type GarmentKind =
  | "puffer" | "coat" | "trench" | "blazer" | "denim-jacket" | "jacket" | "vest"
  | "cardigan" | "jumper" | "sweatshirt"
  | "dress" | "shirt-dress" | "overalls"
  | "shirt" | "cami" | "tank" | "henley" | "swim" | "tee" | "breton"
  | "leggings" | "trousers" | "jeans" | "shorts" | "skirt"
  | "heel" | "loafer" | "boot" | "sneaker" | "sandal" | "shoe"
  | "bag" | "socks" | "jewellery" | "hat" | "scarf" | "belt" | "sunglasses"
  | "unknown";

export interface Traits {
  id: string;
  kind: GarmentKind;
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

/** [pattern, kind, slot, formality, warmth] — ordered, first match wins. */
const GARMENTS: [RegExp, GarmentKind, Slot, number, number][] = [
  // Outerwear
  [/puffer|down jacket|parka|shearling/, "puffer", "outer", 2, 5],
  [/wool coat|overcoat|longline coat/, "coat", "outer", 4, 5],
  [/trench|mac\b|raincoat/, "trench", "outer", 4, 3],
  [/blazer|tailored jacket/, "blazer", "outer", 4, 3],
  [/denim jacket|jean jacket|shacket|utility jacket/, "denim-jacket", "outer", 2, 3],
  [/coat|jacket|duster|poncho|cape/, "jacket", "outer", 3, 4],
  [/gilet|vest\b/, "vest", "outer", 2, 3],
  // Mid layers. "Cardi" is how half of New Zealand retail spells it.
  [/cardigan|cardi\b|wrap knit/, "cardigan", "mid", 3, 4],
  [/jumper|sweater|knit|pullover|crewneck|merino/, "jumper", "mid", 3, 4],
  [/sweatshirt|hoodie|fleece/, "sweatshirt", "mid", 1, 4],
  // Dresses. Only a shirt dress is a shirt dress; a midi is just a dress.
  [/shirt.?dress/, "shirt-dress", "dress", 4, 2],
  [/dress|gown|frock|jumpsuit|playsuit/, "dress", "dress", 4, 2],
  [/overall|dungaree|pinafore/, "overalls", "dress", 3, 3],
  // Bases. Tee before shirt: "t-shirt" contains "shirt" and would lose to it.
  [/breton|stripe top/, "breton", "base", 3, 2],
  [/\bt.?shirt\b|\btee\b|\btees\b/, "tee", "base", 2, 2],
  [/button.?down|button.?up|shirt|blouse/, "shirt", "base", 3, 2],
  [/camisole|cami\b|silk top|bodysuit/, "cami", "base", 4, 1],
  [/singlet|tank|vest top/, "tank", "base", 2, 1],
  [/henley|polo\b|tunic/, "henley", "base", 3, 2],
  [/swim|bikini|togs|one.?piece/, "swim", "base", 1, 1],
  [/top\b/, "tee", "base", 2, 2],
  // Bottoms. Shorts before jeans, so "denim shorts" are shorts, not jeans.
  [/legging|track pant|jogger|sweatpant/, "leggings", "bottom", 1, 3],
  [/tailored trouser|wide leg trouser|dress pant/, "trousers", "bottom", 4, 3],
  [/trouser|chino|cargo|cul+ot+e/, "trousers", "bottom", 3, 3],
  [/\bshorts\b|\bshort\b(?!\s*[- ]?sleeve)/, "shorts", "bottom", 2, 1],
  [/jean|denim\b/, "jeans", "bottom", 2, 3],
  [/skirt/, "skirt", "bottom", 3, 2],
  [/pant/, "trousers", "bottom", 3, 3],
  // Shoes
  [/heel|pump|stiletto/, "heel", "shoe", 5, 2],
  [/loafer|brogue|oxford|ballet flat/, "loafer", "shoe", 4, 2],
  [/ankle boot|chelsea|blundstone|martens|boot/, "boot", "shoe", 3, 4],
  [/sneaker|trainer|plimsoll/, "sneaker", "shoe", 2, 2],
  [/sandal|slide|jandal|thong/, "sandal", "shoe", 2, 1],
  [/mule|clog|flats?\b|slingback|shoe/, "shoe", "shoe", 3, 2],
  // Bags and accessories
  [/tote|handbag|crossbody|clutch|backpack|bag\b|purse/, "bag", "bag", 3, 2],
  [/sock|tights|stocking/, "socks", "accessory", 2, 3],
  [/\bring\b|bracelet|brooch|bangle|jewel|necklace|earring|watch/, "jewellery", "accessory", 4, 2],
  [/sunglasses|eyewear/, "sunglasses", "accessory", 3, 2],
  [/hat|cap\b|beanie/, "hat", "accessory", 3, 2],
  [/scarf|shawl|wrap\b/, "scarf", "accessory", 3, 4],
  [/belt/, "belt", "accessory", 3, 2],
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

  let kind: GarmentKind = "unknown";
  let slot: Slot = "base";
  let formality = 3;
  let warmth = 3;
  let matchedGarment = false;

  for (const [pattern, k, s, f, w] of GARMENTS) {
    if (pattern.test(name)) {
      kind = k;
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
  if (item.season === "Handbag Inventory") {
    slot = "bag";
    if (kind === "unknown") kind = "bag";
  }

  const hex = item.hex && /^#[0-9a-fA-F]{3,6}$/.test(item.hex) ? item.hex : nameToHex(item.color);
  const hsl = hexToHsl(hex);

  const colourKnown = !isUnknownHex(hex);
  const confidence =
    (matchedGarment ? 0.6 : 0.25) + (textures.length ? 0.2 : 0) + (colourKnown ? 0.2 : 0);

  return {
    id: item.id,
    kind,
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
