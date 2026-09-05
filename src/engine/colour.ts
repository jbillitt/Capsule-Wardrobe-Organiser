/**
 * Colour arithmetic for the styling engine.
 *
 * Two jobs: resolve plain-English colour names to hex, and judge whether two
 * colours sit well together using Itten's hue-angle harmonies.
 */

export interface Hsl {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
}

export type ColourRole =
  | "neutral-dark"
  | "neutral-mid"
  | "neutral-light"
  | "warm-neutral"
  | "denim"
  | "accent";

/**
 * Ordered most-specific-first: "charcoal grey" must match charcoal, not grey.
 */
const COLOUR_NAMES: [RegExp, string][] = [
  [/off.?white|ecru|parchment/, "#eae6df"],
  [/ivory|bone|chalk/, "#faf7f0"],
  [/cream|vanilla/, "#f5efe0"],
  [/oatmeal|porridge|jute|wheat/, "#e3d9c6"],
  [/beige|sand|stone|greige|putty|natural|nude|shell/, "#d9cfbe"],
  [/taupe|mushroom/, "#b3a394"],
  [/camel|caramel|biscuit/, "#c19a6b"],
  [/tan|cognac|toffee/, "#a26b3c"],
  [/chocolate|espresso|coffee|macchiato|mocha|cafe|caf[eé]/, "#4b3621"],
  [/brown|chestnut|walnut|cinnamon|pecan/, "#6b4423"],
  [/rust|terracotta|papa?rika|clay|ginger/, "#a44a2f"],
  [/charcoal|graphite|slate grey|slate gray/, "#3f3f46"],
  [/black|jet|onyx|obsidian|ebony|ink\b/, "#1c1917"],
  [/white|snow/, "#fafaf9"],
  [/silver|dove|ash|mist|marle|marl\b|heather/, "#c4c1bb"],
  [/grey|gray/, "#78716c"],
  [/navy|midnight/, "#1e293b"],
  [/denim|chambray|mid.?wash|light.?wash/, "#6f8faf"],
  [/indigo|dark.?wash/, "#33415c"],
  [/cobalt|royal blue/, "#2c4fa8"],
  [/sky|powder blue/, "#a8c6e8"],
  [/teal|petrol|lagoon|aqua/, "#20707a"],
  [/blue/, "#4a7bb5"],
  [/olive|khaki|fatigue|combat|army|moss|fern/, "#3d5236"],
  [/sage|eucalypt|willow|celadon/, "#9caf88"],
  [/for+est|bottle|emerald|pine\b|jungle/, "#1f4634"],
  [/mint|pistachio|apple sour/, "#b7d7bc"],
  [/green/, "#3f7d4e"],
  [/burgundy|wine|merlot|oxblood|cherry|claret|port\b/, "#58181a"],
  [/red|scarlet|crimson/, "#c0392b"],
  [/coral|salmon/, "#e8776a"],
  [/blush|ros[eé]|dusty pink|petal/, "#dcaead"],
  [/pink|fuchsia|raspberry|magenta/, "#e07ba0"],
  [/lilac|lavender|mauve/, "#b5a2c8"],
  [/purple|plum|aubergine|grape|berry\b/, "#5b3a63"],
  [/mustard|ochre|turmeric/, "#c99a2e"],
  [/yellow|butter|lemon/, "#e8c454"],
  [/orange|apricot|amber/, "#d98a3d"],
  [/gold|brass/, "#b58f3c"],
  [/leopard|animal|snake/, "#a67b4a"],
  [/stripe|breton/, "#e6e2da"],
  [/floral|print|pattern/, "#c9b8a8"],
];

const UNKNOWN_HEX = "#cbd5e1";

/** Resolve a plain-text colour name ("Mid Wash Blue") to a hex string. */
export function nameToHex(colorStr: string | undefined): string {
  const raw = (colorStr || "").toLowerCase().trim();
  if (!raw) return UNKNOWN_HEX;
  const direct = raw.match(/#[0-9a-f]{6}/);
  if (direct) return direct[0];
  for (const [pattern, hex] of COLOUR_NAMES) {
    if (pattern.test(raw)) return hex;
  }
  return UNKNOWN_HEX;
}

/** True when we could not actually identify the colour and fell back. */
export function isUnknownHex(hex: string): boolean {
  return hex.toLowerCase() === UNKNOWN_HEX;
}

/**
 * Pull a colour word out of arbitrary text. Retailers often carry the colour
 * in the product title or a tag rather than in a colour field.
 */
export function findColourName(text: string): string | null {
  const raw = (text || "").toLowerCase();
  if (!raw) return null;
  for (const [pattern] of COLOUR_NAMES) {
    const match = raw.match(pattern);
    if (match) return match[0];
  }
  return null;
}

export function hexToHsl(hex: string): Hsl {
  const clean = (hex || "").replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return { h: 0, s: 0, l: 0.5 };

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l };

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;

  return { h, s, l };
}

