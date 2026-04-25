import fs from "node:fs/promises";
import path from "node:path";

import type { HdShareManifest } from "@/lib/hdShareManifest";

export const HD_SHARE_MAX_FILES = 2500;
export const HD_SHARE_MAX_BYTES = 450 * 1024 * 1024;
export const HD_SHARE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const SHARE_SUBDIR = ["tmp", "hd-share"];

export function getHdShareRoot(): string {
  return path.join(process.cwd(), ...SHARE_SUBDIR);
}

export function getShareDir(shareId: string): string {
  return path.join(getHdShareRoot(), shareId);
}

export function isValidShareId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

export async function readShareManifest(
  shareId: string,
): Promise<HdShareManifest | null> {
  if (!isValidShareId(shareId)) return null;
  const dir = getShareDir(shareId);
  const p = path.join(dir, "manifest.json");
  try {
    const raw = await fs.readFile(p, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (
      !data ||
      typeof data !== "object" ||
      (data as HdShareManifest).v !== 1 ||
      typeof (data as HdShareManifest).total !== "number"
    ) {
      return null;
    }
    const m = data as HdShareManifest;
    const age = Date.now() - m.created;
    if (age > HD_SHARE_MAX_AGE_MS) {
      void fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      return null;
    }
    return m;
  } catch {
    return null;
  }
}

export async function readShareDicomFile(
  shareId: string,
  index: number,
): Promise<Buffer | null> {
  if (!isValidShareId(shareId) || !Number.isInteger(index) || index < 0) {
    return null;
  }
  const filePath = path.join(getShareDir(shareId), `${index}.dcm`);
  const resolved = path.resolve(filePath);
  const base = path.resolve(getShareDir(shareId));
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    return null;
  }
  try {
    return await fs.readFile(resolved);
  } catch {
    return null;
  }
}
