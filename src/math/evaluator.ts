import { MathError, type ASTNode, type ExpressionType, type ParsedExpression } from './types.ts';
import { BUILTIN_CONSTANTS, isBuiltinConstant } from './lexer.ts';

export function evaluateAST(node: ASTNode, scope: Record<string, number> = {}): number {
  switch (node.type) {
    case 'Number':
    case 'Constant':
      return node.value;

    case 'Variable': {
      if (Object.prototype.hasOwnProperty.call(scope, node.name)) {
        return scope[node.name];
      }
      if (isBuiltinConstant(node.name)) {
        return BUILTIN_CONSTANTS[node.name];
      }
      // Return NaN when variable is undefined in scope
      return NaN;
    }

    case 'UnaryOp': {
      const val = evaluateAST(node.argument, scope);
      if (node.operator === '-') {
        return -val;
      }
      return val;
    }

    case 'BinaryOp': {
      const left = evaluateAST(node.left, scope);
      const right = evaluateAST(node.right, scope);

      switch (node.operator) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          if (right === 0) {
            return left > 0 ? Infinity : left < 0 ? -Infinity : NaN;
          }
          return left / right;
        case '%':
          return left % right;
        case '^':
          return Math.pow(left, right);
        default:
          return NaN;
      }
    }

    case 'FunctionCall': {
      const args = node.args.map((arg) => evaluateAST(arg, scope));
      return evaluateFunction(node.name, args, node.position);
    }

    case 'Equation': {
      const left = evaluateAST(node.left, scope);
      const right = evaluateAST(node.right, scope);
      return left - right;
    }

    default:
      return NaN;
  }
}

function evaluateFunction(name: string, args: number[], position: number): number {
  const lowerName = name.toLowerCase();

  switch (lowerName) {
    case 'sin':
      return Math.sin(args[0]);
    case 'cos':
      return Math.cos(args[0]);
    case 'tan':
      return Math.tan(args[0]);
    case 'csc':
      return 1 / Math.sin(args[0]);
    case 'sec':
      return 1 / Math.cos(args[0]);
    case 'cot':
      return 1 / Math.tan(args[0]);
    case 'asin':
    case 'arcsin':
      return Math.asin(args[0]);
    case 'acos':
    case 'arccos':
      return Math.acos(args[0]);
    case 'atan':
    case 'arctan':
      return Math.atan(args[0]);
    case 'atan2':
      return Math.atan2(args[0], args[1]);
    case 'sinh':
      return Math.sinh(args[0]);
    case 'cosh':
      return Math.cosh(args[0]);
    case 'tanh':
      return Math.tanh(args[0]);
    case 'sqrt':
      return Math.sqrt(args[0]);
    case 'cbrt':
      return Math.cbrt(args[0]);
    case 'abs':
      return Math.abs(args[0]);
    case 'exp':
      return Math.exp(args[0]);
    case 'ln':
      return Math.log(args[0]);
    case 'log':
      if (args.length > 1) {
        return Math.log(args[0]) / Math.log(args[1]);
      }
      return Math.log10(args[0]);
    case 'log10':
      return Math.log10(args[0]);
    case 'log2':
      return Math.log2(args[0]);
    case 'floor':
      return Math.floor(args[0]);
    case 'ceil':
      return Math.ceil(args[0]);
    case 'round':
      return Math.round(args[0]);
    case 'sign':
      return Math.sign(args[0]);
    case 'min':
      return Math.min(...args);
    case 'max':
      return Math.max(...args);
    default:
      throw new MathError(`Unknown function '${name}'`, position);
  }
}

export function createEvaluators(
  ast: ASTNode,
  type: ExpressionType,
  assignVar?: string
): Pick<ParsedExpression, 'evaluate' | 'evaluateY' | 'evaluateX' | 'evaluateImplicit'> {
  if (type === 'explicit_y') {
    if (ast.type === 'Equation') {
      const evalTarget = ast.right;
      return {
        evaluate: (scope: Record<string, number> = {}) => evaluateAST(evalTarget, scope),
        evaluateY: (x: number, scope: Record<string, number> = {}) =>
          evaluateAST(evalTarget, { ...scope, x }),
        evaluateImplicit: (x: number, y: number, scope: Record<string, number> = {}) =>
          y - evaluateAST(evalTarget, { ...scope, x }),
      };
    } else {
      return {
        evaluate: (scope: Record<string, number> = {}) => evaluateAST(ast, scope),
        evaluateY: (x: number, scope: Record<string, number> = {}) =>
          evaluateAST(ast, { ...scope, x }),
        evaluateImplicit: (x: number, y: number, scope: Record<string, number> = {}) =>
          y - evaluateAST(ast, { ...scope, x }),
      };
    }
  }

  if (type === 'explicit_x') {
    if (ast.type === 'Equation') {
      const evalTarget = ast.right;
      return {
        evaluate: (scope: Record<string, number> = {}) => evaluateAST(evalTarget, scope),
        evaluateX: (y: number, scope: Record<string, number> = {}) =>
          evaluateAST(evalTarget, { ...scope, y }),
        evaluateImplicit: (x: number, y: number, scope: Record<string, number> = {}) =>
          x - evaluateAST(evalTarget, { ...scope, y }),
      };
    } else {
      return {
        evaluate: (scope: Record<string, number> = {}) => evaluateAST(ast, scope),
        evaluateX: (y: number, scope: Record<string, number> = {}) =>
          evaluateAST(ast, { ...scope, y }),
        evaluateImplicit: (x: number, y: number, scope: Record<string, number> = {}) =>
          x - evaluateAST(ast, { ...scope, y }),
      };
    }
  }

  if (type === 'implicit') {
    if (ast.type === 'Equation') {
      return {
        evaluate: (scope: Record<string, number> = {}) =>
          evaluateAST(ast.left, scope) - evaluateAST(ast.right, scope),
        evaluateImplicit: (x: number, y: number, scope: Record<string, number> = {}) =>
          evaluateAST(ast.left, { ...scope, x, y }) - evaluateAST(ast.right, { ...scope, x, y }),
      };
    } else {
      return {
        evaluate: (scope: Record<string, number> = {}) => evaluateAST(ast, scope),
        evaluateImplicit: (x: number, y: number, scope: Record<string, number> = {}) =>
          evaluateAST(ast, { ...scope, x, y }),
      };
    }
  }

  // Assignment type: e.g. a = 5
  if (ast.type === 'Equation') {
    return {
      evaluate: (scope: Record<string, number> = {}) => evaluateAST(ast.right, scope),
    };
  }

  return {
    evaluate: (scope: Record<string, number> = {}) => evaluateAST(ast, scope),
  };
}
