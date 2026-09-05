import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

import { WardrobeItem } from "./src/types";
import { guessCategory } from "./src/data";
import { traitsIndex, traitsFor } from "./src/engine/lexicon";
import { buildContext, applyTraitRules, keyOf } from "./src/engine/score";
import { suggestOutfits, dailySeed, diagnose } from "./src/engine/select";
import { realiseOutfit, realiseItemAdvice, realiseCapsule } from "./src/engine/realise";
import { searchByVibe, analyseGaps } from "./src/engine/catalogue";
import { fetchAll } from "./src/engine/retail";
import { nameToHex } from "./src/engine/colour";
import * as store from "./src/engine/rules";
import * as wardrobeStore from "./src/wardrobeStore";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

// -------------------------------------------------------------------------
// SERVER ENDPOINTS
//
// No AI, no API keys. Every response below is produced by the styling engine
// in src/engine: a scored rulebook plus a template language engine.
// -------------------------------------------------------------------------


// -------------------------------------------------------------------------
// THE WARDROBE ITSELF
//
// Authoritative copy on disk, in data/wardrobe.json, with rolling snapshots.
// The browser keeps a copy too, but only as an offline cache.
// -------------------------------------------------------------------------

app.get("/api/wardrobe", (_req, res) => {
  try {
    const stored = wardrobeStore.readWardrobe();
    res.json({
      found: Boolean(stored),
      wardrobe: stored?.wardrobe ?? [],
      outfits: stored?.outfits ?? [],
      updatedAt: stored?.updatedAt ?? null,
      info: wardrobeStore.storeInfo(),
    });
  } catch (err: any) {
    console.error("wardrobe read failed:", err);
    res.status(500).json({ error: "Could not read the wardrobe", details: err.message });
  }
});

app.put("/api/wardrobe", (req, res) => {
  try {
    const { wardrobe, outfits, allowEmpty } = req.body || {};
    if (!Array.isArray(wardrobe)) {
      return res.status(400).json({ error: "A wardrobe array is required" });
    }
    const outcome = wardrobeStore.writeWardrobe(wardrobe, Array.isArray(outfits) ? outfits : [], Boolean(allowEmpty));
    if (!outcome.ok) {
      console.warn(`[wardrobe] ${outcome.message}`);
      return res.status(409).json(outcome);
    }
    res.json({ ...outcome, info: wardrobeStore.storeInfo() });
  } catch (err: any) {
    console.error("wardrobe save failed:", err);
    res.status(500).json({ error: "Could not save the wardrobe", details: err.message });
  }
});

app.get("/api/wardrobe/backups", (_req, res) => {
  res.json({ backups: wardrobeStore.listBackups(), info: wardrobeStore.storeInfo() });
});

app.get("/api/wardrobe/backups/:file", (req, res) => {
  const backup = wardrobeStore.readBackup(req.params.file);
  if (!backup) return res.status(404).json({ error: "No such backup" });
  res.json(backup);
});

// -------------------------------------------------------------------------
// STYLING ENGINE ENDPOINTS
// -------------------------------------------------------------------------

/** Context for the endpoints that reason about a single item rather than an outfit. */
function soloContext(activity?: string, season?: string) {
  const guide = store.loadGuide();
  return buildContext(guide, new Map(), activity, season);
}

// Enrich one garment: hex, standard category, style tags, styling advice.
app.post("/api/style/analyze-item", (req, res) => {
  try {
    const body = req.body || {};
    if (!body.item) return res.status(400).json({ error: "Item name is required" });

    const item: WardrobeItem = {
      id: body.id || "probe",
      item: body.item,
      color: body.color || "",
      hex: body.hex || nameToHex(body.color),
      description: body.description || "",
      brand: body.brand || "",
      notes: body.notes || "",
      status: body.status || "existing",
      season: body.season,
    };

    const traits = traitsFor(item);
    const ctx = soloContext(undefined, body.season);
    const advice = realiseItemAdvice(item, traits, ctx);

    res.json({
      hex: traits.hex,
      aiSuggestedCategory: traits.category,
      aiStyleTags: advice.aiStyleTags,
      aiStylingAdvice: advice.aiStylingAdvice,
      formality: traits.formality,
      warmth: traits.warmth,
      slot: traits.slot,
      confidence: Number(traits.confidence.toFixed(2)),
    });
  } catch (error: any) {
    console.error("analyze-item failed:", error);
    res.status(500).json({ error: "Could not analyse item", details: error.message });
  }
});

