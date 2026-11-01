import {
  MathError,
  type Token,
  type ASTNode,
  type EquationNode,
  type BinaryOpNode,
  type UnaryOpNode,
  type FunctionCallNode,
  type NumberNode,
  type VariableNode,
  type ConstantNode,
  type ExpressionType,
  type ParsedExpression,
} from './types.ts';
import { tokenize, isBuiltinConstant, BUILTIN_CONSTANTS, isBuiltinFunction } from './lexer.ts';
import { createEvaluators } from './evaluator.ts';

export class Parser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.current] || { type: 'EOF', value: '', position: 0 };
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private advance(): Token {
    const token = this.peek();
    if (!this.isAtEnd()) {
      this.current++;
    }
    return token;
  }

  private match(type: Token['type'], value?: string): boolean {
    const token = this.peek();
    if (token.type === type && (value === undefined || token.value === value)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: Token['type'], errorMsg: string, value?: string): Token {
    const token = this.peek();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new MathError(errorMsg, token.position);
    }
    return this.advance();
  }

  public parse(): { ast: ASTNode; isEquation: boolean } {
    if (this.isAtEnd()) {
      throw new MathError('Expression cannot be empty', 0);
    }

    const firstPos = this.peek().position;
    if (this.peek().type === 'EQUALS') {
      throw new MathError('Missing left-hand side of equation', firstPos);
    }

    const left = this.parseExpression();

    if (this.match('EQUALS')) {
      const eqPos = this.tokens[this.current - 1].position;
      if (this.isAtEnd()) {
        throw new MathError('Missing right-hand side of equation', eqPos + 1);
      }

      const right = this.parseExpression();

      if (this.peek().type === 'EQUALS') {
        throw new MathError("Multiple '=' signs are not allowed in an equation", this.peek().position);
      }

      if (!this.isAtEnd()) {
        throw new MathError(`Unexpected token '${this.peek().value}'`, this.peek().position);
      }

      const eqNode: EquationNode = {
        type: 'Equation',
        left,
        right,
        position: eqPos,
      };

      return { ast: eqNode, isEquation: true };
    }

    if (!this.isAtEnd()) {
      throw new MathError(`Unexpected token '${this.peek().value}'`, this.peek().position);
    }

    return { ast: left, isEquation: false };
  }

  /**
   * Precedence Level 1: Additive (+, -)
   */
  private parseExpression(): ASTNode {
    let node = this.parseTerm();

    while (this.peek().type === 'OPERATOR' && (this.peek().value === '+' || this.peek().value === '-')) {
      const opToken = this.advance();
      const right = this.parseTerm();
      const binNode: BinaryOpNode = {
        type: 'BinaryOp',
        operator: opToken.value as '+' | '-',
        left: node,
        right,
        position: opToken.position,
      };
      node = binNode;
    }

    return node;
  }

  /**
   * Precedence Level 2: Multiplicative (*, /, %)
   */
  private parseTerm(): ASTNode {
    let node = this.parsePower();

    while (
      this.peek().type === 'OPERATOR' &&
      (this.peek().value === '*' || this.peek().value === '/' || this.peek().value === '%')
    ) {
      const opToken = this.advance();
      const right = this.parsePower();
      const binNode: BinaryOpNode = {
        type: 'BinaryOp',
        operator: opToken.value as '*' | '/' | '%',
        left: node,
        right,
        position: opToken.position,
      };
      node = binNode;
    }

    return node;
  }

  /**
   * Precedence Level 3 & 4: Unary operators & Exponentiation (^)
   * Note: In mathematics, -x^2 is -(x^2), so ^ binds tighter than leading unary minus.
   */
  private parsePower(): ASTNode {
    // Check if there is a unary prefix operator
    if (this.peek().type === 'OPERATOR' && (this.peek().value === '+' || this.peek().value === '-')) {
      const opToken = this.advance();
      const argument = this.parsePower(); // Recurse to allow -2^2 to be -(2^2)
      const unaryNode: UnaryOpNode = {
        type: 'UnaryOp',
        operator: opToken.value as '+' | '-',
        argument,
        position: opToken.position,
      };
      return unaryNode;
    }

    const base = this.parsePrimary();

    if (this.peek().type === 'OPERATOR' && this.peek().value === '^') {
      const opToken = this.advance();
      // Right-associative: 2 ^ 3 ^ 2 -> 2 ^ (3 ^ 2)
      const exponent = this.parsePower();
      const binNode: BinaryOpNode = {
        type: 'BinaryOp',
        operator: '^',
        left: base,
        right: exponent,
        position: opToken.position,
      };
      return binNode;
    }

    return base;
  }

  /**
   * Primary: Numbers, Parentheses, Functions, Constants, Variables
   */
  private parsePrimary(): ASTNode {
    const token = this.peek();

    if (token.type === 'NUMBER') {
      this.advance();
      const numNode: NumberNode = {
        type: 'Number',
        value: parseFloat(token.value),
        position: token.position,
      };
      return numNode;
    }

    if (token.type === 'LPAREN') {
      this.advance();
      const expr = this.parseExpression();
      this.expect('RPAREN', `Expected closing parenthesis ')' at position ${this.peek().position}`);
      return expr;
    }

    if (token.type === 'IDENTIFIER') {
      const identToken = this.advance();
      const name = identToken.value;

      // Check if it's a built-in constant
      if (isBuiltinConstant(name)) {
        const constNode: ConstantNode = {
          type: 'Constant',
          name,
          value: BUILTIN_CONSTANTS[name],
          position: identToken.position,
        };
        return constNode;
      }

      // Check if it's a function call (or followed by LPAREN)
      if (isBuiltinFunction(name) || this.peek().type === 'LPAREN') {
        const args: ASTNode[] = [];
        if (this.match('LPAREN')) {
          if (!this.match('RPAREN')) {
            do {
              args.push(this.parseExpression());
            } while (this.match('COMMA'));
            this.expect('RPAREN', `Expected closing parenthesis ')' for function '${name}'`);
          }
        } else if (isBuiltinFunction(name)) {
          // Allow sin x without parens: parse next power/primary
          args.push(this.parsePower());
        }

        const fnNode: FunctionCallNode = {
          type: 'FunctionCall',
          name: name.toLowerCase(),
          args,
          position: identToken.position,
        };
        return fnNode;
      }

      // Otherwise it's a variable
      const varNode: VariableNode = {
        type: 'Variable',
        name,
        position: identToken.position,
      };
      return varNode;
    }

    if (token.type === 'EOF') {
      throw new MathError('Unexpected end of expression', token.position);
    }

    throw new MathError(`Unexpected token '${token.value}'`, token.position);
  }
}

