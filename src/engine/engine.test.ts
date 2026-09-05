/**
 * One runnable check per piece of non-trivial logic. Run with `npm test`
 * from the repo root (the style guide is read relative to cwd).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { WardrobeItem } from "../types";
import { hexToHsl, harmony, nameToHex, colourRole, isNeutral } from "./colour";
import { traitsFor, traitsIndex, recognisedGarment } from "./lexicon";
import { guessCategory } from "../data";
import { buildContext, scoreOutfit, applyTraitRules } from "./score";
import { suggestOutfits, dailySeed, mulberry32, hashString } from "./select";
import { realiseOutfit } from "./realise";
import { analyseGaps } from "./catalogue";
import { categoryFromType } from "./retail";
import { loadGuide, loadCatalogue } from "./rules";

function item(partial: Partial<WardrobeItem> & { id: string; item: string }): WardrobeItem {
  return {
    color: "",
    hex: "",
    description: "",
    brand: "",
    notes: "",
    status: "existing",
    season: "Autumn 26",
    ...partial,
  } as WardrobeItem;
}

const WARDROBE: WardrobeItem[] = [
  item({ id: "a1", item: "Linen button down", color: "Off White", hex: "#eae6df", description: "Parchment linen shirt" }),
  item({ id: "a2", item: "Cotton poplin shirt", color: "White", hex: "#fafaf9", description: "Crisp poplin" }),
  item({ id: "a3", item: "Fine merino turtleneck", color: "Black", hex: "#1c1917", description: "Merino roll neck" }),
  item({ id: "a4", item: "Breton stripe top", color: "Cream", hex: "#f5efe0", description: "Cotton jersey" }),
  item({ id: "b1", item: "Straight leg jeans", color: "Mid Wash Blue", hex: "#6f8faf", description: "Rigid denim" }),
  item({ id: "b2", item: "Tailored wool trousers", color: "Charcoal", hex: "#3f3f46", description: "Pressed wool" }),
  item({ id: "b3", item: "Corduroy trousers", color: "Espresso", hex: "#4b3621", description: "Fine wale corduroy" }),
  item({ id: "b4", item: "Athletic leggings", color: "Black", hex: "#1c1917", description: "Technical activewear legging" }),
  item({ id: "m1", item: "Merino crewneck jumper", color: "Oatmeal", hex: "#e3d9c6", description: "Mid gauge merino" }),
  item({ id: "m2", item: "Cropped cardigan", color: "Black Wool", hex: "#1c1917", description: "Merino knit cardigan" }),
  item({ id: "o1", item: "Wool overcoat", color: "Camel", hex: "#c19a6b", description: "Double faced wool coat" }),
  item({ id: "o2", item: "Denim jacket", color: "Mid Wash Blue", hex: "#6f8faf", description: "Rigid denim trucker" }),
  item({ id: "s1", item: "Leather loafers", color: "Espresso", hex: "#4b3621", description: "Penny loafer" }),
  item({ id: "s2", item: "Chelsea boots", color: "Black", hex: "#1c1917", description: "Leather boot" }),
  item({ id: "s3", item: "Leather sandals", color: "Cream", hex: "#f5efe0", description: "Flat footbed sandal" }),
  item({ id: "g1", item: "Leather tote", color: "Espresso", hex: "#4b3621", description: "Structured leather tote" }),
];

function context(activity: string, wardrobe = WARDROBE) {
  const guide = loadGuide();
  const traits = traitsIndex(wardrobe);
  applyTraitRules(traits, wardrobe, guide);
  return buildContext(guide, traits, activity, "Autumn 26");
}

// ---------------------------------------------------------------------------

test("colour names resolve and hex converts to sane HSL", () => {
  assert.equal(nameToHex("Navy"), "#1e293b");
  assert.equal(nameToHex("Charcoal Grey"), "#3f3f46", "more specific name must win over 'grey'");

  const black = hexToHsl("#1c1917");
  assert.ok(black.l < 0.2, `expected a dark lightness, got ${black.l}`);
  assert.ok(isNeutral(black));

  assert.equal(colourRole(hexToHsl("#c19a6b")), "warm-neutral", "camel is a fashion neutral");
  assert.equal(colourRole(hexToHsl("#6f8faf")), "denim", "denim behaves as a neutral");
});

test("harmony recognises the classic hue relationships", () => {
  // Red (6 degrees) against teal (187): a true complement.
  const complementary = harmony(hexToHsl("#c0392b"), hexToHsl("#20707a"));
  assert.equal(complementary.kind, "complementary");
  assert.ok(complementary.score > 0.8);

  // Close hues at different depths are a tonal pair, and should score well.
  const tonal = harmony({ h: 30, s: 0.6, l: 0.7 }, { h: 42, s: 0.6, l: 0.35 });
  assert.equal(tonal.kind, "monochrome");
  assert.ok(tonal.score > 0.7, "a close tonal pair must score well, not fall between bands");

  // The same hues at the same depth are muddy, and must be penalised.
  const flat = harmony({ h: 30, s: 0.6, l: 0.5 }, { h: 42, s: 0.6, l: 0.52 });
  assert.ok(flat.score < 0.5, "no lightness separation should read as muddy, not tonal");

  // Red against cobalt (143 degrees) is an ordinary split complementary.
  const split = harmony(hexToHsl("#c0392b"), hexToHsl("#2c4fa8"));
  assert.equal(split.kind, "complementary");
  assert.ok(split.score > 0.7, "143 degrees must not fall into a dead zone between bands");

  // Anything against a neutral is safe.
  assert.equal(harmony(hexToHsl("#1c1917"), hexToHsl("#c0392b")).kind, "neutral-ground");

  // The genuine clash band: red against yellow-green at 63 degrees.
  const clash = harmony(hexToHsl("#c0392b"), hexToHsl("#9caf28"));
  assert.equal(clash.kind, "discord", `expected discord, got ${clash.kind}`);

  // Every angle must land in a band; none may return undefined.
  for (let angle = 0; angle <= 180; angle += 1) {
    const result = harmony({ h: 0, s: 0.6, l: 0.45 }, { h: angle, s: 0.6, l: 0.45 });
    assert.ok(result.score > 0, `angle ${angle} produced no harmony band`);
  }
});

test("category matching is not fooled by 'short sleeve'", () => {
  // Retailers label half a catalogue "Short Sleeve X"; a bare substring match
  // on "short" sent dresses and tees into Bottoms.
  assert.equal(guessCategory("Short Sleeve Dresses"), "Dresses");
  assert.equal(guessCategory("Tops / Short Sleeve Knitwear"), "Tops");
  assert.equal(guessCategory("Short-sleeve linen shirt"), "Tops");
  // ...but real shorts must still be bottoms.
  assert.equal(guessCategory("High waisted denim shorts"), "Bottoms");
  assert.equal(guessCategory("Linen short"), "Bottoms");

  // Retailer category tabs are fed in verbatim, so the plain words must map.
  for (const [tab, expected] of [
    ["Tops", "Tops"],
    ["Bottoms", "Bottoms"],
    ["Dresses", "Dresses"],
    ["Outerwear", "Outerwear"],
    ["Shoes", "Shoes"],
    ["Accessories", "Accessories"],
  ] as const) {
    assert.equal(guessCategory(tab), expected, `retailer tab "${tab}" must map to itself`);
  }
});

test("retail category breadcrumbs resolve to the specific segment", () => {
  // MAX files socks under "Non-Apparel / Socks"; taking the first segment made
  // them tops. The last segment is the one that carries meaning.
  assert.equal(categoryFromType("Non-Apparel / Socks", "Eden Wool Crew Socks"), "Accessories");
  assert.equal(categoryFromType("Dresses / Short Sleeve Dresses", "Eliza Midi Dress"), "Dresses");
  assert.equal(categoryFromType("Tops / Short Sleeve Knitwear", "Merino Silk Knit Tee"), "Tops");
  assert.equal(categoryFromType("Bottoms / Wide Leg", "Cleo Trouser"), "Bottoms");
  // No usable type at all: fall back to the title.
  assert.equal(categoryFromType("", "Chelsea boots"), "Shoes");
  assert.equal(categoryFromType("Miscellaneous", "Wool overcoat"), "Outerwear");
  // "Cardi" is the NZ abbreviation and must agree with the layering slot.
  assert.equal(categoryFromType("", "Wool Georgie Cardi"), "Outerwear");
  assert.equal(traitsFor({ id: "x", item: "Wool Georgie Cardi", color: "Navy", hex: "#1e293b", description: "", brand: "", notes: "", status: "buy" }).slot, "mid");
});

test("the lexicon knows a garment from a painting", () => {
  // Robyn Reynolds sells artwork alongside clothing; without this the engine
  // would suggest wearing "Waiting for the Bloody Bus".
  assert.ok(recognisedGarment("Linen button down"));
  assert.ok(recognisedGarment("Elementary Ribbed Henley"), "henley is a garment");
  assert.ok(recognisedGarment("Slingback flats"), "plural footwear must match");
  assert.ok(recognisedGarment("Steph Check Socks"));
  assert.ok(recognisedGarment("Tilly Cullotes"), "a common misspelling still reads as culottes");

  assert.ok(!recognisedGarment("Waiting for the Bloody Bus"));
  assert.ok(!recognisedGarment("Lady in a chair"));
  assert.ok(!recognisedGarment("Together in Silence"));
});

test("retailer colour names resolve to real hues", () => {
  const cases: [string, string][] = [
    ["Obsidian", "#1c1917"],
    ["Ebony", "#1c1917"],
    // "marle" is a yarn, not a colour, so the actual colour word wins.
    ["Natural Marle", "#d9cfbe"],
    ["Heather Marle", "#c4c1bb"],
    ["Urban Mist", "#c4c1bb"],
    ["Macchiato", "#4b3621"],
    ["Cinnamon", "#6b4423"],
    ["Moss", "#3d5236"],
    ["Combat", "#3d5236"],
    ["Willow", "#9caf88"],
    ["Forrest linen/cotton", "#1f4634"],
    ["Paparika", "#a44a2f"],
    ["Cheeky Ros\u00e9", "#dcaead"],
  ];
  for (const [name, expected] of cases) {
    assert.equal(nameToHex(name), expected, `"${name}" should resolve`);
  }
});

test("garments resolve to a specific kind, not a default t-shirt", () => {
  const kindOf = (name: string) =>
    traitsFor({ id: "k", item: name, color: "", hex: "", description: "", brand: "", notes: "", status: "existing" } as WardrobeItem).kind;

  // The bugs that made every card render as a tee.
  assert.equal(kindOf("Pima cotton t-shirt"), "tee", '"t-shirt" contains "shirt" and must not lose to it');
  assert.equal(kindOf("Cotton sweatshirt"), "sweatshirt", '"sweatshirt" also contains "tshirt"');
  assert.equal(kindOf("Linen midi dress"), "dress", "a midi dress is not a shirt dress");
  assert.equal(kindOf("Shirt dress"), "shirt-dress");
  assert.equal(kindOf("High waisted denim shorts"), "shorts", "denim shorts are shorts, not jeans");
  assert.equal(kindOf("Straight leg jeans"), "jeans");

  // A garment gets its own picture.
  assert.equal(kindOf("Chelsea boots"), "boot");
  assert.equal(kindOf("White leather sneakers"), "sneaker");
  assert.equal(kindOf("Block heel pumps"), "heel");
  assert.equal(kindOf("Leather sandals"), "sandal");
  assert.equal(kindOf("Leather tote"), "bag");
  assert.equal(kindOf("Wool scarf"), "scarf");
  assert.equal(kindOf("Leather belt"), "belt");
  assert.equal(kindOf("Wool beanie"), "hat");
  assert.equal(kindOf("Crew socks"), "socks");
  assert.equal(kindOf("Gold hoop earrings"), "jewellery");
  assert.equal(kindOf("Cropped cardigan"), "cardigan");
  assert.equal(kindOf("Tailored blazer"), "blazer");
  assert.equal(kindOf("Down puffer"), "puffer");
  assert.equal(kindOf("Pleated midi skirt"), "skirt");

  // Unrecognised stays unrecognised rather than silently becoming a top.
  assert.equal(kindOf("Something Entirely Unheard Of"), "unknown");
});

test("traits come out of plain-text fields", () => {
  const linen = traitsFor(WARDROBE[0]);
  assert.equal(linen.slot, "base");
  assert.ok(linen.textures.includes("linen"));
  assert.ok(linen.warmth <= 2, "linen must read as light");

  const coat = traitsFor(WARDROBE.find(i => i.id === "o1")!);
  assert.equal(coat.slot, "outer");
  assert.ok(coat.warmth >= 4);
  assert.ok(coat.formality >= 4);

  const leggings = traitsFor(WARDROBE.find(i => i.id === "b4")!);
  assert.equal(leggings.slot, "bottom");
  assert.ok(leggings.formality <= 2, "activewear must not read as smart");
});

test("a banned garment never survives into a church suggestion", () => {
  const ctx = context("Sunday Church");
  const outfits = suggestOutfits(WARDROBE, ctx, { count: 3, seed: "church-test" });

  assert.ok(outfits.length > 0, "the fixture wardrobe can dress for church");
  for (const outfit of outfits) {
    assert.ok(
      !outfit.items.some(i => /legging|track|activewear/i.test(`${i.item} ${i.description}`)),
      `leggings leaked into: ${outfit.items.map(i => i.item).join(", ")}`
    );
  }
});

test("an explicit veto is reported rather than silently scored", () => {
  const ctx = context("Sunday Church");
  const verdict = scoreOutfit(
    [WARDROBE.find(i => i.id === "b4")!, WARDROBE.find(i => i.id === "a3")!, WARDROBE.find(i => i.id === "s2")!],
    ctx
  );
  assert.ok(verdict.vetoes.length > 0, "leggings for church must veto");
});

test("layering order is enforced: a light shell over a heavy knit loses", () => {
  const ctx = context("Errand Day");
  const heavyOverLight = scoreOutfit(
    [WARDROBE.find(i => i.id === "m1")!, WARDROBE.find(i => i.id === "o1")!, WARDROBE.find(i => i.id === "b2")!],
    ctx
  );
  const lightOverHeavy = scoreOutfit(
    [WARDROBE.find(i => i.id === "m1")!, WARDROBE.find(i => i.id === "o2")!, WARDROBE.find(i => i.id === "b2")!],
    ctx
  );
  assert.ok(
    heavyOverLight.signals.layerWeight >= lightOverHeavy.signals.layerWeight,
    "a wool coat over merino should not score below a denim jacket over merino"
  );
});

test("the same seed reproduces exactly, and the day changes the answer", () => {
  const ctx = context("Errand Day");
  const fingerprint = (seed: string) =>
    suggestOutfits(WARDROBE, ctx, { count: 3, seed })
      .map(o => o.items.map(i => i.id).sort().join("+"))
      .join("|");

  assert.equal(fingerprint("2026-09-05|Errand day|all"), fingerprint("2026-09-05|Errand day|all"));

  const week = new Set(
    Array.from({ length: 7 }, (_, d) => fingerprint(dailySeed("Errand day", "all", `2026-09-0${d + 1}`)))
  );
  assert.ok(week.size > 1, "seven consecutive days produced identical suggestions every time");
});

test("the PRNG is deterministic and stays in range", () => {
  const a = mulberry32(hashString("seed"));
  const b = mulberry32(hashString("seed"));
  for (let i = 0; i < 50; i++) {
    const value = a();
    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1);
  }
});

test("the realiser writes complete prose with no unfilled templates", () => {
  const ctx = context("Out for Dinner Drinks");
  const outfits = suggestOutfits(WARDROBE, ctx, { count: 3, seed: "prose-test" });
  assert.ok(outfits.length > 0);

  for (const outfit of outfits) {
    const realised = realiseOutfit(outfit, ctx, "prose-test");
    const prose = [realised.name, realised.description, realised.stylingNotes, ...(realised.whyItWorks || [])].join(" ");

    assert.ok(realised.name.length > 3, "outfit needs a name");
    assert.ok(realised.description.endsWith("."), `description must be a sentence: ${realised.description}`);
    assert.ok(!/[{}]/.test(prose), `unfilled template slot in: ${prose}`);
    assert.ok(!/undefined|NaN|\[object/.test(prose), `leaked value in: ${prose}`);
    assert.ok(realised.stylingNotes.length > 10, "styling notes must say something");
  }
});

test("a wardrobe with no shoes is told to buy shoes", () => {
  const shoeless = WARDROBE.filter(i => !["s1", "s2", "s3"].includes(i.id));
  const guide = loadGuide();
  const traits = traitsIndex(shoeless);
  const report = analyseGaps(shoeless, traits, loadCatalogue(), guide, "Autumn 26");

  assert.match(report.generalGapAssessment, /shoe/i);
  assert.ok(
    report.suggestedItemsToBuy.some(r => r.category === "Shoes"),
    `expected footwear in: ${report.suggestedItemsToBuy.map(r => r.item).join(", ")}`
  );
  assert.equal(
    report.suggestedItemsToBuy.length,
    3,
    "three gaps must yield three recommendations, not fewer because of a category clash"
  );
  assert.equal(
    new Set(report.suggestedItemsToBuy.map(r => r.item)).size,
    3,
    "recommendations must not repeat the same garment"
  );
  for (const rec of report.suggestedItemsToBuy) {
    assert.ok(rec.reason.length > 20, "every recommendation needs a real justification");
  }
});

test("a learned occasion ban is obeyed on the next run", () => {
  const guide = loadGuide();
  guide.rules = [
    {
      id: "test-rule",
      kind: "occasion-ban",
      key: "b1",
      activity: "Errand day",
      label: "Straight leg jeans",
      createdAt: new Date().toISOString(),
    },
  ];

  const traits = traitsIndex(WARDROBE);
  applyTraitRules(traits, WARDROBE, guide);
  const ctx = buildContext(guide, traits, "Errand Day", "Autumn 26");

  const outfits = suggestOutfits(WARDROBE, ctx, { count: 3, seed: "rule-test" });
  for (const outfit of outfits) {
    assert.ok(!outfit.items.some(i => i.id === "b1"), "the banned garment came back anyway");
  }
});

