import type { HdSeriesConfig } from "@/lib/hdDicomSeries";
import { ensureCornerstone } from "@/lib/cornerstoneBootstrap";
import type { HdShareManifest } from "@/lib/hdShareManifest";

/**
 * 将当前页面上「本地导入」的序列（dicomfile 槽位）打包上传到服务器，得到可在其他设备打开的 shareId。
 */
export async function uploadLocalSeriesToShare(
  localSeries: HdSeriesConfig[],
  onProgress?: (pct: number, message: string) => void,
): Promise<{ shareId: string }> {
  const usable = localSeries.filter(
    (s) => s.isLocal && s.fileManagerIndices && s.fileManagerIndices.length > 0,
  );
  if (usable.length === 0) {
    throw new Error("没有可分享的本地序列（请先导入 DICOM / NIfTI）");
  }

  await ensureCornerstone();
  const { default: dl } = await import("@cornerstonejs/dicom-image-loader");
  const fm = dl.wadouri.fileManager;

  const blobs: Blob[] = [];
  const seriesSegs: HdShareManifest["series"] = [];
  let globalIdx = 0;

  for (const s of usable) {
    const indices = s.fileManagerIndices!;
    const start = globalIdx;
    for (const fileIdx of indices) {
      const blob = fm.get(fileIdx) as Blob | undefined;
      if (!blob) {
        throw new Error(`文件槽位 ${fileIdx} 已失效，请重新导入后再分享`);
      }
      blobs.push(blob);
      globalIdx++;
    }
    seriesSegs.push({
      label: s.label,
      modality: s.modality,
      start,
      len: indices.length,
    });
  }

  const manifest: HdShareManifest = {
    v: 1,
    created: Date.now(),
    series: seriesSegs,
    total: blobs.length,
  };

  const fd = new FormData();
  fd.append("manifest", JSON.stringify(manifest));
  for (let i = 0; i < blobs.length; i++) {
    onProgress?.(
      Math.round((i / Math.max(1, blobs.length)) * 90),
      `正在打包 ${i + 1} / ${blobs.length}…`,
    );
    fd.append(`f${i}`, blobs[i]!, `${i}.dcm`);
  }

  onProgress?.(92, "正在上传…");
  const res = await fetch("/api/hd-share", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `上传失败（${res.status}）`);
  }
  const data = (await res.json()) as { shareId?: string };
  if (!data.shareId) throw new Error("服务器未返回分享 ID");
  onProgress?.(100, "完成");
  return { shareId: data.shareId };
}

export async function fetchShareManifest(shareId: string): Promise<HdShareManifest> {
  const r = await fetch(`/api/hd-share/${encodeURIComponent(shareId)}/meta`, {
    cache: "no-store",
  });
  if (!r.ok) {
    throw new Error("分享已失效或不存在");
  }
  return r.json() as Promise<HdShareManifest>;
}

/** 由 manifest 生成与普通序列一致的配置（wadouri 指向本站的分享 API） */
export function shareManifestToSeriesConfigs(
  shareId: string,
  manifest: HdShareManifest,
  origin: string,
): HdSeriesConfig[] {
  return manifest.series.map((seg, i) => {
    const imageIds: string[] = [];
    for (let j = 0; j < seg.len; j++) {
      const idx = seg.start + j;
      const url = `${origin}/api/hd-share/${encodeURIComponent(shareId)}/p/${idx}.dcm`;
      imageIds.push(`wadouri:${url}`);
    }
    return {
      id: `share-${shareId}-${i}`,
      label: seg.label || `分享序列 ${i + 1}`,
      modality: seg.modality ?? "OT",
      dcmPaths: [],
      imageIds,
      isLocal: false,
      shareId,
    };
  });
}
