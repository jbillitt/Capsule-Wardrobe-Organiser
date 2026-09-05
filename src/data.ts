import { WardrobeItem, WardrobeStats } from "./types";

export interface SeasonConfig {
  id: string;
  name: string;
  type: "actual" | "future";
  description: string;
  summaryTitle: string;
  principles: { title: string; desc: string }[];
}

// Full-text aesthetic descriptions of her seasons as outlined in her spreadsheet tabs
export const SEASONS_CONFIG: SeasonConfig[] = [
  {
    id: "all_actual",
    name: "All Collections",
    type: "actual",
    description: "Welcome to your entire overarching wardrobe. This is a comprehensive high-level view of all active clothing items you currently own across every capsule.",
    summaryTitle: "\u26f0\ufe0f Total Wardrobe Synthesis",
    principles: [
      {
        title: "Holistic Overview",
        desc: "Ensure pieces can cross-pollinate between seasons where possible to maximize the lifetime value of garments."
      },
      {
        title: "Trans-seasonal Styling",
        desc: "Identify items like basic tees or light outer-layers that can bridge the gaps between Summer and Autumn effortlessly."
      },
      {
        title: "Identify Redundancies",
        desc: "A wide view helps spot exact duplicates or colors that dominate your overall aesthetic too heavily."
      }
    ]
  },
  {
    id: "Summer 25-26",
    name: "Summer 25-26",
    type: "actual",
    description: "This summer capsule wardrobe maintains a refined, yet relaxed aesthetic that can be categorized as Elevated Casual Chic with a strong focus on breathable fabrics and versatile layering.",
    summaryTitle: "☀️ Summer Style Summary",
    principles: [
      {
        title: "Comfort & Breathability",
        desc: "Focus on comfort and breathability with a high presence of linen, lightweight cotton, and chambray (in dresses, tops, and shorts) making the wardrobe highly functional for hot weather."
      },
      {
        title: "Neutral Base, Soft Accents",
        desc: "The core colors are classic and cool (Navy, Black, White, Cream, Grey), which are instantly elevated by soft, sun-friendly accents like Khaki, Olive Green, and Sage."
      },
      {
        title: "Structured Fluidity",
        desc: "The silhouettes balance structure (Tailored Black Shorts, Tapered Trousers, Trench Coats) with flow (Midi Skirts, Linen Dresses), ensuring outfits look polished, not sloppy."
      },
      {
        title: "Practical Footwear",
        desc: "The choice of flat or low-heel shoe styles (sandals, trainers, loafers, slides, ballet flats) speaks to a lifestyle requiring comfort and ease."
      },
      {
        title: "Layering Capability",
        desc: "Even in summer, the inclusion of button-downs, light cardigans, and lightweight outerwear (trench, denim jackets) provides coverage for air conditioning or cooler evenings."
      }
    ]
  },
  {
    id: "Autumn 26",
    name: "Autumn 26",
    type: "actual",
    description: "🍁 Curated transitional wardrobe pulling layering fundamentals from both summer items and winter storage, accented by new designer garment purchases. Comfortable, rich, and balanced for autumn's golden lighting.",
    summaryTitle: "🍁 Autumn Style Summary",
    principles: [
      {
        title: "Transitional Layering",
        desc: "Pulleys light layers and breezy tanks from the summer capsule and integrates cozy wool blends and merino long sleeves to step seamlessly into cooler winds."
      },
      {
        title: "Silt Tones & Warm Accents",
        desc: "Features a rich base of deep black, greys, and cream, beautifully highlighted with muted silt elements, burnt orange, and washed denim accents."
      },
      {
        title: "Boot Utility & Durability",
        desc: "Ready for transition with premium Blundstone ankle boots in black and brown suede, ensuring perfect comfort."
      }
    ]
  },
  {
    id: "Winter 26",
    name: "Winter 26",
    type: "actual",
    description: "❄️ Nelson Winter Capsule Wardrobe: This wardrobe is strong on versatility, layering, and comfort, making it perfect for Nelson's variable winter weather. Relying heavily on classic neutrals accented by rich jewel tones.",
    summaryTitle: "❄️ Nelson Winter Style Summary",
    principles: [
      {
        title: "Tops & Knits (Versatility for Layering)",
        desc: "Excellent foundation with multiple V-neck tees and fitted tanks for essential layering under cardigans and coats. Crop wool and wrap cardigans provide adjustable heat retention."
      },
      {
        title: "Bottoms & Dresses (Practical & Texture)",
        desc: "Robust dark base of straight-cut ribcage jeans, tapered trousers, and thermal-lined leggings. Cozy warm wools and green corduroy add premium texture."
      },
      {
        title: "Outerwear (Weather Ready)",
        desc: "Essential protection from the elements with a Rains Waterproof Parka/Trench, thick Grey Wool coat, and an unexpected Dark Green denim jacket."
      },
      {
        title: "Accessories & Footwear (Comfort & Pop)",
        desc: "Cherry Red Doc Martens and Blundstone boots ensure waterproof resilience, while the Statement Red Leather Hobo Bag lifts neutral outerwear coats."
      }
    ]
  },
  {
    id: "Handbag Inventory",
    name: "Handbag Inventory",
    type: "actual",
    description: "💼 Accessories & Bag Collection: Minimalist yet highly functional organizer of current leather satchels, textured red hobos, greige totes, and waxed canvas bags. Evaluating carrying capacity and rating comfort.",
    summaryTitle: "💼 Accessories Collection Summary & Quality Grading",
    principles: [
      {
        title: "Graded Leather Patina",
        desc: "Includes premium unlined satchels from The Leather Satchel Company, Yukon full-grain leather, and soft, forgiving lined Etsy hobo findouts."
      },
      {
        title: "Capacities & Accessibility",
        desc: "Carefully outlines compartment space, identifying deep bags that can feel like a 'black hole' versus structured small daisy crossbody bags."
      },
      {
        title: "Utility & Straps",
        desc: "Rates performance from 1 to 5 stars based on strap comfort, hands-free crossbodies, external pockets accessibility, and top handles convenience."
      }
    ]
  },
  {
    id: "Dream AW",
    name: "Dream AW (Future)",
    type: "future",
    description: "⭐️ Dream AW Future Roadmap: A line-by-line dream aspiration planner mapping critical high-quality pieces she wants to acquire for a polished upcoming cold-season wardrobe.",
    summaryTitle: "⭐️ Future Capsule Planning Strategy",
    principles: [
      {
        title: "Coveted Brand Investments",
        desc: "Plan to purchase elite traditional footwear including RM Williams (yearling or gardener boots) and Cheaneys/Glenson brogues."
      },
      {
        title: "Textured Aspiration Patterns",
        desc: "Map classic winter textures including houndstooth wide-leg trousers and Kayla Kilt skirts for a structured traditional twist."
      },
      {
        title: "Strategic Avoidance of Excess",
        desc: "Clearly distinguishes 'Possembled' (E) from 'Target Needs' (Buy) preventing duplicate items and ensuring high wear-frequency ratio."
      }
    ]
  }
];

