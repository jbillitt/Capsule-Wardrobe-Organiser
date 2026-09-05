/**
 * Wardrobe persistence.
 *
 * The wardrobe lives in localStorage and NOT in this repo, so it is the only
 * copy of work that took hours to enter. Everything here is built around one
 * rule: never destroy data we failed to understand.
 *
 * The previous version did `catch { setWardrobe(initialCuratedWardrobe) }`,
 * and the save effect then wrote those ten seed items straight over the real
 * wardrobe. A single bad read was enough to lose the lot, silently.
 */

import { WardrobeItem, OutfitSuggestion } from "./types";

export const WARDROBE_KEY = "capsule_closet_wardrobe";
export const OUTFITS_KEY = "capsule_closet_outfits";
const QUARANTINE_PREFIX = "capsule_closet_wardrobe.unreadable.";

export type LoadStatus = "loaded" | "empty" | "unreadable" | "unavailable";

export interface LoadResult<T> {
  status: LoadStatus;
  items: T[];
  /** Human-readable explanation, always safe to show the user. */
  message: string;
  bytes: number;
  /** Set when the stored value could not be used; the raw text is preserved. */
  quarantineKey?: string;
}

function storageAvailable(): boolean {
  try {
    const probe = "__capsule_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function byteLength(text: string): number {
  return new Blob([text]).size;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Read a stored array. A value that exists but cannot be parsed is copied to a
 * quarantine key and reported - never discarded, and never silently replaced.
 */
export function loadList<T>(key: string): LoadResult<T> {
  if (!storageAvailable()) {
    return {
      status: "unavailable",
      items: [],
      message:
        "This browser is blocking local storage (private window, or site data disabled). Nothing can be loaded or saved.",
      bytes: 0,
    };
  }

  const raw = localStorage.getItem(key);
  if (raw === null) {
    return { status: "empty", items: [], message: `No saved data under "${key}" in this browser.`, bytes: 0 };
  }

  const bytes = byteLength(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: any) {
    const quarantineKey = `${QUARANTINE_PREFIX}${Date.now()}`;
    try {
      localStorage.setItem(quarantineKey, raw);
    } catch {
      // Quarantine is best effort; the original key is left untouched either way.
    }
    return {
      status: "unreadable",
      items: [],
      message: `Saved data under "${key}" is ${formatBytes(bytes)} but could not be parsed (${err.message}). It has been left in place and copied to "${quarantineKey}". Nothing was overwritten.`,
      bytes,
      quarantineKey,
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      status: "unreadable",
      items: [],
      message: `Saved data under "${key}" is ${typeof parsed}, not a list. It has been left in place, untouched.`,
      bytes,
    };
  }

  return {
    status: "loaded",
    items: parsed as T[],
    message: `Loaded ${parsed.length} item${parsed.length === 1 ? "" : "s"} (${formatBytes(bytes)}).`,
    bytes,
  };
}

export interface SaveResult {
  ok: boolean;
  message: string;
  bytes: number;
}

export function saveList<T>(key: string, items: T[]): SaveResult {
  const text = JSON.stringify(items);
  const bytes = byteLength(text);
  try {
    localStorage.setItem(key, text);
    return { ok: true, message: `Saved ${items.length} items (${formatBytes(bytes)}).`, bytes };
  } catch (err: any) {
    // Almost always the ~5 MB quota, and base64 photos eat it fast.
    const quota = /quota|exceeded|full/i.test(err?.name + err?.message);
    return {
      ok: false,
      bytes,
      message: quota
        ? `Could not save: this wardrobe is ${formatBytes(bytes)} and the browser's storage limit (usually about 5 MB) is full. Photos stored as data are the usual cause. Nothing already saved has been lost, but new changes are not being kept - export a backup now.`
        : `Could not save: ${err?.name || "error"} - ${err?.message || String(err)}`,
    };
  }
}

/**
 * Anything in this browser that looks like it might be a wardrobe. Used by the
 * diagnostics panel: if data was entered against a different port or profile it
 * will not be here, and knowing that is the answer.
 */
export function findCandidateKeys(): { key: string; bytes: number; looksLikeWardrobe: boolean; count: number | null }[] {
  if (!storageAvailable()) return [];
  const out: { key: string; bytes: number; looksLikeWardrobe: boolean; count: number | null }[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const raw = localStorage.getItem(key) || "";
    let count: number | null = null;
    let looksLikeWardrobe = false;
    try {
      const value = JSON.parse(raw);
      if (Array.isArray(value)) {
        count = value.length;
        looksLikeWardrobe = value.length > 0 && typeof value[0] === "object" && value[0] !== null && "item" in value[0];
      }
    } catch {
      // Not JSON; still worth listing its size.
    }
    out.push({ key, bytes: byteLength(raw), looksLikeWardrobe, count });
  }

  return out.sort((a, b) => b.bytes - a.bytes);
}

export interface Diagnostics {
  generatedAt: string;
  origin: string;
  userAgent: string;
  storageAvailable: boolean;
  totalBytes: number;
  wardrobe: { status: LoadStatus; count: number; bytes: number; message: string };
  outfits: { status: LoadStatus; count: number; bytes: number };
  seasons: Record<string, number>;
  statuses: Record<string, number>;
  categories: Record<string, number>;
  withImages: number;
  keys: { key: string; bytes: number; looksLikeWardrobe: boolean; count: number | null }[];
  events: string[];
}

/** Rolling log of anything notable that happened this session. */
const eventLog: string[] = [];

export function logEvent(message: string): void {
  const line = `${new Date().toISOString()}  ${message}`;
  eventLog.push(line);
  if (eventLog.length > 100) eventLog.shift();
  // Mirrored to the console so it survives even if the panel is never opened.
  console.info(`[capsule-storage] ${message}`);
}

export function getEvents(): string[] {
  return [...eventLog];
}

export function buildDiagnostics(wardrobe: WardrobeItem[], outfits: OutfitSuggestion[]): Diagnostics {
  const wardrobeRead = loadList<WardrobeItem>(WARDROBE_KEY);
  const outfitsRead = loadList<OutfitSuggestion>(OUTFITS_KEY);
  const keys = findCandidateKeys();

  const tally = (get: (i: WardrobeItem) => string | undefined) =>
    wardrobe.reduce<Record<string, number>>((acc, item) => {
      const value = get(item) || "(unset)";
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});

  return {
    generatedAt: new Date().toISOString(),
    origin: typeof location === "undefined" ? "unknown" : location.origin,
    userAgent: typeof navigator === "undefined" ? "unknown" : navigator.userAgent,
    storageAvailable: storageAvailable(),
    totalBytes: keys.reduce((sum, k) => sum + k.bytes, 0),
    wardrobe: {
      status: wardrobeRead.status,
      count: wardrobe.length,
      bytes: wardrobeRead.bytes,
      message: wardrobeRead.message,
    },
    outfits: { status: outfitsRead.status, count: outfits.length, bytes: outfitsRead.bytes },
    seasons: tally(i => i.season),
    statuses: tally(i => i.status),
    categories: tally(i => i.aiSuggestedCategory),
    withImages: wardrobe.filter(i => i.imageUrl).length,
    keys,
    events: getEvents(),
  };
}

/** A plain-text report that can be pasted into a message. */
export function formatDiagnostics(d: Diagnostics): string {
  const table = (label: string, record: Record<string, number>) =>
    `${label}:\n` +
    (Object.keys(record).length
      ? Object.entries(record)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `  ${v.toString().padStart(5)}  ${k}`)
          .join("\n")
      : "  (none)");

  return [
    `Capsule Wardrobe diagnostics`,
    `generated:  ${d.generatedAt}`,
    `origin:     ${d.origin}`,
    `browser:    ${d.userAgent}`,
    `storage:    ${d.storageAvailable ? "available" : "BLOCKED"}, ${formatBytes(d.totalBytes)} used by this site`,
    ``,
    `wardrobe:   ${d.wardrobe.status} - ${d.wardrobe.count} items in view, ${formatBytes(d.wardrobe.bytes)} stored`,
    `            ${d.wardrobe.message}`,
    `outfits:    ${d.outfits.status} - ${d.outfits.count} saved`,
    `images:     ${d.withImages} of ${d.wardrobe.count} items have a picture`,
    ``,
    table("seasons", d.seasons),
    ``,
    table("status", d.statuses),
    ``,
    table("category", d.categories),
    ``,
    `storage keys on this origin:`,
    ...(d.keys.length
      ? d.keys.map(
          k =>
            `  ${formatBytes(k.bytes).padStart(10)}  ${k.key}${k.looksLikeWardrobe ? `  <- looks like a wardrobe (${k.count} items)` : k.count !== null ? `  (${k.count} entries)` : ""}`
        )
      : ["  (none)"]),
    ``,
    `events this session:`,
    ...(d.events.length ? d.events.map(e => `  ${e}`) : ["  (none)"]),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Backups. localStorage is per browser, per profile and per origin, so this is
// the only way to move a wardrobe between machines - including the photos,
// which the CSV export cannot carry.
// ---------------------------------------------------------------------------

export interface Backup {
  format: "capsule-wardrobe-backup";
  version: 1;
  exportedAt: string;
  wardrobe: WardrobeItem[];
  outfits: OutfitSuggestion[];
}

export function buildBackup(wardrobe: WardrobeItem[], outfits: OutfitSuggestion[]): Backup {
  return {
    format: "capsule-wardrobe-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    wardrobe,
    outfits,
  };
}

export interface RestoreResult {
  ok: boolean;
  message: string;
  wardrobe?: WardrobeItem[];
  outfits?: OutfitSuggestion[];
}

export function parseBackup(text: string): RestoreResult {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (err: any) {
    return { ok: false, message: `That file is not valid JSON (${err.message}).` };
  }

  // Accept a bare array too: that is what the raw localStorage value looks like,
  // so a wardrobe rescued by hand from another browser can be pasted straight in.
  if (Array.isArray(parsed)) {
    if (!parsed.every(i => i && typeof i === "object" && "item" in i)) {
      return { ok: false, message: "That list does not look like wardrobe items." };
    }
    return { ok: true, message: `Restored ${parsed.length} garments from a raw item list.`, wardrobe: parsed, outfits: [] };
  }

  if (parsed?.format !== "capsule-wardrobe-backup" || !Array.isArray(parsed.wardrobe)) {
    return { ok: false, message: "That file is not a Capsule Wardrobe backup." };
  }

  return {
    ok: true,
    message: `Restored ${parsed.wardrobe.length} garments and ${parsed.outfits?.length || 0} saved outfits from a backup taken ${parsed.exportedAt}.`,
    wardrobe: parsed.wardrobe,
    outfits: Array.isArray(parsed.outfits) ? parsed.outfits : [],
  };
}
