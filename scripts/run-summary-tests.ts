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

const altResult = solveLP(alternate, 'simplex');
const altSummary = buildResultSummary(altResult);
assert(altResult.status === 'optimal', `Đa nghiệm: kỳ vọng optimal, nhận ${altResult.status}`);
assert(altSummary.conclusion.includes('vô số nghiệm tối ưu'), 'Kết luận phải nói vô số nghiệm tối ưu');
assert(altSummary.optimalSegment != null, 'Bài 2 biến đa nghiệm phải tìm được đoạn AB');

const infeasible: LPInput = {
  optimization: 'min',
  n: 1,
  m: 1,
  c: [1],
  A: [[1]],
  signs: ['<='],
  b: [-1],
  variableTypes: nn(1),
};

const infeasibleResult = solveLP(infeasible, 'two-phase');
const infeasibleSummary = buildResultSummary(infeasibleResult);
assert(infeasibleSummary.statusText === 'Vô nghiệm' || infeasibleSummary.statusText === 'Lỗi / chưa thể giải', 'Phải tóm tắt được trạng thái vô nghiệm/error');

const unbounded: LPInput = {
  optimization: 'max',
  n: 2,
  m: 1,
  c: [1, 1],
  A: [[-1, 0]],
  signs: ['<='],
  b: [0],
  variableTypes: nn(2),
};

const unboundedResult = solveLP(unbounded, 'simplex');
const unboundedSummary = buildResultSummary(unboundedResult);
assert(unboundedSummary.statusText === 'Không giới nội', 'Phải tóm tắt trạng thái không giới nội');

console.log('✓ Summary nhận diện vô số nghiệm và đoạn AB');
console.log('✓ Summary nhận diện vô nghiệm/error');
console.log('✓ Summary nhận diện không giới nội');
console.log('All summary tests passed.');
