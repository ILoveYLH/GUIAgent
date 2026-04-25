"use client";

import {
  Enums,
  RenderingEngine,
  eventTarget,
  utilities,
} from "@cornerstonejs/core";
import type { Types } from "@cornerstonejs/core";
import type { IStackViewport } from "@cornerstonejs/core/types";
import { Events as CsToolsEvents } from "@cornerstonejs/tools/enums";
import {
  AngleTool,
  AnnotationTool,
  CircleROITool,
  EraserTool,
  LengthTool,
  PlanarFreehandROITool,
  PlanarRotateTool,
  RectangleROITool,
  StackScrollTool,
  ToolGroupManager,
  addTool,
  annotation,
  Enums as ToolEnums,
} from "@cornerstonejs/tools";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  enableCpuRenderingFallback,
  ensureCornerstone,
} from "@/lib/cornerstoneBootstrap";
import {
  HD_MEASURE_CS_TOOL_NAMES,
  HD_MEASURE_TO_CS_TOOL,
  type HdMeasureToolId,
} from "@/lib/hdMeasureTools";
import type { HdToolId } from "@/lib/hdTools";
import { HdMinVisiblePanTool } from "@/lib/hdMinVisiblePanTool";
import type { HdApplyWindowPreset } from "@/lib/hdWindowPresets";

const VIEWPORT_ID_PREFIX = "HD_STACK_VIEWPORT";

/** 画布坐标下，笔迹与标注几何的「碰到」距离（略大于点选以便涂抹） */
const ERASE_CANVAS_PROXIMITY_PX = 12;

/** 消除笔模式下双击点选时略放宽，便于点到线/框 */
const ERASE_DOUBLE_CLICK_PROXIMITY_PX = 22;

/** 沿自由笔式路径在相邻 move 之间插值步长（画布像素），避免快划漏删 */
const ERASE_STROKE_SAMPLE_STEP_PX = 6;

function lerpCanvasPoint(
  a: Types.Point2,
  b: Types.Point2,
  t: number,
): Types.Point2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** 从上一采样点到当前点沿直线密集采样，等价于自由笔划过，碰到即删 */
function eraseAlongCanvasSegment(
  element: HTMLDivElement,
  from: Types.Point2,
  to: Types.Point2,
  toolGroupId: string,
  interactionType: "mouse" | "touch",
) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len < 0.5) {
    eraseAnnotationsNearCanvasPoint(
      element,
      to,
      toolGroupId,
      interactionType,
      ERASE_CANVAS_PROXIMITY_PX,
    );
    return;
  }
  const n = Math.max(1, Math.ceil(len / ERASE_STROKE_SAMPLE_STEP_PX));
  for (let i = 0; i <= n; i++) {
    const p = lerpCanvasPoint(from, to, i / n);
    eraseAnnotationsNearCanvasPoint(
      element,
      p,
      toolGroupId,
      interactionType,
      ERASE_CANVAS_PROXIMITY_PX,
    );
  }
}

/**
 * 与 @cornerstonejs/tools 的 getMouseEventPoints 一致：相对视口 element 的坐标，
 * 与 viewport.worldToCanvas、各标注 isPointNearTool 所用画布坐标系一致（勿用 canvas.width 做 DPR 缩放）。
 */
function clientXYToViewportCanvasPoint(
  element: HTMLDivElement,
  clientX: number,
  clientY: number,
): Types.Point2 {
  const rect = element.getBoundingClientRect();
  return [clientX - rect.left, clientY - rect.top];
}

