/**
 * Six weighted signals, shaped after the Loom outfit scorer (arXiv 2605.09830)
 * but computed with hue arithmetic and keyword lexicons rather than embeddings.
 *
 * Every signal emits typed Reasons. The prose engine reads only those, so the
 * text an outfit gets is always generated from why it actually scored well.
 */

import { WardrobeItem } from "../types";
import { Traits, Slot } from "./lexicon";
import { harmony, HarmonyKind } from "./colour";
import {
  StyleGuide,
  ActivityProfile,
  AestheticProfile,
  SeasonTarget,
  resolveActivity,
  seasonTarget,
  aestheticFor,
} from "./guide";

export type ReasonKind =
  | "harmony"
  | "neutral-ground"
  | "accent-discipline"
  | "value-contrast"
  | "formality-match"
  | "warmth-fit"
  | "fabric-fit"
  | "aesthetic-match"
  | "layering"
  | "texture-contrast";

export interface Reason {
  kind: ReasonKind;
  /** 0..1 — how strongly this justifies the outfit. Drives content selection. */
  strength: number;
  itemIds: string[];
  data: Record<string, any>;
}

export interface Verdict {
  score: number;
  reasons: Reason[];
  /** Hard failures. A vetoed outfit is never shown, whatever it scores. */
  vetoes: string[];
  signals: Record<string, number>;
}

export interface ScoreContext {
  guide: StyleGuide;
  activity: ActivityProfile;
  aesthetic: AestheticProfile;
  target: SeasonTarget;
  traits: Map<string, Traits>;
  keyOf: (item: WardrobeItem) => string;
}

export function keyOf(item: WardrobeItem): string {
  return item.masterId || item.id;
}

export function buildContext(
  guide: StyleGuide,
  traits: Map<string, Traits>,
  activityLabel: string | undefined,
  season: string | undefined
): ScoreContext {
  const activity = resolveActivity(guide, activityLabel);
  return {
    guide,
    activity,
    aesthetic: aestheticFor(guide, activity.aesthetic),
    target: seasonTarget(guide, season),
    traits,
    keyOf,
  };
}

/**
 * Learned corrections that nudge a garment's derived traits, applied once up
 * front so every signal sees the corrected values.
 */