// Gorgeous initial curated capsule wardrobe.
// Tagged beautifully across her active seasons to showcase the multi-season tabs.
export const initialCuratedWardrobe: WardrobeItem[] = [
  {
    id: "curated-001",
    item: "Linen button down",
    color: "Off White",
    hex: "#eae6df",
    description: "Parchment marl linen shirt",
    brand: "MAX",
    notes: "Ordered in boxing day sale 30% off. Flowy, breathable fabric.",
    status: "existing",
    season: "Summer 25-26",
    aiStyleTags: ["Summer Base", "Linen Cool", "Relaxed Chic"],
    aiStylingAdvice: "Pair loose over linen shorts or straight crop black jeans with cream leather sandals."
  },
  {
    id: "curated-002",
    item: "High waisted denim shorts",
    color: "Mid Wash Blue",
    hex: "#60a5fa",
    description: "Relaxed high rise summer shorts",
    brand: "MAX",
    notes: "Ordered in black Friday sale, 20% off. Perfect soft cotton texture.",
    status: "existing",
    season: "Summer 25-26",
    aiStyleTags: ["Summer Style", "Laidback", "Everyday Base"],
    aiStylingAdvice: "Tuck in a basic white V-neck or fitted black tank. Roll up hem slightly."
  },
  {
    id: "curated-003",
    item: "Cropped length cardigan",
    color: "Black Wool",
    hex: "#1c1917",
    description: "Cropped button merino layer",
    brand: "Max",
    notes: "Pulled from storage for autumn transition. Super cozy wool stretch.",
    status: "existing",
    season: "Autumn 26",
    aiStyleTags: ["Autumn Wear", "Cozy Merino", "Smart Knit"],
    aiStylingAdvice: "Button fully and tuck into tapered cargo pants, or wear layer open over a striped breton top."
  },
  {
    id: "curated-004",
    item: "Straight cut crop jeans",
    color: "Black 501",
    hex: "#3f3f46",
    description: "Classic high waist crop jeans",
    brand: "Levis",
    notes: "Pulled from summer capsule. Great structure and matches black ankle boots.",
    status: "existing",
    season: "Autumn 26",
    aiStyleTags: ["Transition", "Classic Denim", "Edgy Minimal"],
    aiStylingAdvice: "Coordinate with brown suede Blundstones and cream fine knit silk cardigan."
  },
  {
    id: "curated-005",
    item: "Long sleeve dress",
    color: "Dark Green Corduroy",
    hex: "#3d5236",
    description: "Thick winter weight silhouette dress",
    brand: "Farmers",
    notes: "Super warm cotton corduroy fabric. Keeps cold Nelson wind away.",
    status: "existing",
    season: "Winter 26",
    aiStyleTags: ["Nelson Winter", "Rich Corduroy", "Jewel Tone"],
    aiStylingAdvice: "Style with thermal tights, cherry red Doc Martens, and the red leather Hobo bag for contrast."
  },
  {
    id: "curated-006",
    item: "Ankle boots",
    color: "Cherry Red",
    hex: "#58181a",
    description: "Waterproof leather bouncing sole boots",
    brand: "Dr Martens",
    notes: "Extremely durable, excellent for winter rain days and walks.",
    status: "existing",
    season: "Winter 26",
    aiStyleTags: ["Winter Rain", "Color Pop", "Tough Footwear"],
    aiStylingAdvice: "Wear under rolled-up dark indigo jeans with a long charcoal grey wool military coat."
  },
  {
    id: "curated-007",
    item: "Crossbody 'pixie' Bag",
    color: "Black Leather",
    hex: "#111111",
    description: "Expanded unlined crossbody",
    brand: "The Leather Satchel Company",
    notes: "Good size, fits a surprising amount. Elegant look, practical back slip pocket.",
    status: "existing",
    season: "Handbag Inventory",
    aiStyleTags: ["Premium Leather", "5-Star Satchel", "Day & Night"],
    aiStylingAdvice: "Matches cream sandals, black loafers, or Doc Martens effortlessly."
  },
  {
    id: "curated-008",
    item: "Hobo bag",
    color: "Red Leather",
    hex: "#8B5A2B",
    description: "Worn soft forgiving large shoulder carrier",
    brand: "The Leather Store (Etsy)",
    notes: "Matches cherry red Doc Martens. Autumn/Winter staple. Adds perfect splash of color.",
    status: "existing",
    season: "Handbag Inventory",
    aiStyleTags: ["Soft Suede", "Color Burst", "Winter Carrier"],
    aiStylingAdvice: "Perfect pairing with a grey wool coatigan or black trench coat."
  },
  {
    id: "curated-009",
    item: "Ankle boots",
    color: "Brown Leather",
    hex: "#5c4033",
    description: "Classic yearling Chelsea boots",
    brand: "RM Williams",
    notes: "Coveted premium boot investment. Aspirational item on wishlist.",
    status: "buy",
    season: "Dream AW",
    aiStyleTags: ["Dream Aspiration", "Lifetime Leather", "Heritage Workwear"],
    aiStylingAdvice: "Pair with vintage wash Levi ribcage denim and a grey cable knit sweater."
  },
  {
    id: "curated-010",
    item: "High waisted trousers",
    color: "Houndstooth Check",
    hex: "#78716c",
    description: "Clarke pleated traditional wool pants",
    brand: "Kilt",
    notes: "Local NZ designer wish list. Houndstooth coordinates beautifully.",
    status: "buy",
    season: "Dream AW",
    aiStyleTags: ["NZ Designer", "Pattern Texture", "Tailored Elegance"],
    aiStylingAdvice: "Coordinates with a black long sleeve merino knit and gold accent belt."
  }
];


