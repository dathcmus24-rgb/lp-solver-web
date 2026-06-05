import { solveLP } from '../src/lib/simplex';
import type { LPInput, SolveMethod } from '../src/lib/types';

const EPS = 1e-7;

function assertClose(actual: number, expected: number, label: string): void {
  if (Math.abs(actual - expected) > EPS) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertFeasible(input: LPInput, solution: number[], label: string): void {
  for (let j = 0; j < input.n; j += 1) {
    if ((solution[j] ?? 0) < -EPS) {
      throw new Error(`${label}: x${j + 1} should be nonnegative, got ${solution[j]}`);
    }
  }

  for (let i = 0; i < input.m; i += 1) {
    const lhs = input.A[i].reduce((sum, coef, j) => sum + coef * (solution[j] ?? 0), 0);
    const rhs = input.b[i];
    const sign = input.signs[i];

    if (sign === '=') assertClose(lhs, rhs, `${label}: constraint ${i + 1}`);
    if (sign === '<=' && lhs > rhs + EPS) {
      throw new Error(`${label}: constraint ${i + 1} expected <= ${rhs}, got ${lhs}`);
    }
    if (sign === '>=' && lhs < rhs - EPS) {
      throw new Error(`${label}: constraint ${i + 1} expected >= ${rhs}, got ${lhs}`);
    }
  }
}

const precisionCase: LPInput = {
  optimization: 'min',
  n: 6,
  m: 2,
  c: [-14, -18, -16, -10, 0, 0],
  A: [
    [4.5, 8.5, 6, 20, 1, 0],
    [1, 1, 4, 40, 0, 1],
  ],
  signs: ['=', '='],
  b: [6000, 4000],
  variableTypes: ['nonnegative', 'nonnegative', 'nonnegative', 'nonnegative', 'nonnegative', 'nonnegative'],
};

const methods: SolveMethod[] = ['two-phase'];

for (const method of methods) {
  const result = solveLP(precisionCase, method);

  if (result.status !== 'optimal') {
    throw new Error(`${method}: expected optimal, got ${result.status}. Message: ${result.message}`);
  }

  assertFeasible(precisionCase, result.solutionOriginal, method);

  if (result.optimalValue == null) {
    throw new Error(`${method}: optimalValue should not be null`);
  }

  assertClose(result.optimalValue, -18666.6666666667, `${method}: optimal value`);

  const expectedX1 = 1333.3333333333;
  assertClose(result.solutionOriginal[0], expectedX1, `${method}: x1`);
  assertClose(result.solutionOriginal[1], 0, `${method}: x2`);
  assertClose(result.solutionOriginal[2], 0, `${method}: x3`);
  assertClose(result.solutionOriginal[3], 0, `${method}: x4`);
  assertClose(result.solutionOriginal[4], 0, `${method}: x5`);
  assertClose(result.solutionOriginal[5], 2666.6666666667, `${method}: x6`);
}

console.log('Precision regression checks passed.');
