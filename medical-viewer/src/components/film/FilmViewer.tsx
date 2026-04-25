"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  FILM_SEQUENCES,
  frameCount,
  getFilmFrameUrl,
  getThumbnailUrl,
  maxSliceIndex,
} from "@/lib/filmSequences";
import styles from "./FilmViewer.module.css";

const SPEED_OPTIONS = [0.5, 1, 1.5, 2] as const;

/** 将 delta 统一成「像素」量级（兼容 deltaMode 行/页） */
function normalizeAxis(e: WheelEvent, key: "deltaY" | "deltaX"): number {
  const v = e[key];
  if (e.deltaMode === 1) return v * 16;
  if (e.deltaMode === 2) {
    return v * (typeof window !== "undefined" ? window.innerHeight : 800);
  }
  return v;
}

/** 触控板常出现纵向很小但横向 delta 大，取主方向 */
function combinedWheelDelta(e: WheelEvent): number {
  const dy = normalizeAxis(e, "deltaY");
  const dx = normalizeAxis(e, "deltaX");
  if (Math.abs(dy) >= Math.abs(dx)) return dy;
  return dx;
}

function IconClose() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMore() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

type ViewMode = "image" | "video";

export type FilmViewerVariant = "fullscreen" | "embedded";

export type FilmViewerProps = {
  /** fullscreen：独立 /film 页；embedded：首页底部嵌入，不占满视口 */
  variant?: FilmViewerVariant;
};

