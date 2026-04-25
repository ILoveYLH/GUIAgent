"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import type { HdSeriesConfig } from "@/lib/hdDicomSeries";
import { seriesSliceCount } from "@/lib/hdDicomSeries";

async function readDirectoryRecursive(
  dir: FileSystemDirectoryEntry,
): Promise<File[]> {
  const files: File[] = [];
  const reader = dir.createReader();
  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
  let batch: FileSystemEntry[];
  do {
    batch = await readBatch();
    for (const entry of batch) {
      if (entry.isFile) {
        const f = await new Promise<File>((res, rej) =>
          (entry as FileSystemFileEntry).file(res, rej),
        );
        files.push(f);
      } else if (entry.isDirectory) {
        const nested = await readDirectoryRecursive(
          entry as FileSystemDirectoryEntry,
        );
        files.push(...nested);
      }
    }
  } while (batch.length > 0);
  return files;
}

async function collectFilesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  if (dt.files?.length) return [...dt.files];
  const items = dt.items;
  if (!items?.length) return [];
  const out: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (!entry) continue;
    if (entry.isFile) {
      const f = await new Promise<File>((res, rej) =>
        (entry as FileSystemFileEntry).file(res, rej),
      );
      out.push(f);
    } else if (entry.isDirectory) {
      out.push(
        ...(await readDirectoryRecursive(
          entry as FileSystemDirectoryEntry,
        )),
      );
    }
  }
  return out;
}

type Props = {
  seriesList: HdSeriesConfig[];
  activeSeriesIdx: number | null;
  onSelectSeries: (index: number) => void;
  onRemoveLocalSeries: (series: HdSeriesConfig) => void;
  onFilesChosen: (files: File[]) => void;
  uploadBusy: boolean;
  uploadMessage: string;
  uploadError: string | null;
  seriesThumbSrc: (publicRelative: string) => string;
  /** 存在可打包分享的本地导入序列 */
  shareableLocal: boolean;
  shareBusy: boolean;
  shareMessage: string;
  shareUrl: string | null;
  shareError: string | null;
  shareOpenError: string | null;
  onCreateShareLink: () => void;
};

