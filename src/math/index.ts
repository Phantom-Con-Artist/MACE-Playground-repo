import type { ParsedExpression } from './types.ts';
import { parseExpression, tryParseExpression, extractVariables, getFreeParameters } from './parser.ts';

export { MathError } from './types.ts';
export type {
  TokenType,
  Token,
  ASTNode,
  NumberNode,
  VariableNode,
  ConstantNode,
  BinaryOpNode,
  UnaryOpNode,
  FunctionCallNode,
  EquationNode,
  ExpressionType,
  ParsedExpression,
} from './types.ts';
export * from './lexer.ts';
export * from './parser.ts';
export * from './evaluator.ts';

/**
 * Top-level evaluate utility: evaluates an expression string or ParsedExpression
 * against an optional variable/slider scope.
 *
 * Example:
 *   evaluate("a*x + b", { a: 2, x: 3, b: 1 }) // returns 7
 *   evaluate("sin(pi / 2)") // returns 1
 */
export function evaluate(
  expr: string | ParsedExpression,
  scope: Record<string, number> = {}
): number {
  if (typeof expr === 'string') {
    const parsed = parseExpression(expr);
    return parsed.evaluate(scope);
  }
  return expr.evaluate(scope);
}