function eraseAnnotationsNearCanvasPoint(
  element: HTMLDivElement,
  canvasPoint: Types.Point2,
  toolGroupId: string,
  interactionType: "mouse" | "touch",
  proximityPx: number = ERASE_CANVAS_PROXIMITY_PX,
) {
  const tg = ToolGroupManager.getToolGroup(toolGroupId);
  if (!tg) return;
  const tools = tg.getToolInstances() as Record<
    string,
    {
      isPointNearTool?: (
        el: HTMLDivElement,
        ann: unknown,
        canvas: Types.Point2,
        proximity: number,
        type: string,
      ) => boolean;
      filterInteractableAnnotationsForElement?: (
        el: HTMLDivElement,
        annotations: unknown,
      ) => unknown[] | undefined;
    }
  >;
  const toRemove: string[] = [];
  for (const toolName of Object.keys(tools)) {
    const toolInstance = tools[toolName];
    if (
      typeof toolInstance.isPointNearTool !== "function" ||
      typeof toolInstance.filterInteractableAnnotationsForElement !== "function"
    ) {
      continue;
    }
    const annotations = annotation.state.getAnnotations(toolName, element);
    const interactable =
      toolInstance.filterInteractableAnnotationsForElement(element, annotations);
    if (!interactable) continue;
    for (const ann of interactable as { annotationUID: string }[]) {
      if (
        toolInstance.isPointNearTool(
          element,
          ann,
          canvasPoint,
          proximityPx,
          interactionType,
        )
      ) {
        toRemove.push(ann.annotationUID);
      }
    }
  }
  for (const uid of toRemove) {
    annotation.selection.setAnnotationSelected(uid);
    const ann = annotation.state.getAnnotation(uid);
    if (ann) {
      AnnotationTool.createAnnotationMemo(element, ann, { deleting: true });
    }
    annotation.state.removeAnnotation(uid);
  }
}

/** 当前帧图像元数据中的 WC/WW → voiRange（与 StackViewport 默认窗一致） */
function pushViewportState(vp: IStackViewport, onState?: (s: HdViewportState) => void) {
  const p = vp.getProperties();
  const idx = vp.getCurrentImageIdIndex();
  const ids = vp.getImageIds();
  const vr = p.voiRange;
  let wl = 0;
  let ww = 0;
  if (vr) {
    const w = utilities.windowLevel.toWindowLevel(vr.lower, vr.upper);
    wl = w.windowCenter;
    ww = w.windowWidth;
  }
  onState?.({
    sliceIndex: idx + 1,
    numSlices: Math.max(1, ids.length),
    wl,
    ww,
    zoom: 1,
  });
}

function getDicomDefaultVoiRangeForViewport(
  vp: IStackViewport,
): { lower: number; upper: number } | undefined {
  try {
    const img = vp.getCornerstoneImage();
    const wwRaw = img.windowWidth;
    const wcRaw = img.windowCenter;
    const fn = img.voiLUTFunction ?? Enums.VOILUTFunctionType.LINEAR;
    const ww = Array.isArray(wwRaw) ? wwRaw[0] : wwRaw;
    const wc = Array.isArray(wcRaw) ? wcRaw[0] : wcRaw;
    if (typeof ww !== "number" || typeof wc !== "number") {
      return undefined;
    }
    return utilities.windowLevel.toLowHighRange(ww, wc, fn);
  } catch {
    return undefined;
  }
}

/**
 * GPU 路径下，首帧图像与 VTK ImageSlice 可能尚未挂到 viewport（setStack 刚返回的瞬间），
 * 此时 setProperties(colormap) 会进 setColormapGPU 并对 getDefaultActor().actor 解引用而抛错。
 * CPU 回退时 getDefaultActor 本身会抛错，但 colormap/invert 走 CPU 实现，不依赖 actor。
 */
function stackReadyForGpuAppearanceSync(vp: IStackViewport): boolean {
  try {
    const entry = vp.getDefaultActor() as { actor?: unknown } | undefined;
    return Boolean(entry?.actor);
  } catch {
    return true;
  }
}

/**
 * 应用 colormap 会重建 RGB 传输函数（视觉上为未反色），但 StackViewport.this.invert
 * 可能仍为 true。若再 setInvert(false)，会按「关反色」去 toggle，反而把画面翻成反色，
 * 且第二次 setInvert(false) 不再 toggle，导致无法取消反色。
 * 故在 colormap 之后先把内部 invert 对齐为 false，再一次设为目标值。
 */
function syncColormapAndInvert(
  vp: IStackViewport,
  vtkName: string,
  invert: boolean,
) {
  if (!stackReadyForGpuAppearanceSync(vp)) {
    return;
  }
  vp.setProperties({ colormap: { name: vtkName } });
  const vpSync = vp as unknown as { invert: boolean };
  vpSync.invert = false;
  vp.setProperties({ invert });
}

