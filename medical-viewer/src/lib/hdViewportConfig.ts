import type { DicomOverlayInfo } from "@/lib/parseDicomOverlay";
import type { HdViewportState } from "@/components/hd/HdDicomViewport";

export type ViewportCellConfig = {
  seriesIdx: number | null;
  imageIds: string[];
  dicomMeta: DicomOverlayInfo;
  vpState: HdViewportState | null;
};

export const DEFAULT_OVERLAY: DicomOverlayInfo = {
  patientName: "张三",
  patientId: "ZS20267061",
  sexAge: "F 59Y",
  modality: "CT",
  manufacturer: "UIH",
  institution: "****医院",
  studyDateTime: "2024-04-23 14:38:04",
  seriesDescription: "",
  sliceThicknessMm: "3.00",
  rows: 512,
  cols: 512,
  windowCenter: null,
  windowWidth: null,
};

export function buildEmptyConfig(): ViewportCellConfig {
  return {
    seriesIdx: null,
    imageIds: [],
    dicomMeta: { ...DEFAULT_OVERLAY },
    vpState: null,
  };
}

/**
 * Ensure the configs array has exactly `count` entries.
 * Existing entries are preserved; new ones are empty; excess entries are trimmed.
 */
export function resizeConfigs(
  prev: ViewportCellConfig[],
  count: number,
): ViewportCellConfig[] {
  if (prev.length === count) return prev;
  if (prev.length > count) return prev.slice(0, count);
  const next = [...prev];
  while (next.length < count) next.push(buildEmptyConfig());
  return next;
}
