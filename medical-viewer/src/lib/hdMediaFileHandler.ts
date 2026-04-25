import type { HdSeriesConfig } from "@/lib/hdDicomSeries";
import { importLocalDicomFiles, isLikelyDicomFile } from "@/lib/hdLocalDicomUpload";
import { convertNiftiFileToDicomFiles, isNiftiFileName } from "@/lib/niftiToDicomSeries";

/**
 * 根据扩展名 / MIME 将本地文件分流为 DICOM 与 NIfTI。
 */
export class MediaFileHandler {
  static partition(files: File[]): {
    dicom: File[];
    nifti: File[];
    skipped: string[];
  } {
    const dicom: File[] = [];
    const nifti: File[] = [];
    const skipped: string[] = [];
    for (const f of files) {
      if (isNiftiFileName(f.name)) {
        nifti.push(f);
        continue;
      }
      if (isLikelyDicomFile(f)) {
        dicom.push(f);
        continue;
      }
      skipped.push(f.name);
    }
    return { dicom, nifti, skipped };
  }

  /**
   * 导入一批文件：DICOM 按 SeriesInstanceUID 分组；每个 NIfTI 单独成序列。
   */
  static async importFiles(
    files: File[],
    onProgress?: (pct: number, message: string) => void,
  ): Promise<{
    series: HdSeriesConfig[];
    errors: string[];
    skipped: string[];
  }> {
    const { dicom, nifti, skipped } = MediaFileHandler.partition(files);
    const allSeries: HdSeriesConfig[] = [];
    const errors: string[] = [];

    if (skipped.length > 0) {
      errors.push(
        `已忽略非 DICOM/NIfTI：${skipped.slice(0, 5).join("、")}${skipped.length > 5 ? "…" : ""}`,
      );
    }

    if (dicom.length > 0) {
      onProgress?.(5, "正在解析 DICOM 序列…");
      const r = await importLocalDicomFiles(dicom, (pct, msg) => {
        onProgress?.(Math.min(85, 5 + Math.round(pct * 0.8)), msg);
      });
      allSeries.push(...r.series);
      errors.push(...r.errors);
    }

    for (let i = 0; i < nifti.length; i++) {
      const f = nifti[i]!;
      try {
        const slice = 14 / Math.max(1, nifti.length);
        const dcmFiles = await convertNiftiFileToDicomFiles(f, (pct, msg) => {
          onProgress?.(
            85 + Math.round(i * slice + (pct / 100) * slice),
            msg,
          );
        });
        const reg = await importLocalDicomFiles(dcmFiles, (pct, msg) => {
          onProgress?.(
            85 + Math.round((i + 0.5) * slice + (pct / 200) * slice),
            msg,
          );
        });
        allSeries.push(...reg.series);
        errors.push(...reg.errors);
      } catch (e) {
        errors.push(
          `${f.name}：${e instanceof Error ? e.message : "加载失败"}`,
        );
      }
    }

    onProgress?.(100, "完成");
    return { series: allSeries, errors, skipped };
  }
}
