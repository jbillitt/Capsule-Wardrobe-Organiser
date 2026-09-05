# Capsule Wardrobe Studio

An interactive digital closet: import a wardrobe spreadsheet, organise it into season
capsules, and get outfit suggestions with the reasoning shown.

**No AI, no API keys, no credits.** Suggestions come from a scored rulebook and a
template language engine that runs entirely on your machine.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

There is nothing to configure. No `.env`, no key.

```bash
npm test             # the engine's checks
npm run lint         # tsc --noEmit
npm run audit        # how much of the wardrobe does the lexicon recognise?
npm run silhouettes  # render every garment icon to silhouettes.html
```

## Garment silhouettes

Every card draws a shape for the *specific* garment — a boot for a boot, a bag for a
bag — across 37 kinds. The shape is resolved from the garment's **name** through the
same lexicon the styling engine scores with, not from the stored category, because a
spreadsheet import rarely sets one. A garment the lexicon does not recognise draws a
coat hanger rather than pretending to be a t-shirt.

`npm run silhouettes` renders them all to a page and fails if two different kinds
somehow draw the same picture.

## Where the wardrobe actually lives

**In the browser, not in this repo.** It is `localStorage` on one machine, in one
browser profile, at one address. `git pull` does not bring it with you, and
`http://localhost:3000` and `http://localhost:5173` are two different stores.

That makes it the only copy of a lot of typing, so the load path is built around one
rule: **data we cannot read is never overwritten.** A wardrobe that fails to parse is
left exactly as it is, copied to a `capsule_closet_wardrobe.unreadable.<time>` key, and
saving is switched off until you restore something known-good. It is never quietly
replaced with the sample capsule.

If something looks wrong:

- **Backup** in the header writes a JSON file containing every garment *and its
  photos*. The CSV export cannot carry images. This is the only way to move a wardrobe
  to another computer or browser.
- **Restore** reads that file back. It also accepts a bare array of items, so a
  wardrobe rescued by hand out of another browser's storage can be pasted straight in.
- The **stethoscope button** prints a diagnostics report: which origin you are on, how
  many items loaded, how many bytes are stored, the seasons and categories present, every
  storage key on that origin (flagging any that look like a wardrobe), and a log of
  anything that failed. "Copy report" puts it on the clipboard.

Seeing exactly ten sample garments means the browser had nothing saved for that origin —
the banner will say so, and the report will show which origin it looked at.

### Recovering a wardrobe that has gone missing

There is no database in this folder. The server only writes `style-guide.json`,
`memories.md` and the catalogue cache; the wardrobe has never been stored server-side.

Browsers keep localStorage in LevelDB files inside the browser profile, and LevelDB is
append-only — it compacts only occasionally, so a wardrobe that was overwritten in the
app is often still on disk in an older segment.

```bash
# on HER machine, with the browser fully closed
npm run recover

# or point it at one profile
npm run recover -- "C:\Users\<name>\AppData\Local\Google\Chrome\User Data"
```

It reads every Local Storage segment it can find, pulls out anything shaped like a
wardrobe, reports the origin and item count of each, and writes the candidates as
`recovered-wardrobe-<n>-<count>items.json`. Load the largest with **Restore**.

It only reads the profile, and only writes out arrays that really are garments, so
other sites' data is neither touched nor exported.

**Close the browser first.** While it is running it holds a lock and recent writes stay
in an unflushed journal.

If the original spreadsheet still exists, re-importing it is the cleaner route. That
brings back every garment; it loses only photos that were uploaded from disk, since
those are stored inline as data URLs. Photos found automatically are just links and
come back on their own.

## How suggestions are made

`src/engine/` holds the whole thing:

| File | Job |
|---|---|
| `colour.ts` | colour names to hex, hex to HSL, hue-angle harmony bands |
| `lexicon.ts` | garment and fabric keywords to slot, formality, warmth, texture |
| `score.ts` | six weighted signals, producing a score and typed reasons |
| `select.ts` | seeded beam search over the activity's slot template |
| `realise.ts` | reasons to prose |
| `catalogue.ts` | staple catalogue, vibe search, gap coverage |
| `retail.ts` | reading real product listings |
| `rules.ts` | reading and writing what the engine persists |

