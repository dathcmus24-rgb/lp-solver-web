import { analyzeTwoPhaseX0 } from '../src/lib/twoPhaseX0';
import { solveLP } from '../src/lib/simplex';
import { standardize } from '../src/lib/standardize';
import type { LPInput } from '../src/lib/types';

const nn = (n: number): LPInput['variableTypes'] => Array.from({ length: n }, () => 'nonnegative');

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

// Case có b âm nhưng Pha 1 cho sang Pha 2 và nghiệm phải được lấy từ từ vựng tối ưu Pha 2.
const input: LPInput = {
  optimization: 'min',
  n: 2,
  m: 2,
  c: [1, 1],
  A: [
    [-1, 0],
    [0, 1],
  ],
  signs: ['<=', '<='],
  b: [-1, 4],
  variableTypes: nn(2),
};

const analysis = analyzeTwoPhaseX0(standardize(input));
assert(analysis.status === 'optimal', `Kỳ vọng optimal, nhận ${analysis.status}`);
assert(analysis.solutionOriginal[0] === 1, `Kỳ vọng x1 = 1, nhận ${analysis.solutionOriginal[0]}`);

const result = solveLP(input, 'two-phase');
assert(result.status === 'optimal', `solveLP phải trả optimal, nhận ${result.status}`);
assert(result.solutionOriginal[0] === 1, `solveLP phải lấy nghiệm từ Pha 2, nhận x1=${result.solutionOriginal[0]}`);

console.log('✓ Two-Phase x0 lấy nghiệm từ từ vựng tối ưu Pha 2');
console.log('All Two-Phase x0 solution sync tests passed.');
