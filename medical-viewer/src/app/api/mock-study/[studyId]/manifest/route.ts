import { NextResponse } from "next/server";

import { getMockStudyManifest } from "@/lib/mockStudyServer";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ studyId: string }> },
) {
  const { studyId } = await context.params;
  const manifest = await getMockStudyManifest(studyId, new URL(request.url).origin);
  if (!manifest) {
    return NextResponse.json({ error: "study 不存在" }, { status: 404 });
  }
  return NextResponse.json(manifest, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
