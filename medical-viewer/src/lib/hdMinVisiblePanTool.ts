import { PanTool } from "@cornerstonejs/tools";

const DEFAULT_MIN_VISIBLE = 0.2;

/** 与 @cornerstonejs/core actorIsA 一致：actor 入口可能是 { actor } 或直接为 vtk 实例 */
function resolveVtkImageActor(entry: unknown) {
  if (!entry || typeof entry !== "object") return undefined;
  const o = entry as Record<string, unknown>;
  const vtk: unknown =
    typeof o.isA === "function" ? o : o.actor;
  const isA =
    vtk && typeof vtk === "object" && "isA" in vtk
      ? (vtk as { isA?: (name: string) => boolean }).isA
      : undefined;
  if (typeof isA !== "function") return undefined;
  if (!isA.call(vtk, "vtkVolume") && !isA.call(vtk, "vtkImageSlice"))
    return undefined;
  return vtk as {
    getMapper?: () => { getInputData?: () => { getBounds?: () => number[] } };
  };
}

/**
 * 平移时至少保留图像在画布投影的一定比例可见（默认宽、高各 20%）。
 */
export class HdMinVisiblePanTool extends PanTool {
  static toolName = "HdMinVisiblePan";

  /**
   * @param viewport — StackViewport
   * @param deltaPointsCanvas — 本次拖拽在画布上的位移
   */
  override _checkImageInViewport(
    viewport: {
      canvas: HTMLCanvasElement;
      worldToCanvas: (w: number[]) => number[];
      getDefaultActor: () => unknown;
      getRenderer: () => { computeVisiblePropBounds: () => number[] };
    },
    deltaPointsCanvas: number[],
  ): boolean {
    const minFrac =
      (this.configuration as { minVisibleFraction?: number }).minVisibleFraction ??
      DEFAULT_MIN_VISIBLE;

    const { canvas } = viewport;
    const ratio = window.devicePixelRatio || 1;
    const viewportLeft = 0;
    const viewportRight = canvas.width / ratio;
    const viewportTop = 0;
    const viewportBottom = canvas.height / ratio;

    let defaultEntry: unknown;
    try {
      defaultEntry = viewport.getDefaultActor();
    } catch {
      defaultEntry = undefined;
    }
    const vtkActor = resolveVtkImageActor(defaultEntry);
    let renderer: { computeVisiblePropBounds: () => number[] };
    try {
      renderer = viewport.getRenderer();
    } catch {
      return true;
    }
    let bounds: number[];
    if (vtkActor) {
      const mapper = vtkActor.getMapper?.();
      const imageData = mapper?.getInputData?.();
      bounds = imageData?.getBounds?.() ?? renderer.computeVisiblePropBounds();
    } else {
      bounds = renderer.computeVisiblePropBounds();
    }

    const [x0, y0] = viewport.worldToCanvas([
      bounds[0],
      bounds[2],
      bounds[4],
    ]);
    const [x1, y1] = viewport.worldToCanvas([
      bounds[1],
      bounds[3],
      bounds[5],
    ]);

    const imgMinX = Math.min(x0, x1);
    const imgMaxX = Math.max(x0, x1);
    const imgMinY = Math.min(y0, y1);
    const imgMaxY = Math.max(y0, y1);

    const imageW = imgMaxX - imgMinX;
    const imageH = imgMaxY - imgMinY;

    const dx = deltaPointsCanvas[0];
    const dy = deltaPointsCanvas[1];

    const nl = imgMinX + dx;
    const nr = imgMaxX + dx;
    const nt = imgMinY + dy;
    const nb = imgMaxY + dy;

    const overlapX = Math.min(nr, viewportRight) - Math.max(nl, viewportLeft);
    const overlapY = Math.min(nb, viewportBottom) - Math.max(nt, viewportTop);

    if (imageW > 0 && overlapX < minFrac * imageW) {
      return false;
    }
    if (imageH > 0 && overlapY < minFrac * imageH) {
      return false;
    }
    return true;
  }
}
