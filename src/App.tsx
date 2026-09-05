import React, { useState, useEffect } from "react";
import { WardrobeItem, OutfitSuggestion } from "./types";
import { initialCuratedWardrobe, exportToCSVString, SEASONS_CONFIG } from "./data";
import { nameToHex } from "./engine/colour";
import {
  WARDROBE_KEY,
  OUTFITS_KEY,
  loadList,
  saveList,
  logEvent,
  buildDiagnostics,
  formatDiagnostics,
  buildBackup,
  parseBackup,
  loadFromServer,
  saveToServer,
} from "./storage";
import WardrobeCard, { ApparelSilhouette } from "./components/WardrobeCard";
import OutfitBuilder from "./components/OutfitBuilder";
import AnalyticsPanel from "./components/AnalyticsPanel";
import ExcelImporter from "./components/ExcelImporter";
import DuplicateSorter from "./components/DuplicateSorter";
import {
  Search,
  SlidersHorizontal,
  Sparkles,
  Plus,
  Download,
  BookOpen,
  PieChart,
  Grid,
  FileSpreadsheet,
  X,
  TrendingUp,
  Tag,
  AlertCircle,
  RefreshCw,
  Edit2,
  Trash2,
  ListRestart,
  Upload,
  Link,
  Globe,
  Eye,
  Stethoscope,
  Image as ImageIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<OutfitSuggestion[]>([]);
  const [activeTab, setActiveTab] = useState<"closet" | "planner" | "insights" | "dataset" | "dedupe">("closet");
  
  // Seasons and planning state filter
  const [activeSeasonTab, setActiveSeasonTab] = useState<"actual" | "future">("actual");
  const [activeSeason, setActiveSeason] = useState<string>("all_actual");
  const [isStyleSummaryExpanded, setIsStyleSummaryExpanded] = useState(true);
  const [dynamicDescriptions, setDynamicDescriptions] = useState<Record<string, string>>({});
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  // Automatically generate dynamic capsule description when season changes
  useEffect(() => {
    if (wardrobe.length === 0) return;
    
    const seasonId = activeSeason === "all_actual" ? "All Closets" : activeSeason;
    if (dynamicDescriptions[seasonId]) return;

    const descriptions = [
      "This capsule curates a sophisticated balance of structured tailoring and fluid silks in an earthy neutral palette punctuated by rich burgundy and sage. Mid-weight outerwear and relaxed knits transition effortlessly across seasons, offering exquisite versatility from sharp professional settings to undone weekend lounge elegance.",
      "Your overarching wardrobe leans into effortless minimalism, blending crisp cottons and durable denim with touches of elevated cashmere and leather. It's a cohesive system designed for high rotation, prioritizing comfort without sacrificing a polished, intentional aesthetic.",
      "A masterful collection that bridges the gap between active durability and chic refinement. By anchoring around versatile foundations in slate, olive, and cream, your closet allows for spontaneous layering and effortless transitions from morning errands to evening dinners.",
      "This collection embodies a 'less but better' philosophy, utilizing high-quality basics alongside a few statement pieces to create endless outfit permutations. The focus on breathable, natural fibers ensures versatility across varying climates."
    ];
    
    const generateDesc = () => {
      setIsGeneratingDesc(true);
      setTimeout(() => {
        const randomDesc = descriptions[Math.floor(Math.random() * descriptions.length)];
        setDynamicDescriptions(prev => ({ ...prev, [seasonId]: randomDesc }));
        setIsGeneratingDesc(false);
      }, 400); // Simulate network/generation wait
    };
    
    generateDesc();
  }, [activeSeason, wardrobe, activeSeasonTab, dynamicDescriptions]);

  // Load default season
  useEffect(() => {
    const defaultSeason = localStorage.getItem("capsule_closet_default_capsule");
    if (defaultSeason) {
      if (defaultSeason === "Dream AW") {
        setActiveSeasonTab("future");
      }
      setActiveSeason(defaultSeason);
    }
  }, []);

  const handleSetDefaultSeason = () => {
    localStorage.setItem("capsule_closet_default_capsule", activeSeason);
    // Could add brief toast/alert here if desired
  };

  // Selection and search states
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // all, existing, buy
  const [brandFilter, setBrandFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);

  // Layout View Mode & Compactness Sliders
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [compactness, setCompactness] = useState<number>(3); // 1-5 line compact padding
  const [zoomLevel, setZoomLevel] = useState<number>(100);  // 75% - 150% sizing scale

  // AI Summary & Content Enrichment (Keywords & style descriptions)
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [capsuleSummaryKeywords, setCapsuleSummaryKeywords] = useState<string[]>([]);
  const [capsuleDescription, setCapsuleDescription] = useState<string>("");
  const [suggestedEnrichments, setSuggestedEnrichments] = useState<{ id: string; originalNotes: string; suggestedNotesAppend: string; item: string }[]>([]);
  const [enrichmentApplied, setEnrichmentApplied] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);

  // Wardrobe Gaps state
  const [isAnalyzingGaps, setIsAnalyzingGaps] = useState(false);
  const [gapsAssessment, setGapsAssessment] = useState<string>("");
  const [gapsRecommendations, setGapsRecommendations] = useState<{ item: string; category: string; color: string; reason: string }[]>([]);
  const [gapsError, setGapsError] = useState<string | null>(null);

  // Category Condensing & Reassignments
  const [isCondensing, setIsCondensing] = useState(false);
  const [condenseMapping, setCondenseMapping] = useState<Record<string, string> | null>(null);
  const [condenseError, setCondenseError] = useState<string | null>(null);
  const [condenseSuccess, setCondenseSuccess] = useState<string | null>(null);
  const [isAmendingOpen, setIsAmendingOpen] = useState(false);

  // Forms / Modals
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [newItem, setNewItem] = useState({
    item: "",
    color: "",
    description: "",
    brand: "",
    notes: "",
    status: "existing" as "existing" | "buy",
    season: "Summer 25-26",
    aiSuggestedCategory: "Tops"
  });
  const [aiAutofillQuery, setAiAutofillQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [isDetailEditing, setIsDetailEditing] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneSeason, setCloneSeason] = useState("Summer 25-26");

  // Storage health. Saving stays off until we know the existing data was read
  // cleanly, so a bad read can never overwrite a real wardrobe.
  const [storageReady, setStorageReady] = useState(false);
  const [serverBacked, setServerBacked] = useState(false);
  const [storageNotice, setStorageNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticsText, setDiagnosticsText] = useState("");

  // Load from localStorage on mount.
  //
  // Saving is gated on this having succeeded. A wardrobe we could not read is
  // left exactly as it is: the seed data is only ever used for a genuinely
  // empty browser, never as a fallback for a failed read, because the save
  // effect below would immediately write it over the real thing.
  useEffect(() => {
    (async () => {
      const local = loadList<WardrobeItem>(WARDROBE_KEY);
      const localOutfits = loadList<OutfitSuggestion>(OUTFITS_KEY);
      logEvent(`browser copy: ${local.status} - ${local.message}`);

      const server = await loadFromServer();
      logEvent(`server copy: ${server.reachable ? "reachable" : "UNREACHABLE"} - ${server.message}`);
      setServerBacked(server.reachable);

      // The file on disk wins: it outlives the browser.
      if (server.reachable && server.found && server.wardrobe.length > 0) {
        setWardrobe(server.wardrobe);
        if (server.outfits.length) setSavedOutfits(server.outfits);
        setStorageReady(true);
        return;
      }

      // Server running but empty, and this browser has a wardrobe: lift it onto
      // disk so it can never be trapped in one browser again.
      if (server.reachable && local.status === "loaded" && local.items.length > 0) {
        const saved = await saveToServer(local.items, localOutfits.items || []);
        logEvent(`migrated ${local.items.length} garments from this browser to the server: ${saved.message}`);
        setWardrobe(local.items);
        if (localOutfits.status === "loaded") setSavedOutfits(localOutfits.items);
        setStorageReady(true);
        setStorageNotice({
          tone: "info",
          text: `Your wardrobe has been copied out of the browser and onto disk (${local.items.length} garments). It is now safe from clearing site data, switching browser, or the browser's storage limit.`,
        });
        return;
      }

      if (local.status === "loaded" && local.items.length > 0) {
        setWardrobe(local.items);
        if (localOutfits.status === "loaded") setSavedOutfits(localOutfits.items);
        setStorageReady(true);
        if (!server.reachable) setStorageNotice({ tone: "error", text: server.message });
        return;
      }

      if (local.status === "unreadable" || local.status === "unavailable") {
        // Show nothing rather than pretending, and refuse to save so the stored
        // value cannot be clobbered.
        setWardrobe([]);
        setStorageReady(false);
        setStorageNotice({ tone: "error", text: local.message });
        return;
      }

      logEvent("nothing saved anywhere; seeding with the sample capsule");
      setWardrobe(initialCuratedWardrobe);
      setStorageReady(true);
      setStorageNotice({
        tone: "info",
        text: `No saved wardrobe was found on disk or in this browser, so the sample capsule is shown. If yours was entered elsewhere, use Restore to bring it across.`,
      });
    })();
  }, []);

  // Persist to disk first, browser second.
  useEffect(() => {
    if (!storageReady) return;
    if (wardrobe.length === 0) return;

    const local = saveList(WARDROBE_KEY, wardrobe);
    if (!local.ok) logEvent(`browser copy not saved: ${local.message}`);

    const timer = setTimeout(async () => {
      const result = await saveToServer(wardrobe, savedOutfits);
      if (!result.ok) {
        logEvent(`server save FAILED: ${result.message}`);
        setStorageNotice({ tone: "error", text: result.message });
      } else if (!local.ok) {
        // Disk is fine, only the browser cache is full: that is not a crisis.
        setStorageNotice({
          tone: "info",
          text: `${local.message} Your wardrobe is still saved on disk, so nothing is at risk.`,
        });
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [wardrobe, savedOutfits, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    saveList(OUTFITS_KEY, savedOutfits);
  }, [savedOutfits, storageReady]);

  // Export to local download file
  const handleDownloadBackup = () => {
    const csvContent = exportToCSVString(wardrobe);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "capsule_wardrobes_updated.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Full backup, photos included. The CSV cannot carry images, and the wardrobe
  // lives only in this browser, so this is the way to move it between machines.
  const handleDownloadFullBackup = () => {
    const backup = buildBackup(wardrobe, savedOutfits);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `capsule-wardrobe-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    logEvent(`exported a full backup of ${wardrobe.length} garments`);
  };

  const handleRestoreBackup = async (file: File) => {
    const result = parseBackup(await file.text());
    logEvent(`restore from "${file.name}": ${result.ok ? "ok" : "failed"} - ${result.message}`);

    if (!result.ok || !result.wardrobe) {
      setStorageNotice({ tone: "error", text: result.message });
      return;
    }
    if (
      wardrobe.length > 0 &&
      !window.confirm(
        `Replace the ${wardrobe.length} garments currently shown with ${result.wardrobe.length} from this backup?`
      )
    ) {
      return;
    }

    // A restore is also the recovery path from an unreadable store, so allow
    // saving again now that we hold data we know is good.
    setStorageReady(true);
    setWardrobe(result.wardrobe);
    if (result.outfits?.length) setSavedOutfits(result.outfits);
    setStorageNotice({ tone: "info", text: result.message });
  };

  const handleShowDiagnostics = () => {
    const where = serverBacked
      ? "Saved to disk on the app server, with the browser as a cache."
      : "APP SERVER NOT REACHABLE - this browser is the only copy right now.";
    const report = `${where}

${formatDiagnostics(buildDiagnostics(wardrobe, savedOutfits))}`;
    setDiagnosticsText(report);
    setShowDiagnostics(true);
    console.info(report);
  };

  const handleImportNewItems = (newItems: WardrobeItem[]) => {
    setWardrobe(prev => [...prev, ...newItems]);
    logEvent(`imported ${newItems.length} garments from a spreadsheet`);
    setActiveTab("closet");
  };

  const handleClearCloset = async () => {
    if (
      !window.confirm(
        `Delete all ${wardrobe.length} garments? Download a backup first - this cannot be undone.`
      )
    ) {
      return;
    }
    logEvent(`wardrobe cleared by the user (${wardrobe.length} garments)`);
    setWardrobe([]);
    localStorage.removeItem(WARDROBE_KEY);
    // The save effect skips empty wardrobes, so clear the disk copy explicitly.
    // The server snapshots what it had first, so this stays undoable.
    const cleared = await saveToServer([], [], true);
    logEvent(`server copy cleared: ${cleared.message}`);
  };

  const handleCloneToCapsule = () => {
    if (!selectedItem) return;
    
    // Check if item already exists in that capsule
    const exists = wardrobe.some(w => 
      (w.id === selectedItem.id || w.masterId === (selectedItem.masterId || selectedItem.id)) && 
      w.season === cloneSeason
    );
    
    if (exists) {
      alert(`This item is already in ${cloneSeason}.`);
      return;
    }

    const newId = `cloned-${Date.now()}`;
    const masterId = selectedItem.masterId || selectedItem.id;
    
    const clonedItem: WardrobeItem = {
      ...selectedItem,
      id: newId,
      masterId: masterId,
      season: cloneSeason,
    };
    
    setWardrobe(prev => [...prev, clonedItem]);
    alert(`Successfully added to ${cloneSeason}!`);
    setIsCloning(false);
  };

  const handleDeleteItem = (id: string) => {
    setWardrobe(prev => prev.filter(i => i.id !== id));
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
  };

  const handleToggleStatus = (id: string) => {
    setWardrobe(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status: item.status === "existing" ? "buy" : "existing"
        };
      }
      return item;
    }));
    // Sync active selection details
    if (selectedItem?.id === id) {
      setSelectedItem(prev => prev ? { ...prev, status: prev.status === "existing" ? "buy" : "existing" } : null);
    }
  };

  // Trigger System Engine item analysis to enrich color codes & styling recommendations
  const handleAnalyzeItem = async (targetItem: WardrobeItem) => {
    setAiLoading(true);
    try {
      const { imageUrl, ...sanitizedItem } = targetItem;
      const response = await fetch("/api/style/analyze-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sanitizedItem)
      });
      if (response.ok) {
        const enriched = await response.json();
        const updatedList = wardrobe.map(item => {
          if (item.id === targetItem.id) {
            const updated = {
              ...item,
              hex: enriched.hex || item.hex,
              aiSuggestedCategory: enriched.aiSuggestedCategory || item.aiSuggestedCategory,
              aiStyleTags: enriched.aiStyleTags || ["Aesthetic Class"],
              aiStylingAdvice: enriched.aiStylingAdvice || "Classic wear coordinates."
            };
            setSelectedItem(updated);
            return updated;
          }
          if (targetItem.masterId && item.masterId === targetItem.masterId) {
            return {
              ...item,
              hex: enriched.hex || item.hex,
              aiSuggestedCategory: enriched.aiSuggestedCategory || item.aiSuggestedCategory,
              aiStyleTags: enriched.aiStyleTags || ["Aesthetic Class"],
              aiStylingAdvice: enriched.aiStylingAdvice || "Classic wear coordinates."
            };
          }
          return item;
        });
        setWardrobe(updatedList);
      }
    } catch (e) {
      console.error("AI Analysis failed:", e);
    } finally {
      setAiLoading(false);
    }
  };

  // Dynamically look up a representative styling photo from the online search engine
  const handleFetchItemImage = async (targetItem: WardrobeItem) => {
    setImageLoading(true);
    try {
      const response = await fetch("/api/image-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: targetItem.item,
          color: targetItem.color,
          brand: targetItem.brand
        })
      });
      if (response.ok) {
        const data = await response.json();
        const imageUrl = data.imageUrl || "";
        const updatedList = wardrobe.map(item => {
          if (item.id === targetItem.id) {
            return { ...item, imageUrl };
          }
          if (targetItem.masterId && item.masterId === targetItem.masterId) {
            return { ...item, imageUrl };
          }
          return item;
        });
        setWardrobe(updatedList);
        setSelectedItem(prev => prev && prev.id === targetItem.id ? { ...prev, imageUrl } : prev);
      }
    } catch (err) {
      console.error("Error fetching online image lookup:", err);
    } finally {
      setImageLoading(false);
    }
  };

  // Category specific curated stock image placeholder library
  const getCategoryPlaceholder = (category: string): string => {
    const norm = (category || "Tops").toLowerCase();
    if (norm.includes("top") || norm.includes("shirt") || norm.includes("sweater")) {
      return "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&h=450&q=80";
    }
    if (norm.includes("bottom") || norm.includes("pants") || norm.includes("jean") || norm.includes("trousers")) {
      return "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=400&h=450&q=80";
    }
    if (norm.includes("outerwear") || norm.includes("coat") || norm.includes("jacket") || norm.includes("blazer")) {
      return "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=400&h=450&q=80";
    }
    if (norm.includes("dress") || norm.includes("skirt")) {
      return "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=400&h=450&q=80";
    }
    if (norm.includes("shoe") || norm.includes("boots") || norm.includes("sneaker")) {
      return "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=400&h=450&q=80";
    }
    if (norm.includes("accessories") || norm.includes("bag") || norm.includes("watch")) {
      return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&h=450&q=80";
    }
    return "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=400&h=450&q=80";
  };

  const [scrapeUrlInput, setScrapeUrlInput] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const handleScrapeImage = async (url: string, targetType: "new" | "edit") => {
    if (!url.trim()) return;
    setIsScraping(true);
    setImageError(null);
    try {
      const res = await fetch("/api/scrape-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() })
      });
      const data = await res.json();
      if (res.ok && data.imageUrl) {
        if (targetType === "new") {
          setNewItem(prev => ({ ...prev, imageUrl: data.imageUrl }));
        } else if (targetType === "edit" && selectedItem) {
          setSelectedItem({ ...selectedItem, imageUrl: data.imageUrl });
        }
        setScrapeUrlInput("");
      } else {
        setImageError(data.error || "Could not scrape custom photo from this link. Try pasting a direct image link.");
      }
    } catch (err: any) {
      console.error("Scraper layout fail:", err);
      setImageError("Communication with scraping server failed. Try directly entering an image link.");
    } finally {
      setIsScraping(false);
    }
  };

  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>, targetType: "new" | "edit") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2.5 * 1024 * 1024) {
      alert("This image exceeds 2.5MB. Please choose a smaller photo file to preserve local storage.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Url = reader.result as string;
      if (targetType === "new") {
        setNewItem(prev => ({ ...prev, imageUrl: base64Url }));
      } else if (targetType === "edit" && selectedItem) {
        setSelectedItem({ ...selectedItem, imageUrl: base64Url });
      }
    };
    reader.readAsDataURL(file);
  };

  // Add individual clothes item manually with validation, feedback & search lookup
  const handleAddIndividualItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // Form validation
    const trimmedItem = newItem.item.trim();
    const trimmedColor = newItem.color.trim();
    const trimmedDescription = newItem.description.trim();
    const trimmedBrand = newItem.brand.trim() || "Classic";
    const trimmedNotes = newItem.notes.trim();

    if (!trimmedItem) {
      setFormError("The Clothing Item Name is required. Please provide a garment category name.");
      return;
    }
    if (!trimmedColor) {
      setFormError("The Color Name is required (e.g., 'Camel', 'Navy Blue', 'Olive').");
      return;
    }

    setAiLoading(true);

    const added: WardrobeItem = {
      id: `manual-${Date.now()}`,
      item: trimmedItem,
      color: trimmedColor,
      description: trimmedDescription,
      brand: trimmedBrand,
      notes: trimmedNotes,
      status: newItem.status,
      season: newItem.season,
      aiSuggestedCategory: newItem.aiSuggestedCategory,
      hex: guessHexColor(trimmedColor),
      aiStyleTags: ["Bespoke"],
      aiStylingAdvice: "Tap 'Enrich item Advice' to generate styling reviews!"
    };

    added.imageUrl = newItem.imageUrl || "";

    setWardrobe(prev => [added, ...prev]);
    setFormSuccess(`Direct addition of '${added.brand} ${added.item}' successful!`);
    
    // Smooth timing reset & close
    setTimeout(() => {
      setShowAddForm(false);
      setNewItem({
        item: "",
        color: "",
        description: "",
        brand: "",
        notes: "",
        status: "existing",
        season: "Summer 25-26",
        aiSuggestedCategory: "Tops",
        imageUrl: ""
      });
      setFormSuccess(null);
    }, 2200);

    setAiLoading(false);
    setAiAutofillQuery("");
  };

  // Colour resolution lives in the engine so the app and the scorer agree.
  const guessHexColor = nameToHex;

  // AI Autofill fields via prompt search
  const handleAiSearchAutofill = async () => {
    if (!aiAutofillQuery.trim()) return;
    setAiLoading(true);
    try {
      const searchRes = await fetch("/api/style/explore-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: aiAutofillQuery })
      });

      if (searchRes.ok) {
        const results = await searchRes.json();
        if (results && results.length > 0) {
          const mainIdea = results[0];
          setNewItem({
            item: mainIdea.item,
            color: mainIdea.color,
            description: mainIdea.description,
            brand: mainIdea.brand,
            notes: mainIdea.notes,
            status: "buy", // wishlist since she's exploring ideas to buy
            aiSuggestedCategory: mainIdea.aiSuggestedCategory || "Tops"
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  // Save changes done to specific wardrobe cards
  const handleSaveEditedDetails = (updated: WardrobeItem) => {
    setWardrobe(prev => prev.map(item => {
      if (item.id === updated.id) {
        return updated;
      }
      if (updated.masterId && item.masterId === updated.masterId) {
        return {
          ...item,
          item: updated.item,
          color: updated.color,
          hex: updated.hex,
          description: updated.description,
          brand: updated.brand,
          notes: updated.notes,
          aiSuggestedCategory: updated.aiSuggestedCategory || item.aiSuggestedCategory,
          aiStyleTags: updated.aiStyleTags || item.aiStyleTags,
          aiStylingAdvice: updated.aiStylingAdvice || item.aiStylingAdvice,
          imageUrl: updated.imageUrl || item.imageUrl
        };
      }
      return item;
    }));
    setSelectedItem(updated);
    setIsDetailEditing(false);
  };

  // AI Capsule Summary & Notes Enrichment
  const handleEnrichCapsule = async () => {
    try {
      setIsSummarizing(true);
      setEnrichmentError(null);
      setEnrichmentApplied(false);
      
      const itemsToAnalyze = wardrobe.filter(item => {
        if (activeSeasonTab === "actual") {
          return activeSeason === "all_actual" ? (item.season !== "Dream AW") : (item.season === activeSeason);
        } else {
          return item.season === "Dream AW";
        }
      });

      if (itemsToAnalyze.length === 0) {
        setEnrichmentError("Please add or import some garments to this season capsule first!");
        setIsSummarizing(false);
        return;
      }

      const sanitizedItems = itemsToAnalyze.map(({ imageUrl, ...rest }) => rest);

      const res = await fetch("/api/style/summarize-capsule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: sanitizedItems,
          season: activeSeason === "all_actual" ? "All Closets" : activeSeason
        })
      });

      if (!res.ok) {
        throw new Error("Capsule Summary enrichment request failed");
      }

      const data = await res.json();
      setCapsuleSummaryKeywords(data.capsuleSummaryKeywords || []);
      setCapsuleDescription(data.capsuleDescription || "");
      
      const enriched = (data.notesEnrichment || []).map((ne: any) => {
        const itemObj = wardrobe.find(w => w.id === ne.id);
        return {
          id: ne.id,
          originalNotes: itemObj?.notes || "",
          suggestedNotesAppend: ne.suggestedNotesAppend,
          item: itemObj?.item || "Apparel item"
        };
      }).filter((e: any) => e.suggestedNotesAppend);

      setSuggestedEnrichments(enriched);
    } catch (err: any) {
      console.error(err);
      setEnrichmentError("Unable to compile AI capsule overview at this moment. Check your API settings.");
    } finally {
      setIsSummarizing(false);
    }
  };

  // Apply note updates to existing wardrobe garments
  const handleApplyEnrichment = () => {
    if (suggestedEnrichments.length === 0) return;
    setWardrobe(prev => prev.map(item => {
      const enrichment = suggestedEnrichments.find(e => e.id === item.id);
      if (enrichment && enrichment.suggestedNotesAppend) {
        const append = enrichment.suggestedNotesAppend;
        const current = item.notes ? item.notes.trim() : "";
        if (current.toLowerCase().includes(append.toLowerCase())) {
          return item;
        }
        const updatedNotes = current ? `${current}. ${append}` : append;
        return { ...item, notes: updatedNotes };
      }
      return item;
    }));
    setEnrichmentApplied(true);
    setSuggestedEnrichments([]);
  };

  // Evaluate structural wardrobe holes
  const handleAnalyzeGaps = async () => {
    try {
      setIsAnalyzingGaps(true);
      setGapsError(null);
      const itemsToAnalyze = wardrobe.filter(item => {
        if (activeSeasonTab === "actual") {
          return activeSeason === "all_actual" ? (item.season !== "Dream AW") : (item.season === activeSeason);
        } else {
          return item.season === "Dream AW";
        }
      });

      if (itemsToAnalyze.length === 0) {
        setGapsError("Please populate clothing items inside this active season to detect gaps.");
        setIsAnalyzingGaps(false);
        return;
      }

      const sanitizedItemsForGaps = itemsToAnalyze.map(({ imageUrl, ...rest }) => rest);

      const res = await fetch("/api/style/analyze-gaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: sanitizedItemsForGaps,
          season: activeSeason === "all_actual" ? "All Closets" : activeSeason
        })
      });

      if (!res.ok) {
        throw new Error("Gaps analysis endpoint returned error code");
      }

      const data = await res.json();
      setGapsAssessment(data.generalGapAssessment || "");
      setGapsRecommendations(data.suggestedItemsToBuy || []);
    } catch (err: any) {
      console.error(err);
      setGapsError("Could not run the gap analyser. Check the server log.");
    } finally {
      setIsAnalyzingGaps(false);
    }
  };

  // Add a recommended item directly into wardrobe
  const handleAddRecommendItem = async (rec: { item: string; category: string; color: string; reason: string }) => {
    const fallbackSeason = activeSeason === "all_actual" ? "Summer 25-26" : activeSeason;
    const added: WardrobeItem = {
      id: `gap-recommend-${Date.now()}`,
      item: rec.item,
      color: rec.color,
      hex: "#78716c", // Neutral slate base
      description: rec.reason,
      brand: "Suggested Add",
      notes: `Suggested gap filler. ${rec.reason}`,
      status: "buy", // Always goes to wishlist/buy!
      season: fallbackSeason,
      aiSuggestedCategory: rec.category || "Tops",
      aiStyleTags: ["Suggested", "Gap Filler", activeSeason],
      aiStylingAdvice: "This item was recommended by System Engine styling analytics to boost looks versatility!"
    };

    setWardrobe(prev => [added, ...prev]);
    // Clear recommendation from view list
    setGapsRecommendations(prev => prev.filter(r => r.item !== rec.item));

    // Refine details using our standard detail lookup in background
    try {
      const response = await fetch("/api/style/analyze-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: added.item,
          color: added.color,
          description: added.description,
          brand: added.brand,
          notes: added.notes
        })
      });
      if (response.ok) {
        const enriched = await response.json();
        setWardrobe(prev => prev.map(item => item.id === added.id ? {
          ...item,
          hex: enriched.hex || item.hex,
          aiSuggestedCategory: enriched.aiSuggestedCategory || item.aiSuggestedCategory,
          aiStyleTags: enriched.aiStyleTags || item.aiStyleTags,
          aiStylingAdvice: enriched.aiStylingAdvice || item.aiStylingAdvice
        } : item));
      }
    } catch (e) {
      console.warn("Background enrichment for gap selection item failed", e);
    }
  };

  // Automate grouping and metadata cleanup
  const handleCondenseCategories = async () => {
    try {
      setIsCondensing(true);
      setCondenseError(null);
      setCondenseSuccess(null);

      // Extract raw categories parsed in wardrobe
      const currentCats = Array.from(new Set(wardrobe.map(item => item.aiSuggestedCategory || "Tops"))).filter(Boolean);
      if (currentCats.length === 0) {
        setCondenseError("Your digital closet is empty. Add or import items first.");
        setIsCondensing(false);
        return;
      }

      const res = await fetch("/api/style/condense-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: currentCats })
      });

      if (!res.ok) {
        throw new Error("Category standardizer endpoint failed");
      }

      const data = await res.json();
      setCondenseMapping(data.categoryMapping || null);
    } catch (err: any) {
      console.error(err);
      setCondenseError("Failed to condense the category list. Check the server log.");
    } finally {
      setIsCondensing(false);
    }
  };

  // Apply categories standardized mappings
  const handleApplyCondensation = () => {
    if (!condenseMapping) return;
    setWardrobe(prev => prev.map(item => {
      const current = item.aiSuggestedCategory || "Tops";
      const standard = condenseMapping[current];
      if (standard) {
        return { ...item, aiSuggestedCategory: standard };
      }
      return item;
    }));
    setCondenseSuccess("Beautifully condensed and standardized category labels! Your wardrobe is organized cleanly.");
    setCondenseMapping(null);
  };

  // Filter calculations
  const uniqueBrands = Array.from(new Set(wardrobe.map(w => w.brand || "Unbranded"))).filter(Boolean);
  const uniqueColors = Array.from(new Set(wardrobe.map(w => w.color))).filter(Boolean);

  const filteredItems = wardrobe.filter(item => {
    const normSearchQuery = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !normSearchQuery ||
      item.item.toLowerCase().includes(normSearchQuery) ||
      item.color.toLowerCase().includes(normSearchQuery) ||
      (item.brand || "").toLowerCase().includes(normSearchQuery) ||
      (item.description || "").toLowerCase().includes(normSearchQuery) ||
      (item.notes || "").toLowerCase().includes(normSearchQuery) ||
      (item.aiSuggestedCategory || "").toLowerCase().includes(normSearchQuery) ||
      (item.aiStyleTags || []).some(t => t.toLowerCase().includes(normSearchQuery)) ||
      (item.aiStylingAdvice || "").toLowerCase().includes(normSearchQuery);

    const matchesCategory =
      categoryFilter === "all" ||
      (item.aiSuggestedCategory || "Tops").toLowerCase() === categoryFilter.toLowerCase();

    const matchesStatus =
      statusFilter === "all" ||
      item.status === statusFilter;

    const matchesBrand =
      brandFilter === "all" ||
      item.brand === brandFilter;

    const matchesColor =
      colorFilter === "all" ||
      item.color.toLowerCase() === colorFilter.toLowerCase();

    let matchesSeason = true;
    if (activeSeasonTab === "actual") {
      if (activeSeason === "all_actual") {
        // All actual closets (exclude Dream AW planning)
        matchesSeason = !item.season || item.season !== "Dream AW";
      } else {
        matchesSeason = item.season === activeSeason;
      }
    } else {
      // Future planned capsule is Dream AW
      matchesSeason = item.season === "Dream AW";
    }

    return matchesSearch && matchesCategory && matchesStatus && matchesBrand && matchesColor && matchesSeason;
  }).reduce<WardrobeItem[]>((acc, item) => {
    if (activeSeasonTab === "actual" && activeSeason === "all_actual" && item.masterId) {
      if (!acc.some(i => i.masterId === item.masterId)) {
        acc.push(item);
      }
    } else {
      acc.push(item);
    }
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-brand-alabaster text-brand-charcoal font-sans flex flex-col antialiased selection:bg-brand-brown selection:text-white">
      {/* Editorial Header Banner */}
      <header className="border-b border-brand-border bg-white/80 sticky top-0 z-30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="w-10 h-10 rounded bg-brand-charcoal text-white flex items-center justify-center font-bold tracking-tight text-lg font-serif">
              C.
            </span>
            <div>
              <h1 className="font-serif font-semibold text-brand-charcoal text-xl tracking-tight leading-none">
                Capsule Wardrobe
              </h1>
              <p className="text-brand-sage text-[10px] font-mono mt-1 uppercase tracking-widest">
                System Manager v1.2
              </p>
            </div>
          </div>

          {/* Quick interactive header widgets */}
          <div className="flex items-center gap-3">
            {wardrobe.length > 0 && (
              <button
                onClick={handleDownloadBackup}
                className="hidden sm:flex items-center gap-1.5 px-5 py-2.5 bg-white border border-brand-border text-brand-charcoal font-semibold text-[10px] tracking-widest uppercase rounded hover:bg-brand-greige cursor-pointer transition-colors"
                title="Spreadsheet export. Does not include photos - use Backup for that."
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}

            {wardrobe.length > 0 && (
              <button
                onClick={handleDownloadFullBackup}
                className="hidden sm:flex items-center gap-1.5 px-5 py-2.5 bg-white border border-brand-border text-brand-charcoal font-semibold text-[10px] tracking-widest uppercase rounded hover:bg-brand-greige cursor-pointer transition-colors"
                title="Full backup including photos. This is the only way to move a wardrobe to another computer or browser."
              >
                <Download className="w-3.5 h-3.5" /> Backup
              </button>
            )}

            <label
              className="hidden sm:flex items-center gap-1.5 px-5 py-2.5 bg-white border border-brand-border text-brand-charcoal font-semibold text-[10px] tracking-widest uppercase rounded hover:bg-brand-greige cursor-pointer transition-colors"
              title="Restore a wardrobe from a backup file"
            >
              <Upload className="w-3.5 h-3.5" /> Restore
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleRestoreBackup(file);
                  e.target.value = "";
                }}
              />
            </label>

            <button
              onClick={handleShowDiagnostics}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 bg-white border border-brand-border text-brand-sage font-semibold text-[10px] tracking-widest uppercase rounded hover:bg-brand-greige cursor-pointer transition-colors"
              title="What is stored in this browser, and what failed to load"
            >
              <Stethoscope className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-charcoal text-white hover:bg-black font-semibold text-[10px] tracking-widest uppercase rounded cursor-pointer transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>
        </div>

        {/* Storage health. Loud, because the wardrobe is only stored here. */}
        {storageNotice && (
          <div
            className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 mb-2 rounded flex items-start gap-3 text-xs leading-relaxed ${
              storageNotice.tone === "error"
                ? "bg-red-50 border border-red-200 text-red-900"
                : "bg-amber-50 border border-amber-200 text-amber-900"
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p>{storageNotice.text}</p>
              <div className="flex flex-wrap gap-3 pt-1">
                <button onClick={handleShowDiagnostics} className="underline font-semibold cursor-pointer">
                  Show diagnostics
                </button>
                <label className="underline font-semibold cursor-pointer">
                  Restore from backup
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleRestoreBackup(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            <button onClick={() => setStorageNotice(null)} className="shrink-0 cursor-pointer" title="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Global tab layouts */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-8 -mb-px">
          {[
            { id: "closet", label: "Inventory", icon: Grid },
            { id: "planner", label: "Lookbook", icon: BookOpen },
            { id: "insights", label: "Analytics", icon: PieChart },
            { id: "dataset", label: "Dataset Hub", icon: FileSpreadsheet },
            { id: "dedupe", label: "Duplicate Sorter", icon: Link }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 text-[11px] font-semibold uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors shrink-0 cursor-pointer ${
                  isActive
                    ? "border-brand-charcoal text-brand-charcoal"
                    : "border-transparent text-brand-sage hover:text-brand-charcoal hover:border-brand-border"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Container Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === "closet" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Season Selection & Planning Hub */}
              <div className="bg-white border border-brand-border rounded-sm p-5.5 shadow-sm border-brand-border space-y-4">
                {/* Segmented Top Control (Actual vs Future) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border/60 pb-3">
                  <div className="flex bg-brand-greige/60 p-1.5 rounded-full border border-brand-border/40">
                    <button
                      onClick={() => {
                        setActiveSeasonTab("actual");
                        setActiveSeason("all_actual");
                      }}
                      className={`py-2 px-5 text-xs uppercase tracking-wider font-semibold rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeSeasonTab === "actual"
                          ? "bg-brand-olive text-white shadow-xs"
                          : "text-brand-sage hover:text-brand-charcoal"
                      }`}
                    >
                       Actual Closet Collections
                    </button>
                    <button
                      onClick={() => {
                        setActiveSeasonTab("future");
                        setActiveSeason("Dream AW");
                      }}
                      className={`py-2 px-5 text-xs uppercase tracking-wider font-semibold rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeSeasonTab === "future"
                          ? "bg-brand-olive text-white shadow-xs"
                          : "text-brand-sage hover:text-brand-charcoal"
                      }`}
                    >
                       Future Planning
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-brand-sage tracking-widest font-sans px-2.5">
                      {activeSeasonTab === "actual" ? " Viewing Owned Wardrobes" : " Planning & Wishlist Spec"}
                    </span>
                    {activeSeason !== "all_actual" && (
                      <button
                        onClick={handleSetDefaultSeason}
                        className="text-[9px] uppercase font-bold tracking-wider px-2 py-1 bg-[#FAF9F6] border border-brand-border/80 text-brand-sage hover:text-brand-charcoal hover:border-brand-sage rounded transition-colors cursor-pointer"
                        title="Set this capsule to be pre-selected in the planner"
                      >
                        Set Default
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-pills for Actual Wardrobes */}
                {activeSeasonTab === "actual" && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {[
                      { id: "all_actual", label: "All Actual Pieces" },
                      { id: "Summer 25-26", label: "Summer 25-26" },
                      { id: "Autumn 26", label: "Autumn 26" },
                      { id: "Winter 26", label: "Winter 26" },
                      { id: "Handbag Inventory", label: "Handbag Inventory" }
                    ].map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => setActiveSeason(sub.id)}
                        className={`px-4.5 py-2.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                          activeSeason === sub.id
                            ? "bg-brand-olive text-white shadow-sm"
                            : "bg-[#FAF9F6] border border-brand-border/70 text-brand-sage hover:text-brand-charcoal hover:border-brand-sage"
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Sub-pills for Future Wardrobes */}
                {activeSeasonTab === "future" && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {[
                      { id: "Dream AW", label: "Dream AW Future Capsule" }
                    ].map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => setActiveSeason(sub.id)}
                        className={`px-4.5 py-2.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                          activeSeason === sub.id
                            ? "bg-brand-olive text-white shadow-sm"
                            : "bg-[#FAF9F6] border border-brand-border/70 text-brand-sage hover:text-brand-charcoal hover:border-brand-sage"
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Collapsible Style Summary Guide with Free Text Descriptions */}
              {(() => {
                const configId = activeSeasonTab === "future" ? "Dream AW" : activeSeason;
                const activeSeasonConfig = SEASONS_CONFIG.find(sc => sc.id === configId);
                if (!activeSeasonConfig) return null;

                return (
                  <div className="bg-brand-greige/25 border border-brand-border rounded-sm p-6 space-y-4 shadow-3xs">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-white border border-brand-border/60 rounded-xl flex items-center justify-center text-lg shadow-3xs">
                          {activeSeasonConfig.id === "Summer 25-26" && ""}
                          {activeSeasonConfig.id === "Autumn 26" && ""}
                          {activeSeasonConfig.id === "Winter 26" && ""}
                          {activeSeasonConfig.id === "Handbag Inventory" && ""}
                          {activeSeasonConfig.id === "Dream AW" && ""}
                        </div>
                        <div>
                          <h3 className="font-serif italic font-medium text-brand-charcoal text-base">
                            {activeSeasonConfig.id === "Handbag Inventory" ? "Handbag Setup & Ratings Guide" : activeSeasonConfig.summaryTitle}
                          </h3>
                          <p className="text-brand-sage text-[10px] uppercase tracking-wider font-sans font-bold">
                            {activeSeasonTab === "future" ? " future Roadmap & planning rules" : " capsule functional guideline"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsStyleSummaryExpanded(!isStyleSummaryExpanded)}
                        className="px-4 py-2 bg-white hover:bg-brand-greige/50 border border-brand-border/60 rounded-full text-[10px] uppercase tracking-widest font-semibold text-brand-charcoal transition-all cursor-pointer shadow-3xs"
                      >
                        {isStyleSummaryExpanded ? "Hide Description ▲" : "Reveal Look Principles ▼"}
                      </button>
                    </div>

                    {isStyleSummaryExpanded && (
                      <div className="pt-2.5 border-t border-brand-border/60 space-y-4.5 animate-fade-in">
                        <div className="text-brand-charcoal/90 text-xs italic leading-relaxed bg-white p-4 rounded-xl border border-brand-border/40 select-all relative">
                          {isGeneratingDesc && !dynamicDescriptions[activeSeason === "all_actual" ? "All Closets" : activeSeason] ? (
                            <div className="flex items-center gap-2 text-brand-sage animate-pulse">
                              <Sparkles className="w-3.5 h-3.5" /> Generatively summarizing your items...
                            </div>
                          ) : (
                            <p>{dynamicDescriptions[activeSeason === "all_actual" ? "All Closets" : activeSeason] || activeSeasonConfig.description}</p>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
                          {activeSeasonConfig.principles.map((pr, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-xl border border-brand-border/45 space-y-1.5 hover:shadow-2xs transition-shadow">
                              <span className="text-[10px] uppercase font-bold text-brand-olive tracking-wider flex items-center gap-1.5">
                                <span className="font-mono text-brand-sage bg-brand-greige/50 px-1.5 py-0.5 rounded-sm">0{idx + 1}</span> {pr.title}
                              </span>
                              <p className="text-brand-sage text-[11px] leading-relaxed select-all">
                                {pr.desc}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Analysis Engine Dashboard */}
              <div className="bg-white border border-brand-border/80 rounded-sm p-6 shadow-sm border-brand-border space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4 border-b border-brand-border/40 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-charcoal text-white rounded-lg flex items-center justify-center shadow-sm">
                      <SlidersHorizontal className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-serif font-semibold text-brand-charcoal text-lg tracking-tight">
                        Analysis Engine
                      </h3>
                      <p className="text-brand-sage text-[9px] uppercase tracking-widest font-mono font-bold mt-1">
                        System Diagnostics & Processing
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-brand-sage bg-brand-greige/40 px-3 py-1.5 rounded-full font-mono">
                    Active: {activeSeason === "all_actual" ? "All Actual Collections" : activeSeason}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <button
                    onClick={handleEnrichCapsule}
                    disabled={isSummarizing}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 bg-[#FAF9F6] border border-brand-border/80 hover:bg-brand-greige/40 rounded-xl text-xs font-semibold text-brand-charcoal transition-all cursor-pointer shadow-3xs"
                  >
                    {isSummarizing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Generating Summary...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-brand-olive" />
                         Style Summary & Notes
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleAnalyzeGaps}
                    disabled={isAnalyzingGaps}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 bg-[#FAF9F6] border border-brand-border/80 hover:bg-brand-greige/40 rounded-xl text-xs font-semibold text-brand-charcoal transition-all cursor-pointer shadow-3xs"
                  >
                    {isAnalyzingGaps ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Scanning Wardrobe...
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5 text-[#A6705D]" />
                         Scan Wardrobe Gaps
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleCondenseCategories}
                    disabled={isCondensing}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 bg-[#FAF9F6] border border-brand-border/80 hover:bg-brand-greige/40 rounded-xl text-xs font-semibold text-brand-charcoal transition-all cursor-pointer shadow-3xs"
                  >
                    {isCondensing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-brand-sage" />
                         Condense Excel Categories
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setIsAmendingOpen(!isAmendingOpen);
                      setCondenseSuccess(null);
                    }}
                    className={`flex items-center justify-center gap-2 px-5 py-3.5 border rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-3xs ${
                      isAmendingOpen
                        ? "bg-[#E8F0E8] border-brand-olive text-brand-olive"
                        : "bg-[#FAF9F6] border-brand-border/80 hover:bg-brand-greige/40 text-brand-charcoal"
                    }`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    ✏️ Manual Amendments Desk
                  </button>
                </div>

                {/* System Engine Style Summary & note appender output */}
                {capsuleDescription && (
                  <div className="bg-[#FAF9F6] border border-brand-border/60 p-5 rounded-2xl space-y-4 animate-fade-in">
                    <div className="space-y-1">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <h4 className="text-[10px] uppercase tracking-wider font-bold text-brand-olive mt-1">
                           Style Summary & Keyword Aesthetics
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1 border-b border-brand-border/40 pb-3.5">
                        {capsuleSummaryKeywords.map((kw, i) => (
                          <span key={i} className="px-3 py-1 bg-white border border-brand-border text-[11px] font-sans font-semibold text-stone-600 rounded-full shadow-3xs">
                            🌱 {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <p className="text-brand-charcoal text-xs italic leading-relaxed select-all">
                      "{capsuleDescription}"
                    </p>

                    {suggestedEnrichments.length > 0 && (
                      <div className="bg-white p-4.5 rounded-xl border border-brand-border/45 space-y-3.5">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                          <div>
                            <h5 className="text-[11px] font-bold text-stone-700 uppercase">Suggested Note Enrichments ({suggestedEnrichments.length})</h5>
                            <p className="text-[10px] text-brand-sage leading-tight">These keyword additions build beautifully on the existing notes from your spreadsheet.</p>
                          </div>
                          {!enrichmentApplied ? (
                            <button
                              onClick={handleApplyEnrichment}
                              className="px-4 py-1.5 bg-brand-olive hover:bg-[#484833] text-white text-[10px] uppercase font-bold tracking-wider rounded-full transition-all cursor-pointer shadow-3xs"
                            >
                              📝 Apply to All Note Fields
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-[#4A674A] bg-[#E8F0E8] px-3 py-1 rounded-full uppercase">
                              ✓ Enrichments Applied!
                            </span>
                          )}
                        </div>

                        {!enrichmentApplied && (
                          <div className="max-h-[140px] overflow-y-auto divide-y divide-brand-border/40 pr-1 text-xs">
                            {suggestedEnrichments.slice(0, 5).map((e, idx) => (
                              <div key={idx} className="py-2 flex items-center justify-between gap-4">
                                <span className="font-semibold text-brand-charcoal capitalize">{e.item}</span>
                                <span className="text-brand-sage font-mono bg-stone-50 px-2 py-0.5 border border-stone-200/50 rounded-sm text-[10px]">
                                  + "{e.suggestedNotesAppend}"
                                </span>
                              </div>
                            ))}
                            {suggestedEnrichments.length > 5 && (
                              <div className="text-right text-[9px] text-brand-sage pt-2">
                                ...and {suggestedEnrichments.length - 5} more items.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {enrichmentError && (
                  <p className="text-xs text-red-650 bg-red-50 p-3 rounded-lg border border-red-200/50">
                    ⚠️ {enrichmentError}
                  </p>
                )}

                {/* Wardrobe Gaps recommendations output */}
                {gapsAssessment && (
                  <div className="bg-[#FAF9F6] border border-brand-border/60 p-5 rounded-2xl space-y-4 animate-fade-in">
                    <div>
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <h4 className="text-[10px] uppercase tracking-wider font-bold text-brand-olive">
                          ⚖️ Wardrobe Balance & Gap Assessment
                        </h4>
                      </div>
                      <p className="text-brand-charcoal text-xs leading-relaxed italic mt-1 bg-white p-3.5 border border-brand-border/40 rounded-xl">
                        "{gapsAssessment}"
                      </p>
                    </div>

                    {gapsRecommendations.length > 0 && (
                      <div className="space-y-2.5">
                        <label className="text-[10px] uppercase font-bold text-stone-500 tracking-wider block">Recommended Additions to Buy list</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                          {gapsRecommendations.map((rec, i) => (
                            <div key={i} className="bg-white border border-brand-border/60 p-4 rounded-xl flex flex-col justify-between hover:shadow-2xs transition-shadow">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] bg-brand-greige border border-stone-200/50 px-2 py-0.5 rounded-full text-stone-600 font-bold uppercase tracking-wider">
                                    {rec.category}
                                  </span>
                                  <span className="w-2.5 h-2.5 rounded-full border border-stone-200" style={{ backgroundColor: rec.color === "Charcoal Grey" ? "#4b5563" : (rec.color === "Oatmeal Beige" ? "#f5f5f4" : "#1e293b") }} />
                                </div>
                                <h5 className="font-serif font-bold text-brand-charcoal text-xs">{rec.item} <span className="font-sans font-normal text-[11px] text-brand-sage">in {rec.color}</span></h5>
                                <p className="text-brand-sage text-[10.5px] leading-tight italic">{rec.reason}</p>
                              </div>
                              <button
                                onClick={() => handleAddRecommendItem(rec)}
                                className="w-full mt-3.5 py-2 bg-stone-900 text-stone-50 hover:bg-stone-800 text-[9px] uppercase tracking-widest font-bold rounded-lg transition-all cursor-pointer"
                              >
                                + Add to Wishlist
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {gapsError && (
                  <p className="text-xs text-red-650 bg-red-50 p-3 rounded-lg border border-red-200/50">
                    ⚠️ {gapsError}
                  </p>
                )}

                {/* Category Condenser layout confirm mappings */}
                {condenseMapping && (
                  <div className="bg-[#FAF9F6] border border-brand-border/60 p-5 rounded-2xl space-y-4 animate-fade-in">
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider font-bold text-brand-olive">
                         AI Spreadsheet Clean Map Output
                      </h4>
                      <p className="text-[10.5px] text-brand-sage mt-0.5">System Engine will group these non-standard labels into neat apparel folders:</p>
                    </div>

                    <div className="max-h-[160px] overflow-y-auto bg-white border border-brand-border p-3.5 rounded-xl divide-y divide-stone-100 pr-1">
                      {Object.entries(condenseMapping).map(([orig, standard]) => (
                        <div key={orig} className="py-2.5 flex items-center justify-between text-xs">
                          <span className="text-stone-500 line-through capitalize font-medium">{orig}</span>
                          <span className="text-[10px] font-mono font-bold bg-[#FAF9F6] border border-stone-200 px-1.5 py-0.5 rounded-sm">➔</span>
                          <span className="text-brand-olive font-bold uppercase tracking-wider">{standard}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setCondenseMapping(null)}
                        className="px-4 py-2 bg-white border border-brand-border rounded-lg text-xs text-brand-sage font-semibold hover:bg-brand-greige/30 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleApplyCondensation}
                        className="px-5 py-2 bg-brand-olive text-white rounded-lg text-xs font-semibold hover:bg-[#484833] cursor-pointer shadow-3xs"
                      >
                        Confirm AI Standardization
                      </button>
                    </div>
                  </div>
                )}

                {condenseError && (
                  <p className="text-xs text-red-650 bg-red-50 p-3 rounded-lg border border-red-200/50">
                    ⚠️ {condenseError}
                  </p>
                )}

                {condenseSuccess && (
                  <p className="text-xs text-[#4A674A] bg-[#E8F0E8] p-3.5 rounded-lg border border-brand-olive/20">
                     {condenseSuccess}
                  </p>
                )}

                {/* Manual Amendment Desk */}
                {isAmendingOpen && (
                  <div className="bg-[#FAF9F6] border border-brand-border/60 p-5 rounded-2xl space-y-4 animate-fade-in">
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider font-bold text-brand-olive flex items-center gap-1.5">
                        ✏️ Wardrobe Category Amendment Desk
                      </h4>
                      <p className="text-[10.5px] text-brand-sage">Double check and amend any miscategorized groupings right here.</p>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto bg-white border border-brand-border rounded-xl divide-y divide-stone-100 pr-1">
                      {wardrobe
                        .filter(item => {
                          if (activeSeasonTab === "actual") {
                            return activeSeason === "all_actual" ? (item.season !== "Dream AW") : (item.season === activeSeason);
                          } else {
                            return item.season === "Dream AW";
                          }
                        })
                        .map((item, idx) => (
                          <div key={item.id} className="p-3 flex items-center justify-between gap-4 text-xs">
                            <div className="flex items-center gap-2.5 truncate">
                              <span className="font-mono text-xs text-brand-charcoal font-bold bg-brand-greige border border-stone-250/20 px-2 py-0.5 rounded-md">{(idx + 1).toString().padStart(2, '0')}</span>
                              <div className="truncate">
                                <p className="font-semibold text-brand-charcoal capitalize truncate leading-tight">{item.item}</p>
                                <p className="text-[9.5px] text-brand-sage font-medium uppercase font-sans tracking-wide leading-none mt-0.5">{item.brand || "Unbranded"}</p>
                              </div>
                            </div>

                            <select
                              value={item.aiSuggestedCategory || "Tops"}
                              onChange={(e) => {
                                const val = e.target.value;
                                setWardrobe(prev => prev.map(w => w.id === item.id ? { ...w, aiSuggestedCategory: val } : w));
                              }}
                              className="bg-stone-50 border border-brand-border text-xs px-2.5 py-1.5 rounded-lg outline-none text-brand-charcoal cursor-pointer focus:ring-1 focus:ring-brand-olive"
                            >
                              <option value="Tops">Tops</option>
                              <option value="Bottoms">Bottoms</option>
                              <option value="Outerwear">Outerwear</option>
                              <option value="Dresses">Dresses</option>
                              <option value="Shoes">Shoes</option>
                              <option value="Accessories">Accessories</option>
                            </select>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Filter Controls Bar in Greige box */}
              <div className="bg-brand-greige/45 border border-brand-border p-5 rounded-sm shadow-sm border-brand-border space-y-4">
                <div className="flex flex-col md:flex-row gap-3">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-brand-sage/80 absolute left-4 top-3.5" />
                    <input
                      type="text"
                      placeholder="Search brand, color, or item (pants, trench coat, COS blazer)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-brand-border text-brand-charcoal text-xs pl-11 pr-4 py-3 rounded-sm focus:ring-1 focus:ring-brand-olive focus:outline-none transition-all placeholder-brand-sage/80"
                    />
                  </div>

                  {/* Fast Filtering options Category */}
                  <div className="grid grid-cols-2 md:flex md:items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full">
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full bg-white border border-brand-border text-brand-charcoal text-xs px-4 py-3 rounded-sm focus:outline-none cursor-pointer appearance-none pr-8 focus:ring-1 focus:ring-brand-olive text-left"
                      >
                        <option value="all">All Apparel</option>
                        {Array.from(new Set(wardrobe.map(w => w.aiSuggestedCategory || "Tops"))).filter((cat): cat is string => !!cat).map(cat => (
                          <option key={cat} value={cat.toLowerCase()}>{cat}</option>
                        ))}
                      </select>
                      <SlidersHorizontal className="w-3.5 h-3.5 text-brand-sage/80 pointer-events-none absolute right-3.5 top-3.5" />
                    </div>

                    {/* Status filtering */}
                    <div className="relative w-full">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full bg-white border border-brand-border text-brand-charcoal text-xs px-4 py-3 rounded-sm focus:outline-none cursor-pointer appearance-none pr-8 focus:ring-1 focus:ring-brand-olive"
                      >
                        <option value="all">All Stats</option>
                        <option value="existing">In Closet</option>
                        <option value="buy">Wishlist</option>
                      </select>
                      <SlidersHorizontal className="w-3.5 h-3.5 text-brand-sage/80 pointer-events-none absolute right-3.5 top-3.5" />
                    </div>

                    {/* Brands */}
                    {uniqueBrands.length > 0 && (
                      <div className="relative w-full">
                        <select
                          value={brandFilter}
                          onChange={(e) => setBrandFilter(e.target.value)}
                          className="w-full bg-white border border-brand-border text-brand-charcoal text-xs px-4 py-3 rounded-sm focus:outline-none cursor-pointer appearance-none pr-8 focus:ring-1 focus:ring-brand-olive"
                        >
                          <option value="all">All Brands</option>
                          {uniqueBrands.map(br => (
                            <option key={br} value={br}>{br}</option>
                          ))}
                        </select>
                        <SlidersHorizontal className="w-3.5 h-3.5 text-brand-sage/80 pointer-events-none absolute right-3.5 top-3.5" />
                      </div>
                    )}

                    {/* Color Filter */}
                    {uniqueColors.length > 0 && (
                      <div className="relative w-full">
                        <select
                          value={colorFilter}
                          onChange={(e) => setColorFilter(e.target.value)}
                          className="w-full bg-white border border-brand-border text-brand-charcoal text-xs px-4 py-3 rounded-sm focus:outline-none cursor-pointer appearance-none pr-8 focus:ring-1 focus:ring-brand-olive"
                        >
                          <option value="all">All Colors</option>
                          {uniqueColors.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                        <SlidersHorizontal className="w-3.5 h-3.5 text-brand-sage/80 pointer-events-none absolute right-3.5 top-3.5" />
                      </div>
                    )}
                  </div>
                </div>

                {/* View Mode Switcher, Compactness Slider & Zoom Level Slider Row */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-brand-border/40">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase font-bold text-brand-sage tracking-wider">Layout View:</span>
                    <div className="flex bg-white/80 p-0.5 rounded-full border border-brand-border">
                      <button
                        onClick={() => setViewMode("card")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-semibold transition-all cursor-pointer ${
                          viewMode === "card"
                            ? "bg-brand-olive text-white shadow-xs"
                            : "text-brand-sage hover:text-brand-charcoal"
                        }`}
                      >
                        <Grid className="w-3 h-3" /> Cards
                      </button>
                      <button
                        onClick={() => setViewMode("list")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-semibold transition-all cursor-pointer ${
                          viewMode === "list"
                            ? "bg-brand-olive text-white shadow-xs"
                            : "text-brand-sage hover:text-brand-charcoal"
                        }`}
                      >
                        <Grid className="w-3 h-3" /> List
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-wrap">
                    {/* Compactness controls only make sense in list mode */}
                    {viewMode === "list" && (
                      <div className="flex items-center gap-2 min-w-[150px]">
                        <span className="text-[10px] uppercase font-bold text-brand-sage tracking-wider shrink-0">Compactness:</span>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={compactness}
                          onChange={(e) => setCompactness(Number(e.target.value))}
                          className="w-full accent-brand-olive cursor-pointer h-1 bg-brand-border rounded-lg appearance-none"
                        />
                        <span className="text-[10px] font-mono text-brand-charcoal">{compactness}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 min-w-[150px]">
                      <span className="text-[10px] uppercase font-bold text-brand-sage tracking-wider shrink-0">Scale Size:</span>
                      <input
                        type="range"
                        min="75"
                        max="150"
                        step="5"
                        value={zoomLevel}
                        onChange={(e) => setZoomLevel(Number(e.target.value))}
                        className="w-full accent-brand-olive cursor-pointer h-1 bg-brand-border rounded-lg appearance-none"
                      />
                      <span className="text-[10px] font-mono text-brand-charcoal">{zoomLevel}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid or List garments List */}
              {filteredItems.length === 0 ? (
                <div className="border border-stone-200 border-dashed rounded-2xl p-16 text-center bg-white">
                  <Grid className="w-10 h-10 text-stone-300 mx-auto mb-4" />
                  <p className="text-stone-700 text-sm font-semibold">No clothes match your selection criteria</p>
                  <p className="text-stone-400 text-xs mt-1">Try resetting filter tags, typing other queries, or importing your spreadsheet.</p>
                  
                  <div className="mt-5 flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setCategoryFilter("all");
                        setStatusFilter("all");
                        setBrandFilter("all");
                      }}
                      className="px-4 py-2 bg-stone-900 text-stone-50 text-xs tracking-wider uppercase font-semibold rounded-lg hover:bg-stone-800"
                    >
                      Reset Filters
                    </button>
                    {wardrobe.length === 0 && (
                      <button
                        onClick={() => setActiveTab("dataset")}
                        className="px-4 py-2 border border-stone-200 text-stone-700 text-xs tracking-wider uppercase font-semibold rounded-lg hover:bg-stone-100"
                      >
                        Import Spreadsheet
                      </button>
                    )}
                  </div>
                </div>
              ) : viewMode === "card" ? (
                <div 
                  className="grid gap-6 transition-all"
                  style={{
                    gridTemplateColumns: `repeat(auto-fill, minmax(${265 * (zoomLevel / 100)}px, 1fr))`
                  }}
                >
                  <AnimatePresence>
                    {filteredItems.map((item, idx) => (
                      <div 
                        key={item.id} 
                        style={{ fontSize: `${zoomLevel}%` }}
                        className="transition-all"
                      >
                        <WardrobeCard
                          item={item}
                          cardNumber={idx + 1}
                          onSelect={setSelectedItem}
                          onDelete={handleDeleteItem}
                          onToggleStatus={handleToggleStatus}
                        />
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="bg-white border border-brand-border rounded-sm overflow-hidden shadow-xs animate-fade-in overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-brand-greige/30 border-b border-brand-border/60 text-brand-sage uppercase text-[10px] font-bold tracking-wider select-none">
                        <th className="px-5 py-3">Photo</th>
                        <th className="px-5 py-3">Item Name</th>
                        <th className="px-5 py-3">Category</th>
                        <th className="px-5 py-3">Brand</th>
                        <th className="px-5 py-3">Color</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Season</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {filteredItems.map((item, idx) => {
                          const isExisting = item.status === "existing";
                          const paddingStyle = compactness === 1 ? "py-1" : 
                                               compactness === 2 ? "py-2" :
                                               compactness === 3 ? "py-3" :
                                               compactness === 4 ? "py-4.5" : "py-6";
                          
                          return (
                            <motion.tr
                              key={item.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              onClick={() => setSelectedItem(item)}
                              className="border-b border-brand-border/40 hover:bg-brand-greige/10 transition-colors cursor-pointer"
                              style={{ fontSize: `${zoomLevel}%` }}
                            >
                              {/* Photo / Silhouette */}
                              <td className={`px-5 ${paddingStyle}`}>
                                <div className="flex items-center gap-2.5">
                                  <span className="font-mono text-xs text-stone-600 font-bold w-5 shrink-0 select-none">
                                    {(idx + 1).toString().padStart(2, "0")}
                                  </span>
                                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-brand-border bg-[#F2EFE9]/30 flex items-center justify-center shrink-0 animate-fade-in">
                                    {item.imageUrl ? (
                                      <img src={item.imageUrl} alt={item.item} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <div className="w-5 h-5 flex items-center justify-center">
                                        <ApparelSilhouette item={item} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Item Name */}
                              <td className={`px-5 ${paddingStyle} font-serif font-semibold text-brand-charcoal text-sm`}>
                                <div className="flex flex-col">
                                  <span className="capitalize">{item.item}</span>
                                  {item.notes && (
                                    <span className="text-[10px] text-brand-sage/80 italic font-normal line-clamp-1">{item.notes}</span>
                                  )}
                                </div>
                              </td>

                              {/* Category */}
                              <td className={`px-5 ${paddingStyle} text-xs text-brand-charcoal/80 font-medium`}>
                                <span className="bg-brand-greige border border-brand-border/40 px-2.5 py-1 rounded-full text-[10px] font-semibold text-brand-sage uppercase">
                                  {item.aiSuggestedCategory || "Tops"}
                                </span>
                              </td>

                              {/* Brand */}
                              <td className={`px-5 ${paddingStyle} text-xs text-brand-sage font-semibold font-sans`}>
                                {item.brand || "—"}
                              </td>

                              {/* Color */}
                              <td className={`px-5 ${paddingStyle} text-xs text-brand-charcoal`}>
                                <div className="flex items-center gap-2">
                                  <span className="w-3.5 h-3.5 rounded-full border border-stone-200" style={{ backgroundColor: item.hex }} />
                                  <span className="capitalize">{item.color}</span>
                                </div>
                              </td>

                              {/* Status */}
                              <td className={`px-5 ${paddingStyle} text-xs`} onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleStatus(item.id);
                                  }}
                                  className={`px-3 py-1 rounded-sm text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                                    isExisting
                                      ? "bg-[#E8F0E8] text-[#4A674A] border-transparent"
                                      : "bg-[#F8EEE8] text-[#A6705D] border-transparent"
                                  }`}
                                >
                                  {isExisting ? "Existing" : "Wishlist"}
                                </button>
                              </td>

                              {/* Season */}
                              <td className={`px-5 ${paddingStyle} text-xs text-brand-olive font-semibold font-sans`}>
                                {item.season}
                              </td>

                              {/* Actions */}
                              <td className={`px-5 ${paddingStyle} text-right`} onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setSelectedItem(item)}
                                    className="p-1.5 text-brand-sage hover:text-brand-charcoal hover:bg-brand-greige/50 rounded-md transition-all cursor-pointer"
                                    title="View details"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="p-1.5 text-brand-sage hover:text-red-650 hover:bg-brand-greige/50 rounded-md transition-all cursor-pointer"
                                    title="Delete item"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>

                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "planner" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <OutfitBuilder
                wardrobe={wardrobe}
                savedOutfits={savedOutfits}
                onSaveOutfit={(o) => setSavedOutfits(prev => [o, ...prev])}
                onDeleteOutfit={(idx) => setSavedOutfits(prev => prev.filter((_, i) => i !== idx))}
                currentCapsule={activeSeason}
                onCapsuleChange={setActiveSeason}
              />
            </motion.div>
          )}

          {activeTab === "insights" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AnalyticsPanel wardrobe={wardrobe} />
            </motion.div>
          )}

          {activeTab === "dataset" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ExcelImporter
                onImportComplete={handleImportNewItems}
                onClearWardrobe={handleClearCloset}
                itemsCount={wardrobe.length}
              />
            </motion.div>
          )}

          {activeTab === "dedupe" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DuplicateSorter
                wardrobe={wardrobe}
                onUpdateWardrobe={(newWardrobe) => setWardrobe(newWardrobe)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* CURATED ITEM DETAILS DRAWER MODAL (AI Analysis & Custom editing portal) */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-end"
            id="item-details-drawer-overlay"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-white h-full w-full max-w-lg shadow-2xl p-6 flex flex-col justify-between overflow-y-auto space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-stone-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold font-mono text-stone-400 uppercase tracking-widest block">
                    Garment Profile Review
                  </span>
                  <h3 className="font-sans font-semibold text-stone-950 text-base flex items-center gap-2 mt-1">
                    {selectedItem.item}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-850"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Body view or edit mode toggle */}
              <div className="flex-1 space-y-6 flex flex-col justify-between">
                {!isDetailEditing ? (
                  <>
                    {/* Image section next to or above color details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                      {/* Left: Discovered image or category placeholder */}
                      <div className="relative aspect-square sm:aspect-auto sm:h-44 rounded-xl border border-brand-border overflow-hidden bg-brand-greige/20 flex items-center justify-center">
                        {imageLoading ? (
                          <div className="flex flex-col items-center justify-center gap-2 text-brand-sage">
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            <span className="text-[10px] font-medium font-sans uppercase tracking-wider">Finding Look...</span>
                          </div>
                        ) : selectedItem.imageUrl ? (
                          <img
                            src={selectedItem.imageUrl}
                            alt={selectedItem.item}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          // Default category-specific placeholder image fallback
                          <div className="w-full h-full relative flex flex-col items-center justify-center">
                            <img
                              src={getCategoryPlaceholder(selectedItem.aiSuggestedCategory || "Tops")}
                              alt="Placeholder"
                              className="w-full h-full object-cover opacity-60 mix-blend-multiply"
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 p-3 text-center">
                              <span className="text-[10px] font-bold text-brand-olive uppercase tracking-widest leading-none">Default View</span>
                              <p className="text-[9px] text-[#555] mt-1 leading-normal">Discovered styling fallback</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Dynamic "Re-trigger image lookup" icon button */}
                        <button
                          onClick={() => handleFetchItemImage(selectedItem)}
                          title="Search photo online"
                          className="absolute bottom-2 right-2 p-1.5 bg-white/95 border border-brand-border text-brand-sage hover:text-brand-charcoal hover:bg-white rounded-lg shadow-xs z-10 transition-all cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Right: Brand and color notes */}
                      <div className="flex flex-col justify-between gap-3">
                        <div className="bg-stone-50 border border-stone-100 p-3 rounded-xl flex-1 flex flex-col justify-center">
                          <span className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Manufacturer</span>
                          <p className="font-semibold text-stone-850 text-xs capitalize mt-0.5">{selectedItem.brand || "Classic"}</p>
                          
                          <span className="text-[9px] uppercase font-bold text-stone-400 tracking-wider mt-2 block">Ownership Status</span>
                          <p className="font-semibold text-stone-850 text-xs capitalize mt-0.5">
                            {selectedItem.status === "existing" ? "Closet Item (Owned)" : "Wishlist (To Buy)"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                          <div
                            className="w-8 h-8 rounded-lg border border-stone-250 shadow-2xs shrink-0"
                            style={{ backgroundColor: selectedItem.hex }}
                          />
                          <div>
                            <span className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Color Tone</span>
                            <p className="font-semibold text-stone-850 text-xs capitalize leading-none mt-0.5 truncate max-w-[120px]">{selectedItem.color}</p>
                            <p className="font-mono text-[9px] text-stone-400 mt-0.5">{selectedItem.hex}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Category Label */}
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-stone-400 tracking-wider block">Standardized Category</span>
                      <p className="bg-stone-100/80 text-stone-800 text-xs px-3 py-1.5 rounded-lg border border-stone-200/80 inline-block capitalize font-medium">
                        {selectedItem.aiSuggestedCategory || "Tops"}
                      </p>
                    </div>

                    {/* Description Paragraph */}
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-stone-400 tracking-wider block">Textile Description</span>
                      <p className="text-stone-700 text-xs leading-relaxed italic">
                        "{selectedItem.description || "No description provided."}"
                      </p>
                    </div>

                    {/* Personal Notes */}
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-stone-400 tracking-wider block">Personal Style & Fit Notes</span>
                      <p className="text-stone-600 text-xs leading-relaxed bg-amber-50/50 p-3 rounded-lg border border-amber-100/50">
                        {selectedItem.notes || "No detailed sizing or material fit feedback yet."}
                      </p>
                    </div>

                    {/* Curated System Engine AI Styling Insight block */}
                    <div className="border border-stone-200/80 rounded-xl p-4.5 bg-stone-50/40 relative space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-bold text-stone-400 tracking-widest font-mono flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-stone-500 animate-pulse" /> System Engine Look Director Advice
                        </span>

                        <button
                          onClick={() => handleAnalyzeItem(selectedItem)}
                          disabled={aiLoading}
                          className="px-2.5 py-1 text-[9px] font-bold text-stone-900 bg-white border border-stone-350 hover:bg-stone-55 disabled:bg-stone-150 uppercase tracking-wider rounded-md flex items-center gap-1 transition-colors shadow-2xs"
                        >
                          {aiLoading ? (
                            <>
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                              Enrich item Advice
                            </>
                          )}
                        </button>
                      </div>

                      <div className="space-y-2.5 pt-1">
                        <p className="text-stone-750 text-xs leading-relaxed">
                          {selectedItem.aiStylingAdvice || "No design review compiled yet. Tap 'Enrich item Advice' to generate styling notes and precise hexadecimal coordinates!"}
                        </p>

                        {selectedItem.aiStyleTags && selectedItem.aiStyleTags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {selectedItem.aiStyleTags.map((tg, idx) => (
                              <span
                                key={idx}
                                className="text-[8.5px] uppercase font-semibold bg-stone-900 text-stone-50 px-2 py-0.5 rounded-md flex items-center gap-0.5"
                              >
                                <Tag className="w-2 h-2" />
                                {tg}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  // Inline editor form
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Clothes Item Name</label>
                      <input
                        type="text"
                        value={selectedItem.item}
                        onChange={(e) => setSelectedItem({ ...selectedItem, item: e.target.value })}
                        className="w-full bg-white border border-stone-200 text-stone-800 text-xs px-3.5 py-2 rounded-lg"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Manufacturer / Brand</label>
                        <input
                          type="text"
                          value={selectedItem.brand}
                          onChange={(e) => setSelectedItem({ ...selectedItem, brand: e.target.value })}
                          className="w-full bg-white border border-stone-200 text-stone-800 text-xs px-3.5 py-2 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Garment Category</label>
                        <select
                          value={selectedItem.aiSuggestedCategory || "Tops"}
                          onChange={(e) => setSelectedItem({ ...selectedItem, aiSuggestedCategory: e.target.value })}
                          className="w-full bg-white border border-stone-200 text-stone-800 text-xs px-3 py-2 rounded-lg focus:outline-none"
                        >
                          <option value="Tops">Tops</option>
                          <option value="Bottoms">Bottoms</option>
                          <option value="Outerwear">Outerwear</option>
                          <option value="Dresses">Dresses</option>
                          <option value="Shoes">Shoes</option>
                          <option value="Accessories">Accessories</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Color name</label>
                        <input
                          type="text"
                          value={selectedItem.color}
                          onChange={(e) => setSelectedItem({ ...selectedItem, color: e.target.value, hex: guessHexColor(e.target.value) })}
                          className="w-full bg-white border border-stone-200 text-stone-800 text-xs px-3.5 py-2 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Hex color swatch</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={selectedItem.hex}
                            onChange={(e) => setSelectedItem({ ...selectedItem, hex: e.target.value })}
                            className="w-10 h-8 border border-stone-200 cursor-pointer p-0 rounded-lg shrink-0"
                          />
                          <input
                            type="text"
                            value={selectedItem.hex}
                            onChange={(e) => setSelectedItem({ ...selectedItem, hex: e.target.value })}
                            className="bg-white border border-stone-200 text-stone-800 text-xs px-2.5 py-2 rounded-lg flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Photo / Image URL manager section */}
                    <div className="space-y-1.5 p-3.5 bg-stone-50 rounded-xl border border-stone-200">
                      <span className="text-[9px] uppercase font-bold text-stone-500 tracking-wider flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5 text-stone-500" /> Garment Photo / Visual
                      </span>

                      {selectedItem.imageUrl ? (
                        <div className="flex items-center gap-3 bg-white p-2 border border-stone-150 rounded-lg">
                          <img
                            src={selectedItem.imageUrl}
                            alt="Preview"
                            className="w-12 h-12 object-cover rounded-md border border-stone-100"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-mono text-stone-400 truncate">{selectedItem.imageUrl}</p>
                            <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">Custom Image Loaded</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedItem({ ...selectedItem, imageUrl: "" })}
                            className="p-1 px-1.5 border border-red-250 hover:bg-red-50 text-red-500 text-[9px] uppercase tracking-wider font-bold rounded-md cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="text-[10px] text-stone-400 italic">
                          No custom photo provided. (Uses automatic web styling representative image)
                        </div>
                      )}

                      <div className="space-y-2 mt-2 pt-1 border-t border-stone-150">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* File Upload Selector */}
                          <label className="cursor-pointer flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-stone-50 border border-stone-250 text-stone-700 text-[10px] tracking-wider font-bold uppercase rounded-lg transition-all shadow-3xs">
                            <Upload className="w-3.5 h-3.5" />
                            Upload Device Photo
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleLocalImageUpload(e, "edit")}
                            />
                          </label>
                          <span className="text-[10px] text-stone-400">or</span>
                        </div>

                        {/* Link / URL input with scrape capabilities */}
                        <div className="flex gap-1.5">
                          <div className="relative flex-1">
                            <Link className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-stone-400" />
                            <input
                              type="text"
                              placeholder="Paste Direct Image URL or Store Webpage Link..."
                              value={scrapeUrlInput}
                              onChange={(e) => {
                                setScrapeUrlInput(e.target.value);
                                const val = e.target.value.trim();
                                if (val.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) || val.startsWith("data:")) {
                                  setSelectedItem(prev => prev ? ({ ...prev, imageUrl: val }) : prev);
                                  setScrapeUrlInput("");
                                }
                              }}
                              className="w-full bg-white border border-stone-200 text-stone-800 text-xs pl-8 pr-3 py-1.5 rounded-lg focus:outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={isScraping || !scrapeUrlInput.trim()}
                            onClick={() => handleScrapeImage(scrapeUrlInput, "edit")}
                            className="px-3 bg-stone-900 text-stone-50 hover:bg-stone-800 rounded-lg text-[9px] font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                          >
                            {isScraping ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Scraping...
                              </>
                            ) : (
                              <>
                                <Globe className="w-3.5 h-3.5" />
                                Grab Image
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {imageError && (
                        <p className="text-[10px] text-red-500 font-medium">{imageError}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Textile Description</label>
                      <input
                        type="text"
                        value={selectedItem.description}
                        onChange={(e) => setSelectedItem({ ...selectedItem, description: e.target.value })}
                        className="w-full bg-white border border-stone-200 text-stone-800 text-xs px-3.5 py-2 rounded-lg"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Personal Notes & Fit</label>
                      <textarea
                        value={selectedItem.notes}
                        onChange={(e) => setSelectedItem({ ...selectedItem, notes: e.target.value })}
                        rows={3}
                        className="w-full bg-white border border-stone-200 text-stone-800 text-xs px-3.5 py-2 rounded-lg resize-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Garment Season / Capsule</label>
                      <select
                        value={selectedItem.season || "Summer 25-26"}
                        onChange={(e) => setSelectedItem({ ...selectedItem, season: e.target.value })}
                        className="w-full bg-white border border-stone-200 text-stone-800 text-xs px-3.5 py-2 rounded-lg"
                      >
                        <option value="Summer 25-26">Summer capsule 2025 - 26</option>
                        <option value="Autumn 26">Autumn 26</option>
                        <option value="Winter 26">Winter capsule 2026</option>
                        <option value="Handbag Inventory">Handbag Inventory</option>
                        <option value="Dream AW">Dream AW (Future Planning)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-stone-700">Existing Closet status:</label>
                      <button
                        type="button"
                        onClick={() => setSelectedItem({ ...selectedItem, status: selectedItem.status === "existing" ? "buy" : "existing" })}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${
                          selectedItem.status === "existing"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                            : "bg-amber-50 text-amber-800 border-amber-100"
                        }`}
                      >
                        {selectedItem.status === "existing" ? "In Closet" : "Wishlist (Buy)"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Duplicate / Clone section */}
              {!isDetailEditing && (
                <div className="border-t border-stone-100 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-[10px] font-bold uppercase text-stone-500">Duplicate to:</label>
                    <select
                      value={cloneSeason}
                      onChange={e => setCloneSeason(e.target.value)}
                      className="text-xs bg-stone-50 border border-stone-200 rounded-md py-1 px-2 text-stone-700 outline-none"
                    >
                      <option value="Summer 25-26">Summer capsule 2025 - 26</option>
                      <option value="Autumn 26">Autumn 26</option>
                      <option value="Winter 26">Winter capsule 2026</option>
                      <option value="Handbag Inventory">Handbag Inventory</option>
                      <option value="Dream AW">Dream AW (Future Planning)</option>
                    </select>
                    <button
                      onClick={handleCloneToCapsule}
                      className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-semibold px-3 py-1 rounded-md transition-colors"
                    >
                      Add/Link
                    </button>
                  </div>
                </div>
              )}

              {/* Drawer footer actions */}
              <div className="flex items-center gap-2 border-t border-stone-100 pt-4">
                {!isDetailEditing ? (
                  <>
                    <button
                      onClick={() => setIsDetailEditing(true)}
                      className="flex-1 py-2.5 bg-stone-900 text-stone-50 font-bold text-xs uppercase tracking-wider rounded-xl transition-all hover:bg-stone-800"
                    >
                      Edit Garment Details
                    </button>
                    <button
                      onClick={() => {
                        handleDeleteItem(selectedItem.id);
                        setSelectedItem(null);
                      }}
                      className="px-4 py-2.5 border border-red-200 text-red-650 hover:bg-red-50 text-xs font-semibold rounded-xl"
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleSaveEditedDetails(selectedItem)}
                      className="flex-1 py-2.5 bg-emerald-650 hover:bg-emerald-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all bg-stone-900 text-stone-50"
                    >
                      Save changes
                    </button>
                    <button
                      onClick={() => setIsDetailEditing(false)}
                      className="px-4 py-2.5 border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QUICK ADD GARMENT DIALOG DRAWER */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 overflow-y-auto max-h-[85vh] space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-stone-100 pb-3">
                <div>
                  <h3 className="font-sans font-semibold text-stone-950 text-base">
                    Introduce Clothes Piece
                  </h3>
                  <p className="text-stone-400 text-[11px] mt-0.5">
                    Log manually or autofill styled apparel matching specific wish vibes using System Engine.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-1 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-850"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* System Engine smart search autofill box */}
              <div className="bg-stone-50 border border-stone-100 p-4 rounded-xl space-y-3">
                <span className="text-[9px] uppercase font-bold text-stone-400 tracking-widest font-mono flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-stone-500" /> AI Style Ideas Autofiller
                </span>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiAutofillQuery}
                    onChange={(e) => setAiAutofillQuery(e.target.value)}
                    placeholder="e.g. Camel trench burberry or cos linen white pants"
                    className="flex-grow bg-white border border-stone-200 text-stone-800 text-xs px-3 py-2 rounded-lg focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAiSearchAutofill}
                    disabled={aiLoading || !aiAutofillQuery.trim()}
                    className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-200 text-stone-50 text-[10px] font-bold tracking-wider uppercase rounded-lg shrink-0 flex items-center gap-1"
                  >
                    {aiLoading ? <RefreshCw className="w-3 h-3 animate-spin"/> : "Autofill"}
                  </button>
                </div>
              </div>

              {/* Manual input form */}
              {formError && (
                <div className="bg-[#FAF9F6] border-l-4 border-[#8A5229] p-3 rounded-r-xl text-[#8A5229] text-xs font-mono flex items-center gap-2 shadow-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#8A5229]" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="bg-[#E8F0E8] border-l-4 border-[#4A674A] p-3 rounded-r-xl text-[#4A674A] text-xs font-sans font-semibold flex items-center gap-2.5 shadow-xs">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4A674A] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4A674A]"></span>
                  </span>
                  <span>{formSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAddIndividualItem} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Garment Item Name*</label>
                  <input
                    type="text"
                    value={newItem.item}
                    onChange={(e) => setNewItem({ ...newItem, item: e.target.value })}
                    required
                    placeholder="e.g. Cashmere Sweater, Silk Blouse, Wool Trousers"
                    className="w-full bg-white border border-stone-200 text-stone-800 text-xs px-3.5 py-2 rounded-lg focus:ring-1 focus:ring-stone-400 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Manufacturer / Brand</label>
                    <input
                      type="text"
                      value={newItem.brand}
                      onChange={(e) => setNewItem({ ...newItem, brand: e.target.value })}
                      placeholder="e.g. COS, Burberry, Everlane"
                      className="w-full bg-white border border-stone-200 text-stone-800 text-xs px-3.5 py-2 rounded-lg focus:ring-1 focus:ring-stone-400 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Apparel Category</label>
                    <select
                      value={newItem.aiSuggestedCategory}
                      onChange={(e) => setNewItem({ ...newItem, aiSuggestedCategory: e.target.value })}
                      className="w-full bg-white border border-stone-200 text-stone-850 text-xs px-3 py-2 rounded-lg focus:outline-none"
                    >
                      <option value="Tops">Tops</option>
                      <option value="Bottoms">Bottoms</option>
                      <option value="Outerwear">Outerwear</option>
                      <option value="Dresses">Dresses</option>
                      <option value="Shoes">Shoes</option>
                      <option value="Accessories">Accessories</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Color Name*</label>
                    <input
                      type="text"
                      value={newItem.color}
                      onChange={(e) => setNewItem({ ...newItem, color: e.target.value })}
                      required
                      placeholder="e.g. Navy Blue, Beige, Olive Green"
                      className="w-full bg-white border border-stone-200 text-stone-850 text-xs px-3.5 py-2 rounded-lg focus:ring-1 focus:ring-stone-400 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Ownership Status</label>
                    <div className="grid grid-cols-2 gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                      <button
                        type="button"
                        onClick={() => setNewItem({ ...newItem, status: "existing" })}
                        className={`text-[10px] font-bold py-1.5 rounded-md uppercase tracking-wider transition-all ${
                          newItem.status === "existing" ? "bg-white text-stone-850 shadow-2xs" : "text-stone-400"
                        }`}
                      >
                        In Closet
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewItem({ ...newItem, status: "buy" })}
                        className={`text-[10px] font-bold py-1.5 rounded-md uppercase tracking-wider transition-all ${
                          newItem.status === "buy" ? "bg-white text-stone-855 shadow-2xs" : "text-stone-400"
                        }`}
                      >
                        Buy Wishlist
                      </button>
                    </div>
                  </div>
                </div>

                {/* Photo / Image URL manager section */}
                <div className="space-y-1.5 p-3.5 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="text-[9px] uppercase font-bold text-stone-500 tracking-wider flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-stone-500" /> Garment Photo / Visual
                  </span>

                  {newItem.imageUrl ? (
                    <div className="flex items-center gap-3 bg-white p-2 border border-stone-150 rounded-lg">
                      <img
                        src={newItem.imageUrl}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-md border border-stone-100"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-mono text-stone-400 truncate">{newItem.imageUrl}</p>
                        <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">Custom Image Loaded</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewItem({ ...newItem, imageUrl: "" })}
                        className="p-1 px-1.5 border border-red-250 hover:bg-red-50 text-red-500 text-[9px] uppercase tracking-wider font-bold rounded-md cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="text-[10px] text-stone-400 italic">
                      No custom photo provided. (Will find web styling representative image if left empty)
                    </div>
                  )}

                  <div className="space-y-2 mt-2 pt-1 border-t border-stone-150">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* File Upload Selector */}
                      <label className="cursor-pointer flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-stone-50 border border-stone-250 text-stone-700 text-[10px] tracking-wider font-bold uppercase rounded-lg transition-all shadow-3xs">
                        <Upload className="w-3.5 h-3.5" />
                        Upload Device Photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleLocalImageUpload(e, "new")}
                        />
                      </label>
                      <span className="text-[10px] text-stone-400">or</span>
                    </div>

                    {/* Link / URL input with scrape capabilities */}
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <Link className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-stone-400" />
                        <input
                          type="text"
                          placeholder="Paste Direct Image URL or Store Webpage Link..."
                          value={scrapeUrlInput}
                          onChange={(e) => {
                            setScrapeUrlInput(e.target.value);
                            const val = e.target.value.trim();
                            if (val.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) || val.startsWith("data:")) {
                              setNewItem(prev => ({ ...prev, imageUrl: val }));
                              setScrapeUrlInput("");
                            }
                          }}
                          className="w-full bg-white border border-stone-200 text-stone-800 text-xs pl-8 pr-3 py-1.5 rounded-lg focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isScraping || !scrapeUrlInput.trim()}
                        onClick={() => handleScrapeImage(scrapeUrlInput, "new")}
                        className="px-3 bg-stone-900 text-stone-50 hover:bg-stone-800 rounded-lg text-[9px] font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                      >
                        {isScraping ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Scraping...
                          </>
                        ) : (
                          <>
                            <Globe className="w-3.5 h-3.5" />
                            Grab Image
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {imageError && (
                    <p className="text-[10px] text-red-500 font-medium">{imageError}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Textile Description</label>
                  <input
                    type="text"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder="e.g. Lightweight fine weave knit, ribbed hem."
                    className="w-full bg-white border border-stone-200 text-stone-800 text-xs px-3.5 py-2 rounded-lg focus:ring-1 focus:ring-stone-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Personal fit / wear notes</label>
                  <textarea
                    value={newItem.notes}
                    onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                    placeholder="Sizing recommendations, favorite styling hooks, fits true..."
                    rows={2}
                    className="w-full bg-white border border-stone-200 text-stone-800 text-xs px-3.5 py-2 rounded-lg focus:ring-1 focus:ring-stone-400 focus:outline-none resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Target Season / Capsule Tab</label>
                  <select
                    value={newItem.season}
                    onChange={(e) => setNewItem({ ...newItem, season: e.target.value })}
                    className="w-full bg-white border border-stone-200 text-stone-850 text-xs px-3.5 py-2 rounded-lg focus:ring-1 focus:ring-stone-400 focus:outline-none"
                  >
                    <option value="Summer 25-26">Summer capsule 2025 - 26</option>
                    <option value="Autumn 26">Autumn 26</option>
                    <option value="Winter 26">Winter capsule 2026</option>
                    <option value="Handbag Inventory">Handbag Inventory</option>
                    <option value="Dream AW">Dream AW (Future Planning)</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-stone-900 border border-stone-900 text-stone-50 hover:bg-stone-800 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all"
                  >
                    Add to Studio Closet
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-3 border border-stone-250 text-stone-700 hover:bg-stone-50 text-xs font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Storage diagnostics: a plain-text report that can be copied and sent. */}
      <AnimatePresence>
        {showDiagnostics && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDiagnostics(false)}
          >
            <motion.div
              initial={{ scale: 0.97, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97, y: 10 }}
              className="bg-white rounded-sm border border-brand-border shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
                <div>
                  <h3 className="font-serif font-semibold text-brand-charcoal text-lg">Storage diagnostics</h3>
                  <p className="text-brand-sage text-[11px] mt-0.5">
                    What this browser is holding, and anything that failed to load. Copy this if you need to report a problem.
                  </p>
                </div>
                <button onClick={() => setShowDiagnostics(false)} className="cursor-pointer text-brand-sage hover:text-brand-charcoal">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <pre className="flex-1 overflow-auto px-6 py-4 text-[11px] font-mono leading-relaxed text-brand-charcoal whitespace-pre-wrap select-text">
                {diagnosticsText}
              </pre>

              <div className="flex justify-end gap-2 px-6 py-4 border-t border-brand-border">
                <button
                  onClick={() => navigator.clipboard?.writeText(diagnosticsText)}
                  className="px-4 py-2 bg-white border border-brand-border text-brand-charcoal font-semibold text-[10px] tracking-widest uppercase rounded hover:bg-brand-greige cursor-pointer"
                >
                  Copy report
                </button>
                <button
                  onClick={handleDownloadFullBackup}
                  className="px-4 py-2 bg-brand-charcoal text-white font-semibold text-[10px] tracking-widest uppercase rounded hover:bg-black cursor-pointer"
                >
                  Download backup
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Elegant Styled Footer */}
      <footer className="border-t border-stone-200 bg-white py-10 mt-12 text-center text-xs text-stone-400 space-y-1 font-mono">
        <p>© {new Date().getFullYear()} Capsule Wardrobe Studio • Designed for local custom closets.</p>
        <p>Outfits are chosen by a local styling engine. No AI, no API keys.</p>
      </footer>
    </div>
  );
}

