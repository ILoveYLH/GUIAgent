import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CloudFilmView, {
  type CloudFilmReportData,
} from "@/components/cloud-film/CloudFilmView";
import { getMockStudyReport } from "@/lib/mockStudyServer";

type ReportPageProps = {
  params: Promise<{ studyId: string }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "医学影像报告",
  description: "模拟医学影像报告",
};

function withSlashDate(date: string, time?: string): string {
  const normalized = date === "—" ? "" : date.replaceAll("-", "/");
  return [normalized, time && time !== "—" ? time.slice(0, 5) : ""]
    .filter(Boolean)
    .join(" ");
}

export default async function MockStudyReportPage({ params }: ReportPageProps) {
  const { studyId } = await params;
  const report = await getMockStudyReport(studyId);
  if (!report) notFound();

  const patient = report.patient;
  const exam = report.exam;
  const patientAge = patient.age === "—" ? "年龄未知" : patient.age;
  const patientMobile = `${patient.name} · ${patient.sex} · ${patientAge}`;
  const patientDesktop = `${patient.name} / ${patient.sex} / ${patientAge} / ${patient.birthDate}`;
  const examDateTime = [exam.date, exam.time !== "—" ? exam.time : ""]
    .filter(Boolean)
    .join(" ");
  const imageHref = `/hd?study=${encodeURIComponent(report.studyId)}`;
  const cloudReport: CloudFilmReportData = {
    watermarkText: `DEMO ${patient.name}`,
    patientMobile,
    patientDesktop,
    birthDate: patient.birthDate,
    imageHref,
    examTitle: exam.studyDescription || exam.seriesDescription || "CT 检查",
    examDateTime,
    hospital: exam.institution,
    modality: exam.modality,
    medicalTechNo: patient.id,
    accessionNumber: exam.accessionNumber,
    examTimeShort: withSlashDate(exam.date, exam.time),
    reviewTime: examDateTime,
    examItem: exam.studyDescription || "CT 检查",
    findings: report.findings,
    impression: report.impression,
    basicInfo: [
      { label: "申请科室", value: "影像科" },
      { label: "申请医生", value: "演示医生" },
      { label: "病人类型", value: "门诊" },
      { label: "门诊号", value: patient.id },
      { label: "床号", value: "—" },
    ],
    examInfo: [
      { label: "检查号", value: exam.accessionNumber },
      { label: "检查类型", value: exam.type },
      { label: "检查时间", value: examDateTime },
      { label: "检查医生", value: "演示医生" },
      { label: "报告时间", value: examDateTime },
      { label: "审核医生", value: "演示医生" },
      { label: "审核时间", value: examDateTime },
    ],
    showEmbeddedFilm: false,
  };

  return <CloudFilmView report={cloudReport} />;
}
