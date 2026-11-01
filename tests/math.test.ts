import { test } from "vitest";
import assert from 'node:assert/strict';
import {
  parseExpression,
  tryParseExpression,
  evaluate,
  extractVariables,
  getFreeParameters,
  MathError,
} from '../src/math/index.ts';

test('Owner requirement 1: y = sin(x)', () => {
  const parsed = parseExpression('y = sin(x)');
  assert.equal(parsed.type, 'explicit_y');
  assert.deepEqual(parsed.variables.sort(), ['x']);
  assert.deepEqual(parsed.parameters, []);

  assert.ok(Math.abs(parsed.evaluateY!(0) - 0) < 1e-9);
  assert.ok(Math.abs(parsed.evaluateY!(Math.PI / 2) - 1) < 1e-9);
  assert.ok(Math.abs(parsed.evaluateY!(Math.PI) - 0) < 1e-9);

  // evaluate directly
  assert.ok(Math.abs(evaluate(parsed, { x: Math.PI / 2 }) - 1) < 1e-9);
});

test('Owner requirement 2: x^2 + y^2 = 25', () => {
  const parsed = parseExpression('x^2 + y^2 = 25');
  assert.equal(parsed.type, 'implicit');
  assert.deepEqual(parsed.variables.sort(), ['x', 'y']);
  assert.deepEqual(parsed.parameters, []);

  // Points on the circle: LHS - RHS should be 0
  assert.equal(parsed.evaluateImplicit!(3, 4), 0);
  assert.equal(parsed.evaluateImplicit!(0, 5), 0);
  assert.equal(parsed.evaluateImplicit!(5, 0), 0);
  assert.equal(parsed.evaluateImplicit!(-5, 0), 0);

  // Center (0, 0): 0 - 25 = -25
  assert.equal(parsed.evaluateImplicit!(0, 0), -25);

  // Outside (6, 0): 36 - 25 = 11
  assert.equal(parsed.evaluateImplicit!(6, 0), 11);
});

test('Owner requirement 3: y = a*x + b with sliders', () => {
  const parsed = parseExpression('y = a*x + b');
  assert.equal(parsed.type, 'explicit_y');
  assert.deepEqual(parsed.parameters.sort(), ['a', 'b']);

  // Test with slider values a = 2, b = 3
  const sliders = { a: 2, b: 3 };
  assert.equal(parsed.evaluateY!(0, sliders), 3);
  assert.equal(parsed.evaluateY!(4, sliders), 11);
  assert.equal(parsed.evaluateY!(-1, sliders), 1);

  // Test top-level evaluate
  assert.equal(evaluate('y = a*x + b', { x: 4, a: 2, b: 3 }), 11);
});

test('Implicit multiplication cases', () => {
  // 2x
  assert.equal(evaluate('2x', { x: 5 }), 10);

  // 2(x + 1)
  assert.equal(evaluate('2(x + 1)', { x: 3 }), 8);

  // (x + 1)(x - 1)
  assert.equal(evaluate('(x + 1)(x - 1)', { x: 5 }), 24);

  // a x
  assert.equal(evaluate('a x', { a: 3, x: 4 }), 12);

  // 2sin(x)
  assert.ok(Math.abs(evaluate('2sin(x)', { x: Math.PI / 2 }) - 2) < 1e-9);

  // 3pi
  assert.ok(Math.abs(evaluate('3pi') - 3 * Math.PI) < 1e-9);
});

test('Operator precedence and associativity', () => {
  // Addition and multiplication
  assert.equal(evaluate('1 + 2 * 3'), 7);
  assert.equal(evaluate('(1 + 2) * 3'), 9);

  // Exponentiation right-associativity: 2 ^ 3 ^ 2 = 2 ^ 9 = 512
  assert.equal(evaluate('2 ^ 3 ^ 2'), 512);

  // Unary minus vs power: -2^2 = -4, (-2)^2 = 4
  assert.equal(evaluate('-2^2'), -4);
  assert.equal(evaluate('(-2)^2'), 4);
  assert.equal(evaluate('-(2^2)'), -4);

  // Division and modulo
  assert.equal(evaluate('10 / 2 - 3'), 2);
  assert.equal(evaluate('7 % 4'), 3);
});

test('Built-in constants and functions', () => {
  assert.equal(evaluate('pi'), Math.PI);
  assert.equal(evaluate('e'), Math.E);
  assert.equal(evaluate('tau'), 2 * Math.PI);

  assert.equal(evaluate('cos(0)'), 1);
  assert.equal(evaluate('tan(0)'), 0);
  assert.equal(evaluate('sqrt(16)'), 4);
  assert.equal(evaluate('cbrt(27)'), 3);
  assert.equal(evaluate('abs(-42)'), 42);
  assert.equal(evaluate('exp(0)'), 1);
  assert.equal(evaluate('ln(e)'), 1);
  assert.equal(evaluate('log10(1000)'), 3);
  assert.equal(evaluate('log(100)'), 2);
  assert.equal(evaluate('floor(3.9)'), 3);
  assert.equal(evaluate('ceil(3.1)'), 4);
  assert.equal(evaluate('min(5, 2, 8)'), 2);
  assert.equal(evaluate('max(5, 2, 8)'), 8);
});

