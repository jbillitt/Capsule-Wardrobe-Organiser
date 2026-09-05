/**
 * Candidate generation and selection.
 *
 * Reproducible rather than fixed: the day's seed decides which of the good
 * outfits surface, so asking twice on the same day gives the same answer and
 * tomorrow gives a different one.
 */

import { WardrobeItem } from "../types";
import { Slot } from "./lexicon";
import { ScoreContext, Verdict, scoreOutfit } from "./score";
import { SlotGroup } from "./guide";

export interface ScoredOutfit {
  items: WardrobeItem[];
  verdict: Verdict;
}

/** Cheap, well-distributed PRNG. Same seed, same sequence, every time. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** YYYY-MM-DD in local time, so the day rolls over when she does. */
export function today(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dailySeed(activity: string, capsule: string, day = today()): string {
  return `${day}|${activity}|${capsule}`;
}

function shuffled<T>(list: T[], rand: () => number): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** How many items from one slot group we are willing to branch on. */
const BRANCH_CAP = 12;

function poolFor(
  group: SlotGroup,
  items: WardrobeItem[],
  ctx: ScoreContext,
  used: Set<string>
): WardrobeItem[] {
  return items.filter(i => {
    if (used.has(i.id)) return false;
    const slot = ctx.traits.get(i.id)?.slot;
    return slot ? (group.slots as Slot[]).includes(slot) : false;
  });
}

function hasDress(partial: WardrobeItem[], ctx: ScoreContext): boolean {
  return partial.some(i => ctx.traits.get(i.id)?.slot === "dress");
}

/**
 * Beam search across the activity's slot template. Partial outfits are scored
 * with the same function as complete ones, which is approximate but keeps the
 * beam pointed at combinations that will still be good once finished.
 */
function buildCandidates(items: WardrobeItem[], ctx: ScoreContext, rand: () => number): WardrobeItem[][] {
  const beamWidth = ctx.guide.selection.beamWidth;
  let beam: WardrobeItem[][] = [[]];

  for (const group of ctx.activity.template) {
    const next: WardrobeItem[][] = [];

    for (const partial of beam) {
      if (group.skipIfDress && hasDress(partial, ctx)) {
        next.push(partial);
        continue;
      }

      const used = new Set(partial.map(i => i.id));
      const pool = shuffled(poolFor(group, items, ctx, used), rand).slice(0, BRANCH_CAP);

      if (!group.required) next.push(partial);

      if (!pool.length) {
        // Nothing in the wardrobe fills this slot. Better a three-piece outfit
        // than no suggestion at all.
        if (group.required) next.push(partial);
        continue;
      }

      for (const candidate of pool) next.push([...partial, candidate]);
    }

    // Prune. Ties are broken by the seeded shuffle above, not by array order.
    beam = next
      .map(p => ({ p, s: p.length ? scoreOutfit(p, ctx).score : 0 }))
      .sort((a, b) => b.s - a.s)
      .slice(0, beamWidth * 3)
      .map(x => x.p);
  }

  return beam.filter(p => p.length >= 2);
}

function overlap(a: WardrobeItem[], b: WardrobeItem[]): number {
  const ids = new Set(b.map(i => i.id));
  return a.filter(i => ids.has(i.id)).length;
}

/** Weighted draw without replacement; higher `bias` concentrates on top scores. */
function weightedPick(pool: ScoredOutfit[], rand: () => number, bias: number): ScoredOutfit | null {
  if (!pool.length) return null;
  const weights = pool.map(o => Math.pow(Math.max(o.verdict.score, 0.01), bias));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export interface SuggestOptions {
  count?: number;
  seed?: string;
}

export function suggestOutfits(
  items: WardrobeItem[],
  ctx: ScoreContext,
  opts: SuggestOptions = {}
): ScoredOutfit[] {
  const count = opts.count ?? 3;
  const rand = mulberry32(hashString(opts.seed || dailySeed(ctx.activity.label, "all")));

  const candidates = buildCandidates(items, ctx, rand);

  const scored: ScoredOutfit[] = [];
  const seen = new Set<string>();
  for (const combo of candidates) {
    const fingerprint = combo.map(i => i.id).sort().join("|");
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    const verdict = scoreOutfit(combo, ctx);
    if (verdict.vetoes.length) continue;
    scored.push({ items: combo, verdict });
  }

  scored.sort((a, b) => b.verdict.score - a.verdict.score);

  const poolSize = ctx.guide.selection.candidatePool;
  // The wildcard profile deliberately spreads its draw across weaker candidates.
  const bias = ctx.activity.adventurous ? 1.5 : 4;
  const pool = scored.slice(0, ctx.activity.adventurous ? poolSize * 2 : poolSize);

  const chosen: ScoredOutfit[] = [];
  const remaining = pool.slice();
  while (chosen.length < count && remaining.length) {
    const pick = weightedPick(remaining, rand, bias);
    if (!pick) break;
    remaining.splice(remaining.indexOf(pick), 1);
    const clashes = chosen.some(
      c => overlap(c.items, pick.items) > ctx.guide.selection.maxSharedItems
    );
    if (!clashes) chosen.push(pick);
  }

  // A small wardrobe can starve the distinctness rule. Relax the tolerance one
  // step at a time rather than dropping it, so we never show three suggestions
  // that differ only by a handbag while a genuinely different one was available.
  for (
    let tolerance = ctx.guide.selection.maxSharedItems + 1;
    chosen.length < count && tolerance <= 8;
    tolerance++
  ) {
    for (const rest of scored) {
      if (chosen.length >= count) break;
      if (chosen.includes(rest)) continue;
      if (chosen.some(c => overlap(c.items, rest.items) > tolerance)) continue;
      chosen.push(rest);
    }
  }

  return chosen.slice(0, count);
}

/** Exposed for the "no outfit possible" path so the UI can say why. */
export function diagnose(items: WardrobeItem[], ctx: ScoreContext): string[] {
  const problems: string[] = [];
  for (const group of ctx.activity.template) {
    if (!group.required) continue;
    const pool = poolFor(group, items, ctx, new Set());
    if (!pool.length) problems.push(`nothing in this capsule fills the ${group.slots.join("/")} slot`);
  }
  if (items.length < 2) problems.push("fewer than two garments are in the active capsule");
  return problems;
}
