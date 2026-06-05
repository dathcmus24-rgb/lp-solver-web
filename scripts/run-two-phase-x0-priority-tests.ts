import { analyzeTwoPhaseX0 } from '../src/lib/twoPhaseX0';
import type { StandardModel } from '../src/lib/types';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const model: StandardModel = {
  c: [-1, 0],
  constraints: [
    { a: [-1, 0], sign: '<=', b: -1, label: 'R1' },
    { a: [-2, 0], sign: '<=', b: -2, label: 'R2' },
    { a: [1, 0], sign: '<=', b: 4, label: 'R3' },
  ],
  mappings: [
    { originalIndex: 0, kind: 'same', label: 'x1' },
    { originalIndex: 1, kind: 'same', label: 'x2' },
  ],
  original: {
    optimization: 'min',
    n: 2,
    m: 3,
    c: [-1, 0],
    A: [
      [-1, 0],
      [-2, 0],
      [1, 0],
    ],
    signs: ['<=', '<=', '<='],
    b: [-1, -2, 4],
    variableTypes: ['nonnegative', 'nonnegative'],
  },
  latex: '',
};

const analysis = analyzeTwoPhaseX0(model);

assert(analysis.phaseOnePivotSteps.length >= 2, 'Expected at least the initial x0 pivot and one Phase 1 optimization pivot.');

const phaseOneOptimizationPivot = analysis.phaseOnePivotSteps.find((step) => step.phase === 'Phase 1' && step.entering !== 'x0');

assert(phaseOneOptimizationPivot, 'Expected a Phase 1 optimization pivot after the initial x0 pivot.');
assert(
  phaseOneOptimizationPivot?.leaving === 'x0',
  `When x0 ties in the minimum-ratio test, x0 should leave. Got leaving=${phaseOneOptimizationPivot?.leaving ?? 'none'}.`,
);

assert(analysis.status === 'optimal', `Expected bounded optimal after x0 priority pivot test model, got ${analysis.status}.`);

console.log('Two-Phase x0 leaving priority test passed.');
