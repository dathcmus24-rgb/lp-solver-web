import { analyzeTwoPhaseX0 } from '../src/lib/twoPhaseX0';
import { solveLP } from '../src/lib/simplex';
import { standardize } from '../src/lib/standardize';
import type { LPInput } from '../src/lib/types';

const nn = (n: number): LPInput['variableTypes'] => Array.from({ length: n }, () => 'nonnegative');

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

// Case người dùng phản ánh: phần từ vựng x0 kết luận vô nghiệm.
// Kết quả tổng kết bên trên cũng phải đồng bộ là infeasible.
const x0InfeasibleCase: LPInput = {
  optimization: 'max',
  n: 3,
  m: 2,
  c: [2, -6, 0],
  A: [
    [-1, 1, -1],
    [2, -1, 1],
  ],
  signs: ['<=', '<='],
  b: [-2, 1],
  variableTypes: nn(3),
};

const analysis = analyzeTwoPhaseX0(standardize(x0InfeasibleCase));
assert(analysis.phaseOneInfeasible, 'Pha 1 x0 phải kết luận vô nghiệm cho case này.');

const result = solveLP(x0InfeasibleCase, 'two-phase');
assert(result.status === 'infeasible', `Tổng kết bên trên phải là infeasible, nhận ${result.status}`);

console.log('✓ Two-Phase x0 infeasible được đồng bộ vào result.status');
console.log('All Two-Phase x0 sync tests passed.');
