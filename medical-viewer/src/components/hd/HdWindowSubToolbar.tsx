"use client";

import {
  HD_PSEUDO_COLOR_PRESETS,
  type HdPseudoColorId,
} from "@/lib/hdPseudoColorPresets";
import {
  HD_WINDOW_PRESETS,
  type HdWindowPresetId,
} from "@/lib/hdWindowPresets";

type Props = {
  selectedPresetId: HdWindowPresetId;
  onSelectPreset: (id: HdWindowPresetId) => void;
  invertOn: boolean;
  onToggleInvert: () => void;
  selectedPseudoColorId: HdPseudoColorId;
  onSelectPseudoColor: (id: HdPseudoColorId) => void;
};

function IconInvert({ active }: { active: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      className={active ? "text-sky-400" : "text-zinc-300"}
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 3a9 9 0 0 1 0 18V3Z"
        fill="currentColor"
        className={active ? "text-white" : "text-zinc-800"}
      />
    </svg>
  );
}

const scrollRowClass =
  "flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * 调窗：第一行窗宽窗位预设 + 反色（可横向滚动）；第二行伪彩（可横向滚动）。
 */
export default function HdWindowSubToolbar({
  selectedPresetId,
  onSelectPreset,
  invertOn,
  onToggleInvert,
  selectedPseudoColorId,
  onSelectPseudoColor,
}: Props) {
  return (
    <div
      className="flex shrink-0 flex-col gap-2.5 border-t border-white/10 bg-[#0a0c0f] px-2 py-2.5"
      role="toolbar"
      aria-label="调窗"
    >
      <div className={scrollRowClass}>
        {HD_WINDOW_PRESETS.map((p) => {
          const active = selectedPresetId === p.id;
          const disabled = p.disabled === true;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPreset(p.id)}
              className={`shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors active:opacity-80 ${
                disabled
                  ? "cursor-not-allowed text-zinc-600"
                  : active
                    ? "bg-sky-500/25 text-sky-300 ring-1 ring-sky-500/50"
                    : "bg-white/5 text-zinc-300 hover:bg-white/10"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onToggleInvert}
          className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors active:opacity-80 ${
            invertOn
              ? "bg-sky-500/25 text-sky-300 ring-1 ring-sky-500/50"
              : "bg-white/5 text-zinc-300 hover:bg-white/10"
          }`}
        >
          <IconInvert active={invertOn} />
          反色
        </button>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <div className="px-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          伪彩
        </div>
        <div className={scrollRowClass}>
          {HD_PSEUDO_COLOR_PRESETS.map((p) => {
            const active = selectedPseudoColorId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPseudoColor(p.id)}
                className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors active:opacity-80 ${
                  active
                    ? "bg-violet-500/25 text-violet-200 ring-1 ring-violet-500/45"
                    : "bg-white/5 text-zinc-400 hover:bg-white/10"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
