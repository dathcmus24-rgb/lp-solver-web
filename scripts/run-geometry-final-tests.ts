import { solveGeometric } from '../src/lib/geometry';
import { buildResultSummary } from '../src/lib/solutionSummary';
import { solveLP } from '../src/lib/simplex';
import type { LPInput } from '../src/lib/types';

const nn = (n: number): LPInput['variableTypes'] => Array.from({ length: n }, () => 'nonnegative');

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const alternate: LPInput = {
  optimization: 'max',
  n: 2,
  m: 3,
  c: [1, 1],
  A: [
    [1, 1],
    [1, 0],
    [0, 1],
  ],
  signs: ['<=', '<=', '<='],
  b: [4, 4, 4],
  variableTypes: nn(2),
};

const geomAlt = solveGeometric(alternate);
assert(geomAlt.status === 'optimal', `Hình học đa nghiệm phải optimal, nhận ${geomAlt.status}`);
assert(geomAlt.optimalSegment != null, 'Hình học đa nghiệm phải có đoạn AB');

const altSummary = buildResultSummary(solveLP(alternate, 'geometric'));
assert(altSummary.conclusion.includes('vô số nghiệm tối ưu'), 'Kết luận phải ghi vô số nghiệm tối ưu');
assert(altSummary.optimalValueText === 'max z = 4', `Giá trị tối ưu phải là max z = 4, nhận ${altSummary.optimalValueText}`);

const infeasible: LPInput = {
  optimization: 'max',
  n: 2,
  m: 1,
  c: [1, 1],
  A: [[1, 0]],
  signs: ['<='],
  b: [-1],
  variableTypes: nn(2),
};

const infeasibleSummary = buildResultSummary(solveLP(infeasible, 'geometric'));
assert(infeasibleSummary.optimalValueText === 'max z = -∞', `Vô nghiệm max phải kết luận max z = -∞, nhận ${infeasibleSummary.optimalValueText}`);

const unbounded: LPInput = {
  optimization: 'min',
  n: 2,
  m: 1,
  c: [-1, -1],
  A: [[-1, 0]],
  signs: ['<='],
  b: [0],
  variableTypes: nn(2),
};

const unboundedSummary = buildResultSummary(solveLP(unbounded, 'geometric'));
assert(unboundedSummary.optimalValueText === 'min z = -∞', `Không giới nội min phải kết luận min z = -∞, nhận ${unboundedSummary.optimalValueText}`);

console.log('✓ Hình học nhận diện vô số nghiệm và đoạn AB');
console.log('✓ Kết luận vô nghiệm có max z = -∞');
console.log('✓ Kết luận không giới nội có min z = -∞');
console.log('All geometry final tests passed.');
