export type SliceSequence = {
  id: string;
  label: string;
  kind: "slices";
  basePath: string;
  sliceCount: number;
  filePrefix: string;
  pad: number;
};

export type SingleImageSequence = {
  id: string;
  label: string;
  kind: "single";
  basePath: string;
  fileName: string;
};

export type FilmSequence = SliceSequence | SingleImageSequence;

/**
 * 与 public 下 *_pngs 对应；顺序与界面「序列1–4」一致（先 X 线，再两套 CT，再 X 线）
 */
export const FILM_SEQUENCES: FilmSequence[] = [
  {
    id: "xray000",
    label: "序列1",
    kind: "single",
    basePath: "/x-ray000_pngs",
    fileName: "7.jpg",
  },
  {
    id: "dicom000",
    label: "序列2",
    kind: "slices",
    basePath: "/dicom000_pngs",
    sliceCount: 89,
    filePrefix: "slices",
    pad: 3,
  },
  {
    id: "dicom001",
    label: "序列3",
    kind: "slices",
    basePath: "/dicom001_pngs",
    sliceCount: 89,
    filePrefix: "slices",
    pad: 3,
  },
  {
    id: "xray001",
    label: "序列4",
    kind: "single",
    basePath: "/x-ray001_pngs",
    fileName: "7.jpg",
  },
];

export function getFilmFrameUrl(seq: FilmSequence, sliceIndex: number): string {
  if (seq.kind === "single") {
    return `${seq.basePath}/${seq.fileName}`;
  }
  const i = Math.max(0, Math.min(seq.sliceCount - 1, sliceIndex));
  const n = String(i).padStart(seq.pad, "0");
  return `${seq.basePath}/${seq.filePrefix}${n}.png`;
}

/** 缩略图用：取中间层或唯一帧 */
export function getThumbnailUrl(seq: FilmSequence): string {
  if (seq.kind === "single") {
    return getFilmFrameUrl(seq, 0);
  }
  const mid = Math.floor(seq.sliceCount / 2);
  return getFilmFrameUrl(seq, mid);
}

export function maxSliceIndex(seq: FilmSequence): number {
  return seq.kind === "single" ? 0 : seq.sliceCount - 1;
}

export function frameCount(seq: FilmSequence): number {
  return seq.kind === "single" ? 1 : seq.sliceCount;
}