/**
 * Traverses an AST to collect all variable names (excluding constants and function names).
 */
export function extractVariablesFromAST(node: ASTNode): Set<string> {
  const vars = new Set<string>();

  function walk(n: ASTNode) {
    switch (n.type) {
      case 'Variable':
        vars.add(n.name);
        break;
      case 'BinaryOp':
        walk(n.left);
        walk(n.right);
        break;
      case 'UnaryOp':
        walk(n.argument);
        break;
      case 'FunctionCall':
        for (const arg of n.args) {
          walk(arg);
        }
        break;
      case 'Equation':
        walk(n.left);
        walk(n.right);
        break;
      case 'Number':
      case 'Constant':
        break;
    }
  }

  walk(node);
  return vars;
}

/**
 * Public function to extract all variable names directly from an expression string.
 */
export function extractVariables(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const tokens = tokenize(trimmed);
  const parser = new Parser(tokens);
  const { ast } = parser.parse();
  return Array.from(extractVariablesFromAST(ast));
}

/**
 * Returns free parameter names that require sliders (e.g. ['a', 'b'] for y = a*x + b).
 */
export function getFreeParameters(parsed: ParsedExpression): string[] {
  return parsed.parameters;
}

/**
 * Parses a mathematical expression or equation into a structured ParsedExpression.
 */
export function parseExpression(raw: string): ParsedExpression {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new MathError('Expression cannot be empty', 0);
  }

  const tokens = tokenize(trimmed);
  const parser = new Parser(tokens);
  const { ast, isEquation } = parser.parse();

  const allVarsSet = extractVariablesFromAST(ast);
  const allVars = Array.from(allVarsSet);

  let type: ExpressionType = 'explicit_y';
  let variables: string[] = allVars;
  let parameters: string[] = [];
  let assignVar: string | undefined = undefined;

  if (isEquation && ast.type === 'Equation') {
    const leftVars = extractVariablesFromAST(ast.left);
    const rightVars = extractVariablesFromAST(ast.right);

    // Case 1: y = f(x, params...) or f(x) = ...
    const isLeftSingleY = ast.left.type === 'Variable' && ast.left.name === 'y';
    const isLeftFnOfX = ast.left.type === 'FunctionCall' && ast.left.args.length === 1 && ast.left.args[0].type === 'Variable' && (ast.left.args[0] as VariableNode).name === 'x';

    if ((isLeftSingleY || isLeftFnOfX) && !rightVars.has('y')) {
      type = 'explicit_y';
      variables = Array.from(rightVars);
      parameters = Array.from(rightVars).filter((v) => v !== 'x' && v !== 'y');
    }
    // Case 2: x = f(y, params...)
    else if (ast.left.type === 'Variable' && ast.left.name === 'x' && !rightVars.has('x')) {
      type = 'explicit_x';
      variables = Array.from(rightVars);
      parameters = Array.from(rightVars).filter((v) => v !== 'x' && v !== 'y');
    }
    // Case 3: Slider / Variable assignment (e.g. a = 5 or b = -2.5)
    else if (
      ast.left.type === 'Variable' &&
      ast.left.name !== 'x' &&
      ast.left.name !== 'y' &&
      !rightVars.has('x') &&
      !rightVars.has('y')
    ) {
      type = 'assignment';
      assignVar = ast.left.name;
      variables = Array.from(rightVars);
      parameters = Array.from(rightVars).filter((v) => v !== assignVar);
    }
    // Case 4: General Implicit Equation (e.g. x^2 + y^2 = 25)
    else {
      type = 'implicit';
      variables = allVars;
      parameters = allVars.filter((v) => v !== 'x' && v !== 'y');
    }
  } else {
    // Plain expression: e.g. sin(x) or a*x + b
    type = 'explicit_y';
    variables = allVars;
    parameters = allVars.filter((v) => v !== 'x' && v !== 'y');
  }

  const evaluators = createEvaluators(ast, type, assignVar);

  return {
    raw,
    type,
    ast,
    variables,
    parameters,
    assignVar,
    ...evaluators,
  };
}

/**
 * Safe parsing helper that returns success/failure instead of throwing.
 */
export function tryParseExpression(
  raw: string
): { success: true; parsed: ParsedExpression } | { success: false; error: string; position?: number } {
  try {
    const parsed = parseExpression(raw);
    return { success: true, parsed };
  } catch (err) {
    if (err instanceof MathError) {
      return { success: false, error: err.message, position: err.position };
    }
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