export default function HdSeriesSidebarList({
  seriesList,
  activeSeriesIdx,
  onSelectSeries,
  onRemoveLocalSeries,
  onFilesChosen,
  uploadBusy,
  uploadMessage,
  uploadError,
  seriesThumbSrc,
  shareableLocal,
  shareBusy,
  shareMessage,
  shareUrl,
  shareError,
  shareOpenError,
  onCreateShareLink,
}: Props) {
  const inputId = useId();
  const folderInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handlePick = useCallback(() => inputRef.current?.click(), []);
  const handleFolderPick = useCallback(() => folderInputRef.current?.click(), []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files;
      if (f?.length) onFilesChosen([...f]);
      e.target.value = "";
    },
    [onFilesChosen],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (uploadBusy) return;
      const files = await collectFilesFromDataTransfer(e.dataTransfer);
      if (files.length) onFilesChosen(files);
    },
    [onFilesChosen, uploadBusy],
  );

  return (
    <div
      className={`flex flex-col gap-2 p-2 ${dragOver ? "bg-sky-500/10 ring-1 ring-sky-500/40" : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".dcm,.nii,.gz,application/dicom,application/gzip,application/octet-stream"
        multiple
        className="sr-only"
        onChange={onInputChange}
      />
      <input
        ref={folderInputRef}
        id={folderInputId}
        type="file"
        // @ts-expect-error webkitdirectory 非标准属性，用于选择 DICOM 文件夹
        webkitdirectory=""
        multiple
        className="sr-only"
        onChange={onInputChange}
      />
      <button
        type="button"
        disabled={uploadBusy}
        onClick={handlePick}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-zinc-600 bg-zinc-900/80 py-2.5 text-[12px] font-medium text-zinc-300 transition-colors hover:border-sky-500/50 hover:bg-zinc-800 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Upload size={16} className="shrink-0" />
        导入影像
      </button>
      <button
        type="button"
        disabled={uploadBusy}
        onClick={handleFolderPick}
        className="w-full rounded border border-zinc-700 bg-zinc-900/50 py-1.5 text-[10px] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
      >
        选择文件夹（DICOM 序列）
      </button>
      <p className="text-center text-[9px] leading-tight text-zinc-600">
        支持 .dcm / .nii / .nii.gz；可拖入文件或文件夹
      </p>
      <button
        type="button"
        disabled={!shareableLocal || shareBusy || uploadBusy}
        onClick={onCreateShareLink}
        className="w-full rounded-md border border-sky-800/80 bg-sky-950/40 py-2 text-[11px] font-medium text-sky-200/95 transition-colors hover:border-sky-600/60 hover:bg-sky-900/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {shareBusy ? "正在生成分享…" : "生成跨设备链接"}
      </button>
      {shareBusy && shareMessage && (
        <p className="text-center text-[9px] text-sky-300/90">{shareMessage}</p>
      )}
      {shareError && !shareBusy && (
        <p className="rounded bg-red-950/40 px-2 py-1 text-[9px] text-red-300">{shareError}</p>
      )}
      {shareOpenError && (
        <p className="rounded bg-amber-950/40 px-2 py-1 text-[9px] text-amber-200">
          {shareOpenError}
        </p>
      )}
      {shareUrl && !shareBusy && (
        <div className="rounded border border-white/10 bg-black/30 p-2">
          <p className="mb-1 text-[9px] text-zinc-500">其他设备用同一 Wi‑Fi / 能访问本服务时，打开：</p>
          <p className="break-all font-mono text-[9px] leading-snug text-emerald-300/95">{shareUrl}</p>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(shareUrl)}
            className="mt-2 w-full rounded bg-zinc-800 py-1 text-[10px] text-zinc-200 hover:bg-zinc-700"
          >
            复制链接
          </button>
        </div>
      )}
      <p className="text-center text-[9px] leading-tight text-amber-600/85">
        勿使用 localhost 跨设备；请用本机 IP（如 http://192.168.x.x:3001）。无服务器临时目录时（如无盘
        Serverless）分享不可用，需自建 Node 部署。
      </p>

      {uploadBusy && (
        <div className="rounded border border-white/10 bg-black/40 px-2 py-2">
          <div className="mb-1 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-sky-500" />
          </div>
          <p className="text-center text-[10px] text-zinc-400">{uploadMessage}</p>
        </div>
      )}

      {uploadError && !uploadBusy && (
        <p className="rounded bg-red-950/50 px-2 py-1.5 text-[10px] text-red-300">
          {uploadError}
        </p>
      )}

      {seriesList.length === 0 && !uploadBusy && (
        <p className="py-4 text-center text-[11px] text-zinc-600">加载中…</p>
      )}

      <div className="flex flex-col gap-1.5">
        {seriesList.map((s, i) => {
          const active = activeSeriesIdx === i;
          const n = seriesSliceCount(s);
          return (
            <div key={s.id} className="relative">
              <button
                type="button"
                onClick={() => onSelectSeries(i)}
                className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] transition-colors ${
                  active
                    ? "bg-sky-500/20 text-sky-100 ring-1 ring-sky-500/40"
                    : "text-zinc-400 hover:bg-white/5"
                }`}
              >
                <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded bg-zinc-900">
                  {s.thumbnailPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={seriesThumbSrc(s.thumbnailPath)}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      draggable={false}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-800 text-[7px] font-bold leading-tight text-sky-400/90">
                      {s.isLocal ? (
                        <>
                          <span>本地</span>
                          <span className="text-zinc-500">{n}</span>
                        </>
                      ) : (
                        <span className="text-zinc-600">N/A</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 pr-6">
                  <div className="truncate font-semibold leading-tight">
                    {s.label}
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-500">
                    {s.modality ?? ""} · {n} 幅
                    {s.isLocal ? " · 本地" : ""}
                  </div>
                </div>
              </button>
              {s.isLocal && (
                <button
                  type="button"
                  title="从列表移除并释放内存"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveLocalSeries(s);
                  }}
                  className="absolute right-1 top-1/2 z-[1] -translate-y-1/2 rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-red-300"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