export default function FilmViewer({ variant = "fullscreen" }: FilmViewerProps) {
  const embedded = variant === "embedded";
  const [viewMode, setViewMode] = useState<ViewMode>("image");
  const [activeSeq, setActiveSeq] = useState(0);
  const [indices, setIndices] = useState<number[]>(() =>
    FILM_SEQUENCES.map(() => 0),
  );
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const speed = SPEED_OPTIONS[speedIdx];
  const stripRef = useRef<HTMLDivElement>(null);
  const filmStageRef = useRef<HTMLDivElement>(null);
  const stageInnerRef = useRef<HTMLDivElement>(null);
  const wheelAccRef = useRef(0);
  const drag = useRef<{ x: number } | null>(null);
  const flipStateRef = useRef({
    viewMode: "image" as ViewMode,
    activeSeq: 0,
    max: 0,
    kind: "slices" as "slices" | "single",
  });

  const seq = FILM_SEQUENCES[activeSeq];
  const idx = indices[activeSeq] ?? 0;
  const max = maxSliceIndex(seq);
  const totalFrames = frameCount(seq);
  const currentFrame = seq.kind === "single" ? 1 : idx + 1;
  const mainSrc = getFilmFrameUrl(seq, idx);

  const setSlice = useCallback((seqIdx: number, value: number) => {
    setIndices((prev) => {
      const next = [...prev];
      const s = FILM_SEQUENCES[seqIdx];
      const m = maxSliceIndex(s);
      next[seqIdx] = Math.max(0, Math.min(m, value));
      return next;
    });
  }, []);

  const goPrevPage = useCallback(() => {
    if (seq.kind === "single") return;
    setSlice(activeSeq, idx - 1);
  }, [activeSeq, idx, seq, setSlice]);

  const goNextPage = useCallback(() => {
    if (seq.kind === "single") return;
    setSlice(activeSeq, idx + 1);
  }, [activeSeq, idx, seq, setSlice]);

  const canFlipPage = seq.kind !== "single";

  flipStateRef.current = {
    viewMode,
    activeSeq,
    max,
    kind: seq.kind,
  };

  useEffect(() => {
    wheelAccRef.current = 0;
  }, [activeSeq, viewMode]);

  useLayoutEffect(() => {
    const step = 18;

    const onWheel = (e: WheelEvent) => {
      const stage = filmStageRef.current;
      const t = e.target;
      if (!stage || !(t instanceof Node) || !stage.contains(t)) return;

      const st = flipStateRef.current;
      if (st.viewMode !== "image" || st.kind === "single") return;

      e.preventDefault();

      wheelAccRef.current += combinedWheelDelta(e);
      setIndices((prev) => {
        const st2 = flipStateRef.current;
        const next = [...prev];
        let cur = next[st2.activeSeq] ?? 0;
        const m = st2.max;
        while (wheelAccRef.current >= step && cur < m) {
          wheelAccRef.current -= step;
          cur++;
        }
        while (wheelAccRef.current <= -step && cur > 0) {
          wheelAccRef.current += step;
          cur--;
        }
        next[st2.activeSeq] = cur;
        return next;
      });
    };

    document.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () =>
      document.removeEventListener("wheel", onWheel, { capture: true });
  }, []);

  useEffect(() => {
    if (!playing || viewMode !== "video") return;
    const s = FILM_SEQUENCES[activeSeq];
    if (s.kind === "single") return;
    const ms = Math.max(80, 450 / speed);
    const t = window.setInterval(() => {
      setIndices((prev) => {
        const next = [...prev];
        const curS = FILM_SEQUENCES[activeSeq];
        if (curS.kind === "single") return prev;
        const m = maxSliceIndex(curS);
        const cur = next[activeSeq] ?? 0;
        next[activeSeq] = cur >= m ? 0 : cur + 1;
        return next;
      });
    }, ms);
    return () => window.clearInterval(t);
  }, [playing, activeSeq, speed, viewMode]);

  const scrollStrip = (dir: -1 | 1) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 120, behavior: "smooth" });
  };

  const selectSequence = (i: number) => {
    setActiveSeq(i);
    if (FILM_SEQUENCES[i].kind === "single") setPlaying(false);
  };

  const setMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "image") setPlaying(false);
  };

  const filmBody = (
    <div
      className={`${embedded ? styles.filmRootEmbedded : styles.filmRootInBody} bg-black text-zinc-100`}
    >
      <div
        className={`${embedded ? styles.filmColumnEmbedded : styles.filmColumn} mx-auto w-full`}
      >
        {/* 顶栏：独立页与云胶片一致；嵌入模式由外层页面提供标题 */}
        {!embedded && (
          <header className="shrink-0 border-b border-white/10 bg-[#0c0f14]/95 backdrop-blur">
            <div className="flex h-11 items-center justify-between px-2 text-[#e2e8f0]">
              <Link
                href="/"
                className="flex h-10 w-10 items-center justify-center rounded-lg active:bg-white/10"
                aria-label="关闭"
              >
                <IconClose />
              </Link>
              <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
                <span className="text-[15px] font-semibold tracking-tight">
                  云胶片
                </span>
                <span className="max-w-[200px] truncate text-[11px] text-[#94a3b8]">
                  cloud.example-hospital.cn
                </span>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg active:bg-white/10"
                aria-label="更多"
              >
                <IconMore />
              </button>
            </div>
          </header>
        )}

        {/* 影像 tab */}
        <div className="flex h-11 shrink-0 items-end px-3 pb-1 pt-2">
          <button
            type="button"
            className="rounded border border-sky-400/90 bg-sky-500/15 px-4 py-1.5 text-[13px] font-medium text-sky-100 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
          >
            影像1
          </button>
        </div>

        {/* 主图区：高度仅由 flex 分配，与图片内容无关；滚轮绑在此层以覆盖整块可视区 */}
        <div
          ref={filmStageRef}
          className={`${embedded ? styles.filmStageEmbedded : styles.filmStage} bg-black`}
        >
          <div className="pointer-events-none absolute right-3 top-2 z-10 flex h-11 flex-col items-end justify-between text-[11px] leading-tight text-white drop-shadow-md">
            <div>第：{currentFrame}/{totalFrames}张</div>
            <div className="flex h-5 items-center">
              {viewMode === "video" ? (
                <span className="text-white/85">
                  播放速度：{speed.toFixed(1)}x
                </span>
              ) : (
                <span className="invisible text-left" aria-hidden>
                  播放速度：{speed.toFixed(1)}x
                </span>
              )}
            </div>
          </div>

          <div
            ref={stageInnerRef}
            className={styles.filmStageInner}
            onPointerDown={(e) => {
              if (viewMode !== "image" || seq.kind === "single") return;
              drag.current = { x: e.clientX };
            }}
            onPointerUp={(e) => {
              if (
                viewMode !== "image" ||
                seq.kind === "single" ||
                !drag.current
              )
                return;
              const dx = e.clientX - drag.current.x;
              drag.current = null;
              if (Math.abs(dx) < 28) return;
              if (dx > 0) setSlice(activeSeq, idx - 1);
              else setSlice(activeSeq, idx + 1);
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic public URLs */}
            <img
              src={mainSrc}
              alt=""
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          </div>
        </div>

        {/* 图片 / 视频 控制条：固定高度，两种模式占位一致 */}
        <div className="flex h-[52px] shrink-0 items-center px-3">
          {viewMode === "image" ? (
            <div className="flex h-11 w-full items-center justify-center gap-3">
              <button
                type="button"
                onClick={goPrevPage}
                disabled={!canFlipPage || idx <= 0}
                className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/25 bg-white/5 text-[13px] font-medium text-white active:bg-white/10 disabled:pointer-events-none disabled:opacity-35"
                aria-label="上一页"
              >
                <span className="text-xl leading-none">‹</span>
                上一页
              </button>
              <button
                type="button"
                onClick={goNextPage}
                disabled={!canFlipPage || idx >= max}
                className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/25 bg-white/5 text-[13px] font-medium text-white active:bg-white/10 disabled:pointer-events-none disabled:opacity-35"
                aria-label="下一页"
              >
                下一页
                <span className="text-xl leading-none">›</span>
              </button>
            </div>
          ) : (
            <div
              className={`${styles.videoToolbar} flex h-11 w-full min-w-0 items-center gap-1.5`}
            >
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="flex h-9 w-9 shrink-0 items-center justify-center text-white"
                aria-label={playing ? "暂停" : "播放"}
              >
                {playing ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() =>
                  seq.kind !== "single" && setSlice(activeSeq, idx - 1)
                }
                disabled={seq.kind === "single"}
                className="flex h-9 w-7 shrink-0 items-center justify-center text-white/90 disabled:opacity-30"
                aria-label="上一张"
              >
                ‹
              </button>
              <input
                type="range"
                min={0}
                max={max}
                value={idx}
                disabled={seq.kind === "single"}
                onChange={(e) =>
                  setSlice(activeSeq, Number(e.target.value))
                }
                className={`${styles.slider} min-w-[48px] flex-1 disabled:opacity-40`}
              />
              <button
                type="button"
                onClick={() =>
                  seq.kind !== "single" && setSlice(activeSeq, idx + 1)
                }
                disabled={seq.kind === "single"}
                className="flex h-9 w-7 shrink-0 items-center justify-center text-white/90 disabled:opacity-30"
                aria-label="下一张"
              >
                ›
              </button>
              <div
                className="flex shrink-0 items-center gap-0.5 border-l border-white/20 pl-1.5"
                role="group"
                aria-label="播放速度"
              >
                {SPEED_OPTIONS.map((opt, i) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSpeedIdx(i)}
                    className={`min-w-[2rem] rounded px-1 py-1 text-[10px] font-semibold leading-none tabular-nums transition-colors ${
                      speedIdx === i
                        ? "bg-sky-500/45 text-white ring-1 ring-sky-400/80"
                        : "bg-white/10 text-zinc-400 active:bg-white/20"
                    }`}
                    aria-pressed={speedIdx === i}
                    aria-label={`${opt.toFixed(1)} 倍速`}
                  >
                    {opt.toFixed(1)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 模式图标行：固定高度 */}
        <div className="flex h-[52px] shrink-0 items-center justify-center gap-6 border-t border-white/5">
          <button
            type="button"
            onClick={() => setMode("image")}
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${
              viewMode === "image"
                ? `bg-zinc-900/80 text-sky-300 ${styles.modeGlow}`
                : "text-white/45"
            }`}
            aria-label="图像"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="5"
                width="18"
                height="14"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M8 14l3-3 3 3 4-4"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setMode("video")}
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${
              viewMode === "video"
                ? `bg-zinc-900/80 text-sky-300 ${styles.modeGlow}`
                : "text-white/45"
            }`}
            aria-label="视频胶片"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="6"
                width="18"
                height="12"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M7 6v12M11 6v12M15 6v12"
                stroke="currentColor"
                strokeWidth="1.1"
              />
            </svg>
          </button>
          <Link
            href="/hd?panel=series"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white/45 active:bg-white/10"
            aria-label="高清 HD 阅片"
          >
            <span className="text-[11px] font-bold tracking-tight">HD</span>
          </Link>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white/45"
            aria-label="信息"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M12 10v6M12 8h.01"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* 底部序列缩略图：固定总高度，单卡固定像素，避免切换跳动 */}
        <div className="relative flex h-[144px] shrink-0 flex-col border-t border-white/10 bg-[#0a0c0f]">
          <div className="relative flex h-[108px] shrink-0 items-center">
            <button
              type="button"
              onClick={() => scrollStrip(-1)}
              className="absolute left-1 top-1/2 z-10 -translate-y-1/2 text-2xl text-zinc-600"
              aria-label="向左滚动"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => scrollStrip(1)}
              className="absolute right-1 top-1/2 z-10 -translate-y-1/2 text-2xl text-zinc-600"
              aria-label="向右滚动"
            >
              ›
            </button>
            <div
              ref={stripRef}
              className={`${styles.strip} flex h-full w-full items-center gap-2 overflow-x-auto px-10`}
            >
              {FILM_SEQUENCES.map((s, i) => {
                const thumb = getThumbnailUrl(s);
                const n = frameCount(s);
                const selected = i === activeSeq;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectSequence(i)}
                    className={`box-border flex h-[108px] w-[72px] shrink-0 flex-col overflow-hidden rounded-md border-2 bg-black/40 text-left transition-[border-color] ${
                      selected ? "border-white" : "border-white/25"
                    }`}
                  >
                    <div className="relative flex h-[82px] w-full shrink-0 items-center justify-center bg-zinc-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                      <span className="pointer-events-none absolute right-0.5 top-0.5 text-[10px] font-semibold text-white drop-shadow">
                        {n}
                      </span>
                    </div>
                    <div className="flex h-[22px] w-full shrink-0 items-center justify-center truncate bg-black/80 px-0.5 text-center text-[10px] leading-none text-zinc-300">
                      {s.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex h-9 shrink-0 items-center justify-center gap-8 text-2xl text-zinc-600">
            <button
              type="button"
              onClick={() => scrollStrip(-1)}
              className="px-4 py-1 text-zinc-600 active:text-zinc-400"
              aria-label="缩略图向左"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => scrollStrip(1)}
              className="px-4 py-1 text-zinc-600 active:text-zinc-400"
              aria-label="缩略图向右"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return filmBody;
  }

  return (
    <div className="min-h-dvh w-full bg-[#e8eef3]">
      <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col px-3 sm:px-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:my-2 sm:rounded-xl sm:shadow-xl sm:ring-1 sm:ring-slate-300/60">
          {filmBody}
        </div>
      </div>
    </div>
  );
}
