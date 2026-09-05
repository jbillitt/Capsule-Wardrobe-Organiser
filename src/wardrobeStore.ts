/**
 * Server-side wardrobe storage.
 *
 * The wardrobe used to live only in browser localStorage, which meant it was
 * tied to one browser, one profile and one address, capped at about 5 MB, and
 * erased by anything that clears site data. It was lost exactly that way once.
 *
 * A local server is already running, so the wardrobe now lives in a file next
 * to the app. The browser keeps a copy as an offline cache, but this is the
 * authoritative one: it survives changing browser, clearing site data, and
 * moving the folder to another machine.
 */

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const WARDROBE_FILE = path.join(DATA_DIR, "wardrobe.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

/** How many rolling snapshots to keep. Small files; cheap insurance. */
const KEEP_BACKUPS = 30;

export interface StoredWardrobe {
  version: 1;
  updatedAt: string;
  wardrobe: any[];
  outfits: any[];
}

function ensureDirs(): void {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/** Write via a temp file and rename, so a crash mid-write cannot truncate it. */
function writeAtomic(file: string, text: string): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text, "utf-8");
  fs.renameSync(tmp, file);
}

export function readWardrobe(): StoredWardrobe | null {
  if (!fs.existsSync(WARDROBE_FILE)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(WARDROBE_FILE, "utf-8"));
    if (!Array.isArray(parsed?.wardrobe)) return null;
    return parsed as StoredWardrobe;
  } catch (err: any) {
    // Never delete something we failed to read: park it and carry on.
    const parked = `${WARDROBE_FILE}.unreadable.${Date.now()}`;
    try {
      fs.renameSync(WARDROBE_FILE, parked);
      console.error(`[wardrobe] could not parse wardrobe.json (${err.message}); moved to ${parked}`);
    } catch {
      console.error(`[wardrobe] could not parse or move wardrobe.json: ${err.message}`);
    }
    return null;
  }
}

function snapshot(previous: StoredWardrobe): void {
  ensureDirs();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(BACKUP_DIR, `wardrobe-${stamp}-${previous.wardrobe.length}items.json`);
  try {
    writeAtomic(file, JSON.stringify(previous, null, 2));
  } catch (err: any) {
    console.warn(`[wardrobe] could not write a snapshot: ${err.message}`);
  }
  prune();
}

function prune(): void {
  try {
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("wardrobe-"))
      .sort();
    for (const stale of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) {
      fs.unlinkSync(path.join(BACKUP_DIR, stale));
    }
  } catch {
    // Pruning is housekeeping; never let it fail a save.
  }
}

export interface SaveOutcome {
  ok: boolean;
  message: string;
  count: number;
  refused?: boolean;
}

/**
 * A save that would empty a non-empty wardrobe is refused unless it is
 * explicitly asked for. A transient empty array from the client is exactly how
 * the data was lost the first time, and no accidental write should be able to
 * do it again.
 */
export function writeWardrobe(wardrobe: any[], outfits: any[], allowEmpty = false): SaveOutcome {
  ensureDirs();
  const previous = readWardrobe();

  if (!allowEmpty && wardrobe.length === 0 && previous && previous.wardrobe.length > 0) {
    return {
      ok: false,
      refused: true,
      count: previous.wardrobe.length,
      message: `Refused to overwrite ${previous.wardrobe.length} saved garments with an empty list. Nothing was changed.`,
    };
  }

  if (previous && previous.wardrobe.length > 0) snapshot(previous);

  const payload: StoredWardrobe = {
    version: 1,
    updatedAt: new Date().toISOString(),
    wardrobe,
    outfits,
  };
  writeAtomic(WARDROBE_FILE, JSON.stringify(payload, null, 2));

  return { ok: true, count: wardrobe.length, message: `Saved ${wardrobe.length} garments to ${WARDROBE_FILE}.` };
}

export function listBackups(): { file: string; items: number; savedAt: string; bytes: number }[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith("wardrobe-"))
    .sort()
    .reverse()
    .map(f => {
      const full = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(full);
      const match = f.match(/-(\d+)items\.json$/);
      return {
        file: f,
        items: match ? Number(match[1]) : 0,
        savedAt: stat.mtime.toISOString(),
        bytes: stat.size,
      };
    });
}

export function readBackup(file: string): StoredWardrobe | null {
  // Never let a request escape the backup directory.
  const safe = path.basename(file);
  const full = path.join(BACKUP_DIR, safe);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, "utf-8"));
  } catch {
    return null;
  }
}

export function storeInfo(): { file: string; exists: boolean; count: number; updatedAt: string | null; backups: number } {
  const current = readWardrobe();
  return {
    file: WARDROBE_FILE,
    exists: fs.existsSync(WARDROBE_FILE),
    count: current?.wardrobe.length ?? 0,
    updatedAt: current?.updatedAt ?? null,
    backups: listBackups().length,
  };
}
