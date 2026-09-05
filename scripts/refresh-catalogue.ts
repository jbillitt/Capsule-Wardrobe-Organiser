/**
 * Refresh the cached retail catalogue from the command line.
 *
 *   npm run catalogue:refresh            # every enabled source
 *   npm run catalogue:refresh max kilt   # named sources, enabled or not
 */

import { loadGuide, saveLocalCatalogue, localCatalogueInfo } from "../src/engine/rules";
import { fetchAll } from "../src/engine/retail";

const only = process.argv.slice(2);
const guide = loadGuide();

const sources = guide.retailSources
  .filter(s => (only.length ? only.includes(s.id) : s.enabled))
  .map(s => ({ ...s, enabled: true }));

if (!sources.length) {
  console.error(only.length ? `No source matched: ${only.join(", ")}` : "No sources are enabled in style-guide.json.");
  process.exit(1);
}

console.log(`Fetching ${sources.length} source(s): ${sources.map(s => s.id).join(", ")}\n`);

const results = await fetchAll(sources);
for (const r of results) {
  console.log(`${r.ok ? "ok  " : "fail"}  ${r.source.padEnd(20)} ${String(r.count).padStart(4)} items${r.note ? `  — ${r.note}` : ""}`);
}

const entries = results.flatMap(r => r.entries);
if (entries.length) {
  saveLocalCatalogue(entries);
  const info = localCatalogueInfo();
  console.log(`\nCached ${info.count} entries at ${info.fetchedAt}.`);
} else {
  console.log("\nNothing fetched; the existing cache was left alone.");
}
