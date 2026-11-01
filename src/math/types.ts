export type TokenType =
  | 'NUMBER'
  | 'IDENTIFIER'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EQUALS'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

export type ASTNode =
  | NumberNode
  | VariableNode
  | ConstantNode
  | BinaryOpNode
  | UnaryOpNode
  | FunctionCallNode
  | EquationNode;

export interface NumberNode {
  type: 'Number';
  value: number;
  position: number;
}

export interface VariableNode {
  type: 'Variable';
  name: string;
  position: number;
}

export interface ConstantNode {
  type: 'Constant';
  name: string;
  value: number;
  position: number;
}

export interface BinaryOpNode {
  type: 'BinaryOp';
  operator: '+' | '-' | '*' | '/' | '^' | '%';
  left: ASTNode;
  right: ASTNode;
  position: number;
}

export interface UnaryOpNode {
  type: 'UnaryOp';
  operator: '+' | '-';
  argument: ASTNode;
  position: number;
}

export interface FunctionCallNode {
  type: 'FunctionCall';
  name: string;
  args: ASTNode[];
  position: number;
}

export interface EquationNode {
  type: 'Equation';
  left: ASTNode;
  right: ASTNode;
  position: number;
}

export type ExpressionType =
  | 'explicit_y'   // y = f(x) or just f(x)
  | 'explicit_x'   // x = f(y)
  | 'implicit'     // f(x, y) = g(x, y)
  | 'assignment';  // a = 5

export interface ParsedExpression {
  raw: string;
  type: ExpressionType;
  ast: ASTNode;
  /** All variable names found in the expression (excluding constants pi, e) */
  variables: string[];
  /** Free parameters that should have sliders (e.g. ['a', 'b'] for y = a*x + b) */
  parameters: string[];
  /** Target variable name if this is a variable assignment (e.g. 'a' for a = 5) */
  assignVar?: string;
  /** Evaluates expression given variable scope */
  evaluate: (scope?: Record<string, number>) => number;
  /** Evaluates explicit y = f(x) for given x and slider parameters */
  evaluateY?: (x: number, scope?: Record<string, number>) => number;
  /** Evaluates explicit x = f(y) for given y and slider parameters */
  evaluateX?: (y: number, scope?: Record<string, number>) => number;
  /** Evaluates implicit equation difference LHS - RHS for given (x, y) and slider parameters */
  evaluateImplicit?: (x: number, y: number, scope?: Record<string, number>) => number;
}

export class MathError extends Error {
  position?: number;
  constructor(message: string, position?: number) {
    super(message);
    this.name = 'MathError';
    this.position = position;
  }
}