// The core styling engine: score every viable combination, return the day's three.
app.post("/api/style/suggest-outfits", (req, res) => {
  try {
    const { items, objective, activity, capsule, seed } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "A list of clothing items is required" });
    }

    const guide = store.loadGuide();
    const traits = traitsIndex(items);
    applyTraitRules(traits, items, guide);

    // The activity name is embedded in the objective string the UI sends.
    const activityText = [activity, objective].filter(Boolean).join(" ");
    const season = items.find((i: WardrobeItem) => i.season)?.season;
    const ctx = buildContext(guide, traits, activityText, season);

    const usedSeed = seed || dailySeed(ctx.activity.label, capsule || "all");
    const chosen = suggestOutfits(items, ctx, { count: 3, seed: usedSeed });

    if (!chosen.length) {
      return res.json({
        outfits: [],
        seed: usedSeed,
        activity: ctx.activity.label,
        diagnostics: diagnose(items, ctx),
      });
    }

    const outfits = chosen.map(outfit => {
      const realised = realiseOutfit(outfit, ctx, usedSeed);
      return {
        name: realised.name,
        description: realised.description,
        itemIds: realised.items.map(i => i.id),
        occasion: realised.occasion,
        aesthetic: realised.aesthetic,
        stylingNotes: realised.stylingNotes,
        whyItWorks: realised.whyItWorks,
        score: realised.score,
        itemSlots: Object.fromEntries(realised.items.map(i => [i.id, traits.get(i.id)?.slot || "base"])),
      };
    });

    res.json({ outfits, seed: usedSeed, activity: ctx.activity.label, diagnostics: [] });
  } catch (error: any) {
    console.error("suggest-outfits failed:", error);
    res.status(500).json({ error: "Failed to generate outfits", details: error.message });
  }
});

// Vibe search over the staple catalogue plus whatever the retail refresh cached.
app.post("/api/style/explore-ideas", (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query) return res.status(400).json({ error: "Vibe or clothing search query is required" });

    const entries = searchByVibe(store.loadCatalogue(), query, 4);
    res.json(
      entries.map(e => ({
        item: e.item,
        color: e.color,
        hex: e.hex,
        brand: e.brand,
        description: e.description,
        notes: e.notes || (e.url ? `Listed at ${e.brand}${e.price ? ` for ${e.price}` : ""}.` : ""),
        aiSuggestedCategory: e.category,
        source: e.source,
        url: e.url,
      }))
    );
  } catch (error: any) {
    console.error("explore-ideas failed:", error);
    res.status(500).json({ error: "Failed to explore style ideas", details: error.message });
  }
});

// Capsule-level summary: keywords, narrative, and a note suggestion per garment.
app.post("/api/style/summarize-capsule", (req, res) => {
  try {
    const { items, season } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items provided for analysis" });
    }

    const guide = store.loadGuide();
    const traits = traitsIndex(items);
    applyTraitRules(traits, items, guide);
    const ctx = buildContext(guide, traits, undefined, season);

    res.json(realiseCapsule(items, traits, ctx, season || "Active Season"));
  } catch (error: any) {
    console.error("summarize-capsule failed:", error);
    res.status(500).json({ error: "Failed to compile style summary", details: error.message });
  }
});

// Coverage matrix over slot, formality, warmth and colour role.
app.post("/api/style/analyze-gaps", (req, res) => {
  try {
    const { items, season } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No clothing items found to check for gaps." });
    }

    const guide = store.loadGuide();
    const traits = traitsIndex(items);
    applyTraitRules(traits, items, guide);

    res.json(analyseGaps(items, traits, store.loadCatalogue(), guide, season || "default"));
  } catch (error: any) {
    console.error("analyze-gaps failed:", error);
    res.status(500).json({ error: "Failed to evaluate gaps", details: error.message });
  }
});

// Spreadsheet tab names to the six standard categories.
app.post("/api/style/condense-categories", (req, res) => {
  try {
    const { categories } = req.body || {};
    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: "No category names input for condensation" });
    }
    const categoryMapping: Record<string, string> = {};
    for (const category of categories) categoryMapping[category] = guessCategory(category);
    res.json({ categoryMapping });
  } catch (error: any) {
    console.error("condense-categories failed:", error);
    res.status(500).json({ error: "Failed to map standard categories", details: error.message });
  }
});

