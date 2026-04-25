"use client";

import { useState, useRef, useEffect, type ReactNode, forwardRef } from "react";
import { createPortal } from "react-dom";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import {
  type HdWindowPresetId,
  getPresetsForDevice,
  matchWindowPreset,
} from "@/lib/hdWindowPresets";
import {
  LayoutGrid, Crosshair, Film, Columns2, Maximize, Download,
  Link2, Layers, RefreshCcw, Eye, Info,
  Play, Pause, Palette, Target, BarChart3, Spline, Trash2, FileText,
  MousePointer2, Move, ZoomIn, Search, Maximize2, ScanSearch,
  Sun, CircleSlash2 as InvertIcon, Contrast, FlipHorizontal, FlipVertical,
  RotateCcw, RotateCw, Crosshair as ProbeIcon,
  Ruler, Triangle, Circle, Square, Type, Eraser,
  SlidersHorizontal, Waves, Hash,
} from "lucide-react";

/* ═══════════════════════════════════════════════════
   Public types
   ═══════════════════════════════════════════════════ */

export type ToolId = string;
export type GridLayoutId =
  | "1x1"
  | "1-2_top"   // top big, bottom split 2
  | "1-2_left"  // left big, right split 2
  | "1-2_right" // left split 2, right big
  | "1-2_bottom"// top split 2, bottom big
  | "2x1"
  | "2-1_left"  // left half, right top/bottom
  | "1x2"
  | "2-1_right" // left top/bottom, right half
  | "2x2"
  | "3-1_left"  // left big, right 3 rows
  | "1-3_bottom"// top 3 cols, bottom big
  | "3-1_right" // left 3 rows, right big
  | "1-3_top"   // top big, bottom 3 cols
  | "3x3"
  | "custom";

export type IntraSeriesGridId = "1x1" | "1x2" | "2x1" | "2x2" | "3x3";
export type FilmPrintTemplateId = "2x3" | "2x4" | "3x3" | "3x4" | "4x5" | "4x6";

export type HdSidebarToolbarProps = {
  activeTool: ToolId | null;
  onSelectTool: (id: ToolId) => void;
  gridLayout: GridLayoutId;
  onSelectGrid: (id: GridLayoutId) => void;
  intraSeriesGrid: IntraSeriesGridId;
  onSelectIntraSeriesGrid: (id: IntraSeriesGridId) => void;
  filmPrintTemplate: FilmPrintTemplateId;
  onSelectFilmPrintTemplate: (id: FilmPrintTemplateId) => void;
  onSelectCompareLayout: (id: GridLayoutId) => void;
  linkSync: boolean;
  onToggleLinkSync: () => void;
  cineMode?: boolean;
  cinePlaying?: boolean;
  overlayVisible?: boolean;
  windowPresetId: HdWindowPresetId | null;
  onSelectWindowPreset: (id: HdWindowPresetId) => void;
  onApplyCustomWindowPreset: (ww: number, wl: number) => void;
  activeViewportWW?: number;
  activeViewportWL?: number;
};

/* ═══════════════════════════════════════════════════
   Shared primitives
   ═══════════════════════════════════════════════════ */

const ICO = 20;
const ACCENT = "#4FD1ED";

/* ── shared hooks ── */

function usePopoverPos(anchorEl: HTMLElement | null, w: number, h: number) {
  const [pos, setPos] = useState({ top: 100, left: 220 });
  useEffect(() => {
    if (!anchorEl) return;
    const r = anchorEl.getBoundingClientRect();
    let left = r.right + 8;
    let top = r.top;
    if (left + w > window.innerWidth - 8) left = r.left - w - 8;
    if (top + h > window.innerHeight - 8) top = window.innerHeight - h - 8;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [anchorEl, w, h]);
  return pos;
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onClose]);
}

/* ── shared primitives ── */

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <RadixTooltip.Root delayDuration={200}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side="right"
          sideOffset={6}
          className="z-[100] rounded bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-200 shadow-xl ring-1 ring-white/10 animate-in fade-in-0 zoom-in-95"
        >
          {label}
          <RadixTooltip.Arrow className="fill-zinc-900" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

const ToolBtn = forwardRef<
  HTMLButtonElement,
  {
    id: string;
    icon: ReactNode;
    label: string;
    active?: boolean;
    disabled?: boolean;
    hasDropdown?: boolean;
    onClick?: () => void;
  }
>(function ToolBtn({ id, icon, label, active, disabled, hasDropdown, onClick, ...rest }, ref) {
  return (
    <Tip label={label}>
      <button
        ref={ref}
        type="button"
        data-tool={id}
        disabled={disabled}
        onClick={onClick}
        className={`relative flex h-[34px] w-[34px] items-center justify-center rounded-md transition-colors
          ${disabled ? "cursor-not-allowed text-zinc-700" : ""}
          ${!disabled && active ? "bg-sky-500/25 text-sky-300 ring-1 ring-inset ring-sky-500/40" : ""}
          ${!disabled && !active ? "text-zinc-400 hover:bg-white/8 hover:text-zinc-200" : ""}
        `}
        {...rest}
      >
        {icon}
        {hasDropdown && (
          <span className="absolute bottom-[2px] right-[2px] text-[6px] leading-none opacity-50">▾</span>
        )}
      </button>
    </Tip>
  );
});

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1 mt-2.5 border-b border-white/5 px-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600 first:mt-0">
      {children}
    </div>
  );
}

function ToolRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-7 gap-[2px] px-0.5">{children}</div>;
}

/* ═══════════════════════════════════════════════════
   Custom SVG icons (medical-specific, no lucide)
   ═══════════════════════════════════════════════════ */

function IcoMPR() {
  return (
    <svg width={ICO} height={ICO} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
      <rect x="1" y="1" width="6" height="6" rx=".5" />
      <rect x="9" y="1" width="6" height="6" rx=".5" />
      <rect x="1" y="9" width="6" height="6" rx=".5" />
      <path d="M12 9v6M9 12h6" strokeOpacity=".5" />
    </svg>
  );
}

function IcoHangingProtocol() {
  return (
    <svg width={ICO} height={ICO} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
      <rect x="2" y="2" width="5" height="4" rx=".5" />
      <rect x="9" y="2" width="5" height="4" rx=".5" />
      <rect x="2" y="8" width="5" height="6" rx=".5" />
      <rect x="9" y="8" width="5" height="6" rx=".5" />
      <path d="M4.5 1v1M11.5 1v1" strokeWidth="1.5" />
    </svg>
  );
}

function IcoRegionSelect() {
  return (
    <svg width={ICO} height={ICO} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
      <rect x="3" y="3" width="10" height="10" rx="1" strokeDasharray="2 2" />
      <path d="M6 8h4M8 6v4" strokeWidth="1" />
    </svg>
  );
}

function IcoScout() {
  return (
    <svg width={ICO} height={ICO} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
      <rect x="2" y="1" width="12" height="14" rx="1" />
      <path d="M2 6h12M2 10h12" strokeDasharray="2 1.5" strokeOpacity=".6" />
      <path d="M8 1v14" strokeOpacity=".3" />
    </svg>
  );
}

function IcoRefLines() {
  return (
    <svg width={ICO} height={ICO} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <path d="M2 8h12" strokeDasharray="2 2" />
      <path d="M5 4l6 8" strokeOpacity=".6" />
    </svg>
  );
}

function IcoPresetZoom() {
  return (
    <svg width={ICO} height={ICO} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M11 11l3 3" />
      <path d="M5.5 7h3" strokeWidth="1" />
      <path d="M12 4l2 0M12 6l1.5 0" strokeWidth="1" strokeOpacity=".5" />
    </svg>
  );
}

function IcoActualSize() {
  return (
    <svg width={ICO} height={ICO} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
      <rect x="3" y="3" width="10" height="10" rx="1" />
      <text x="8" y="10.5" textAnchor="middle" fill="currentColor" stroke="none" fontSize="6" fontWeight="700" fontFamily="monospace">1:1</text>
    </svg>
  );
}

function IcoBrightness() {
  return (
    <svg width={ICO} height={ICO} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.8 3.8l1.4 1.4M10.8 10.8l1.4 1.4M12.2 3.8l-1.4 1.4M5.2 10.8l-1.4 1.4" strokeWidth="1" />
    </svg>
  );
}

function IcoGamma() {
  return (
    <svg width={ICO} height={ICO} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
      <text x="8" y="12" textAnchor="middle" fill="currentColor" stroke="none" fontSize="10" fontWeight="700" fontFamily="serif" fontStyle="italic">γ</text>
    </svg>
  );
}

function IcoClosedPath() {
  return (
    <svg width={ICO} height={ICO} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 10C3 7 5 3 8 3s5 4 4 7c-1 2-3 3-4 3s-3-1-4-3z" />
    </svg>
  );
}

function IcoCenter() {
  return (
    <svg width={ICO} height={ICO} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
      <circle cx="8" cy="8" r="5" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      <path d="M8 3v2M8 11v2M3 8h2M11 8h2" strokeWidth="1" />
    </svg>
  );
}

function IcoWindowZoom() {
  return (
    <svg width={ICO} height={ICO} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
      <rect x="4" y="4" width="8" height="8" rx=".5" strokeDasharray="2 1.5" />
      <path d="M2 2l3 3M14 2l-3 3M2 14l3-3M14 14l-3-3" strokeWidth="1" strokeOpacity=".5" />
    </svg>
  );
}

function IcoIntraSeries() {
  return (
    <svg width={ICO} height={ICO} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <path d="M2 8h12M8 2v12" strokeOpacity=".6" />
    </svg>
  );
}

function IcoFilmPrint() {
  return (
    <svg width={ICO} height={ICO} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
      <rect x="3" y="1" width="10" height="14" rx="1" strokeDasharray="2 1.5" />
      <rect x="4.5" y="3" width="3" height="2.5" rx=".3" strokeWidth="0.8" />
      <rect x="8.5" y="3" width="3" height="2.5" rx=".3" strokeWidth="0.8" />
      <rect x="4.5" y="6.5" width="3" height="2.5" rx=".3" strokeWidth="0.8" />
      <rect x="8.5" y="6.5" width="3" height="2.5" rx=".3" strokeWidth="0.8" />
      <rect x="4.5" y="10" width="3" height="2.5" rx=".3" strokeWidth="0.8" />
      <rect x="8.5" y="10" width="3" height="2.5" rx=".3" strokeWidth="0.8" />
    </svg>
  );
}

