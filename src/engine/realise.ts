/**
 * The language engine: a Reiter & Dale data-to-text pipeline with the neural
 * part removed. Content selection picks the strongest reasons, aggregation
 * merges reasons about the same garments, surface realisation fills templates
 * from synonym pools indexed by the day's seed.
 *
 * Nothing here invents a claim. Every sentence traces back to a Reason the
 * scorer emitted, which is why a weak outfit reads as weak.
 */

import { WardrobeItem, OutfitSuggestion } from "../types";
import { Traits } from "./lexicon";
import { Reason } from "./score";
import { ScoreContext } from "./score";
import { ScoredOutfit, mulberry32, hashString } from "./select";

type Rand = () => number;

function pick<T>(pool: T[], rand: Rand): T {
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

const MINOR_WORDS = new Set(["and", "or", "the", "a", "an", "in", "on", "of", "with", "to"]);

function titleCase(s: string): string {
  return s
    .split(/(\s+)/)
    .map((word, i) =>
      i > 0 && MINOR_WORDS.has(word.toLowerCase()) ? word.toLowerCase() : word.replace(/^[a-z]/, c => c.toUpperCase())
    )
    .join("");
}

function sentenceCase(s: string): string {
  return s.replace(/^[a-z]/, c => c.toUpperCase());
}

/**
 * Garment names are plural far more often than not - jeans, boots, trousers,
 * loafers - so verbs have to agree or every styling note reads wrong.
 */
function isPlural(item: WardrobeItem): boolean {
  const last = (item.item || "").trim().split(/\s+/).pop() || "";
  if (/(ss|dress)$/i.test(last)) return false;
  return /s$/i.test(last);
}

/** Pick the verb form that agrees with the garment. */
function agree(item: WardrobeItem, singular: string, plural: string): string {
  return isPlural(item) ? plural : singular;
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] || "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** "the off-white linen button down" — skips the colour if the name carries it. */
function phrase(item: WardrobeItem, traits?: Traits): string {
  const name = (item.item || "garment").toLowerCase().trim();
  const colour = (item.color || "").toLowerCase().trim();
  const firstColourWord = colour.split(/\s+/)[0];
  if (colour && firstColourWord && !name.includes(firstColourWord)) {
    return `the ${colour} ${name}`;
  }
  return `the ${name}`;
}

function shortName(item: WardrobeItem): string {
  return (item.item || "piece").toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// Reason -> clause
// ---------------------------------------------------------------------------

/** Plural verbs throughout: the subject is always a pair of garments. */
const HARMONY_WORDS: Record<string, string[]> = {
  analogous: ["sit a short step apart on the wheel", "share a neighbouring hue", "run close together in tone"],
  complementary: ["sit opposite each other and strike", "answer one another across the wheel", "play as a deliberate opposition"],
  triadic: ["hold a wide, even spacing", "triangulate cleanly", "keep their distance without arguing"],
  monochrome: ["work one hue at two depths", "stack the same colour in different weights", "read as a tonal pair"],
  "neutral-ground": ["stay on neutral ground", "keep to the anchor palette", "avoid asking anything of each other"],
};

function clauseFor(
  reason: Reason,
  items: WardrobeItem[],
  ctx: ScoreContext,
  rand: Rand
): string | null {
  const byId = new Map(items.map(i => [i.id, i]));
  const named = reason.itemIds.map(id => byId.get(id)).filter(Boolean) as WardrobeItem[];

  switch (reason.kind) {
    case "harmony": {
      if (named.length < 2) return null;
      const verb = pick(HARMONY_WORDS[reason.data.harmony] || HARMONY_WORDS["neutral-ground"], rand);
      const a = phrase(named[0], ctx.traits.get(named[0].id));
      const b = phrase(named[1], ctx.traits.get(named[1].id));
      return pick(
        [
          `${a} and ${b} ${verb}`,
          `${a} ${agree(named[0], "carries", "carry")} the look while ${b} ${agree(named[1], "grounds", "ground")} it`,
          `the pairing of ${a} with ${b} holds because they ${verb}`,
        ],
        rand
      );
    }
    case "neutral-ground":
      return pick(
        [
          `the palette stays anchored, ${Math.round(reason.data.ratio * 100)}% neutral`,
          `nothing here fights for attention — it sits ${Math.round(reason.data.ratio * 100)}% neutral`,
          `the whole thing rests on neutrals`,
        ],
        rand
      );
    case "accent-discipline": {
      const item = named[0];
      if (!item) return null;
      const it = phrase(item, ctx.traits.get(item.id));
      return pick(
        [
          `${it} ${agree(item, "is", "are")} the only piece raising its voice`,
          `one accent, and ${it} ${agree(item, "takes", "take")} it`,
          `colour is rationed to ${it} alone`,
        ],
        rand
      );
    }
    case "value-contrast":
      return pick(
        [
          `light and dark are separated enough that the eye travels`,
          `there is real light-to-dark movement rather than a flat block`,
          `the tonal spread keeps it from going muddy`,
        ],
        rand
      );
    case "formality-match":
      return pick(
        [
          `everything is pitched at the same level, which is what ${reason.data.activity.toLowerCase()} asks for`,
          `nothing is dressier or scruffier than anything else beside it`,
          `the register holds steady across all of it`,
        ],
        rand
      );
    case "warmth-fit":
      return pick(
        [
          `the weight is right for the season rather than hopeful about it`,
          `it is dressed for the actual temperature`,
          `the fabric weight matches what the season is doing`,
        ],
        rand
      );
    case "fabric-fit": {
      const textures: string[] = reason.data.textures || [];
      const tex = joinList(textures);
      if (!tex) return null;
      const many = textures.length > 1;
      return pick(
        [
          `${tex} ${many ? "are" : "is"} the sensible choice for ${reason.data.activity.toLowerCase()}`,
          `${tex} ${many ? "earn their" : "earns its"} place on a ${reason.data.activity.toLowerCase()}`,
          `you want ${tex} for this kind of day`,
        ],
        rand
      );
    }
    case "aesthetic-match":
      return pick(
        [
          `it reads as ${reason.data.aesthetic.toLowerCase()} without trying to`,
          `the whole reads ${reason.data.aesthetic.toLowerCase()}`,
          `this is ${reason.data.aesthetic.toLowerCase()} territory`,
        ],
        rand
      );
    case "layering":
      return pick(
        [
          `the layers get heavier as they go outward, so nothing bunches`,
          `each layer is warmer than the one under it`,
          `the layering runs in the right order`,
        ],
        rand
      );
    case "texture-contrast": {
      const tex = joinList((reason.data.textures || []).slice(0, 3));
      if (!tex) return null;
      return pick(
        [`${tex} give it something to touch`, `the mix of ${tex} keeps it from going flat`, `${tex} sit against each other well`],
        rand
      );
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Content selection and aggregation
// ---------------------------------------------------------------------------

function selectReasons(reasons: Reason[], floor: number, max = 3): Reason[] {
  const chosen: Reason[] = [];
  const kinds = new Set<string>();
  for (const r of reasons) {
    if (r.strength < floor) continue;
    if (kinds.has(r.kind)) continue;
    kinds.add(r.kind);
    chosen.push(r);
    if (chosen.length >= max) break;
  }
  return chosen;
}

function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1) + ".";
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

const CADENCE = [
  "{colour} & {colour2}, {mood}",
  "The {mood} {garment}",
  "{colour} {garment}, {mood}",
  "{mood} in {colour}",
  "{colour} on {colour2}",
];

function nameOutfit(items: WardrobeItem[], ctx: ScoreContext, rand: Rand): string {
  const traits = items.map(i => ctx.traits.get(i.id)).filter(Boolean) as Traits[];
  const colours = items
    .map(i => (i.color || "").trim())
    .filter(Boolean)
    .filter((c, idx, arr) => arr.indexOf(c) === idx);

  const anchor = items.find(i => ctx.traits.get(i.id)?.slot === "outer")
    || items.find(i => ctx.traits.get(i.id)?.slot === "dress")
    || items.find(i => ctx.traits.get(i.id)?.slot === "base")
    || items[0];

  const moodPool = [...ctx.activity.voice, ...ctx.aesthetic.voice];
  const mood = pick(moodPool, rand);
  const texture = traits.flatMap(t => t.textures)[0];

  // "The made to move in linen button down" scans badly; that cadence only
  // works with a one or two word mood.
  const shortMood = mood.split(/\s+/).length <= 2;
  const usable = CADENCE.filter(t => shortMood || !t.startsWith("The {mood}"));

  let template = pick(usable, rand);
  if (colours.length < 2) {
    template = pick(
      [...(shortMood ? ["The {mood} {garment}"] : []), "{colour} {garment}, {mood}", "{mood} in {colour}"],
      rand
    );
  }

  const filled = template
    .replace("{colour2}", colours[1] || colours[0] || "neutral")
    .replace("{colour}", colours[0] || texture || "neutral")
    .replace("{garment}", shortName(anchor))
    .replace("{mood}", mood);

  return titleCase(filled);
}

// ---------------------------------------------------------------------------
// Styling notes: actionable, derived from which slots are actually present
// ---------------------------------------------------------------------------

function stylingNotes(items: WardrobeItem[], ctx: ScoreContext, rand: Rand): string {
  const bySlot = new Map<string, WardrobeItem>();
  for (const i of items) {
    const slot = ctx.traits.get(i.id)?.slot;
    if (slot && !bySlot.has(slot)) bySlot.set(slot, i);
  }

  const clauses: string[] = [];
  const base = bySlot.get("base");
  const bottom = bySlot.get("bottom");
  const outer = bySlot.get("outer");
  const mid = bySlot.get("mid");
  const shoe = bySlot.get("shoe");
  const bag = bySlot.get("bag");
  const dress = bySlot.get("dress");

  if (base && bottom) {
    const formality = ctx.traits.get(base.id)?.formality ?? 3;
    clauses.push(
      formality >= 4
        ? pick(
            [`tuck ${phrase(base)} into ${phrase(bottom)} and keep the line clean`,
             `tuck ${phrase(base)} fully — the waist is what makes this read sharp`],
            rand
          )
        : pick(
            [`leave ${phrase(base)} loose over ${phrase(bottom)}, or half-tuck it if you want the waist`,
             `wear ${phrase(base)} untucked and let ${phrase(bottom)} do the shaping`],
            rand
          )
    );
  } else if (dress) {
    clauses.push(
      pick(
        [`let ${phrase(dress)} carry the whole silhouette`, `${phrase(dress)} ${agree(dress, "needs", "need")} nothing added at the waist`],
        rand
      )
    );
  }

  if (outer) {
    clauses.push(
      pick(
        [`leave ${phrase(outer)} open so the line underneath still reads`,
         `throw ${phrase(outer)} over the top and don't fasten it`,
         `${phrase(outer)} ${agree(outer, "is", "are")} the layer that makes this look deliberate`],
        rand
      )
    );
  } else if (mid) {
    clauses.push(
      pick(
        [`${phrase(mid)} ${agree(mid, "is", "are")} the layer to take off when it warms up`,
         `keep ${phrase(mid)} for the walk and lose it inside`],
        rand
      )
    );
  }

  if (shoe) {
    clauses.push(
      pick(
        [`${phrase(shoe)} ${agree(shoe, "anchors", "anchor")} it at the bottom`,
         `finish on ${phrase(shoe)}`,
         `${phrase(shoe)} ${agree(shoe, "keeps", "keep")} the weight low`],
        rand
      )
    );
  }
  if (bag) {
    clauses.push(
      pick(
        [`${phrase(bag)} ${agree(bag, "is", "are")} the last thing you pick up`, `carry ${phrase(bag)} with it`],
        rand
      )
    );
  }

  const chosen = clauses.slice(0, 3);
  return chosen.map(sentence).join(" ") || "Wear it as it comes; nothing here needs fussing with.";
}

// ---------------------------------------------------------------------------
// "Why this works" bullets — the audit trail behind the prose
// ---------------------------------------------------------------------------

function bulletFor(reason: Reason, ctx: ScoreContext): string {
  switch (reason.kind) {
    case "harmony":
      return `${titleCase(reason.data.harmony)} hues — ${reason.data.angle}° apart on the wheel`;
    case "neutral-ground":
      return `${Math.round(reason.data.ratio * 100)}% neutral, against a ${Math.round(ctx.guide.palette.neutralRatioTarget * 100)}% target`;
    case "accent-discipline":
      return `One accent only (60-30-10 respected)`;
    case "value-contrast":
      return `Light-to-dark spread of ${reason.data.spread}`;
    case "formality-match":
      return `Formality ${reason.data.level.toFixed(1)}, inside the ${ctx.activity.formality[0]}–${ctx.activity.formality[1]} band for ${ctx.activity.label.toLowerCase()}`;
    case "warmth-fit":
      return `Warmth ${reason.data.warmth} against a ${reason.data.wanted} seasonal target`;
    case "fabric-fit":
      return `${sentenceCase(joinList(reason.data.textures))} — preferred for ${reason.data.activity.toLowerCase()}`;
    case "aesthetic-match":
      return `Reads as ${reason.data.aesthetic} (${Math.round(reason.data.neutralRatio * 100)}% neutral)`;
    case "layering":
      return `Warmth increases outward across ${reason.data.depth} layers`;
    case "texture-contrast":
      return `Texture contrast: ${joinList(reason.data.textures)}`;
    default:
      return reason.kind;
  }
}

// ---------------------------------------------------------------------------
// Public: realise a scored outfit into an OutfitSuggestion
// ---------------------------------------------------------------------------

export function realiseOutfit(
  outfit: ScoredOutfit,
  ctx: ScoreContext,
  seed: string
): OutfitSuggestion {
  const rand = mulberry32(hashString(seed + outfit.items.map(i => i.id).join(",")));
  const floor = ctx.guide.selection.reasonStrengthFloor;
  const chosen = selectReasons(outfit.verdict.reasons, floor);

  const clauses = chosen
    .map(r => clauseFor(r, outfit.items, ctx, rand))
    .filter(Boolean) as string[];

  let description: string;
  if (!clauses.length) {
    // Honesty guard: nothing scored strongly enough to praise.
    const weakest = Object.entries(outfit.verdict.signals).sort((a, b) => a[1] - b[1])[0];
    description = sentence(
      pick(
        [
          `this one is serviceable rather than obvious — it holds together, but ${weakest[0].replace(/([A-Z])/g, " $1").toLowerCase().trim()} is the weak link`,
          `a working combination rather than a favourite; ${weakest[0].replace(/([A-Z])/g, " $1").toLowerCase().trim()} is what holds it back`,
        ],
        rand
      )
    );
  } else {
    // Aggregation: the first clause becomes the spine, the rest attach to it.
    const spine = sentence(clauses[0]);
    const rest = clauses.slice(1);
    description = rest.length
      ? `${spine} ${sentence(joinList(rest))}`
      : spine;
  }

  return {
    name: nameOutfit(outfit.items, ctx, rand),
    description,
    items: outfit.items,
    occasion: ctx.activity.label,
    aesthetic: ctx.activity.aesthetic,
    stylingNotes: stylingNotes(outfit.items, ctx, rand),
    whyItWorks: chosen.map(r => bulletFor(r, ctx)),
    score: Number(outfit.verdict.score.toFixed(3)),
  };
}

// ---------------------------------------------------------------------------
// Per-item advice, replacing the analyze-item endpoint
// ---------------------------------------------------------------------------

const PAIRING_BY_SLOT: Record<string, string[]> = {
  base: ["tucked into a mid-weight bottom", "layered under a knit with the collar out", "worn loose with denim"],
  mid: ["over a collared base with the shirt tails showing", "buttoned and tucked for a cleaner waist", "open over a plain tee"],
  outer: ["left open over a tonal base", "thrown over the shoulders for dinner", "belted if you want a waist"],
  bottom: ["with a tucked base and a low shoe", "under an untucked shirt", "with the hem rolled once"],
  dress: ["belted, with a flat shoe", "layered over a fine knit in the cold", "left plain and let the shoe do the work"],
  shoe: ["as the anchor under a lighter palette", "to bring a casual look up a level", "with a cropped hem so the ankle shows"],
  bag: ["as the one hard-wearing note in a soft outfit", "carried against neutrals", "to break up a tonal look"],
  accessory: ["as the single accent in an otherwise neutral outfit", "to add the last bit of colour", "sparingly — one is enough"],
};

export function realiseItemAdvice(
  item: WardrobeItem,
  traits: Traits,
  ctx: ScoreContext
): { aiStyleTags: string[]; aiStylingAdvice: string } {
  const rand = mulberry32(hashString(item.id + item.item));

  const tags: string[] = [];
  if (traits.textures.length) tags.push(titleCase(`${traits.textures[0]} ${traits.slot === "outer" ? "layer" : "piece"}`));
  tags.push(traits.neutral ? "Neutral Anchor" : "Accent Piece");
  if (traits.formality >= 4) tags.push("Smart Register");
  else if (traits.formality <= 2) tags.push("Easy Wear");
  else tags.push("Everyday Core");
  if (traits.warmth >= 4) tags.push("Cold Weather");
  else if (traits.warmth <= 1) tags.push("Hot Weather");

  const pairing = pick(PAIRING_BY_SLOT[traits.slot] || PAIRING_BY_SLOT.base, rand);
  const role = traits.neutral
    ? pick(["It will anchor almost anything", "This is a piece the rest can lean on", "It sits under everything else quietly"], rand)
    : pick(["Treat it as the one loud thing", "Let it be the accent and keep the rest quiet", "Build the rest of the outfit around it"], rand);

  const confidenceNote = traits.confidence < ctx.guide.selection.minConfidenceForClaims
    ? " (Guessed from a thin description — add fabric and colour detail for a better read.)"
    : "";

  return {
    aiStyleTags: tags.slice(0, 4),
    aiStylingAdvice: `${role}. Wear it ${pairing}.${confidenceNote}`,
  };
}

// ---------------------------------------------------------------------------
// Capsule summary, replacing summarize-capsule
// ---------------------------------------------------------------------------

export function realiseCapsule(
  items: WardrobeItem[],
  traits: Map<string, Traits>,
  ctx: ScoreContext,
  season: string
): { capsuleSummaryKeywords: string[]; capsuleDescription: string; notesEnrichment: { id: string; suggestedNotesAppend: string }[] } {
  const rand = mulberry32(hashString(season + items.length));
  const ts = items.map(i => traits.get(i.id)!).filter(Boolean);
  if (!ts.length) {
    return { capsuleSummaryKeywords: [], capsuleDescription: "Nothing in this capsule yet.", notesEnrichment: [] };
  }

  const textureCount = new Map<string, number>();
  for (const t of ts) for (const tex of t.textures) textureCount.set(tex, (textureCount.get(tex) || 0) + 1);
  const topTextures = [...textureCount.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);

  const neutralRatio = ts.filter(t => t.neutral).length / ts.length;
  const avgFormality = ts.reduce((a, t) => a + t.formality, 0) / ts.length;
  const avgWarmth = ts.reduce((a, t) => a + t.warmth, 0) / ts.length;

  const slotCount = new Map<string, number>();
  for (const t of ts) slotCount.set(t.slot, (slotCount.get(t.slot) || 0) + 1);
  const dominantSlot = [...slotCount.entries()].sort((a, b) => b[1] - a[1])[0];

  const keywords: string[] = [];
  if (topTextures[0]) keywords.push(titleCase(`${topTextures[0]} Led`));
  keywords.push(neutralRatio > 0.75 ? "Neutral Spine" : neutralRatio > 0.5 ? "Mostly Neutral" : "Colour Forward");
  keywords.push(avgWarmth >= 3.8 ? "Cold Weather Weight" : avgWarmth <= 2 ? "Light Layers" : "Transitional Weight");
  if (avgFormality >= 3.8) keywords.push("Smart Register");
  else if (avgFormality <= 2.2) keywords.push("Relaxed Register");

  const descriptionParts = [
    `${items.length} pieces, ${Math.round(neutralRatio * 100)}% of them neutral, built mostly on ${joinList(topTextures.slice(0, 2)) || "plain fabrics"}`,
    dominantSlot ? `${dominantSlot[0]} pieces dominate at ${dominantSlot[1]} of ${items.length}` : "",
    avgWarmth >= 3.8
      ? "the weight is genuinely cold-weather"
      : avgWarmth <= 2
        ? "it is cut for heat, with very little to layer with"
        : "it sits in transitional weight, which is where it earns its keep",
  ].filter(Boolean);

  const capsuleDescription = descriptionParts.map(sentence).join(" ");

  const notesEnrichment = items.map(item => {
    const t = traits.get(item.id);
    if (!t) return { id: item.id, suggestedNotesAppend: "" };
    const bits = [
      t.neutral ? "anchors the palette" : "carries the accent",
      t.textures[0] ? `${t.textures[0]} weight` : "",
      t.warmth >= 4 ? "cold-weather layer" : t.warmth <= 1 ? "hot-weather only" : "",
    ].filter(Boolean);
    return { id: item.id, suggestedNotesAppend: pick([bits[0], bits.slice(0, 2).join(", ")], rand) };
  }).filter(n => n.suggestedNotesAppend);

  return { capsuleSummaryKeywords: keywords.slice(0, 4), capsuleDescription, notesEnrichment };
}