/**
 * Fashion neutrality, not colour-science neutrality: denim and warm sandy tones
 * behave as neutrals in a capsule even though they carry visible hue.
 */
export function colourRole(hsl: Hsl): ColourRole {
  if (hsl.s < 0.12 || hsl.l < 0.12 || hsl.l > 0.93) {
    if (hsl.l < 0.3) return "neutral-dark";
    if (hsl.l > 0.75) return "neutral-light";
    return "neutral-mid";
  }
  // Camel / beige / oatmeal / taupe family.
  if (hsl.h >= 15 && hsl.h <= 55 && hsl.s < 0.45 && hsl.l > 0.35) return "warm-neutral";
  // Denim reads as a neutral at any wash.
  if (hsl.h >= 195 && hsl.h <= 245 && hsl.s < 0.55) return "denim";
  return "accent";
}

export function isNeutral(hsl: Hsl): boolean {
  return colourRole(hsl) !== "accent";
}

export type HarmonyKind =
  | "neutral-ground"
  | "monochrome"
  | "analogous"
  | "triadic"
  | "complementary"
  | "discord";

export interface Harmony {
  kind: HarmonyKind;
  /** 0-1, how well the pair sits together. */
  score: number;
  /** Circular hue distance in degrees, 0-180. Meaningless for neutral pairs. */
  angle: number;
  /** Lightness separation; flat pairs look muddy even when the hues agree. */
  valueContrast: number;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Harmony as contiguous bands rather than peaks at the textbook angles.
 * Peaks leave dead zones: 12 degrees apart is a good tonal pair and 143 is an
 * ordinary split-complementary, but both fall between the ideals of 0/30/120/180.
 * Every angle from 0 to 180 lands in exactly one band here.
 * [maxAngle, kind, score]
 */
const HARMONY_BANDS: [number, HarmonyKind, number][] = [
  [15, "monochrome", 0.85],
  [40, "analogous", 1.0],
  [75, "discord", 0.3], // the genuine clash zone
  [110, "triadic", 0.62],
  [140, "triadic", 0.8],
  [165, "complementary", 0.85], // split complementary
  [180, "complementary", 0.92],
];

export function harmony(a: Hsl, b: Hsl): Harmony {
  const valueContrast = Math.abs(a.l - b.l);
  const aNeutral = isNeutral(a);
  const bNeutral = isNeutral(b);

  if (aNeutral && bNeutral) {
    // Two neutrals never clash, but a flat pair is dull rather than good.
    return {
      kind: "neutral-ground",
      score: 0.6 + Math.min(0.3, valueContrast),
      angle: 0,
      valueContrast,
    };
  }
  if (aNeutral || bNeutral) {
    return { kind: "neutral-ground", score: 0.88, angle: 0, valueContrast };
  }

  const angle = hueDistance(a.h, b.h);
  const band = HARMONY_BANDS.find(([max]) => angle <= max) || HARMONY_BANDS[HARMONY_BANDS.length - 1];
  const [, kind, score] = band;

  // Same hue with no lightness separation reads as a failed match rather than
  // a deliberate tonal look.
  const flatPenalty = kind === "monochrome" && valueContrast < 0.12 ? 0.4 : 1;

  return { kind, score: score * flatPenalty, angle, valueContrast };
}

/** Human-readable colour family, used by the prose engine. */
export function colourWord(hsl: Hsl, name: string): string {
  const raw = (name || "").toLowerCase();
  const first = raw.split(/[\s/,-]+/).filter(Boolean);
  // Prefer her own words: "Mid Wash Blue" -> "mid wash blue".
  if (first.length && first.length <= 3) return raw;
  const role = colourRole(hsl);
  if (role === "warm-neutral") return "warm neutral";
  if (role === "denim") return "denim";
  if (role === "neutral-dark") return "deep neutral";
  if (role === "neutral-light") return "pale neutral";
  if (role === "neutral-mid") return "mid neutral";
  return "accent";
}
