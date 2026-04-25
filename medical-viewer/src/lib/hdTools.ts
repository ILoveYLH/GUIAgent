/** HD「工具」子栏：与 HdToolsSubToolbar 对应 */

export type HdToolId =
  | "imageLayout"
  | "seriesLayout"
  | "pan"
  | "rotate"
  | "mirrorH"
  | "reset";

export type HdToolItem = {
  id: HdToolId;
  label: string;
  /** 仅占位，不接交互 */
  reserved?: boolean;
};

export const HD_TOOL_ITEMS: readonly HdToolItem[] = [
  { id: "imageLayout", label: "图像布局", reserved: true },
  { id: "seriesLayout", label: "序列布局", reserved: true },
  { id: "pan", label: "平移" },
  { id: "rotate", label: "自由旋转" },
  { id: "mirrorH", label: "水平镜像" },
  { id: "reset", label: "重置" },
] as const;
