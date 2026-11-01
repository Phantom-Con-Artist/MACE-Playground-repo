import type { Bounds, Point, Viewport } from './types';

export function screenToMath(screenX: number, screenY: number, viewport: Viewport): Point {
  const { centerX, centerY, pixelsPerUnit, width, height } = viewport;
  const x = (screenX - width / 2) / pixelsPerUnit + centerX;
  const y = (height / 2 - screenY) / pixelsPerUnit + centerY;
  return { x, y };
}

export function mathToScreen(mathX: number, mathY: number, viewport: Viewport): Point {
  const { centerX, centerY, pixelsPerUnit, width, height } = viewport;
  const x = (mathX - centerX) * pixelsPerUnit + width / 2;
  const y = height / 2 - (mathY - centerY) * pixelsPerUnit;
  return { x, y };
}

export function getViewportBounds(viewport: Viewport): Bounds {
  const topLeft = screenToMath(0, 0, viewport);
  const bottomRight = screenToMath(viewport.width, viewport.height, viewport);
  return {
    xMin: topLeft.x,
    xMax: bottomRight.x,
    yMin: bottomRight.y,
    yMax: topLeft.y,
  };
}

export interface GridSteps {
  major: number;
  minor: number;
}

export function calculateGridStep(pixelsPerUnit: number, targetPixelSpacing = 80): GridSteps {
  if (pixelsPerUnit <= 0 || !Number.isFinite(pixelsPerUnit)) {
    return { major: 1, minor: 0.2 };
  }

  const rawStep = targetPixelSpacing / pixelsPerUnit;
  const power = Math.floor(Math.log10(rawStep));
  const magnitude = Math.pow(10, power);
  const normalized = rawStep / magnitude;

  let major: number;
  let minor: number;

  if (normalized < 1.5) {
    major = 1 * magnitude;
    minor = major / 5;
  } else if (normalized < 3.5) {
    major = 2 * magnitude;
    minor = major / 4;
  } else if (normalized < 7.5) {
    major = 5 * magnitude;
    minor = major / 5;
  } else {
    major = 10 * magnitude;
    minor = major / 5;
  }

  return { major, minor };
}

export function formatTick(value: number): string {
  if (Math.abs(value) < 1e-12) {
    return '0';
  }

  const absVal = Math.abs(value);
  if (absVal >= 1e7 || (absVal < 1e-4 && absVal > 0)) {
    return value.toExponential(2).replace(/\.0+e/, 'e');
  }

  // Round to eliminate floating point representations like 0.30000000000000004
  const rounded = Number(value.toPrecision(10));
  return String(rounded);
}
