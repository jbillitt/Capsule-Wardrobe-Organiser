/**
 * Per-garment silhouettes.
 *
 * The old version keyed off item.aiSuggestedCategory and fell through to a tee
 * whenever that was missing or non-standard - which is every row of a
 * spreadsheet import, so the whole wardrobe rendered as t-shirts. It now
 * resolves the garment from its name through the same lexicon the styling
 * engine uses, so a boot draws a boot whatever the stored category says.
 */

import React from "react";
import { WardrobeItem } from "../types";
import { traitsFor, GarmentKind } from "../engine/lexicon";

const SHADE = "#ffffff";
const DARK = "#111111";

/** Portrait frame for garments, landscape for shoes, bags and accessories. */
const LANDSCAPE: GarmentKind[] = ["boot", "sneaker", "heel", "sandal", "loafer", "shoe", "bag", "hat", "sunglasses", "belt"];

function shapeFor(kind: GarmentKind, fill: string): React.ReactNode {
  const hi = (d: string, o = 0.15) => <path d={d} fill={SHADE} opacity={o} />;
  const sh = (d: string, o = 0.12) => <path d={d} fill={DARK} opacity={o} />;
  const line = (d: string, o = 0.3) => <path d={d} fill="none" stroke={SHADE} strokeWidth="1.5" strokeOpacity={o} />;

  switch (kind) {
    // ---- tops -------------------------------------------------------------
    case "tee":
      return <>
        <path d="M36,20 L50,26 L64,20 L82,30 L74,46 L68,42 L68,104 L32,104 L32,42 L26,46 L18,30 Z" fill={fill} />
        {line("M36,20 Q50,32 64,20")}
        {hi("M36,20 L50,26 L44,32 Z")}
      </>;
    case "breton":
      return <>
        <path d="M36,20 L50,26 L64,20 L82,30 L74,46 L68,42 L68,104 L32,104 L32,42 L26,46 L18,30 Z" fill={fill} />
        {line("M32,56 L68,56", 0.55)}{line("M32,68 L68,68", 0.55)}{line("M32,80 L68,80", 0.55)}{line("M32,92 L68,92", 0.55)}
      </>;
    case "shirt":
      return <>
        <path d="M36,18 L50,30 L64,18 L84,28 L78,50 L70,46 L70,106 L30,106 L30,46 L22,50 L16,28 Z" fill={fill} />
        <path d="M36,18 L50,30 L44,20 Z" fill={SHADE} opacity="0.35" />
        <path d="M64,18 L50,30 L56,20 Z" fill={SHADE} opacity="0.35" />
        {line("M50,30 L50,106", 0.35)}
        <circle cx="50" cy="52" r="1.6" fill={SHADE} opacity="0.5" />
        <circle cx="50" cy="70" r="1.6" fill={SHADE} opacity="0.5" />
        <circle cx="50" cy="88" r="1.6" fill={SHADE} opacity="0.5" />
      </>;
    case "henley":
      return <>
        <path d="M36,20 L50,26 L64,20 L82,30 L74,46 L68,42 L68,104 L32,104 L32,42 L26,46 L18,30 Z" fill={fill} />
        {line("M46,26 L46,50", 0.4)}{line("M54,26 L54,50", 0.4)}
      </>;
    case "tank":
      return <>
        <path d="M38,18 L44,30 L56,30 L62,18 L68,22 L66,104 L34,104 L32,22 Z" fill={fill} />
        {hi("M38,18 L44,30 L40,32 Z")}
      </>;
    case "cami":
      return <>
        <path d="M40,16 L50,34 L60,16 L66,24 L64,104 L36,104 L34,24 Z" fill={fill} />
        {line("M40,16 L50,34 L60,16", 0.35)}
      </>;
    case "swim":
      return <>
        <path d="M38,20 L50,32 L62,20 L68,28 L64,70 Q50,86 36,70 L32,28 Z" fill={fill} />
        {line("M38,20 Q50,34 62,20", 0.35)}
      </>;

    // ---- knits ------------------------------------------------------------
    case "jumper":
      return <>
        <path d="M34,22 Q50,16 66,22 L86,34 L78,54 L70,50 L70,100 L30,100 L30,50 L22,54 L14,34 Z" fill={fill} />
        <path d="M30,100 L70,100 L70,106 L30,106 Z" fill={DARK} opacity="0.15" />
        {line("M34,22 Q50,30 66,22")}
      </>;
    case "cardigan":
      return <>
        <path d="M34,22 Q50,16 66,22 L86,34 L78,54 L70,50 L70,104 L30,104 L30,50 L22,54 L14,34 Z" fill={fill} />
        <path d="M48,24 L48,104 L52,104 L52,24 Z" fill={DARK} opacity="0.2" />
        <circle cx="45" cy="46" r="1.8" fill={SHADE} opacity="0.55" />
        <circle cx="45" cy="64" r="1.8" fill={SHADE} opacity="0.55" />
        <circle cx="45" cy="82" r="1.8" fill={SHADE} opacity="0.55" />
      </>;
    case "sweatshirt":
      return <>
        <path d="M34,26 Q50,20 66,26 L86,38 L78,56 L70,52 L70,102 L30,102 L30,52 L22,56 L14,38 Z" fill={fill} />
        <path d="M36,26 Q50,10 64,26 Q50,20 36,26 Z" fill={fill} />
        {sh("M36,26 Q50,14 64,26 Q50,22 36,26 Z", 0.18)}
        {line("M46,30 L46,42", 0.4)}{line("M54,30 L54,42", 0.4)}
      </>;

    // ---- outerwear --------------------------------------------------------
    case "coat":
      return <>
        <path d="M32,20 L50,28 L68,20 L88,32 L80,54 L72,50 L72,112 L28,112 L28,50 L20,54 L12,32 Z" fill={fill} />
        {sh("M50,28 L50,112 L54,112 L54,28 Z", 0.18)}
        <circle cx="42" cy="52" r="2" fill={SHADE} opacity="0.5" />
        <circle cx="60" cy="52" r="2" fill={SHADE} opacity="0.5" />
        <circle cx="42" cy="72" r="2" fill={SHADE} opacity="0.5" />
        <circle cx="60" cy="72" r="2" fill={SHADE} opacity="0.5" />
      </>;
    case "trench":
      return <>
        <path d="M32,20 L50,28 L68,20 L88,32 L80,54 L72,50 L72,112 L28,112 L28,50 L20,54 L12,32 Z" fill={fill} />
        <path d="M24,68 L76,68 L76,75 L24,75 Z" fill={DARK} opacity="0.3" />
        <path d="M44,66 L56,66 L56,77 L44,77 Z" fill={SHADE} opacity="0.35" />
        {sh("M50,28 L50,68 L54,68 L54,28 Z", 0.18)}
      </>;
    case "blazer":
      return <>
        <path d="M34,20 L50,30 L66,20 L86,32 L78,52 L70,48 L70,106 L30,106 L30,48 L22,52 L14,32 Z" fill={fill} />
        <path d="M50,30 L38,22 L34,52 L50,64 Z" fill={SHADE} opacity="0.3" />
        <path d="M50,30 L62,22 L66,52 L50,64 Z" fill={SHADE} opacity="0.3" />
        <circle cx="50" cy="76" r="2" fill={SHADE} opacity="0.5" />
      </>;
    case "denim-jacket":
      return <>
        <path d="M34,20 L50,28 L66,20 L84,30 L77,50 L70,47 L70,92 L30,92 L30,47 L23,50 L16,30 Z" fill={fill} />
        {sh("M50,28 L50,92 L53,92 L53,28 Z", 0.2)}
        <path d="M36,46 L46,46 L46,56 L36,56 Z" fill={SHADE} opacity="0.28" />
        <path d="M57,46 L67,46 L67,56 L57,56 Z" fill={SHADE} opacity="0.28" />
        <path d="M30,86 L70,86 L70,92 L30,92 Z" fill={DARK} opacity="0.18" />
      </>;
    case "puffer":
      return <>
        <path d="M34,22 Q50,16 66,22 L86,34 L80,56 L72,52 L72,104 L28,104 L28,52 L20,56 L14,34 Z" fill={fill} />
        {line("M28,42 L72,42", 0.45)}{line("M28,58 L72,58", 0.45)}{line("M28,74 L72,74", 0.45)}{line("M28,90 L72,90", 0.45)}
        {sh("M49,22 L49,104 L52,104 L52,22 Z", 0.2)}
      </>;
    case "vest":
      return <>
        <path d="M36,22 L50,32 L64,22 L74,28 L74,104 L26,104 L26,28 Z" fill={fill} />
        {sh("M50,32 L50,104 L53,104 L53,32 Z", 0.2)}
        {line("M26,42 L74,42", 0.4)}{line("M26,62 L74,62", 0.4)}{line("M26,82 L74,82", 0.4)}
      </>;
    case "jacket":
      return <>
        <path d="M34,22 L50,30 L66,22 L84,32 L77,52 L70,48 L70,100 L30,100 L30,48 L23,52 L16,32 Z" fill={fill} />
        {sh("M50,30 L50,100 L53,100 L53,30 Z", 0.2)}
      </>;

    // ---- dresses ----------------------------------------------------------
    case "dress":
      return <>
        <path d="M38,18 L50,26 L62,18 L70,30 L64,46 L78,110 L22,110 L36,46 L30,30 Z" fill={fill} />
        {line("M38,18 Q50,28 62,18")}
        {hi("M36,46 L64,46 L66,56 L34,56 Z", 0.12)}
      </>;
    case "shirt-dress":
      return <>
        <path d="M38,18 L50,28 L62,18 L70,30 L64,46 L78,110 L22,110 L36,46 L30,30 Z" fill={fill} />
        <path d="M50,28 L40,20 L38,30 Z" fill={SHADE} opacity="0.35" />
        <path d="M50,28 L60,20 L62,30 Z" fill={SHADE} opacity="0.35" />
        {line("M50,28 L50,110", 0.3)}
        <circle cx="50" cy="48" r="1.6" fill={SHADE} opacity="0.5" />
        <circle cx="50" cy="68" r="1.6" fill={SHADE} opacity="0.5" />
        <circle cx="50" cy="88" r="1.6" fill={SHADE} opacity="0.5" />
      </>;
    case "overalls":
      return <>
        <path d="M34,20 L38,44 L62,44 L66,20 L70,22 L66,50 L68,110 L52,110 L50,70 L48,110 L32,110 L34,50 L30,22 Z" fill={fill} />
        <path d="M38,44 L62,44 L62,62 L38,62 Z" fill={fill} />
        {sh("M38,44 L62,44 L62,62 L38,62 Z", 0.12)}
        <circle cx="38" cy="46" r="2" fill={SHADE} opacity="0.55" />
        <circle cx="62" cy="46" r="2" fill={SHADE} opacity="0.55" />
      </>;

    // ---- bottoms ----------------------------------------------------------
    case "trousers":
      return <>
        <path d="M30,20 L70,20 L67,110 L53,110 L50,52 L47,110 L33,110 Z" fill={fill} />
        <path d="M30,20 L70,20 L70,28 L30,28 Z" fill={DARK} opacity="0.18" />
        {line("M42,30 L40,108", 0.2)}{line("M58,30 L60,108", 0.2)}
      </>;
    case "jeans":
      return <>
        <path d="M30,20 L70,20 L67,110 L53,110 L50,52 L47,110 L33,110 Z" fill={fill} />
        <path d="M30,20 L70,20 L70,27 L30,27 Z" fill={DARK} opacity="0.2" />
        <path d="M33,30 Q40,38 42,30" fill="none" stroke={SHADE} strokeWidth="1.2" strokeOpacity="0.4" />
        <path d="M58,30 Q60,38 67,30" fill="none" stroke={SHADE} strokeWidth="1.2" strokeOpacity="0.4" />
        {line("M50,20 L50,50", 0.3)}
      </>;
    case "leggings":
      return <>
        <path d="M34,20 L66,20 L62,110 L53,110 L50,54 L47,110 L38,110 Z" fill={fill} />
        <path d="M34,20 L66,20 L66,27 L34,27 Z" fill={DARK} opacity="0.2" />
      </>;
    case "shorts":
      return <>
        <path d="M28,20 L72,20 L69,68 L54,68 L50,42 L46,68 L31,68 Z" fill={fill} />
        <path d="M28,20 L72,20 L72,28 L28,28 Z" fill={DARK} opacity="0.2" />
        <path d="M31,62 L46,62 L46,68 L31,68 Z" fill={DARK} opacity="0.1" />
        <path d="M54,62 L69,62 L69,68 L54,68 Z" fill={DARK} opacity="0.1" />
      </>;
    case "skirt":
      return <>
        <path d="M34,22 L66,22 L80,102 L20,102 Z" fill={fill} />
        <path d="M34,22 L66,22 L66,30 L34,30 Z" fill={DARK} opacity="0.2" />
        {line("M46,32 L40,100", 0.18)}{line("M54,32 L60,100", 0.18)}
      </>;

    // ---- shoes (landscape) ------------------------------------------------
    case "boot":
      return <>
        <path d="M30,18 L52,18 L54,62 L96,68 Q102,70 102,78 L102,84 L30,84 Z" fill={fill} />
        <path d="M30,84 L102,84 L102,90 L30,90 Z" fill={DARK} opacity="0.45" />
        <path d="M84,84 L102,84 L102,90 L84,90 Z" fill={DARK} opacity="0.25" />
        {line("M30,30 L52,30", 0.3)}
        {hi("M30,18 L52,18 L52,30 L30,30 Z", 0.12)}
      </>;
    case "sneaker":
      return <>
        <path d="M14,52 Q16,36 34,36 Q52,38 66,52 L96,62 Q106,64 106,74 L18,74 Q12,74 12,64 Z" fill={fill} />
        <path d="M12,74 L106,74 L106,82 L14,82 Q10,82 10,78 Z" fill={SHADE} opacity="0.55" />
        <path d="M10,78 L106,78 L106,82 L14,82 Q10,82 10,78 Z" fill={DARK} opacity="0.25" />
        {line("M34,42 L46,52", 0.45)}{line("M42,40 L54,52", 0.45)}{line("M50,40 L62,54", 0.45)}
      </>;
    case "heel":
      return <>
        <path d="M18,42 Q20,30 34,32 Q48,36 60,52 L100,72 Q106,74 104,78 L28,78 Q18,78 18,66 Z" fill={fill} />
        <path d="M92,78 L104,78 L102,104 L94,104 Z" fill={fill} />
        <path d="M18,78 L104,78 L104,82 L18,82 Z" fill={DARK} opacity="0.35" />
        {hi("M20,44 Q24,34 34,36 L36,48 Z", 0.2)}
      </>;
    case "sandal":
      return <>
        <path d="M12,70 Q12,62 22,62 L98,62 Q106,62 106,70 Q106,78 98,78 L20,78 Q12,78 12,70 Z" fill={fill} />
        <path d="M28,62 Q46,40 66,62" fill="none" stroke={fill} strokeWidth="7" strokeLinecap="round" />
        <path d="M62,62 Q80,44 94,62" fill="none" stroke={fill} strokeWidth="7" strokeLinecap="round" />
        <path d="M12,74 L106,74 L106,78 L14,78 Z" fill={DARK} opacity="0.3" />
      </>;
    case "loafer":
      return <>
        <path d="M14,56 Q14,44 30,44 Q52,46 68,58 L96,64 Q106,66 106,74 L20,74 Q14,74 14,66 Z" fill={fill} />
        <path d="M14,74 L106,74 L106,80 L16,80 Z" fill={DARK} opacity="0.4" />
        <path d="M34,50 Q48,48 58,56 L40,58 Z" fill={SHADE} opacity="0.3" />
        <path d="M42,52 L54,52 L54,56 L42,56 Z" fill={DARK} opacity="0.25" />
      </>;
    case "shoe":
      return <>
        <path d="M14,58 Q14,46 30,46 Q52,48 68,60 L96,66 Q106,68 106,74 L20,74 Q14,74 14,66 Z" fill={fill} />
        <path d="M14,74 L106,74 L106,80 L16,80 Z" fill={DARK} opacity="0.4" />
      </>;

    // ---- bags and accessories (landscape) ---------------------------------
    case "bag":
      return <>
        <path d="M28,44 L92,44 L98,92 L22,92 Z" fill={fill} />
        <path d="M42,44 Q42,18 60,18 Q78,18 78,44" fill="none" stroke={fill} strokeWidth="5" />
        <path d="M22,92 L98,92 L98,96 L22,96 Z" fill={DARK} opacity="0.2" />
        {hi("M28,44 L92,44 L91,54 L29,54 Z", 0.18)}
        <path d="M54,60 L66,60 L66,68 L54,68 Z" fill={DARK} opacity="0.2" />
      </>;
    case "hat":
      return <>
        <path d="M38,64 Q38,28 60,28 Q82,28 82,64 Z" fill={fill} />
        <path d="M14,64 Q14,56 60,56 Q106,56 106,64 Q106,72 60,72 Q14,72 14,64 Z" fill={fill} />
        <path d="M38,58 L82,58 L82,64 L38,64 Z" fill={DARK} opacity="0.25" />
      </>;
    case "scarf":
      return <>
        <path d="M30,24 Q60,44 90,24 L96,36 Q60,60 24,36 Z" fill={fill} />
        <path d="M28,36 L44,36 L40,96 L26,96 Z" fill={fill} />
        <path d="M76,36 L92,36 L94,96 L80,96 Z" fill={fill} />
        {line("M30,84 L42,84", 0.35)}{line("M78,84 L92,84", 0.35)}
      </>;
    case "belt":
      return <>
        <path d="M10,56 L84,56 L84,74 L10,74 Z" fill={fill} />
        <path d="M84,50 L110,50 L110,80 L84,80 Z" fill="none" stroke={fill} strokeWidth="5" />
        <path d="M96,50 L100,50 L100,80 L96,80 Z" fill={fill} />
        {line("M10,65 L84,65", 0.2)}
      </>;
    case "sunglasses":
      return <>
        <path d="M12,50 L54,50 L52,74 Q34,82 20,72 Z" fill={fill} />
        <path d="M66,50 L108,50 L100,72 Q86,82 68,74 Z" fill={fill} />
        <path d="M54,54 Q60,50 66,54" fill="none" stroke={fill} strokeWidth="4" />
        {hi("M16,54 L48,54 L46,62 L20,62 Z", 0.25)}
      </>;
    case "socks":
      return <>
        <path d="M38,16 L64,16 L64,66 Q64,80 80,84 L92,88 Q100,92 96,100 Q92,108 82,104 L58,94 Q38,86 38,64 Z" fill={fill} />
        <path d="M38,16 L64,16 L64,28 L38,28 Z" fill={DARK} opacity="0.25" />
        {line("M40,34 L62,34", 0.25)}
      </>;
    case "jewellery":
      return <>
        <path d="M50,26 Q22,44 50,94 Q78,44 50,26 Z" fill="none" stroke={fill} strokeWidth="4" />
        <circle cx="50" cy="22" r="9" fill="none" stroke={fill} strokeWidth="4" />
        <circle cx="50" cy="62" r="7" fill={fill} />
        {hi("M46,58 L52,58 L50,64 Z", 0.4)}
      </>;

    // ---- fallback: a hanger, which is honest about not knowing -------------
    default:
      return <>
        <path d="M50,24 a7,7 0 1 1 7,7 c-4,0 -5,3 -5,6 l0,4" fill="none" stroke={fill} strokeWidth="4" strokeLinecap="round" />
        <path d="M52,42 L86,72 Q90,78 82,78 L18,78 Q10,78 14,72 Z" fill={fill} />
        {hi("M52,42 L70,58 L30,58 Z", 0.15)}
      </>;
  }
}