export type HdViewportState = {
  sliceIndex: number;
  numSlices: number;
  wl: number;
  ww: number;
  zoom: number;
};

type Props = {
  imageIds: string[];
  onState?: (s: HdViewportState) => void;
  /** Fired once after the Cornerstone engine + viewport are ready. */
  onReady?: (info: { engineId: string; viewportId: string }) => void;
  /** 与 DICOM MONochrome1 反色显示对应 */
  invert?: boolean;
  /**
   * 调窗预设：通过 viewport VOI 映射显示，不修改原始体数据。
   * 未传入时（如「序列」面板）不改动当前窗宽窗位。
   */
  applyWindowPreset?: HdApplyWindowPreset | null;
  /** VTK ColorMaps 预设名，与 hdPseudoColorPresets 中 vtkPresetName 一致 */
  pseudoColorVtkName?: string;
  /** 「工具」面板当前选中项：`pan` 平移、`rotate` 自由旋转（主键拖曳） */
  activeToolId?: HdToolId | null;
  /** 递增时切换水平镜像（与 activeToolId 独立，由「水平镜像」按钮触发） */
  mirrorFlipTick?: number;
  /** 递增时重置：平移、旋转、镜像与窗宽窗位（当前帧 DICOM 默认）等 */
  viewerResetTick?: number;
  /** 「工具」栏重置：仅去掉平移/旋转/镜像等几何效果，不改窗宽窗位与伪彩 */
  toolEffectsResetTick?: number;
  /** 「测量」面板：启用标注工具时传 true */
  measureMode?: boolean;
  /** 当前选中的测量工具（与 measureMode 同时生效） */
  activeMeasureToolId?: HdMeasureToolId | null;
  /** Cine playback: when true, auto-cycle through slices along the Z-axis */
  cinePlaying?: boolean;
  /** Cine frames per second (default 24) */
  cineFps?: number;
};

