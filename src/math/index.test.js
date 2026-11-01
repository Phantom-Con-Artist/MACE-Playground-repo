import { describe, it, expect } from 'vitest';
import { parseExpression, evaluate, extractVariables, tokenize } from './index';

describe('Math Parser and Evaluator', () => {
  describe('Basic Expressions and Explicit functions', () => {
    it('parses and evaluates y = sin(x)', () => {
      const parsed = parseExpression('y = sin(x)');
      expect(parsed.type).toBe('explicit_y');
      expect(parsed.variables).toEqual([]);
      expect(evaluate(parsed, { x: 0 })).toBeCloseTo(0);
      expect(evaluate(parsed, { x: Math.PI / 2 })).toBeCloseTo(1);
    });

    it('treats expression without equals as y = expr', () => {
      const parsed = parseExpression('sin(x)');
      expect(parsed.type).toBe('explicit_y');
      expect(evaluate(parsed, { x: Math.PI })).toBeCloseTo(0);
    });

    it('evaluates powers and order of operations', () => {
      const parsed = parseExpression('y = 2 * x^2 + 3 * x - 5');
      expect(evaluate(parsed, { x: 2 })).toBe(2 * 4 + 6 - 5); // 9
      expect(evaluate(parsed, { x: 0 })).toBe(-5);
    });

    it('supports constants pi and e', () => {
      const parsed = parseExpression('y = pi * e');
      expect(evaluate(parsed, {})).toBeCloseTo(Math.PI * Math.E);
    });
  });

  describe('Implicit relations', () => {
    it('parses and evaluates circle x^2 + y^2 = 25', () => {
      const parsed = parseExpression('x^2 + y^2 = 25');
      expect(parsed.type).toBe('implicit');
      // At (3, 4): 3^2 + 4^2 - 25 = 0
      expect(evaluate(parsed, { x: 3, y: 4 })).toBe(0);
      // At (5, 0): 5^2 + 0^2 - 25 = 0
      expect(evaluate(parsed, { x: 5, y: 0 })).toBe(0);
      // At (0, 0): 0 - 25 = -25
      expect(evaluate(parsed, { x: 0, y: 0 })).toBe(-25);
    });
  });

  describe('Parameters and Variables', () => {
    it('detects free variables and evaluates y = a*x + b', () => {
      const parsed = parseExpression('y = a*x + b');
      expect(parsed.type).toBe('explicit_y');
      expect(parsed.variables.sort()).toEqual(['a', 'b']);
      expect(evaluate(parsed, { x: 4, a: 2, b: 3 })).toBe(11);
    });

    it('extractVariables returns parameter names list', () => {
      expect(extractVariables('y = a*x + b').sort()).toEqual(['a', 'b']);
      expect(extractVariables('y = sin(x)')).toEqual([]);
      expect(extractVariables('x^2 + y^2 = r^2')).toEqual(['r']);
    });

    it('supports implicit multiplication like 2x or ax', () => {
      const parsed = parseExpression('y = 2x + 1');
      expect(evaluate(parsed, { x: 3 })).toBe(7);
    });
  });

  describe('Error Handling Resilience', () => {
    it('throws error for empty input', () => {
      expect(() => parseExpression('')).toThrow('Expression cannot be empty');
      expect(() => parseExpression('   ')).toThrow('Expression cannot be empty');
    });

    it('throws error for mismatched parentheses', () => {
      expect(() => parseExpression('y = (x + 1')).toThrow();
      expect(() => parseExpression('y = x + 1)')).toThrow();
    });

    it('throws error for multiple equality signs', () => {
      expect(() => parseExpression('y = x = 2')).toThrow('only one "=" allowed');
    });

    it('throws error for unexpected symbols', () => {
      expect(() => parseExpression('y = x @ 2')).toThrow('Unexpected character: "@"');
    });

    it('throws error when variable in scope is missing', () => {
      const parsed = parseExpression('y = m * x + c');
      expect(() => evaluate(parsed, { x: 1 })).toThrow('Undefined variable');
    });
  });
});
