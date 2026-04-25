import { NextResponse } from "next/server";

import { readMockStudyDicomFile } from "@/lib/mockStudyServer";

export const runtime = "nodejs";

function parseIndex(index: string): number | null {
  if (!/^\d+(?:\.dcm)?$/i.test(index)) return null;
  const n = parseInt(index, 10);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ studyId: string; index: string }> },
) {
  const { studyId, index } = await context.params;
  const idx = parseIndex(index);
  if (idx == null) {
    return new NextResponse(null, { status: 400 });
  }

  const buf = await readMockStudyDicomFile(studyId, idx);
  if (!buf) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/dicom",
      "Cache-Control": "public, max-age=300",
    },
  });
}
