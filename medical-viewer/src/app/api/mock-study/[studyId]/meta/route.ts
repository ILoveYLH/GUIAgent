import { NextResponse } from "next/server";

import { getMockStudyReport } from "@/lib/mockStudyServer";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ studyId: string }> },
) {
  const { studyId } = await context.params;
  const report = await getMockStudyReport(studyId);
  if (!report) {
    return NextResponse.json({ error: "study 不存在" }, { status: 404 });
  }
  return NextResponse.json(report, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