**Traits come from text you already have.** "Linen button down / Parchment marl linen
shirt" becomes `slot: base, formality: 3, warmth: 1, textures: [linen]`. Unknown
garments get low confidence and are scored conservatively rather than confidently wrong.

**Six signals decide the score:** colour harmony, formality coherence, occasion fit,
style direction, layer weight, and within-outfit diversity. Weights live in
`style-guide.json`. Bans and missing required slots are vetoes, not penalties — an
outfit that breaks a rule is never shown, whatever else it scores.

**Variety is reproducible, not random.** The seed is the date plus the activity plus
the capsule. Ask twice today and you get the same three outfits; tomorrow they change.
Selection is a seeded weighted draw over the top candidates, so good outfits still win
but not always the same good outfits.

**The prose is generated from the reasoning, not decoration on top of it.** The scorer
emits reasons; the realiser turns the strongest two or three into sentences. If nothing
scores strongly, the description says the outfit is serviceable rather than inventing
praise for it. Every card shows a "why this works" list — that is the audit trail behind
the paragraph above it.

## Tuning it

`style-guide.json` is the rulebook, and the engine re-reads it on every request.

- `activities` — matched by keyword, so activities you add in the app still resolve.
  Each carries a formality band, a warmth shift, banned keywords, preferred fabrics,
  a slot template and a voice.
- `aesthetics` — neutral ratio, colour count, texture affinities.
- `weights` — how much each of the six signals counts.
- `seasons` — the warmth each season is aiming at.
- `rules` — written by the app when you correct a suggestion. Don't hand-edit unless
  you mean it.

### Corrections

When a suggestion is wrong, "Log Styling Mistake" records a *typed* rule — never a
pair, never for this occasion, dressier than it reads, and so on. Rules key on
`masterId`, so a correction follows a garment across every capsule it appears in.
`memories.md` keeps the human-readable record of why each rule exists; the ledger in the
app lists the live rules and lets you delete any of them.

## The staple catalogue

`catalogue.seed.json` holds ~100 hand-picked capsule staples used for "explore ideas"
and for gap recommendations.

Real listings can be layered on top:

```bash
npm run catalogue:refresh              # every enabled source
npm run catalogue:refresh max kilt     # named sources
```

That writes `catalogue.local.json` (gitignored). The app only ever reads the cache, so
it works offline and a slow shop can never block a suggestion.

| Source | How it is read | Typical yield |
|---|---|---|
| MAX | Shopify `/products.json` | 80 |
| Robyn Reynolds | Shopify `/products.json` | 35 |
| Seasalt Cornwall | schema.org JSON-LD | 36 |
| Designer Wardrobe | `window.__NUXT__` payload, evaluated in a sandbox | 72 |
| KILT | HTML product tiles — no structured data exists on that site | 80 |

Designer Wardrobe renders its grid client-side, so the listings only exist inside a
minified `window.__NUXT__` function. Reading them means running that function. The
adapter does it in a `node:vm` context with no globals and a hard timeout, which is a
real barrier but *not* a security boundary — Node documents `vm` as escapable. It is
enabled, which means each refresh executes that page's script locally. Set
`enabled: false` on that source in `style-guide.json` if you would rather it didn't.

**Not everything a boutique sells is clothing.** Robyn Reynolds is a painter as well as
a designer — 44 of her 68 listings are artworks. Every adapter's output passes an
apparel filter, so the engine never suggests you wear a painting.

`npm run audit` reports how much of the wardrobe and catalogue the lexicon actually
recognises, and lists whatever it couldn't read. Anything in the "low confidence" bucket
is being scored on assumptions — that number is the honest measure of the mapping.
It currently sits at 99% recognised across 427 garments.

## Known ceilings

- Formality and warmth come from keyword lexicons, not measurement.
- Beam search is fine to roughly 500 garments per capsule.
- The KILT adapter parses markup and will break when that site is redesigned. It fails
  to "source unavailable", never to a crash.
