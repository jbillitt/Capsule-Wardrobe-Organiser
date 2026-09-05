/**
 * Everything the engine persists: the style guide, the learned corrections and
 * the cached retail catalogue. Kept apart from the rest of the engine so the
 * scoring modules stay pure and portable.
 */

import fs from "node:fs";
import path from "node:path";
import { StyleGuide, StyleRule, RuleKind } from "./guide";
import { CatalogueEntry } from "./catalogue";
import { Slot } from "./lexicon";

const root = process.cwd();
const GUIDE_PATH = path.join(root, "style-guide.json");
const SEED_PATH = path.join(root, "catalogue.seed.json");
const LOCAL_PATH = path.join(root, "catalogue.local.json");
const MEMORIES_PATH = path.join(root, "memories.md");

const MEMORIES_HEADER =
  "# Styling correction log\n\nEvery correction logged in the app, in the order it was made. The engine reads the structured rules in style-guide.json; this file is the human-readable record of why they exist.\n";

export function loadGuide(): StyleGuide {
  const raw = fs.readFileSync(GUIDE_PATH, "utf-8");
  return JSON.parse(raw) as StyleGuide;
}

export function saveGuide(guide: StyleGuide): void {
  fs.writeFileSync(GUIDE_PATH, JSON.stringify(guide, null, 2) + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// Corrections
// ---------------------------------------------------------------------------

export interface CorrectionInput {
  kind: RuleKind;
  /** masterId ?? id of the garment the correction is about. */
  key: string;
  label?: string;
  otherKey?: string;
  otherLabel?: string;
  activity?: string;
  slot?: Slot;
  delta?: number;
  note?: string;
  outfitName?: string;
}

const HUMAN: Record<RuleKind, (c: CorrectionInput) => string> = {
  "pair-ban": c => `Never pair **${c.label}** with **${c.otherLabel}**.`,
  "occasion-ban": c => `Never use **${c.label}** for *${c.activity}*.`,
  "formality-adjust": c =>
    `**${c.label}** is ${(c.delta || 0) < 0 ? "more casual" : "dressier"} than it reads; formality shifted by ${c.delta}.`,
  "warmth-adjust": c =>
    `**${c.label}** is ${(c.delta || 0) < 0 ? "cooler" : "warmer"} than it reads; warmth shifted by ${c.delta}.`,
  "slot-dislike": c => `Don't use **${c.label}** as the ${c.slot}.`,
};

export function addCorrection(input: CorrectionInput): StyleRule {
  const guide = loadGuide();

  const rule: StyleRule = {
    id: `r-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
    kind: input.kind,
    key: input.key,
    otherKey: input.otherKey,
    activity: input.activity,
    slot: input.slot,
    delta: input.delta,
    note: input.note,
    label: input.label,
    createdAt: new Date().toISOString(),
  };

  // A newer correction of the same shape replaces the older one rather than
  // stacking another adjustment on top of it.
  guide.rules = guide.rules.filter(
    r =>
      !(
        r.kind === rule.kind &&
        r.key === rule.key &&
        r.otherKey === rule.otherKey &&
        r.activity === rule.activity &&
        r.slot === rule.slot
      )
  );
  guide.rules.push(rule);
  saveGuide(guide);

  appendMemory(
    [
      `### ${input.outfitName || "Correction"} — ${new Date().toLocaleString("en-NZ")}`,
      `- ${HUMAN[input.kind](input)}`,
      input.note ? `- Note: ${input.note}` : "",
      `- Rule id: \`${rule.id}\``,
      "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  return rule;
}

export function listRules(): StyleRule[] {
  return loadGuide().rules;
}

export function deleteRule(id: string): boolean {
  const guide = loadGuide();
  const before = guide.rules.length;
  guide.rules = guide.rules.filter(r => r.id !== id);
  if (guide.rules.length === before) return false;
  saveGuide(guide);
  return true;
}

export function clearRules(): void {
  const guide = loadGuide();
  guide.rules = [];
  saveGuide(guide);
  fs.writeFileSync(MEMORIES_PATH, MEMORIES_HEADER, "utf-8");
}

// ---------------------------------------------------------------------------
// The human-readable audit log
// ---------------------------------------------------------------------------

export function readMemories(): string {
  if (!fs.existsSync(MEMORIES_PATH)) fs.writeFileSync(MEMORIES_PATH, MEMORIES_HEADER, "utf-8");
  return fs.readFileSync(MEMORIES_PATH, "utf-8");
}

export function appendMemory(entry: string): void {
  if (!fs.existsSync(MEMORIES_PATH)) fs.writeFileSync(MEMORIES_PATH, MEMORIES_HEADER, "utf-8");
  fs.appendFileSync(MEMORIES_PATH, "\n" + entry, "utf-8");
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

function readEntries(file: string): CatalogueEntry[] {
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    return (parsed.entries || []) as CatalogueEntry[];
  } catch {
    return [];
  }
}

/** Seed staples first, then whatever the last retail refresh cached. */
export function loadCatalogue(): CatalogueEntry[] {
  const seed = readEntries(SEED_PATH).map(e => ({ ...e, source: e.source || "seed" }));
  const local = readEntries(LOCAL_PATH);
  const seen = new Set(seed.map(e => e.id));
  return [...seed, ...local.filter(e => !seen.has(e.id))];
}

export function saveLocalCatalogue(entries: CatalogueEntry[]): void {
  fs.writeFileSync(
    LOCAL_PATH,
    JSON.stringify({ version: 1, fetchedAt: new Date().toISOString(), entries }, null, 2) + "\n",
    "utf-8"
  );
}

export function localCatalogueInfo(): { count: number; fetchedAt: string | null } {
  if (!fs.existsSync(LOCAL_PATH)) return { count: 0, fetchedAt: null };
  try {
    const parsed = JSON.parse(fs.readFileSync(LOCAL_PATH, "utf-8"));
    return { count: (parsed.entries || []).length, fetchedAt: parsed.fetchedAt || null };
  } catch {
    return { count: 0, fetchedAt: null };
  }
}
