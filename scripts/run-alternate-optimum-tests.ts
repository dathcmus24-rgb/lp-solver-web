import { solveLP } from '../src/lib/simplex';
import type { LPInput } from '../src/lib/types';

const nn = (n: number): LPInput['variableTypes'] => Array.from({ length: n }, () => 'nonnegative');

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

// Trường hợp suy biến b = 0: hình học chỉ có một điểm tối ưu.
// Bland không được kết luận vô số nghiệm chỉ vì có reduced cost bằng 0.
const degenerateUnique: LPInput = {
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
  b: [0, 2, 2],
  variableTypes: nn(2),
};

const blandResult = solveLP(degenerateUnique, 'bland');
assert(
  !blandResult.hasAlternateOptimum,
  `Bland không được kết luận vô số nghiệm trong case suy biến b=0, nhận hasAlternateOptimum=${blandResult.hasAlternateOptimum}`,
);

// Trường hợp thật sự có vô số nghiệm tối ưu.
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

const alternateResult = solveLP(alternate, 'bland');
assert(
  alternateResult.hasAlternateOptimum,
  'Bland vẫn phải nhận diện vô số nghiệm tối ưu thật sự khi tồn tại cạnh tối ưu.',
);

console.log('✓ Bland không còn báo vô số nghiệm sai trong case suy biến b = 0');
console.log('✓ Bland vẫn nhận diện đúng case vô số nghiệm thật sự');
console.log('All alternate-optimum false-positive tests passed.');