function IcoCompareSync() {
  return (
    <svg width={ICO} height={ICO} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden>
      <rect x="1.5" y="3" width="5.5" height="10" rx="1" />
      <rect x="9" y="3" width="5.5" height="10" rx="1" />
      <path d="M7.5 6.5l1.5 1.5-1.5 1.5" strokeWidth="1" strokeOpacity=".6" />
      <path d="M8.5 9.5L7 8l1.5-1.5" strokeWidth="1" strokeOpacity=".6" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════
   Grid layout sub-menu (Icon 1 — viewport layout)
   ═══════════════════════════════════════════════════ */

/*
 * Each layout is defined as CSS grid-template-areas on a 6×4 conceptual grid.
 * The `areas` string uses named cells; `cells` lists unique area names for coloring.
 */
type LayoutDef = { id: GridLayoutId; areas: string; columns?: string; rows?: string; cells: string[] };

const LAYOUTS: LayoutDef[] = [
  { id: "1x1",        areas: "'a'",                     cells: ["a"] },
  { id: "1-2_top",    areas: "'a b' 'c c'",             cells: ["a", "b", "c"] },
  { id: "1-2_left",   areas: "'a b' 'a c'",             cells: ["a", "b", "c"] },
  { id: "1-2_right",  areas: "'a c' 'b c'",             cells: ["a", "b", "c"] },
  { id: "1-2_bottom", areas: "'a a' 'b c'",             cells: ["a", "b", "c"] },
  { id: "2x1",        areas: "'a' 'b'",                 cells: ["a", "b"] },
  { id: "2-1_left",   areas: "'a b' 'a c'",             columns: "2fr 1fr", cells: ["a", "b", "c"] },
  { id: "1x2",        areas: "'a b'",                   cells: ["a", "b"] },
  { id: "2-1_right",  areas: "'a c' 'b c'",             columns: "1fr 2fr", cells: ["a", "b", "c"] },
  { id: "2x2",        areas: "'a b' 'c d'",             cells: ["a", "b", "c", "d"] },
  { id: "3-1_left",   areas: "'a b' 'a c' 'a d'",       columns: "2fr 1fr", cells: ["a", "b", "c", "d"] },
  { id: "1-3_bottom", areas: "'a b c' 'd d d'",         cells: ["a", "b", "c", "d"] },
  { id: "3-1_right",  areas: "'a c' 'b c' 'd c'",       columns: "1fr 2fr", cells: ["a", "b", "c", "d"] },
  { id: "1-3_top",    areas: "'a a a' 'b c d'",         cells: ["a", "b", "c", "d"] },
  { id: "3x3",        areas: "'a b c' 'd e f' 'g h i'", cells: ["a", "b", "c", "d", "e", "f", "g", "h", "i"] },
];

function LayoutCard({ def, active, onClick }: { def: LayoutDef; active: boolean; onClick: () => void }) {
  const style: React.CSSProperties = {
    display: "grid",
    gridTemplateAreas: def.areas,
    ...(def.columns ? { gridTemplateColumns: def.columns } : {}),
    ...(def.rows ? { gridTemplateRows: def.rows } : {}),
    gap: "1.5px",
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: "3px",
    overflow: "hidden",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center rounded-[5px] p-[6px] transition-colors ${
        active
          ? "bg-[#3a3a3a] ring-2 ring-white/90"
          : "bg-[#4a4a4a] hover:bg-[#555]"
      }`}
      style={{ width: 90, height: 64 }}
    >
      <div style={style}>
        {def.cells.map((name) => (
          <div
            key={name}
            style={{
              gridArea: name,
              backgroundColor: "#7dd3dc",
              minHeight: 0,
              minWidth: 0,
            }}
          />
        ))}
      </div>
    </button>
  );
}

function GridSubmenu({
  current,
  onSelect,
  onClose,
  anchorEl,
}: {
  current: GridLayoutId;
  onSelect: (id: GridLayoutId) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 100, left: 220 });

  useEffect(() => {
    if (!anchorEl) return;
    const r = anchorEl.getBoundingClientRect();
    const panelW = 520;
    const panelH = 220;
    let left = r.right + 8;
    let top = r.top;
    if (left + panelW > window.innerWidth - 8) left = r.left - panelW - 8;
    if (top + panelH > window.innerHeight - 8) top = window.innerHeight - panelH - 8;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [anchorEl]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] rounded-lg"
      style={{
        width: 520,
        backgroundColor: "#505050",
        border: "1px solid rgba(255,255,255,0.15)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        padding: 12,
        top: pos.top,
        left: pos.left,
      }}
    >
      <div className="grid grid-cols-5 gap-[7px]">
        {LAYOUTS.map((def) => (
          <LayoutCard
            key={def.id}
            def={def}
            active={current === def.id}
            onClick={() => {
              onSelect(def.id);
              onClose();
            }}
          />
        ))}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center rounded-[5px] bg-[#4a4a4a] text-zinc-400 hover:bg-[#555] hover:text-zinc-200"
          style={{ width: 90, height: 64 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <path d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.708.708a2 2 0 010 2.828L12.536 16.536 9 17.5l.5-3.5z" />
          </svg>
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════
   Colormap sub-menu
   ═══════════════════════════════════════════════════ */

const COLOR_MAPS = [
  { id: "grayscale", label: "灰度", bg: "bg-gradient-to-r from-black to-white" },
  { id: "hot-iron", label: "铁红", bg: "bg-gradient-to-r from-black via-red-600 to-yellow-300" },
  { id: "rainbow", label: "彩虹", bg: "bg-gradient-to-r from-violet-600 via-green-400 to-red-500" },
  { id: "cool-warm", label: "冷暖", bg: "bg-gradient-to-r from-blue-500 via-white to-red-500" },
  { id: "jet", label: "Jet", bg: "bg-gradient-to-r from-blue-700 via-cyan-400 to-red-600" },
];

function ColormapSubmenu({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute left-full top-0 z-50 ml-1 w-36 rounded-lg border border-white/10 bg-[#1a1f2e] p-2 shadow-xl">
      <p className="mb-1.5 text-[10px] font-semibold text-zinc-400">伪彩方案</p>
      <div className="flex flex-col gap-1">
        {COLOR_MAPS.map((cm) => (
          <button key={cm.id} type="button" onClick={onClose} className="flex items-center gap-2 rounded px-1.5 py-1 text-[11px] text-zinc-300 hover:bg-white/10">
            <div className={`h-3 w-8 rounded-sm ${cm.bg}`} />
            <span>{cm.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Icon 2 — Intra-series tiling sub-menu
   ═══════════════════════════════════════════════════ */

const INTRA_GRIDS: { id: IntraSeriesGridId; c: number; r: number; label: string }[] = [
  { id: "1x1", c: 1, r: 1, label: "1×1" },
  { id: "1x2", c: 1, r: 2, label: "1×2" },
  { id: "2x1", c: 2, r: 1, label: "2×1" },
  { id: "2x2", c: 2, r: 2, label: "2×2" },
  { id: "3x3", c: 3, r: 3, label: "3×3" },
];

function IntraSeriesSubmenu({
  current,
  onSelect,
  onClose,
  anchorEl,
}: {
  current: IntraSeriesGridId;
  onSelect: (id: IntraSeriesGridId) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = usePopoverPos(anchorEl, 340, 80);
  useClickOutside(ref, onClose);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] rounded-lg"
      style={{
        width: 340,
        backgroundColor: "#333",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
        padding: 10,
        top: pos.top,
        left: pos.left,
      }}
    >
      <p className="mb-2 text-[10px] font-semibold text-zinc-400">序列内平铺</p>
      <div className="flex gap-[6px]">
        {INTRA_GRIDS.map((g) => {
          const active = current === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => { onSelect(g.id); onClose(); }}
              className={`flex flex-col items-center justify-center rounded-[5px] p-1.5 transition-colors ${
                active ? "bg-[#3a3a3a] ring-2 ring-[#4FD1ED]" : "bg-[#444] hover:bg-[#555]"
              }`}
              style={{ width: 56, height: 52 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${g.c}, 1fr)`,
                  gridTemplateRows: `repeat(${g.r}, 1fr)`,
                  gap: "1px",
                  width: "100%",
                  height: "100%",
                  backgroundColor: "rgba(255,255,255,0.18)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                {Array.from({ length: g.c * g.r }, (_, i) => (
                  <div key={i} style={{ backgroundColor: ACCENT, minWidth: 0, minHeight: 0 }} />
                ))}
              </div>
              <span className="mt-1 text-[8px] font-bold text-zinc-400">{g.label}</span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════
   Icon 3 — Film / print template sub-menu
   ═══════════════════════════════════════════════════ */

const FILM_TEMPLATES: { id: FilmPrintTemplateId; c: number; r: number; label: string }[] = [
  { id: "2x3", c: 2, r: 3, label: "2×3" },
  { id: "2x4", c: 2, r: 4, label: "2×4" },
  { id: "3x3", c: 3, r: 3, label: "3×3" },
  { id: "3x4", c: 3, r: 4, label: "3×4" },
  { id: "4x5", c: 4, r: 5, label: "4×5" },
  { id: "4x6", c: 4, r: 6, label: "4×6" },
];

function FilmPrintSubmenu({
  current,
  onSelect,
  onClose,
  anchorEl,
}: {
  current: FilmPrintTemplateId;
  onSelect: (id: FilmPrintTemplateId) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = usePopoverPos(anchorEl, 490, 100);
  useClickOutside(ref, onClose);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] rounded-lg"
      style={{
        width: 490,
        backgroundColor: "#444",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
        padding: 10,
        top: pos.top,
        left: pos.left,
      }}
    >
      <p className="mb-2 text-[10px] font-semibold text-zinc-400">胶片排版模板</p>
      <div className="flex gap-[6px]">
        {FILM_TEMPLATES.map((t) => {
          const active = current === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { onSelect(t.id); onClose(); }}
              className={`flex flex-col items-center justify-center rounded-[5px] transition-colors ${
                active ? "bg-[#3a3a3a] ring-2 ring-[#4FD1ED]" : "bg-[#3a3a3a] hover:bg-[#4a4a4a]"
              }`}
              style={{ width: 68, height: 64, padding: 5 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${t.c}, 1fr)`,
                  gridTemplateRows: `repeat(${t.r}, 1fr)`,
                  gap: "1px",
                  width: "100%",
                  height: "100%",
                  backgroundColor: "rgba(255,255,255,0.12)",
                  border: "1px dashed rgba(255,255,255,0.25)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                {Array.from({ length: t.c * t.r }, (_, i) => (
                  <div key={i} style={{ backgroundColor: "#4a7078", minWidth: 0, minHeight: 0 }} />
                ))}
              </div>
              <span className="mt-1 text-[8px] font-bold text-zinc-400">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════
   Icon 4 — Comparison / sync layout sub-menu
   ═══════════════════════════════════════════════════ */

const COMPARE_LAYOUTS: LayoutDef[] = [
  { id: "1x2",       areas: "'a b'",               cells: ["a", "b"] },
  { id: "2x1",       areas: "'a' 'b'",             cells: ["a", "b"] },
  { id: "2x2",       areas: "'a b' 'c d'",         cells: ["a", "b", "c", "d"] },
  { id: "1-2_left",  areas: "'a b' 'a c'",         cells: ["a", "b", "c"] },
  { id: "1-2_right", areas: "'a c' 'b c'",         cells: ["a", "b", "c"] },
  { id: "2-1_left",  areas: "'a b' 'a c'",         columns: "2fr 1fr", cells: ["a", "b", "c"] },
  { id: "2-1_right", areas: "'a c' 'b c'",         columns: "1fr 2fr", cells: ["a", "b", "c"] },
  { id: "3-1_left",  areas: "'a b' 'a c' 'a d'",   columns: "2fr 1fr", cells: ["a", "b", "c", "d"] },
  { id: "3-1_right", areas: "'a c' 'b c' 'd c'",   columns: "1fr 2fr", cells: ["a", "b", "c", "d"] },
];

function CompareSubmenu({
  current,
  onSelect,
  onClose,
  anchorEl,
}: {
  current: GridLayoutId;
  onSelect: (id: GridLayoutId) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = usePopoverPos(anchorEl, 520, 160);
  useClickOutside(ref, onClose);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] rounded-lg"
      style={{
        width: 520,
        backgroundColor: "#333",
        border: "1px solid rgba(255,255,255,0.15)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
        padding: 12,
        top: pos.top,
        left: pos.left,
      }}
    >
      <p className="mb-2 text-[10px] font-semibold text-zinc-400">对比联动布局</p>
      <div className="grid grid-cols-5 gap-[7px]">
        {COMPARE_LAYOUTS.map((def) => (
          <LayoutCard
            key={def.id}
            def={def}
            active={current === def.id}
            onClick={() => { onSelect(def.id); onClose(); }}
          />
        ))}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center rounded-[5px] bg-[#4a4a4a] text-zinc-400 hover:bg-[#555] hover:text-zinc-200"
          style={{ width: 90, height: 64 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <path d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.708.708a2 2 0 010 2.828L12.536 16.536 9 17.5l.5-3.5z" />
          </svg>
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════
   Window presets sub-menu
   ═══════════════════════════════════════════════════ */

function WindowPresetSubmenu({
  currentId,
  currentWW,
  currentWL,
  onSelect,
  onApplyCustomWindowPreset,
  initialShowCustomEditor = false,
  onClose,
  anchorEl,
}: {
  currentId: HdWindowPresetId | null;
  currentWW?: number;
  currentWL?: number;
  onSelect: (id: HdWindowPresetId) => void;
  onApplyCustomWindowPreset: (ww: number, wl: number) => void;
  initialShowCustomEditor?: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}) {
  const formatWindowValue = (value?: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? String(Math.round(value))
      : "";
  const displayWindowValue = (value?: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.round(value)
      : "—";
  const ref = useRef<HTMLDivElement>(null);
  const pos = usePopoverPos(anchorEl, 360, 420);
  useClickOutside(ref, onClose);

  const presets = getPresetsForDevice("CT");
  const matchedId =
    currentId && currentId !== "default" && currentId !== "custom"
      ? currentId
      : currentWW != null && currentWL != null
        ? matchWindowPreset(currentWW, currentWL)
        : null;
  const [showCustomEditor, setShowCustomEditor] = useState(
    initialShowCustomEditor || currentId === "custom",
  );
  const [customWWInput, setCustomWWInput] = useState(() =>
    formatWindowValue(currentWW),
  );
  const [customWLInput, setCustomWLInput] = useState(() =>
    formatWindowValue(currentWL),
  );
  const [customError, setCustomError] = useState<string | null>(null);

  const applyCustomWindowPreset = () => {
    const ww = Number(customWWInput);
    const wl = Number(customWLInput);
    if (!Number.isFinite(ww) || ww <= 0) {
      setCustomError("窗宽必须是大于 0 的数字");
      return;
    }
    if (!Number.isFinite(wl)) {
      setCustomError("窗位必须是有效数字");
      return;
    }
    onApplyCustomWindowPreset(Math.round(ww), Math.round(wl));
    onClose();
  };

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] rounded-lg"
      style={{
        width: 360,
        backgroundColor: "#333",
        border: "1px solid rgba(255,255,255,0.15)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
        padding: 12,
        top: pos.top,
        left: pos.left,
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold text-zinc-400">预设窗值 · CT</p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowCustomEditor((prev) => !prev)}
            className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
              showCustomEditor
                ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40"
                : "text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
            }`}
          >
            手动输入
          </button>
          <button
            type="button"
            onClick={() => {
              onSelect("default");
              onClose();
            }}
            className="rounded px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
          >
            恢复默认
          </button>
        </div>
      </div>
      <div className="mb-3 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-[10px] text-zinc-400">
        <div className="flex items-center justify-between gap-2">
          <span>当前视口</span>
          <span className="font-mono text-zinc-300">
            WW {displayWindowValue(currentWW)} / WL {displayWindowValue(currentWL)}
          </span>
        </div>
      </div>
      {showCustomEditor && (
        <form
          className={`mb-3 rounded-lg border px-3 py-3 ${
            currentId === "custom"
              ? "border-sky-500/35 bg-sky-500/10"
              : "border-white/10 bg-[#2c313b]"
          }`}
          onSubmit={(event) => {
            event.preventDefault();
            applyCustomWindowPreset();
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-medium text-zinc-200">
                自定义窗宽窗位
              </div>
              <div className="text-[10px] text-zinc-500">
                输入后点击应用，立即作用到当前激活视口
              </div>
            </div>
            {currentId === "custom" && (
              <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-200">
                已启用
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[10px] text-zinc-400">
              <span>窗宽 WW</span>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                value={customWWInput}
                onChange={(event) => {
                  setCustomWWInput(event.target.value);
                  if (customError) setCustomError(null);
                }}
                className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-[12px] text-zinc-100 outline-none ring-0 transition focus:border-sky-500/50"
                placeholder="例如 400"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-zinc-400">
              <span>窗位 WL</span>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                value={customWLInput}
                onChange={(event) => {
                  setCustomWLInput(event.target.value);
                  if (customError) setCustomError(null);
                }}
                className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-[12px] text-zinc-100 outline-none ring-0 transition focus:border-sky-500/50"
                placeholder="例如 40"
              />
            </label>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setCustomWWInput(formatWindowValue(currentWW));
                setCustomWLInput(formatWindowValue(currentWL));
                setCustomError(null);
              }}
              className="rounded-md px-2.5 py-1.5 text-[10px] text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
            >
              带入当前值
            </button>
            <button
              type="submit"
              className="rounded-md bg-sky-500/20 px-3 py-1.5 text-[10px] font-medium text-sky-200 ring-1 ring-sky-500/40 transition hover:bg-sky-500/25"
            >
              应用
            </button>
          </div>
          {customError && (
            <div className="mt-2 text-[10px] text-rose-300">{customError}</div>
          )}
        </form>
      )}
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-white/10 text-zinc-500">
            <th className="px-2 py-1.5 text-left font-medium">中文名称</th>
            <th className="px-2 py-1.5 text-left font-medium">英文名称</th>
            <th className="px-2 py-1.5 text-right font-medium">窗宽</th>
            <th className="px-2 py-1.5 text-right font-medium">窗位</th>
          </tr>
        </thead>
        <tbody>
          {presets.map((p) => {
            const active = matchedId === p.id;
            return (
              <tr
                key={p.id}
                onClick={() => {
                  onSelect(p.id);
                  onClose();
                }}
                className={`cursor-pointer transition-colors ${
                  active
                    ? "bg-sky-500/20 text-sky-200"
                    : "text-zinc-300 hover:bg-white/8"
                }`}
              >
                <td className="px-2 py-1.5 font-medium">{p.label}</td>
                <td className="px-2 py-1.5">{p.labelEn}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{p.ww}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{p.wl}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════ */

export default function HdSidebarToolbar({
  activeTool,
  onSelectTool,
  gridLayout,
  onSelectGrid,
  intraSeriesGrid,
  onSelectIntraSeriesGrid,
  filmPrintTemplate,
  onSelectFilmPrintTemplate,
  onSelectCompareLayout,
  linkSync,
  onToggleLinkSync,
  cineMode = false,
  cinePlaying = false,
  overlayVisible = true,
  windowPresetId,
  onSelectWindowPreset,
  onApplyCustomWindowPreset,
  activeViewportWW,
  activeViewportWL,
}: HdSidebarToolbarProps) {
  const [submenu, setSubmenu] = useState<string | null>(null);
  const layoutBtnRef = useRef<HTMLButtonElement>(null);
  const intraBtnRef = useRef<HTMLButtonElement>(null);
  const filmBtnRef = useRef<HTMLButtonElement>(null);
  const compareBtnRef = useRef<HTMLButtonElement>(null);
  const quickWindowBtnRef = useRef<HTMLButtonElement>(null);
  const wlBtnRef = useRef<HTMLButtonElement>(null);

  const select = (id: string) => {
    setSubmenu(null);
    onSelectTool(id);
  };

  const toggleSub = (id: string) => setSubmenu((p) => (p === id ? null : id));

  const isActive = (id: string) => activeTool === id;

  return (
    <RadixTooltip.Provider delayDuration={180}>
      <div className="flex flex-col gap-0.5 pb-2">

        {/* ──────────────── MODULE 1: 布局与显示管理 ──────────────── */}
        <SectionTitle>布局与显示</SectionTitle>
        <ToolRow>
          {/* 1. 序列布局 (viewport-level layout) */}
          <div className="relative">
            <ToolBtn ref={layoutBtnRef} id="layout" icon={<LayoutGrid size={ICO} />} label="序列布局" hasDropdown active={submenu === "layout"} onClick={() => toggleSub("layout")} />
            {submenu === "layout" && <GridSubmenu current={gridLayout} onSelect={onSelectGrid} onClose={() => setSubmenu(null)} anchorEl={layoutBtnRef.current} />}
          </div>
          {/* 2. 序列内平铺 (intra-series tiling) */}
          <div className="relative">
            <ToolBtn ref={intraBtnRef} id="intra-series" icon={<IcoIntraSeries />} label="序列内平铺" hasDropdown active={submenu === "intra-series"} onClick={() => toggleSub("intra-series")} />
            {submenu === "intra-series" && <IntraSeriesSubmenu current={intraSeriesGrid} onSelect={onSelectIntraSeriesGrid} onClose={() => setSubmenu(null)} anchorEl={intraBtnRef.current} />}
          </div>
          {/* 3. 胶片排版 (film / print mode) */}
          <div className="relative">
            <ToolBtn ref={filmBtnRef} id="film-print" icon={<IcoFilmPrint />} label="胶片排版" hasDropdown active={submenu === "film-print"} onClick={() => toggleSub("film-print")} />
            {submenu === "film-print" && <FilmPrintSubmenu current={filmPrintTemplate} onSelect={onSelectFilmPrintTemplate} onClose={() => setSubmenu(null)} anchorEl={filmBtnRef.current} />}
          </div>
          {/* 4. 对比联动布局 (comparison / sync) */}
          <div className="relative">
            <ToolBtn ref={compareBtnRef} id="compare" icon={<IcoCompareSync />} label="对比联动布局" hasDropdown active={submenu === "compare"} onClick={() => toggleSub("compare")} />
            {submenu === "compare" && <CompareSubmenu current={gridLayout} onSelect={onSelectCompareLayout} onClose={() => setSubmenu(null)} anchorEl={compareBtnRef.current} />}
          </div>
          <div className="relative">
            <ToolBtn
              ref={quickWindowBtnRef}
              id="quick-window"
              icon={<SlidersHorizontal size={ICO} />}
              label="手动调窗"
              hasDropdown
              active={submenu === "wl-custom" || windowPresetId === "custom"}
              onClick={() => toggleSub("wl-custom")}
            />
            {submenu === "wl-custom" && (
              <WindowPresetSubmenu
                currentId={windowPresetId}
                currentWW={activeViewportWW}
                currentWL={activeViewportWL}
                onSelect={onSelectWindowPreset}
                onApplyCustomWindowPreset={onApplyCustomWindowPreset}
                initialShowCustomEditor
                onClose={() => setSubmenu(null)}
                anchorEl={quickWindowBtnRef.current}
              />
            )}
          </div>
          <ToolBtn id="hanging-protocol" icon={<IcoHangingProtocol />} label="挂片协议" active={isActive("hanging-protocol")} onClick={() => select("hanging-protocol")} />
          <ToolBtn id="fullscreen" icon={<Maximize size={ICO} />} label="全屏" active={isActive("fullscreen")} onClick={() => select("fullscreen")} />
        </ToolRow>
        <ToolRow>
          <ToolBtn id="mpr" icon={<IcoMPR />} label="MPR（待开放）" disabled />
          <ToolBtn id="export" icon={<Download size={ICO} />} label="导出" active={isActive("export")} onClick={() => select("export")} />
        </ToolRow>

        {/* ──────────────── MODULE 2: 序列交互与增强 ──────────────── */}
        <SectionTitle>序列交互与增强</SectionTitle>
        <ToolRow>
          <ToolBtn id="link-sync" icon={<Link2 size={ICO} />} label="视口同步" active={linkSync} onClick={onToggleLinkSync} />
          <ToolBtn id="stack-scroll" icon={<Layers size={ICO} />} label="序列滚动" active={isActive("stack-scroll")} onClick={() => select("stack-scroll")} />
          <ToolBtn id="loop-scroll" icon={<RefreshCcw size={ICO} />} label="循环滚动" active={isActive("loop-scroll")} onClick={() => select("loop-scroll")} />
          <ToolBtn id="ref-lines" icon={<IcoRefLines />} label="参考线" active={isActive("ref-lines")} onClick={() => select("ref-lines")} />
          <ToolBtn id="scout" icon={<IcoScout />} label="定位像" active={isActive("scout")} onClick={() => select("scout")} />
          <ToolBtn id="info-overlay" icon={<Eye size={ICO} />} label={overlayVisible ? "隐藏四角信息" : "显示四角信息"} active={overlayVisible} onClick={() => select("info-overlay")} />
          <ToolBtn id="crosshair" icon={<Crosshair size={ICO} />} label="十字定位" active={isActive("crosshair")} onClick={() => select("crosshair")} />
        </ToolRow>
        <ToolRow>
          <ToolBtn id="cine" icon={cinePlaying ? <Pause size={ICO} /> : <Play size={ICO} />} label={cineMode ? "停止播放" : "图像播放"} active={cineMode} onClick={() => select("cine")} />
          <ToolBtn id="wavy" icon={<Waves size={ICO} />} label="动态调节" active={isActive("wavy")} onClick={() => select("wavy")} />
          <div className="relative">
            <ToolBtn id="colormap" icon={<Palette size={ICO} />} label="伪彩" hasDropdown active={submenu === "colormap"} onClick={() => toggleSub("colormap")} />
            {submenu === "colormap" && <ColormapSubmenu onClose={() => setSubmenu(null)} />}
          </div>
          <ToolBtn id="center" icon={<IcoCenter />} label="自定义中心" active={isActive("center")} onClick={() => select("center")} />
          <ToolBtn id="histogram" icon={<BarChart3 size={ICO} />} label="直方图" active={isActive("histogram")} onClick={() => select("histogram")} />
          <ToolBtn id="closed-path" icon={<IcoClosedPath />} label="曲线闭合路径" active={isActive("closed-path")} onClick={() => select("closed-path")} />
          <ToolBtn id="delete-roi" icon={<Trash2 size={ICO} />} label="删除标注" active={isActive("delete-roi")} onClick={() => select("delete-roi")} />
        </ToolRow>
        <ToolRow>
          <ToolBtn id="dicom-tags" icon={<FileText size={ICO} />} label="DICOM Tags" active={isActive("dicom-tags")} onClick={() => select("dicom-tags")} />
        </ToolRow>

        {/* ──────────────── MODULE 3: 基础操作与测量 ──────────────── */}
        <SectionTitle>操作与测量</SectionTitle>
        <ToolRow>
          <ToolBtn id="pointer" icon={<MousePointer2 size={ICO} />} label="选择" active={isActive("pointer")} onClick={() => select("pointer")} />
          <ToolBtn id="pan" icon={<Move size={ICO} />} label="平移" active={isActive("pan")} onClick={() => select("pan")} />
          <ToolBtn id="zoom" icon={<ZoomIn size={ICO} />} label="缩放" active={isActive("zoom")} onClick={() => select("zoom")} />
          <ToolBtn id="preset-zoom" icon={<IcoPresetZoom />} label="预设缩放" active={isActive("preset-zoom")} onClick={() => select("preset-zoom")} />
          <ToolBtn id="actual-size" icon={<IcoActualSize />} label="1:1 显示" active={isActive("actual-size")} onClick={() => select("actual-size")} />
          <ToolBtn id="magnifier" icon={<Search size={ICO} />} label="放大镜" active={isActive("magnifier")} onClick={() => select("magnifier")} />
          <ToolBtn id="window-zoom" icon={<IcoWindowZoom />} label="区域放大" active={isActive("window-zoom")} onClick={() => select("window-zoom")} />
        </ToolRow>
        <ToolRow>
          <div className="relative">
            <ToolBtn ref={wlBtnRef} id="wl" icon={<SlidersHorizontal size={ICO} />} label="窗宽窗位" hasDropdown active={submenu === "wl-preset"} onClick={() => toggleSub("wl-preset")} />
            {submenu === "wl-preset" && (
              <WindowPresetSubmenu
                currentId={windowPresetId}
                currentWW={activeViewportWW}
                currentWL={activeViewportWL}
                onSelect={onSelectWindowPreset}
                onApplyCustomWindowPreset={onApplyCustomWindowPreset}
                onClose={() => setSubmenu(null)}
                anchorEl={wlBtnRef.current}
              />
            )}
          </div>
          <ToolBtn id="invert" icon={<InvertIcon size={ICO} />} label="反色" active={isActive("invert")} onClick={() => select("invert")} />
          <ToolBtn id="brightness" icon={<IcoBrightness />} label="亮度" active={isActive("brightness")} onClick={() => select("brightness")} />
          <ToolBtn id="contrast" icon={<Contrast size={ICO} />} label="对比度" active={isActive("contrast")} onClick={() => select("contrast")} />
          <ToolBtn id="gamma" icon={<IcoGamma />} label="伽马校正" active={isActive("gamma")} onClick={() => select("gamma")} />
          <ToolBtn id="flip-h" icon={<FlipHorizontal size={ICO} />} label="水平镜像" active={isActive("flip-h")} onClick={() => select("flip-h")} />
          <ToolBtn id="flip-v" icon={<FlipVertical size={ICO} />} label="垂直镜像" active={isActive("flip-v")} onClick={() => select("flip-v")} />
        </ToolRow>
        <ToolRow>
          <ToolBtn id="reset" icon={<RefreshCcw size={ICO} />} label="重置影像" active={isActive("reset")} onClick={() => select("reset")} />
          <ToolBtn id="rotate-ccw" icon={<RotateCcw size={ICO} />} label="向左旋转 90°" onClick={() => select("rotate-ccw")} />
          <ToolBtn id="rotate-cw" icon={<RotateCw size={ICO} />} label="向右旋转 90°" onClick={() => select("rotate-cw")} />
          <ToolBtn id="probe" icon={<ProbeIcon size={ICO} />} label="像素探测器" active={isActive("probe")} onClick={() => select("probe")} />
          <ToolBtn id="length" icon={<Ruler size={ICO} />} label="长度测量" active={isActive("length")} onClick={() => select("length")} />
          <ToolBtn id="angle" icon={<Triangle size={ICO} />} label="角度测量" active={isActive("angle")} onClick={() => select("angle")} />
          <ToolBtn id="ellipse-roi" icon={<Circle size={ICO} />} label="椭圆 ROI" active={isActive("ellipse-roi")} onClick={() => select("ellipse-roi")} />
        </ToolRow>
        <ToolRow>
          <ToolBtn id="rect-roi" icon={<Square size={ICO} />} label="矩形 ROI" active={isActive("rect-roi")} onClick={() => select("rect-roi")} />
          <ToolBtn id="arrow-text" icon={<Type size={ICO} />} label="文字/箭头标注" active={isActive("arrow-text")} onClick={() => select("arrow-text")} />
          <ToolBtn id="clear-all" icon={<Eraser size={ICO} />} label="清除所有标注" onClick={() => select("clear-all")} />
        </ToolRow>

      </div>
    </RadixTooltip.Provider>
  );
}
