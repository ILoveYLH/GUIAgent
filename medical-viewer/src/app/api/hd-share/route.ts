import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import type { HdShareManifest } from "@/lib/hdShareManifest";
import {
  getHdShareRoot,
  getShareDir,
  HD_SHARE_MAX_BYTES,
  HD_SHARE_MAX_FILES,
} from "@/lib/hdShareServer";

export const runtime = "nodejs";

function validateManifestStructure(m: HdShareManifest): boolean {
  if (m.v !== 1 || m.total < 1 || !Array.isArray(m.series) || m.series.length === 0) {
    return false;
  }
  let c = 0;
  for (const s of m.series) {
    if (s.len < 1 || s.start !== c) return false;
    c += s.len;
  }
  return c === m.total && m.total <= HD_SHARE_MAX_FILES;
}

export async function POST(request: Request) {
  await fs.mkdir(getHdShareRoot(), { recursive: true });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "请求体过大或格式错误（可尝试减少切片数量）" },
      { status: 413 },
    );
  }

  const manifestRaw = form.get("manifest");
  if (typeof manifestRaw !== "string") {
    return NextResponse.json({ error: "缺少 manifest" }, { status: 400 });
  }

  let manifest: HdShareManifest;
  try {
    manifest = JSON.parse(manifestRaw) as HdShareManifest;
  } catch {
    return NextResponse.json({ error: "manifest 不是合法 JSON" }, { status: 400 });
  }

  if (!validateManifestStructure(manifest)) {
    return NextResponse.json({ error: "manifest 与分片数量不一致" }, { status: 400 });
  }

  const shareId = randomUUID();
  const dir = getShareDir(shareId);
  await fs.mkdir(dir, { recursive: true });

  let writtenBytes = 0;
  try {
    for (let i = 0; i < manifest.total; i++) {
      const entry = form.get(`f${i}`);
      if (!(entry instanceof Blob)) {
        await fs.rm(dir, { recursive: true, force: true });
        return NextResponse.json({ error: `缺少分片 f${i}` }, { status: 400 });
      }
      const buf = Buffer.from(await entry.arrayBuffer());
      writtenBytes += buf.length;
      if (writtenBytes > HD_SHARE_MAX_BYTES) {
        await fs.rm(dir, { recursive: true, force: true });
        return NextResponse.json({ error: "总体积超过服务器限制" }, { status: 413 });
      }
      await fs.writeFile(path.join(dir, `${i}.dcm`), buf);
    }

    const stored: HdShareManifest = {
      ...manifest,
      created: Date.now(),
    };
    await fs.writeFile(
      path.join(dir, "manifest.json"),
      JSON.stringify(stored),
      "utf8",
    );
  } catch {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    return NextResponse.json({ error: "写入失败" }, { status: 500 });
  }

  return NextResponse.json({ shareId });
}