// Classic human-aligned heuristic guesser for wardrobe categories
export function guessCategory(item: string, season?: string): string {
  if (season === "Handbag Inventory") return "Accessories";
  
  const raw = (item || "").toLowerCase().trim();
  
  // Outerwear keywords
  if (
    raw.includes("coat") || 
    raw.includes("jacket") ||  
    raw.includes("trench") || 
    raw.includes("blazer") || 
    raw.includes("shacket") || 
    raw.includes("puffer") || 
    raw.includes("vest") || 
    raw.includes("cardigan") ||
    // NZ retail abbreviates it constantly: "Georgie Cardi", "Ted Cardi".
    /\bcardi\b/.test(raw) ||
    raw.includes("parka") ||
    raw.includes("outerwear") ||
    raw.includes("duster")
  ) {
    return "Outerwear";
  }
  
  // Shoes keywords
  if (
    raw.includes("boot") || 
    raw.includes("shoe") || 
    raw.includes("sneaker") || 
    raw.includes("heel") || 
    raw.includes("sandal") || 
    raw.includes("flat") || 
    raw.includes("loafer") || 
    raw.includes("slide") || 
    raw.includes("mule") || 
    raw.includes("trainer") || 
    raw.includes("footwear") ||
    raw.includes("blundstone") ||
    raw.includes("martens")
  ) {
    return "Shoes";
  }
  
  // Bottoms keywords
  if (
    raw.includes("trouser") || 
    raw.includes("pant") || 
    raw.includes("jean") || 
    raw.includes("skirt") ||
    // "short" must not swallow "short sleeve" - retailers label half the
    // catalogue that way, and it sent dresses and tees into Bottoms.
    /\bshorts\b/.test(raw) ||
    /\bshort\b(?!\s*[- ]?sleeve)/.test(raw) ||
    raw.includes("legging") ||
    raw.includes("denim") || 
    raw.includes("slack") || 
    raw.includes("culotte") ||
    raw.includes("bottom")
  ) {
    return "Bottoms";
  }
  
  // Dresses keywords
  if (
    raw.includes("dress") || 
    raw.includes("jumpsuit") || 
    raw.includes("unitard") || 
    raw.includes("romper") || 
    raw.includes("slip") || 
    raw.includes("gown") ||
    raw.includes("frock") ||
    raw.includes("pinafore") ||
    raw.includes("overall") ||
    raw.includes("dungaree")
  ) {
    return "Dresses";
  }
  
  // Accessories keywords
  if (
    raw.includes("bag") || 
    raw.includes("handbag") || 
    raw.includes("purse") || 
    raw.includes("belt") || 
    raw.includes("scarf") || 
    raw.includes("hat") || 
    raw.includes("cap") || 
    raw.includes("jewelry") || 
    raw.includes("necklace") || 
    raw.includes("ring") || 
    raw.includes("earring") || 
    raw.includes("backpack") || 
    raw.includes("tote") || 
    raw.includes("clutch") || 
    raw.includes("wallet") || 
    raw.includes("sunglass") || 
    // "accessor" catches both "accessory" and a retailer's "Accessories" tab.
    raw.includes("accessor") ||
    raw.includes("eyewear") ||
    raw.includes("socks") ||
    raw.includes("tights")
  ) {
    return "Accessories";
  }
  
  // Tops keywords (lots of names for tops)
  if (
    raw.includes("shirt") || 
    raw.includes("tee") || 
    raw.includes("t-shirt") || 
    raw.includes("top") || 
    raw.includes("blouse") || 
    raw.includes("sweater") || 
    raw.includes("knit") || 
    raw.includes("tank") || 
    raw.includes("cami") || 
    raw.includes("crochet") || 
    raw.includes("turtleneck") || 
    raw.includes("polo") || 
    raw.includes("long sleeve") || 
    raw.includes("crewneck") || 
    raw.includes("pullover") || 
    raw.includes("sweatshirt") || 
    raw.includes("hoodie") || 
    raw.includes("bodysuit")
  ) {
    return "Tops";
  }
  
  // Default fallback
  return "Tops";
}