export function applyTraitRules(traits: Map<string, Traits>, items: WardrobeItem[], guide: StyleGuide): void {
  for (const item of items) {
    const t = traits.get(item.id);
    if (!t) continue;
    const key = keyOf(item);
    for (const rule of guide.rules) {
      if (rule.key !== key) continue;
      if (rule.kind === "formality-adjust") t.formality = clamp(t.formality + (rule.delta || 0), 1, 5);
      if (rule.kind === "warmth-adjust") t.warmth = clamp(t.warmth + (rule.delta || 0), 1, 5);
    }
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const mean = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0);

function searchText(item: WardrobeItem): string {
  return [item.item, item.description, item.notes, item.color].filter(Boolean).join(" ").toLowerCase();
}

// ---------------------------------------------------------------------------
// Signal 1: colour harmony
// ---------------------------------------------------------------------------

function signalColour(items: WardrobeItem[], ctx: ScoreContext): { score: number; reasons: Reason[] } {
  const ts = items.map(i => ctx.traits.get(i.id)!).filter(Boolean);
  if (ts.length < 2) return { score: 0.6, reasons: [] };

  const reasons: Reason[] = [];
  const pairScores: number[] = [];
  let bestPair: { score: number; kind: HarmonyKind; angle: number; ids: string[]; contrast: number } | null = null;

  for (let i = 0; i < ts.length; i++) {
    for (let j = i + 1; j < ts.length; j++) {
      const h = harmony(ts[i].hsl, ts[j].hsl);
      pairScores.push(h.score);
      const informative = h.kind !== "neutral-ground";
      if (informative && (!bestPair || h.score > bestPair.score)) {
        bestPair = { score: h.score, kind: h.kind, angle: h.angle, ids: [ts[i].id, ts[j].id], contrast: h.valueContrast };
      }
    }
  }

  let score = mean(pairScores);

  // 60-30-10: more than one accent competing for attention flattens the look.
  const accents = ts.filter(t => t.role === "accent").length;
  if (accents > ctx.guide.palette.maxAccents) {
    score *= Math.max(0.45, 1 - 0.28 * (accents - ctx.guide.palette.maxAccents));
  } else if (accents === ctx.guide.palette.maxAccents && ts.length >= 3) {
    reasons.push({
      kind: "accent-discipline",
      strength: 0.72,
      itemIds: ts.filter(t => t.role === "accent").map(t => t.id),
      data: { accents },
    });
  }

  if (bestPair && bestPair.score > 0.6) {
    reasons.push({
      kind: "harmony",
      strength: bestPair.score,
      itemIds: bestPair.ids,
      data: { harmony: bestPair.kind, angle: Math.round(bestPair.angle) },
    });
  }

  // A wholly neutral outfit needs lightness separation or it reads as sludge.
  const lightnesses = ts.map(t => t.hsl.l);
  const spread = Math.max(...lightnesses) - Math.min(...lightnesses);
  if (accents === 0 && spread > 0.3) {
    reasons.push({
      kind: "value-contrast",
      strength: 0.6 + Math.min(0.25, spread - 0.3),
      itemIds: ts.map(t => t.id),
      data: { spread: Number(spread.toFixed(2)) },
    });
  } else if (accents === 0 && spread < 0.12) {
    score *= 0.75;
  }

  const neutralRatio = ts.filter(t => t.neutral).length / ts.length;
  if (neutralRatio >= ctx.guide.palette.neutralRatioTarget && accents <= ctx.guide.palette.maxAccents) {
    reasons.push({
      kind: "neutral-ground",
      strength: 0.62,
      itemIds: ts.filter(t => t.neutral).map(t => t.id),
      data: { ratio: Number(neutralRatio.toFixed(2)) },
    });
  }

  return { score: clamp(score, 0, 1), reasons };
}

// ---------------------------------------------------------------------------
// Signal 2: formality coherence
// ---------------------------------------------------------------------------

function signalFormality(items: WardrobeItem[], ctx: ScoreContext): { score: number; reasons: Reason[]; vetoes: string[] } {
  const ts = items.map(i => ctx.traits.get(i.id)!).filter(Boolean);
  if (!ts.length) return { score: 0, reasons: [], vetoes: [] };

  const values = ts.map(t => t.formality);
  const spread = Math.max(...values) - Math.min(...values);
  const avg = mean(values);
  const [lo, hi] = ctx.activity.formality;

  const spreadScore = spread <= 1 ? 1 : spread === 2 ? 0.7 : spread === 3 ? 0.35 : 0.15;
  const bandMiss = avg < lo ? lo - avg : avg > hi ? avg - hi : 0;
  const bandScore = Math.max(0, 1 - bandMiss / 1.5);

  const vetoes: string[] = [];
  if (bandMiss > 1.25) {
    vetoes.push(
      `Formality ${avg.toFixed(1)} sits outside the ${lo}-${hi} band for ${ctx.activity.label}`
    );
  }

  const reasons: Reason[] = [];
  const score = spreadScore * 0.5 + bandScore * 0.5;
  if (spread <= 1 && bandMiss === 0) {
    reasons.push({
      kind: "formality-match",
      strength: 0.78,
      itemIds: ts.map(t => t.id),
      data: { level: avg, activity: ctx.activity.label, spread },
    });
  }

  return { score, reasons, vetoes };
}

// ---------------------------------------------------------------------------
// Signal 3: occasion fit
// ---------------------------------------------------------------------------

function signalOccasion(items: WardrobeItem[], ctx: ScoreContext): { score: number; reasons: Reason[]; vetoes: string[] } {
  const vetoes: string[] = [];
  const reasons: Reason[] = [];

  for (const item of items) {
    const text = searchText(item);
    const hit = ctx.activity.ban.find(word => text.includes(word.toLowerCase()));
    if (hit) vetoes.push(`"${item.item}" is ruled out for ${ctx.activity.label} (${hit})`);
  }

  if (ctx.activity.requireOneOf?.length) {
    const slots = new Set(items.map(i => ctx.traits.get(i.id)?.slot).filter(Boolean) as Slot[]);
    if (!ctx.activity.requireOneOf.some(s => slots.has(s))) {
      vetoes.push(`${ctx.activity.label} needs one of: ${ctx.activity.requireOneOf.join(", ")}`);
    }
  }

  // Learned bans from the correction form.
  for (const item of items) {
    const key = ctx.keyOf(item);
    for (const rule of ctx.guide.rules) {
      if (rule.kind === "occasion-ban" && rule.key === key && rule.activity === ctx.activity.label) {
        vetoes.push(`You told me "${item.item}" doesn't work for ${ctx.activity.label}`);
      }
      if (rule.kind === "slot-dislike" && rule.key === key && rule.slot === ctx.traits.get(item.id)?.slot) {
        vetoes.push(`You told me "${item.item}" doesn't work in that role`);
      }
      if (rule.kind === "pair-ban" && rule.key === key) {
        const partner = items.find(o => ctx.keyOf(o) === rule.otherKey);
        if (partner) vetoes.push(`You told me "${item.item}" and "${partner.item}" don't go together`);
      }
    }
  }

  const ts = items.map(i => ctx.traits.get(i.id)!).filter(Boolean);
  const wanted = ctx.target.warmthTarget + ctx.activity.warmthShift;
  const avgWarmth = mean(ts.map(t => t.warmth));
  const drift = Math.abs(avgWarmth - wanted);
  const warmthScore = Math.max(0, 1 - drift / (ctx.target.tolerance * 2));

  if (drift <= ctx.target.tolerance * 0.6) {
    reasons.push({
      kind: "warmth-fit",
      strength: 0.7,
      itemIds: ts.map(t => t.id),
      data: { warmth: Number(avgWarmth.toFixed(1)), wanted: Number(wanted.toFixed(1)) },
    });
  }

  const preferred = ctx.activity.prefer.length
    ? ts.filter(t => t.textures.some(tex => ctx.activity.prefer.includes(tex)))
    : [];
  if (preferred.length) {
    reasons.push({
      kind: "fabric-fit",
      strength: 0.6 + Math.min(0.3, preferred.length * 0.12),
      itemIds: preferred.map(t => t.id),
      data: {
        textures: Array.from(new Set(preferred.flatMap(t => t.textures.filter(x => ctx.activity.prefer.includes(x))))),
        activity: ctx.activity.label,
      },
    });
  }

  const preferBonus = ctx.activity.prefer.length ? Math.min(0.2, preferred.length * 0.08) : 0;
  return { score: clamp(warmthScore + preferBonus, 0, 1), reasons, vetoes };
}

// ---------------------------------------------------------------------------
// Signal 4: style direction
// ---------------------------------------------------------------------------

function signalDirection(items: WardrobeItem[], ctx: ScoreContext): { score: number; reasons: Reason[] } {
  const ts = items.map(i => ctx.traits.get(i.id)!).filter(Boolean);
  if (!ts.length) return { score: 0, reasons: [] };

  const neutralRatio = ts.filter(t => t.neutral).length / ts.length;
  const ratioScore = clamp(1 - Math.max(0, ctx.aesthetic.neutralRatio - neutralRatio) * 1.6, 0, 1);

  const distinctHues = new Set(
    ts.filter(t => !t.neutral).map(t => Math.round(t.hsl.h / 30))
  ).size;
  const coloursUsed = distinctHues + (neutralRatio > 0 ? 1 : 0);
  const colourScore = coloursUsed <= ctx.aesthetic.maxColours ? 1 : Math.max(0.3, 1 - (coloursUsed - ctx.aesthetic.maxColours) * 0.3);

  const textureHits = ts.flatMap(t => t.textures).filter(tex => ctx.aesthetic.textures.includes(tex));
  const textureScore = clamp(0.5 + textureHits.length * 0.15, 0, 1);

  const tagHits = items.flatMap(i => i.aiStyleTags || []);
  const tagScore = tagHits.length ? 0.7 : 0.5;

  const score = ratioScore * 0.4 + colourScore * 0.25 + textureScore * 0.25 + tagScore * 0.1;

  const reasons: Reason[] = [];
  if (ratioScore > 0.85 && colourScore === 1) {
    reasons.push({
      kind: "aesthetic-match",
      strength: 0.66 + Math.min(0.2, textureHits.length * 0.07),
      itemIds: ts.map(t => t.id),
      data: {
        aesthetic: ctx.activity.aesthetic,
        neutralRatio: Number(neutralRatio.toFixed(2)),
        textures: Array.from(new Set(textureHits)),
      },
    });
  }

  return { score: clamp(score, 0, 1), reasons };
}

// ---------------------------------------------------------------------------
// Signal 5: layer weight
// ---------------------------------------------------------------------------

const LAYER_RANK: Partial<Record<Slot, number>> = { base: 0, mid: 1, outer: 2 };

function signalLayers(items: WardrobeItem[], ctx: ScoreContext): { score: number; reasons: Reason[] } {
  const layers = items
    .map(i => ctx.traits.get(i.id)!)
    .filter(t => t && LAYER_RANK[t.slot] !== undefined)
    .sort((a, b) => LAYER_RANK[a.slot]! - LAYER_RANK[b.slot]!);

  if (layers.length < 2) return { score: 0.75, reasons: [] };

  let violations = 0;
  for (let i = 1; i < layers.length; i++) {
    // An outer layer lighter than what it covers is a styling error, not a choice.
    if (layers[i].warmth < layers[i - 1].warmth) violations++;
  }

  const score = violations === 0 ? 1 : Math.max(0.2, 1 - violations * 0.45);
  const reasons: Reason[] = [];
  if (violations === 0 && layers.length >= 2) {
    reasons.push({
      kind: "layering",
      strength: 0.68 + (layers.length >= 3 ? 0.1 : 0),
      itemIds: layers.map(l => l.id),
      data: { depth: layers.length, order: layers.map(l => l.slot) },
    });
  }

  return { score, reasons };
}

// ---------------------------------------------------------------------------
// Signal 6: within-outfit diversity
// ---------------------------------------------------------------------------

function signalDiversity(items: WardrobeItem[], ctx: ScoreContext): { score: number; reasons: Reason[] } {
  const ts = items.map(i => ctx.traits.get(i.id)!).filter(Boolean);
  if (ts.length < 2) return { score: 0.6, reasons: [] };

  let score = 1;

  // Two garments doing the same job.
  const counts = new Map<Slot, number>();
  for (const t of ts) counts.set(t.slot, (counts.get(t.slot) || 0) + 1);
  for (const [slot, n] of counts) {
    if (n > 1 && slot !== "accessory") score -= 0.25 * (n - 1);
  }

  const textures = new Set(ts.flatMap(t => t.textures));
  const reasons: Reason[] = [];
  if (textures.size >= 2) {
    reasons.push({
      kind: "texture-contrast",
      strength: 0.58 + Math.min(0.22, (textures.size - 2) * 0.08),
      itemIds: ts.filter(t => t.textures.length).map(t => t.id),
      data: { textures: Array.from(textures) },
    });
  } else if (textures.size === 0) {
    score -= 0.1;
  }

  return { score: clamp(score, 0, 1), reasons };
}

// ---------------------------------------------------------------------------

export function scoreOutfit(items: WardrobeItem[], ctx: ScoreContext): Verdict {
  const colour = signalColour(items, ctx);
  const formality = signalFormality(items, ctx);
  const occasion = signalOccasion(items, ctx);
  const direction = signalDirection(items, ctx);
  const layers = signalLayers(items, ctx);
  const diversity = signalDiversity(items, ctx);

  const w = ctx.guide.weights;
  const signals = {
    colourHarmony: colour.score,
    formality: formality.score,
    occasion: occasion.score,
    styleDirection: direction.score,
    layerWeight: layers.score,
    diversity: diversity.score,
  };

  let total = 0;
  let weightSum = 0;
  for (const [name, value] of Object.entries(signals)) {
    const weight = w[name] ?? 1;
    total += value * weight;
    weightSum += weight;
  }

  // Low-confidence traits shouldn't produce confident scores.
  const confidence = mean(items.map(i => ctx.traits.get(i.id)?.confidence ?? 0.3));
  const score = (total / (weightSum || 1)) * (0.75 + 0.25 * confidence);

  const reasons = [
    ...colour.reasons,
    ...formality.reasons,
    ...occasion.reasons,
    ...direction.reasons,
    ...layers.reasons,
    ...diversity.reasons,
  ].sort((a, b) => b.strength - a.strength);

  return {
    score,
    reasons,
    vetoes: [...formality.vetoes, ...occasion.vetoes],
    signals,
  };
}
