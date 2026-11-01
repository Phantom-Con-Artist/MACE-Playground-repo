import React, { useCallback, useRef, useState } from 'react';
import type { Point, Viewport } from './types';
import { screenToMath } from './coords';

export interface UseGraphInteractionOptions {
  initialCenterX?: number;
  initialCenterY?: number;
  initialPixelsPerUnit?: number;
  onViewportChange?: (viewport: Viewport) => void;
  onHoverPoint?: (point: Point | null) => void;
}

export interface UseGraphInteractionReturn {
  viewport: Viewport;
  setDimensions: (width: number, height: number) => void;
  hoverPoint: Point | null;
  isDragging: boolean;
  handlers: {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onWheel: (e: React.WheelEvent<HTMLCanvasElement>) => void;
    onMouseLeave: () => void;
  };
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
}

const MIN_PIXELS_PER_UNIT = 1e-4;
const MAX_PIXELS_PER_UNIT = 1e5;

export function useGraphInteraction(
  options?: UseGraphInteractionOptions
): UseGraphInteractionReturn {
  const initialCenterX = options?.initialCenterX ?? 0;
  const initialCenterY = options?.initialCenterY ?? 0;
  const initialPixelsPerUnit = options?.initialPixelsPerUnit ?? 40;

  const [viewport, setViewport] = useState<Viewport>({
    centerX: initialCenterX,
    centerY: initialCenterY,
    pixelsPerUnit: initialPixelsPerUnit,
    width: 600,
    height: 400,
  });

  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    isDragging: boolean;
    lastX: number;
    lastY: number;
    activePointers: Map<number, { x: number; y: number }>;
    initialPinchDistance: number | null;
    initialPinchScale: number;
  }>({
    isDragging: false,
    lastX: 0,
    lastY: 0,
    activePointers: new Map(),
    initialPinchDistance: null,
    initialPinchScale: initialPixelsPerUnit,
  });

  const notifyViewport = useCallback(
    (newViewport: Viewport) => {
      if (options?.onViewportChange) {
        options.onViewportChange(newViewport);
      }
    },
    [options]
  );

  const setDimensions = useCallback(
    (width: number, height: number) => {
      setViewport((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        const updated = { ...prev, width, height };
        notifyViewport(updated);
        return updated;
      });
    },
    [notifyViewport]
  );

  const getCanvasRelativePoint = (
    e: React.PointerEvent<HTMLCanvasElement> | React.WheelEvent<HTMLCanvasElement>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = getCanvasRelativePoint(e);

    dragRef.current.activePointers.set(e.pointerId, { x, y });
    dragRef.current.isDragging = true;
    dragRef.current.lastX = x;
    dragRef.current.lastY = y;
    setIsDragging(true);

    if (dragRef.current.activePointers.size === 2) {
      // Initialize pinch gesture
      const pts = Array.from(dragRef.current.activePointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      dragRef.current.initialPinchDistance = dist;
      dragRef.current.initialPinchScale = viewport.pixelsPerUnit;
    }
  }, [viewport.pixelsPerUnit]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasRelativePoint(e);

      // Update hover math point
      const mathPt = screenToMath(x, y, viewport);
      setHoverPoint(mathPt);
      if (options?.onHoverPoint) {
        options.onHoverPoint(mathPt);
      }

      if (!dragRef.current.isDragging) return;

      dragRef.current.activePointers.set(e.pointerId, { x, y });

      if (dragRef.current.activePointers.size === 2 && dragRef.current.initialPinchDistance) {
        // Pinch zoom
        const pts = Array.from(dragRef.current.activePointers.values());
        const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const pinchRatio = currentDist / dragRef.current.initialPinchDistance;

        const newScale = Math.max(
          MIN_PIXELS_PER_UNIT,
          Math.min(MAX_PIXELS_PER_UNIT, dragRef.current.initialPinchScale * pinchRatio)
        );

        setViewport((prev) => {
          const updated = { ...prev, pixelsPerUnit: newScale };
          notifyViewport(updated);
          return updated;
        });
        return;
      }

      // Pan drag
      const dx = x - dragRef.current.lastX;
      const dy = y - dragRef.current.lastY;
      dragRef.current.lastX = x;
      dragRef.current.lastY = y;

      setViewport((prev) => {
        const deltaCenterX = dx / prev.pixelsPerUnit;
        const deltaCenterY = dy / prev.pixelsPerUnit;
        const updated = {
          ...prev,
          centerX: prev.centerX - deltaCenterX,
          centerY: prev.centerY + deltaCenterY,
        };
        notifyViewport(updated);
        return updated;
      });
    },
    [viewport, notifyViewport, options]
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      dragRef.current.activePointers.delete(e.pointerId);
      if (dragRef.current.activePointers.size === 0) {
        dragRef.current.isDragging = false;
        dragRef.current.initialPinchDistance = null;
        setIsDragging(false);
      }
    },
    []
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore capture release error
      }
      endDrag(e);
    },
    [endDrag]
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      endDrag(e);
    },
    [endDrag]
  );

  const onMouseLeave = useCallback(() => {
    setHoverPoint(null);
    if (options?.onHoverPoint) {
      options.onHoverPoint(null);
    }
  }, [options]);

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const { x, y } = getCanvasRelativePoint(e);

      // Smooth zoom centered on cursor
      const zoomFactor = Math.exp(-e.deltaY * 0.0015);

      setViewport((prev) => {
        const targetScale = prev.pixelsPerUnit * zoomFactor;
        const newPixelsPerUnit = Math.max(
          MIN_PIXELS_PER_UNIT,
          Math.min(MAX_PIXELS_PER_UNIT, targetScale)
        );

        if (newPixelsPerUnit === prev.pixelsPerUnit) return prev;

        const cursorMath = screenToMath(x, y, prev);
        const newCenterX = cursorMath.x - (x - prev.width / 2) / newPixelsPerUnit;
        const newCenterY = cursorMath.y - (prev.height / 2 - y) / newPixelsPerUnit;

        const updated: Viewport = {
          ...prev,
          centerX: newCenterX,
          centerY: newCenterY,
          pixelsPerUnit: newPixelsPerUnit,
        };
        notifyViewport(updated);
        return updated;
      });
    },
    [notifyViewport]
  );

  const zoomIn = useCallback(() => {
    const factor = 1.25;
    setViewport((prev) => {
      const newScale = Math.min(MAX_PIXELS_PER_UNIT, prev.pixelsPerUnit * factor);
      const updated = { ...prev, pixelsPerUnit: newScale };
      notifyViewport(updated);
      return updated;
    });
  }, [notifyViewport]);

  const zoomOut = useCallback(() => {
    const factor = 0.8;
    setViewport((prev) => {
      const newScale = Math.max(MIN_PIXELS_PER_UNIT, prev.pixelsPerUnit * factor);
      const updated = { ...prev, pixelsPerUnit: newScale };
      notifyViewport(updated);
      return updated;
    });
  }, [notifyViewport]);

  const resetView = useCallback(() => {
    setViewport((prev) => {
      const updated: Viewport = {
        ...prev,
        centerX: initialCenterX,
        centerY: initialCenterY,
        pixelsPerUnit: initialPixelsPerUnit,
      };
      notifyViewport(updated);
      return updated;
    });
  }, [initialCenterX, initialCenterY, initialPixelsPerUnit, notifyViewport]);

  return {
    viewport,
    setDimensions,
    hoverPoint,
    isDragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onWheel,
      onMouseLeave,
    },
    zoomIn,
    zoomOut,
    resetView,
    setViewport,
  };
}
