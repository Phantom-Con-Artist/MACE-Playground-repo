import { describe, it, expect } from 'vitest';
import { classifyAndParse, compileExpression } from '../evaluator';

describe('Built-in evaluator and compiler', () => {
  it('evaluates basic arithmetic', () => {
    const fn = compileExpression('2 + 3 * 4');
    expect(fn({})).toBe(14);
  });

  it('evaluates expressions with variables and exponents', () => {
    const fn = compileExpression('a * x^2 + b * x + c');
    expect(fn({ a: 2, b: 3, c: 1, x: 2 })).toBe(2 * 4 + 3 * 2 + 1); // 15
  });

  it('evaluates trigonometric functions and constants', () => {
    const fn = compileExpression('sin(pi / 2)');
    expect(fn({})).toBeCloseTo(1);

    const fnCos = compileExpression('cos(0)');
    expect(fnCos({})).toBeCloseTo(1);
  });

  it('handles implicit multiplication', () => {
    const fn = compileExpression('2x + 3');
    expect(fn({ x: 5 })).toBe(13);

    const fn2 = compileExpression('(x+1)(x-1)');
    expect(fn2({ x: 4 })).toBe(15);
  });
});

describe('classifyAndParse', () => {
  it('correctly classifies explicit y expressions', () => {
    const p1 = classifyAndParse('y = sin(x)');
    expect(p1).not.toBeNull();
    expect(p1?.type).toBe('explicit_y');
    expect(p1?.evaluate({ x: 0 })).toBeCloseTo(0);

    const p2 = classifyAndParse('y = a*x + b');
    expect(p2?.type).toBe('explicit_y');
    expect(p2?.evaluate({ x: 2, a: 3, b: 1 })).toBe(7);

    const p3 = classifyAndParse('cos(x)');
    expect(p3?.type).toBe('explicit_y');
    expect(p3?.evaluate({ x: 0 })).toBeCloseTo(1);
  });

  it('correctly classifies explicit x expressions', () => {
    const p = classifyAndParse('x = y^2');
    expect(p).not.toBeNull();
    expect(p?.type).toBe('explicit_x');
    expect(p?.evaluate({ y: 3 })).toBe(9);
  });

  it('correctly classifies implicit equations', () => {
    const p = classifyAndParse('x^2 + y^2 = 25');
    expect(p).not.toBeNull();
    expect(p?.type).toBe('implicit');
    // On the circle (3, 4): 3^2 + 4^2 - 25 = 0
    expect(p?.evaluate({ x: 3, y: 4 })).toBeCloseTo(0);
    // Outside the circle (0, 0): 0 - 25 = -25
    expect(p?.evaluate({ x: 0, y: 0 })).toBeCloseTo(-25);
  });
});
