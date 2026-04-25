"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { HdViewportState } from "@/components/hd/HdDicomViewport";
import ViewportCell, {
  type ViewportReadyInfo,
} from "@/components/hd/ViewportCell";
import HdSeriesSidebarList from "@/components/hd/HdSeriesSidebarList";
import {
  type HdSeriesConfig,
  getSeriesImageIds,
  loadHdSeriesConfig,
} from "@/lib/hdDicomSeries";
import { MediaFileHandler } from "@/lib/hdMediaFileHandler";
import { releaseImportedSeriesResources } from "@/lib/hdSeriesResourceRelease";
import HdSidebarToolbar, {
  type ToolId as SidebarToolId,
  type GridLayoutId,
  type IntraSeriesGridId,
  type FilmPrintTemplateId,
} from "@/components/hd/HdSidebarToolbar";
import {
  HD_PANEL,
  parseHdPanelParam,
} from "@/lib/hdBottomNav";
import {
  fetchShareManifest,
  shareManifestToSeriesConfigs,
  uploadLocalSeriesToShare,
} from "@/lib/hdShareClient";
import {
  fetchMockStudyManifest,
  mockStudyManifestToSeriesConfigs,
} from "@/lib/mockStudyClient";
import {
  getHdPseudoColorPreset,
  type HdPseudoColorId,
} from "@/lib/hdPseudoColorPresets";
import { type HdMeasureToolId } from "@/lib/hdMeasureTools";
import { type HdToolId } from "@/lib/hdTools";
import {
  getHdWindowPreset,
  type HdApplyWindowPreset,
  type HdWindowPresetId,
} from "@/lib/hdWindowPresets";
import {
  type ViewportCellConfig,
  buildEmptyConfig,
  resizeConfigs,
} from "@/lib/hdViewportConfig";

