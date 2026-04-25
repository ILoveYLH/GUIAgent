import * as nifti from "nifti-reader-js";
import { NIFTI1, type NIFTI2 } from "nifti-reader-js";
import pako from "pako";
import dcmjs from "dcmjs";

type NiftiHeader = NIFTI1 | NIFTI2;

const EXPLICIT_VR_LE = "1.2.840.10008.1.2.1";

function isGzip(buf: ArrayBuffer): boolean {
  const u = new Uint8Array(buf, 0, 2);
  return u[0] === 0x1f && u[1] === 0x8b;
}

export function decompressNiftiBuffer(buf: ArrayBuffer): ArrayBuffer {
  if (isGzip(buf)) {
    const out = pako.inflate(new Uint8Array(buf));
    return out.buffer.byteLength === out.length
      ? out.buffer
      : out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  }
  return buf;
}

export function isNiftiFileName(name: string): boolean {
  const n = name.toLowerCase();
  return n.endsWith(".nii") || n.endsWith(".nii.gz") || n.endsWith(".niigz");
}

function createVolumeTypedArray(
  header: NiftiHeader,
  imageBuf: ArrayBuffer,
): Int16Array | Uint16Array | Uint8Array | Float32Array {
  const bpv = Math.max(1, header.numBitsPerVoxel / 8);
  const n = Math.floor(imageBuf.byteLength / bpv);
  const code = header.datatypeCode;
  if (code === NIFTI1.TYPE_INT16) {
    return new Int16Array(imageBuf, 0, n);
  }
  if (code === NIFTI1.TYPE_UINT16) {
    return new Uint16Array(imageBuf, 0, n);
  }
  if (code === NIFTI1.TYPE_UINT8 || code === NIFTI1.TYPE_INT8) {
    return new Uint8Array(imageBuf, 0, n);
  }
  if (code === NIFTI1.TYPE_FLOAT32) {
    return new Float32Array(imageBuf, 0, n);
  }
  if (code === NIFTI1.TYPE_FLOAT64) {
    const d = new Float64Array(imageBuf, 0, n);
    const f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = d[i]!;
    return f;
  }
  if (code === NIFTI1.TYPE_INT32) {
    const i32 = new Int32Array(imageBuf, 0, n);
    const i16 = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      const v = i32[i]!;
      i16[i] = v > 32767 ? 32767 : v < -32768 ? -32768 : v;
    }
    return i16;
  }
  throw new Error(`不支持的 NIfTI 数据类型: ${code}`);
}

type VolumeWork = {
  nx: number;
  ny: number;
  nz: number;
  nt: number;
  numSlices: number;
  volume: Int16Array | Uint16Array | Uint8Array | Float32Array;
  header: NiftiHeader;
};

function extractSlice(
  vol: VolumeWork,
  sliceIndex: number,
): Int16Array | Uint16Array | Uint8Array | Float32Array {
  const { nx, ny, nz, nt, numSlices, volume } = vol;
  if (sliceIndex < 0 || sliceIndex >= numSlices) {
    throw new Error("slice out of range");
  }
  const z = sliceIndex % nz;
  const t = Math.floor(sliceIndex / nz);
  const sliceLen = nx * ny;
  const Ctor = volume.constructor as new (l: number) => typeof volume;
  const out = new Ctor(sliceLen) as typeof volume;
  let o = 0;
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const vi = x + nx * (y + ny * (z + nz * t));
      out[o++] = volume[vi]!;
    }
  }
  return out;
}

/** NIfTI 体素 → 切片原点与 row/col 方向（RAS 世界） */
function planeFromAffine(
  header: NiftiHeader,
  sliceIndex: number,
  nz: number,
): { origin: [number, number, number]; direction: number[] } {
  const A = header.affine;
  const mul = (i: number, j: number, k: number): [number, number, number] => [
    A[0][0]! * i + A[0][1]! * j + A[0][2]! * k + A[0][3]!,
    A[1][0]! * i + A[1][1]! * j + A[1][2]! * k + A[1][3]!,
    A[2][0]! * i + A[2][1]! * j + A[2][2]! * k + A[2][3]!,
  ];
  const z = sliceIndex % Math.max(1, nz);
  const p000 = mul(0, 0, z);
  const p100 = mul(1, 0, z);
  const p010 = mul(0, 1, z);
  const sub = (
    a: [number, number, number],
    b: [number, number, number],
  ): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = (v: [number, number, number]): number[] => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const col = norm(sub(p100, p000));
  const row = norm(sub(p010, p000));
  return {
    origin: p000,
    direction: [...row, ...col],
  };
}

