export interface GraphRow {
  id: string;
  expression: string;
  color: string;
  visible: boolean;
  error?: string | null;
}

export interface Viewport {
  centerX: number;
  centerY: number;
  pixelsPerUnit: number;
  width: number;
  height: number;
}

export interface Bounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface GraphTheme {
  backgroundColor: string;
  majorGridColor: string;
  minorGridColor: string;
  axisColor: string;
  labelColor: string;
  labelBgColor: string;
  labelFont: string;
  cursorCrosshairColor: string;
}

export type EvaluatorFn = (expr: string, scope: Record<string, number>) => number;

export type CompiledExpressionFn = (scope: Record<string, number>) => number;

export type ExpressionType = 'explicit_y' | 'explicit_x' | 'implicit';

export interface ParsedPlotExpression {
  type: ExpressionType;
  evaluate: CompiledExpressionFn;
  raw: string;
}

export interface GraphCanvasProps {
  expressions: GraphRow[];
  variables?: Record<string, number>;
  className?: string;
  theme?: Partial<GraphTheme>;
  initialCenterX?: number;
  initialCenterY?: number;
  initialPixelsPerUnit?: number;
  onViewportChange?: (viewport: Viewport) => void;
  onHoverPoint?: (point: Point | null) => void;
  customEvaluator?: EvaluatorFn;
  showControls?: boolean;
  showCoordinates?: boolean;
}