// The activity list and palette, so the UI can offer what the guide defines.
app.get("/api/style/guide", (_req, res) => {
  try {
    const guide = store.loadGuide();
    res.json({
      activities: guide.activities.map(a => ({ label: a.label, aesthetic: a.aesthetic, formality: a.formality })),
      aesthetics: Object.keys(guide.aesthetics),
      palette: guide.palette,
      ruleCount: guide.rules.length,
      catalogue: store.localCatalogueInfo(),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Could not read the style guide", details: error.message });
  }
});

// -------------------------------------------------------------------------
// LEARNED CORRECTIONS
// -------------------------------------------------------------------------

// Structured correction: becomes a typed rule the scorer provably obeys.
app.post("/api/memory/wrong", (req, res) => {
  try {
    const { kind, key, label, otherKey, otherLabel, activity, slot, delta, note, outfitName } = req.body || {};
    if (!kind || !key) {
      return res.status(400).json({ error: "A correction needs a kind and the garment it applies to." });
    }
    const rule = store.addCorrection({ kind, key, label, otherKey, otherLabel, activity, slot, delta, note, outfitName });
    res.json({ success: true, rule, message: "Rule saved. The engine will obey it from the next suggestion on." });
  } catch (err: any) {
    console.error("Could not save correction:", err);
    res.status(500).json({ error: "Failed to persist the correction", details: err.message });
  }
});

app.get("/api/memory/list", (_req, res) => {
  try {
    res.json({ content: store.readMemories(), rules: store.listRules() });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve corrections", details: err.message });
  }
});

app.delete("/api/memory/rule/:id", (req, res) => {
  try {
    const removed = store.deleteRule(req.params.id);
    res.json({ success: removed, rules: store.listRules() });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete rule", details: err.message });
  }
});

app.post("/api/memory/clear", (_req, res) => {
  try {
    store.clearRules();
    res.json({ success: true, message: "All learned rules cleared." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to reset rules", details: err.message });
  }
});

// -------------------------------------------------------------------------
// RETAIL CATALOGUE
// -------------------------------------------------------------------------

app.get("/api/catalogue/info", (_req, res) => {
  const guide = store.loadGuide();
  res.json({
    ...store.localCatalogueInfo(),
    total: store.loadCatalogue().length,
    sources: guide.retailSources,
  });
});

// Refresh the cached catalogue from the configured stores. Nothing else in the
// app ever hits a retailer, so a slow or dead shop can only affect this call.
app.post("/api/catalogue/refresh", async (req, res) => {
  try {
    const guide = store.loadGuide();
    const only: string[] | undefined = req.body?.sources;
    const sources = guide.retailSources.filter(s => (only ? only.includes(s.id) : s.enabled));

    const results = await fetchAll(sources.map(s => ({ ...s, enabled: true })));
    const entries = results.flatMap(r => r.entries);
    if (entries.length) store.saveLocalCatalogue(entries);

    res.json({
      success: true,
      fetched: entries.length,
      results: results.map(({ entries: _entries, ...summary }) => summary),
      info: store.localCatalogueInfo(),
    });
  } catch (err: any) {
    console.error("catalogue refresh failed:", err);
    res.status(500).json({ error: "Catalogue refresh failed", details: err.message });
  }
});

// -------------------------------------------------------------------------
// IMAGE LOOKUP (no AI, no credits - these are left as they were)
// -------------------------------------------------------------------------

app.post("/api/image-search", async (req, res) => {
  const { item, color, brand } = req.body || {};
  try {
    if (!item) {
      return res.status(400).json({ error: "Item name is required for image search" });
    }

    // Build search query: brand + color + item + " clothing style"
    const queryParts = [];
    if (brand && brand.toLowerCase() !== "classic" && brand.toLowerCase() !== "unbranded") {
      queryParts.push(brand);
    }
    if (color) {
      queryParts.push(color);
    }
    queryParts.push(item);
    
    const searchQuery = queryParts.join(" ") + " style";
    const searchUrl = `https://unsplash.com/s/photos/${encodeURIComponent(searchQuery)}`;
    
    // Add headers to look like a standard browser request
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (!response.ok) {
      // Unsplash rate limit or scraper protection can yield a 401/403. Fall back to high-quality Flickr CC apparel photos!
      console.warn(`\n[IMAGE CODES]: Unsplash search yielded ${response.status} (blocked/rate-limited). Switching to high-quality Flickr fashion visual matching for: "${item}"...\n`);
      const fallbackUrl = `https://loremflickr.com/400/450/fashion,clothing,${encodeURIComponent(item.toLowerCase().replace(/[^a-z0-9]/g, ""))}`;
      return res.json({ imageUrl: fallbackUrl });
    }

    const html = await response.text();

    // Look for Unsplash photo URLs
    // Unsplash photographic URLs are like: https://images.unsplash.com/photo-1539109136881-3be0616acf4b
    const photoRegex = /https:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9\-_]+/g;
    const matches = html.match(photoRegex);

    if (matches && matches.length > 0) {
      const uniqueMatches = Array.from(new Set(matches));
      // First, filter out any matches containing "profile" or "avatar" or un-aesthetic ones if any.
      // Unsplash search results are usually the first few matches on the page.
      const firstPhoto = uniqueMatches[0];
      const optimizedUrl = `${firstPhoto}?auto=format&fit=crop&w=400&h=450&q=80`;
      return res.json({ imageUrl: optimizedUrl });
    }

    // Fallback if no images found in HTML page
    const fallbackUrl = `https://loremflickr.com/400/450/fashion,clothing,${encodeURIComponent(item.toLowerCase().replace(/[^a-z0-9]/g, ""))}`;
    res.json({ imageUrl: fallbackUrl });
  } catch (error: any) {
    console.warn("\n[IMAGE CODES]: Web image locator search had a connection issue. Using stable Flickr fashion fallback.");
    const fallbackUrl = `https://loremflickr.com/400/450/fashion,clothing,${encodeURIComponent(item?.toLowerCase()?.replace(/[^a-z0-9]/g, "") || "apparel")}`;
    res.json({ imageUrl: fallbackUrl }); // Fallback gracefully
  }
});


// Endpoint 5: Page Url Retail Image Scraper - scrapes og:image or high-quality product images from custom domains
app.post("/api/scrape-image", async (req, res) => {
  const { url } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: "No URL was entered. Please provide a storefront or catalog link." });
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return res.status(400).json({ error: "Only valid HTTP and HTTPS URLs can be scraped." });
    }
  } catch (e) {
    return res.status(400).json({ error: "Please enter a valid webpage URL link." });
  }

  try {
    console.log(`\n[SCRAPER]: Fetching URL: ${url} ...\n`);
    const fResponse = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      },
      redirect: "follow"
    });

    if (!fResponse.ok) {
      return res.status(400).json({ error: `The store page couldn't be requested. (HTTP Status ${fResponse.status})` });
    }

    const html = await fResponse.text();

    // 1. Look for og:image tags
    const ogRegex = /<meta\s+[^>]*property=["']og:image["']\s+content=["']([^"']+)["']/i;
    const ogRegexReverse = /<meta\s+[^>]*content=["']([^"']+)["']\s+property=["']og:image["']/i;
    const twitterRegex = /<meta\s+[^>]*name=["']twitter:image["']\s+content=["']([^"']+)["']/i;
    const twitterRegexReverse = /<meta\s+[^>]*content=["']([^"']+)["']\s+name=["']twitter:image["']/i;
    const itemPropRegex = /<meta\s+[^>]*itemprop=["']image["']\s+content=["']([^"']+)["']/i;
    const itemPropRegexReverse = /<meta\s+[^>]*content=["']([^"']+)["']\s+itemprop=["']image["']/i;

    let scrapeUrl = "";
    const matchOg = html.match(ogRegex) || html.match(ogRegexReverse);
    const matchTwitter = html.match(twitterRegex) || html.match(twitterRegexReverse);
    const matchItemProp = html.match(itemPropRegex) || html.match(itemPropRegexReverse);

    if (matchOg) {
      scrapeUrl = matchOg[1];
    } else if (matchTwitter) {
      scrapeUrl = matchTwitter[1];
    } else if (matchItemProp) {
      scrapeUrl = matchItemProp[1];
    } else {
      // Find standard high resolution images
      const imgRegex = /<img\s+[^>]*src=["']([^"']+)["']/gi;
      let match;
      const images: string[] = [];
      while ((match = imgRegex.exec(html)) !== null) {
        images.push(match[1]);
      }
      
      const productImg = images.find(img => {
        const lower = img.toLowerCase();
        return (lower.includes("product") || lower.includes("garment") || lower.includes("model") || lower.includes("detail") || lower.includes("goods") || lower.includes("media"));
      });
      scrapeUrl = productImg || images.find(img => !img.includes("logo") && !img.includes("icon")) || images[0] || "";
    }

    if (scrapeUrl) {
      scrapeUrl = scrapeUrl.replace(/&amp;/g, "&");

      // Resolve relative links
      if (scrapeUrl.startsWith("//")) {
        scrapeUrl = "https:" + scrapeUrl;
      } else if (scrapeUrl.startsWith("/")) {
        const origin = new URL(url).origin;
        scrapeUrl = origin + scrapeUrl;
      } else if (!scrapeUrl.startsWith("http://") && !scrapeUrl.startsWith("https://") && !scrapeUrl.startsWith("data:")) {
        const origin = new URL(url).origin;
        scrapeUrl = origin + "/" + scrapeUrl;
      }

      console.log(`[SCRAPER]: Success! Found scraped image link: ${scrapeUrl}`);
      return res.json({ imageUrl: scrapeUrl });
    }

    return res.status(404).json({ error: "No clothing display photo could be scraped from this storefront. Try entering a direct image URL instead." });
  } catch (err: any) {
    console.error("[SCRAPER ERROR]:", err);
    return res.status(500).json({ error: "Unable to access domain. The host might be blocking automated request visits. Please paste a direct image link or upload a local photo file instead.", details: err.message });
  }
});


// -------------------------------------------------------------------------
// VITE OR STATIC SERVING MIDDLEWARE
// -------------------------------------------------------------------------

async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