export function ApparelSilhouette({
  item,
  hexColor,
}: {
  item: Pick<WardrobeItem, "item" | "hex" | "color" | "description" | "notes" | "season" | "aiSuggestedCategory">;
  /** Optional override; otherwise the item's own colour is used. */
  hexColor?: string;
}) {
  const traits = traitsFor({
    id: "silhouette",
    item: item.item,
    color: item.color,
    hex: item.hex,
    description: item.description,
    brand: "",
    notes: item.notes,
    status: "existing",
    season: item.season,
  } as WardrobeItem);

  // If the name told us nothing, fall back to whatever category is on record
  // rather than defaulting everything to a tee.
  let kind = traits.kind;
  if (kind === "unknown") {
    const byCategory: Record<string, GarmentKind> = {
      outerwear: "jacket",
      bottoms: "trousers",
      dresses: "dress",
      shoes: "shoe",
      accessories: "bag",
      tops: "tee",
    };
    kind = byCategory[(item.aiSuggestedCategory || "").toLowerCase()] || "unknown";
  }

  const fill = hexColor || item.hex || "#cbd5e1";
  const viewBox = LANDSCAPE.includes(kind) ? "0 0 120 100" : "0 0 100 120";

  return (
    <svg
      viewBox={viewBox}
      className="w-full h-full opacity-90 transition-all duration-300 transform hover:scale-105"
      filter="drop-shadow(0 4px 6px rgba(0,0,0,0.05))"
      role="img"
      aria-label={`${kind} silhouette`}
    >
      {shapeFor(kind, fill)}
    </svg>
  );
}

export default ApparelSilhouette;
