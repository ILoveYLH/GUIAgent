/** HD 页底部工具栏：与 URL `?panel=` 对应，便于后续各功能独立扩展 */

export const HD_PANEL = {
  SERIES: "series",
  WINDOW: "window",
  TOOLS: "tools",
  MEASURE: "measure",
  RESET: "reset",
  HISTORY: "history",
} as const;

export type HdPanelId = (typeof HD_PANEL)[keyof typeof HD_PANEL];

export type HdBottomNavItem = {
  id: HdPanelId;
  label: string;
  icon: string;
  /** 当前是否由本仓库实现（序列 = DICOM 阅片 + 序列条） */
  implemented: boolean;
};

export const HD_BOTTOM_NAV: HdBottomNavItem[] = [
  { id: HD_PANEL.SERIES, label: "序列", icon: "≡", implemented: true },
  { id: HD_PANEL.WINDOW, label: "调窗", icon: "☀", implemented: true },
  { id: HD_PANEL.TOOLS, label: "工具", icon: "◫", implemented: true },
  { id: HD_PANEL.MEASURE, label: "测量", icon: "╱", implemented: true },
  { id: HD_PANEL.RESET, label: "重置", icon: "↺", implemented: true },
  { id: HD_PANEL.HISTORY, label: "历史", icon: "⚙", implemented: true },
];

const ALLOWED = new Set<string>(HD_BOTTOM_NAV.map((x) => x.id));

export function parseHdPanelParam(value: string | null): HdPanelId {
  if (value && ALLOWED.has(value)) {
    return value as HdPanelId;
  }
  return HD_PANEL.SERIES;
}