/* ─── tiny icons ─── */

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function seriesThumbSrc(publicRelative: string): string {
  const clean = publicRelative.replace(/^\//, "");
  return `/${clean.split("/").map(encodeURIComponent).join("/")}`;
}


/* ─── layout grid options ─── */

type ViewportLayoutDef = {
  areas: string;
  columns: string;
  rows: string;
  cells: string[];
};

const VIEWPORT_LAYOUTS: Record<GridLayoutId, ViewportLayoutDef> = {
  "1x1":        { areas: '"a"',                     columns: "1fr",         rows: "1fr",           cells: ["a"] },
  "1-2_top":    { areas: '"a b" "c c"',             columns: "1fr 1fr",     rows: "1fr 1fr",       cells: ["a", "b", "c"] },
  "1-2_left":   { areas: '"a b" "a c"',             columns: "1fr 1fr",     rows: "1fr 1fr",       cells: ["a", "b", "c"] },
  "1-2_right":  { areas: '"a c" "b c"',             columns: "1fr 1fr",     rows: "1fr 1fr",       cells: ["a", "b", "c"] },
  "1-2_bottom": { areas: '"a a" "b c"',             columns: "1fr 1fr",     rows: "1fr 1fr",       cells: ["a", "b", "c"] },
  "2x1":        { areas: '"a" "b"',                 columns: "1fr",         rows: "1fr 1fr",       cells: ["a", "b"] },
  "2-1_left":   { areas: '"a b" "a c"',             columns: "2fr 1fr",     rows: "1fr 1fr",       cells: ["a", "b", "c"] },
  "1x2":        { areas: '"a b"',                   columns: "1fr 1fr",     rows: "1fr",           cells: ["a", "b"] },
  "2-1_right":  { areas: '"a c" "b c"',             columns: "1fr 2fr",     rows: "1fr 1fr",       cells: ["a", "b", "c"] },
  "2x2":        { areas: '"a b" "c d"',             columns: "1fr 1fr",     rows: "1fr 1fr",       cells: ["a", "b", "c", "d"] },
  "3-1_left":   { areas: '"a b" "a c" "a d"',       columns: "2fr 1fr",     rows: "1fr 1fr 1fr",   cells: ["a", "b", "c", "d"] },
  "1-3_bottom": { areas: '"a b c" "d d d"',         columns: "1fr 1fr 1fr", rows: "1fr 1fr",       cells: ["a", "b", "c", "d"] },
  "3-1_right":  { areas: '"a c" "b c" "d c"',       columns: "1fr 2fr",     rows: "1fr 1fr 1fr",   cells: ["a", "b", "c", "d"] },
  "1-3_top":    { areas: '"a a a" "b c d"',         columns: "1fr 1fr 1fr", rows: "1fr 1fr",       cells: ["a", "b", "c", "d"] },
  "3x3":        { areas: '"a b c" "d e f" "g h i"', columns: "1fr 1fr 1fr", rows: "1fr 1fr 1fr",   cells: ["a", "b", "c", "d", "e", "f", "g", "h", "i"] },
  "custom":     { areas: '"a"',                     columns: "1fr",         rows: "1fr",           cells: ["a"] },
};

/* ─── right sidebar tab definitions (mostly placeholder) ─── */

type RightTab = {
  id: string;
  label: string;
  icon: string;
};

const RIGHT_TABS: RightTab[] = [
  { id: "basic", label: "基本配置", icon: "⚙" },
  { id: "hanging", label: "挂片配置", icon: "▦" },
  { id: "toolbar", label: "工具栏配置", icon: "🔧" },
  { id: "corner", label: "四角信息配置", icon: "◻" },
  { id: "shortcuts", label: "快捷键", icon: "⌨" },
  { id: "presets", label: "预设窗配置", icon: "☀" },
  { id: "info", label: "信息", icon: "ℹ" },
];

/* ─── collapsible section ─── */

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 items-center justify-between bg-[#1a1f2e] px-2.5 text-[11px] font-semibold text-zinc-300 hover:bg-[#242a3a]"
      >
        <span>{title}</span>
        <span className={`text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
      </button>
      {open && <div className="flex-1 overflow-y-auto">{children}</div>}
    </div>
  );
}

/* ─── main inner page ─── */

function HdModePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shareIdFromUrl = searchParams.get("share");
  const studyIdFromUrl = searchParams.get("study");
  const panel = useMemo(
    () => parseHdPanelParam(searchParams.get("panel")),
    [searchParams],
  );

  const showViewer =
    panel === HD_PANEL.SERIES ||
    panel === HD_PANEL.WINDOW ||
    panel === HD_PANEL.TOOLS ||
    panel === HD_PANEL.MEASURE ||
    panel === HD_PANEL.RESET;

  const [seriesList, setSeriesList] = useState<HdSeriesConfig[]>([]);
  const [viewportConfigs, setViewportConfigs] = useState<ViewportCellConfig[]>([
    buildEmptyConfig(),
  ]);
  const [activeCellIdx, setActiveCellIdx] = useState(0);
  const vpReadyMapRef = useRef<Map<number, ViewportReadyInfo>>(new Map());
  const [invertDisplay, setInvertDisplay] = useState(false);
  const [windowPresetId, setWindowPresetId] = useState<HdWindowPresetId>("default");
  const [customWindowPreset, setCustomWindowPreset] = useState<{
    ww: number;
    wl: number;
  } | null>(null);
  const [pseudoColorId, setPseudoColorId] = useState<HdPseudoColorId>("grayscale");
  const [activeToolId, setActiveToolId] = useState<HdToolId | null>(null);
  const [mirrorFlipTick, setMirrorFlipTick] = useState(0);
  const [viewerResetTick, setViewerResetTick] = useState(0);
  const [toolEffectsResetTick, setToolEffectsResetTick] = useState(0);
  const [activeMeasureToolId, setActiveMeasureToolId] = useState<HdMeasureToolId | null>(null);

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [gridLayout, setGridLayout] = useState<GridLayoutId>("1x1");
  const [intraSeriesGrid, setIntraSeriesGrid] = useState<IntraSeriesGridId>("1x1");
  const [filmPrintTemplate, setFilmPrintTemplate] = useState<FilmPrintTemplateId>("3x4");
  const [activeRightTab, setActiveRightTab] = useState("basic");
  const [sidebarActiveTool, setSidebarActiveTool] = useState<SidebarToolId | null>(null);
  const [linkSync, setLinkSync] = useState(false);
  const [cineMode, setCineMode] = useState(false);
  const [cinePlaying, setCinePlaying] = useState(false);
  const [cineFps, setCineFps] = useState(24);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareOpenError, setShareOpenError] = useState<string | null>(null);
  const [mockStudyOpenError, setMockStudyOpenError] = useState<string | null>(null);
  const skipShareHydrateRef = useRef<string | null>(null);

  const handleSidebarTool = useCallback((id: SidebarToolId) => {
    if (id === "cine") {
      setCineMode((prev) => {
        const next = !prev;
        setCinePlaying(next);
        return next;
      });
      return;
    }
    if (id === "info-overlay") {
      setOverlayVisible((v) => !v);
      return;
    }
    if (id === "reset") {
      setSidebarActiveTool(null);
      setActiveToolId(null);
      setMirrorFlipTick(0);
      setWindowPresetId("default");
      setCustomWindowPreset(null);
      setInvertDisplay(false);
      setPseudoColorId("grayscale");
      setCineMode(false);
      setCinePlaying(false);
      setOverlayVisible(true);
      setViewerResetTick((n) => n + 1);
      return;
    }
    setCineMode(false);
    setCinePlaying(false);
    setSidebarActiveTool(id);
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (studyIdFromUrl) return;
    loadHdSeriesConfig().then((list) => {
      setSeriesList((prev) => {
        if (prev.length === 0) return list;
        const existing = new Set(prev.map((s) => s.id));
        return [...prev, ...list.filter((s) => !existing.has(s.id))];
      });
    });
  }, [studyIdFromUrl]);

  useEffect(() => {
    setShareOpenError(null);
    if (!shareIdFromUrl || !origin) return;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(shareIdFromUrl)) {
      setShareOpenError("链接中的分享 ID 格式无效");
      return;
    }
    if (skipShareHydrateRef.current === shareIdFromUrl) {
      skipShareHydrateRef.current = null;
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const manifest = await fetchShareManifest(shareIdFromUrl);
        if (cancelled) return;
        const extra = shareManifestToSeriesConfigs(shareIdFromUrl, manifest, origin);
        setSeriesList((prev) => {
          const prefix = `share-${shareIdFromUrl}-`;
          if (prev.some((s) => s.id.startsWith(prefix))) return prev;
          return [...extra, ...prev];
        });
      } catch (e) {
        if (!cancelled) {
          setShareOpenError(e instanceof Error ? e.message : "无法加载分享影像");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shareIdFromUrl, origin]);

  useEffect(() => {
    setMockStudyOpenError(null);
    if (!studyIdFromUrl || !origin) return;
    if (!/^(?:\d+\.)+\d+$/.test(studyIdFromUrl)) {
      setMockStudyOpenError("链接中的检查 ID 格式无效");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const manifest = await fetchMockStudyManifest(studyIdFromUrl);
        if (cancelled) return;
        const extra = mockStudyManifestToSeriesConfigs(
          studyIdFromUrl,
          manifest,
          origin,
        );
        const first = extra[0];
        if (!first) {
          throw new Error("模拟检查没有可用影像");
        }
        const firstImageIds = getSeriesImageIds(origin, first);
        if (firstImageIds.length === 0) {
          throw new Error("模拟检查没有可用影像");
        }

        setSeriesList(extra);
        setActiveCellIdx(0);
        setViewportConfigs((prev) => {
          const next = prev.length > 0 ? [...prev] : [buildEmptyConfig()];
          next[0] = {
            ...buildEmptyConfig(),
            seriesIdx: 0,
            imageIds: firstImageIds,
          };
          return next;
        });
      } catch (e) {
        if (!cancelled) {
          setMockStudyOpenError(
            e instanceof Error ? e.message : "无法加载模拟检查",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [studyIdFromUrl, origin]);

  useEffect(() => {
    if (seriesList.length === 0) return;
    setViewportConfigs((prev) => {
      if (prev[0]?.seriesIdx != null) return prev;
      const ids = getSeriesImageIds(origin, seriesList[0]);
      if (ids.length === 0) return prev;
      const next = [...prev];
      next[0] = { ...next[0], seriesIdx: 0, imageIds: ids };
      return next;
    });
  }, [seriesList, origin]);

  useEffect(() => {
    const onUnload = () => {
      void import("@cornerstonejs/dicom-image-loader").then(({ default: d }) => {
        d.wadouri.fileManager.purge();
      });
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  useEffect(() => {
    if (panel !== HD_PANEL.TOOLS) {
      setActiveToolId(null);
      setMirrorFlipTick(0);
      setToolEffectsResetTick(0);
    }
  }, [panel]);

  useEffect(() => {
    if (panel === HD_PANEL.MEASURE) {
      setActiveMeasureToolId((prev) => prev ?? "line");
    } else {
      setActiveMeasureToolId(null);
    }
  }, [panel]);

  useEffect(() => {
    if (panel !== HD_PANEL.RESET) return;
    setActiveToolId(null);
    setMirrorFlipTick(0);
    setWindowPresetId("default");
    setCustomWindowPreset(null);
    setInvertDisplay(false);
    setPseudoColorId("grayscale");
    setCineMode(false);
    setCinePlaying(false);
    setViewerResetTick((n) => n + 1);
    router.replace(`/hd?panel=${HD_PANEL.SERIES}`, { scroll: false });
  }, [panel, router]);

  const assignSeriesToCell = useCallback(
    (cellIdx: number, sIdx: number) => {
      if (seriesList.length === 0) return;
      setCineMode(false);
      setCinePlaying(false);
      const safeIdx = Math.min(sIdx, seriesList.length - 1);
      const ids = getSeriesImageIds(origin, seriesList[safeIdx]);
      if (ids.length === 0) return;
      setViewportConfigs((prev) => {
        const next = [...prev];
        if (cellIdx >= next.length) return prev;
        next[cellIdx] = {
          ...next[cellIdx],
          seriesIdx: safeIdx,
          imageIds: ids,
        };
        return next;
      });
    },
    [origin, seriesList],
  );

  const handleCreateShareLink = useCallback(async () => {
    const local = seriesList.filter(
      (s) => s.isLocal && s.fileManagerIndices && s.fileManagerIndices.length > 0,
    );
    if (local.length === 0) return;
    setShareError(null);
    setShareBusy(true);
    setShareMessage("");
    try {
      const { shareId } = await uploadLocalSeriesToShare(local, (_pct, msg) => {
        setShareMessage(msg);
      });
      const panelParam = searchParams.get("panel") ?? HD_PANEL.SERIES;
      const u = `${window.location.origin}/hd?share=${encodeURIComponent(shareId)}&panel=${encodeURIComponent(panelParam)}`;
      setShareUrl(u);
      skipShareHydrateRef.current = shareId;
      void navigator.clipboard?.writeText(u);
      router.replace(
        `/hd?share=${encodeURIComponent(shareId)}&panel=${encodeURIComponent(panelParam)}`,
        { scroll: false },
      );
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "生成分享失败");
    } finally {
      setShareBusy(false);
      setShareMessage("");
    }
  }, [seriesList, searchParams, router]);

  const handleLocalFiles = useCallback(async (files: File[]) => {
    setUploadError(null);
    setUploadBusy(true);
    setUploadMessage("正在解析本地影像…");
    try {
      const { series, errors } = await MediaFileHandler.importFiles(files, (pct, msg) => {
        setUploadMessage(msg);
      });
      if (series.length === 0) {
        setUploadError(errors.join("；") || "未能导入任何序列");
        return;
      }
      setSeriesList((prev) => [...prev, ...series]);
      if (errors.length > 0) {
        setUploadError(
          `提示：${errors.slice(0, 4).join("；")}${errors.length > 4 ? "…" : ""}`,
        );
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setUploadBusy(false);
      setUploadMessage("");
    }
  }, []);

  const removeLocalSeries = useCallback(
    (s: HdSeriesConfig) => {
      if (!s.isLocal) return;
      releaseImportedSeriesResources(s);
      setSeriesList((prevList) => {
        const idx = prevList.findIndex((x) => x.id === s.id);
        if (idx < 0) return prevList;
        const nextList = prevList.filter((x) => x.id !== s.id);
        const o = typeof window !== "undefined" ? window.location.origin : "";
        setViewportConfigs((vpPrev) =>
          vpPrev.map((cell) => {
            if (cell.seriesIdx == null) return cell;
            if (cell.seriesIdx === idx) {
              const ser = nextList[0];
              if (!ser) return buildEmptyConfig();
              return {
                ...cell,
                seriesIdx: 0,
                imageIds: getSeriesImageIds(o, ser),
              };
            }
            if (cell.seriesIdx > idx) {
              const ni = cell.seriesIdx - 1;
              const ser = nextList[ni];
              if (!ser) return buildEmptyConfig();
              return {
                ...cell,
                seriesIdx: ni,
                imageIds: getSeriesImageIds(o, ser),
              };
            }
            return cell;
          }),
        );
        setActiveCellIdx((ac) => {
          if (nextList.length === 0) return 0;
          if (ac === idx) return 0;
          if (ac > idx) return ac - 1;
          return ac;
        });
        return nextList;
      });
    },
    [],
  );

  const makeOnViewportState = useCallback(
    (cellIdx: number) => (s: HdViewportState) => {
      setViewportConfigs((prev) => {
        const next = [...prev];
        if (cellIdx >= next.length) return prev;
        if (next[cellIdx].vpState === s) return prev;
        next[cellIdx] = { ...next[cellIdx], vpState: s };
        return next;
      });
    },
    [],
  );

  const makeOnReady = useCallback(
    (cellIdx: number) => (info: ViewportReadyInfo) => {
      vpReadyMapRef.current.set(cellIdx, info);
    },
    [],
  );

  const makeOnUnmount = useCallback(
    (cellIdx: number) => () => {
      vpReadyMapRef.current.delete(cellIdx);
    },
    [],
  );

  const onSelectCompareLayout = useCallback((id: GridLayoutId) => {
    setGridLayout(id);
    setLinkSync(true);
  }, []);

  const handleSelectWindowPreset = useCallback(
    (id: HdWindowPresetId) =>
      setWindowPresetId((prev) => (prev === id ? "default" : id)),
    [],
  );

  const handleApplyCustomWindowPreset = useCallback((ww: number, wl: number) => {
    setCustomWindowPreset({ ww, wl });
    setWindowPresetId("custom");
  }, []);

  const activeConfig = viewportConfigs[activeCellIdx] ?? viewportConfigs[0];

  const shareableLocal = useMemo(
    () =>
      seriesList.some(
        (s) => s.isLocal && s.fileManagerIndices && s.fileManagerIndices.length > 0,
      ),
    [seriesList],
  );

  const applyWindowPreset = useMemo((): HdApplyWindowPreset | undefined => {
    if (windowPresetId === "default") return { mode: "dicom-default" };
    if (windowPresetId === "custom") {
      if (!customWindowPreset) return { mode: "dicom-default" };
      return {
        mode: "fixed",
        wl: customWindowPreset.wl,
        ww: customWindowPreset.ww,
      };
    }
    const p = getHdWindowPreset(windowPresetId);
    if (!p) return undefined;
    return { mode: "fixed", wl: p.wl, ww: p.ww };
  }, [customWindowPreset, windowPresetId]);

  const pseudoColorVtkName = useMemo(() => getHdPseudoColorPreset(pseudoColorId)?.vtkPresetName ?? "Grayscale", [pseudoColorId]);

  const layout = VIEWPORT_LAYOUTS[gridLayout] ?? VIEWPORT_LAYOUTS["1x1"];

  useEffect(() => {
    const cellCount = layout.cells.length;
    setViewportConfigs((prev) => resizeConfigs(prev, cellCount));
    setActiveCellIdx((prev) => Math.min(prev, cellCount - 1));
    setCineMode(false);
    setCinePlaying(false);
  }, [layout.cells.length]);

  /* ─── synchronizer for compare/link mode ─── */
  const syncIdCounterRef = useRef(0);

  useEffect(() => {
    if (!linkSync) return;

    const readyEntries = Array.from(vpReadyMapRef.current.entries());
    if (readyEntries.length < 2) return;

    const seq = ++syncIdCounterRef.current;
    type SyncHandle = {
      add(vp: { renderingEngineId: string; viewportId: string }): void;
      destroy(): void;
    };
    let zpSync: SyncHandle | null = null;
    let sliceSync: SyncHandle | null = null;
    let cancelled = false;

    (async () => {
      const { synchronizers, SynchronizerManager } = await import(
        "@cornerstonejs/tools"
      );
      if (cancelled) return;

      const zpId = `hd-zp-${seq}`;
      const slId = `hd-sl-${seq}`;

      SynchronizerManager.getSynchronizer(zpId)?.destroy();
      SynchronizerManager.getSynchronizer(slId)?.destroy();

      zpSync = synchronizers.createZoomPanSynchronizer(zpId);
      sliceSync = synchronizers.createImageSliceSynchronizer(slId);

      for (const [, info] of readyEntries) {
        const vpRef = {
          renderingEngineId: info.engineId,
          viewportId: info.viewportId,
        };
        zpSync.add(vpRef);
        sliceSync.add(vpRef);
      }
    })();

    return () => {
      cancelled = true;
      try {
        zpSync?.destroy();
      } catch {
        /* already destroyed */
      }
      try {
        sliceSync?.destroy();
      } catch {
        /* already destroyed */
      }
    };
  }, [linkSync, viewportConfigs.length]);

  /* stable callback maps keyed by cell index to avoid re-renders */
  const vpStateCbsRef = useRef<Map<number, (s: HdViewportState) => void>>(
    new Map(),
  );
  const vpReadyCbsRef = useRef<Map<number, (info: ViewportReadyInfo) => void>>(
    new Map(),
  );
  const vpUnmountCbsRef = useRef<Map<number, () => void>>(new Map());
  const vpActivateCbsRef = useRef<Map<number, () => void>>(new Map());

  function getOrCreate<T>(map: Map<number, T>, key: number, factory: () => T): T {
    let v = map.get(key);
    if (!v) {
      v = factory();
      map.set(key, v);
    }
    return v;
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#0c0f14] text-zinc-100">
      {/* ── top bar ── */}
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-white/10 bg-[#0c0f14] px-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[12px] text-zinc-400 hover:text-zinc-200" aria-label="返回首页">
            ← 返回
          </Link>
          <span className="text-[13px] font-semibold text-zinc-200">影像浏览</span>
          <span className="hidden text-[11px] text-zinc-600 sm:inline">cloud.example-hospital.cn</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLeftOpen((v) => !v)}
            className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            title={leftOpen ? "收起左栏" : "展开左栏"}
          >
            {leftOpen ? <IconChevronLeft /> : <IconChevronRight />}
          </button>
          <button
            type="button"
            onClick={() => setRightOpen((v) => !v)}
            className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            title={rightOpen ? "收起右栏" : "展开右栏"}
          >
            {rightOpen ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>
      </header>

      {/* ── body: left | center | right ── */}
      <div className="flex min-h-0 flex-1">
        {/* ── LEFT SIDEBAR ── */}
        {leftOpen && (
          <aside className="flex w-[260px] shrink-0 flex-col border-r border-white/10 bg-[#0e1118]">
            {/* series list */}
            <CollapsibleSection title="序列 / 检查" defaultOpen>
              <HdSeriesSidebarList
                seriesList={seriesList}
                activeSeriesIdx={activeConfig?.seriesIdx ?? null}
                onSelectSeries={(i) => assignSeriesToCell(activeCellIdx, i)}
                onRemoveLocalSeries={removeLocalSeries}
                onFilesChosen={handleLocalFiles}
                uploadBusy={uploadBusy}
                uploadMessage={uploadMessage}
                uploadError={uploadError}
                seriesThumbSrc={seriesThumbSrc}
                shareableLocal={shareableLocal}
                shareBusy={shareBusy}
                shareMessage={shareMessage}
                shareUrl={shareUrl}
                shareError={shareError}
                shareOpenError={shareOpenError ?? mockStudyOpenError}
                onCreateShareLink={handleCreateShareLink}
              />
            </CollapsibleSection>

            {/* full toolbar */}
            <CollapsibleSection title="工具" defaultOpen>
              <HdSidebarToolbar
                activeTool={sidebarActiveTool}
                onSelectTool={handleSidebarTool}
                cineMode={cineMode}
                cinePlaying={cinePlaying}
                overlayVisible={overlayVisible}
                gridLayout={gridLayout}
                onSelectGrid={setGridLayout}
                intraSeriesGrid={intraSeriesGrid}
                onSelectIntraSeriesGrid={setIntraSeriesGrid}
                filmPrintTemplate={filmPrintTemplate}
                onSelectFilmPrintTemplate={setFilmPrintTemplate}
                onSelectCompareLayout={onSelectCompareLayout}
                linkSync={linkSync}
                onToggleLinkSync={() => setLinkSync((v) => !v)}
                windowPresetId={windowPresetId}
                onSelectWindowPreset={handleSelectWindowPreset}
                onApplyCustomWindowPreset={handleApplyCustomWindowPreset}
                activeViewportWW={activeConfig?.vpState?.ww}
                activeViewportWL={activeConfig?.vpState?.wl}
              />
            </CollapsibleSection>
          </aside>
        )}

        {/* ── CENTER: viewport grid ── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-black">
          {showViewer ? (
            <div
              className="grid min-h-0 flex-1"
              style={{
                gridTemplateAreas: layout.areas,
                gridTemplateColumns: layout.columns,
                gridTemplateRows: layout.rows,
              }}
            >
              {layout.cells.map((areaName, i) => {
                const cfg = viewportConfigs[i] ?? buildEmptyConfig();
                const isActive = i === activeCellIdx;
                return (
                  <ViewportCell
                    key={areaName}
                    areaName={areaName}
                    config={cfg}
                    isActive={isActive}
                    isMultiCell={layout.cells.length > 1}
                    onActivate={getOrCreate(
                      vpActivateCbsRef.current,
                      i,
                      () => () => setActiveCellIdx(i),
                    )}
                    onViewportState={getOrCreate(
                      vpStateCbsRef.current,
                      i,
                      () => makeOnViewportState(i),
                    )}
                    onReady={getOrCreate(
                      vpReadyCbsRef.current,
                      i,
                      () => makeOnReady(i),
                    )}
                    onUnmount={getOrCreate(
                      vpUnmountCbsRef.current,
                      i,
                      () => makeOnUnmount(i),
                    )}
                    overlayVisible={overlayVisible}
                    invert={invertDisplay}
                    applyWindowPreset={applyWindowPreset}
                    pseudoColorVtkName={pseudoColorVtkName}
                    activeToolId={activeToolId}
                    mirrorFlipTick={mirrorFlipTick}
                    viewerResetTick={viewerResetTick}
                    toolEffectsResetTick={toolEffectsResetTick}
                    measureMode={panel === HD_PANEL.MEASURE}
                    activeMeasureToolId={activeMeasureToolId}
                    cineMode={cineMode}
                    cinePlaying={cinePlaying}
                    cineFps={cineFps}
                    onToggleCinePlaying={() => setCinePlaying((p) => !p)}
                    onCineFpsChange={setCineFps}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-zinc-600">
              请在左侧选择序列
            </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        {rightOpen && (
          <aside className="flex w-[180px] shrink-0 flex-col border-l border-white/10 bg-[#0e1118]">
            <div className="flex flex-col overflow-y-auto">
              {RIGHT_TABS.map((tab) => {
                const active = activeRightTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveRightTab(tab.id)}
                    className={`flex items-center gap-2 border-b border-white/5 px-3 py-2.5 text-left text-[12px] transition-colors ${
                      active ? "bg-[#1a1f2e] text-sky-300" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                    }`}
                  >
                    <span className="text-[13px]">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-[11px] leading-relaxed text-zinc-600">
                「{RIGHT_TABS.find((t) => t.id === activeRightTab)?.label}」功能将在后续版本中添加。
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export default function HdModePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-black text-sm text-zinc-500">
          加载中…
        </div>
      }
    >
      <HdModePageInner />
    </Suspense>
  );
}
