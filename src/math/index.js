/**
 * Math parser and evaluator contract:
 * - parseExpression(exprString): returns parsed AST and metadata
 * - evaluate(parsedOrAst, scope): evaluates expression given scope { x, y, ...variables }
 * - extractVariables(exprString): helper returning list of free parameter names (excluding x, y)
 */

const CONSTANTS = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
};

const FUNCTIONS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  log: Math.log10,
  ln: Math.log,
  exp: Math.exp,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};

// Tokenizer
export function tokenize(str) {
  if (typeof str !== 'string') {
    throw new Error('Expression must be a string');
  }
  const clean = str.trim();
  if (!clean) {
    throw new Error('Expression cannot be empty');
  }

  const tokens = [];
  let i = 0;

  while (i < clean.length) {
    const ch = clean[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let hasDot = false;
      while (i < clean.length && /[0-9.]/.test(clean[i])) {
        if (clean[i] === '.') {
          if (hasDot) throw new Error('Invalid number: multiple decimal points');
          hasDot = true;
        }
        numStr += clean[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(numStr) });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < clean.length && /[a-zA-Z0-9_]/.test(clean[i])) {
        ident += clean[i];
        i++;
      }
      tokens.push({ type: 'identifier', value: ident });
      continue;
    }

    if ('+-*/^%=(),'.includes(ch)) {
      tokens.push({ type: 'operator', value: ch });
      i++;
      continue;
    }

    throw new Error(`Unexpected character: "${ch}"`);
  }

  // Insert implicit multiplication tokens (e.g. 2x -> 2 * x, 2(x) -> 2 * (x), (x)(y) -> (x) * (y))
  const withImplicit = [];
  for (let j = 0; j < tokens.length; j++) {
    const curr = tokens[j];
    withImplicit.push(curr);
    const next = tokens[j + 1];
    if (!next) continue;

    const currIsNum = curr.type === 'number';
    const currIsIdent = curr.type === 'identifier';
    const currIsCloseParen = curr.type === 'operator' && curr.value === ')';

    const nextIsIdent = next.type === 'identifier';
    const nextIsOpenParen = next.type === 'operator' && next.value === '(';
    const nextIsNum = next.type === 'number';

    if (
      (currIsNum && (nextIsIdent || nextIsOpenParen)) ||
      (currIsCloseParen && (nextIsOpenParen || nextIsIdent || nextIsNum)) ||
      (currIsIdent && !FUNCTIONS[curr.value] && (nextIsOpenParen || nextIsIdent || nextIsNum))
    ) {
      withImplicit.push({ type: 'operator', value: '*' });
    }
  }

  return withImplicit;
}

