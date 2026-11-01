/**
 * Variable detection and slider state management for the Desmos graphing calculator.
 */

export interface Slider {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  isPlaying?: boolean;
}

export type SliderMap = Record<string, Slider>;
export type VariableScope = Record<string, number>;

export interface GraphRowItem {
  id?: string;
  expression: string;
  color?: string;
  visible?: boolean;
}

export interface SyncOptions {
  /** If true, remove sliders for variables that are no longer in any expression (default: true) */
  pruneUnused?: boolean;
  /** If false, ignore expressions with visible === false (default: true) */
  includeHidden?: boolean;
}

/**
 * Built-in identifiers that should not be treated as slider variables.
 * Includes coordinate axes (x, y) and standard math functions / constants.
 */
export const RESERVED_IDENTIFIERS: ReadonlySet<string> = new Set([
  // Coordinate axes
  'x', 'y', 'X', 'Y',

  // Trigonometric & hyperbolic
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'asin', 'acos', 'atan', 'atan2', 'acot', 'asec', 'acsc',
  'sinh', 'cosh', 'tanh', 'coth', 'sech', 'csch',
  'asinh', 'acosh', 'atanh',

  // Logarithmic & exponential
  'sqrt', 'cbrt', 'exp', 'ln', 'log', 'log10', 'log2',

  // Common math utilities
  'abs', 'floor', 'ceil', 'round', 'trunc', 'sign',
  'min', 'max', 'pow', 'mod',

  // Constants
  'pi', 'PI', 'e', 'E',
]);

/**
 * Checks if an expression is a direct variable definition (e.g., "a = 5" or "k = -2.5").
 * Returns the variable name and numeric value, or null if not a simple assignment.
 */
export function detectAssignment(expression: string): { name: string; value: number } | null {
  if (!expression || typeof expression !== 'string') return null;

  const trimmed = expression.trim();
  const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)$/);
  if (!match) return null;

  const name = match[1];
  if (RESERVED_IDENTIFIERS.has(name)) return null;

  const value = parseFloat(match[2]);
  if (Number.isNaN(value)) return null;

  return { name, value };
}

/**
 * Extracts free variable names from a mathematical expression string.
 * Ignores coordinate axes (x, y), numbers, and standard math functions/constants.
 */
export function extractVariables(expression: string): string[] {
  if (!expression || typeof expression !== 'string') return [];

  // Check if it's an explicit assignment like "a = 5"
  const assignment = detectAssignment(expression);
  if (assignment) {
    return [assignment.name];
  }

  // Replace scientific notation (e.g., 1.5e-4, 2e3) so exponent 'e' is not parsed as a variable
  let clean = expression.replace(/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)\b/g, ' ');

  // Separate digits adjacent to identifiers (e.g. 2a -> 2 a, 3x -> 3 x)
  clean = clean.replace(/(\d)([a-zA-Z_])/g, '$1 $2');

  // Strip remaining numbers
  clean = clean.replace(/\b\d+(?:\.\d+)?\b/g, ' ');

  // Find all candidate identifier words
  const matches = clean.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
  const vars = new Set<string>();

  for (const token of matches) {
    if (!RESERVED_IDENTIFIERS.has(token)) {
      vars.add(token);
    }
  }

  return Array.from(vars).sort();
}

/**
 * Extracts all unique free variables from an array of expressions or graph row objects.
 */
export function extractAllVariables(
  items: (string | GraphRowItem)[],
  options: Pick<SyncOptions, 'includeHidden'> = {}
): string[] {
  const { includeHidden = true } = options;
  const allVars = new Set<string>();

  for (const item of items) {
    if (typeof item === 'string') {
      const vars = extractVariables(item);
      vars.forEach((v) => allVars.add(v));
    } else if (item && typeof item === 'object') {
      if (!includeHidden && item.visible === false) {
        continue;
      }
      if (item.expression) {
        const vars = extractVariables(item.expression);
        vars.forEach((v) => allVars.add(v));
      }
    }
  }

  return Array.from(allVars).sort();
}

/**
 * Creates a Slider object with sensible default boundaries.
 */
export function createDefaultSlider(
  name: string,
  initialValue: number = 1,
  min: number = -10,
  max: number = 10,
  step: number = 0.1
): Slider {
  // If initial value is outside [min, max], expand boundaries nicely
  let actualMin = min;
  let actualMax = max;
  if (initialValue < actualMin) {
    actualMin = Math.floor(initialValue - 5);
  }
  if (initialValue > actualMax) {
    actualMax = Math.ceil(initialValue + 5);
  }

  return {
    id: name,
    name,
    value: initialValue,
    min: actualMin,
    max: actualMax,
    step,
    isPlaying: false,
  };
}

