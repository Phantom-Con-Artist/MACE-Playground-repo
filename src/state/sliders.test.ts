import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractVariables,
  extractAllVariables,
  detectAssignment,
  createDefaultSlider,
  syncSliders,
  slidersToScope,
  updateSliderValue,
  updateSliderConfig,
  stepSlider,
} from './sliders.ts';

describe('detectAssignment', () => {
  it('detects simple numeric assignments', () => {
    assert.deepEqual(detectAssignment('a = 5'), { name: 'a', value: 5 });
    assert.deepEqual(detectAssignment('k = -2.5'), { name: 'k', value: -2.5 });
    assert.deepEqual(detectAssignment('  m = +3.14  '), { name: 'm', value: 3.14 });
    assert.deepEqual(detectAssignment('w = 1e-2'), { name: 'w', value: 0.01 });
  });

  it('ignores coordinate assignments and invalid inputs', () => {
    assert.equal(detectAssignment('x = 5'), null);
    assert.equal(detectAssignment('y = 2'), null);
    assert.equal(detectAssignment('sin = 1'), null);
    assert.equal(detectAssignment('y = 2*x + 1'), null);
    assert.equal(detectAssignment(''), null);
  });
});

describe('extractVariables', () => {
  it('extracts variables from linear equations', () => {
    assert.deepEqual(extractVariables('y = a*x + b'), ['a', 'b']);
    assert.deepEqual(extractVariables('y = m*x + c'), ['c', 'm']);
  });

  it('returns empty list for pure coordinate equations', () => {
    assert.deepEqual(extractVariables('y = sin(x)'), []);
    assert.deepEqual(extractVariables('x^2 + y^2 = 25'), []);
    assert.deepEqual(extractVariables('y = 2*x + 1'), []);
  });

  it('handles coefficient adjacency (e.g. 2a*x + 3b)', () => {
    assert.deepEqual(extractVariables('y = 2a*x + 3b'), ['a', 'b']);
  });

  it('ignores math functions and constants', () => {
    assert.deepEqual(
      extractVariables('y = a * sin(b * x) + exp(c * x) + log(x) + sqrt(d)'),
      ['a', 'b', 'c', 'd']
    );
    assert.deepEqual(extractVariables('y = sin(pi * x) + e^x'), []);
  });

  it('handles scientific notation without treating e as a variable', () => {
    assert.deepEqual(extractVariables('y = 1.5e-3 * x + a'), ['a']);
    assert.deepEqual(extractVariables('y = 2e4 * x'), []);
  });

  it('extracts variable from explicit assignment', () => {
    assert.deepEqual(extractVariables('a = 5'), ['a']);
    assert.deepEqual(extractVariables('step = 0.5'), ['step']);
  });

  it('handles implicit non-coordinate equations', () => {
    assert.deepEqual(extractVariables('x^2 + y^2 = r^2'), ['r']);
    assert.deepEqual(extractVariables('(x - h)^2 + (y - k)^2 = r^2'), ['h', 'k', 'r']);
  });
});

describe('extractAllVariables', () => {
  it('aggregates and deduplicates variables across expressions', () => {
    const expressions = [
      'y = a*x + b',
      'y = sin(b*x) + c',
      'x^2 + y^2 = 25',
    ];
    assert.deepEqual(extractAllVariables(expressions), ['a', 'b', 'c']);
  });

  it('supports graph row objects and handles hidden flag', () => {
    const rows = [
      { id: '1', expression: 'y = a*x + b', visible: true },
      { id: '2', expression: 'y = c*x', visible: false },
    ];
    assert.deepEqual(extractAllVariables(rows, { includeHidden: true }), ['a', 'b', 'c']);
    assert.deepEqual(extractAllVariables(rows, { includeHidden: false }), ['a', 'b']);
  });
});

