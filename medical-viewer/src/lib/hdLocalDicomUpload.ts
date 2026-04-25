import * as dicomParser from "dicom-parser";
import { ensureCornerstone } from "@/lib/cornerstoneBootstrap";
import type { HdSeriesConfig } from "@/lib/hdDicomSeries";
import { imageIdsToFileManagerIndices } from "@/lib/hdDicomSeries";

const DICOM_EXT = /\.dcm$/i;

/** 允许 .dcm、无扩展名、或浏览器报告的 DICOM MIME */
export function isLikelyDicomFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (DICOM_EXT.test(name)) return true;
  const mime = (file.type || "").toLowerCase();
  if (mime.includes("dicom")) return true;
  if (!name.includes(".") && file.size > 132) return true;
  return false;
}

export function filterDicomFileList(files: Iterable<File>): File[] {
  return [...files].filter(isLikelyDicomFile);
}

type ParsedEntry = {
  file: File;
  seriesUid: string;
  /** 排序：SliceLocation > ImagePositionPatient Z > InstanceNumber */
  sortValue: number;
  seriesDescription: string;
  modality: string;
};

function str(ds: dicomParser.DataSet, tag: string): string {
  try {
    return ds.string(tag) ?? "";
  } catch {
    return "";
  }
}

function num(ds: dicomParser.DataSet, tag: string): number | null {
  try {
    const v = ds.floatString(tag);
    if (v === undefined || v === null || Number.isNaN(Number(v))) return null;
    return Number(v);
  } catch {
    return null;
  }
}

function parseEntry(file: File, buffer: ArrayBuffer): ParsedEntry | null {
  try {
    const ds = dicomParser.parseDicom(new Uint8Array(buffer));
    const seriesUid = str(ds, "x0020000e") || "default-series";
    const sliceLoc = num(ds, "x00201041");
    const ippStr = str(ds, "x00200032");
    let ippZ: number | null = null;
    if (ippStr) {
      const z = parseFloat(ippStr.split("\\")[2] ?? "");
      if (Number.isFinite(z)) ippZ = z;
    }
    const instParsed = parseInt(str(ds, "x00200013"), 10);
    let sortValue: number;
    if (sliceLoc != null && Number.isFinite(sliceLoc)) {
      sortValue = sliceLoc;
    } else if (ippZ != null) {
      sortValue = ippZ;
    } else if (Number.isFinite(instParsed)) {
      sortValue = instParsed;
    } else {
      sortValue = 0;
    }
    return {
      file,
      seriesUid,
      sortValue,
      seriesDescription: str(ds, "x0008103e").trim(),
      modality: str(ds, "x00080060") || "OT",
    };
  } catch {
    return null;
  }
}

export type LocalDicomImportResult = {
  series: HdSeriesConfig[];
  errors: string[];
};

/**
 * 将本地 File 分组为序列、排序实例、注册到 dicom-image-loader fileManager，生成 dicomfile: imageId。
 */
export async function importLocalDicomFiles(
  files: File[],
  onProgress?: (pct: number, message: string) => void,
): Promise<LocalDicomImportResult> {
  const errors: string[] = [];
  const entries: ParsedEntry[] = [];

  const list = filterDicomFileList(files);
  if (list.length === 0) {
    return {
      series: [],
      errors: ["未选择有效的 DICOM 文件（.dcm 或无扩展名）"],
    };
  }

  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    onProgress?.(
      Math.round(((i + 0.5) / list.length) * 90),
      `正在解析本地影像… (${i + 1}/${list.length})`,
    );
    try {
      const buf = await f.arrayBuffer();
      const e = parseEntry(f, buf);
      if (!e) {
        errors.push(`${f.name}：不是合法的 DICOM 文件`);
        continue;
      }
      entries.push(e);
    } catch {
      errors.push(`${f.name}：读取失败`);
    }
  }

  if (entries.length === 0) {
    return { series: [], errors };
  }

  onProgress?.(92, "正在注册影像…");
  await ensureCornerstone();
  const { default: dicomLoader } = await import(
    "@cornerstonejs/dicom-image-loader"
  );
  const fm = dicomLoader.wadouri.fileManager;

  const bySeries = new Map<string, ParsedEntry[]>();
  for (const e of entries) {
    const arr = bySeries.get(e.seriesUid) ?? [];
    arr.push(e);
    bySeries.set(e.seriesUid, arr);
  }

  const series: HdSeriesConfig[] = [];
  let groupIdx = 0;
  const ts = Date.now();

  for (const [, group] of bySeries) {
    group.sort((a, b) => a.sortValue - b.sortValue);
    const imageIds: string[] = [];
    for (const e of group) {
      imageIds.push(fm.add(e.file));
    }
    const indices = imageIdsToFileManagerIndices(imageIds);
    const first = group[0];
    const label =
      first.seriesDescription ||
      `${first.modality} · 本地${groupIdx + 1}`;

    series.push({
      id: `local-${ts}-${groupIdx}`,
      label,
      modality: first.modality,
      dcmPaths: [],
      imageIds,
      fileManagerIndices: indices,
      isLocal: true,
    });
    groupIdx++;
  }

  onProgress?.(100, "完成");
  return { series, errors };
}

export function releaseLocalSeriesFileSlots(series: HdSeriesConfig): void {
  if (!series.isLocal || !series.fileManagerIndices?.length) return;
  void import("@cornerstonejs/dicom-image-loader").then(({ default: dl }) => {
    for (const idx of series.fileManagerIndices!) {
      try {
        dl.wadouri.fileManager.remove(idx);
      } catch {
        /* ignore */
      }
    }
  });
}
