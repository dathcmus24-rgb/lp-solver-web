import { solveLP } from '../src/lib/simplex';
import { standardize } from '../src/lib/standardize';
import { analyzeMethod } from '../src/lib/methodGuidance';
import type { LPInput, SolveMethod, SolveStatus } from '../src/lib/types';

type FlowCase = {
  name: string;
  input: LPInput;
  method: SolveMethod;
  expectedStatus?: SolveStatus;
  expectPhase1?: boolean;
  expectNoPhase1?: boolean;
  expectGuidanceSeverity?: 'ok' | 'info' | 'warning' | 'error';
};

const cases: FlowCase[] = [
  {
    name: 'Simplex giải trực tiếp khi mọi b_i > 0',
    method: 'simplex',
    input: {
      optimization: 'max',
      n: 2,
      m: 3,
      c: [3, 5],
      A: [
        [1, 0],
        [0, 2],
        [3, 2],
      ],
      signs: ['<=', '<=', '<='],
      b: [4, 12, 18],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    expectedStatus: 'optimal',
    expectNoPhase1: true,
    expectGuidanceSeverity: 'ok',
  },
  {
    name: 'Bland xử lý được trường hợp b_i = 0',
    method: 'bland',
    input: {
      optimization: 'min',
      n: 1,
      m: 1,
      c: [1],
      A: [[1]],
      signs: ['<='],
      b: [0],
      variableTypes: ['nonnegative'],
    },
    expectedStatus: 'optimal',
    expectNoPhase1: true,
    expectGuidanceSeverity: 'ok',
  },
  {
    name: 'Simplex không tự chạy 2 pha khi có b_i < 0',
    method: 'simplex',
    input: {
      optimization: 'min',
      n: 1,
      m: 1,
      c: [1],
      A: [[1]],
      signs: ['<='],
      b: [-1],
      variableTypes: ['nonnegative'],
    },
    expectedStatus: 'error',
    expectNoPhase1: true,
    expectGuidanceSeverity: 'error',
  },
  {
    name: 'Two-Phase được kích hoạt khi có b_i < 0',
    method: 'two-phase',
    input: {
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
      variableTypes: ['nonnegative', 'nonnegative', 'nonnegative'],
    },
    expectPhase1: true,
    expectGuidanceSeverity: 'ok',
  },
  {
    name: 'Two-Phase không cần Pha 1 khi mọi b_i >= 0',
    method: 'two-phase',
    input: {
      optimization: 'max',
      n: 2,
      m: 2,
      c: [1, 1],
      A: [
        [1, 0],
        [0, 1],
      ],
      signs: ['<=', '<='],
      b: [2, 3],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    expectNoPhase1: true,
    expectGuidanceSeverity: 'info',
  },
];

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

for (const item of cases) {
  const standard = standardize(item.input);
  assert(
    standard.constraints.every((row) => row.sign === '<='),
    `${item.name}: standardize phải đưa mọi ràng buộc về <=`,
  );

  const guidance = analyzeMethod(item.input, item.method);
  if (item.expectGuidanceSeverity) {
    assert(
      guidance.severity === item.expectGuidanceSeverity,
      `${item.name}: guidance severity phải là ${item.expectGuidanceSeverity}, nhận ${guidance.severity}`,
    );
  }

  const result = solveLP(item.input, item.method);

  if (item.expectedStatus) {
    assert(
      result.status === item.expectedStatus,
      `${item.name}: status phải là ${item.expectedStatus}, nhận ${result.status}`,
    );
  }

  const hasPhase1 = result.steps.some((step) => step.phase === 'Phase 1');
  if (item.expectPhase1) assert(hasPhase1, `${item.name}: phải có bước Phase 1`);
  if (item.expectNoPhase1) assert(!hasPhase1, `${item.name}: không được tự chạy Phase 1`);

  console.log(`✓ ${item.name}`);
}

console.log('All method-flow tests passed.');
