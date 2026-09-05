/**
 * Renders every garment silhouette to a static page so they can actually be
 * looked at rather than assumed correct.
 *
 *   npm run silhouettes    then open silhouettes.html
 */

import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { ApparelSilhouette } from "../src/components/ApparelSilhouette";
import { traitsFor } from "../src/engine/lexicon";
import { WardrobeItem } from "../src/types";

/** Real garment names, so this exercises the lexicon rather than the kinds. */
const SAMPLES: [string, string, string][] = [
  ["Linen button down", "Off White", "#eae6df"],
  ["Cotton poplin shirt", "Sky", "#a8c6e8"],
  ["Pima cotton t-shirt", "Black", "#1c1917"],
  ["Breton stripe long sleeve", "Cream", "#f5efe0"],
  ["Ribbed tank", "Oatmeal", "#e3d9c6"],
  ["Silk camisole", "Espresso", "#4b3621"],
  ["Elementary Ribbed Henley", "Sage", "#9caf88"],
  ["Merino crewneck jumper", "Camel", "#c19a6b"],
  ["Cropped cardigan", "Black", "#1c1917"],
  ["Cotton sweatshirt", "Grey", "#78716c"],
  ["Wool overcoat", "Camel", "#c19a6b"],
  ["Trench coat", "Stone", "#d9cfbe"],
  ["Tailored blazer", "Navy", "#1e293b"],
  ["Denim jacket", "Mid Wash Blue", "#6f8faf"],
  ["Down puffer", "Olive", "#3d5236"],
  ["Quilted gilet vest", "Charcoal", "#3f3f46"],
  ["Leather jacket", "Espresso", "#4b3621"],
  ["Shirt dress", "Chambray", "#6f8faf"],
  ["Linen midi dress", "Sand", "#d9cfbe"],
  ["Suzy Corduroy Overalls", "Rust", "#a44a2f"],
  ["Tailored wide leg trousers", "Charcoal", "#3f3f46"],
  ["Straight leg jeans", "Indigo", "#33415c"],
  ["Athletic leggings", "Black", "#1c1917"],
  ["High waisted denim shorts", "Mid Wash Blue", "#6f8faf"],
  ["Pleated midi skirt", "Burgundy", "#58181a"],
  ["Chelsea boots", "Black", "#1c1917"],
  ["White leather sneakers", "White", "#fafaf9"],
  ["Block heel pumps", "Burgundy", "#58181a"],
  ["Leather sandals", "Tan", "#a26b3c"],
  ["Leather loafers", "Espresso", "#4b3621"],
  ["Leather tote", "Espresso", "#4b3621"],
  ["Wool beanie hat", "Charcoal", "#3f3f46"],
  ["Wool scarf", "Camel", "#c19a6b"],
  ["Leather belt", "Tan", "#a26b3c"],
  ["Sunglasses", "Espresso", "#4b3621"],
  ["Daria Pointelle Crew Socks", "Sage", "#9caf88"],
  ["Gold hoop earrings", "Gold", "#b58f3c"],
  ["Something Entirely Unheard Of", "Teal", "#20707a"],
];

const asItem = (name: string, color: string, hex: string): WardrobeItem =>
  ({ id: name, item: name, color, hex, description: "", brand: "", notes: "", status: "existing" }) as WardrobeItem;

const cells = SAMPLES.map(([name, color, hex]) => {
  const item = asItem(name, color, hex);
  const kind = traitsFor(item).kind;
  const svg = renderToStaticMarkup(React.createElement(ApparelSilhouette, { item }));
  return { name, color, hex, kind, svg };
});

// Distinctness check: two different kinds must not draw the same picture.
const byKind = new Map<string, string>();
const collisions: string[] = [];
for (const c of cells) {
  const existing = byKind.get(c.kind);
  if (existing && existing !== c.svg) continue;
  byKind.set(c.kind, c.svg);
}
const shapes = new Map<string, string[]>();
for (const [kind, svg] of byKind) {
  const body = svg.replace(/viewBox="[^"]*"/, "").replace(/#[0-9a-f]{6}/gi, "COLOUR");
  const list = shapes.get(body) || [];
  list.push(kind);
  shapes.set(body, list);
}
for (const [, kinds] of shapes) if (kinds.length > 1) collisions.push(kinds.join(" = "));

const html = `<!doctype html>
<meta charset="utf-8">
<title>Garment silhouettes</title>
<style>
  body { font: 14px system-ui, sans-serif; background: #FAF9F6; color: #292524; margin: 0; padding: 32px; }
  h1 { font-weight: 600; margin: 0 0 4px; }
  p.sub { color: #78716c; margin: 0 0 28px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 18px; }
  .cell { background: #fff; border: 1px solid #e7e5e4; border-radius: 4px; padding: 14px; text-align: center; }
  .art { height: 130px; display: flex; align-items: center; justify-content: center; }
  .art svg { max-height: 130px; }
  .name { font-size: 11px; margin-top: 8px; line-height: 1.35; }
  .kind { font-family: ui-monospace, monospace; font-size: 10px; color: #78716c; text-transform: uppercase; letter-spacing: .06em; }
  .warn { background: #fef2f2; border: 1px solid #fecaca; color: #7f1d1d; padding: 12px; border-radius: 4px; margin-bottom: 20px; }
</style>
<h1>Garment silhouettes</h1>
<p class="sub">${cells.length} real garment names, resolved through the styling lexicon. The label under each is the kind it resolved to.</p>
${collisions.length ? `<div class="warn"><strong>Different garments drawing the same shape:</strong><br>${collisions.join("<br>")}</div>` : ""}
<div class="grid">
${cells
  .map(
    c => `  <div class="cell">
    <div class="art">${c.svg}</div>
    <div class="name">${c.name}<br><span style="color:#a8a29e">${c.color}</span></div>
    <div class="kind">${c.kind}</div>
  </div>`
  )
  .join("\n")}
</div>
`;

fs.writeFileSync("silhouettes.html", html, "utf-8");

console.log(`${cells.length} samples rendered to silhouettes.html`);
console.log(`${byKind.size} distinct garment kinds\n`);
for (const c of cells) console.log(`  ${c.kind.padEnd(14)} <- ${c.name}`);
if (collisions.length) {
  console.log(`\nWARNING: kinds drawing an identical shape:`);
  for (const c of collisions) console.log(`  ${c}`);
  process.exit(1);
}
console.log(`\nEvery kind draws a distinct shape.`);
