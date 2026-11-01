import type { EvaluatorFn, ExpressionType, ParsedPlotExpression } from './types';

// Built-in lightweight, safe mathematical expression evaluator
type TokenType = 'NUMBER' | 'IDENT' | 'OP' | 'LPAREN' | 'RPAREN' | 'COMMA';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < len && /[0-9]/.test(input[i + 1]))) {
      let num = '';
      while (i < len && (/[0-9]/.test(input[i]) || input[i] === '.')) {
        num += input[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: num });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < len && /[a-zA-Z0-9_]/.test(input[i])) {
        ident += input[i];
        i++;
      }
      tokens.push({ type: 'IDENT', value: ident });
      continue;
    }

    if ('+-*/^%'.includes(ch)) {
      tokens.push({ type: 'OP', value: ch });
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',' });
      i++;
      continue;
    }

    // Unrecognized character
    i++;
  }

  // Insert implicit multiplication:
  // e.g., 2x -> 2 * x, (x+1)(x-1) -> (x+1) * (x-1), 2(x) -> 2 * (x), x y -> x * y
  const expanded: Token[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const curr = tokens[k];
    expanded.push(curr);
    if (k + 1 < tokens.length) {
      const next = tokens[k + 1];
      const currCanBeLeft =
        curr.type === 'NUMBER' ||
        curr.type === 'RPAREN' ||
        (curr.type === 'IDENT' && !isKnownFunction(curr.value));
      const nextCanBeRight =
        next.type === 'IDENT' ||
        next.type === 'LPAREN' ||
        (next.type === 'NUMBER' && curr.type === 'RPAREN');

      if (currCanBeLeft && nextCanBeRight) {
        expanded.push({ type: 'OP', value: '*' });
      }
    }
  }

  return expanded;
}

const KNOWN_FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'sqrt',
  'cbrt',
  'abs',
  'exp',
  'ln',
  'log',
  'log10',
  'log2',
  'floor',
  'ceil',
  'round',
  'sign',
]);

function isKnownFunction(name: string): boolean {
  return KNOWN_FUNCTIONS.has(name.toLowerCase());
}

