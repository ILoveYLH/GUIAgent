import type { HdSeriesConfig } from "@/lib/hdDicomSeries";
import { releaseLocalSeriesFileSlots } from "@/lib/hdLocalDicomUpload";

/** 移除本地导入序列时释放 fileManager 与 Cornerstone 图像缓存 */
export function releaseImportedSeriesResources(series: HdSeriesConfig): void {
  void import("@cornerstonejs/core").then(({ cache }) => {
    for (const id of series.imageIds ?? []) {
      try {
        cache.removeImageLoadObject(id, { force: true });
      } catch {
        /* ignore */
      }
    }
  });
  releaseLocalSeriesFileSlots(series);
}
