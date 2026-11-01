import type { GraphTheme, Viewport } from './types';
import { calculateGridStep, formatTick, getViewportBounds, mathToScreen } from './coords';

export const DEFAULT_THEME: GraphTheme = {
  backgroundColor: '#ffffff',
  majorGridColor: '#d6dbe1',
  minorGridColor: '#edf1f5',
  axisColor: '#334155',
  labelColor: '#475569',
  labelBgColor: 'rgba(255, 255, 255, 0.85)',
  labelFont: '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  cursorCrosshairColor: 'rgba(100, 116, 139, 0.4)',
};

export function renderGridAndAxes(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  themeConfig?: Partial<GraphTheme>
): void {
  const theme: GraphTheme = { ...DEFAULT_THEME, ...themeConfig };
  const { width, height } = viewport;

  if (width <= 0 || height <= 0) return;

  // Clear / Fill background
  ctx.save();
  ctx.fillStyle = theme.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const bounds = getViewportBounds(viewport);
  const { major, minor } = calculateGridStep(viewport.pixelsPerUnit);

  // 1. Minor grid lines
  ctx.strokeStyle = theme.minorGridColor;
  ctx.lineWidth = 1;
  ctx.beginPath();

  const minorStartCol = Math.floor(bounds.xMin / minor);
  const minorEndCol = Math.ceil(bounds.xMax / minor);
  for (let c = minorStartCol; c <= minorEndCol; c++) {
    const mathX = c * minor;
    const pt = mathToScreen(mathX, 0, viewport);
    const screenX = Math.round(pt.x) + 0.5;
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, height);
  }

  const minorStartRow = Math.floor(bounds.yMin / minor);
  const minorEndRow = Math.ceil(bounds.yMax / minor);
  for (let r = minorStartRow; r <= minorEndRow; r++) {
    const mathY = r * minor;
    const pt = mathToScreen(0, mathY, viewport);
    const screenY = Math.round(pt.y) + 0.5;
    ctx.moveTo(0, screenY);
    ctx.lineTo(width, screenY);
  }
  ctx.stroke();

  // 2. Major grid lines
  ctx.strokeStyle = theme.majorGridColor;
  ctx.lineWidth = 1.25;
  ctx.beginPath();

  const majorStartCol = Math.floor(bounds.xMin / major);
  const majorEndCol = Math.ceil(bounds.xMax / major);
  for (let c = majorStartCol; c <= majorEndCol; c++) {
    const mathX = c * major;
    const pt = mathToScreen(mathX, 0, viewport);
    const screenX = Math.round(pt.x) + 0.5;
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, height);
  }

  const majorStartRow = Math.floor(bounds.yMin / major);
  const majorEndRow = Math.ceil(bounds.yMax / major);
  for (let r = majorStartRow; r <= majorEndRow; r++) {
    const mathY = r * major;
    const pt = mathToScreen(0, mathY, viewport);
    const screenY = Math.round(pt.y) + 0.5;
    ctx.moveTo(0, screenY);
    ctx.lineTo(width, screenY);
  }
  ctx.stroke();

  // 3. Coordinate Axes (X = 0 and Y = 0)
  const origin = mathToScreen(0, 0, viewport);
  ctx.strokeStyle = theme.axisColor;
  ctx.lineWidth = 2;
  ctx.beginPath();

  // X Axis (horizontal: y = 0)
  if (origin.y >= 0 && origin.y <= height) {
    const yAxisPx = Math.round(origin.y) + 0.5;
    ctx.moveTo(0, yAxisPx);
    ctx.lineTo(width, yAxisPx);
  }

  // Y Axis (vertical: x = 0)
  if (origin.x >= 0 && origin.x <= width) {
    const xAxisPx = Math.round(origin.x) + 0.5;
    ctx.moveTo(xAxisPx, 0);
    ctx.lineTo(xAxisPx, height);
  }
  ctx.stroke();

  // 4. Readable Axis Tick Labels
  ctx.font = theme.labelFont;
  ctx.fillStyle = theme.labelColor;

  // Determine clamped Y position for X-axis labels:
  // If X-axis is visible, place just below the axis.
  // If X-axis is off-screen, clamp to keep labels readable inside the viewport.
  const paddingX = 20;
  const paddingY = 16;
  const clampedXLabelY = Math.min(Math.max(origin.y + 16, paddingY), height - 8);

  // Determine clamped X position for Y-axis labels:
  // If Y-axis is visible, place just to the left of the axis.
  // If Y-axis is off-screen, clamp to keep labels readable inside the viewport.
  const clampedYLabelX = Math.min(Math.max(origin.x - 8, 36), width - paddingX);

  // Helper to draw text with background pill for readability
  function drawTextPill(text: string, x: number, y: number, align: CanvasTextAlign, baseline: CanvasTextBaseline) {
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = 12;

    let bgX = x;
    if (align === 'center') bgX = x - textWidth / 2;
    else if (align === 'right') bgX = x - textWidth;

    let bgY = y;
    if (baseline === 'middle') bgY = y - textHeight / 2;
    else if (baseline === 'bottom') bgY = y - textHeight;

    ctx.save();
    ctx.fillStyle = theme.labelBgColor;
    ctx.fillRect(bgX - 2, bgY - 2, textWidth + 4, textHeight + 4);
    ctx.fillStyle = theme.labelColor;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // X Axis Labels
  for (let c = majorStartCol; c <= majorEndCol; c++) {
    const mathX = c * major;
    if (Math.abs(mathX) < 1e-10) continue; // Skip 0 to avoid collision with Y axis

    const pt = mathToScreen(mathX, 0, viewport);
    if (pt.x < 15 || pt.x > width - 15) continue;

    const label = formatTick(mathX);
    drawTextPill(label, pt.x, clampedXLabelY, 'center', 'top');
  }

  // Y Axis Labels
  for (let r = majorStartRow; r <= majorEndRow; r++) {
    const mathY = r * major;
    if (Math.abs(mathY) < 1e-10) continue; // Skip 0

    const pt = mathToScreen(0, mathY, viewport);
    if (pt.y < 15 || pt.y > height - 15) continue;

    const label = formatTick(mathY);
    drawTextPill(label, clampedYLabelX, pt.y, 'right', 'middle');
  }

  // Draw Origin "0" label if near or on screen
  if (
    origin.x >= -20 &&
    origin.x <= width + 20 &&
    origin.y >= -20 &&
    origin.y <= height + 20
  ) {
    const originLabelX = Math.min(Math.max(origin.x - 6, 12), width - 16);
    const originLabelY = Math.min(Math.max(origin.y + 14, 14), height - 12);
    drawTextPill('0', originLabelX, originLabelY, 'right', 'top');
  }

  ctx.restore();
}