// Helper to compile statistics for wardrobe analysis
export function compileWardrobeStats(items: WardrobeItem[]): WardrobeStats {
  const totalCount = items.length;
  const existingCount = items.filter(i => i.status === "existing").length;
  const buyCount = items.filter(i => i.status === "buy").length;

  const itemsByCategory: Record<string, number> = {};
  const colorsMap: Record<string, { color: string; hex: string; count: number }> = {};
  const brandsMap: Record<string, number> = {};

  items.forEach(item => {
    // 1. Category tally
    const cat = item.aiSuggestedCategory || guessCategory(item.item, item.season);
    itemsByCategory[cat] = (itemsByCategory[cat] || 0) + 1;

    // 2. Color tally
    const colName = item.color.trim();
    if (colName) {
      if (!colorsMap[colName]) {
        colorsMap[colName] = { color: colName, hex: item.hex || "#cccccc", count: 0 };
      }
      colorsMap[colName].count += 1;
    }

    // 3. Brand tally
    const bName = item.brand.trim() || "Unbranded";
    brandsMap[bName] = (brandsMap[bName] || 0) + 1;
  });

  const colorsPresent = Object.values(colorsMap).sort((a, b) => b.count - a.count);
  const brandsPresent = Object.entries(brandsMap)
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalCount,
    existingCount,
    buyCount,
    itemsByCategory,
    colorsPresent,
    brandsPresent
  };
}

