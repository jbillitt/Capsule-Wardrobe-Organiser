import React from "react";
import { WardrobeItem } from "../types";
import { CheckCircle2, Bookmark, Eye, Tag, Edit, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { ApparelSilhouette } from "./ApparelSilhouette";

// Re-exported so existing imports keep working.
export { ApparelSilhouette };

interface WardrobeCardProps {
  key?: React.Key;
  item: WardrobeItem;
  cardNumber?: number;
  onSelect: (item: WardrobeItem) => void;
  onDelete?: (id: string) => void;
  onToggleStatus?: (id: string) => void;
}

export default function WardrobeCard({ item, cardNumber, onSelect, onDelete, onToggleStatus }: WardrobeCardProps) {
  const isExisting = item.status === "existing";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      className="group relative bg-[#FAF9F6] rounded-sm border border-brand-border overflow-hidden flex flex-col justify-between shadow-sm border-brand-border hover:shadow-md transition-shadow"
      id={`wardrobe-card-${item.id}`}
    >
      {/* Auto numbering badge */}
      {cardNumber !== undefined && (
        <div className="absolute top-3 left-3 z-30 bg-brand-charcoal text-white border border-transparent px-2.5 py-1 rounded-lg font-mono text-xs font-bold shadow-sm select-none">
          {cardNumber.toString().padStart(2, '0')}
        </div>
      )}
      {/* Extreme Right Action Buttons */}
      <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 p-0.5 rounded-lg border border-brand-border backdrop-blur-xs shadow-xs">
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="p-1.5 text-brand-sage hover:text-red-650 rounded-md transition-colors"
            title="Remove item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Vector Silhouette Stage */}
      <div
        onClick={() => onSelect(item)}
        className="cursor-pointer h-40 w-full flex items-center justify-center bg-[#F2EFE9]/40 relative group overflow-hidden border-b border-brand-border/60"
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.item}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              // Graceful fallback to null if image loading breaks (e.g. invalid URLs)
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <>
            {/* Soft background ambient halo of the garment's precise color */}
            <div
              className="absolute inset-0 m-auto w-24 h-24 blur-xl rounded-full opacity-15 group-hover:opacity-25 transition-opacity duration-300 pointer-events-none"
              style={{ backgroundColor: item.hex }}
            />
            
            {/* Category label as text watermark style */}
            <span className="font-serif italic text-brand-sage/60 text-[11px] absolute top-3 left-4 select-none">
              {item.aiSuggestedCategory || "Apparel"}
            </span>

            {/* Dynamic Apparel silhouette */}
            <div className="w-full h-full max-w-[70px] max-h-[110px] flex items-center justify-center z-1 pt-4">
              <ApparelSilhouette item={item} />
            </div>
          </>
        )}

        {/* Hover overlay trigger cue */}
        <div className="absolute inset-0 bg-stone-900/10 opacity-0 group-hover:opacity-100 rounded-t-[20px] flex items-center justify-center transition-all duration-300 z-10">
          <span className="bg-white/95 text-brand-charcoal text-[11px] px-3 py-1.5 rounded-full font-semibold shadow-sm flex items-center gap-1 border border-brand-border">
            <Eye className="w-3.5 h-3.5" /> View Details
          </span>
        </div>

        {/* Classic styled color swatch with thick border, bottom-right of visual card */}
        <div 
          className="absolute bottom-3 right-3 w-6 h-6 rounded-full border-2 border-white shadow-sm border-brand-border z-10 transition-transform group-hover:scale-110"
          style={{ backgroundColor: item.hex }}
          title={item.color}
        />
      </div>

      {/* Card Content Footer labels */}
      <div className="p-5 flex flex-col gap-2 cursor-pointer flex-1 justify-between" onClick={() => onSelect(item)}>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[10px] uppercase font-bold tracking-wider text-brand-sage font-sans">
              {item.brand || "Unbranded"}
            </p>
            {item.season && (
              <>
                <span className="text-[8px] text-brand-sage/60">•</span>
                <span className="text-[9px] font-sans font-semibold text-brand-olive uppercase tracking-wider">
                  {item.season.replace(" capsule 2026", " '26").replace(" capsule 2025 - 26", " '25-26")}
                </span>
              </>
            )}
          </div>
          <h3 className="font-serif font-semibold text-brand-charcoal text-[17px] tracking-tight capitalize truncate leading-tight">
            {item.item}
          </h3>
          
          {item.description && (
            <p className="text-[12px] text-brand-sage italic line-clamp-1 mt-1 leading-normal">
              {item.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-brand-border/40">
          <span className="text-xs text-brand-charcoal/80 font-medium truncate capitalize">
            {item.color}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleStatus) onToggleStatus(item.id);
            }}
            className={`self-start px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider border transition-all ${
              isExisting
                ? "bg-[#E8F0E8] text-[#4A674A] border-transparent hover:brightness-95"
                : "bg-[#F8EEE8] text-[#A6705D] border-transparent hover:brightness-95"
            }`}
            title="Toggle Closet Item / Wishlist"
          >
            {isExisting ? "Existing" : "Wishlist"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