/**
 * Synchronizes the current slider map against the latest expressions.
 * - Retains existing slider configurations and values for active variables.
 * - Adds newly discovered variables with default slider bounds.
 * - Pre-populates values from explicit assignments (e.g. "a = 5").
 * - Optionally prunes sliders for variables no longer referenced.
 */
export function syncSliders(
  currentSliders: SliderMap = {},
  items: (string | GraphRowItem)[],
  options: SyncOptions = {}
): SliderMap {
  const { pruneUnused = true, includeHidden = true } = options;

  // Track explicit assignments for new variables
  const assignmentValues: Record<string, number> = {};
  for (const item of items) {
    const expr = typeof item === 'string' ? item : item?.expression;
    if (!expr) continue;
    if (typeof item === 'object' && !includeHidden && item.visible === false) continue;

    const assignment = detectAssignment(expr);
    if (assignment) {
      assignmentValues[assignment.name] = assignment.value;
    }
  }

  const activeVariables = extractAllVariables(items, { includeHidden });
  const nextSliders: SliderMap = {};

  // Preserve or add active variables
  for (const varName of activeVariables) {
    if (currentSliders[varName]) {
      // Existing slider: preserve its value and configuration
      nextSliders[varName] = { ...currentSliders[varName] };
    } else {
      // New slider: initialize with assignment value if provided, else default 1
      const initialVal = assignmentValues[varName] !== undefined ? assignmentValues[varName] : 1;
      nextSliders[varName] = createDefaultSlider(varName, initialVal);
    }
  }

  // If not pruning, keep old sliders too
  if (!pruneUnused) {
    for (const [key, slider] of Object.entries(currentSliders)) {
      if (!nextSliders[key]) {
        nextSliders[key] = { ...slider };
      }
    }
  }

  return nextSliders;
}

/**
 * Converts a SliderMap or Slider array into an evaluation scope dictionary: { [varName]: number }.
 */
export function slidersToScope(sliders: SliderMap | Slider[]): VariableScope {
  const scope: VariableScope = {};
  if (Array.isArray(sliders)) {
    for (const s of sliders) {
      scope[s.name] = s.value;
    }
  } else if (sliders && typeof sliders === 'object') {
    for (const s of Object.values(sliders)) {
      scope[s.name] = s.value;
    }
  }
  return scope;
}

/**
 * Updates the value of a specific slider, clamping it within [min, max].
 */
export function updateSliderValue(sliders: SliderMap, name: string, value: number): SliderMap {
  const target = sliders[name];
  if (!target) return sliders;

  const clamped = Math.min(target.max, Math.max(target.min, value));
  return {
    ...sliders,
    [name]: {
      ...target,
      value: clamped,
    },
  };
}

/**
 * Updates properties (min, max, step, value, isPlaying) of a specific slider.
 */
export function updateSliderConfig(
  sliders: SliderMap,
  name: string,
  updates: Partial<Omit<Slider, 'id' | 'name'>>
): SliderMap {
  const target = sliders[name];
  if (!target) return sliders;

  const nextSlider: Slider = {
    ...target,
    ...updates,
  };

  // Ensure min < max
  if (nextSlider.min >= nextSlider.max) {
    nextSlider.max = nextSlider.min + 1;
  }

  // Clamp current value
  nextSlider.value = Math.min(nextSlider.max, Math.max(nextSlider.min, nextSlider.value));

  return {
    ...sliders,
    [name]: nextSlider,
  };
}

/**
 * Advance a slider by one step (useful for slider play/animation).
 * Bounces or loops at the limits.
 */
export function stepSlider(slider: Slider, direction: 1 | -1 = 1): Slider {
  let nextValue = slider.value + direction * slider.step;

  // Round to prevent floating point drift
  const precision = Math.max(0, (slider.step.toString().split('.')[1] || '').length);
  nextValue = parseFloat(nextValue.toFixed(precision));

  if (nextValue > slider.max) {
    nextValue = slider.min;
  } else if (nextValue < slider.min) {
    nextValue = slider.max;
  }

  return {
    ...slider,
    value: nextValue,
  };
}