// Advanced CSV / TSV spreadsheet parsing helper that automatically analyzes data models per tab!
export function parseSpreadsheetText(text: string, forceSeason?: string): Omit<WardrobeItem, "id" | "hex">[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // 1. Double check if we can guess the active season from the content/headers (only if not explicitly forced)
  let detectedSeason = forceSeason || "Summer 25-26";
  if (!forceSeason) {
    const contentSnapshot = text.toLowerCase();

    if (contentSnapshot.includes("handbag inventory") || contentSnapshot.includes("leather, unlined") || contentSnapshot.includes("satchel company")) {
      detectedSeason = "Handbag Inventory";
    } else if (contentSnapshot.includes("dream capsule aw") || contentSnapshot.includes("rm williams") || contentSnapshot.includes("brogue boots")) {
      detectedSeason = "Dream AW";
    } else if (contentSnapshot.includes("winter capsule 2026") || contentSnapshot.includes("nelson winter") || contentSnapshot.includes("farmers") || contentSnapshot.includes("doc martens")) {
      detectedSeason = "Winter 26";
    } else if (contentSnapshot.includes("autumn 26") || contentSnapshot.includes("existing, pulled from storage")) {
      detectedSeason = "Autumn 26";
    } else if (contentSnapshot.includes("summer capsule 2025")) {
      detectedSeason = "Summer 25-26";
    }
  }

  // Find a header line that has actual content keys
  let headerIndex = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const lLower = lines[i].toLowerCase();
    if (
      lLower.includes("item") || 
      lLower.includes("colour") || 
      lLower.includes("source") || 
      lLower.includes("brand") || 
      lLower.includes("satchel")
    ) {
      headerIndex = i;
      break;
    }
  }

  const headerLine = lines[headerIndex];
  // Detect delimiter
  let delimiter = ",";
  if (headerLine.includes("\t")) {
    delimiter = "\t";
  }

  const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase());

  // Dynamic header scanner
  const findColumnIndex = (targetTerms: string[], excludeTerms?: string[]): number => {
    return headers.findIndex((h) => {
      const hLower = h.toLowerCase().trim();
      const matchesTarget = targetTerms.some(term => hLower.includes(term));
      if (!matchesTarget) return false;
      if (excludeTerms && excludeTerms.some(term => hLower.includes(term))) return false;
      return true;
    });
  };

  // Find column indices dynamically
  let targetItemIdx = findColumnIndex(["item type", "item", "product", "type"]);
  let targetColorIdx = findColumnIndex(["colour", "color", "pattern", "shade"]);
  let targetStatusIdx = findColumnIndex(["source", "existing or buy", "status", "own", "possembled", "e/s", "e or s", "shop", "existing/shop", "existing or shop", "existing/"]);
  let targetBrandIdx = findColumnIndex(["brand", "label", "designer", "source brand"]);
  let targetNotesIdx = findColumnIndex(["notes", "comment"]);
  let targetDescIdx = findColumnIndex(["link", "description", "desc", "material", "url"]);
  let targetSizeIdx = findColumnIndex(["size"]);
  let targetCostIdx = findColumnIndex(["cost", "price"]);
  let targetRatingIdx = findColumnIndex(["rating"]);
  let targetProsIdx = findColumnIndex(["pros"]);
  let targetConsIdx = findColumnIndex(["cons"]);

  // Double check if first column is the standard index numbers ("No", "n°", etc.) so we can apply precise offsets for fallbacks
  const firstColClean = headers[0]?.toLowerCase().trim() || "";
  const hasNoCol = firstColClean === "no" || firstColClean === "n°" || firstColClean === "" || (/^\d+$/).test(firstColClean);
  const offset = hasNoCol ? 0 : -1;

  // Layout Hardcoded Fallbacks designed for NELSON spreadsheet imports when column titles are slightly misaligned
  if (detectedSeason === "Summer 25-26") {
    if (targetItemIdx === -1) targetItemIdx = Math.max(0, 1 + offset);
    if (targetColorIdx === -1) targetColorIdx = Math.max(0, 2 + offset);
    if (targetStatusIdx === -1) targetStatusIdx = Math.max(0, 3 + offset);
    if (targetCostIdx === -1) targetCostIdx = Math.max(0, 4 + offset);
    if (targetDescIdx === -1) targetDescIdx = Math.max(0, 5 + offset);
    if (targetSizeIdx === -1) targetSizeIdx = Math.max(0, 6 + offset);
    if (targetNotesIdx === -1) targetNotesIdx = Math.max(0, 7 + offset);
  } 
  else if (detectedSeason === "Winter 26") {
    if (targetItemIdx === -1) targetItemIdx = Math.max(0, 1 + offset);
    if (targetColorIdx === -1) targetColorIdx = Math.max(0, 2 + offset);
    if (targetBrandIdx === -1) targetBrandIdx = Math.max(0, 3 + offset);
    if (targetNotesIdx === -1) targetNotesIdx = Math.max(0, 4 + offset);
    if (targetDescIdx === -1) targetDescIdx = Math.max(0, 5 + offset);
    if (targetSizeIdx === -1) targetSizeIdx = Math.max(0, 6 + offset);
  }
  else if (detectedSeason === "Autumn 26") {
    if (targetItemIdx === -1) targetItemIdx = Math.max(0, 1 + offset);
    if (targetColorIdx === -1) targetColorIdx = Math.max(0, 2 + offset);
    if (targetBrandIdx === -1) targetBrandIdx = Math.max(0, 3 + offset);
    if (targetNotesIdx === -1) targetNotesIdx = Math.max(0, 4 + offset);
  }
  else if (detectedSeason === "Handbag Inventory") {
    const handbagOffset = (headers[0]?.toLowerCase().trim() === "brand") ? 0 : (hasNoCol ? 0 : -1);
    if (targetBrandIdx === -1) targetBrandIdx = Math.max(0, 0 + handbagOffset);
    if (targetColorIdx === -1) targetColorIdx = Math.max(0, 1 + handbagOffset);
    if (targetItemIdx === -1) targetItemIdx = Math.max(0, 2 + handbagOffset);
    if (targetDescIdx === -1) targetDescIdx = Math.max(0, 3 + handbagOffset);
    if (targetSizeIdx === -1) targetSizeIdx = Math.max(0, 4 + handbagOffset);
    if (targetProsIdx === -1) targetProsIdx = Math.max(0, 5 + handbagOffset);
    if (targetConsIdx === -1) targetConsIdx = Math.max(0, 6 + handbagOffset);
    if (targetRatingIdx === -1) targetRatingIdx = Math.max(0, 7 + handbagOffset);
  }
  else if (detectedSeason === "Dream AW") {
    const dreamOffset = (headers[0]?.toLowerCase().trim() === "item") ? 0 : (hasNoCol ? 0 : -1);
    if (targetItemIdx === -1) targetItemIdx = Math.max(0, 0 + dreamOffset);
    if (targetColorIdx === -1) targetColorIdx = Math.max(0, 1 + dreamOffset);
    if (targetBrandIdx === -1) targetBrandIdx = Math.max(0, 2 + dreamOffset);
    if (targetNotesIdx === -1) targetNotesIdx = Math.max(0, 3 + dreamOffset);
    if (targetStatusIdx === -1) targetStatusIdx = Math.max(0, 4 + dreamOffset);
  }

  const parsedItems: Omit<WardrobeItem, "id" | "hex">[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.toLowerCase().startsWith("total") || line.startsWith(",,,") || line.startsWith("total,")) continue;

    let parts: string[] = [];
    if (delimiter === ",") {
      parts = parseCsvLine(line);
    } else {
      parts = line.split(delimiter).map(p => p.trim());
    }

    if (parts.every(p => !p || p === "")) continue;

    const itemVal = targetItemIdx !== -1 && parts[targetItemIdx] ? parts[targetItemIdx].trim() : "";
    if (!itemVal || itemVal.toLowerCase() === "item" || itemVal.toLowerCase() === "no") continue;

    const colorVal = targetColorIdx !== -1 && parts[targetColorIdx] ? parts[targetColorIdx].trim() : "";
    const statusVal = targetStatusIdx !== -1 && parts[targetStatusIdx] ? parts[targetStatusIdx].trim() : "";
    const brandVal = targetBrandIdx !== -1 && parts[targetBrandIdx] ? parts[targetBrandIdx].trim() : "";
    const notesVal = targetNotesIdx !== -1 && parts[targetNotesIdx] ? parts[targetNotesIdx].trim() : "";
    const descValRaw = targetDescIdx !== -1 && parts[targetDescIdx] ? parts[targetDescIdx].trim() : "";
    const sizeVal = targetSizeIdx !== -1 && parts[targetSizeIdx] ? parts[targetSizeIdx].trim() : "";
    const costVal = targetCostIdx !== -1 && parts[targetCostIdx] ? parts[targetCostIdx].trim() : "";
    const ratingVal = targetRatingIdx !== -1 && parts[targetRatingIdx] ? parts[targetRatingIdx].trim() : "";
    const prosVal = targetProsIdx !== -1 && parts[targetProsIdx] ? parts[targetProsIdx].trim() : "";
    const consVal = targetConsIdx !== -1 && parts[targetConsIdx] ? parts[targetConsIdx].trim() : "";

    // Assemble Description (sanitizing accidental E/S status tokens)
    let finalDescription = descValRaw;
    if (!finalDescription) {
      if (detectedSeason === "Handbag Inventory") {
        finalDescription = `${sizeVal || 'Medium'} Handbag`;
      } else if (detectedSeason === "Summer 25-26") {
        finalDescription = "Summer essentials piece";
      } else if (detectedSeason === "Winter 26") {
        finalDescription = "Winter layers base";
      } else if (detectedSeason === "Autumn 26") {
        finalDescription = "Autumn transitional items";
      } else {
        finalDescription = "Capsule planning garment";
      }
    }

    const dClean = finalDescription.trim().toLowerCase();
    if (
      dClean === "e" || 
      dClean === "s" || 
      dClean === "buy" || 
      dClean === "existing" ||
      dClean === "own" ||
      dClean === "shop" ||
      dClean === "status"
    ) {
      if (detectedSeason === "Handbag Inventory") {
        finalDescription = "Leather accessories";
      } else if (detectedSeason === "Summer 25-26") {
        finalDescription = "Summer essentials piece";
      } else if (detectedSeason === "Winter 26") {
        finalDescription = "Winter layers base";
      } else if (detectedSeason === "Autumn 26") {
        finalDescription = "Autumn transitional items";
      } else {
        finalDescription = "Capsule planning garment";
      }
    }

    // Determine status (Existing vs Buy) cleanly
    let status: "existing" | "buy" = "existing";
    const statusClean = statusVal.toLowerCase().trim();
    if (statusClean === "s" || statusClean === "buy" || statusClean.includes("wish") || statusClean.includes("shop") || statusClean.includes("target")) {
      status = "buy";
    } else if (statusClean === "e" || statusClean.includes("exist") || statusClean.includes("own") || statusClean.includes("assemble")) {
      status = "existing";
    } else {
      // Default guess fallback based on season
      if (detectedSeason === "Dream AW") {
        status = "buy";
      } else {
        status = "existing";
      }
    }

    // Determine brand cleanly (sanitizing accidental E/S status tokens)
    let finalBrand = brandVal;
    const bClean = finalBrand.toLowerCase().trim();
    if (!finalBrand || bClean === "e" || bClean === "s" || bClean === "buy" || bClean === "existing") {
      const combined = `${notesVal} ${descValRaw} ${itemVal}`.toLowerCase();
      if (combined.includes("max")) finalBrand = "MAX";
      else if (combined.includes("as colour")) finalBrand = "AS Colour";
      else if (combined.includes("decjuba")) finalBrand = "Decjuba";
      else if (combined.includes("dr martens") || combined.includes("doc martin")) finalBrand = "Dr Martens";
      else if (combined.includes("blundstone")) finalBrand = "Blundstone";
      else if (combined.includes("rm williams")) finalBrand = "RM Williams";
      else if (combined.includes("kilt")) finalBrand = "Kilt";
      else finalBrand = "Classic";
    }

    // Determine Notes
    let finalNotes = notesVal || "";
    if (detectedSeason === "Handbag Inventory") {
      let extra = `Rating: ${ratingVal || '5'}/5. Size: ${sizeVal || 'M'}`;
      if (prosVal) extra += `. Pros: ${prosVal}`;
      if (consVal) extra += `. Cons: ${consVal}`;
      finalNotes = finalNotes ? `${finalNotes} (${extra})` : extra;
    } else {
      if (sizeVal) finalNotes += ` (Size: ${sizeVal})`;
      if (costVal) finalNotes += ` [Cost: ${costVal}]`;
    }

    parsedItems.push({
      item: itemVal,
      color: colorVal || "Neutral",
      description: finalDescription,
      brand: finalBrand,
      notes: finalNotes,
      status: status,
      season: detectedSeason,
      aiSuggestedCategory: guessCategory(itemVal, detectedSeason)
    });
  }

  return parsedItems;
}

// Simple regex parser for quoted CSV items
function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let cell = "";
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  result.push(cell.trim());
  return result;
}

// Convert wardrobe list back to a downloadable Excel-friendly CSV string
export function exportToCSVString(items: WardrobeItem[]): string {
  const headers = ["Item", "Colour", "Description", "Brand", "Notes", "Existing or Buy", "Season"];
  const rows = items.map(item => [
    item.item,
    item.color,
    item.description,
    item.brand,
    item.notes,
    item.status === "existing" ? "Existing" : "Buy",
    item.season || ""
  ]);

  const escapeCell = (val: string) => {
    let clean = (val || "").replace(/"/g, '""');
    if (clean.includes(",") || clean.includes("\n") || clean.includes('"')) {
      return `"${clean}"`;
    }
    return clean;
  };

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(escapeCell).join(","))
  ].join("\n");

  return csvContent;
}