// Recursive-descent parser for arithmetic AST
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos];
  }

  consume(expectedValue) {
    const token = this.peek();
    if (!token) {
      throw new Error(`Unexpected end of expression, expected "${expectedValue}"`);
    }
    if (expectedValue && token.value !== expectedValue) {
      throw new Error(`Expected "${expectedValue}", got "${token.value}"`);
    }
    this.pos++;
    return token;
  }

  parse() {
    const node = this.parseExpression();
    if (this.pos < this.tokens.length) {
      const extra = this.peek();
      throw new Error(`Unexpected token "${extra.value}" after expression`);
    }
    return node;
  }

  parseExpression() {
    return this.parseAddSub();
  }

  parseAddSub() {
    let left = this.parseMulDiv();
    while (this.pos < this.tokens.length) {
      const op = this.peek();
      if (op && (op.value === '+' || op.value === '-')) {
        this.consume();
        const right = this.parseMulDiv();
        left = { type: 'binary', op: op.value, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  parseMulDiv() {
    let left = this.parsePower();
    while (this.pos < this.tokens.length) {
      const op = this.peek();
      if (op && (op.value === '*' || op.value === '/' || op.value === '%')) {
        this.consume();
        const right = this.parsePower();
        left = { type: 'binary', op: op.value, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  parsePower() {
    let left = this.parseUnary();
    if (this.pos < this.tokens.length) {
      const op = this.peek();
      if (op && op.value === '^') {
        this.consume();
        // Right associative
        const right = this.parsePower();
        return { type: 'binary', op: '^', left, right };
      }
    }
    return left;
  }

  parseUnary() {
    const token = this.peek();
    if (token && (token.value === '+' || token.value === '-')) {
      this.consume();
      const argument = this.parseUnary();
      return { type: 'unary', op: token.value, argument };
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const token = this.peek();
    if (!token) {
      throw new Error('Unexpected end of expression');
    }

    if (token.type === 'number') {
      this.consume();
      return { type: 'number', value: token.value };
    }

    if (token.type === 'identifier') {
      this.consume();
      const name = token.value;

      // Check if function call
      if (this.peek() && this.peek().value === '(') {
        this.consume('(');
        const args = [];
        if (this.peek() && this.peek().value !== ')') {
          args.push(this.parseExpression());
          while (this.peek() && this.peek().value === ',') {
            this.consume(',');
            args.push(this.parseExpression());
          }
        }
        this.consume(')');
        return { type: 'call', name, args };
      }

      if (CONSTANTS[name] !== undefined) {
        return { type: 'constant', name, value: CONSTANTS[name] };
      }

      return { type: 'variable', name };
    }

    if (token.value === '(') {
      this.consume('(');
      const expr = this.parseExpression();
      this.consume(')');
      return expr;
    }

    throw new Error(`Unexpected token: "${token.value}"`);
  }
}

/**
 * Evaluates an AST node with a scope dictionary.
 */
export function evaluateNode(node, scope = {}) {
  if (!node) return NaN;

  switch (node.type) {
    case 'number':
      return node.value;

    case 'constant':
      return node.value;

    case 'variable': {
      const val = scope[node.name];
      if (val === undefined) {
        throw new Error(`Undefined variable: "${node.name}"`);
      }
      return val;
    }

    case 'unary': {
      const arg = evaluateNode(node.argument, scope);
      if (node.op === '-') return -arg;
      if (node.op === '+') return +arg;
      throw new Error(`Unknown unary operator: "${node.op}"`);
    }

    case 'binary': {
      const left = evaluateNode(node.left, scope);
      const right = evaluateNode(node.right, scope);
      switch (node.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return right === 0 ? NaN : left / right;
        case '%': return left % right;
        case '^': return Math.pow(left, right);
        default:
          throw new Error(`Unknown binary operator: "${node.op}"`);
      }
    }

    case 'call': {
      const fn = FUNCTIONS[node.name];
      if (!fn) {
        throw new Error(`Unknown function: "${node.name}"`);
      }
      const evalArgs = node.args.map((a) => evaluateNode(a, scope));
      return fn(...evalArgs);
    }

    default:
      throw new Error(`Unknown AST node type: "${node.type}"`);
  }
}

/**
 * Extracts all identifiers from AST.
 */
function collectIdentifiers(node, set = new Set()) {
  if (!node) return set;
  if (node.type === 'variable') {
    set.add(node.name);
  } else if (node.type === 'unary') {
    collectIdentifiers(node.argument, set);
  } else if (node.type === 'binary') {
    collectIdentifiers(node.left, set);
    collectIdentifiers(node.right, set);
  } else if (node.type === 'call') {
    node.args.forEach((a) => collectIdentifiers(a, set));
  }
  return set;
}

/**
 * Parses expression into top-level contract:
 * Supports:
 * - "y = sin(x)" -> explicit y in terms of x and params
 * - "x = cos(y)" -> explicit x in terms of y and params
 * - "x^2 + y^2 = 25" -> implicit equation f(x, y) = 0
 * - "sin(x)" -> treated as y = sin(x)
 */
export function parseExpression(rawExpr) {
  if (typeof rawExpr !== 'string') {
    throw new Error('Expression must be a string');
  }
  const clean = rawExpr.trim();
  if (!clean) {
    throw new Error('Expression cannot be empty');
  }

  // Check equality signs
  const eqCount = (clean.match(/=/g) || []).length;
  if (eqCount > 1) {
    throw new Error('Invalid equation: only one "=" allowed');
  }

  if (eqCount === 1) {
    const parts = clean.split('=');
    const leftStr = parts[0].trim();
    const rightStr = parts[1].trim();

    if (!leftStr || !rightStr) {
      throw new Error('Invalid equation: both sides of "=" must contain expressions');
    }

    // Explicit y = ...
    if (leftStr === 'y') {
      const tokens = tokenize(rightStr);
      const ast = new Parser(tokens).parse();
      const idents = collectIdentifiers(ast);
      idents.delete('x');
      const variables = Array.from(idents);

      return {
        type: 'explicit_y',
        raw: clean,
        ast,
        variables,
        evaluate: (scope) => evaluateNode(ast, scope),
      };
    }

    // Explicit x = ...
    if (leftStr === 'x') {
      const tokens = tokenize(rightStr);
      const ast = new Parser(tokens).parse();
      const idents = collectIdentifiers(ast);
      idents.delete('y');
      const variables = Array.from(idents);

      return {
        type: 'explicit_x',
        raw: clean,
        ast,
        variables,
        evaluate: (scope) => evaluateNode(ast, scope),
      };
    }

    // Implicit equation: left - right = 0
    const leftAst = new Parser(tokenize(leftStr)).parse();
    const rightAst = new Parser(tokenize(rightStr)).parse();
    const diffAst = {
      type: 'binary',
      op: '-',
      left: leftAst,
      right: rightAst,
    };

    const idents = collectIdentifiers(diffAst);
    idents.delete('x');
    idents.delete('y');
    const variables = Array.from(idents);

    return {
      type: 'implicit',
      raw: clean,
      ast: diffAst,
      variables,
      evaluate: (scope) => evaluateNode(diffAst, scope),
    };
  }

  // No '=' sign, default to y = expr
  const tokens = tokenize(clean);
  const ast = new Parser(tokens).parse();
  const idents = collectIdentifiers(ast);
  idents.delete('x');
  idents.delete('y');
  const variables = Array.from(idents);

  return {
    type: 'explicit_y',
    raw: clean,
    ast,
    variables,
    evaluate: (scope) => evaluateNode(ast, scope),
  };
}

/**
 * Top-level evaluate function matching contract: evaluate(parsedOrAst, scope)
 */
export function evaluate(parsedOrAst, scope = {}) {
  if (!parsedOrAst) return NaN;
  if (typeof parsedOrAst.evaluate === 'function') {
    return parsedOrAst.evaluate(scope);
  }
  return evaluateNode(parsedOrAst, scope);
}

/**
 * Extracts free variable parameter names from an expression (excluding x, y).
 */
export function extractVariables(exprString) {
  try {
    const parsed = parseExpression(exprString);
    return parsed.variables || [];
  } catch {
    return [];
  }
}
