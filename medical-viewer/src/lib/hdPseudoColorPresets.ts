/**
 * 伪彩：使用 VTK.js ColorMaps 预设名（StackViewport GPU 路径通过 getPresetByName 加载）。
 * 显示名与医学设备 LUT 名称相近处已注释说明映射关系。
 */

export type HdPseudoColorId =
  | "grayscale"
  | "rainbow"
  | "simhei"
  | "skeleton"
  | "heart"
  | "flow"
  | "geColor"
  | "grayRainbow"
  | "green";

export type HdPseudoColorPreset = {
  id: HdPseudoColorId;
  label: string;
  /** VTK ColorMaps.json 中的 Name 字段，须完全一致 */
  vtkPresetName: string;
};

export const HD_PSEUDO_COLOR_PRESETS: readonly HdPseudoColorPreset[] = [
  { id: "grayscale", label: "gray scale", vtkPresetName: "Grayscale" },
  { id: "rainbow", label: "rainbow", vtkPresetName: "rainbow" },
  /** 近似「黑体 / 高对比胶片」观感，映射为 VTK「X Ray」 */
  { id: "simhei", label: "simhei", vtkPresetName: "X Ray" },
  { id: "skeleton", label: "skeleton", vtkPresetName: "bone_Matlab" },
  { id: "heart", label: "heart", vtkPresetName: "Magma (matplotlib)" },
  { id: "flow", label: "flow", vtkPresetName: "jet" },
  /** 近似 GE 系蓝绿调 */
  { id: "geColor", label: "ge color", vtkPresetName: "erdc_blue2green_BW" },
  { id: "grayRainbow", label: "gray rainbow", vtkPresetName: "Rainbow Blended Grey" },
  { id: "green", label: "green", vtkPresetName: "Greens" },
] as const;

export function getHdPseudoColorPreset(
  id: HdPseudoColorId,
): HdPseudoColorPreset | undefined {
  return HD_PSEUDO_COLOR_PRESETS.find((p) => p.id === id);
}
