import { NextResponse } from "next/server";

import { isValidShareId, readShareDicomFile } from "@/lib/hdShareServer";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ shareId: string; index: string }> },
) {
  const { shareId, index } = await context.params;
  if (!isValidShareId(shareId)) {
    return new NextResponse(null, { status: 400 });
  }
  const idx = parseInt(index, 10);
  if (!Number.isInteger(idx) || idx < 0 || idx > 1_000_000) {
    return new NextResponse(null, { status: 400 });
  }
  const buf = await readShareDicomFile(shareId, idx);
  if (!buf) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/dicom",
      "Cache-Control": "public, max-age=120",
    },
  });
}
