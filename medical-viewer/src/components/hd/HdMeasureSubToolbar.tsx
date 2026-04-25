"use client";

import {
  HD_MEASURE_TOOL_ITEMS,
  type HdMeasureToolId,
} from "@/lib/hdMeasureTools";

type Props = {
  activeMeasureToolId: HdMeasureToolId | null;
  onSelectMeasureTool: (id: HdMeasureToolId) => void;
};

function IconLine({ active }: { active: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      className={active ? "text-sky-400" : "text-zinc-400"}
      aria-hidden
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M5 19L19 5"
      />
      <circle cx="5" cy="19" r="1.5" fill="currentColor" />
      <circle cx="19" cy="5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconAngle({ active }: { active: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      className={active ? "text-sky-400" : "text-zinc-400"}
      aria-hidden
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18h12M6 18L14 6M6 18l5-7"
      />
    </svg>
  );
}

function IconRect({ active }: { active: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      className={active ? "text-sky-400" : "text-zinc-400"}
      aria-hidden
    >
      <rect
        x="5"
        y="6"
        width="14"
        height="12"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconCircle({ active }: { active: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      className={active ? "text-sky-400" : "text-zinc-400"}
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        d="M12 8v2M12 14v2M8 12h2M14 12h2"
        opacity="0.6"
      />
    </svg>
  );
}

function IconEraser({ active }: { active: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      className={active ? "text-sky-400" : "text-zinc-400"}
      aria-hidden
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 11l8-8 3 3-8 8-4 1 1-4z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M6 18h12"
        opacity="0.85"
      />
    </svg>
  );
}

function IconFreehand({ active }: { active: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      className={active ? "text-sky-400" : "text-zinc-400"}
      aria-hidden
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 14c2-4 4-6 7-7 3-1 5 1 6 4 1 4-1 7-4 8-3 1-6-1-8-4"
      />
    </svg>
  );
}

function MeasureIcon({ id, active }: { id: HdMeasureToolId; active: boolean }) {
  switch (id) {
    case "line":
      return <IconLine active={active} />;
    case "angle":
      return <IconAngle active={active} />;
    case "rect":
      return <IconRect active={active} />;
    case "circle":
      return <IconCircle active={active} />;
    case "freehand":
      return <IconFreehand active={active} />;
    case "eraser":
      return <IconEraser active={active} />;
    default:
      return null;
  }
}

const scrollRowClass =
  "flex gap-3 overflow-x-auto px-1 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export default function HdMeasureSubToolbar({
  activeMeasureToolId,
  onSelectMeasureTool,
}: Props) {
  return (
    <div
      className="shrink-0 border-t border-white/10 bg-[#0a0c0f] px-2 py-2.5"
      role="toolbar"
      aria-label="测量"
    >
      <div className={scrollRowClass}>
        {HD_MEASURE_TOOL_ITEMS.map((item) => {
          const active = activeMeasureToolId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectMeasureTool(item.id)}
              className={`flex min-w-[56px] shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition-colors active:opacity-80 ${
                active
                  ? "bg-sky-500/20 ring-1 ring-sky-500/45"
                  : "hover:bg-white/5"
              }`}
            >
              <MeasureIcon id={item.id} active={active} />
              <span className="max-w-[72px] text-center text-[10px] leading-tight text-zinc-400">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