type ASTNode =
  | { type: 'num'; val: number }
  | { type: 'var'; name: string }
  | { type: 'unary'; op: string; expr: ASTNode }
  | { type: 'binary'; op: string; left: ASTNode; right: ASTNode }
  | { type: 'call'; fn: string; args: ASTNode[] };

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  public parse(): ASTNode {
    if (this.tokens.length === 0) {
      return { type: 'num', val: NaN };
    }
    const node = this.parseExpression();
    return node;
  }

  private parseExpression(): ASTNode {
    return this.parseAddSub();
  }

  private parseAddSub(): ASTNode {
    let left = this.parseMulDiv();
    while (true) {
      const token = this.peek();
      if (token && token.type === 'OP' && (token.value === '+' || token.value === '-')) {
        this.consume();
        const right = this.parseMulDiv();
        left = { type: 'binary', op: token.value, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseMulDiv(): ASTNode {
    let left = this.parsePower();
    while (true) {
      const token = this.peek();
      if (token && token.type === 'OP' && (token.value === '*' || token.value === '/' || token.value === '%')) {
        this.consume();
        const right = this.parsePower();
        left = { type: 'binary', op: token.value, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parsePower(): ASTNode {
    const left = this.parseUnary();
    const token = this.peek();
    if (token && token.type === 'OP' && token.value === '^') {
      this.consume();
      // Right-associative exponentiation
      const right = this.parsePower();
      return { type: 'binary', op: '^', left, right };
    }
    return left;
  }

  private parseUnary(): ASTNode {
    const token = this.peek();
    if (token && token.type === 'OP' && (token.value === '+' || token.value === '-')) {
      this.consume();
      const expr = this.parseUnary();
      return { type: 'unary', op: token.value, expr };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const token = this.peek();
    if (!token) {
      return { type: 'num', val: NaN };
    }

    if (token.type === 'NUMBER') {
      this.consume();
      return { type: 'num', val: parseFloat(token.value) };
    }

    if (token.type === 'IDENT') {
      this.consume();
      const name = token.value;
      const lower = name.toLowerCase();

      // Check constants
      if (lower === 'pi') return { type: 'num', val: Math.PI };
      if (lower === 'e') return { type: 'num', val: Math.E };

      // Check function call
      if (isKnownFunction(name) && this.peek()?.type === 'LPAREN') {
        this.consume(); // (
        const args: ASTNode[] = [];
        if (this.peek()?.type !== 'RPAREN') {
          while (true) {
            args.push(this.parseExpression());
            if (this.peek()?.type === 'COMMA') {
              this.consume();
            } else {
              break;
            }
          }
        }
        if (this.peek()?.type === 'RPAREN') {
          this.consume();
        }
        return { type: 'call', fn: lower, args };
      }

      return { type: 'var', name };
    }

    if (token.type === 'LPAREN') {
      this.consume();
      const node = this.parseExpression();
      if (this.peek()?.type === 'RPAREN') {
        this.consume();
      }
      return node;
    }

    this.consume();
    return { type: 'num', val: NaN };
  }
}

function evaluateAST(node: ASTNode, scope: Record<string, number>): number {
  switch (node.type) {
    case 'num':
      return node.val;
    case 'var': {
      const val = scope[node.name] ?? scope[node.name.toLowerCase()];
      return val !== undefined ? val : NaN;
    }
    case 'unary': {
      const v = evaluateAST(node.expr, scope);
      return node.op === '-' ? -v : v;
    }
    case 'binary': {
      const l = evaluateAST(node.left, scope);
      const r = evaluateAST(node.right, scope);
      switch (node.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return r === 0 ? NaN : l / r;
        case '%':
          return l % r;
        case '^':
          return Math.pow(l, r);
        default:
          return NaN;
      }
    }
    case 'call': {
      const args = node.args.map((a) => evaluateAST(a, scope));
      const a0 = args[0] ?? NaN;
      const a1 = args[1] ?? NaN;
      switch (node.fn) {
        case 'sin':
          return Math.sin(a0);
        case 'cos':
          return Math.cos(a0);
        case 'tan':
          return Math.tan(a0);
        case 'asin':
          return Math.asin(a0);
        case 'acos':
          return Math.acos(a0);
        case 'atan':
          return Math.atan(a0);
        case 'atan2':
          return Math.atan2(a0, a1);
        case 'sinh':
          return Math.sinh(a0);
        case 'cosh':
          return Math.cosh(a0);
        case 'tanh':
          return Math.tanh(a0);
        case 'sqrt':
          return a0 < 0 ? NaN : Math.sqrt(a0);
        case 'cbrt':
          return Math.cbrt(a0);
        case 'abs':
          return Math.abs(a0);
        case 'exp':
          return Math.exp(a0);
        case 'ln':
        case 'log':
          return a0 <= 0 ? NaN : Math.log(a0);
        case 'log10':
          return a0 <= 0 ? NaN : Math.log10(a0);
        case 'log2':
          return a0 <= 0 ? NaN : Math.log2(a0);
        case 'floor':
          return Math.floor(a0);
        case 'ceil':
          return Math.ceil(a0);
        case 'round':
          return Math.round(a0);
        case 'sign':
          return Math.sign(a0);
        default:
          return NaN;
      }
    }
  }
}

export function compileExpression(exprStr: string): (scope: Record<string, number>) => number {
  try {
    const tokens = tokenize(exprStr);
    const parser = new Parser(tokens);
    const ast = parser.parse();
    return (scope: Record<string, number>) => {
      try {
        return evaluateAST(ast, scope);
      } catch {
        return NaN;
      }
    };
  } catch {
    return () => NaN;
  }
}

export function classifyAndParse(
  rawExpression: string,
  customEvaluator?: EvaluatorFn
): ParsedPlotExpression | null {
  const trimmed = rawExpression.trim();
  if (!trimmed) return null;

  // Check if expression contains equality
  const eqIndex = trimmed.indexOf('=');

  if (eqIndex !== -1) {
    const lhs = trimmed.slice(0, eqIndex).trim();
    const rhs = trimmed.slice(eqIndex + 1).trim();

    // Check if it's y = f(x, vars) or x = f(y, vars)
    const lhsIsY = lhs === 'y';
    const lhsIsX = lhs === 'x';
    const rhsIsY = rhs === 'y';
    const rhsIsX = rhs === 'x';

    const rhsHasY = /\by\b/.test(rhs);
    const lhsHasY = /\by\b/.test(lhs);
    const rhsHasX = /\bx\b/.test(rhs);
    const lhsHasX = /\bx\b/.test(lhs);

    if (lhsIsY && !rhsHasY) {
      // y = f(x)
      const compiled = customEvaluator
        ? (scope: Record<string, number>) => customEvaluator(rhs, scope)
        : compileExpression(rhs);
      return { type: 'explicit_y', evaluate: compiled, raw: trimmed };
    }

    if (rhsIsY && !lhsHasY) {
      // f(x) = y
      const compiled = customEvaluator
        ? (scope: Record<string, number>) => customEvaluator(lhs, scope)
        : compileExpression(lhs);
      return { type: 'explicit_y', evaluate: compiled, raw: trimmed };
    }

    if (lhsIsX && !rhsHasX) {
      // x = f(y)
      const compiled = customEvaluator
        ? (scope: Record<string, number>) => customEvaluator(rhs, scope)
        : compileExpression(rhs);
      return { type: 'explicit_x', evaluate: compiled, raw: trimmed };
    }

    if (rhsIsX && !lhsHasX) {
      // f(y) = x
      const compiled = customEvaluator
        ? (scope: Record<string, number>) => customEvaluator(lhs, scope)
        : compileExpression(lhs);
      return { type: 'explicit_x', evaluate: compiled, raw: trimmed };
    }

    // Implicit equation: LHS - RHS = 0
    if (customEvaluator) {
      return {
        type: 'implicit',
        evaluate: (scope: Record<string, number>) => {
          const l = customEvaluator(lhs, scope);
          const r = customEvaluator(rhs, scope);
          return l - r;
        },
        raw: trimmed,
      };
    } else {
      const compL = compileExpression(lhs);
      const compR = compileExpression(rhs);
      return {
        type: 'implicit',
        evaluate: (scope: Record<string, number>) => compL(scope) - compR(scope),
        raw: trimmed,
      };
    }
  }

  // No '=': check if expression contains y
  const hasY = /\by\b/.test(trimmed);
  const hasX = /\bx\b/.test(trimmed);

  if (hasY && hasX) {
    // Implicit f(x, y) = 0
    const compiled = customEvaluator
      ? (scope: Record<string, number>) => customEvaluator(trimmed, scope)
      : compileExpression(trimmed);
    return { type: 'implicit', evaluate: compiled, raw: trimmed };
  }

  if (hasY && !hasX) {
    // Treat as x = f(y) or y = expression? Usually if variable is y, x = f(y)
    const compiled = customEvaluator
      ? (scope: Record<string, number>) => customEvaluator(trimmed, scope)
      : compileExpression(trimmed);
    return { type: 'explicit_x', evaluate: compiled, raw: trimmed };
  }

  // Standard y = f(x)
  const compiled = customEvaluator
    ? (scope: Record<string, number>) => customEvaluator(trimmed, scope)
    : compileExpression(trimmed);
  return { type: 'explicit_y', evaluate: compiled, raw: trimmed };
}
