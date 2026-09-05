import React, { useState, useEffect } from "react";
import { WardrobeItem, OutfitSuggestion } from "../types";
import { 
  Sparkles, 
  Calendar, 
  Layers, 
  Plus, 
  Trash2, 
  Heart, 
  RefreshCw, 
  Compass, 
  Shuffle, 
  AlertCircle, 
  BookOpen, 
  Check, 
  CheckCircle, 
  PlusCircle, 
  Eye, 
  Award,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { ApparelSilhouette } from "./WardrobeCard";
import { motion, AnimatePresence } from "motion/react";

interface OutfitBuilderProps {
  wardrobe: WardrobeItem[];
  savedOutfits: OutfitSuggestion[];
  onSaveOutfit: (outfit: OutfitSuggestion) => void;
  onDeleteOutfit: (idx: number) => void;
  currentCapsule?: string;
  onCapsuleChange?: (capsule: string) => void;
}

export default function OutfitBuilder({ 
  wardrobe, 
  savedOutfits, 
  onSaveOutfit, 
  onDeleteOutfit,
  currentCapsule = "all_actual",
  onCapsuleChange
}: OutfitBuilderProps) {
  const [objective, setObjective] = useState("Create comfortable, durable but chic active layering for Kids Day.");
  const [selectedCapsule, setSelectedCapsule] = useState<string>(currentCapsule);

  useEffect(() => {
    if (currentCapsule) {
      setSelectedCapsule(currentCapsule);
    }
  }, [currentCapsule]);

  const handleLocalCapsuleChange = (capsule: string) => {
    setSelectedCapsule(capsule);
    if (onCapsuleChange) {
      onCapsuleChange(capsule);
    }
  };

  const filteredWardrobe = wardrobe.filter(item => {
    // Capsule matching filter
    const matchesCapsule = selectedCapsule === "all_actual"
      ? item.season !== "Dream AW"
      : item.season === selectedCapsule;
      
    if (!matchesCapsule) return false;

    // Filter wishlisted items is strictly requested:
    // If chosen capsule is Dream AW (future roadmap), show both existing & wishlist.
    // Otherwise, only owned/existing items.
    if (selectedCapsule !== "Dream AW" && item.status !== "existing") {
      return false;
    }
    
    return true;
  }).reduce<WardrobeItem[]>((acc, item) => {
    if (selectedCapsule === "all_actual" && item.masterId) {
      if (!acc.some(i => i.masterId === item.masterId)) {
        acc.push(item);
      }
    } else {
      acc.push(item);
    }
    return acc;
  }, []);
  const [loading, setLoading] = useState(false);
  const [engineNote, setEngineNote] = useState<string | null>(null);
  const [aiOutfits, setAiOutfits] = useState<OutfitSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Manual outfit creating state
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualOccasion, setManualOccasion] = useState("");
  const [manualAesthetic, setManualAesthetic] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Activity Configuration
  const [activities, setActivities] = useState<string[]>([
    "Kids Day (i.e. Active)",
    "Reset Day",
    "Errand Day",
    "Saturday (Family Day)",
    "Sunday Church",
    "Out for Dinner Drinks"
  ]);
  const [selectedActivity, setSelectedActivity] = useState<string>("Kids Day (i.e. Active)");
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [newActivityName, setNewActivityName] = useState("");

  // Structured correction state. Each choice below maps to one typed rule the
  // scorer obeys, rather than to free text nobody can enforce.
  const [reportingOutfitIdx, setReportingOutfitIdx] = useState<number | null>(null);
  const [correctionKind, setCorrectionKind] = useState<string>("occasion-ban");
  const [correctionItemId, setCorrectionItemId] = useState<string>("");
  const [correctionOtherId, setCorrectionOtherId] = useState<string>("");
  const [feedbackText, setFeedbackText] = useState("");
  const [isLoggingMemory, setIsLoggingMemory] = useState(false);
  const [memorySavedMessage, setMemorySavedMessage] = useState<string | null>(null);
  const [savedMemories, setSavedMemories] = useState<string>("");
  const [savedRules, setSavedRules] = useState<any[]>([]);
  const [showLedger, setShowLedger] = useState(false);

  const CORRECTION_KINDS: { id: string; label: string; needsSecond?: boolean; kind: string; delta?: number }[] = [
    { id: "pair-ban", label: "These two don't go together", kind: "pair-ban", needsSecond: true },
    { id: "occasion-ban", label: "Wrong for this occasion", kind: "occasion-ban" },
    { id: "too-casual", label: "Too casual for this", kind: "formality-adjust", delta: -1 },
    { id: "too-dressy", label: "Too dressy for this", kind: "formality-adjust", delta: 1 },
    { id: "too-warm", label: "Warmer than it looks", kind: "warmth-adjust", delta: 1 },
    { id: "too-cold", label: "Not as warm as it looks", kind: "warmth-adjust", delta: -1 },
    { id: "slot-dislike", label: "Don't use it in this role", kind: "slot-dislike" },
  ];

  // Dynamic Loader phrase cycling
  const [loaderPhrase, setLoaderPhrase] = useState("Reading the wardrobe...");

  useEffect(() => {
    fetchMemoriesLedger();
  }, []);

  // Update objectives if selectedActivity changes
  useEffect(() => {
    if (selectedActivity === "🎲 Surprise Wildcard") return;
    
    let guide = `Create styling suitable for: ${selectedActivity}. `;
    if (selectedActivity.toLowerCase().includes("kids")) {
      guide += "Must be comfortable, flexible, and practical for active play, but styled as high-comfort Parisian athleisure or premium casual chic.";
    } else if (selectedActivity.toLowerCase().includes("reset")) {
      guide += "Optimize for ultimate lounging comfort using soft knit layers, home loungewear coziness, and relaxed neutral tones.";
    } else if (selectedActivity.toLowerCase().includes("errand")) {
      guide += "Style a walk-friendly outfit. Match with comfortable flats/shoes, light smart layered outerwear, and dynamic street-smart style.";
    } else if (selectedActivity.toLowerCase().includes("saturday")) {
      guide += "Style a relaxed, photogenic daytime outfit perfect for casual dining, weekend farmers markets, and family outings.";
    } else if (selectedActivity.toLowerCase().includes("church")) {
      guide += "Ensure respectability, elegance, and structure. Long hemlines, modest necklines, tidy styling, and polished outerwear jackets.";
    } else if (selectedActivity.toLowerCase().includes("dinner")) {
      guide += "Style a sophisticated, moody evening attire featuring smart draping textures, dinner-appropriate footwear, and fashionable blazer accents.";
    } else {
      guide += `Intuit appropriate clothing suitability and capsule aesthetic configurations tailored specifically to the physical dynamics of a "${selectedActivity}".`;
    }
    setObjective(guide);
  }, [selectedActivity]);

  // Rotate styling loader messages for flashy effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      const phrases = [
        "Deriving fabric, formality and warmth from each garment...",
        "Applying your learned rules from style-guide.json...",
        "Scoring hue angles across every candidate pairing...",
        "Checking layer weights run in the right order...",
        "Ranking combinations against today's activity...",
        "Writing up why the survivors work..."
      ];
      let tIdx = 0;
      interval = setInterval(() => {
        tIdx = (tIdx + 1) % phrases.length;
        setLoaderPhrase(phrases[tIdx]);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const fetchMemoriesLedger = async () => {
    try {
      const res = await fetch("/api/memory/list");
      if (res.ok) {
        const data = await res.json();
        setSavedMemories(data.content || "");
        setSavedRules(data.rules || []);
      }
    } catch (e) {
      console.warn("Could not load memories ledger:", e);
    }
  };

  // A correction becomes a typed rule in style-guide.json, keyed on masterId so
  // it follows the garment across every season capsule it appears in.
  const submitCorrection = async (outfit: OutfitSuggestion) => {
    const spec = CORRECTION_KINDS.find(k => k.id === correctionKind);
    const target = outfit.items.find(i => i.id === correctionItemId);
    if (!spec || !target) return;
    if (spec.needsSecond && !correctionOtherId) return;

    const other = outfit.items.find(i => i.id === correctionOtherId);
    setIsLoggingMemory(true);
    setMemorySavedMessage(null);

    try {
      const res = await fetch("/api/memory/wrong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: spec.kind,
          key: target.masterId || target.id,
          label: `${target.item} (${target.color})`,
          otherKey: other ? other.masterId || other.id : undefined,
          otherLabel: other ? `${other.item} (${other.color})` : undefined,
          activity: outfit.occasion || selectedActivity,
          slot: spec.kind === "slot-dislike" ? outfit.itemSlots?.[target.id] : undefined,
          delta: spec.delta,
          note: feedbackText.trim() || undefined,
          outfitName: outfit.name
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "The server rejected the correction.");

      setMemorySavedMessage(data.message || "Rule saved.");
      setFeedbackText("");
      setCorrectionItemId("");
      setCorrectionOtherId("");
      setReportingOutfitIdx(null);
      fetchMemoriesLedger();
      setTimeout(() => setMemorySavedMessage(null), 5000);
    } catch (err: any) {
      alert("Could not save the correction: " + err.message);
    } finally {
      setIsLoggingMemory(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      const res = await fetch(`/api/memory/rule/${id}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        setSavedRules(data.rules || []);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleClearMemories = async () => {
    if (!confirm("Clear every learned rule? The engine will go back to the style guide defaults.")) return;
    try {
      const res = await fetch("/api/memory/clear", { method: "POST" });
      if (res.ok) {
        fetchMemoriesLedger();
        alert("All learned rules cleared.");
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Trigger server-side the System 3.5 AI styling planner
  const generateAiOutfits = async (customPrompt?: string) => {
    if (filteredWardrobe.length === 0) {
      setError(`Your filtered wardrobe has 0 items. Add or switch your active capsule to one containing pieces so the AI Capsule Director can pair them!`);
      return;
    }

    setLoading(true);
    setError(null);
    setAiOutfits([]);

    try {
      const finalObjective = customPrompt || `${objective} (Targeting: ${selectedActivity})`;
      // Strip potentially bulky base64 image data before transmission to backend
      const sanitizedItems = filteredWardrobe.map(({ imageUrl, ...rest }) => rest);
      
      const response = await fetch("/api/style/suggest-outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: sanitizedItems,
          objective: finalObjective,
          activity: selectedActivity,
          capsule: selectedCapsule,
        }),
      });

      const rawData = await response.json();

      if (!response.ok) {
        throw new Error(rawData.details || rawData.error || "Failed to generate outfit capsules");
      }

      const responseData = rawData.outfits || rawData;
      setEngineNote(
        rawData.diagnostics?.length
          ? `No outfit could be built: ${rawData.diagnostics.join("; ")}.`
          : null
      );

      // Map return IDs back to real wardrobe item references
      const parsedOutfits: OutfitSuggestion[] = responseData.map((out: any) => {
        const itemReferences = (out.itemIds || [])
          .map((id: string) => wardrobe.find(w => w.id === id))
          .filter(Boolean) as WardrobeItem[];

        return {
          name: out.name,
          description: out.description,
          items: itemReferences,
          occasion: out.occasion || selectedActivity,
          aesthetic: out.aesthetic || "Quiet Luxury",
          stylingNotes: out.stylingNotes,
          whyItWorks: out.whyItWorks || [],
          score: out.score,
          itemSlots: out.itemSlots || {}
        };
      }).filter((o: any) => o.items.length > 0);

      setAiOutfits(parsedOutfits);
    } catch (err: any) {
      console.error(err);
      setError(`System Engine Execution Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Wildcard Sugg ... (Shuffle combos surprises!)
  const triggerWildcardSuggestion = async () => {
    setSelectedActivity("🎲 Surprise Wildcard");
    const wildcardPrompt = "Surprise Wildcard. Propose highly unexpected combinations from her closet. Challenge standard coordination guides (e.g., style unexpected pattern clashes, contrast deep moody shoes with airy neutral frocks, mix smart blazer outerwear shells over comfortable active track pants) while remaining extremely stylish, premium, and aesthetically coordinated.";
    await generateAiOutfits(wildcardPrompt);
  };

  const handleSaveManualOutfit = () => {
    if (!manualName || selectedItemIds.length === 0) {
      alert("Please provide an outfit name and select at least 1 clothing item.");
      return;
    }

    const compiledItems = selectedItemIds
      .map(id => wardrobe.find(w => w.id === id))
      .filter(Boolean) as WardrobeItem[];

    const newOutfit: OutfitSuggestion = {
      name: manualName,
      description: manualDescription || "A personally styled capsule combination.",
      items: compiledItems,
      occasion: manualOccasion || "Daily Smart Casual",
      aesthetic: manualAesthetic || "Modern Capsule",
      stylingNotes: manualNotes || "No special layering notes added."
    };

    onSaveOutfit(newOutfit);
    
    // Reset manual form
    setManualName("");
    setManualOccasion("");
    setManualAesthetic("");
    setManualNotes("");
    setManualDescription("");
    setSelectedItemIds([]);
    setManualMode(false);
  };

  const toggleManualItemSelection = (id: string) => {
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAddCustomActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityName.trim()) return;
    const cleanActName = newActivityName.trim();
    if (!activities.includes(cleanActName)) {
      setActivities(prev => [...prev, cleanActName]);
    }
    setSelectedActivity(cleanActName);
    setNewActivityName("");
    setIsAddingActivity(false);
  };

  // Helper activity emojis
  const getActivityEmoji = (actName: string) => {
    const name = actName.toLowerCase();
    if (name.includes("kids") || name.includes("active")) return "🧸";
    if (name.includes("reset") || name.includes("lounge")) return "🧘";
    if (name.includes("errand") || name.includes("shop")) return "🛒";
    if (name.includes("saturday") || name.includes("family")) return "🏡";
    if (name.includes("church") || name.includes("sunday")) return "⛪";
    if (name.includes("dinner") || name.includes("drink")) return "🍸";
    if (name.includes("wildcard")) return "🎲";
    return "";
  };

  return (
    <div className="space-y-8" id="outfit-builder-module">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 border-b border-brand-border pb-5">
        <div>
          <h2 className="font-serif font-medium text-brand-charcoal text-2xl tracking-tight">
            Style Capsule Planner & Director
          </h2>
          <p className="text-brand-sage text-sm mt-1">
            Generate the engine-styled outfit lookbooks based on daily activities, learn from suitability corrections, or draft looks manually.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
          {/* Capsule Dropdown Picker */}
          <div className="flex items-center gap-2.5 bg-brand-greige/30 border border-brand-border/60 px-4 py-2 rounded-sm">
            <span className="text-[10px] uppercase font-bold text-brand-sage tracking-wider font-sans whitespace-nowrap">Selected Capsule:</span>
            <div className="relative">
              <select
                value={selectedCapsule}
                onChange={(e) => handleLocalCapsuleChange(e.target.value)}
                className="appearance-none bg-white border border-brand-border text-brand-charcoal font-semibold text-xs py-1.5 pl-3 pr-8 rounded-sm focus:outline-none focus:ring-1 focus:ring-brand-olive cursor-pointer"
              >
                <option value="all_actual">All Actual Pieces</option>
                <option value="Summer 25-26">Summer 25-26</option>
                <option value="Autumn 26">Autumn 26</option>
                <option value="Winter 26">Winter 26</option>
                <option value="Handbag Inventory">Handbag Inventory</option>
                <option value="Dream AW">Dream AW Future</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-brand-sage">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setManualMode(!manualMode);
              setAiOutfits([]);
            }}
            className={`px-5 py-2.5 text-xs font-semibold rounded-sm tracking-wider uppercase border transition-all cursor-pointer ${
              manualMode
                ? "bg-brand-charcoal text-white border-brand-charcoal"
                : "bg-white text-brand-charcoal border-brand-border hover:bg-brand-greige/50"
            }`}
          >
            {manualMode ? "Switch to AI Mode" : "Compose look manually"}
          </button>
        </div>
      </div>

      {/* AI DIRECTIONAL CONSOLE */}
      {!manualMode && (
        <section className="bg-brand-greige/40 rounded-sm border border-brand-border p-6 space-y-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-brand-olive text-white rounded-xl shadow-3xs">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-serif font-semibold text-brand-charcoal text-[17px] tracking-tight">
                Activity Outfit Matcher
              </h3>
              <p className="text-xs text-brand-sage leading-relaxed">
                Choose an activity capsule. the engine will intuit appropriate garment suitability, layering notes, and color aesthetics. 
              </p>
            </div>
          </div>

          {/* Activity Pills Grid Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-brand-sage tracking-wider">
                Select Active Daily Routine Activity Capsule ({activities.length})
              </span>
              <button
                onClick={() => setIsAddingActivity(!isAddingActivity)}
                className="text-[10px] font-bold text-brand-olive hover:underline flex items-center gap-1 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Add Custom Activity
              </button>
            </div>

            {/* Quick add custom activity */}
            <AnimatePresence>
              {isAddingActivity && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleAddCustomActivity}
                  className="bg-white border border-brand-border rounded-xl p-3 flex gap-2 overflow-hidden shadow-3xs"
                >
                  <input
                    type="text"
                    value={newActivityName}
                    onChange={(e) => setNewActivityName(e.target.value)}
                    placeholder="Enter custom activity (e.g. Tennis & Coffee, Art Gallery Visit...)"
                    className="flex-1 text-xs border border-brand-border px-3.5 py-2 rounded-lg outline-none focus:ring-1 focus:ring-brand-olive"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand-olive text-white text-[10px] font-bold uppercase rounded-lg tracking-wider hover:bg-[#484833]"
                  >
                    Add
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="flex flex-wrap gap-2.5">
              {activities.map((act) => {
                const isSelected = selectedActivity === act;
                return (
                  <button
                    key={act}
                    onClick={() => selectActivityAndObjective(act)}
                    className={`px-4 py-2.5 rounded-full text-xs font-semibold cursor-pointer border flex items-center gap-2 transition-all hover:scale-[1.01] ${
                      isSelected
                        ? "bg-brand-olive text-white border-brand-olive shadow-sm"
                        : "bg-white hover:bg-[#FAF9F6] border-brand-border text-brand-charcoal"
                    }`}
                  >
                    <span>{getActivityEmoji(act)}</span>
                    <span>{act}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-brand-sage tracking-wider block">
              Aesthetic Direction / the engine Prompts (Editable)
            </span>
            <input
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Aesthetic moods or styling goals"
              className="w-full bg-white border border-brand-border text-brand-charcoal text-sm px-4.5 py-3 rounded-sm focus:ring-1 focus:ring-brand-olive focus:outline-none placeholder-brand-sage"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={() => generateAiOutfits()}
              disabled={loading}
              className="w-full sm:flex-1 py-3 bg-brand-olive hover:bg-[#484833] disabled:bg-brand-sage/40 text-white font-bold text-xs uppercase tracking-widest rounded-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              Generate Styled look for {selectedActivity.split(" (")[0]}
            </button>
            
            <button
              onClick={triggerWildcardSuggestion}
              disabled={loading}
              title="Style unexpected pattern pairs, bold color contrasts & experimental matches!"
              className="w-full sm:w-auto px-6 py-3 bg-stone-900 border border-stone-850 hover:bg-stone-800 text-stone-100 font-bold text-xs uppercase tracking-widest rounded-sm flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer group"
            >
              <Shuffle className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              🎲 Surprise Wildcard
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-650 bg-red-50 p-3.5 rounded-xl border border-red-200/50 font-mono">
              {error}
            </p>
          )}

          {/* Dealer Table & Results Area */}
          {(loading || aiOutfits.length > 0) && (
            <div className="flex flex-col md:flex-row gap-6 xl:gap-10 mt-6 pt-6 border-t border-dashed border-brand-border h-full relative">
              
              {/* The "Dealer" Deck area */}
              <div className="hidden md:flex flex-col items-center justify-start w-32 shrink-0 relative pt-10 pb-6 z-10">
                <div className="relative w-24 h-32 border border-dashed border-brand-border/40 rounded-xl flex items-center justify-center">
                  <div className="absolute font-mono text-[8px] text-stone-300 uppercase font-bold tracking-widest text-center mt-20">Full Inventory</div>
                  
                  {/* visual stack of cards */}
                  {[2, 1, 0].map((i) => (
                    <motion.div
                      key={i}
                      initial={false}
                      animate={
                        loading
                          ? { y: [0, -8, 0], x: [(i - 1) * 3, -(i - 1) * 3, (i - 1) * 3], rotate: [i * 3, -i * 3, i * 3] }
                          : { y: i * 4, x: i * 4, rotate: (i - 1) * 4 }
                      }
                      transition={
                        loading
                          ? { duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }
                          : { type: "spring", stiffness: 200, damping: 20 }
                      }
                      className="absolute inset-0 bg-white border border-brand-border shadow-xs rounded-xl flex items-center justify-center p-1.5"
                      style={{ transformOrigin: "bottom center", zIndex: 10 - i }}
                    >
                      <div className={`w-full h-full border border-stone-100 rounded-lg bg-[#FAF9F6] flex flex-col justify-between p-2 transition-opacity ${loading ? 'opacity-40' : 'opacity-80'}`}>
                         <div className="w-5 h-5 bg-stone-200 rounded-sm" />
                         <div className="space-y-1">
                           <div className="h-1 bg-stone-200/80 rounded w-full" />
                           <div className="h-1 bg-stone-200/80 rounded w-2/3" />
                         </div>
                      </div>
                    </motion.div>
                  ))}
                  
                  {/* spark during loading */}
                  {loading && (
                    <div className="absolute -top-3 -right-3 z-20">
                       <Sparkles className="w-4 h-4 text-brand-olive animate-pulse" />
                    </div>
                  )}
                </div>
                <p className="mt-8 text-[9px] font-bold text-center text-brand-sage uppercase tracking-wider leading-relaxed">
                  {loading ? "Engine Shuffling Cards..." : "Inventory Deck"}
                </p>
              </div>

              {/* Main dynamic results area */}
              <div className="flex-1 min-w-0">
                {/* Flashy Stylist Active Loading Board */}
                {loading && (
                  <div className="py-12 flex flex-col items-center justify-center space-y-5 bg-white rounded-2xl border border-brand-border/60 shadow-3xs max-w-full overflow-hidden relative">
                    {/* Halos animation background */}
                    <div className="absolute inset-0 m-auto w-40 h-40 bg-brand-olive/5 blur-3xl rounded-full animate-pulse" />
                    
                    {/* Spinner silhouettes assembly mimicking hanger reels */}
                    <div className="flex items-center gap-4">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                        className="w-12 h-14 border border-dashed border-brand-olive/35 rounded-full flex items-center justify-center text-brand-olive/45"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </motion.div>
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-2 border-brand-olive border-t-transparent animate-spin flex items-center justify-center" />
                        <Sparkles className="w-5 h-5 text-brand-olive absolute inset-0 m-auto animate-pulse" />
                      </div>
                      <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                        className="w-12 h-14 border border-dashed border-brand-olive/35 rounded-full flex items-center justify-center text-brand-olive/45"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </motion.div>
                    </div>

                    <div className="text-center space-y-1.5 z-10 px-5 max-w-md">
                      <h4 className="font-serif font-semibold text-brand-charcoal text-base">Analytical Engine orchestrating look permutations...</h4>
                      <p className="text-brand-sage text-xs font-mono tracking-wide uppercase">{loaderPhrase}</p>
                      <p className="text-[10px] text-brand-sage/60">Cross-referencing active capsule items with logged corrections ledger</p>
                    </div>
                  </div>
                )}

          {/* AI Output results list collections */}
          <AnimatePresence>
            {aiOutfits.length > 0 && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 350, damping: 25, mass: 0.8 }}
                className="space-y-6 pt-5 border-t border-dashed border-brand-border"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-[10.5px] uppercase font-bold text-stone-400 tracking-wider">
                    Creative Look board Suggestions ({aiOutfits.length}) Auto-numbered
                  </h4>
                  {engineNote && (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200/60 text-[9px] px-2.5 py-1 rounded-sm font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-3xs">
                      <AlertCircle className="w-2.5 h-2.5" /> {engineNote}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {aiOutfits.map((outfit, index) => {
                    const isReportingThis = reportingOutfitIdx === index;
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 25, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 380, damping: 26, delay: index * 0.05 }}
                        key={index}
                        className="bg-white rounded-sm border border-brand-border p-6 shadow-xs flex flex-col lg:flex-row justify-between gap-6 hover:shadow-md transition-all duration-200 relative overflow-visible"
                      >
                        {/* Tiny Card Index Number Display */}
                        <div className="absolute top-0 left-0 bg-brand-olive text-white px-3 py-1 text-[10px] font-mono font-bold rounded-br-2xl select-none shadow-3xs">
                          Suggestion #{index + 1}
                        </div>

                        <div className="flex-1 space-y-4 pt-2">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] uppercase font-bold font-mono tracking-widest bg-brand-greige text-brand-charcoal px-2.5 py-0.5 rounded-md">
                                {outfit.aesthetic}
                              </span>
                              <span className="text-[9px] uppercase font-bold font-mono tracking-widest bg-brand-greige text-brand-charcoal px-2.5 py-0.5 rounded-md flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-brand-sage" /> {outfit.occasion}
                              </span>
                            </div>
                            <h5 className="font-serif font-semibold text-brand-charcoal text-lg mt-1">
                              {outfit.name}
                            </h5>
                            <p className="text-brand-sage text-xs italic leading-relaxed">
                              "{outfit.description}"
                            </p>
                          </div>

                          <div className="text-xs text-brand-charcoal bg-[#FAF9F6] p-4 rounded-xl border border-brand-border space-y-1.5 leading-relaxed">
                            <span className="font-bold text-brand-charcoal uppercase text-[9px] tracking-wider block font-sans">
                              How to wear it:
                            </span>
                            <p>{outfit.stylingNotes}</p>
                          </div>

                          {/* The scored reasons the prose above was generated from. */}
                          {outfit.whyItWorks && outfit.whyItWorks.length > 0 && (
                            <div className="text-[11px] text-brand-sage bg-white p-3.5 rounded-xl border border-dashed border-brand-border space-y-1">
                              <span className="font-bold text-brand-charcoal uppercase text-[9px] tracking-wider block font-sans">
                                Why this works
                                {typeof outfit.score === "number" && (
                                  <span className="float-right font-mono normal-case tracking-normal text-brand-sage">
                                    score {outfit.score.toFixed(2)}
                                  </span>
                                )}
                              </span>
                              <ul className="space-y-0.5">
                                {outfit.whyItWorks.map((why, i) => (
                                  <li key={i} className="flex gap-1.5">
                                    <span className="text-brand-olive">·</span>
                                    <span>{why}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => {
                                onSaveOutfit(outfit);
                                setAiOutfits(prev => prev.filter((_, idx) => idx !== index));
                              }}
                              className="px-5 py-2.5 bg-[#E8F0E8] text-[#4A674A] hover:bg-[#dbebd8] text-[10.5px] font-bold tracking-widest uppercase rounded-sm flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Heart className="w-3.5 h-3.5 fill-[#4A674A] text-[#4A674A]" />
                              Pin LOOK to Portfolio
                            </button>

                            <button
                              onClick={() => {
                                setReportingOutfitIdx(isReportingThis ? null : index);
                                setFeedbackText("");
                                setCorrectionItemId("");
                                setCorrectionOtherId("");
                              }}
                              className="px-4 py-2.5 bg-red-50 text-red-750 hover:bg-red-100/70 border border-red-200/50 text-[10.5px] font-bold tracking-widest uppercase rounded-sm flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                              {isReportingThis ? "Close Correction" : "Log Styling Mistake"}
                            </button>
                          </div>

                          {/* Inline Suitability correction form - loop-closes feedback */}
                          <AnimatePresence>
                            {isReportingThis && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-red-50/50 rounded-xl p-4 border border-red-200/40 space-y-3 overflow-hidden text-xs"
                              >
                                <div className="space-y-1">
                                  <label className="font-bold text-red-950 uppercase text-[9px] tracking-wider block">Why didn't this work?</label>
                                  <p className="text-[11px] text-red-900/80 leading-tight">Each option becomes a rule the engine has to obey from the next suggestion on. You can review and remove them in the ledger below.</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                  {CORRECTION_KINDS.map(k => (
                                    <label key={k.id} className="flex items-center gap-2 text-[11px] text-red-950 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`correction-${index}`}
                                        checked={correctionKind === k.id}
                                        onChange={() => setCorrectionKind(k.id)}
                                        className="accent-red-700"
                                      />
                                      {k.label}
                                    </label>
                                  ))}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <label className="space-y-1 block">
                                    <span className="text-[9px] uppercase font-bold tracking-wider text-red-950">Which piece?</span>
                                    <select
                                      value={correctionItemId}
                                      onChange={(e) => setCorrectionItemId(e.target.value)}
                                      className="w-full text-[11px] p-2 rounded-lg border border-red-200 bg-white text-stone-900 outline-none focus:ring-1 focus:ring-red-500"
                                    >
                                      <option value="">Choose a garment…</option>
                                      {outfit.items.map(g => (
                                        <option key={g.id} value={g.id}>{g.item} ({g.color})</option>
                                      ))}
                                    </select>
                                  </label>

                                  {CORRECTION_KINDS.find(k => k.id === correctionKind)?.needsSecond && (
                                    <label className="space-y-1 block">
                                      <span className="text-[9px] uppercase font-bold tracking-wider text-red-950">Clashes with</span>
                                      <select
                                        value={correctionOtherId}
                                        onChange={(e) => setCorrectionOtherId(e.target.value)}
                                        className="w-full text-[11px] p-2 rounded-lg border border-red-200 bg-white text-stone-900 outline-none focus:ring-1 focus:ring-red-500"
                                      >
                                        <option value="">Choose a garment…</option>
                                        {outfit.items.filter(g => g.id !== correctionItemId).map(g => (
                                          <option key={g.id} value={g.id}>{g.item} ({g.color})</option>
                                        ))}
                                      </select>
                                    </label>
                                  )}
                                </div>

                                <textarea
                                  value={feedbackText}
                                  onChange={(e) => setFeedbackText(e.target.value)}
                                  placeholder="Optional note for your own records — this is logged, not parsed."
                                  rows={2}
                                  className="w-full text-xs p-3.5 rounded-lg border border-red-200 bg-white text-stone-900 outline-none focus:ring-1 focus:ring-red-500 resize-none"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setReportingOutfitIdx(null)}
                                    className="px-3.5 py-1.5 bg-white text-stone-500 rounded-md border border-stone-250 font-semibold text-[11px] hover:bg-stone-50 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => submitCorrection(outfit)}
                                    disabled={isLoggingMemory || !correctionItemId || (!!CORRECTION_KINDS.find(k => k.id === correctionKind)?.needsSecond && !correctionOtherId)}
                                    className="px-4 py-1.5 bg-red-700 text-stone-50 rounded-md font-bold text-[11px] hover:bg-red-850 disabled:bg-red-300 font-sans tracking-wide uppercase cursor-pointer flex items-center gap-1"
                                  >
                                    {isLoggingMemory ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                                    Save rule
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {memorySavedMessage && (
                            <div className="p-3 bg-[#E8F0E8] text-[#4A674A] border border-[#dbebd8] rounded-lg flex items-center gap-2 text-xs font-medium">
                              <CheckCircle className="w-4 h-4 shrink-0" />
                              <p>{memorySavedMessage}</p>
                            </div>
                          )}
                        </div>

                        {/* Responsive, wrapped layout that never stretches out of boundaries */}
                        <div className="w-full lg:w-auto max-w-full flex flex-wrap items-center justify-center gap-2 bg-brand-greige/35 rounded-2xl p-4 border border-brand-border self-center md:pb-5">
                          {outfit.items.map((garment, gIdx) => (
                            <motion.div
                              key={gIdx}
                              initial={{ x: -350, y: -60, opacity: 0, rotate: -35, scale: 0.4 }}
                              animate={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
                              transition={{ 
                                type: "spring", 
                                stiffness: 220, 
                                damping: 20, 
                                delay: (index * outfit.items.length + gIdx) * 0.05 + 0.1 
                              }}
                              className="w-[82px] shrink-0 text-center bg-white border border-brand-border p-2 rounded-xl flex flex-col items-center justify-between h-36 relative group shadow-2xs hover:border-brand-olive hover:shadow-xs transition-all duration-200"
                            >
                              {/* Item Rank inside Outfit Suggester */}
                              <span className="absolute bottom-1 right-2 font-mono text-[10px] text-stone-500 select-none font-bold">
                                #{gIdx + 1}
                              </span>
                              
                              <span
                                className="absolute top-1 left-1.5 w-2 h-2 rounded-full border border-white shadow-3xs"
                                style={{ backgroundColor: garment.hex || "#e5e5e5" }}
                                title={`${garment.color} (${garment.status === "buy" ? "Wishlist item" : "Owned item"})`}
                              />
                              {/* Graphic core */}
                              <div className="w-10 h-14 flex items-center justify-center">
                                <ApparelSilhouette category={garment.aiSuggestedCategory || "Tops"} hexColor={garment.hex} />
                              </div>
                              {/* Info */}
                              <div className="w-full pt-1 border-t border-dashed border-stone-100 relative">
                                <p className="text-[9px] font-bold text-brand-charcoal truncate block capitalize leading-none mb-0.5 pr-5">
                                  {garment.item}
                                </p>
                                <p className="text-[7.5px] font-semibold text-brand-sage truncate block uppercase font-sans leading-none pr-5">
                                  {garment.brand || "Unbranded"}
                                </p>
                              </div>

                              {/* Gorgeous Hover detail popover card! */}
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 bg-white/95 border border-brand-border rounded-xl p-2.5 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-40 flex flex-col justify-between text-left shadow-md">
                                <div className="space-y-1 overflow-hidden">
                                  <div className="flex items-center gap-1.5 justify-between">
                                    <span className="font-sans text-[8px] uppercase tracking-wider font-bold bg-brand-greige px-1.5 py-0.5 rounded-sm line-clamp-1">{garment.aiSuggestedCategory || "Tops"}</span>
                                    <span className="w-2.5 h-2.5 rounded-full border border-stone-200 shadow-3xs shrink-0" style={{ backgroundColor: garment.hex || "#e5e5e5" }} title={garment.color} />
                                  </div>
                                  <h5 className="font-serif font-bold text-brand-charcoal text-[11.5px] leading-tight capitalize truncate">{garment.item}</h5>
                                  <p className="text-[10px] text-brand-sage font-medium uppercase font-sans tracking-wide leading-none">{garment.brand || "Unbranded"}</p>
                                  <p className="text-[9.5px] text-stone-600 font-semibold truncate leading-none capitalize mt-1">Col: {garment.color}</p>
                                  {garment.description && (
                                    <p className="text-[9px] text-stone-500 italic leading-snug line-clamp-2 pt-0.5 border-t border-stone-100/50">"{garment.description}"</p>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-[8px] font-mono text-stone-400 border-t border-dashed border-stone-100 pt-1 mt-1">
                                  <span className="truncate max-w-[90px]">{garment.season}</span>
                                  <span className="uppercase text-[7.5px] font-bold text-[#4A674A]">{garment.status === "buy" ? "Wishlist" : "Owned"}</span>
                                </div>
                              </div>

                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    )}
  </section>
)}

      {/* REPOSITORY ALIGNMENT MEMORIES LEDGER */}
      <section className="bg-white rounded-sm border border-brand-border p-5 space-y-3 shadow-3xs hover:shadow-xs transition-shadow">
        <button
          onClick={() => setShowLedger(!showLedger)}
          className="w-full flex items-center justify-between font-serif text-brand-charcoal text-sm font-semibold tracking-wide uppercase outline-none select-none cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand-sage" />
            <span>Repository Styling Memories Ledger (memories.md)</span>
          </div>
          {showLedger ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <AnimatePresence>
          {showLedger && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 overflow-hidden"
            >
              <p className="text-xs text-brand-sage leading-relaxed">
                These are the rules the scorer actually enforces, stored in <code className="bg-[#FAF9F6] border border-stone-200 px-1 py-0.5 rounded-md font-semibold select-all text-[11px]">style-guide.json</code>. A vetoed combination is never shown, whatever else it scores. The log underneath is the human-readable record of why each rule exists.
              </p>

              {savedRules.length > 0 && (
                <ul className="space-y-1.5">
                  {savedRules.map(rule => (
                    <li key={rule.id} className="flex items-center justify-between gap-3 bg-white border border-brand-border rounded-lg px-3 py-2 text-[11px]">
                      <span className="text-brand-charcoal">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-brand-sage mr-2">{rule.kind}</span>
                        {rule.label || rule.key}
                        {rule.activity && <span className="text-brand-sage"> — {rule.activity}</span>}
                        {typeof rule.delta === "number" && <span className="text-brand-sage"> ({rule.delta > 0 ? "+" : ""}{rule.delta})</span>}
                      </span>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        title="Remove this rule"
                        className="text-brand-sage hover:text-red-700 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="bg-[#FAF9F6] border border-brand-border rounded-xl p-4 max-h-60 overflow-y-auto font-mono text-[11px] leading-relaxed select-text text-brand-charcoal whitespace-pre-wrap divide-y divide-brand-border/30">
                {savedMemories ? savedMemories : "Nothing corrected yet. When a suggestion is wrong, hit 'Log Styling Mistake' on its card and the engine gains a rule."}
              </div>

              {savedRules.length > 0 && (
                <div className="flex justify-end pr-1 pt-1">
                  <button
                    onClick={handleClearMemories}
                    className="px-3.5 py-1 text-[10px] bg-red-50 text-red-750 hover:bg-red-100 rounded-lg font-bold uppercase tracking-wider border border-red-200/50 flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear all rules
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* MANUAL COMPOSER CONSOLE */}
      {manualMode && (
        <section className="bg-brand-greige/40 rounded-sm border border-brand-border p-6 space-y-6 animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-brand-olive text-white rounded-xl shadow-3xs">
              <Compass className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-serif font-semibold text-brand-charcoal text-base">
                Signature Capsule Look Composer
              </h3>
              <p className="text-xs text-brand-sage leading-relaxed">
                Manually assemble customized styled outfit boards by selecting apparel items from your list below.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-brand-sage tracking-wider">
                  Outfit Set Name
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g., Casual Sunday Linen Chic"
                  className="w-full bg-white border border-brand-border text-brand-charcoal text-xs px-3.5 py-2.5 rounded-xl focus:ring-1 focus:ring-brand-olive focus:outline-none placeholder-brand-sage"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-brand-sage tracking-wider">
                    Aesthetic
                  </label>
                  <input
                    type="text"
                    value={manualAesthetic}
                    onChange={(e) => setManualAesthetic(e.target.value)}
                    placeholder="e.g., French Riviera"
                    className="w-full bg-white border border-brand-border text-brand-charcoal text-xs px-3.5 py-2.5 rounded-xl focus:ring-1 focus:ring-brand-olive focus:outline-none placeholder-brand-sage"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-brand-sage tracking-wider">
                    Occasion
                  </label>
                  <input
                    type="text"
                    value={manualOccasion}
                    onChange={(e) => setManualOccasion(e.target.value)}
                    placeholder="e.g., Casual Travel"
                    className="w-full bg-white border border-brand-border text-brand-charcoal text-xs px-3.5 py-2.5 rounded-xl focus:ring-1 focus:ring-brand-olive focus:outline-none placeholder-brand-sage"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-brand-sage tracking-wider">
                  Sensory Description
                </label>
                <textarea
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="Describe the look's atmosphere or fluid vibe..."
                  rows={2}
                  className="w-full bg-white border border-brand-border text-brand-charcoal text-xs px-3.5 py-2 rounded-xl focus:ring-1 focus:ring-brand-olive focus:outline-none resize-none placeholder-brand-sage"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-brand-sage tracking-wider">
                  Styling Notes & Guide
                </label>
                <textarea
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="How to cuff sleeves, tuck cuffs, or wear accessories..."
                  rows={2}
                  className="w-full bg-white border border-brand-border text-brand-charcoal text-xs px-3.5 py-2 rounded-xl focus:ring-1 focus:ring-brand-olive focus:outline-none resize-none placeholder-brand-sage"
                />
              </div>
            </div>

            {/* Selector list */}
            <div className="space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-brand-sage tracking-wider block mb-2">
                  Tap Clothes to Attach ({selectedItemIds.length} Selected) Auto-numbered
                </span>
                
                <div className="bg-white border border-brand-border rounded-xl max-h-56 overflow-y-auto p-2.5 space-y-1.5 scrollbar-thin">
                  {filteredWardrobe.length === 0 ? (
                    <div className="text-center py-6 text-xs text-brand-sage italic">
                      No items in this capsule. Try selecting a different active capsule.
                    </div>
                  ) : (
                    filteredWardrobe.map((garment, idx) => {
                      const isSelected = selectedItemIds.includes(garment.id);
                      return (
                        <button
                          key={garment.id}
                          onClick={() => toggleManualItemSelection(garment.id)}
                          className={`w-full text-left p-2.5 rounded-lg text-xs flex items-center justify-between border transition-all cursor-pointer relative group ${
                            isSelected
                              ? "bg-brand-olive text-white border-brand-olive font-semibold shadow-xs"
                              : "bg-[#FAF9F6] hover:bg-brand-greige/40 text-brand-charcoal border-brand-border/60"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-xs w-5 shrink-0 font-bold select-none text-center ${isSelected ? "text-stone-200" : "text-stone-500"}`}>
                              {(idx + 1).toString().padStart(2, "0")}
                            </span>
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white shadow-xs block"
                              style={{ backgroundColor: garment.hex }}
                            />
                            <span className="capitalize">{garment.brand || "Unbranded"} — {garment.item} ({garment.color})</span>
                          </div>
                          <span className={`text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${
                            isSelected ? "bg-white/20 text-white" : "bg-brand-greige text-brand-sage"
                          }`}>
                            {garment.status === "buy" ? "Wishlist" : "Closet"}
                          </span>

                          {/* Detail tooltip on hover */}
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 w-48 bg-white text-brand-charcoal border border-brand-border rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 flex flex-col justify-between text-left shadow-md">
                            <span className="font-sans text-[7.5px] uppercase tracking-wider font-bold bg-brand-greige px-1.5 py-0.5 rounded-sm w-fit mb-1">{garment.aiSuggestedCategory || "Tops"}</span>
                            <h6 className="font-serif font-bold text-[11px] leading-tight capitalize truncate mb-0.5">{garment.item}</h6>
                            <p className="text-[9px] text-stone-500 italic truncate leading-none mb-1">"{garment.description || "No description"}"</p>
                            <div className="text-[8px] text-stone-400 font-mono flex justify-between border-t border-stone-100 pt-1">
                              <span>Season: {garment.season}</span>
                              <span className="uppercase text-[#4A674A]">{garment.status === "buy" ? "Wishlist" : "Owned"}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                onClick={handleSaveManualOutfit}
                disabled={!manualName || selectedItemIds.length === 0}
                className="w-full py-3 bg-brand-olive text-white hover:bg-[#484833] disabled:bg-brand-sage/40 text-xs font-semibold uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
              >
                <Plus className="w-4 h-4" /> Save Look Set to Portfolio
              </button>
            </div>
          </div>
        </section>
      )}

      {/* SAVED PORTFOLIO LOOKBOOK BOARD */}
      <div className="space-y-5">
        <h3 className="font-serif font-medium text-brand-charcoal text-lg flex items-center gap-2 uppercase tracking-wider select-none">
          <Layers className="w-4 h-4 text-brand-sage" /> Active Saved Lookbook Portfolio ({savedOutfits.length})
        </h3>

        {savedOutfits.length === 0 ? (
          <div className="border border-brand-border border-dashed rounded-sm p-12 text-center bg-white shadow-3xs select-none">
            <Calendar className="w-8 h-8 text-brand-sage/50 mx-auto mb-3 animate-bounce" />
            <p className="text-brand-charcoal font-medium text-sm">Your Lookbook portfolio is currently empty.</p>
            <p className="text-brand-sage text-xs mt-1">Use the the engine Activity Matcher above or assemble tailored outfit boards manually!</p>
          </div>
        ) : (
          <motion.div layout className="space-y-5">
            <AnimatePresence mode="popLayout">
              {savedOutfits.map((outfit, index) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 40, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -50, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30, delay: index * 0.05 }}
                  key={`saved-outfit-${index}-${outfit.name}`}
                  className="bg-white rounded-sm border border-brand-border p-6 flex flex-col md:flex-row justify-between gap-6 relative shadow-xs hover:shadow-sm transition-shadow group overflow-hidden"
                >
                {/* Auto number indicator of pinned looks */}
                <div className="absolute top-0 left-0 bg-brand-charcoal text-white px-3 py-1 text-[10px] font-mono font-bold rounded-br-2xl select-none shadow-3xs">
                  Portfolio Set #{index + 1}
                </div>

                <button
                  onClick={() => onDeleteOutfit(index)}
                  className="absolute top-3 right-3 p-2 text-brand-sage hover:text-red-650 rounded-lg hover:bg-[#FAF9F6] opacity-100 md:opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  title="Remove Outfit from Lookbook"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex-1 space-y-3 pt-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className="text-[9px] uppercase font-bold tracking-widest bg-brand-greige text-brand-charcoal px-2.5 py-0.5 rounded-md">
                        {outfit.aesthetic}
                      </span>
                      <span className="text-[9px] uppercase font-bold tracking-widest bg-brand-greige text-brand-charcoal px-2.5 py-0.5 rounded-md">
                        {outfit.occasion}
                      </span>
                    </div>

                    <h4 className="font-serif font-semibold text-brand-charcoal text-base tracking-tight font-semibold">
                      {outfit.name}
                    </h4>
                    <p className="text-brand-sage text-xs leading-relaxed mt-1 italic">
                      "{outfit.description}"
                    </p>
                  </div>

                  <div className="text-xs text-brand-charcoal/90 font-normal leading-relaxed border-l-2 border-brand-olive pl-3 py-1 bg-[#FAF9F6] pr-2 rounded-r-lg">
                    <p>{outfit.stylingNotes}</p>
                  </div>
                </div>

                {/* Displaying horizontal mini wardrobe cards within Pinned Portfolio Set */}
                <div className="w-full md:w-auto max-w-full flex flex-wrap items-center justify-start gap-1.5 bg-brand-greige/30 rounded-xl p-2.5 border border-brand-border self-center md:pb-3.5">
                  {outfit.items.map((garment, gIdx) => (
                    <motion.div
                      key={gIdx}
                      initial={{ x: -150, y: -40, opacity: 0, rotate: -25, scale: 0.5 }}
                      animate={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 220, 
                        damping: 18, 
                        delay: gIdx * 0.15 + 0.1 
                      }}
                      className="w-[80px] shrink-0 text-center bg-white border border-brand-border p-2 rounded-lg flex flex-col items-center justify-between h-32 relative group shadow-2xs hover:border-brand-olive hover:shadow-xs transition-all duration-200"
                    >
                      {/* Auto item index */}
                      <span className="absolute top-1 right-1.5 font-mono text-[8.5px] text-stone-400 select-none font-bold">
                        #{gIdx + 1}
                      </span>
                      
                      <div className="w-10 h-14 flex items-center justify-center">
                        <ApparelSilhouette category={garment.aiSuggestedCategory || "Tops"} hexColor={garment.hex} />
                      </div>
                      <div className="w-full border-t border-dashed border-stone-100 pt-0.5 relative">
                        <p className="text-[9px] font-bold text-brand-charcoal truncate block capitalize leading-none mb-0.5 pr-4">
                          {garment.item}
                        </p>
                        <p className="text-[7.5px] font-semibold text-brand-sage truncate block uppercase font-sans leading-none pr-4">
                          {garment.brand || "Unbranded"}
                        </p>
                      </div>

                      {/* Detail hover popup tooltip */}
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-48 bg-white/95 border border-brand-border rounded-xl p-2.5 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-40 flex flex-col justify-between text-left shadow-md">
                        <div className="space-y-1 overflow-hidden">
                          <div className="flex items-center gap-1.5 justify-between">
                            <span className="font-sans text-[7.5px] uppercase tracking-wider font-bold bg-brand-greige px-1.5 py-0.5 rounded-sm line-clamp-1">{garment.aiSuggestedCategory || "Tops"}</span>
                            <span className="w-2.5 h-2.5 rounded-full border border-stone-200 shadow-3xs shrink-0" style={{ backgroundColor: garment.hex || "#e5e5e5" }} title={garment.color} />
                          </div>
                          <h5 className="font-serif font-bold text-brand-charcoal text-[11px] leading-tight capitalize truncate">{garment.item}</h5>
                          <p className="text-[9.5px] text-brand-sage font-medium uppercase font-sans tracking-wide leading-none">{garment.brand || "Unbranded"}</p>
                          <p className="text-[9px] text-stone-600 font-semibold truncate leading-none capitalize mt-1">Col: {garment.color}</p>
                          {garment.description && (
                            <p className="text-[8.5px] text-stone-500 italic leading-snug line-clamp-2 pt-0.5 border-t border-[#FAF9F6]">"{garment.description}"</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[7.5px] font-mono text-stone-400 border-t border-dashed border-stone-100 pt-1 mt-1">
                          <span className="truncate max-w-[90px]">{garment.season}</span>
                          <span className="uppercase text-[7.5px] font-bold text-[#4A674A]">{garment.status === "buy" ? "Wishlist" : "Owned"}</span>
                        </div>
                      </div>

                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );

  function selectActivityAndObjective(actName: string) {
    setSelectedActivity(actName);
  }
}
