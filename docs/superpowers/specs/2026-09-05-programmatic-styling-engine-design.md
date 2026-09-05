# Programmatic Styling Engine — Design

**Date:** 2026-09-05
**Status:** Approved, in implementation

## Problem

Every intelligent feature in the app calls Gemini (`gemini-3.5-flash`) through seven
endpoints in `server.ts`. Gemini credits run out, and when they do the app degrades to
embarrassing hardcoded fallbacks ("Fallback Shuffle 1", random top/bottom pairing).

Replace the whole AI layer with a **programmatic styling engine**: a scored rulebook
driven by an editable style guide, plus a template-based language engine that explains
its own reasoning. No API keys, no credits, no network dependency for core function.

Not deterministic in the sense of "always identical" — the day's seed re-rolls the
selection each morning — but fully reproducible: same day, same wardrobe, same guide,
same answer.

## Non-goals

- No ML, no embeddings, no local model. Keyword lexicons and colour arithmetic only.
- `/api/image-search` and `/api/scrape-image` stay as they are. They never used AI.
- No frontend framework changes. The HTTP contract is preserved so React barely moves.

## Architecture

```
src/engine/
  colour.ts     hex → HSL, colour-name lexicon, Itten harmony angles
  lexicon.ts    garment/fabric keywords → slot, formality, warmth, texture
  score.ts      six weighted signals → score + typed Reason[]
  select.ts     seeded beam search over slot templates
  realise.ts    Reason[] → prose (names, descriptions, styling notes)
  catalogue.ts  staple catalogue, vibe search, gap coverage matrix
  retail.ts     Shopify / JSON-LD / __NEXT_DATA__ / HTML adapters
  rules.ts      style-guide.json load/save, structured corrections
style-guide.json      activity profiles, palette, aesthetics, weights, learned rules
catalogue.seed.json   ~120 curated capsule staples
```

The engine is a set of pure modules imported by `server.ts`. Endpoints become thin
adapters. Because nothing in the engine touches Node APIs except `rules.ts` and
`retail.ts`, it can move client-side later without a rewrite.

### 1. Attribute derivation (`lexicon.ts`)

Items already carry `item`, `color`, `hex`, `description`, `brand`, `notes`. From these:

| Trait | Derivation |
|---|---|
| `slot` | base / mid / outer / bottom / dress / shoe / bag / accessory — finer than the existing `guessCategory()`, which is reused for the 6 display categories |
| `formality` 1–5 | garment keywords, adjusted by fabric words (track 1 → silk/heel 5) |
| `warmth` 1–5 | fabric keywords (linen 1 → puffer 5) |
| `textures` | fabric tokens reused verbatim by the prose engine |
| `hsl` / `role` | `hex` → HSL → neutral-dark / neutral-light / warm-neutral / cool-neutral / denim / accent |
| `confidence` | how many keywords actually matched; unknown garments score conservatively rather than confidently wrong |

Denim is treated as a neutral, per standard capsule practice.

### 2. Scorer (`score.ts`)

