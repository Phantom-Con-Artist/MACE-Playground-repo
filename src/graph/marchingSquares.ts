import type { Viewport } from './types';
import { screenToMath } from './coords';

export interface ImplicitCurveOptions {
  cellSize?: number; // Screen pixels per cell, e.g. 5 or 6
  lineWidth?: number;
}

// Linear interpolation to find zero crossing between two values
function interpolate(
  valA: number,
  valB: number,
  coordA: number,
  coordB: number
): number {
  if (Math.abs(valB - valA) < 1e-12) {
    return (coordA + coordB) / 2;
  }
  const t = Math.max(0, Math.min(1, -valA / (valB - valA)));
  return coordA + t * (coordB - coordA);
}

export function drawImplicitCurve(
  ctx: CanvasRenderingContext2D,
  evaluate: (scope: Record<string, number>) => number,
  variables: Record<string, number>,
  viewport: Viewport,
  color: string,
  options?: ImplicitCurveOptions
): void {
  const cellSize = options?.cellSize ?? 6;
  const width = viewport.width;
  const height = viewport.height;

  if (width <= 0 || height <= 0) return;

  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);

  const numVerticesX = cols + 1;
  const numVerticesY = rows + 1;
  const gridValues = new Float64Array(numVerticesX * numVerticesY);

  const scope: Record<string, number> = { ...variables, x: 0, y: 0 };

  // Sample grid values
  for (let r = 0; r < numVerticesY; r++) {
    const py = Math.min(r * cellSize, height);
    for (let c = 0; c < numVerticesX; c++) {
      const px = Math.min(c * cellSize, width);
      const mathPt = screenToMath(px, py, viewport);
      scope.x = mathPt.x;
      scope.y = mathPt.y;
      const v = evaluate(scope);
      gridValues[r * numVerticesX + c] = v;
    }
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = options?.lineWidth ?? 2;
  ctx.beginPath();

  // March through cells
  for (let r = 0; r < rows; r++) {
    const py0 = r * cellSize;
    const py1 = Math.min((r + 1) * cellSize, height);

    for (let c = 0; c < cols; c++) {
      const px0 = c * cellSize;
      const px1 = Math.min((c + 1) * cellSize, width);

      const v0 = gridValues[r * numVerticesX + c]; // top-left
      const v1 = gridValues[r * numVerticesX + (c + 1)]; // top-right
      const v2 = gridValues[(r + 1) * numVerticesX + (c + 1)]; // bottom-right
      const v3 = gridValues[(r + 1) * numVerticesX + c]; // bottom-left

      if (
        !Number.isFinite(v0) ||
        !Number.isFinite(v1) ||
        !Number.isFinite(v2) ||
        !Number.isFinite(v3)
      ) {
        continue;
      }

      // Check sign configuration
      let state = 0;
      if (v0 > 0) state |= 8;
      if (v1 > 0) state |= 4;
      if (v2 > 0) state |= 2;
      if (v3 > 0) state |= 1;

      if (state === 0 || state === 15) {
        continue; // all positive or all negative, no curve inside cell
      }

      // Edge intersection points:
      // top edge: (topX, py0)
      // right edge: (px1, rightY)
      // bottom edge: (bottomX, py1)
      // left edge: (px0, leftY)

      const topX = interpolate(v0, v1, px0, px1);
      const rightY = interpolate(v1, v2, py0, py1);
      const bottomX = interpolate(v3, v2, px0, px1);
      const leftY = interpolate(v0, v3, py0, py1);

      switch (state) {
        case 1:
        case 14:
          // Left - Bottom
          ctx.moveTo(leftY !== undefined ? px0 : px0, leftY);
          ctx.lineTo(bottomX, py1);
          break;

        case 2:
        case 13:
          // Bottom - Right
          ctx.moveTo(bottomX, py1);
          ctx.lineTo(px1, rightY);
          break;

        case 3:
        case 12:
          // Left - Right
          ctx.moveTo(px0, leftY);
          ctx.lineTo(px1, rightY);
          break;

        case 4:
        case 11:
          // Top - Right
          ctx.moveTo(topX, py0);
          ctx.lineTo(px1, rightY);
          break;

        case 5: {
          // Saddle point: Top-Left & Bottom-Right are positive
          // Disambiguate by center value
          const centerVal = (v0 + v1 + v2 + v3) / 4;
          if (centerVal > 0) {
            ctx.moveTo(px0, leftY);
            ctx.lineTo(topX, py0);
            ctx.moveTo(bottomX, py1);
            ctx.lineTo(px1, rightY);
          } else {
            ctx.moveTo(px0, leftY);
            ctx.lineTo(bottomX, py1);
            ctx.moveTo(topX, py0);
            ctx.lineTo(px1, rightY);
          }
          break;
        }

        case 10: {
          // Saddle point: Top-Right & Bottom-Left are positive
          const centerVal = (v0 + v1 + v2 + v3) / 4;
          if (centerVal > 0) {
            ctx.moveTo(px0, leftY);
            ctx.lineTo(bottomX, py1);
            ctx.moveTo(topX, py0);
            ctx.lineTo(px1, rightY);
          } else {
            ctx.moveTo(px0, leftY);
            ctx.lineTo(topX, py0);
            ctx.moveTo(bottomX, py1);
            ctx.lineTo(px1, rightY);
          }
          break;
        }

        case 6:
        case 9:
          // Top - Bottom
          ctx.moveTo(topX, py0);
          ctx.lineTo(bottomX, py1);
          break;

        case 7:
        case 8:
          // Top - Left
          ctx.moveTo(topX, py0);
          ctx.lineTo(px0, leftY);
          break;
      }
    }
  }

  ctx.stroke();
  ctx.restore();
}
