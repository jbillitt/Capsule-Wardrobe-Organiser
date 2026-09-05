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

**In `data/wardrobe.json`, next to the app.** The server owns the wardrobe; the browser
keeps a copy only as an offline cache. That copy is `localStorage`, which is tied to one
machine, one browser profile and one address, capped at about 5 MB, and erased by
anything that clears site data — it was lost exactly that way once, which is why the
file on disk is now the authoritative one.

The file is gitignored: it is her data, not the app's.

Rules the store is built around:

- **A save that would empty a non-empty wardrobe is refused** unless it was explicitly
  asked for. A stray empty array from the browser is how the data went the first time.
- **Every overwrite snapshots the previous version** into `data/backups/`, 30 deep.
- **Data we cannot read is never replaced.** An unparseable `wardrobe.json` is renamed
  to `wardrobe.json.unreadable.<time>` rather than deleted; the same rule applies to the
  browser cache, where saving is switched off until you restore something known-good.
- Writes go through a temp file and a rename, so a crash mid-write cannot truncate it.

On first run against an existing browser wardrobe, the app lifts it onto disk
automatically and says so. If the server is not running, the app still works from the
browser cache and warns that this is the only copy.

If something looks wrong:

- **Backup** in the header writes a JSON file containing every garment *and its
  photos*. The CSV export cannot carry images. This is the way to move a wardrobe to
  another computer.
- **Restore** reads that file back. It also accepts a bare array of items, so a
  wardrobe rescued by hand out of another browser's storage can be pasted straight in.
- The **stethoscope button** prints a diagnostics report: which origin you are on, how
  many items loaded, how many bytes are stored, the seasons and categories present, every
  storage key on that origin (flagging any that look like a wardrobe), and a log of
  anything that failed. "Copy report" puts it on the clipboard.

Seeing exactly ten sample garments means nothing was found on disk *or* in the browser —
the banner will say so, and the report will show where it looked.

### Recovering a wardrobe that has gone missing

This is for wardrobes lost *before* `data/wardrobe.json` existed, when the browser was
the only copy. Check `data/backups/` first — if the wardrobe was ever saved to disk, an
older version of it is in there.

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
