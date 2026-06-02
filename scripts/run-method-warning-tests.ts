import { analyzeMethod } from '../src/lib/methodGuidance';
import type { LPInput, SolveMethod } from '../src/lib/types';

const nn = (n: number): LPInput['variableTypes'] => Array.from({ length: n }, () => 'nonnegative');

const cases: Array<{
  name: string;
  input: LPInput;
  method: SolveMethod;
  canRun: boolean;
  severity: 'ok' | 'info' | 'warning' | 'error';
  recommendedMethod?: SolveMethod;
}> = [
  {
    name: 'Simplex bị chặn khi có b_i < 0',
    method: 'simplex',
    canRun: false,
    severity: 'error',
    recommendedMethod: 'two-phase',
    input: {
      optimization: 'min',
      n: 1,
      m: 1,
      c: [1],
      A: [[1]],
      signs: ['<='],
      b: [-1],
      variableTypes: nn(1),
    },
  },
  {
    name: 'Bland bị chặn khi có b_i < 0',
    method: 'bland',
    canRun: false,
    severity: 'error',
    recommendedMethod: 'two-phase',
    input: {
      optimization: 'min',
      n: 1,
      m: 1,
      c: [1],
      A: [[1]],
      signs: ['<='],
      b: [-1],
      variableTypes: nn(1),
    },
  },
  {
    name: 'Simplex cảnh báo khi có b_i = 0',
    method: 'simplex',
    canRun: true,
    severity: 'warning',
    recommendedMethod: 'bland',
    input: {
      optimization: 'max',
      n: 2,
      m: 1,
      c: [1, 1],
      A: [[1, 1]],
      signs: ['<='],
      b: [0],
      variableTypes: nn(2),
    },
  },
  {
    name: 'Bland phù hợp khi có b_i = 0',
    method: 'bland',
    canRun: true,
    severity: 'ok',
    input: {
      optimization: 'max',
      n: 2,
      m: 1,
      c: [1, 1],
      A: [[1, 1]],
      signs: ['<='],
      b: [0],
      variableTypes: nn(2),
    },
  },
  {
    name: 'Two-Phase phù hợp khi có b_i < 0',
    method: 'two-phase',
    canRun: true,
    severity: 'ok',
    input: {
      optimization: 'min',
      n: 1,
      m: 1,
      c: [1],
      A: [[1]],
      signs: ['<='],
      b: [-1],
      variableTypes: nn(1),
    },
  },
  {
    name: 'Two-Phase chỉ là ghi chú khi b_i >= 0',
    method: 'two-phase',
    canRun: true,
    severity: 'info',
    recommendedMethod: 'simplex',
    input: {
      optimization: 'max',
      n: 2,
      m: 1,
      c: [1, 1],
      A: [[1, 1]],
      signs: ['<='],
      b: [2],
      variableTypes: nn(2),
    },
  },
  {
    name: 'Geometric bị chặn khi không phải 2 biến',
    method: 'geometric',
    canRun: false,
    severity: 'error',
    input: {
      optimization: 'max',
      n: 3,
      m: 1,
      c: [1, 1, 1],
      A: [[1, 1, 1]],
      signs: ['<='],
      b: [2],
      variableTypes: nn(3),
    },
  },
];

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

for (const item of cases) {
  const guidance = analyzeMethod(item.input, item.method);

  assert(guidance.canRun === item.canRun, `${item.name}: canRun phải là ${item.canRun}, nhận ${guidance.canRun}`);
  assert(guidance.severity === item.severity, `${item.name}: severity phải là ${item.severity}, nhận ${guidance.severity}`);

  if (item.recommendedMethod) {
    assert(guidance.recommendedMethod === item.recommendedMethod, `${item.name}: recommendedMethod phải là ${item.recommendedMethod}, nhận ${guidance.recommendedMethod}`);
  }

  assert(guidance.reasons.length > 0, `${item.name}: phải có lý do`);
  assert(guidance.nextSteps.length > 0, `${item.name}: phải có hướng xử lý`);

  console.log(`✓ ${item.name}`);
}

console.log('All method-warning tests passed.');
