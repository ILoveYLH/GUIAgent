"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import HdDicomViewport, {
  type HdViewportState,
} from "@/components/hd/HdDicomViewport";
import CineControlBar from "@/components/hd/CineControlBar";
import type { ViewportCellConfig } from "@/lib/hdViewportConfig";
import { DEFAULT_OVERLAY } from "@/lib/hdViewportConfig";
import {
  loadDicomArrayBufferFromImageId,
  parseDicomArrayBuffer,
  type DicomOverlayInfo,
} from "@/lib/parseDicomOverlay";
import type { HdApplyWindowPreset } from "@/lib/hdWindowPresets";
import type { HdToolId } from "@/lib/hdTools";
import type { HdMeasureToolId } from "@/lib/hdMeasureTools";

export type ViewportReadyInfo = {
  engineId: string;
  viewportId: string;
};

type Props = {
  areaName: string;
  config: ViewportCellConfig;
  isActive: boolean;
  isMultiCell: boolean;
  onActivate: () => void;
  onViewportState: (s: HdViewportState) => void;
  onReady?: (info: ViewportReadyInfo) => void;
  onUnmount?: () => void;
  overlayVisible?: boolean;
  invert: boolean;
  applyWindowPreset: HdApplyWindowPreset | undefined;
  pseudoColorVtkName: string;
  activeToolId: HdToolId | null;
  mirrorFlipTick: number;
  viewerResetTick: number;
  toolEffectsResetTick: number;
  measureMode: boolean;
  activeMeasureToolId: HdMeasureToolId | null;
  cineMode: boolean;
  cinePlaying: boolean;
  cineFps: number;
  onToggleCinePlaying: () => void;
  onCineFpsChange: (fps: number) => void;
};

