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

const freeStrip: LPInput = {
  optimization: 'max',
  n: 2,
  m: 2,
  c: [2, -4],
  A: [
    [1, -2],
    [-1, 2],
  ],
  signs: ['<=', '<='],
  b: [5, 3],
  variableTypes: ['free', 'free'],
};

const freeStripGeom = solveGeometric(freeStrip);
assert(freeStripGeom.status === 'optimal', `Free strip phải optimal, nhận ${freeStripGeom.status}`);
assert(freeStripGeom.optimalPoint == null, 'Free strip không được dùng feasible witness như một optimalPoint giả.');
assert(freeStripGeom.optimalLine != null, 'Free strip phải có optimalLine vì nghiệm tối ưu là một đường thẳng.');
assert(Math.abs((freeStripGeom.optimalLine?.value ?? Number.NaN) - 10) < 1e-7, `Free strip max z phải bằng 10, nhận ${freeStripGeom.optimalLine?.value}`);

const freeStripSummary = buildResultSummary(solveLP(freeStrip, 'geometric'));
assert(freeStripSummary.solutionText.includes('Vô số nghiệm tối ưu trên đường'), `Free strip summary phải ghi nghiệm tối ưu trên đường, nhận ${freeStripSummary.solutionText}`);
assert(!freeStripSummary.solutionText.includes('x1 = 0, x2 = 0'), `Free strip summary không được hiển thị witness (0,0) như nghiệm tối ưu, nhận ${freeStripSummary.solutionText}`);
assert(freeStripSummary.optimalValueText === 'max z = 10', `Free strip optimal value phải là max z = 10, nhận ${freeStripSummary.optimalValueText}`);

console.log('✓ Hình học xử lý miền khả thi không có đỉnh và nghiệm tối ưu dạng đường');


const optimalRayCase: LPInput = {
  optimization: 'max',
  n: 2,
  m: 3,
  c: [3, 3],
  A: [
    [1, 1],
    [-1, -1],
    [1, -1],
  ],
  signs: ['<=', '<=', '<='],
  b: [4, -2, 2],
  variableTypes: ['free', 'free'],
};

const rayGeom = solveGeometric(optimalRayCase);
assert(rayGeom.status === 'optimal', `Optimal ray case phải optimal, nhận ${rayGeom.status}`);
assert(rayGeom.optimalRay != null, 'Optimal ray case phải có optimalRay vì nghiệm tối ưu là một tia.');
assert(Math.abs((rayGeom.optimalRay?.value ?? Number.NaN) - 12) < 1e-7, `Optimal ray max z phải bằng 12, nhận ${rayGeom.optimalRay?.value}`);

const raySummary = buildResultSummary(solveLP(optimalRayCase, 'geometric'));
assert(raySummary.solutionText.includes('Vô số nghiệm tối ưu trên tia'), `Summary phải ghi nghiệm tối ưu trên tia, nhận ${raySummary.solutionText}`);
assert(raySummary.optimalValueText === 'max z = 12', `Optimal ray value phải là max z = 12, nhận ${raySummary.optimalValueText}`);
assert(!raySummary.conclusion.includes('duy nhất'), `Optimal ray conclusion không được ghi nghiệm duy nhất, nhận ${raySummary.conclusion}`);

console.log('✓ Hình học xử lý nghiệm tối ưu dạng tia');

console.log('All geometry final tests passed.');