Six signals, shaped after [Loom](https://arxiv.org/abs/2605.09830) but with arithmetic
in place of embeddings:

| Signal | Rule |
|---|---|
| Colour harmony | circular hue distance: analogous ≤35°, triadic ~120°, complementary ~180°; 36–80° is the clash band. Neutrals pair freely. Penalty for 3+ competing accents (60-30-10). Rewards value contrast > 0.2 L. |
| Formality coherence | spread ≤ 2 **and** mean inside the activity band |
| Occasion fit | required slots present, banned keywords absent, warmth near the season target |
| Style direction | aesthetic recipe: neutral ratio, max colours, tag overlap with `aiStyleTags` |
| Layer / weight | warmth increases outward — no linen shell over merino |
| Diversity | penalise duplicate slots and near-identical hues; reward texture contrast |

Weights live in `style-guide.json`. **Bans and missing required slots are vetoes, not
penalties** — a church outfit cannot score its way past a legging.

Every signal emits typed `Reason` objects (`kind`, `strength`, `itemIds`, `data`), which
are the sole input to the prose engine.

### 3. Selection (`select.ts`)

Per-activity slot template (e.g. `base + bottom + shoe [+ outer] [+ bag]`). Beam search
of width 8 over slot-filtered pools. Seed is `hash(YYYY-MM-DD + activity + capsule)`
driving a mulberry32 PRNG.

Variety comes from **seeded weighted sampling** over the top candidates, not from
jittering scores: good outfits still win, but which three good outfits surface changes
daily. Returned outfits share at most one item.

### 4. Language engine (`realise.ts`)

A [Reiter & Dale](https://arxiv.org/html/2502.14437v1) pipeline without the neural part:

1. **Content selection** — top 2–3 reasons by strength, at most one per kind
2. **Aggregation** — reasons over the same items merge into one sentence
3. **Surface realisation** — per-kind templates with synonym pools indexed by the day seed

Outfit names are composed from colour word + texture word + cadence template.

**Honesty guard:** if no reason clears the strength floor, the prose says the pairing is
serviceable rather than inventing praise. Prose is generated from why the outfit actually
won, so a weak outfit reads weak.

`OutfitSuggestion` gains optional `whyItWorks: string[]` and `score: number`. Additive.

### 5. Catalogue and retail

`catalogue.seed.json` holds ~120 curated staples (garment, category, colourway + hex,
fabric, formality, warmth, aesthetic tags, typical brands).

`retail.ts` refreshes it from real stores with four adapters:

| Source | Adapter |
|---|---|
| MAX (`max.co.nz`) | Shopify `/products.json` |
| Robyn Reynolds (`robynreynolds.co.nz`) | Shopify `/products.json` |
| Seasalt Cornwall | schema.org JSON-LD |
| Designer Wardrobe | `window.__NUXT__` payload evaluated in a `node:vm` sandbox |
| KILT (`kiltonline.co.nz`) | HTML product-card parse (no structured data available) |

Every adapter's output passes an apparel filter and a de-duplicator: boutiques sell
artwork, gift cards and homeware alongside clothes, and the same garment often appears
under several handles.

`POST /api/catalogue/refresh` writes `catalogue.local.json` with `source` and `fetchedAt`.
The app always reads the cached file, so it works offline and never blocks on a retailer.

Gap analysis becomes a coverage matrix (slot × formality × warmth × colour role) scored
against the activity profiles; it recommends the staple that fills the emptiest cell.

### 6. Corrections (`rules.ts`)

The free-text "log styling mistake" box becomes a structured form. Each correction
appends a typed rule to `style-guide.json`:

- `pair-ban` — never put these two together
- `occasion-ban` — never use this item for this activity
- `formality-adjust` / `warmth-adjust` — nudge a garment's derived traits
- `slot-dislike` — don't use this item in this role

Rules key on `masterId ?? id` so they survive the same garment appearing in several
season capsules. `memories.md` is kept as a human-readable audit log so the existing
ledger UI still works.

## Files

**New:** `src/engine/*.ts`, `style-guide.json`, `catalogue.seed.json`, `src/engine/engine.test.ts`
**Changed:** `server.ts` (≈600 lines of prompts deleted), `src/components/OutfitBuilder.tsx`
(structured correction form), `src/App.tsx` (dead duplicate fetch, error copy), `src/types.ts`,
`package.json`, `README.md`, `.env.example`, `metadata.json`
**Removed:** `@google/genai` dependency, `GEMINI_API_KEY`, `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`

## Testing

One `src/engine/engine.test.ts` run under `node --test` via tsx:

- harmony maths on known hex pairs (navy/camel analogous, red/green complementary)
- a Sunday Church request never returns a banned item
- same seed ⇒ identical output; a different day ⇒ different output
- the realiser never emits an unfilled template placeholder
- gap analysis on a wardrobe with no shoes recommends footwear

## Known ceilings

- Formality and warmth come from keyword lexicons, not measurement. Unknown garments
  fall back to mid-range with low confidence.
- Beam search is O(slots × width × pool); fine to roughly 500 items per capsule.
- KILT and Designer Wardrobe adapters parse unstructured markup and will break when
  those sites change. They degrade to "source unavailable", never to a crash.
- The Designer Wardrobe adapter executes that site's own page script in a `node:vm`
  context. `vm` is a barrier, not a security boundary. Enabled at the user's explicit
  request; disable that source to stop it.
