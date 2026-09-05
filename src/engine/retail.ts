/**
 * Retail adapters. Read real product listings without an AI, a paid API, or a
 * headless browser, then map them into catalogue entries with the same lexicon
 * the wardrobe itself is scored with.
 *
 * Everything is cached to catalogue.local.json. The app never fetches a
 * retailer to answer a request, so it works offline and never blocks on a shop
 * being slow or down.
 */

import vm from "node:vm";
import { CatalogueEntry } from "./catalogue";
import { traitsFor, recognisedGarment } from "./lexicon";
import { nameToHex, findColourName } from "./colour";
import { guessCategory } from "../data";

export interface RetailSource {
  id: string;
  label: string;
  adapter: string;
  url: string;
  enabled: boolean;
}

export interface FetchResult {
  source: string;
  ok: boolean;
  count: number;
  note?: string;
  entries: CatalogueEntry[];
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function get(url: string, timeoutMs = 20000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/json,*/*" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Boutiques sell more than clothes. Robyn Reynolds is a painter as well as a
 * designer, and 44 of her 68 listings are artworks - without this filter they
 * arrive as phantom garments the engine will happily suggest you wear.
 */
const NON_APPAREL =
  /\b(art|artwork|painting|print|canvas|gift.?card|voucher|homeware|candle|book|mug|cushion|blanket|soap|card|poster|frame|ticket|workshop|sample)\b/i;

function isApparel(title: string, type: string, hasFabricOrColour: boolean): boolean {
  if (NON_APPAREL.test(type)) return false;
  // A garment word in the title is the strongest signal we have.
  if (recognisedGarment(title)) return true;
  if (NON_APPAREL.test(title)) return false;
  // Nothing recognised at all and no fabric or colour to go on: not clothing.
  return hasFabricOrColour;
}

/**
 * Shopify product_type is a breadcrumb: "Dresses / Short Sleeve Dresses", but
 * also "Non-Apparel / Socks". The LAST segment is the specific one, and the
 * first can be a junk bucket that categorises socks as tops.
 */
export function categoryFromType(type: string, title: string): string {
  const segments = String(type || "")
    .split("/")
    .map(s => s.trim())
    .filter(Boolean)
    .reverse();

  for (const segment of [...segments, title]) {
    const guess = guessCategory(segment);
    // "Tops" is guessCategory's default, so it is the one answer that might
    // mean "nothing matched" rather than "this is a top".
    if (guess !== "Tops") return guess;
  }
  return "Tops";
}

function absolute(base: string, path: string): string {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}

/**
 * Derive the numeric traits from the same lexicon the wardrobe uses, so a
 * retail item and an owned garment are scored on identical terms.
 */
function toEntry(
  source: string,
  raw: {
    id: string;
    item: string;
    color: string;
    brand: string;
    description: string;
    notes?: string;
    url?: string;
    price?: string;
    category?: string;
    /** The retailer's own type label, used to reject non-clothing. */
    type?: string;
  }
): CatalogueEntry | null {
  // Retailers frequently leave the colour field empty and put the colourway in
  // the title, the handle or a tag instead.
  const colour = raw.color || findColourName(`${raw.item} ${raw.notes || ""} ${raw.url || ""}`) || "";
  const hex = nameToHex(colour || raw.item);
  const traits = traitsFor({
    id: raw.id,
    item: raw.item,
    color: colour,
    hex,
    description: raw.description,
    brand: raw.brand,
    notes: raw.notes || "",
    status: "buy",
  });

  if (!isApparel(raw.item, raw.type || "", Boolean(traits.textures.length || colour))) return null;

  return {
    id: `${source}-${raw.id}`,
    item: raw.item,
    category: raw.category || guessCategory(raw.item),
    color: colour || "Unspecified",
    hex,
    brand: raw.brand,
    fabric: traits.textures[0] || "",
    formality: traits.formality,
    warmth: traits.warmth,
    aesthetics: [],
    description: raw.description.slice(0, 220),
    notes: raw.notes || "",
    source,
    url: raw.url,
    price: raw.price,
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Shopify: /products.json. Structured, paginated, no scraping.
// ---------------------------------------------------------------------------

async function shopifyAdapter(source: RetailSource, limit: number): Promise<CatalogueEntry[]> {
  const entries: CatalogueEntry[] = [];
  const perPage = 250;

  for (let page = 1; entries.length < limit && page <= 4; page++) {
    const body = await get(`${source.url.replace(/\/$/, "")}/products.json?limit=${perPage}&page=${page}`);
    const data = JSON.parse(body);
    const products: any[] = data.products || [];
    if (!products.length) break;

    for (const p of products) {
      if (entries.length >= limit) break;

      const colourOption = (p.options || []).find((o: any) => /colou?r/i.test(o.name));
      // Some stores expose colourways as variants; others ship one product per
      // colour and hide the name in a SKU tag like "330431CTN_Chocolate Chip".
      const tagColour = (p.tags || [])
        .map((t: string) => t.match(/^[A-Za-z0-9]+_(.+)$/)?.[1])
        .find(Boolean);
      // One entry per colourway, capped: a 12-colour tee is not 12 ideas.
      const colours: string[] = colourOption?.values?.slice(0, 2) || [tagColour || ""];
      const price = p.variants?.[0]?.price ? `$${p.variants[0].price}` : undefined;

      for (const colour of colours) {
        const entry = toEntry(source.id, {
          id: `${p.id}-${colour || "default"}`,
          item: p.title,
          color: colour,
          brand: p.vendor || source.label,
          description: stripHtml(p.body_html || ""),
          notes: (p.tags || []).slice(0, 4).join(", "),
          url: `${source.url.replace(/\/$/, "")}/products/${p.handle}`,
          price,
          category: categoryFromType(p.product_type || "", p.title),
          type: p.product_type || "",
        });
        if (entry) entries.push(entry);
      }
    }
    if (products.length < perPage) break;
  }

  return entries;
}

// ---------------------------------------------------------------------------
// schema.org JSON-LD: what most modern storefronts emit for search engines.
// ---------------------------------------------------------------------------

function collectProducts(node: any, out: any[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) collectProducts(n, out);
    return;
  }
  const type = node["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes("Product")) out.push(node);
  for (const key of ["itemListElement", "item", "@graph", "mainEntity", "hasPart"]) {
    if (node[key]) collectProducts(node[key], out);
  }
}

async function jsonLdAdapter(source: RetailSource, limit: number): Promise<CatalogueEntry[]> {
  const html = await get(source.url);
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];

  const products: any[] = [];
  for (const block of blocks) {
    try {
      collectProducts(JSON.parse(block[1].trim()), products);
    } catch {
      // A malformed block is not worth failing the whole source over.
    }
  }

  return products
    .slice(0, limit)
    .map((p, idx) =>
      toEntry(source.id, {
        id: String(p.sku || p.productID || idx),
        item: String(p.name || "Product"),
        color: String(p.color || ""),
        brand: String(p.brand?.name || p.brand || source.label),
        description: stripHtml(String(p.description || "")),
        url: absolute(source.url, String(p.url || p.offers?.url || "")),
        price: p.offers?.price ? `$${p.offers.price}` : undefined,
        category: categoryFromType(String(p.category || ""), String(p.name || "")),
        type: String(p.category || ""),
      })
    )
    .filter((e): e is CatalogueEntry => e !== null);
}

// ---------------------------------------------------------------------------
// KILT: no JSON-LD, no og: tags, no feed. Product tiles are parsed out of the
// ASPX markup directly.
//
// ponytail: regex over markup, will break when KILT redesigns. It fails to
// "source unavailable" rather than throwing; upgrade path is a real DOM parser
// only if this needs to survive redesigns unattended.
// ---------------------------------------------------------------------------

async function kiltAdapter(source: RetailSource, limit: number): Promise<CatalogueEntry[]> {
  const html = await get(source.url, 30000);
  const tiles = html.split('class="stylesummarybox"').slice(1);

  const entries: CatalogueEntry[] = [];
  for (const [idx, tile] of tiles.entries()) {
    if (entries.length >= limit) break;

    const link = tile.match(/href="(https?:\/\/[^"]+\.aspx)"[^>]*title="([^"]+)"/i);
    if (!link) continue;
    const url = link[1];
    const name = link[2].trim();

    const price = tile.match(/spn_P1[^>]*>\s*([^<]+?)\s*</i)?.[1];
    // The swatch alt text is the only place the colour name appears.
    const colour = tile.match(/class="swatch-image[^"]*"[\s\S]{0,200}?<img[^>]*alt="([^"]+)"/i)?.[1];

    const entry = toEntry(source.id, {
      id: url.split("/").pop()?.replace(".aspx", "") || String(idx),
      item: name,
      color: colour || "",
      brand: "KILT",
      description: `${name}${colour ? ` in ${colour}` : ""}. New Zealand made.`,
      url,
      price,
    });
    if (entry) entries.push(entry);
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Designer Wardrobe: a Nuxt app whose grid is client-rendered. The listings do
// exist in the window.__NUXT__ payload, but that payload is a minified IIFE,
// not JSON, so reading it means running it.
//
// It runs in a node:vm context with no globals, no require and a hard timeout.
// That is a real barrier but NOT a security boundary - Node documents vm as
// escapable. This source therefore ships disabled in style-guide.json; turning
// it on means choosing to execute a third party's JavaScript on this machine.
//
// ponytail: sandboxed eval of remote JS. Upgrade path is a headless browser or
// an official API, either of which removes the need to run their code here.
// ---------------------------------------------------------------------------

function extractNuxtPayload(html: string): any | null {
  const start = html.indexOf("__NUXT__");
  if (start < 0) return null;
  const end = html.indexOf("</script>", start);
  if (end < 0) return null;

  const assignment = html.slice(start, end);
  const expression = assignment.replace(/^__NUXT__\s*=\s*/, "").replace(/;\s*$/, "");

  const context = vm.createContext(Object.create(null));
  try {
    return vm.runInContext(`(${expression})`, context, { timeout: 2000 });
  } catch {
    return null;
  }
}

function looksLikeListing(node: any): boolean {
  return Boolean(
    node &&
      typeof node === "object" &&
      (node.title || node.name) &&
      (node.Brand || node.brand || node.brand_name) &&
      (node.price ?? node.price_nzd ?? node.price_cents) !== undefined
  );
}

/**
 * Walk an arbitrary object for marketplace listings. Their search results wrap
 * each row in a { data: ... } envelope, so unwrap that before testing.
 */
function collectListings(node: any, out: any[], depth = 0): void {
  if (!node || typeof node !== "object" || depth > 8 || out.length > 500) return;

  if (Array.isArray(node)) {
    for (const n of node) collectListings(n, out, depth + 1);
    return;
  }

  const row = looksLikeListing(node.data) ? node.data : node;
  if (looksLikeListing(row)) {
    out.push(row);
    return;
  }

  for (const value of Object.values(node)) collectListings(value, out, depth + 1);
}

async function nuxtAdapter(source: RetailSource, limit: number): Promise<CatalogueEntry[]> {
  const html = await get(source.url, 30000);
  const payload = extractNuxtPayload(html);
  if (!payload) return [];

  const listings: any[] = [];
  collectListings(payload, listings);

  const seen = new Set<string>();
  const entries: CatalogueEntry[] = [];
  for (const l of listings) {
    if (entries.length >= limit) break;

    // It is a second-hand marketplace: a sold listing is not a suggestion.
    if (l.is_sold || l.is_deleted || l.is_expired || l.is_available === false) continue;

    const title = String(l.title || l.name || "").trim();
    if (!title || seen.has(title)) continue;
    seen.add(title);

    const brand = String(l.Brand?.name || l.brand?.name || l.brand_name || l.brand || source.label);
    // Colour arrives as "Black,White,Brown"; the first is the dominant one.
    const colour = String(l.colour || l.color || "").split(",")[0].trim();
    const priceValue = l.price ?? l.price_nzd ?? (l.price_cents ? l.price_cents / 100 : undefined);

    const category = String(l.Category?.name || l.category?.name || l.parent_categories_string || l.category || "");

    const entry = toEntry(source.id, {
      id: String(l.id || l.url_title || title),
      item: title,
      color: colour,
      brand,
      description: stripHtml(String(l.description || `${brand} ${title}, second-hand.`)),
      notes: [l.condition ? `Condition: ${l.condition}` : "", category].filter(Boolean).join(". "),
      url: l.url ? absolute(source.url, String(l.url)) : source.url,
      price: priceValue !== undefined ? `$${priceValue}` : undefined,
      category: categoryFromType(category, title),
      type: category,
    });
    if (entry) entries.push(entry);
  }

  return entries;
}

// ---------------------------------------------------------------------------

const ADAPTERS: Record<string, (s: RetailSource, limit: number) => Promise<CatalogueEntry[]>> = {
  shopify: shopifyAdapter,
  jsonld: jsonLdAdapter,
  kilt: kiltAdapter,
  nuxt: nuxtAdapter,
};

export async function fetchSource(source: RetailSource, limit = 80): Promise<FetchResult> {
  const adapter = ADAPTERS[source.adapter];
  if (!adapter) {
    return { source: source.id, ok: false, count: 0, note: `no adapter "${source.adapter}"`, entries: [] };
  }
  try {
    const raw = await adapter(source, limit);

    // The same garment often appears under several handles or colourway rows.
    const seen = new Set<string>();
    const entries = raw.filter(e => {
      const key = `${e.item}|${e.color}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const dropped = raw.length - entries.length;
    return {
      source: source.id,
      ok: true,
      count: entries.length,
      note: entries.length
        ? dropped
          ? `${dropped} duplicate${dropped === 1 ? "" : "s"} removed`
          : undefined
        : "source returned no products",
      entries,
    };
  } catch (err: any) {
    // A retailer being down must never break the app.
    return { source: source.id, ok: false, count: 0, note: err.message, entries: [] };
  }
}

export async function fetchAll(sources: RetailSource[], limit = 80): Promise<FetchResult[]> {
  return Promise.all(sources.filter(s => s.enabled).map(s => fetchSource(s, limit)));
}
