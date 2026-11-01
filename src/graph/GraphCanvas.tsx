import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { GraphCanvasProps } from './types';
import { renderGridAndAxes } from './gridRenderer';
import { renderCurves } from './curveRenderer';
import { useGraphInteraction } from './interaction';

export interface GraphCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(
  (
    {
      expressions = [],
      variables = {},
      className = '',
      theme,
      initialCenterX = 0,
      initialCenterY = 0,
      initialPixelsPerUnit = 40,
      onViewportChange,
      onHoverPoint,
      customEvaluator,
      showControls = false,
      showCoordinates = true,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const {
      viewport,
      setDimensions,
      hoverPoint,
      isDragging,
      handlers,
      zoomIn,
      zoomOut,
      resetView,
    } = useGraphInteraction({
      initialCenterX,
      initialCenterY,
      initialPixelsPerUnit,
      onViewportChange,
      onHoverPoint,
    });

    useImperativeHandle(
      ref,
      () => ({
        zoomIn,
        zoomOut,
        resetView,
      }),
      [zoomIn, zoomOut, resetView]
    );

    // Track container resize
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            setDimensions(Math.floor(width), Math.floor(height));
          }
        }
      });

      observer.observe(container);
      return () => observer.disconnect();
    }, [setDimensions]);

    // Main canvas render loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animId: number;

      const draw = () => {
        const dpr = window.devicePixelRatio || 1;
        const width = viewport.width;
        const height = viewport.height;

        // Adjust internal canvas buffer dimensions for HiDPI
        const displayWidth = Math.round(width * dpr);
        const displayHeight = Math.round(height * dpr);

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;
        }

        ctx.save();
        ctx.scale(dpr, dpr);

        // 1. Grid & readable axes
        renderGridAndAxes(ctx, viewport, theme);

        // 2. Expressions curves
        renderCurves(ctx, expressions, variables, viewport, customEvaluator);

        ctx.restore();
      };

      animId = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(animId);
    }, [viewport, expressions, variables, theme, customEvaluator]);

    return (
      <div
        ref={containerRef}
        className={`graph-canvas-container ${className}`.trim()}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: '300px',
          overflow: 'hidden',
          userSelect: 'none',
          background: theme?.backgroundColor || '#ffffff',
        }}
      >
        <canvas
          ref={canvasRef}
          className="calc-canvas"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            cursor: isDragging ? 'grabbing' : 'grab',
            touchAction: 'none',
          }}
          onPointerDown={handlers.onPointerDown}
          onPointerMove={handlers.onPointerMove}
          onPointerUp={handlers.onPointerUp}
          onPointerCancel={handlers.onPointerCancel}
          onWheel={handlers.onWheel}
          onMouseLeave={handlers.onMouseLeave}
        />

        {/* Floating Controls if requested */}
        {showControls && (
          <div
            style={{
              position: 'absolute',
              right: 16,
              bottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              zIndex: 10,
            }}
          >
            <button
              type="button"
              title="Zoom In"
              aria-label="Zoom in"
              onClick={zoomIn}
              style={buttonStyle}
            >
              +
            </button>
            <button
              type="button"
              title="Zoom Out"
              aria-label="Zoom out"
              onClick={zoomOut}
              style={buttonStyle}
            >
              −
            </button>
            <button
              type="button"
              title="Reset View"
              aria-label="Reset view"
              onClick={resetView}
              style={buttonStyle}
            >
              ⌂
            </button>
          </div>
        )}

        {/* Hover Coordinates Readout Badge */}
        {showCoordinates && hoverPoint && (
          <div
            style={{
              position: 'absolute',
              left: 14,
              bottom: 14,
              padding: '4px 8px',
              background: 'rgba(255, 255, 255, 0.88)',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#334155',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            ({hoverPoint.x.toFixed(3)}, {hoverPoint.y.toFixed(3)})
          </div>
        )}
      </div>
    );
  }
);

const buttonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  background: 'rgba(255, 255, 255, 0.92)',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  fontSize: 16,
  fontWeight: 'bold',
  color: '#334155',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'background 0.15s ease, transform 0.1s ease',
};

export default GraphCanvas;
