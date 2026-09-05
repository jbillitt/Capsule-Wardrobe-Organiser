import React, { useRef, useState } from "react";
import { FolderUp, UploadCloud, ClipboardCopy, Sparkles, Check, Info } from "lucide-react";
import { parseSpreadsheetText, initialCuratedWardrobe } from "../data";
import { WardrobeItem } from "../types";
import { nameToHex as guessHexColor } from "../engine/colour";

interface ExcelImporterProps {
  onImportComplete: (items: WardrobeItem[]) => void;
  onClearWardrobe: () => void;
  itemsCount: number;
}

export default function ExcelImporter({ onImportComplete, onClearWardrobe, itemsCount }: ExcelImporterProps) {
  const [pasteData, setPasteData] = useState("");
  const [targetSeason, setTargetSeason] = useState<string>("auto");
  const [fileError, setFileError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Parse strings and push items to parent wardrobe state
  const handleProcessText = (text: string) => {
    try {
      setFileError(null);
      const parsed = parseSpreadsheetText(text, targetSeason === "auto" ? undefined : targetSeason);
      if (parsed.length === 0) {
        setFileError("No valid rows discovered. In 'Auto-detect' we check standard headers, or you can force-select the specific season schema below.");
        return;
      }

      // Convert items with custom IDs and initial mock hex colors we can analyze details later
      const fullItems: WardrobeItem[] = parsed.map((item, idx) => ({
        ...item,
        id: `imported-${Date.now()}-${idx}`,
        // Colour is resolved by the engine lexicon; traits are derived on demand.
        hex: guessHexColor(item.color || "grey"),
        season: item.season || (targetSeason !== "auto" ? targetSeason : "Summer 25-26"),
        aiStyleTags: ["Imported"],
        aiStylingAdvice: "Not analysed yet. Open the item to derive its styling traits."
      }));

      onImportComplete(fullItems);
      setSuccessCount(fullItems.length);
      setPasteData("");
      setTimeout(() => setSuccessCount(null), 4000);
    } catch (err: any) {
      setFileError(`Parsing failed: ${err.message}`);
    }
  };


  // Drag & drop file reader handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCsvFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleCsvFile(e.target.files[0]);
    }
  };

  const handleCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleProcessText(text);
    };
    reader.onerror = () => {
      setFileError("Error reading the spreadsheet file.");
    };
    reader.readAsText(file);
  };

  // Load standard Parisian wardrobe to easily trial applet
  const handleLoadTemplate = () => {
    onImportComplete(initialCuratedWardrobe);
    setSuccessCount(initialCuratedWardrobe.length);
    setTimeout(() => setSuccessCount(null), 4000);
  };

  return (
    <div className="space-y-6" id="spreadsheet-importer-pane">
      <div className="border-b border-brand-border pb-5">
        <h2 className="font-serif font-medium text-brand-charcoal text-2xl tracking-tight">
          Spreadsheet Data Hub
        </h2>
        <p className="text-brand-sage text-sm mt-1">
          Import clothes from your Excel sheets (.xlsx exported as .csv) or copy-paste columns directly.
        </p>
      </div>

      {/* Target Season and Column Layout Selector */}
      <div className="bg-brand-olive/5 border border-brand-olive/15 rounded-sm p-5 text-brand-charcoal space-y-3.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-olive font-sans">
              Choose Target Spreadsheet Layout
            </h4>
            <p className="text-brand-sage text-xs leading-normal mt-1 max-w-xl">
              We detect columns automatically. Or you can select a specific season schema override so we map custom columns (such as Handbag Ratings/Cons, Cost, or Source status E/S) with total precision.
            </p>
          </div>
          <div className="relative">
            <select
              value={targetSeason}
              onChange={(e) => setTargetSeason(e.target.value)}
              className="bg-white border border-brand-border text-brand-charcoal text-xs px-4 py-2.5 rounded-sm focus:outline-none cursor-pointer appearance-none pr-8 min-w-[210px] focus:ring-1 focus:ring-brand-olive font-medium shadow-3xs"
            >
              <option value="auto">Auto-Detect Season Tab</option>
              <option value="Summer 25-26">Summer capsule 2025 - 26</option>
              <option value="Autumn 26">Autumn 26</option>
              <option value="Winter 26">Winter capsule 2026</option>
              <option value="Handbag Inventory">Handbag Inventory</option>
              <option value="Dream AW">Dream capsule AW (Future)</option>
            </select>
            <FolderUp className="w-3.5 h-3.5 text-brand-sage absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Dynamic Column Schema indicators */}
        <div className="bg-white/80 p-3 rounded-xl border border-brand-border/60 flex flex-wrap items-center gap-2 text-[10px] text-brand-sage font-mono">
          <span className="font-bold text-brand-charcoal font-sans">Mapped Columns:</span>
          {targetSeason === "auto" && <span>[Automatic schema detection based on contents]</span>}
          {targetSeason === "Summer 25-26" && <span>Item type → Item, Colour/pattern → Color, Source → Status (E/S), Cost/Link/Size/Notes → Description & Notes</span>}
          {targetSeason === "Autumn 26" && <span>No, Item type → Item, Colour/pattern → Color, Brand → Brand, Notes → Notes & Status</span>}
          {targetSeason === "Winter 26" && <span>No, Item type → Item, Colour/pattern → Color, Brand → Brand, Notes, Link, Size → Notes & Status</span>}
          {targetSeason === "Handbag Inventory" && <span>Brand → Brand, Color → Color, Type → Item, Material → Description, Size/Pros/Cons/Rating → Notes & Quality Tags</span>}
          {targetSeason === "Dream AW" && <span>Item, Colour/description → Color, Brand → Brand, Notes, Existing or Buy → Status (E=existing, other=buy)</span>}
        </div>
      </div>

      {/* Visual Import Guides & Answers to User Queries */}
      <div className="bg-amber-50/20 border border-amber-600/10 rounded-sm p-5 text-brand-charcoal space-y-3.5 shadow-3xs">
        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 font-sans flex items-center gap-1.5">
          <Info className="w-4 h-4 text-amber-700 font-sans" /> Professional Import Guidelines
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <div className="space-y-1.5">
            <p className="font-semibold text-brand-charcoal text-[11px] sm:text-xs">
              ❓ Tab-by-Tab (One Season) vs All-at-Once?
            </p>
            <p className="text-brand-sage leading-relaxed text-[11px]">
              <strong>We highly recommend importing tab-by-tab!</strong> Different spreadsheet tabs have customized structures (e.g. Handbag Inventory has quality ratings and pros/cons; Summer has cost and sizes). Select the matching season schema above and drag/paste that specific tab for perfect results.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-brand-charcoal text-[11px] sm:text-xs">
              💡 Cleaned Statuses & Safe Descriptions (E & S / Buy / Existing)
            </p>
            <p className="text-brand-sage leading-relaxed text-[11px]">
              Single-letter status is fully supported! We automatically map <strong>"E"</strong> or any labels with <em>"exist/own"</em> to <strong>In Closet</strong>. Column values of <strong>"S"</strong> / <strong>"Buy"</strong> or labels with <em>"shop/wish"</em> are mapped to <strong>Buy Wishlist</strong>. Accidental status letters found in descriptions are sanitized automatically!
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Core Drag-Drop Column & Cell Loader */}
        <div className="space-y-4">
          <span className="text-[10px] uppercase font-bold text-brand-sage tracking-wider block font-sans">
            Method 1: Drag & Drop CSV spreadsheet
          </span>

          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-sm p-8 text-center flex flex-col items-center justify-center space-y-4 transition-all h-60 relative ${
              dragActive
                ? "border-brand-charcoal bg-brand-greige"
                : "border-brand-border bg-[#FAF9F6]/50 hover:bg-brand-greige/20"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.tsv"
              className="hidden"
            />
            <div className="p-3 bg-white rounded-xl border border-brand-border shadow-3xs text-brand-sage">
              <UploadCloud className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-brand-charcoal">
                Click to browse or drop your ".csv" file here
              </p>
              <p className="text-[11px] text-brand-sage/90">
                Supports columns: <strong className="font-semibold text-brand-charcoal select-all">Item / Colour / description / Brand / Notes / Existing or Buy</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Direct cell copying pasture area */}
        <div className="space-y-4">
          <span className="text-[10px] uppercase font-bold text-brand-sage tracking-wider block font-sans">
            Method 2: Directly Paste from Excel (Ctrl+V)
          </span>

          <div className="space-y-2 flex flex-col justify-between h-60">
            <textarea
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
              placeholder="Copy rows inside Excel/Sheets including headers, and paste them here... (Tab separated values are auto-recognized!)"
              className="flex-grow w-full bg-[#FAF9F6]/50 border border-brand-border text-brand-charcoal text-xs p-4 rounded-xl focus:ring-1 focus:ring-brand-olive focus:outline-none resize-none font-mono placeholder-brand-sage/60"
            />
            <button
              onClick={() => handleProcessText(pasteData)}
              disabled={!pasteData.trim()}
              className="w-full py-3 bg-brand-olive hover:bg-[#484833] disabled:bg-brand-sage/40 text-white font-semibold text-xs uppercase tracking-widest rounded-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <ClipboardCopy className="w-4 h-4" /> Load Copied Cells
            </button>
          </div>
        </div>
      </div>

      {fileError && (
        <div className="bg-[#FAF0E6] border border-[#ECD9C6] p-3 rounded-lg text-[#8A5229] text-xs font-mono">
          {fileError}
        </div>
      )}

      {successCount !== null && (
        <div className="bg-[#E8F0E8] border border-[#D1E2D1] p-4 rounded-xl text-[#4A674A] text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-[#4A674A]" />
          Successfully imported {successCount} clothing item capsules into your digital closet! Enjoy!
        </div>
      )}

      {/* Quick starter toolkit */}
      <footer className="bg-brand-greige/35 rounded-sm p-5 border border-brand-border flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-white rounded-lg border border-brand-border text-brand-sage shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-brand-charcoal">
              No spreadsheet active yet or want to quickly try the applet?
            </p>
            <p className="text-[11px] text-brand-sage leading-normal">
              Load our curated 10-item signature Capsule preset to see the dynamic visual effects, color distributions, and AI features!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleLoadTemplate}
            className="px-5 py-2.5 bg-brand-olive hover:bg-[#484833] text-white font-semibold text-[10px] tracking-widest uppercase rounded-sm transition-all flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" /> Load preset edit
          </button>
          {itemsCount > 0 && (
            <button
              onClick={onClearWardrobe}
              className="px-5 py-2.5 bg-white text-[#8C3F3F] hover:bg-[#FDF6F6] border border-[#E6CCCC] font-semibold text-[10px] tracking-widest uppercase rounded-sm transition-all cursor-pointer"
            >
              Clear Closet
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
