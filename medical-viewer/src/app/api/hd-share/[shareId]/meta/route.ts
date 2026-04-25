import { NextResponse } from "next/server";

import { isValidShareId, readShareManifest } from "@/lib/hdShareServer";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await context.params;
  if (!isValidShareId(shareId)) {
    return NextResponse.json({ error: "无效分享 ID" }, { status: 400 });
  }
  const manifest = await readShareManifest(shareId);
  if (!manifest) {
    return NextResponse.json({ error: "不存在或已过期" }, { status: 404 });
  }
  return NextResponse.json(manifest);
}
