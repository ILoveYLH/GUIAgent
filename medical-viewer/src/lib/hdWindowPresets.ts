/** 调窗面板：窗宽窗位预设（仅显示映射，不修改原始 DICOM 像素） */

export type HdWindowPresetId =
  | "default"
  | "brain"
  | "bone"
  | "lung"
  | "mediastinum"
  | "abdomen"
  | "pelvic"
  | "custom";

export type HdDeviceType = "CT" | "MR" | "CR";

export type HdWindowPreset = {
  id: HdWindowPresetId;
  label: string;
  labelEn: string;
  ww: number;
  wl: number;
  deviceType: HdDeviceType;
  disabled?: boolean;
};

/** 传给 HdDicomViewport 的调窗模式 */
export type HdApplyWindowPreset =
  | { mode: "dicom-default" }
  | { mode: "fixed"; wl: number; ww: number };

export const HD_WINDOW_PRESETS: readonly HdWindowPreset[] = [
  { id: "brain",       label: "颅脑",   labelEn: "Brain",      ww: 80,   wl: 35,   deviceType: "CT" },
  { id: "bone",        label: "骨窗",   labelEn: "Bone",       ww: 2600, wl: 800,  deviceType: "CT" },
  { id: "lung",        label: "肺窗",   labelEn: "Lung",       ww: 1600, wl: -600, deviceType: "CT" },
  { id: "mediastinum", label: "纵隔窗", labelEn: "Mediastinum", ww: 400,  wl: 40,   deviceType: "CT" },
  { id: "abdomen",     label: "腹窗",   labelEn: "Abdomen",    ww: 300,  wl: 40,   deviceType: "CT" },
  { id: "pelvic",      label: "盆腔",   labelEn: "Pelvic",     ww: 400,  wl: 30,   deviceType: "CT" },
];

export function getHdWindowPreset(
  id: HdWindowPresetId,
): HdWindowPreset | undefined {
  return HD_WINDOW_PRESETS.find((p) => p.id === id);
}

export function getPresetsForDevice(
  deviceType: HdDeviceType,
): HdWindowPreset[] {
  return HD_WINDOW_PRESETS.filter((p) => p.deviceType === deviceType);
}

/**
 * Find a preset that matches the given WW/WL values (within ±1 tolerance).
 * Returns the preset id or null if no match.
 */
export function matchWindowPreset(
  ww: number,
  wl: number,
  deviceType: HdDeviceType = "CT",
): HdWindowPresetId | null {
  for (const p of HD_WINDOW_PRESETS) {
    if (p.deviceType !== deviceType) continue;
    if (Math.abs(p.ww - ww) <= 1 && Math.abs(p.wl - wl) <= 1) return p.id;
  }
  return null;
}
