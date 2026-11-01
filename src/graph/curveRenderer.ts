import type { EvaluatorFn, GraphRow, Viewport } from './types';
import { mathToScreen, screenToMath } from './coords';
import { classifyAndParse } from './evaluator';
import { drawImplicitCurve } from './marchingSquares';

export function renderCurves(
  ctx: CanvasRenderingContext2D,
  expressions: GraphRow[],
  variables: Record<string, number>,
  viewport: Viewport,
  customEvaluator?: EvaluatorFn
): void {
  const { width, height } = viewport;
  if (width <= 0 || height <= 0) return;

  for (const row of expressions) {
    if (!row.visible || !row.expression || !row.expression.trim()) {
      continue;
    }

    try {
      const parsed = classifyAndParse(row.expression, customEvaluator);
      if (!parsed) continue;

      const color = row.color || '#3b82f6';

      if (parsed.type === 'explicit_y') {
        renderExplicitY(ctx, parsed.evaluate, variables, viewport, color);
      } else if (parsed.type === 'explicit_x') {
        renderExplicitX(ctx, parsed.evaluate, variables, viewport, color);
      } else if (parsed.type === 'implicit') {
        drawImplicitCurve(ctx, parsed.evaluate, variables, viewport, color, {
          cellSize: 5,
          lineWidth: 2.2,
        });
      }
    } catch {
      // Gracefully ignore individual curve evaluation failure
    }
  }
}

function renderExplicitY(
  ctx: CanvasRenderingContext2D,
  evaluate: (scope: Record<string, number>) => number,
  variables: Record<string, number>,
  viewport: Viewport,
  color: string
): void {
  const { width, height } = viewport;
  const scope: Record<string, number> = { ...variables, x: 0, y: 0 };

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  let isDrawing = false;
  let prevMathY = 0;
  let prevScreenY = 0;

  // Step 1 screen pixel for smooth high-resolution curve
  const step = 1;
  const totalSteps = Math.ceil(width / step);

  for (let i = 0; i <= totalSteps; i++) {
    const px = Math.min(i * step, width);
    const mathPt = screenToMath(px, 0, viewport);
    scope.x = mathPt.x;

    const mathY = evaluate(scope);

    if (!Number.isFinite(mathY)) {
      isDrawing = false;
      continue;
    }

    const screenPt = mathToScreen(mathPt.x, mathY, viewport);
    const py = screenPt.y;

    if (!isDrawing) {
      ctx.moveTo(px, py);
      isDrawing = true;
    } else {
      // Discontinuity / Asymptote jump check (e.g., tan(x) or 1/x)
      const dy = Math.abs(py - prevScreenY);
      const isAsymptoteJump =
        dy > height && Math.sign(mathY) !== Math.sign(prevMathY);

      if (isAsymptoteJump) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }

    prevMathY = mathY;
    prevScreenY = py;
  }

  ctx.stroke();
  ctx.restore();
}

function renderExplicitX(
  ctx: CanvasRenderingContext2D,
  evaluate: (scope: Record<string, number>) => number,
  variables: Record<string, number>,
  viewport: Viewport,
  color: string
): void {
  const { width, height } = viewport;
  const scope: Record<string, number> = { ...variables, x: 0, y: 0 };

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  let isDrawing = false;
  let prevMathX = 0;
  let prevScreenX = 0;

  const step = 1;
  const totalSteps = Math.ceil(height / step);

  for (let i = 0; i <= totalSteps; i++) {
    const py = Math.min(i * step, height);
    const mathPt = screenToMath(0, py, viewport);
    scope.y = mathPt.y;

    const mathX = evaluate(scope);

    if (!Number.isFinite(mathX)) {
      isDrawing = false;
      continue;
    }

    const screenPt = mathToScreen(mathX, mathPt.y, viewport);
    const px = screenPt.x;

    if (!isDrawing) {
      ctx.moveTo(px, py);
      isDrawing = true;
    } else {
      const dx = Math.abs(px - prevScreenX);
      const isAsymptoteJump =
        dx > width && Math.sign(mathX) !== Math.sign(prevMathX);

      if (isAsymptoteJump) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }

    prevMathX = mathX;
    prevScreenX = px;
  }

  ctx.stroke();
  ctx.restore();
}
