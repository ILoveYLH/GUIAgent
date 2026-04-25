"use client";

import { useCallback, useRef } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Minus,
} from "lucide-react";

type Props = {
  playing: boolean;
  fps: number;
  sliceIndex: number;
  numSlices: number;
  onTogglePlay: () => void;
  onSeek: (frameIndex: number) => void;
  onStepBackward: () => void;
  onStepForward: () => void;
  onFirstFrame: () => void;
  onLastFrame: () => void;
  onFpsChange: (fps: number) => void;
};

const BTN =
  "flex h-7 w-7 items-center justify-center rounded text-white/80 transition-colors hover:bg-white/15 hover:text-white active:bg-white/25";

export default function CineControlBar({
  playing,
  fps,
  sliceIndex,
  numSlices,
  onTogglePlay,
  onSeek,
  onStepBackward,
  onStepForward,
  onFirstFrame,
  onLastFrame,
  onFpsChange,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const progressPct =
    numSlices > 1
      ? ((sliceIndex - 1) / Math.max(1, numSlices - 1)) * 100
      : 0;

  const seekFromEvent = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
      const track = barRef.current;
      if (!track || numSlices <= 1) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const frame = Math.round(ratio * (numSlices - 1));
      onSeek(frame);
    },
    [numSlices, onSeek],
  );

  const onTrackDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      draggingRef.current = true;
      seekFromEvent(e);

      const onMove = (me: MouseEvent) => {
        if (!draggingRef.current) return;
        seekFromEvent(me);
      };
      const onUp = () => {
        draggingRef.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [seekFromEvent],
  );

  const decFps = useCallback(
    () => onFpsChange(Math.max(1, fps - 1)),
    [fps, onFpsChange],
  );
  const incFps = useCallback(
    () => onFpsChange(Math.min(60, fps + 1)),
    [fps, onFpsChange],
  );

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="pointer-events-auto flex flex-col gap-1.5 rounded-lg bg-black/60 px-3 py-2 shadow-xl backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      {/* seek bar */}
      {numSlices > 1 && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
          ref={barRef}
          className="group relative h-3 w-full cursor-pointer"
          onMouseDown={onTrackDown}
        >
          <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-sky-400"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow ring-1 ring-black/20 transition-transform group-hover:scale-125"
            style={{ left: `${progressPct}%` }}
          />
        </div>
      )}

      {/* buttons row */}
      <div className="flex items-center gap-0.5">
        <button type="button" className={BTN} onClick={onFirstFrame} title="第一帧">
          <ChevronsLeft size={15} />
        </button>
        <button type="button" className={BTN} onClick={onStepBackward} title="上一帧">
          <SkipBack size={14} />
        </button>
        <button
          type="button"
          className={`${BTN} mx-0.5 h-8 w-8 rounded-full bg-white/10`}
          onClick={onTogglePlay}
          title={playing ? "暂停播放" : "播放序列"}
        >
          {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <button type="button" className={BTN} onClick={onStepForward} title="下一帧">
          <SkipForward size={14} />
        </button>
        <button type="button" className={BTN} onClick={onLastFrame} title="最后一帧">
          <ChevronsRight size={15} />
        </button>

        <div className="mx-1.5 h-4 w-px bg-white/20" />

        {/* FPS control */}
        <button type="button" className={BTN} onClick={decFps} title="降低帧率">
          <Minus size={13} />
        </button>
        <span className="min-w-[3rem] select-none text-center text-[11px] tabular-nums text-white/90">
          {fps} FPS
        </span>
        <button type="button" className={BTN} onClick={incFps} title="提高帧率">
          <Plus size={13} />
        </button>

        <div className="mx-1.5 h-4 w-px bg-white/20" />

        {/* frame counter */}
        <span className="min-w-[3.5rem] select-none text-center text-[11px] tabular-nums text-white/70">
          {sliceIndex} / {numSlices}
        </span>
      </div>
    </div>
  );
}