function ViewportCellInner({
  areaName,
  config,
  isActive,
  isMultiCell,
  onActivate,
  onViewportState,
  onReady,
  onUnmount,
  overlayVisible = true,
  invert,
  applyWindowPreset,
  pseudoColorVtkName,
  activeToolId,
  mirrorFlipTick,
  viewerResetTick,
  toolEffectsResetTick,
  measureMode,
  activeMeasureToolId,
  cineMode,
  cinePlaying,
  cineFps,
  onToggleCinePlaying,
  onCineFpsChange,
}: Props) {
  const [localMeta, setLocalMeta] = useState<DicomOverlayInfo>(
    config.dicomMeta,
  );
  const prevSeriesSigRef = useRef<string>("");
  const [hovered, setHovered] = useState(false);
  const vpInfoRef = useRef<ViewportReadyInfo | null>(null);

  useEffect(() => {
    const sig = `${config.seriesIdx}|${config.imageIds[0] ?? ""}`;
    if (sig === prevSeriesSigRef.current) return;
    prevSeriesSigRef.current = sig;
    if (config.imageIds.length === 0) {
      setLocalMeta(DEFAULT_OVERLAY);
      return;
    }
    const firstId = config.imageIds[0];
    if (!firstId) return;
    let cancelled = false;
    void loadDicomArrayBufferFromImageId(firstId)
      .then((buf) => {
        if (cancelled) return;
        if (buf) {
          setLocalMeta(parseDicomArrayBuffer(buf));
          return;
        }
        setLocalMeta(DEFAULT_OVERLAY);
      })
      .catch(() => {
        if (!cancelled) setLocalMeta(DEFAULT_OVERLAY);
      });
    return () => {
      cancelled = true;
    };
  }, [config.seriesIdx, config.imageIds]);

  useEffect(() => {
    return () => {
      onUnmount?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReady = useCallback(
    (info: ViewportReadyInfo) => {
      vpInfoRef.current = info;
      onReady?.(info);
    },
    [onReady],
  );

  const seekToFrame = useCallback((frameIndex: number) => {
    const info = vpInfoRef.current;
    if (!info) return;
    (async () => {
      try {
        const { getRenderingEngine } = await import("@cornerstonejs/core");
        const engine = getRenderingEngine(info.engineId);
        if (!engine) return;
        const vp = engine.getStackViewport(info.viewportId);
        const total = vp.getImageIds().length;
        const clamped = Math.max(0, Math.min(frameIndex, total - 1));
        vp.setImageIdIndex(clamped);
      } catch {
        /* viewport not ready */
      }
    })();
  }, []);

  const stepForward = useCallback(() => {
    const vp = config.vpState;
    if (!vp) return;
    const next = vp.sliceIndex < vp.numSlices ? vp.sliceIndex : 1;
    seekToFrame(next - 1 + 1 < vp.numSlices ? next : 0);
  }, [config.vpState, seekToFrame]);

  const stepBackward = useCallback(() => {
    const vp = config.vpState;
    if (!vp) return;
    const prev = vp.sliceIndex > 1 ? vp.sliceIndex - 2 : vp.numSlices - 1;
    seekToFrame(prev);
  }, [config.vpState, seekToFrame]);

  const goFirstFrame = useCallback(() => seekToFrame(0), [seekToFrame]);
  const goLastFrame = useCallback(() => {
    const vp = config.vpState;
    if (!vp) return;
    seekToFrame(vp.numSlices - 1);
  }, [config.vpState, seekToFrame]);

  const meta = localMeta;
  const vp = config.vpState;
  const wl =
    vp != null
      ? Math.round(vp.wl)
      : meta.windowCenter != null
        ? Math.round(meta.windowCenter)
        : 0;
  const ww =
    vp != null
      ? Math.round(vp.ww)
      : meta.windowWidth != null
        ? Math.round(meta.windowWidth)
        : 0;
  const zoom = vp?.zoom ?? 1;
  const insNum = vp != null ? `Ins Num:${vp.sliceIndex}/${vp.numSlices}` : "";
  const stackProgressPct =
    vp != null && vp.numSlices > 1
      ? ((vp.sliceIndex - 1) / Math.max(1, vp.numSlices - 1)) * 100
      : 0;

  const hasImage = config.imageIds.length > 0;
  const hasSliceBar = vp != null && vp.numSlices > 1;
  const showCineBar =
    isActive && cineMode && hovered && hasImage && (vp?.numSlices ?? 0) > 1;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onActivate();
    },
    [onActivate],
  );

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      style={{ gridArea: areaName }}
      className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-black ${
        isMultiCell ? "border border-zinc-800" : ""
      } ${isActive ? "ring-1 ring-sky-500/50" : ""}`}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hasImage ? (
        <>
          <HdDicomViewport
            imageIds={config.imageIds}
            invert={isActive ? invert : false}
            applyWindowPreset={isActive ? applyWindowPreset : undefined}
            pseudoColorVtkName={isActive ? pseudoColorVtkName : "Grayscale"}
            activeToolId={isActive ? activeToolId : null}
            mirrorFlipTick={isActive ? mirrorFlipTick : 0}
            viewerResetTick={isActive ? viewerResetTick : 0}
            toolEffectsResetTick={isActive ? toolEffectsResetTick : 0}
            measureMode={isActive ? measureMode : false}
            activeMeasureToolId={isActive ? activeMeasureToolId : null}
            cinePlaying={isActive ? cinePlaying : false}
            cineFps={cineFps}
            onState={onViewportState}
            onReady={handleReady}
          />
          {/* four-corner DICOM overlay */}
          {overlayVisible && (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between font-mono text-[12px] leading-[1.45] text-[#FFFF00]"
              style={{
                padding: hasSliceBar ? "8px 10px 36px" : "8px 10px",
                textShadow: "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
              }}
            >
              {/* ── top row ── */}
              <div className="flex justify-between gap-4">
                <div className="min-w-0 shrink">
                  <div className="truncate">{meta.patientName}</div>
                  <div>{meta.patientId}</div>
                  <div>{meta.sexAge}</div>
                </div>
                <div className="min-w-0 shrink-0 text-right">
                  <div>{meta.modality}</div>
                  <div className="truncate max-w-[220px]">{meta.institution}</div>
                  <div>{meta.studyDateTime}</div>
                </div>
              </div>

              {/* ── bottom row ── */}
              <div className="flex justify-between gap-4">
                <div className="min-w-0 shrink">
                  <div>THK:{meta.sliceThicknessMm}mm</div>
                  <div>Rows:{meta.rows || "—"} Cols:{meta.cols || "—"}</div>
                  <div>{insNum}</div>
                </div>
                <div className="min-w-0 shrink-0 text-right">
                  {meta.seriesDescription && (
                    <div className="truncate max-w-[200px] ml-auto">{meta.seriesDescription}</div>
                  )}
                  <div>Zoom:{zoom.toFixed(2)}</div>
                  <div>WL:{wl}</div>
                  <div>WW:{ww}</div>
                </div>
              </div>
            </div>
          )}
          {/* slice progress bar */}
          {!cineMode && hasSliceBar && (
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 z-[12] px-3 pb-1.5"
              aria-hidden
            >
              <div
                className="mb-1 text-center font-mono text-[12px] font-bold tabular-nums text-[#FFFF00]"
                style={{ textShadow: "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000" }}
              >
                <span className="opacity-70">层 </span>
                {vp!.sliceIndex}
                <span className="opacity-50"> / </span>
                {vp!.numSlices}
              </div>
              <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className={`absolute left-0 top-0 h-full bg-sky-400 ${
                    stackProgressPct >= 99.5 ? "rounded-full" : "rounded-l-full"
                  }`}
                  style={{ width: `${stackProgressPct}%` }}
                />
              </div>
            </div>
          )}
          {/* cine control bar */}
          <div
            className={`pointer-events-none absolute bottom-3 left-1/2 z-[15] -translate-x-1/2 transition-opacity duration-200 ${
              showCineBar ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <CineControlBar
              playing={cinePlaying}
              fps={cineFps}
              sliceIndex={vp?.sliceIndex ?? 1}
              numSlices={vp?.numSlices ?? 1}
              onTogglePlay={onToggleCinePlaying}
              onSeek={seekToFrame}
              onStepForward={stepForward}
              onStepBackward={stepBackward}
              onFirstFrame={goFirstFrame}
              onLastFrame={goLastFrame}
              onFpsChange={onCineFpsChange}
            />
          </div>
          {/* orientation markers */}
          {overlayVisible && (
            <>
              <div
                className="pointer-events-none absolute left-1/2 top-[52px] z-10 -translate-x-1/2 font-mono text-[11px] font-bold text-[#FFFF00]"
                style={{ textShadow: "1px 1px 0 #000, -1px 0 0 #000, 0 -1px 0 #000" }}
              >
                A
              </div>
              <div
                className="pointer-events-none absolute left-[10px] top-1/2 z-10 -translate-y-1/2 font-mono text-[11px] font-bold text-[#FFFF00]"
                style={{ textShadow: "1px 1px 0 #000, -1px 0 0 #000, 0 -1px 0 #000" }}
              >
                R
              </div>
            </>
          )}
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-[12px] text-zinc-700">
          {isActive ? "点击左侧序列加载影像" : "空视口"}
        </div>
      )}
    </div>
  );
}

const ViewportCell = memo(ViewportCellInner);
export default ViewportCell;
