"use client";

import type { DicomOverlayInfo } from "@/lib/parseDicomOverlay";

type HdHistoryPanelProps = {
  meta: DicomOverlayInfo;
  /** null = 已确认无内容；undefined = 尚未加载完 */
  recentDiagnosis: string | null | undefined;
};

function row(label: string, value: string) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/5 py-2 last:border-0">
      <dt className="shrink-0 text-[12px] text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[12px] text-zinc-200">
        {value}
      </dd>
    </div>
  );
}

export default function HdHistoryPanel({
  meta,
  recentDiagnosis,
}: HdHistoryPanelProps) {
  return (
    <div className="flex min-h-[min(56vh,480px)] flex-1 flex-col overflow-y-auto bg-[#0a0c0f] px-3 py-3">
      <section className="mb-1">
        <h2 className="mb-2 text-[13px] font-semibold tracking-wide text-zinc-100">
          基本信息
        </h2>
        <dl className="rounded-lg border border-white/10 bg-black/30 px-3">
          {row("姓名", meta.patientName)}
          {row("患者编号", meta.patientId)}
          {row("性别 / 年龄", meta.sexAge)}
          {row("检查类型", meta.modality)}
          {row("检查机构", meta.institution)}
          {row("检查时间", meta.studyDateTime)}
        </dl>
      </section>

      <section className="mt-4">
        <h2 className="mb-2 text-[13px] font-semibold tracking-wide text-zinc-100">
          最近一次诊断
        </h2>
        {recentDiagnosis === undefined ? (
          <p className="rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-[12px] text-zinc-500">
            加载中…
          </p>
        ) : recentDiagnosis ? (
          <p className="rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-[12px] leading-relaxed text-zinc-300">
            {recentDiagnosis}
          </p>
        ) : (
          <p className="rounded-lg border border-dashed border-white/15 bg-black/20 px-3 py-3 text-[12px] text-zinc-500">
            暂无相关历史信息
          </p>
        )}
      </section>
    </div>
  );
}