/** RAS → DICOM 患者坐标系（LPS）近似：翻转 X、Y */
function rasToLpsPoint(p: [number, number, number]): [number, number, number] {
  return [-p[0], -p[1], p[2]];
}

function rasToLpsDir(v: number[]): number[] {
  return [-v[0], -v[1], v[2]];
}

function formatDS6(direction: number[]): string {
  const d = direction.map((x) => {
    const v = Number.isFinite(x) ? x : 0;
    return v.toFixed(6).replace(/\.?0+$/, "") || "0";
  });
  return `${d[0]}\\${d[1]}\\${d[2]}\\${d[3]}\\${d[4]}\\${d[5]}`;
}

function formatDS3(p: [number, number, number]): string {
  return p
    .map((x) => {
      const v = Number.isFinite(x) ? x : 0;
      return v.toFixed(6).replace(/\.?0+$/, "") || "0";
    })
    .join("\\");
}

function copyTypedArrayBuffer(view: ArrayBufferView): ArrayBuffer {
  const u8 = new Uint8Array(
    view.buffer,
    view.byteOffset,
    view.byteLength,
  );
  return u8.slice().buffer;
}

function sliceMinMax(slice: Int16Array | Uint16Array | Uint8Array | Float32Array): {
  min: number;
  max: number;
} {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < slice.length; i++) {
    const v = slice[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }
  return { min, max };
}

/** 将切片统一为 16 bit 像素与 PixelRepresentation */
function sliceToInt16PixelBlock(
  slice: Int16Array | Uint16Array | Uint8Array | Float32Array,
  header: NiftiHeader,
): { pixelData: ArrayBuffer; pixelRepresentation: "0" | "1"; wc: number; ww: number } {
  const calOk =
    header.cal_max > header.cal_min &&
    Number.isFinite(header.cal_max) &&
    Number.isFinite(header.cal_min);
  let wc: number;
  let ww: number;
  if (calOk) {
    wc = (header.cal_max + header.cal_min) / 2;
    ww = Math.max(1, header.cal_max - header.cal_min);
  } else {
    const { min, max } = sliceMinMax(slice);
    wc = (min + max) / 2;
    ww = Math.max(1, max - min);
  }

  if (slice instanceof Int16Array) {
    return {
      pixelData: copyTypedArrayBuffer(slice),
      pixelRepresentation: "1",
      wc,
      ww,
    };
  }
  if (slice instanceof Uint16Array) {
    return {
      pixelData: copyTypedArrayBuffer(slice),
      pixelRepresentation: "0",
      wc,
      ww,
    };
  }
  if (slice instanceof Uint8Array) {
    const out = new Int16Array(slice.length);
    for (let i = 0; i < slice.length; i++) out[i] = slice[i]!;
    return {
      pixelData: copyTypedArrayBuffer(out),
      pixelRepresentation: "1",
      wc,
      ww,
    };
  }
  // Float32: 线性映射到 int16
  const { min, max } = sliceMinMax(slice);
  const range = max - min || 1;
  const out = new Int16Array(slice.length);
  for (let i = 0; i < slice.length; i++) {
    const t = ((slice[i]! - min) / range) * 65535 - 32768;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(t)));
  }
  return {
    pixelData: copyTypedArrayBuffer(out),
    pixelRepresentation: "1",
    wc,
    ww,
  };
}

/**
 * 将单个 NIfTI（.nii / .nii.gz）转为多张 Secondary Capture DICOM（内存中的 File）。
 * 层厚、体素间距来自 pixDims；几何来自仿射矩阵（再映射到 LPS）。
 */
