import type { HdSeriesConfig } from "@/lib/hdDicomSeries";
import type { HdShareManifest } from "@/lib/hdShareManifest";

export type MockStudyManifest = HdShareManifest & {
  studyId: string;
  dicomUrls?: string[];
  imageIds?: string[];
};

export async function fetchMockStudyManifest(
  studyId: string,
): Promise<MockStudyManifest> {
  const r = await fetch(
    `/api/mock-study/${encodeURIComponent(studyId)}/manifest`,
    { cache: "no-store" },
  );
  if (!r.ok) {
    throw new Error("模拟检查不存在或无法加载");
  }
  return r.json() as Promise<MockStudyManifest>;
}

export function mockStudyManifestToSeriesConfigs(
  studyId: string,
  manifest: MockStudyManifest,
  origin: string,
): HdSeriesConfig[] {
  const base = origin.replace(/\/$/, "");
  return manifest.series.map((seg, i) => {
    const imageIds: string[] = [];
    for (let j = 0; j < seg.len; j++) {
      const idx = seg.start + j;
      const fromManifest = manifest.imageIds?.[idx];
      if (fromManifest) {
        imageIds.push(fromManifest);
        continue;
      }
      const path = manifest.dicomUrls?.[idx];
      const url =
        path != null
          ? path.startsWith("http")
            ? path
            : `${base}${path}`
          : `${base}/api/mock-study/${encodeURIComponent(studyId)}/dicom/${idx}`;
      imageIds.push(`wadouri:${url}`);
    }
    return {
      id: `mock-study-${studyId}-${i}`,
      label: seg.label || `模拟检查 ${i + 1}`,
      modality: seg.modality ?? "CT",
      dcmPaths: [],
      imageIds,
      isLocal: false,
    };
  });
}