describe('createDefaultSlider', () => {
  it('creates slider with defaults', () => {
    const slider = createDefaultSlider('a');
    assert.equal(slider.name, 'a');
    assert.equal(slider.value, 1);
    assert.equal(slider.min, -10);
    assert.equal(slider.max, 10);
    assert.equal(slider.step, 0.1);
  });

  it('expands bounds if initial value exceeds default bounds', () => {
    const s1 = createDefaultSlider('a', 25);
    assert.equal(s1.value, 25);
    assert.ok(s1.max >= 25);

    const s2 = createDefaultSlider('b', -30);
    assert.equal(s2.value, -30);
    assert.ok(s2.min <= -30);
  });
});

describe('syncSliders', () => {
  it('initializes sliders for new variables', () => {
    const sliders = syncSliders({}, ['y = a*x + b']);
    assert.ok(sliders.a);
    assert.ok(sliders.b);
    assert.equal(sliders.a.value, 1);
    assert.equal(sliders.b.value, 1);
  });

  it('preserves user modified values across syncs', () => {
    let sliders = syncSliders({}, ['y = a*x + b']);
    sliders = updateSliderValue(sliders, 'a', 4.5);

    // Sync with an additional expression referencing 'c'
    const nextSliders = syncSliders(sliders, ['y = a*x + b', 'y = c*x']);
    assert.equal(nextSliders.a.value, 4.5);
    assert.equal(nextSliders.c.value, 1);
  });

  it('pre-populates value from assignment expressions', () => {
    const sliders = syncSliders({}, ['a = 7.5', 'y = a*x + b']);
    assert.equal(sliders.a.value, 7.5);
    assert.equal(sliders.b.value, 1);
  });

  it('prunes unused sliders when configured', () => {
    const s1 = syncSliders({}, ['y = a*x + b']);
    assert.ok(s1.a && s1.b);

    const s2 = syncSliders(s1, ['y = a*x'], { pruneUnused: true });
    assert.ok(s2.a);
    assert.equal(s2.b, undefined);

    const s3 = syncSliders(s1, ['y = a*x'], { pruneUnused: false });
    assert.ok(s3.a);
    assert.ok(s3.b);
  });
});

describe('slidersToScope', () => {
  it('converts slider map to evaluation scope', () => {
    const sliders = {
      a: createDefaultSlider('a', 3),
      b: createDefaultSlider('b', -2),
    };
    const scope = slidersToScope(sliders);
    assert.deepEqual(scope, { a: 3, b: -2 });
  });

  it('converts slider array to evaluation scope', () => {
    const sliders = [
      createDefaultSlider('m', 0.5),
      createDefaultSlider('k', 10),
    ];
    const scope = slidersToScope(sliders);
    assert.deepEqual(scope, { m: 0.5, k: 10 });
  });
});

describe('updateSliderValue and updateSliderConfig', () => {
  it('clamps values to min and max', () => {
    let sliders = { a: createDefaultSlider('a', 1, -10, 10, 0.1) };
    sliders = updateSliderValue(sliders, 'a', 15);
    assert.equal(sliders.a.value, 10);

    sliders = updateSliderValue(sliders, 'a', -20);
    assert.equal(sliders.a.value, -10);
  });

  it('updates configuration properties', () => {
    let sliders = { a: createDefaultSlider('a', 1, -10, 10, 0.1) };
    sliders = updateSliderConfig(sliders, 'a', { min: 0, max: 50, step: 1, isPlaying: true });
    assert.equal(sliders.a.min, 0);
    assert.equal(sliders.a.max, 50);
    assert.equal(sliders.a.step, 1);
    assert.equal(sliders.a.isPlaying, true);
  });
});

describe('stepSlider', () => {
  it('advances slider value by step', () => {
    const s = createDefaultSlider('a', 1.0, 0, 10, 0.5);
    const sNext = stepSlider(s, 1);
    assert.equal(sNext.value, 1.5);
  });

  it('wraps around when exceeding max', () => {
    const s = createDefaultSlider('a', 10, 0, 10, 1);
    const sNext = stepSlider(s, 1);
    assert.equal(sNext.value, 0);
  });

  it('wraps around when below min', () => {
    const s = createDefaultSlider('a', 0, 0, 10, 1);
    const sPrev = stepSlider(s, -1);
    assert.equal(sPrev.value, 10);
  });
});
