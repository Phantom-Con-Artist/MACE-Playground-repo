import { MathError, type Token, type TokenType } from './types.ts';

export const BUILTIN_CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
  tau: 2 * Math.PI,
  TAU: 2 * Math.PI,
};

export const BUILTIN_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'csc', 'sec', 'cot',
  'asin', 'acos', 'atan', 'atan2',
  'arcsin', 'arccos', 'arctan',
  'sinh', 'cosh', 'tanh',
  'sqrt', 'cbrt',
  'abs',
  'exp',
  'ln', 'log', 'log10', 'log2',
  'floor', 'ceil', 'round', 'sign',
  'min', 'max',
]);

export function isBuiltinConstant(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILTIN_CONSTANTS, name);
}

export function isBuiltinFunction(name: string): boolean {
  return BUILTIN_FUNCTIONS.has(name.toLowerCase());
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    const startPos = i;

    // Numbers: digits, optionally decimal, optionally scientific notation (e.g. 1.23e-4)
    if (/\d/.test(ch) || (ch === '.' && i + 1 < len && /\d/.test(input[i + 1]))) {
      let numStr = '';
      let hasDot = false;

      while (i < len && (/\d/.test(input[i]) || input[i] === '.')) {
        if (input[i] === '.') {
          if (hasDot) {
            throw new MathError(`Invalid number format with multiple decimal points`, i);
          }
          hasDot = true;
        }
        numStr += input[i];
        i++;
      }

      // Check for scientific notation: e[+-]?\d+
      if (i < len && (input[i] === 'e' || input[i] === 'E')) {
        const nextChar = i + 1 < len ? input[i + 1] : '';
        if (/\d/.test(nextChar) || ((nextChar === '+' || nextChar === '-') && i + 2 < len && /\d/.test(input[i + 2]))) {
          numStr += input[i]; // 'e' or 'E'
          i++;
          if (input[i] === '+' || input[i] === '-') {
            numStr += input[i];
            i++;
          }
          while (i < len && /\d/.test(input[i])) {
            numStr += input[i];
            i++;
          }
        }
      }

      tokens.push({ type: 'NUMBER', value: numStr, position: startPos });
      continue;
    }

    // Identifiers (variables, functions, constants)
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < len && /[a-zA-Z0-9_]/.test(input[i])) {
        ident += input[i];
        i++;
      }

      tokens.push({ type: 'IDENTIFIER', value: ident, position: startPos });
      continue;
    }

    // Operators and delimiters
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^' || ch === '%') {
      tokens.push({ type: 'OPERATOR', value: ch, position: startPos });
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', position: startPos });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', position: startPos });
      i++;
      continue;
    }

    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',', position: startPos });
      i++;
      continue;
    }

    if (ch === '=') {
      tokens.push({ type: 'EQUALS', value: '=', position: startPos });
      i++;
      continue;
    }

    throw new MathError(`Unexpected character '${ch}'`, startPos);
  }

  tokens.push({ type: 'EOF', value: '', position: len });

  // Post-process tokens to insert implicit multiplication
  return insertImplicitMultiplication(tokens);
}

/**
 * Inserts implicit multiplication tokens where standard mathematical notation omits '*'.
 * E.g.:
 * - 2x -> 2 * x
 * - 2(x + 1) -> 2 * (x + 1)
 * - (x + 1)(x - 1) -> (x + 1) * (x - 1)
 * - a x -> a * x
 * - 2sin(x) -> 2 * sin(x)
 * - x sin(x) -> x * sin(x)
 * - 3pi -> 3 * pi
 */
function insertImplicitMultiplication(tokens: Token[]): Token[] {
  const result: Token[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    result.push(current);

    if (i + 1 >= tokens.length) break;
    const next = tokens[i + 1];

    if (current.type === 'EOF' || next.type === 'EOF') continue;

    // Is the current token something that can end a multiplicand?
    const isCurrentValueEnding =
      current.type === 'NUMBER' ||
      current.type === 'RPAREN' ||
      (current.type === 'IDENTIFIER' && !isBuiltinFunction(current.value));

    // Is the next token something that can start a multiplicand?
    const isNextValueStarting =
      next.type === 'NUMBER' ||
      next.type === 'IDENTIFIER' ||
      (next.type === 'LPAREN' && !(current.type === 'IDENTIFIER' && isBuiltinFunction(current.value)));

    if (isCurrentValueEnding && isNextValueStarting) {
      // Insert implicit '*'
      result.push({
        type: 'OPERATOR',
        value: '*',
        position: next.position,
      });
    }
  }

  return result;
}
