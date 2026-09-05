/**
 * Recover a wardrobe from the browser's on-disk storage.
 *
 *   npm run recover              scan every browser profile found
 *   npm run recover -- <path>    scan one folder or file
 *
 * There is no database in this project: the wardrobe lives in localStorage,
 * which browsers keep in LevelDB files inside the browser profile. LevelDB is
 * append-only and only compacts periodically, so a wardrobe that was
 * overwritten in the app is frequently still sitting in an older .log or .ldb
 * segment on disk.
 *
 * This reads those files, pulls out anything shaped like a wardrobe, and
 * writes the best candidates as .json ready for the app's Restore button.
 * It only ever reads the profile, and it only keeps arrays that look like
 * garments, so unrelated sites' data is not touched or written out.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();

/** Where Chromium-family browsers keep localStorage, per platform. */
function candidateRoots() {
  const roots = [];
  const add = (...parts) => roots.push(path.join(...parts));

  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA || path.join(HOME, "AppData", "Local");
    const roaming = process.env.APPDATA || path.join(HOME, "AppData", "Roaming");
    add(local, "Google", "Chrome", "User Data");
    add(local, "Microsoft", "Edge", "User Data");
    add(local, "BraveSoftware", "Brave-Browser", "User Data");
    add(local, "Vivaldi", "User Data");
    add(roaming, "Opera Software", "Opera Stable");
  } else if (process.platform === "darwin") {
    add(HOME, "Library", "Application Support", "Google", "Chrome");
    add(HOME, "Library", "Application Support", "Microsoft Edge");
    add(HOME, "Library", "Application Support", "BraveSoftware", "Brave-Browser");
  } else {
    add(HOME, ".config", "google-chrome");
    add(HOME, ".config", "microsoft-edge");
    add(HOME, ".config", "chromium");
  }
  return roots.filter(r => fs.existsSync(r));
}

/** Every Local Storage leveldb file under a browser's User Data folder. */
function storageFiles(root) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        // Only descend towards Local Storage, not the whole profile.
        if (depth < 3 || /local storage|leveldb/i.test(e.name)) walk(full, depth + 1);
      } else if (/\.(log|ldb)$/i.test(e.name) && /local storage/i.test(dir)) {
        out.push(full);
      }
    }
  };
  walk(root, 0);
  return out;
}

/**
 * Pull JSON arrays out of a text blob by bracket matching, respecting string
 * literals. LevelDB frames values with binary, so a plain JSON.parse of the
 * file is never going to work - but the value itself is intact inside it.
 */
function extractArrays(text) {
  const found = [];
  let i = 0;

  while (i < text.length) {
    const start = text.indexOf("[{", i);
    if (start === -1) break;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (let j = start; j < text.length && j - start < 40_000_000; j++) {
      const ch = text[j];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        if (inString) escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === "[" || ch === "{") depth++;
      else if (ch === "]" || ch === "}") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
        if (depth < 0) break;
      }
    }

    if (end === -1) {
      i = start + 2;
      continue;
    }

    const candidate = text.slice(start, end + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed) && parsed.length) found.push({ parsed, text: candidate });
    } catch {
      // Framing noise landed inside the braces; move on.
    }
    i = end + 1;
  }

  return found;
}

/** Only keep arrays that really are garments. */
function looksLikeWardrobe(list) {
  if (!Array.isArray(list) || list.length === 0) return false;
  const sample = list.slice(0, 5);
  const garmentish = sample.filter(
    o => o && typeof o === "object" && typeof o.item === "string" && ("color" in o || "season" in o || "status" in o)
  );
  return garmentish.length === sample.length;
}

/** The leveldb key carries the origin, e.g. "_https://localhost:3000\0\1capsule..." */
function originNear(text, index) {
  const window = text.slice(Math.max(0, index - 400), index);
  const matches = [...window.matchAll(/(https?:\/\/[^\s\x00-\x1f"']{3,80})/g)];
  return matches.length ? matches[matches.length - 1][1] : "unknown origin";
}

function scanFile(file) {
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch {
    return [];
  }

  const results = [];
  // localStorage values are stored UTF-8 or UTF-16LE depending on content.
  for (const [encoding, text] of [
    ["utf8", buf.toString("latin1")],
    ["utf16le", buf.toString("utf16le")],
  ]) {
    if (!text.includes('"item"')) continue;
    for (const { parsed, text: raw } of extractArrays(text)) {
      if (!looksLikeWardrobe(parsed)) continue;
      results.push({
        file,
        encoding,
        count: parsed.length,
        bytes: Buffer.byteLength(raw),
        withImages: parsed.filter(i => i.imageUrl).length,
        seasons: [...new Set(parsed.map(i => i.season).filter(Boolean))],
        origin: originNear(text, text.indexOf(raw)),
        items: parsed,
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------

const target = process.argv[2];
const files = [];

if (target) {
  const stat = fs.existsSync(target) ? fs.statSync(target) : null;
  if (!stat) {
    console.error(`Not found: ${target}`);
    process.exit(1);
  }
  if (stat.isDirectory()) files.push(...storageFiles(target));
  else files.push(target);
} else {
  const roots = candidateRoots();
  if (!roots.length) console.log("No Chrome, Edge or Brave profile found in the usual places.");
  for (const root of roots) {
    console.log(`scanning ${root}`);
    files.push(...storageFiles(root));
  }
}

console.log(`${files.length} storage file(s) to read\n`);

const all = [];
for (const file of files) all.push(...scanFile(file));

if (!all.length) {
  console.log("No wardrobe data found.");
  console.log("\nThings worth checking:");
  console.log("  - the browser must be CLOSED, or it holds a lock and recent data stays unflushed");
  console.log("  - try the other browser, and any other profile (Person 2, work profile)");
  console.log("  - pass a folder explicitly:  npm run recover -- \"C:\\path\\to\\User Data\"");
  process.exit(0);
}

// Biggest first: the fullest wardrobe is almost always the one wanted.
all.sort((a, b) => b.count - a.count);

const seen = new Set();
let written = 0;

console.log(`Found ${all.length} wardrobe snapshot(s):\n`);
for (const r of all) {
  const fingerprint = `${r.count}|${r.items.map(i => i.id ?? i.item).join(",").slice(0, 400)}`;
  const duplicate = seen.has(fingerprint);
  seen.add(fingerprint);

  console.log(`  ${String(r.count).padStart(4)} garments  ${r.withImages} with photos  ${(r.bytes / 1024).toFixed(0)} KB`);
  console.log(`       origin:  ${r.origin}`);
  console.log(`       seasons: ${r.seasons.join(", ") || "(none set)"}`);
  console.log(`       from:    ${r.file}`);

  if (!duplicate) {
    const out = `recovered-wardrobe-${++written}-${r.count}items.json`;
    fs.writeFileSync(out, JSON.stringify(r.items, null, 2), "utf-8");
    console.log(`       SAVED:   ${out}`);
  } else {
    console.log(`       (same as one already saved)`);
  }
  console.log();
}

console.log(`Wrote ${written} file(s).`);
console.log(`Open the app and use Restore on the one with the most garments.`);
