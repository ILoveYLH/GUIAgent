import fs from "node:fs/promises";
import path from "node:path";

import * as dicomParser from "dicom-parser";

import type { HdShareManifest } from "@/lib/hdShareManifest";

export type MockStudyReport = {
  studyId: string;
  patient: {
    name: string;
    id: string;
    sex: string;
    birthDate: string;
    age: string;
  };
  exam: {
    type: string;
    modality: string;
    date: string;
    time: string;
    accessionNumber: string;
    studyDescription: string;
    seriesDescription: string;
    manufacturer: string;
    institution: string;
    imageCount: number;
  };
  findings: string;
  impression: string;
};

export type MockStudyManifest = HdShareManifest & {
  studyId: string;
  dicomUrls: string[];
  imageIds: string[];
};

type DicomMeta = {
  patientName: string;
  patientId: string;
  patientSex: string;
  patientBirthDate: string;
  patientAge: string;
  studyDate: string;
  studyTime: string;
  accessionNumber: string;
  modality: string;
  studyDescription: string;
  seriesDescription: string;
  manufacturer: string;
  institution: string;
};

type StudyFileList = {
  dir: string;
  names: string[];
  paths: string[];
};

const STUDY_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;

function str(ds: dicomParser.DataSet, tag: string): string {
  try {
    return ds.string(tag)?.trim() ?? "";
  } catch {
    return "";
  }
}

function normalizePersonName(value: string): string {
  return value.replace(/\^/g, " ").replace(/\s+/g, " ").trim();
}

function formatDicomDate(value: string): string {
  if (!/^\d{8}$/.test(value)) return value || "—";
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function formatDicomTime(value: string): string {
  const compact = value.replace(/[^\d.]/g, "");
  if (compact.length < 4) return value || "—";
  const hh = compact.slice(0, 2);
  const mm = compact.slice(2, 4);
  const ss = compact.slice(4, 6) || "00";
  return `${hh}:${mm}:${ss}`;
}

function getMockStudyRoot(): string {
  return path.join(process.cwd(), "batch_dicom_data");
}

export function isValidMockStudyId(studyId: string): boolean {
  return STUDY_ID_RE.test(studyId) && studyId.length <= 256;
}

export async function listMockStudyDicomFiles(
  studyId: string,
): Promise<StudyFileList | null> {
  if (!isValidMockStudyId(studyId)) return null;

  const root = path.resolve(getMockStudyRoot());
  const dir = path.resolve(root, studyId);
  if (!dir.startsWith(root + path.sep)) return null;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const names = entries
      .filter((entry) => entry.isFile() && /\.dcm$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, "en"));

    if (names.length === 0) return null;
    return {
      dir,
      names,
      paths: names.map((name) => path.join(dir, name)),
    };
  } catch {
    return null;
  }
}

export async function readMockStudyDicomFile(
  studyId: string,
  index: number,
): Promise<Buffer | null> {
  if (!Number.isInteger(index) || index < 0) return null;
  const list = await listMockStudyDicomFiles(studyId);
  if (!list || index >= list.paths.length) return null;
  try {
    return await fs.readFile(list.paths[index]);
  } catch {
    return null;
  }
}

function parseDicomMeta(buffer: Buffer): DicomMeta {
  const ds = dicomParser.parseDicom(new Uint8Array(buffer));
  return {
    patientName: normalizePersonName(str(ds, "x00100010")),
    patientId: str(ds, "x00100020"),
    patientSex: str(ds, "x00100040"),
    patientBirthDate: str(ds, "x00100030"),
    patientAge: str(ds, "x00101010"),
    studyDate: str(ds, "x00080020"),
    studyTime: str(ds, "x00080030"),
    accessionNumber: str(ds, "x00080050"),
    modality: str(ds, "x00080060") || "CT",
    studyDescription: str(ds, "x00081030"),
    seriesDescription: str(ds, "x0008103e"),
    manufacturer: str(ds, "x00080070"),
    institution: str(ds, "x00080080"),
  };
}

export async function getMockStudyReport(
  studyId: string,
): Promise<MockStudyReport | null> {
  const list = await listMockStudyDicomFiles(studyId);
  if (!list) return null;

  let meta: DicomMeta;
  try {
    const first = await fs.readFile(list.paths[0]);
    meta = parseDicomMeta(first);
  } catch {
    return null;
  }

  const examLabel =
    meta.studyDescription || meta.seriesDescription || `${meta.modality} 检查`;
  const imageCount = list.paths.length;

  return {
    studyId,
    patient: {
      name: meta.patientName || "匿名患者",
      id: meta.patientId || "UNKNOWN",
      sex: meta.patientSex || "—",
      birthDate: formatDicomDate(meta.patientBirthDate),
      age: meta.patientAge || "—",
    },
    exam: {
      type: "CT",
      modality: meta.modality || "CT",
      date: formatDicomDate(meta.studyDate),
      time: formatDicomTime(meta.studyTime),
      accessionNumber: meta.accessionNumber || "—",
      studyDescription: meta.studyDescription || "CT 检查",
      seriesDescription: meta.seriesDescription || "CT 序列",
      manufacturer: meta.manufacturer || "—",
      institution: meta.institution || "影像中心",
      imageCount,
    },
    findings: `${examLabel}。本次检查共载入 ${imageCount} 幅 DICOM 图像。双肺纹理显示清晰，未见明确大片实变影；纵隔结构居中，心影大小未见明显异常；胸腔内未见明确积液或气胸征象。`,
    impression:
      "胸部 CT 未见明确急性异常征象。请结合临床症状、实验室检查及既往影像对照综合判断。本报告为演示环境生成的模拟报告，不作为临床诊疗依据。",
  };
}

export async function getMockStudyManifest(
  studyId: string,
  origin: string,
): Promise<MockStudyManifest | null> {
  const list = await listMockStudyDicomFiles(studyId);
  if (!list) return null;

  let meta: DicomMeta | null = null;
  try {
    meta = parseDicomMeta(await fs.readFile(list.paths[0]));
  } catch {
    meta = null;
  }

  const cleanOrigin = origin.replace(/\/$/, "");
  const dicomUrls = list.names.map(
    (_name, index) =>
      `/api/mock-study/${encodeURIComponent(studyId)}/dicom/${index}`,
  );
  const imageIds = dicomUrls.map((url) => `wadouri:${cleanOrigin}${url}`);
  const label =
    meta?.seriesDescription ||
    meta?.studyDescription ||
    `${meta?.modality || "CT"} 序列`;

  return {
    v: 1,
    created: Date.now(),
    studyId,
    series: [
      {
        label,
        modality: meta?.modality || "CT",
        start: 0,
        len: list.names.length,
      },
    ],
    total: list.names.length,
    dicomUrls,
    imageIds,
  };
}