test('Explicit x equations: x = f(y)', () => {
  const line = parseExpression('x = 5');
  assert.equal(line.type, 'explicit_x');
  assert.equal(line.evaluateX!(10), 5);

  const parabola = parseExpression('x = y^2');
  assert.equal(parabola.type, 'explicit_x');
  assert.equal(parabola.evaluateX!(3), 9);
  assert.equal(parabola.evaluateX!(-4), 16);
});

test('Variable assignment: a = 5', () => {
  const parsed = parseExpression('a = 5');
  assert.equal(parsed.type, 'assignment');
  assert.equal(parsed.assignVar, 'a');
  assert.equal(parsed.evaluate(), 5);
});

test('Plain expression defaults to explicit y', () => {
  const parsed = parseExpression('x^2 - 4');
  assert.equal(parsed.type, 'explicit_y');
  assert.equal(parsed.evaluateY!(3), 5);
  assert.equal(parsed.evaluateImplicit!(3, 5), 0); // 5 - (3^2 - 4) = 0
});

test('Variable extraction helpers', () => {
  const vars = extractVariables('y = a*x + b + sin(c)');
  assert.deepEqual(vars.sort(), ['a', 'b', 'c', 'x', 'y']);

  const circleVars = extractVariables('x^2 + y^2 = r^2');
  assert.deepEqual(circleVars.sort(), ['r', 'x', 'y']);
});

test('Bad input error handling: descriptive MathError', () => {
  // Empty
  assert.throws(() => parseExpression('   '), (err: unknown) => {
    return err instanceof MathError && err.message.includes('cannot be empty');
  });

  // Unclosed paren
  assert.throws(() => parseExpression('sin(x'), (err: unknown) => {
    return err instanceof MathError && err.message.includes("Expected closing parenthesis ')'");
  });

  // Unexpected character
  assert.throws(() => parseExpression('y = @ + 1'), (err: unknown) => {
    return err instanceof MathError && err.message.includes("Unexpected character '@'");
  });

  // Multiple equals
  assert.throws(() => parseExpression('y = x = 2'), (err: unknown) => {
    return err instanceof MathError && err.message.includes("Multiple '=' signs");
  });

  // Missing LHS
  assert.throws(() => parseExpression('= 5'), (err: unknown) => {
    return err instanceof MathError && err.message.includes('Missing left-hand side');
  });

  // Missing RHS
  assert.throws(() => parseExpression('y = '), (err: unknown) => {
    return err instanceof MathError && err.message.includes('Missing right-hand side');
  });
});

test('tryParseExpression does not throw on invalid syntax', () => {
  const resBad = tryParseExpression('y = 2* * 3');
  assert.equal(resBad.success, false);
  if (!resBad.success) {
    assert.ok(resBad.error.length > 0);
  }

  const resGood = tryParseExpression('y = 2*x + 3');
  assert.equal(resGood.success, true);
  if (resGood.success) {
    assert.equal(resGood.parsed.type, 'explicit_y');
  }
});

test('Mathematical robustness and NaN safety', () => {
  // Missing variable returns NaN without crashing
  const parsed = parseExpression('a*x + b');
  assert.ok(Number.isNaN(parsed.evaluate({})));

  // Division by zero gives Infinity / -Infinity
  assert.equal(evaluate('1 / 0'), Infinity);
  assert.equal(evaluate('-1 / 0'), -Infinity);

  // Sqrt of negative gives NaN without throwing
  assert.ok(Number.isNaN(evaluate('sqrt(-4)')));
});

test('Ellipse implicit equations and parameters', () => {
  const parsed = parseExpression('x^2 / 9 + y^2 / 16 = 1');
  assert.equal(parsed.type, 'implicit');
  assert.equal(parsed.evaluateImplicit!(3, 0), 0); // 9/9 + 0 = 1
  assert.equal(parsed.evaluateImplicit!(0, 4), 0); // 0 + 16/16 = 1

  const paramEllipse = parseExpression('x^2 / a^2 + y^2 / b^2 = 1');
  assert.equal(paramEllipse.type, 'implicit');
  assert.deepEqual(getFreeParameters(paramEllipse).sort(), ['a', 'b']);
  assert.equal(paramEllipse.evaluateImplicit!(5, 0, { a: 5, b: 2 }), 0);
});

test('Scientific notation and negative slider values', () => {
  assert.equal(evaluate('2.5e2 + 10'), 260);
  assert.equal(evaluate('1e-3 * 1000'), 1);

  const parsed = parseExpression('y = a*x + b');
  assert.equal(parsed.evaluateY!(3, { a: -2, b: -5 }), -11);
});

test('Complex nested expressions', () => {
  const parsed = parseExpression('((x + 1) * (x - 1)) / (x^2 + 1)');
  assert.equal(parsed.type, 'explicit_y');
  assert.equal(parsed.evaluateY!(0), -1); // (-1) / 1 = -1
  assert.equal(parsed.evaluateY!(3), 8 / 10); // (4 * 2) / 10 = 0.8
});