export async function convertNiftiFileToDicomFiles(
  file: File,
  onProgress?: (pct: number, message: string) => void,
): Promise<File[]> {
  onProgress?.(0, "正在解压 / 解析 NIfTI…");
  const raw = await file.arrayBuffer();
  const buf = decompressNiftiBuffer(raw);
  if (!nifti.isNIFTI(buf)) {
    throw new Error(`${file.name} 不是有效的 NIfTI 文件`);
  }
  const header = nifti.readHeader(buf);
  const imageBuf = nifti.readImage(header, buf);
  const volume = createVolumeTypedArray(header, imageBuf);

  const nx = header.dims[1] || 1;
  const ny = header.dims[2] || 1;
  const nz = Math.max(1, header.dims[3] || 1);
  const nt = Math.max(1, header.dims[4] || 1);
  const numSlices = nz * nt;

  const vol: VolumeWork = { nx, ny, nz, nt, numSlices, volume, header };

  const { DicomMetaDictionary, datasetToDict } = dcmjs.data;
  const studyUID = DicomMetaDictionary.uid();
  const seriesUID = DicomMetaDictionary.uid();
  const frameOfReferenceUID = DicomMetaDictionary.uid();

  const baseName = file.name.replace(/\.(nii|gz|niigz)+$/gi, "").replace(/\.+$/g, "") || "nifti";
  const descRaw = String(header.description ?? "").replace(/\0/g, "").trim();
  const seriesDescription = descRaw || `NIfTI→DICOM · ${baseName}`;

  const dx = Math.abs(header.pixDims[1] || 1);
  const dy = Math.abs(header.pixDims[2] || 1);
  const dz = Math.abs(header.pixDims[3] || 1);
  const sliceThickness = dz > 1e-6 ? dz : 1;
  const spacingBetween = dz > 1e-6 ? dz : 1;

  const files: File[] = [];

  for (let si = 0; si < numSlices; si++) {
    onProgress?.(
      Math.round((si / Math.max(1, numSlices - 1)) * 95),
      `NIfTI → DICOM：${si + 1} / ${numSlices}`,
    );
    if (si % 16 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }

    const slice = extractSlice(vol, si);
    const { pixelData, pixelRepresentation, wc, ww } = sliceToInt16PixelBlock(
      slice,
      header,
    );

    const plane = planeFromAffine(header, si, nz);
    const ipp = rasToLpsPoint(plane.origin);
    const rowL = rasToLpsDir(plane.direction.slice(0, 3));
    const colL = rasToLpsDir(plane.direction.slice(3, 6));
    const iop = formatDS6([...rowL, ...colL]);

    const sopInstanceUID = DicomMetaDictionary.uid();

    const dataset = {
      _meta: {
        TransferSyntaxUID: { Value: [EXPLICIT_VR_LE] },
      },
      SOPClassUID: DicomMetaDictionary.sopClassUIDsByName.SecondaryCaptureImage,
      SOPInstanceUID: sopInstanceUID,
      StudyInstanceUID: studyUID,
      SeriesInstanceUID: seriesUID,
      FrameOfReferenceUID: frameOfReferenceUID,
      PatientName: "NIfTI^Converted",
      PatientID: "LOCAL_NIFTI",
      PatientSex: "O",
      StudyDate: DicomMetaDictionary.date(),
      StudyTime: DicomMetaDictionary.time(),
      Modality: "OT",
      SeriesDescription: seriesDescription.slice(0, 64),
      SeriesNumber: "1",
      InstanceNumber: String(si + 1),
      ConversionType: "WSD",
      Manufacturer: "medical-viewer-zs-web",
      ImageComments: `Converted from ${file.name} slice ${si + 1}/${numSlices}`,
      SamplesPerPixel: "1",
      PhotometricInterpretation: "MONOCHROME2",
      Rows: String(ny),
      Columns: String(nx),
      BitsAllocated: "16",
      BitsStored: "16",
      HighBit: "15",
      PixelRepresentation: pixelRepresentation,
      PixelData: pixelData,
      ImagePositionPatient: formatDS3(ipp),
      ImageOrientationPatient: iop,
      PixelSpacing: `${dy.toFixed(6)}\\${dx.toFixed(6)}`,
      SliceThickness: sliceThickness.toFixed(6),
      SpacingBetweenSlices: spacingBetween.toFixed(6),
      SliceLocation: String(ipp[2]),
      WindowCenter: String(wc),
      WindowWidth: String(ww),
    };

    const dict = datasetToDict(dataset as never);
    const outBytes = dict.write() as Uint8Array;
    const copy = new Uint8Array(outBytes.byteLength);
    copy.set(outBytes);
    const sliceName = `${baseName}_slice${String(si + 1).padStart(4, "0")}.dcm`;
    files.push(new File([copy], sliceName, { type: "application/dicom" }));
  }

  onProgress?.(100, "NIfTI 已转为 DICOM");
  return files;
}
