import { describe, it, expect } from 'vitest';
import {
  calculateGridStep,
  formatTick,
  getViewportBounds,
  mathToScreen,
  screenToMath,
} from '../coords';
import { Viewport } from '../types';

describe('Coordinate transformations', () => {
  const viewport: Viewport = {
    centerX: 0,
    centerY: 0,
    pixelsPerUnit: 50,
    width: 500,
    height: 500,
  };

  it('transforms origin (0, 0) correctly', () => {
    const screenCenter = mathToScreen(0, 0, viewport);
    expect(screenCenter.x).toBe(250);
    expect(screenCenter.y).toBe(250);

    const mathCenter = screenToMath(250, 250, viewport);
    expect(mathCenter.x).toBeCloseTo(0);
    expect(mathCenter.y).toBeCloseTo(0);
  });

  it('transforms math coords to screen coords with correct orientation', () => {
    // math (2, 3): x should be right (250 + 2*50 = 350), y should be up (250 - 3*50 = 100)
    const screenPt = mathToScreen(2, 3, viewport);
    expect(screenPt.x).toBe(350);
    expect(screenPt.y).toBe(100);

    const mathPt = screenToMath(350, 100, viewport);
    expect(mathPt.x).toBeCloseTo(2);
    expect(mathPt.y).toBeCloseTo(3);
  });

  it('handles offset centers during panning', () => {
    const pannedViewport: Viewport = {
      ...viewport,
      centerX: 5,
      centerY: -2,
    };

    const screenCenter = mathToScreen(5, -2, pannedViewport);
    expect(screenCenter.x).toBe(250);
    expect(screenCenter.y).toBe(250);

    const mathPt = screenToMath(250, 250, pannedViewport);
    expect(mathPt.x).toBeCloseTo(5);
    expect(mathPt.y).toBeCloseTo(-2);
  });

  it('calculates viewport bounds accurately', () => {
    const bounds = getViewportBounds(viewport);
    expect(bounds.xMin).toBeCloseTo(-5);
    expect(bounds.xMax).toBeCloseTo(5);
    expect(bounds.yMin).toBeCloseTo(-5);
    expect(bounds.yMax).toBeCloseTo(5);
  });
});

describe('calculateGridStep', () => {
  it('returns appropriate steps for various zoom levels', () => {
    // 50 px per unit -> ~80 px spacing -> step ~ 1 or 2
    const step1 = calculateGridStep(50);
    expect(step1.major).toBeGreaterThan(0);
    expect(step1.minor).toBeLessThan(step1.major);

    // Zoomed in: 500 px per unit -> step should be ~0.2 or 0.1
    const stepZoomIn = calculateGridStep(500);
    expect(stepZoomIn.major).toBeLessThanOrEqual(0.2);

    // Zoomed out: 5 px per unit -> step should be ~10 or 20
    const stepZoomOut = calculateGridStep(5);
    expect(stepZoomOut.major).toBeGreaterThanOrEqual(10);
  });
});

describe('formatTick', () => {
  it('formats zero cleanly', () => {
    expect(formatTick(0)).toBe('0');
    expect(formatTick(1e-13)).toBe('0');
  });

  it('formats clean integers and decimals without float precision noise', () => {
    expect(formatTick(5)).toBe('5');
    expect(formatTick(-10)).toBe('-10');
    expect(formatTick(0.30000000000000004)).toBe('0.3');
    expect(formatTick(-0.25)).toBe('-0.25');
  });
});
