/** 每个序列对应 public 下的 .dcm 路径（可多个组成 stack） */
export type HdSeriesConfig = {
  id: string;
  label: string;
  /** DICOM Modality，如 CT / CR / MR（由 manifest 脚本读取，可选） */
  modality?: string;
  /** 相对 public，序列缩略图（如 x-ray000_pngs/preview.png，由 manifest 脚本写入） */
  thumbnailPath?: string;
  /** 相对 public，如 ct/chest/slice001.dcm（本地序列可为空，改用 imageIds） */
  dcmPaths: string[];
  /**
   * 直接使用的 Cornerstone imageId 列表（如 wadouri:https… 或 dicomfile:N）。
   * 本地拖拽/上传时由 dicom-image-loader fileManager 生成。
   */
  imageIds?: string[];
  /** dicomfile: 槽位索引，移除序列时调用 fileManager.remove */
  fileManagerIndices?: number[];
  /** 用户本地上传的序列（可显示删除、不参与 manifest） */
  isLocal?: boolean;
  /** 通过「跨设备分享」从服务器加载时的会话 ID（仅用于展示，不参与 manifest） */
  shareId?: string;
};

export type DicomSeriesManifest = {
  generated?: boolean;
  series: HdSeriesConfig[];
};

/** 脚本未跑时的兜底（与旧配置兼容） */
export const HD_DICOM_SERIES_FALLBACK: HdSeriesConfig[] = [
  { id: "xr000", label: "序列1", dcmPaths: ["x-ray000/7.dcm"] },
  { id: "xr001", label: "序列2", dcmPaths: ["x-ray001/7.dcm"] },
  {
    id: "xr000-nested",
    label: "序列3",
    dcmPaths: ["x-ray000_pngs/x-ray000/7.dcm"],
  },
];

/** @deprecated 使用 `loadHdSeriesConfig()` 或 `HD_DICOM_SERIES_FALLBACK` */
export const HD_DICOM_SERIES = HD_DICOM_SERIES_FALLBACK;

export function buildWadouriImageIds(origin: string, paths: string[]): string[] {
  const base = origin.replace(/\/$/, "");
  return paths.map((p) => {
    const clean = p.replace(/^\//, "");
    const url = `${base}/${clean.split("/").map(encodeURIComponent).join("/")}`;
    return `wadouri:${url}`;
  });
}

/** 解析该序列在视口中应使用的 imageId 列表 */
export function getSeriesImageIds(
  origin: string,
  series: HdSeriesConfig,
): string[] {
  if (series.imageIds && series.imageIds.length > 0) return series.imageIds;
  if (!series.dcmPaths?.length) return [];
  if (!origin) return [];
  return buildWadouriImageIds(origin, series.dcmPaths);
}

export function seriesSliceCount(series: HdSeriesConfig): number {
  if (series.imageIds?.length) return series.imageIds.length;
  return series.dcmPaths.length;
}

/** 从 dicomfile:N 解析 fileManager 槽位 */
export function imageIdsToFileManagerIndices(imageIds: string[]): number[] {
  return imageIds
    .filter((id) => id.startsWith("dicomfile:"))
    .map((id) => parseInt(id.slice("dicomfile:".length), 10))
    .filter((n) => !Number.isNaN(n));
}

/** 优先使用 scripts/build_dicom_manifest.py 生成的 /dicom-series.json */
export async function loadHdSeriesConfig(): Promise<HdSeriesConfig[]> {
  try {
    const res = await fetch("/dicom-series.json", { cache: "no-store" });
    if (!res.ok) return HD_DICOM_SERIES_FALLBACK;
    const data = (await res.json()) as DicomSeriesManifest;
    if (Array.isArray(data.series) && data.series.length > 0) {
      return data.series;
    }
  } catch {
    /* 忽略 */
  }
  return HD_DICOM_SERIES_FALLBACK;
}
