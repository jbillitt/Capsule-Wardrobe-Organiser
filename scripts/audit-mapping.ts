/**
 * Mapping audit: how much of the wardrobe and the catalogue does the lexicon
 * actually recognise? Anything landing in "low confidence" is being scored on
 * assumptions rather than evidence.
 *
 *   npm run audit
 */

import { initialCuratedWardrobe } from "../src/data";
import { traitsFor, Slot } from "../src/engine/lexicon";
import { isUnknownHex } from "../src/engine/colour";
import { loadCatalogue } from "../src/engine/rules";
import { WardrobeItem } from "../src/types";

const asItem = (e: any): WardrobeItem => ({
  id: e.id,
  item: e.item,
  color: e.color === "Unspecified" ? "" : e.color,
  hex: e.hex,
  description: e.description || "",
  brand: e.brand || "",
  notes: e.notes || "",
  status: "buy",
});

function audit(label: string, items: WardrobeItem[]) {
  const rows = items.map(i => ({ item: i, t: traitsFor(i) }));

  const slots = new Map<Slot, number>();
  for (const { t } of rows) slots.set(t.slot, (slots.get(t.slot) || 0) + 1);

  const noTexture = rows.filter(r => r.t.textures.length === 0);
  const unknownColour = rows.filter(r => isUnknownHex(r.t.hex));
  const lowConfidence = rows.filter(r => r.t.confidence < 0.5);

  console.log(`\n${"=".repeat(72)}\n${label}  (${items.length} items)\n${"=".repeat(72)}`);
  console.log("slots:      ", [...slots.entries()].map(([s, n]) => `${s}:${n}`).join("  "));
  console.log(`no fabric:   ${noTexture.length} (${pct(noTexture.length, items.length)})`);
  console.log(`no colour:   ${unknownColour.length} (${pct(unknownColour.length, items.length)})`);
  console.log(`low conf:    ${lowConfidence.length} (${pct(lowConfidence.length, items.length)})`);

  if (lowConfidence.length) {
    console.log("\n  unrecognised garments (scored on assumptions):");
    for (const r of lowConfidence.slice(0, 25)) {
      console.log(`    ${r.t.slot.padEnd(10)} f${r.t.formality} w${r.t.warmth}  ${r.item.item}`);
    }
    if (lowConfidence.length > 25) console.log(`    ... and ${lowConfidence.length - 25} more`);
  }

  if (unknownColour.length) {
    console.log("\n  unresolved colours:");
    const names = [...new Set(unknownColour.map(r => r.item.color).filter(Boolean))];
    console.log(`    ${names.slice(0, 20).join(" | ") || "(blank colour fields)"}`);
  }

  return { lowConfidence: lowConfidence.length, total: items.length };
}

const pct = (n: number, total: number) => `${total ? Math.round((n / total) * 100) : 0}%`;

const wardrobe = audit("HER WARDROBE (src/data.ts)", initialCuratedWardrobe);
const catalogue = audit("CATALOGUE (seed + cached retail)", loadCatalogue().map(asItem));

const totalLow = wardrobe.lowConfidence + catalogue.lowConfidence;
const total = wardrobe.total + catalogue.total;
console.log(`\n${"=".repeat(72)}`);
console.log(`overall recognised: ${pct(total - totalLow, total)} of ${total} garments`);
