import React, { useRef, useEffect, useState, useCallback } from 'react';
import { parseExpression, evaluate } from '../math/index';

/**
 * Calculates a readable step size for grid lines based on view range.
 */
function getNiceStep(range) {
  const rawStep = range / 8;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;

  let nice;
  if (normalized < 1.5) nice = 1;
  else if (normalized < 3.5) nice = 2;
  else if (normalized < 7.5) nice = 5;
  else nice = 10;

  return nice * magnitude;
}

export default function GraphCanvas({
  rows = [],
  variables = {},
  view,
  onViewChange,
  onRowError,
}) {
  const canvasRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, view: null });

  // Draw graph whenever rows, variables, or view change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Coordinate helpers
    const { xMin, xMax, yMin, yMax } = view;
    const toScreenX = (x) => ((x - xMin) / (xMax - xMin)) * width;
    const toScreenY = (y) => ((yMax - y) / (yMax - yMin)) * height;
    const toMathX = (sx) => xMin + (sx / width) * (xMax - xMin);
    const toMathY = (sy) => yMax - (sy / height) * (yMax - yMin);

    // 1. Clear background
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Grid
    const xStep = getNiceStep(xMax - xMin);
    const yStep = getNiceStep(yMax - yMin);

    const firstX = Math.floor(xMin / xStep) * xStep;
    const firstY = Math.floor(yMin / yStep) * yStep;

    // Minor / major grid lines
    ctx.lineWidth = 1;

    // Vertical grid lines & X-axis labels
    for (let x = firstX; x <= xMax + xStep; x += xStep) {
      const sx = toScreenX(x);
      const isZero = Math.abs(x) < 1e-9;

      ctx.strokeStyle = isZero ? '#1c1917' : '#e4ded4';
      ctx.lineWidth = isZero ? 1.5 : 1;

      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();

      // Label
      if (!isZero) {
        ctx.fillStyle = '#78716c';
        ctx.font = '11px "JetBrains Mono", monospace';
        const sy = Math.max(16, Math.min(height - 6, toScreenY(0) + 14));
        ctx.fillText(Number(x.toFixed(4)).toString(), sx + 3, sy);
      }
    }

    // Horizontal grid lines & Y-axis labels
    for (let y = firstY; y <= yMax + yStep; y += yStep) {
      const sy = toScreenY(y);
      const isZero = Math.abs(y) < 1e-9;

      ctx.strokeStyle = isZero ? '#1c1917' : '#e4ded4';
      ctx.lineWidth = isZero ? 1.5 : 1;

      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();

      // Label
      if (!isZero) {
        ctx.fillStyle = '#78716c';
        ctx.font = '11px "JetBrains Mono", monospace';
        const sx = Math.max(4, Math.min(width - 36, toScreenX(0) + 4));
        ctx.fillText(Number(y.toFixed(4)).toString(), sx, sy - 3);
      }
    }

    // Origin label '0'
    const originSx = toScreenX(0);
    const originSy = toScreenY(0);
    if (originSx >= 0 && originSx <= width && originSy >= 0 && originSy <= height) {
      ctx.fillStyle = '#78716c';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText('0', originSx + 3, originSy + 14);
    }

    // 3. Render expressions safely
    rows.forEach((row) => {
      if (!row.visible || !row.expression.trim()) return;

      try {
        const parsed = parseExpression(row.expression);
        const scope = { ...variables };

        ctx.strokeStyle = row.color || '#2563eb';
        ctx.lineWidth = 2.2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        if (parsed.type === 'explicit_y') {
          ctx.beginPath();
          let started = false;
          const numSamples = width * 2; // sub-pixel resolution
          const dx = (xMax - xMin) / numSamples;

          for (let i = 0; i <= numSamples; i++) {
            const mathX = xMin + i * dx;
            scope.x = mathX;

            let mathY;
            try {
              mathY = evaluate(parsed, scope);
            } catch {
              mathY = NaN;
            }

            if (Number.isFinite(mathY)) {
              const sx = toScreenX(mathX);
              const sy = toScreenY(mathY);

              // Clip extremes to prevent drawing glitches across asymptotes
              if (sy < -height * 2 || sy > height * 3) {
                started = false;
                continue;
              }

              if (!started) {
                ctx.moveTo(sx, sy);
                started = true;
              } else {
                ctx.lineTo(sx, sy);
              }
            } else {
              started = false;
            }
          }
          ctx.stroke();
        } else if (parsed.type === 'explicit_x') {
          ctx.beginPath();
          let started = false;
          const numSamples = height * 2;
          const dy = (yMax - yMin) / numSamples;

          for (let i = 0; i <= numSamples; i++) {
            const mathY = yMin + i * dy;
            scope.y = mathY;

            let mathX;
            try {
              mathX = evaluate(parsed, scope);
            } catch {
              mathX = NaN;
            }

            if (Number.isFinite(mathX)) {
              const sx = toScreenX(mathX);
              const sy = toScreenY(mathY);

              if (sx < -width * 2 || sx > width * 3) {
                started = false;
                continue;
              }

              if (!started) {
                ctx.moveTo(sx, sy);
                started = true;
              } else {
                ctx.lineTo(sx, sy);
              }
            } else {
              started = false;
            }
          }
          ctx.stroke();
        } else if (parsed.type === 'implicit') {
          // Implicit contour rendering (e.g. x^2 + y^2 = 25)
          // 2D grid sampling with linear interpolation segment plotting
          const gridSize = 160;
          const cellW = width / gridSize;
          const cellH = height / gridSize;

          const gridValues = new Float64Array((gridSize + 1) * (gridSize + 1));
          for (let gy = 0; gy <= gridSize; gy++) {
            const my = toMathY(gy * cellH);
            scope.y = my;
            const rowOffset = gy * (gridSize + 1);
            for (let gx = 0; gx <= gridSize; gx++) {
              const mx = toMathX(gx * cellW);
              scope.x = mx;
              try {
                gridValues[rowOffset + gx] = evaluate(parsed, scope);
              } catch {
                gridValues[rowOffset + gx] = NaN;
              }
            }
          }

          ctx.beginPath();
          for (let gy = 0; gy < gridSize; gy++) {
            const rowA = gy * (gridSize + 1);
            const rowB = (gy + 1) * (gridSize + 1);
            for (let gx = 0; gx < gridSize; gx++) {
              const vTL = gridValues[rowA + gx];
              const vTR = gridValues[rowA + gx + 1];
              const vBL = gridValues[rowB + gx];
              const vBR = gridValues[rowB + gx + 1];

              if (!Number.isFinite(vTL) || !Number.isFinite(vTR) || !Number.isFinite(vBL) || !Number.isFinite(vBR)) {
                continue;
              }

              const sx = gx * cellW;
              const sy = gy * cellH;

              // Marching squares segment drawing
              // Check horizontal crossing: top edge (vTL to vTR)
              if ((vTL >= 0 && vTR < 0) || (vTL < 0 && vTR >= 0)) {
                const t = Math.abs(vTL) / (Math.abs(vTL) + Math.abs(vTR) + 1e-12);
                const xCross = sx + t * cellW;
                // Check other edges for paired crossing
                if ((vBL >= 0 && vBR < 0) || (vBL < 0 && vBR >= 0)) {
                  const tb = Math.abs(vBL) / (Math.abs(vBL) + Math.abs(vBR) + 1e-12);
                  ctx.moveTo(xCross, sy);
                  ctx.lineTo(sx + tb * cellW, sy + cellH);
                } else if ((vTL >= 0 && vBL < 0) || (vTL < 0 && vBL >= 0)) {
                  const tl = Math.abs(vTL) / (Math.abs(vTL) + Math.abs(vBL) + 1e-12);
                  ctx.moveTo(xCross, sy);
                  ctx.lineTo(sx, sy + tl * cellH);
                } else if ((vTR >= 0 && vBR < 0) || (vTR < 0 && vBR >= 0)) {
                  const tr = Math.abs(vTR) / (Math.abs(vTR) + Math.abs(vBR) + 1e-12);
                  ctx.moveTo(xCross, sy);
                  ctx.lineTo(sx + cellW, sy + tr * cellH);
                }
              } else if ((vTL >= 0 && vBL < 0) || (vTL < 0 && vBL >= 0)) {
                // Left edge crosses
                const tl = Math.abs(vTL) / (Math.abs(vTL) + Math.abs(vBL) + 1e-12);
                const yCross = sy + tl * cellH;
                if ((vTR >= 0 && vBR < 0) || (vTR < 0 && vBR >= 0)) {
                  const tr = Math.abs(vTR) / (Math.abs(vTR) + Math.abs(vBR) + 1e-12);
                  ctx.moveTo(sx, yCross);
                  ctx.lineTo(sx + cellW, sy + tr * cellH);
                } else if ((vBL >= 0 && vBR < 0) || (vBL < 0 && vBR >= 0)) {
                  const tb = Math.abs(vBL) / (Math.abs(vBL) + Math.abs(vBR) + 1e-12);
                  ctx.moveTo(sx, yCross);
                  ctx.lineTo(sx + tb * cellW, sy + cellH);
                }
              }
            }
          }
          ctx.stroke();
        }
      } catch (err) {
        // Safe: log or notify row error without breaking canvas
        if (onRowError) {
          onRowError(row.id, err.message);
        }
      }
    });

    ctx.restore();
  }, [rows, variables, view, onRowError]);

  // Pan interactions
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      view: { ...view },
    };
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const initView = dragStartRef.current.view;

    const spanX = initView.xMax - initView.xMin;
    const spanY = initView.yMax - initView.yMin;

    const mathDx = (dx / canvas.clientWidth) * spanX;
    const mathDy = (dy / canvas.clientHeight) * spanY;

    onViewChange({
      xMin: initView.xMin - mathDx,
      xMax: initView.xMax - mathDx,
      yMin: initView.yMin + mathDy,
      yMax: initView.yMax + mathDy,
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Wheel Zoom interaction
  const handleWheel = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cursorSx = e.clientX - rect.left;
    const cursorSy = e.clientY - rect.top;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const mathX = view.xMin + (cursorSx / width) * (view.xMax - view.xMin);
    const mathY = view.yMax - (cursorSy / height) * (view.yMax - view.yMin);

    const zoomFactor = e.deltaY < 0 ? 0.85 : 1.18;

    const newSpanX = (view.xMax - view.xMin) * zoomFactor;
    const newSpanY = (view.yMax - view.yMin) * zoomFactor;

    const fractionX = cursorSx / width;
    const fractionY = cursorSy / height;

    onViewChange({
      xMin: mathX - fractionX * newSpanX,
      xMax: mathX + (1 - fractionX) * newSpanX,
      yMin: mathY - (1 - fractionY) * newSpanY,
      yMax: mathY + fractionY * newSpanY,
    });
  };

  return (
    <canvas
      ref={canvasRef}
      className="calc-canvas"
      style={{ width: '100%', height: '100%', cursor: 'grab', display: 'block' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    />
  );
}
