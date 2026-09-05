/**
 * Shape of style-guide.json plus the pure lookups over it.
 * File I/O lives in rules.ts so this module stays runnable in a browser.
 */

import { Slot } from "./lexicon";

export interface SlotGroup {
  slots: Slot[];
  required: boolean;
  /** A dress fills the core slot, so the bottom becomes unnecessary. */
  skipIfDress?: boolean;
}

export interface ActivityProfile {
  match?: string;
  label: string;
  formality: [number, number];
  aesthetic: string;
  warmthShift: number;
  ban: string[];
  prefer: string[];
  requireOneOf?: Slot[];
  voice: string[];
  adventurous?: boolean;
  template: SlotGroup[];
}

export interface AestheticProfile {
  neutralRatio: number;
  maxColours: number;
  formality: [number, number];
  textures: string[];
  voice: string[];
}

export type RuleKind =
  | "pair-ban"
  | "occasion-ban"
  | "formality-adjust"
  | "warmth-adjust"
  | "slot-dislike";

export interface StyleRule {
  id: string;
  kind: RuleKind;
  /** masterId ?? id, so a rule survives the same garment across season capsules. */
  key: string;
  /** Second garment key, for pair-ban. */
  otherKey?: string;
  /** Activity label the ban applies to, for occasion-ban. */
  activity?: string;
  slot?: Slot;
  delta?: number;
  note?: string;
  label?: string;
  createdAt: string;
}

export interface SeasonTarget {
  warmthTarget: number;
  tolerance: number;
}

export interface StyleGuide {
  version: number;
  palette: { anchors: string[]; maxAccents: number; neutralRatioTarget: number };
  weights: Record<string, number>;
  selection: {
    beamWidth: number;
    candidatePool: number;
    maxSharedItems: number;
    reasonStrengthFloor: number;
    minConfidenceForClaims: number;
  };
  seasons: Record<string, SeasonTarget>;
  aesthetics: Record<string, AestheticProfile>;
  activities: ActivityProfile[];
  defaultActivity: ActivityProfile;
  retailSources: { id: string; label: string; adapter: string; url: string; enabled: boolean }[];
  rules: StyleRule[];
}

/**
 * Activities are free text in the UI - she can add her own - so profiles are
 * matched by keyword rather than looked up by exact name.
 */
export function resolveActivity(guide: StyleGuide, activity: string | undefined): ActivityProfile {
  const raw = (activity || "").toLowerCase();
  if (raw) {
    for (const profile of guide.activities) {
      if (profile.match && new RegExp(profile.match).test(raw)) return profile;
    }
  }
  return guide.defaultActivity;
}

export function seasonTarget(guide: StyleGuide, season: string | undefined): SeasonTarget {
  return guide.seasons[season || ""] || guide.seasons.default;
}

export function aestheticFor(guide: StyleGuide, name: string): AestheticProfile {
  return guide.aesthetics[name] || guide.aesthetics["Elevated Casual"];
}

/** Rules that apply to a given garment key. */
export function rulesFor(guide: StyleGuide, key: string): StyleRule[] {
  return guide.rules.filter(r => r.key === key || r.otherKey === key);
}