export default function HdDicomViewport({
  imageIds,
  onState,
  onReady,
  invert = false,
  applyWindowPreset = null,
  pseudoColorVtkName = "Grayscale",
  activeToolId = null,
  mirrorFlipTick = 0,
  viewerResetTick = 0,
  toolEffectsResetTick = 0,
  measureMode = false,
  activeMeasureToolId = null,
  cinePlaying = false,
  cineFps = 24,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RenderingEngine | null>(null);
  const lastMirrorFlipTickRef = useRef(0);
  const lastViewerResetTickRef = useRef(0);
  const lastToolEffectsResetTickRef = useRef(0);
  const activeToolIdRef = useRef<HdToolId | null>(activeToolId);
  activeToolIdRef.current = activeToolId;
  const measureModeRef = useRef(measureMode);
  measureModeRef.current = measureMode;
  const activeMeasureToolIdRef = useRef(activeMeasureToolId);
  activeMeasureToolIdRef.current = activeMeasureToolId;
  const invertRef = useRef(invert);
  invertRef.current = invert;
  const applyPresetRef = useRef<HdApplyWindowPreset | null>(null);
  applyPresetRef.current = applyWindowPreset ?? null;
  const pseudoColorRef = useRef(pseudoColorVtkName);
  pseudoColorRef.current = pseudoColorVtkName;
  const roRef = useRef<ResizeObserver | null>(null);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const uid = useId().replace(/:/g, "");
  const engineId = `hd-re-${uid}`;
  const viewportId = `${VIEWPORT_ID_PREFIX}-${uid}`;
  const toolGroupId = `hd-tg-${uid}`;
  const [error, setError] = useState<string | null>(null);
  const [viewportReady, setViewportReady] = useState(false);

  const imageKey = imageIds.join("|");

  const applyAllToolBindings = useCallback(() => {
    const tg = ToolGroupManager.getToolGroup(toolGroupId);
    if (!tg || !tg.hasTool(StackScrollTool.toolName)) {
      return;
    }
    const wheelOnly = [
      { mouseButton: ToolEnums.MouseBindings.Wheel },
    ] as const;
    const wheelAndPrimary = [
      { mouseButton: ToolEnums.MouseBindings.Wheel },
      { mouseButton: ToolEnums.MouseBindings.Primary },
    ] as const;

    for (const name of HD_MEASURE_CS_TOOL_NAMES) {
      tg.setToolPassive(name, { removeAllBindings: true });
    }

    if (measureModeRef.current) {
      tg.setToolPassive(PlanarRotateTool.toolName, { removeAllBindings: true });
      tg.setToolPassive(HdMinVisiblePanTool.toolName, {
        removeAllBindings: true,
      });
      tg.setToolPassive(StackScrollTool.toolName, { removeAllBindings: true });

      const mid = activeMeasureToolIdRef.current;
      if (mid) {
        if (mid === "eraser") {
          tg.setToolActive(StackScrollTool.toolName, {
            bindings: [...wheelOnly],
          });
          return;
        }
        const csName = HD_MEASURE_TO_CS_TOOL[mid];
        tg.setToolActive(csName, {
          bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
        });
        tg.setToolActive(StackScrollTool.toolName, { bindings: [...wheelOnly] });
      } else {
        tg.setToolActive(StackScrollTool.toolName, {
          bindings: [...wheelAndPrimary],
        });
      }
      return;
    }

    const mode = activeToolIdRef.current;
    if (mode === "pan") {
      tg.setToolPassive(PlanarRotateTool.toolName, { removeAllBindings: true });
      tg.setToolPassive(StackScrollTool.toolName, { removeAllBindings: true });
      tg.setToolPassive(HdMinVisiblePanTool.toolName, { removeAllBindings: true });
      tg.setToolActive(HdMinVisiblePanTool.toolName, {
        bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
      });
      tg.setToolActive(StackScrollTool.toolName, { bindings: [...wheelOnly] });
    } else if (mode === "rotate") {
      tg.setToolPassive(HdMinVisiblePanTool.toolName, { removeAllBindings: true });
      tg.setToolPassive(StackScrollTool.toolName, { removeAllBindings: true });
      tg.setToolPassive(PlanarRotateTool.toolName, { removeAllBindings: true });
      tg.setToolActive(PlanarRotateTool.toolName, {
        bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
      });
      tg.setToolActive(StackScrollTool.toolName, { bindings: [...wheelOnly] });
    } else {
      tg.setToolPassive(HdMinVisiblePanTool.toolName, { removeAllBindings: true });
      tg.setToolPassive(PlanarRotateTool.toolName, { removeAllBindings: true });
      tg.setToolPassive(StackScrollTool.toolName, { removeAllBindings: true });
      tg.setToolActive(StackScrollTool.toolName, { bindings: [...wheelAndPrimary] });
    }
  }, [toolGroupId]);

  useEffect(() => {
    if (imageIds.length === 0) return;

    let cancelled = false;

    const pushState = (vp: IStackViewport) => {
      pushViewportState(vp, onStateRef.current);
    };

    const onStackImage = (evt: Event) => {
      const detail = (evt as CustomEvent).detail;
      if (detail?.viewportId !== viewportId) return;
      const re = engineRef.current;
      if (!re) return;
      const vp = re.getStackViewport(viewportId);
      const preset = applyPresetRef.current;
      const vtkName = pseudoColorRef.current || "Grayscale";
      if (preset?.mode === "fixed") {
        const range = utilities.windowLevel.toLowHighRange(
          preset.ww,
          preset.wl,
          Enums.VOILUTFunctionType.LINEAR,
        );
        vp.setProperties({ voiRange: range });
      } else if (preset?.mode === "dicom-default") {
        const range = getDicomDefaultVoiRangeForViewport(vp);
        if (range) {
          vp.setProperties({ voiRange: range });
        }
      }
      syncColormapAndInvert(vp, vtkName, invertRef.current);
      re.render();
      pushState(vp);
    };

    const onVoi = (evt: Event) => {
      const detail = (evt as CustomEvent).detail;
      if (detail?.viewportId !== viewportId) return;
      const re = engineRef.current;
      if (!re) return;
      pushState(re.getStackViewport(viewportId));
    };

    const onLoadFailed = (evt: Event) => {
      const detail = (evt as CustomEvent).detail;
      const msg =
        typeof detail?.error === "string"
          ? detail.error
          : detail?.error?.message ?? "图像加载失败";
      setError(msg);
    };

    (async () => {
      setError(null);
      try {
        await ensureCornerstone();
        if (cancelled) return;

        const el = containerRef.current;
        if (!el) {
          setError("视口未就绪，请刷新页面");
          return;
        }

        const renderingEngine = new RenderingEngine(engineId);
        engineRef.current = renderingEngine;

        renderingEngine.enableElement({
          viewportId,
          type: Enums.ViewportType.STACK,
          element: el,
          defaultOptions: {
            background: [0, 0, 0] as [number, number, number],
          },
        });

        const vp = renderingEngine.getStackViewport(viewportId);

        try {
          await vp.setStack(imageIds, 0);
        } catch (e) {
          enableCpuRenderingFallback();
          await vp.setStack(imageIds, 0);
        }

        addTool(StackScrollTool);
        addTool(HdMinVisiblePanTool);
        addTool(PlanarRotateTool);
        addTool(LengthTool);
        addTool(AngleTool);
        addTool(RectangleROITool);
        addTool(CircleROITool);
        addTool(PlanarFreehandROITool);
        addTool(EraserTool);
        const tg = ToolGroupManager.createToolGroup(toolGroupId);
        if (tg) {
          tg.addViewport(viewportId, engineId);
          tg.addTool(PlanarRotateTool.toolName);
          tg.addTool(HdMinVisiblePanTool.toolName, {
            configuration: {
              limitToViewport: true,
              minVisibleFraction: 0.2,
            },
          });
          tg.addTool(StackScrollTool.toolName);
          tg.addTool(LengthTool.toolName);
          tg.addTool(AngleTool.toolName);
          tg.addTool(RectangleROITool.toolName);
          tg.addTool(CircleROITool.toolName);
          tg.addTool(PlanarFreehandROITool.toolName);
          tg.addTool(EraserTool.toolName);
          tg.setToolActive(StackScrollTool.toolName, {
            bindings: [
              { mouseButton: ToolEnums.MouseBindings.Wheel },
              { mouseButton: ToolEnums.MouseBindings.Primary },
            ],
          });
        }

        vp.resetCamera();
        renderingEngine.resize();
        renderingEngine.render();
        requestAnimationFrame(() => {
          renderingEngine.resize();
          renderingEngine.render();
        });
        pushState(vp);
        syncColormapAndInvert(
          vp,
          pseudoColorRef.current || "Grayscale",
          invertRef.current,
        );

        applyAllToolBindings();
        setViewportReady(true);
        onReadyRef.current?.({ engineId, viewportId });

        // STACK_NEW_IMAGE / VOI_MODIFIED 由 StackViewport 在 this.element 上触发，不会冒泡到全局 eventTarget
        el.addEventListener(
          Enums.Events.STACK_NEW_IMAGE,
          onStackImage as EventListener,
        );
        el.addEventListener(Enums.Events.VOI_MODIFIED, onVoi as EventListener);
        eventTarget.addEventListener(
          Enums.Events.IMAGE_LOAD_FAILED,
          onLoadFailed as EventListener,
        );

        const ro = new ResizeObserver(() => {
          renderingEngine.resize();
          renderingEngine.render();
        });
        ro.observe(el);
        roRef.current = ro;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || "Cornerstone 初始化失败");
        try {
          enableCpuRenderingFallback();
        } catch {
          /* noop */
        }
      }
    })();

    return () => {
      cancelled = true;
      setViewportReady(false);
      const elCleanup = containerRef.current;
      if (elCleanup) {
        elCleanup.removeEventListener(
          Enums.Events.STACK_NEW_IMAGE,
          onStackImage as EventListener,
        );
        elCleanup.removeEventListener(
          Enums.Events.VOI_MODIFIED,
          onVoi as EventListener,
        );
      }
      eventTarget.removeEventListener(
        Enums.Events.IMAGE_LOAD_FAILED,
        onLoadFailed as EventListener,
      );
      roRef.current?.disconnect();
      roRef.current = null;
      ToolGroupManager.destroyToolGroup(toolGroupId);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [engineId, viewportId, imageKey, imageIds, toolGroupId]);

  /** 窗位只写 voiRange；反色与伪彩统一由 syncColormapAndInvert 收尾，避免 setVOI+invert 与 colormap 打架 */
  useEffect(() => {
    const re = engineRef.current;
    if (!re) return;
    const name = pseudoColorVtkName || "Grayscale";
    try {
      const vp = re.getStackViewport(viewportId);
      if (applyWindowPreset?.mode === "fixed") {
        const range = utilities.windowLevel.toLowHighRange(
          applyWindowPreset.ww,
          applyWindowPreset.wl,
          Enums.VOILUTFunctionType.LINEAR,
        );
        vp.setProperties({ voiRange: range });
      } else if (applyWindowPreset?.mode === "dicom-default") {
        const range = getDicomDefaultVoiRangeForViewport(vp);
        if (range) {
          vp.setProperties({ voiRange: range });
        }
      }
      syncColormapAndInvert(vp, name, invert);
      re.render();
    } catch {
      /* 视口尚未就绪 */
    }
  }, [applyWindowPreset, pseudoColorVtkName, invert, viewportReady]);

  useEffect(() => {
    if (!viewportReady) return;
    applyAllToolBindings();
  }, [
    activeToolId,
    measureMode,
    activeMeasureToolId,
    viewportReady,
    applyAllToolBindings,
  ]);

  /** 「消除笔」：自由笔式拖曳，笔迹扫过处碰到即删（段间插值，快划不漏） */
  useEffect(() => {
    if (!viewportReady || !measureMode || activeMeasureToolId !== "eraser") {
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    let down = false;
    let lastCanvas: Types.Point2 | null = null;

    const kind = (e: PointerEvent): "mouse" | "touch" =>
      e.pointerType === "touch" ? "touch" : "mouse";

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType !== "touch") return;
      down = true;
      lastCanvas = clientXYToViewportCanvasPoint(el, e.clientX, e.clientY);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      eraseAnnotationsNearCanvasPoint(
        el,
        lastCanvas,
        toolGroupId,
        kind(e),
        ERASE_CANVAS_PROXIMITY_PX,
      );
      engineRef.current?.render();
    };
    const onCsToolsDoubleClick = (evt: Event) => {
      const detail = (evt as CustomEvent).detail as {
        currentPoints?: { canvas: Types.Point2 };
      };
      const canvas = detail?.currentPoints?.canvas;
      if (!canvas) return;
      eraseAnnotationsNearCanvasPoint(
        el,
        canvas,
        toolGroupId,
        "mouse",
        ERASE_DOUBLE_CLICK_PROXIMITY_PX,
      );
      engineRef.current?.render();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!down || lastCanvas === null) return;
      const cur = clientXYToViewportCanvasPoint(el, e.clientX, e.clientY);
      eraseAlongCanvasSegment(
        el,
        lastCanvas,
        cur,
        toolGroupId,
        kind(e),
      );
      lastCanvas = cur;
      engineRef.current?.render();
    };
    const onPointerUp = (e: PointerEvent) => {
      down = false;
      lastCanvas = null;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener(CsToolsEvents.MOUSE_DOUBLE_CLICK, onCsToolsDoubleClick);

    return () => {
      down = false;
      lastCanvas = null;
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener(CsToolsEvents.MOUSE_DOUBLE_CLICK, onCsToolsDoubleClick);
    };
  }, [viewportReady, measureMode, activeMeasureToolId, toolGroupId]);

  /* ─── cine playback: rAF-based slice cycling ─── */
  useEffect(() => {
    if (!viewportReady || !cinePlaying || imageIds.length <= 1) return;

    const frameDuration = 1000 / Math.max(1, cineFps);
    let rafId = 0;
    let lastTime = 0;

    const tick = (now: number) => {
      if (!lastTime) {
        lastTime = now;
        rafId = requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - lastTime;
      if (elapsed >= frameDuration) {
        lastTime = now - (elapsed % frameDuration);
        const re = engineRef.current;
        if (re) {
          try {
            const vp = re.getStackViewport(viewportId);
            const total = vp.getImageIds().length;
            if (total > 1) {
              const cur = vp.getCurrentImageIdIndex();
              const next = (cur + 1) % total;
              vp.setImageIdIndex(next);
            }
          } catch {
            /* viewport not ready */
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [viewportReady, cinePlaying, cineFps, imageIds.length, viewportId]);

  useEffect(() => {
    if (!viewportReady) return;
    if (mirrorFlipTick === 0) {
      lastMirrorFlipTickRef.current = 0;
      const re = engineRef.current;
      if (re) {
        try {
          const vp = re.getStackViewport(viewportId);
          vp.setCamera({ flipHorizontal: false });
          re.render();
        } catch {
          /* 视口尚未就绪 */
        }
      }
      return;
    }
    if (mirrorFlipTick === lastMirrorFlipTickRef.current) {
      return;
    }
    lastMirrorFlipTickRef.current = mirrorFlipTick;
    const re = engineRef.current;
    if (!re) return;
    try {
      const vp = re.getStackViewport(viewportId);
      const cam = vp.getCamera();
      const fh = cam.flipHorizontal ?? false;
      vp.setCamera({ flipHorizontal: !fh });
      re.render();
    } catch {
      /* 视口尚未就绪 */
    }
  }, [mirrorFlipTick, viewportReady]);

  useEffect(() => {
    if (!viewportReady) return;
    if (viewerResetTick === 0) {
      lastViewerResetTickRef.current = 0;
      return;
    }
    if (viewerResetTick === lastViewerResetTickRef.current) {
      return;
    }
    lastViewerResetTickRef.current = viewerResetTick;
    const re = engineRef.current;
    if (!re) return;
    try {
      const vp = re.getStackViewport(viewportId);
      vp.resetCamera({
        resetPan: true,
        resetZoom: true,
        resetToCenter: true,
      });
      (
        vp as unknown as { setRotation(rotation: number): void }
      ).setRotation(0);
      const range = getDicomDefaultVoiRangeForViewport(vp);
      if (range) {
        vp.setProperties({ voiRange: range });
      }
      syncColormapAndInvert(
        vp,
        pseudoColorRef.current || "Grayscale",
        invertRef.current,
      );
      annotation.state.removeAllAnnotations();
      re.render();
      pushViewportState(vp, onStateRef.current);
    } catch {
      /* 视口尚未就绪 */
    }
  }, [viewerResetTick, viewportReady]);

  useEffect(() => {
    if (!viewportReady) return;
    if (toolEffectsResetTick === 0) {
      lastToolEffectsResetTickRef.current = 0;
      return;
    }
    if (toolEffectsResetTick === lastToolEffectsResetTickRef.current) {
      return;
    }
    lastToolEffectsResetTickRef.current = toolEffectsResetTick;
    const re = engineRef.current;
    if (!re) return;
    try {
      const vp = re.getStackViewport(viewportId);
      vp.resetCamera({
        resetPan: true,
        resetZoom: true,
        resetToCenter: true,
      });
      (
        vp as unknown as { setRotation(rotation: number): void }
      ).setRotation(0);
      re.render();
      pushViewportState(vp, onStateRef.current);
    } catch {
      /* 视口尚未就绪 */
    }
  }, [toolEffectsResetTick, viewportReady]);

  return (
    <div className="relative h-full min-h-[280px] w-full flex-1 bg-black">
      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 p-3 text-center text-[12px] text-red-300">
          <div>
            <p className="font-medium text-red-200">影像无法显示</p>
            <p className="mt-1 text-zinc-400">{error}</p>
            <p className="mt-2 text-[11px] text-zinc-500">
              {imageIds.some((id) => id.startsWith("dicomfile:")) ? (
                <>
                  当前为本地导入（dicomfile），与 public
                  目录及 manifest 脚本无关；请检查文件是否损坏、格式是否受支持。
                </>
              ) : (
                <>
                  若使用内置示例数据，请确认文件在 public 下且已运行{" "}
                  <code className="text-zinc-400">
                    python3 scripts/build_dicom_manifest.py
                  </code>
                </>
              )}
            </p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className={`absolute inset-0 z-0 min-h-[260px] w-full bg-black ${
          measureMode && activeMeasureToolId === "eraser" ? "touch-none" : ""
        }`}
      />
    </div>
  );
}
