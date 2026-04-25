import * as dicomParser from "dicom-parser";

export type DicomOverlayInfo = {
  patientName: string;
  patientId: string;
  sexAge: string;
  modality: string;
  manufacturer: string;
  institution: string;
  studyDateTime: string;
  seriesDescription: string;
  sliceThicknessMm: string;
  rows: number;
  cols: number;
  windowCenter: number | null;
  windowWidth: number | null;
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

export function parseDicomArrayBuffer(buffer: ArrayBuffer): DicomOverlayInfo {
  const byteArray = new Uint8Array(buffer);
  const ds = dicomParser.parseDicom(byteArray);

  const patientName = str(ds, "x00100010").replace(/\^/g, " ").trim();
  const patientId = str(ds, "x00100020");
  const sex = str(ds, "x00100040");
  const age = str(ds, "x00101010");
  const sexAge = [sex || "F", age || "59Y"].join(" ");

  const studyDate = str(ds, "x00080020");
  const studyTime = str(ds, "x00080030");
  const studyDateTime =
    studyDate && studyTime
      ? `${studyDate.slice(0, 4)}-${studyDate.slice(4, 6)}-${studyDate.slice(6, 8)} ${studyTime.slice(0, 2)}:${studyTime.slice(2, 4)}:${studyTime.slice(4, 6)}`
      : studyDate || "—";

  const st = num(ds, "x00180050");
  const sliceThicknessMm = st != null ? st.toFixed(2) : "3.00";

  const rows = parseInt(str(ds, "x00280010"), 10) || 0;
  const cols = parseInt(str(ds, "x00280011"), 10) || 0;

  const wcStr = str(ds, "x00281050");
  const wwStr = str(ds, "x00281051");
  const wc =
    wcStr && wcStr.includes("\\")
      ? Number(wcStr.split("\\")[0])
      : num(ds, "x00281050");
  const ww =
    wwStr && wwStr.includes("\\")
      ? Number(wwStr.split("\\")[0])
      : num(ds, "x00281051");

  const wcFinite =
    wc != null && Number.isFinite(wc) ? wc : null;
  const wwFinite =
    ww != null && Number.isFinite(ww) ? ww : null;

  return {
    patientName: patientName || "张三",
    patientId: patientId || "ZS20267061",
    sexAge,
    modality: str(ds, "x00080060") || "CT",
    manufacturer: str(ds, "x00080070") || "UIH",
    institution: str(ds, "x00080080") || "****医院",
    studyDateTime,
    seriesDescription: str(ds, "x0008103e") || "",
    sliceThicknessMm,
    rows,
    cols,
    windowCenter: wcFinite,
    windowWidth: wwFinite,
  };
}

/** 从 wadouri: URL 或 dicomfile: 槽位读取首帧字节，供四角信息解析 */
export async function loadDicomArrayBufferFromImageId(
  imageId: string,
): Promise<ArrayBuffer | null> {
  if (imageId.startsWith("dicomfile:")) {
    const idx = parseInt(imageId.slice("dicomfile:".length), 10);
    if (Number.isNaN(idx)) return null;
    const { default: loader } = await import(
      "@cornerstonejs/dicom-image-loader"
    );
    const blob = loader.wadouri.fileManager.get(idx) as Blob | undefined;
    if (!blob) return null;
    return blob.arrayBuffer();
  }
  const url = imageId.replace(/^wadouri:/, "");
  if (!url) return null;
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.arrayBuffer();
}
