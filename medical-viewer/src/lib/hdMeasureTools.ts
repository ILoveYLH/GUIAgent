import {
  AngleTool,
  CircleROITool,
  EraserTool,
  LengthTool,
  PlanarFreehandROITool,
  RectangleROITool,
} from "@cornerstonejs/tools";

/** HD「测量」子栏：与 Cornerstone 工具名对应 */
export type HdMeasureToolId =
  | "line"
  | "angle"
  | "rect"
  | "circle"
  | "freehand"
  | "eraser";

export type HdMeasureToolItem = {
  id: HdMeasureToolId;
  label: string;
};

export const HD_MEASURE_TOOL_ITEMS: readonly HdMeasureToolItem[] = [
  { id: "line", label: "直线" },
  { id: "angle", label: "角度" },
  { id: "rect", label: "矩形" },
  { id: "circle", label: "圆" },
  { id: "freehand", label: "自由笔" },
  { id: "eraser", label: "消除笔" },
] as const;

/** HdMeasureToolId → @cornerstonejs/tools 的 toolName */
export const HD_MEASURE_TO_CS_TOOL: Record<
  HdMeasureToolId,
  string
> = {
  line: LengthTool.toolName,
  angle: AngleTool.toolName,
  rect: RectangleROITool.toolName,
  circle: CircleROITool.toolName,
  freehand: PlanarFreehandROITool.toolName,
  eraser: EraserTool.toolName,
};

export const HD_MEASURE_CS_TOOL_NAMES: readonly string[] = (
  Object.values(HD_MEASURE_TO_CS_TOOL) as string[]
);
