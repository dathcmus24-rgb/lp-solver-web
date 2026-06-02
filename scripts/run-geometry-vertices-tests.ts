import { solveGeometric } from '../src/lib/geometry';
import type { LPInput } from '../src/lib/types';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const input: LPInput = {
  optimization: 'min',
  n: 2,
  m: 4,
  c: [23, -7],
  A: [
    [-4, 1],
    [1, 1],
    [-1, -1],
    [-3, 2],
  ],
  signs: ['<=', '<=', '<=', '<='],
  b: [-2, 5, -1, 1],
  variableTypes: ['nonnegative', 'nonnegative'],
};

const result = solveGeometric(input);

assert(result.status === 'optimal', `Expected optimal, got ${result.status}`);
assert(
  !result.feasiblePoints.some((p) => Math.abs(p.x - 2.5) < 1e-7 && Math.abs(p.y - 2.5) < 1e-7),
  'Point (2.5, 2.5) must not appear because it is not an extreme vertex.',
);
assert(
  result.feasiblePoints.some((p) => Math.abs(p.x - 1) < 1e-7 && Math.abs(p.y - 2) < 1e-7),
  'Vertex (1, 2) must appear.',
);
assert(result.optimalPoint != null, 'Optimal point must exist.');
assert(Math.abs(result.optimalPoint!.x - 1) < 1e-7, `Expected optimal x1 = 1, got ${result.optimalPoint!.x}`);
assert(Math.abs(result.optimalPoint!.y - 2) < 1e-7, `Expected optimal x2 = 2, got ${result.optimalPoint!.y}`);
assert(Math.abs(result.optimalPoint!.value - 9) < 1e-7, `Expected min z = 9, got ${result.optimalPoint!.value}`);

console.log('✓ Geometry only labels true extreme vertices');
console.log('✓ Projection point (2.5, 2.5) no longer appears');
console.log('✓ The optimal point remains F(1, 2), min z = 9');
console.log('All geometry vertices-only tests passed.');
