import { setUseCPURendering } from "@cornerstonejs/core";

import { HD_PSEUDO_COLOR_PRESETS } from "./hdPseudoColorPresets";

let ready: Promise<void> | null = null;

/** 将 HD 伪彩用到的 VTK 预设注册进 Cornerstone，便于 CPU 降级路径查找 LUT */
async function registerHdPseudoColormaps(): Promise<void> {
  const [{ utilities }, vtkColorMaps] = await Promise.all([
    import("@cornerstonejs/core"),
    import("@kitware/vtk.js/Rendering/Core/ColorTransferFunction/ColorMaps"),
  ]);
  const seen = new Set<string>();
  for (const p of HD_PSEUDO_COLOR_PRESETS) {
    if (seen.has(p.vtkPresetName)) continue;
    seen.add(p.vtkPresetName);
    const preset = vtkColorMaps.default.getPresetByName(p.vtkPresetName);
    if (preset) {
      utilities.colormap.registerColormap({
        ...preset,
        ColorSpace: preset.ColorSpace ?? "RGB",
      });
    }
  }
}

/** 浏览器内只初始化一次 Cornerstone + DICOM loader */
export function ensureCornerstone(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (!ready) {
    ready = (async () => {
      const [{ init }, dicomLoader] = await Promise.all([
        import("@cornerstonejs/core"),
        import("@cornerstonejs/dicom-image-loader"),
      ]);
      init();
      await registerHdPseudoColormaps();
      const maxWorkers = Math.min(
        typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? 4 : 4,
        6,
      );
      dicomLoader.default.init({ maxWebWorkers: maxWorkers });
      const { init: initTools } = await import("@cornerstonejs/tools");
      initTools();
    })();
  }
  return ready;
}

/** WebGL 不可用时降级 CPU 渲染（需先 ensureCornerstone） */
export function enableCpuRenderingFallback(): void {
  setUseCPURendering(true);
}
