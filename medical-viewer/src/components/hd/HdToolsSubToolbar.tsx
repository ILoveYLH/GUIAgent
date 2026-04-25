"use client";

import { HD_TOOL_ITEMS, type HdToolId } from "@/lib/hdTools";

type Props = {
  activeToolId: HdToolId | null;
  onSelectTool: (id: HdToolId) => void;
  /** 水平镜像：点一次切换左右镜像（非持续模式） */
  onMirrorHorizontal?: () => void;
  /** 重置：去掉平移/旋转/镜像等工具几何效果（不改窗宽窗位） */
  onResetToolsEffects?: () => void;
};

function IconImageLayout({ active }: { active: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      className={active ? "text-sky-400" : "text-zinc-400"}
      aria-hidden
    >
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 2"
      />
    </svg>
  );
}

function IconSeriesLayout({ active }: { active: boolean }) {
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
        d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"
      />
    </svg>
  );
}

function IconPan({ active }: { active: boolean }) {
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
        d="M12 5v3m0 8v3M5 12h3m8 0h3M7.5 7.5l1.5 1.5m6 6 1.5 1.5m0-9L15 9.5M9.5 14.5 8 16"
      />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

function IconRotate({ active }: { active: boolean }) {
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
        d="M12 5a7 7 0 1 1-7 7"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M5 8V5h3"
      />
      <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function IconReset({ active }: { active: boolean }) {
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
        d="M4 12a8 8 0 1 1 2.5 5.8"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v-4h4"
      />
    </svg>
  );
}

function IconMirrorH({ active }: { active: boolean }) {
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
        d="M12 4v16"
      />
      <path fill="currentColor" d="M7 9l-2 3 2 3V9zm12 0l2 3-2 3V9z" opacity="0.85" />
    </svg>
  );
}

function ToolIcon({ id, active }: { id: HdToolId; active: boolean }) {
  switch (id) {
    case "imageLayout":
      return <IconImageLayout active={active} />;
    case "seriesLayout":
      return <IconSeriesLayout active={active} />;
    case "pan":
      return <IconPan active={active} />;
    case "rotate":
      return <IconRotate active={active} />;
    case "mirrorH":
      return <IconMirrorH active={active} />;
    case "reset":
      return <IconReset active={active} />;
    default:
      return null;
  }
}

const scrollRowClass =
  "flex gap-3 overflow-x-auto px-1 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * 工具子栏：图像布局 / 序列布局预留；平移、旋转、镜像、重置。
 */
export default function HdToolsSubToolbar({
  activeToolId,
  onSelectTool,
  onMirrorHorizontal,
  onResetToolsEffects,
}: Props) {
  return (
    <div
      className="shrink-0 border-t border-white/10 bg-[#0a0c0f] px-2 py-2.5"
      role="toolbar"
      aria-label="工具"
    >
      <div className={scrollRowClass}>
        {HD_TOOL_ITEMS.map((item) => {
          const active =
            item.id === "mirrorH" || item.id === "reset"
              ? false
              : activeToolId === item.id;
          const reserved = item.reserved === true;
          return (
            <button
              key={item.id}
              type="button"
              disabled={reserved}
              onClick={() => {
                if (reserved) return;
                if (item.id === "mirrorH") {
                  onMirrorHorizontal?.();
                  return;
                }
                if (item.id === "reset") {
                  onResetToolsEffects?.();
                  return;
                }
                onSelectTool(item.id);
              }}
              className={`flex min-w-[56px] shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition-colors active:opacity-80 ${
                reserved
                  ? "cursor-not-allowed opacity-45"
                  : active
                    ? "bg-sky-500/20 ring-1 ring-sky-500/45"
                    : "hover:bg-white/5"
              }`}
            >
              <ToolIcon id={item.id} active={!reserved && active} />
              <span
                className={`max-w-[72px] text-center text-[10px] leading-tight ${
                  reserved ? "text-zinc-500" : "text-zinc-400"
                }`}
              >
                {item.label}
                {reserved ? (
                  <span className="block text-[9px] text-zinc-600">预留</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
