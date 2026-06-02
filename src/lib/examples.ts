import type { LPInput, SolveMethod, SolveStatus } from './types';

export interface LPExample {
  id: string;
  title: string;
  category: 'Simplex' | 'Bland' | 'Two-Phase' | 'Geometric' | 'Special';
  method: SolveMethod;
  expectedStatus: SolveStatus;
  description: string;
  input: LPInput;
}

const nn = (n: number): LPInput['variableTypes'] => Array.from({ length: n }, () => 'nonnegative');
const np = (n: number): LPInput['variableTypes'] => Array.from({ length: n }, () => 'nonpositive');
const free = (n: number): LPInput['variableTypes'] => Array.from({ length: n }, () => 'free');

export const lpExamples: LPExample[] = [
  {
    id: 'simplex-basic-positive-b',
    title: 'Simplex cơ bản: b > 0',
    category: 'Simplex',
    method: 'simplex',
    expectedStatus: 'optimal',
    description: 'Ví dụ Simplex với mọi RHS dương, có thể giải trực tiếp bằng đơn hình.',
    input: {
      optimization: 'min',
      n: 5,
      m: 4,
      c: [-10, 57, 9, 24, -100],
      A: [
        [0.5, -5.5, -2.5, 9, 1],
        [0.5, -1.5, -0.5, 1, 1],
        [1, 0, 0, 0, 1],
        [0, 0, 0, 0, 1],
      ],
      signs: ['<=', '<=', '<=', '<='],
      b: [1, 1, 1, 1],
      variableTypes: nn(5),
    },
  },
  {
    id: 'bland-degenerate-zero-b',
    title: 'Bland: xử lý suy biến b = 0',
    category: 'Bland',
    method: 'bland',
    expectedStatus: 'optimal',
    description: 'Ví dụ có RHS bằng 0, phù hợp để kiểm tra Bland khi có suy biến.',
    input: {
      optimization: 'min',
      n: 2,
      m: 4,
      c: [2, -5],
      A: [
        [1, 3],
        [2, -3],
        [-1, 1],
        [-1, 2],
      ],
      signs: ['<=', '<=', '<=', '<='],
      b: [10, 0, 3, 1],
      variableTypes: nn(2),
    },
  },
  {
    id: 'two-phase-negative-b',
    title: 'Two-Phase: có b < 0',
    category: 'Two-Phase',
    method: 'two-phase',
    expectedStatus: 'optimal',
    description: 'Ví dụ có ràng buộc làm xuất hiện RHS âm sau chuẩn hóa, cần dùng phương pháp hai pha.',
    input: {
      optimization: 'max',
      n: 2,
      m: 3,
      c: [3, 1],
      A: [
        [-1, 1],
        [-1, -1],
        [2, 1],
      ],
      signs: ['>=', '<=', '<='],
      b: [1, -3, 4],
      variableTypes: nn(2),
    },
  },
  {
    id: 'two-phase-infeasible',
    title: 'Two-Phase: vô nghiệm',
    category: 'Two-Phase',
    method: 'two-phase',
    expectedStatus: 'infeasible',
    description: 'Ví dụ phương pháp hai pha kết luận miền nghiệm rỗng.',
    input: {
      optimization: 'min',
      n: 2,
      m: 3,
      c: [-3, -1],
      A: [
        [1, -1],
        [1, 1],
        [2, 1],
      ],
      signs: ['<=', '>=', '<='],
      b: [-1, 3, 2],
      variableTypes: nn(2),
    },
  },
  {
    id: 'geometric-finite-optimal',
    title: 'Hình học: hữu hạn nghiệm',
    category: 'Geometric',
    method: 'geometric',
    expectedStatus: 'optimal',
    description: 'Ví dụ hình học có miền nghiệm hữu hạn và nghiệm tối ưu hữu hạn.',
    input: {
      optimization: 'min',
      n: 2,
      m: 3,
      c: [-1, 1],
      A: [
        [-1, -2],
        [1, -2],
        [-1, 1],
      ],
      signs: ['<=', '<=', '<='],
      b: [6, 4, 1],
      variableTypes: np(2),
    },
  },
  {
    id: 'geometric-alternate-optimum',
    title: 'Hình học: vô số nghiệm',
    category: 'Geometric',
    method: 'geometric',
    expectedStatus: 'optimal',
    description: 'Ví dụ hình học có vô số nghiệm tối ưu trên một đoạn thẳng.',
    input: {
      optimization: 'max',
      n: 2,
      m: 5,
      c: [1, -1],
      A: [
        [3, 1],
        [1, 2],
        [1, -1],
        [1, 0],
        [0, 1],
      ],
      signs: ['>=', '>=', '<=', '<=', '<='],
      b: [3, 4, 1, 5, 5],
      variableTypes: free(2),
    },
  },
  {
    id: 'geometric-infeasible',
    title: 'Hình học: vô nghiệm',
    category: 'Geometric',
    method: 'geometric',
    expectedStatus: 'infeasible',
    description: 'Ví dụ hình học có các ràng buộc mâu thuẫn, miền nghiệm rỗng.',
    input: {
      optimization: 'max',
      n: 2,
      m: 2,
      c: [3, 2],
      A: [
        [2, 1],
        [3, 4],
      ],
      signs: ['<=', '>='],
      b: [2, 12],
      variableTypes: nn(2),
    },
  },
  {
    id: 'geometric-unbounded',
    title: 'Hình học: không giới nội',
    category: 'Geometric',
    method: 'geometric',
    expectedStatus: 'unbounded',
    description: 'Ví dụ hình học có hàm mục tiêu tăng vô hạn trên miền nghiệm.',
    input: {
      optimization: 'max',
      n: 2,
      m: 3,
      c: [1, 3],
      A: [
        [-1, -1],
        [-1, 1],
        [-1, 2],
      ],
      signs: ['<=', '<=', '<='],
      b: [-3, -1, 2],
      variableTypes: nn(2),
    },
  },
];

export function getExampleById(id: string): LPExample | undefined {
  return lpExamples.find((example) => example.id === id);
}

export function cloneExampleInput(example: LPExample): LPInput {
  return {
    ...example.input,
    c: [...example.input.c],
    A: example.input.A.map((row) => [...row]),
    signs: [...example.input.signs],
    b: [...example.input.b],
    variableTypes: [...example.input.variableTypes],
  };
}
