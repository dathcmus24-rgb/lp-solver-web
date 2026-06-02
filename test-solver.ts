import { solveLP } from './src/lib/simplex';
import { solveGeometric } from './src/lib/geometry';
import type { LPInput, SolveMethod } from './src/lib/types';

const EPS = 1e-6;
function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS;
}

interface TestCase {
  name: string;
  input: LPInput;
  expected: {
    status?: string;
    optimalValue?: number | null;
    solution?: number[];
  };
  methods?: SolveMethod[];
}

const tests: TestCase[] = [
  // 1. Sample max problem (all <=)
  {
    name: 'max 3x1+5x2, all <= constraints',
    input: {
      optimization: 'max', n: 2, m: 3,
      c: [3, 5],
      A: [[1, 0], [0, 2], [3, 2]],
      signs: ['<=', '<=', '<='],
      b: [4, 12, 18],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    expected: { optimalValue: 36, solution: [2, 6] },
  },
  // 2. Simple min with >= constraints (needs Two-Phase)
  {
    name: 'min 2x1+3x2, >= constraints',
    input: {
      optimization: 'min', n: 2, m: 2,
      c: [2, 3],
      A: [[1, 1], [1, 3]],
      signs: ['>=', '>='],
      b: [4, 6],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    expected: { optimalValue: 9, solution: [3, 1] },
  },
  // 3. Infeasible problem
  {
    name: 'Infeasible: x1+x2<=2 AND x1+x2>=5',
    input: {
      optimization: 'max', n: 2, m: 2,
      c: [1, 1],
      A: [[1, 1], [1, 1]],
      signs: ['<=', '>='],
      b: [2, 5],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    expected: { status: 'infeasible', optimalValue: null },
  },
  // 4. Unbounded problem
  {
    name: 'Unbounded: max x1+x2, x1-x2<=4',
    input: {
      optimization: 'max', n: 2, m: 1,
      c: [1, 1],
      A: [[1, -1]],
      signs: ['<='],
      b: [4],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    expected: { status: 'unbounded', optimalValue: null },
  },
  // 5. Equality constraint
  {
    name: 'min 2x1+3x2, x1+x2=10, x1<=8, x2<=8',
    input: {
      optimization: 'min', n: 2, m: 3,
      c: [2, 3],
      A: [[1, 1], [1, 0], [0, 1]],
      signs: ['=', '<=', '<='],
      b: [10, 8, 8],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    expected: { optimalValue: 22, solution: [8, 2] },
  },
  // 6. Single variable
  {
    name: 'Single var: max 5x1, x1<=10',
    input: {
      optimization: 'max', n: 1, m: 1,
      c: [5],
      A: [[1]],
      signs: ['<='],
      b: [10],
      variableTypes: ['nonnegative'],
    },
    expected: { optimalValue: 50, solution: [10] },
  },
  // 7. Nonpositive variable: max x1, x1<=0, x1>=-5
  {
    name: 'Nonpositive var: max x1, x1>=-5 (x1<=0)',
    input: {
      optimization: 'max', n: 1, m: 1,
      c: [1],
      A: [[1]],
      signs: ['>='],
      b: [-5],
      variableTypes: ['nonpositive'],
    },
    expected: { optimalValue: 0, solution: [0] },
  },
  // 8. Free variable
  {
    name: 'Free var: min x1, x1>=-3, x1<=5',
    input: {
      optimization: 'min', n: 1, m: 2,
      c: [1],
      A: [[1], [1]],
      signs: ['>=', '<='],
      b: [-3, 5],
      variableTypes: ['free'],
    },
    expected: { optimalValue: -3, solution: [-3] },
  },
  // 9. Degenerate problem
  {
    name: 'Degenerate: max 2x1+x2, x1+x2<=4, x1<=4, x2<=4',
    input: {
      optimization: 'max', n: 2, m: 3,
      c: [2, 1],
      A: [[1, 1], [1, 0], [0, 1]],
      signs: ['<=', '<=', '<='],
      b: [4, 4, 4],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    expected: { optimalValue: 8, solution: [4, 0] },
  },
  // 10. 3 variables
  {
    name: '3 vars: max x1+2x2+3x3',
    input: {
      optimization: 'max', n: 3, m: 3,
      c: [1, 2, 3],
      A: [[1, 1, 1], [2, 1, 0], [0, 1, 3]],
      signs: ['<=', '<=', '<='],
      b: [10, 14, 12],
      variableTypes: ['nonnegative', 'nonnegative', 'nonnegative'],
    },
    // x1=6, x2=0, x3=4 → z=6+0+12=18
    expected: { optimalValue: 18 },
  },
  // 11. Negative b value
  {
    name: 'Negative b: max x1+x2, x1-x2>=-2, x1+x2<=6',
    input: {
      optimization: 'max', n: 2, m: 2,
      c: [1, 1],
      A: [[1, -1], [1, 1]],
      signs: ['>=', '<='],
      b: [-2, 6],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    expected: { optimalValue: 6 },
  },
  // 12. All equality constraints
  {
    name: 'All =: min x1+x2, x1+x2=5, x1-x2=1',
    input: {
      optimization: 'min', n: 2, m: 2,
      c: [1, 1],
      A: [[1, 1], [1, -1]],
      signs: ['=', '='],
      b: [5, 1],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    expected: { optimalValue: 5, solution: [3, 2] },
  },
  // 13. Alternate optimum
  {
    name: 'Alternate: max x1+x2, x1+x2<=4, x1<=3, x2<=3',
    input: {
      optimization: 'max', n: 2, m: 3,
      c: [1, 1],
      A: [[1, 1], [1, 0], [0, 1]],
      signs: ['<=', '<=', '<='],
      b: [4, 3, 3],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    expected: { optimalValue: 4 },
  },
  // 14. Mixed >= <= constraints
  {
    name: 'Mixed: min 3x1+2x2, 2x1+x2>=6, x1+2x2>=6, x1+x2<=8',
    input: {
      optimization: 'min', n: 2, m: 3,
      c: [3, 2],
      A: [[2, 1], [1, 2], [1, 1]],
      signs: ['>=', '>=', '<='],
      b: [6, 6, 8],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    expected: { optimalValue: 10, solution: [2, 2] },
  },
  // 15. Zero objective
  {
    name: 'Zero obj: min 0x1+0x2, x1+x2<=5',
    input: {
      optimization: 'min', n: 2, m: 1,
      c: [0, 0],
      A: [[1, 1]],
      signs: ['<='],
      b: [5],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    expected: { optimalValue: 0 },
  },
  // 16. Large coefficients
  {
    name: 'Large coefs: max 100x1+200x2, x1<=50, x2<=30, x1+x2<=60',
    input: {
      optimization: 'max', n: 2, m: 3,
      c: [100, 200],
      A: [[1, 0], [0, 1], [1, 1]],
      signs: ['<=', '<=', '<='],
      b: [50, 30, 60],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    // x1=30, x2=30 → z=3000+6000=9000
    expected: { optimalValue: 9000, solution: [30, 30] },
  },
  // 17. b=0 constraints
  {
    name: 'b=0: max x1+x2, x1-x2<=0, x1+x2<=4',
    input: {
      optimization: 'max', n: 2, m: 2,
      c: [1, 1],
      A: [[1, -1], [1, 1]],
      signs: ['<=', '<='],
      b: [0, 4],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    // x1<=x2 and x1+x2<=4 → max z=x1+x2=4 at x1=2,x2=2
    expected: { optimalValue: 4, solution: [2, 2] },
  },
  // 18. Min with all <= (simple)
  {
    name: 'min x1-x2, x1<=4, x2<=6, x1+x2<=8',
    input: {
      optimization: 'min', n: 2, m: 3,
      c: [1, -1],
      A: [[1, 0], [0, 1], [1, 1]],
      signs: ['<=', '<=', '<='],
      b: [4, 6, 8],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    // min x1-x2: minimize x1, maximize x2 → x1=0, x2=6. z=0-6=-6
    // check: 0<=4✓, 6<=6✓, 6<=8✓
    expected: { optimalValue: -6, solution: [0, 6] },
  },
  // 19. Two free variables
  {
    name: '2 free vars: min x1+x2, x1+x2>=4, x1-x2<=2, -x1+x2<=2',
    input: {
      optimization: 'min', n: 2, m: 3,
      c: [1, 1],
      A: [[1, 1], [1, -1], [-1, 1]],
      signs: ['>=', '<=', '<='],
      b: [4, 2, 2],
      variableTypes: ['free', 'free'],
    },
    // z = x1+x2 >= 4 (from first constraint). min z=4
    expected: { optimalValue: 4 },
  },
  // 20. Negative coefficients in objective
  {
    name: 'max -x1+2x2, x1+x2<=4, x1>=0, x2>=0',
    input: {
      optimization: 'max', n: 2, m: 1,
      c: [-1, 2],
      A: [[1, 1]],
      signs: ['<='],
      b: [4],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    // max -x1+2x2: x1=0, x2=4 → z=0+8=8
    expected: { optimalValue: 8, solution: [0, 4] },
  },
  // 21. Problem requiring Phase-1 pivot out of artificial
  {
    name: 'Phase-1 needed: min x1+x2+x3, x1+x2+x3=6, x1+x2>=4',
    input: {
      optimization: 'min', n: 3, m: 2,
      c: [1, 1, 1],
      A: [[1, 1, 1], [1, 1, 0]],
      signs: ['=', '>='],
      b: [6, 4],
      variableTypes: ['nonnegative', 'nonnegative', 'nonnegative'],
    },
    // x1+x2+x3=6, so z=6 always. Any feasible solution with x1+x2>=4 works.
    expected: { optimalValue: 6 },
  },
  // 22. Nonpositive + >= constraint
  {
    name: 'Nonpositive: min -2x1, -x1<=3 (x1<=0)',
    input: {
      optimization: 'min', n: 1, m: 1,
      c: [-2],
      A: [[-1]],
      signs: ['<='],
      b: [3],
      variableTypes: ['nonpositive'],
    },
    // x1<=0, -x1<=3 → x1>=-3. min(-2x1): at x1=-3, z=6? Wait...
    // min -2x1 with x1 ∈ [-3, 0]. f(x1) = -2x1.
    // f(-3)=6, f(0)=0. So min = 0 at x1=0.
    // Wait, let me reconsider. substitution: x1 = -u, u>=0. obj = -2(-u) = 2u → min 2u
    // constraint: -(-u) <= 3 → u <= 3. So min 2u with 0<=u<=3 → u=0, x1=0, z=0.
    expected: { optimalValue: 0, solution: [0] },
  },
  // 23. Classic transportation-like
  {
    name: 'max 5x1+4x2, 6x1+4x2<=24, x1+2x2<=6',
    input: {
      optimization: 'max', n: 2, m: 2,
      c: [5, 4],
      A: [[6, 4], [1, 2]],
      signs: ['<=', '<='],
      b: [24, 6],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    // Vertices: (0,0)z=0, (4,0)z=20, (0,3)z=12
    // 6x1+4x2=24 ∩ x1+2x2=6: 6x1+4x2=24, 3x1+6x2=18 → subtract: 3x1-2x2=6
    // x1+2x2=6 → x1=6-2x2, 3(6-2x2)-2x2=6 → 18-6x2-2x2=6 → 8x2=12 → x2=1.5
    // x1=6-3=3. Check: 18+6=24✓, 3+3=6✓. z=15+6=21
    expected: { optimalValue: 21, solution: [3, 1.5] },
  },
  // 24. Fractional optimal
  {
    name: 'Fractional: max 3x1+5x2, x1+x2<=4, x1+3x2<=6',
    input: {
      optimization: 'max', n: 2, m: 2,
      c: [3, 5],
      A: [[1, 1], [1, 3]],
      signs: ['<=', '<='],
      b: [4, 6],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    // x1+x2=4 ∩ x1+3x2=6: subtract → 2x2=2 → x2=1, x1=3. z=9+5=14
    // (0,2): z=10. (4,0): check 4+0=4✓, 4<=6✓. z=12.
    // So optimal: x1=3, x2=1, z=14
    expected: { optimalValue: 14, solution: [3, 1] },
  },
  // 25. 4 variables
  {
    name: '4 vars: max x1+x2+x3+x4, xi<=1 each, sum<=3',
    input: {
      optimization: 'max', n: 4, m: 5,
      c: [1, 1, 1, 1],
      A: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1], [1, 1, 1, 1]],
      signs: ['<=', '<=', '<=', '<=', '<='],
      b: [1, 1, 1, 1, 3],
      variableTypes: ['nonnegative', 'nonnegative', 'nonnegative', 'nonnegative'],
    },
    expected: { optimalValue: 3 },
  },
];

// ============ Run tests ============
let passed = 0;
let failed = 0;
const allMethods: SolveMethod[] = ['simplex', 'bland', 'two-phase'];

console.log('========== Simplex Solver Tests ==========\n');

for (const test of tests) {
  const methodsToTest = test.methods ?? allMethods;
  for (const method of methodsToTest) {
    try {
      const result = solveLP(test.input, method);
      const errors: string[] = [];

      if (test.expected.status) {
        if (result.status !== test.expected.status) {
          errors.push(`status: expected "${test.expected.status}", got "${result.status}"`);
        }
      } else {
        if (!['optimal', 'degenerate', 'alternate-optimum'].includes(result.status)) {
          errors.push(`status: expected optimal-like, got "${result.status}" (msg: ${result.message})`);
        }
      }

      if (test.expected.optimalValue !== undefined) {
        if (test.expected.optimalValue === null) {
          if (result.optimalValue !== null) {
            errors.push(`optimalValue: expected null, got ${result.optimalValue}`);
          }
        } else if (result.optimalValue === null || !approxEqual(result.optimalValue, test.expected.optimalValue)) {
          errors.push(`optimalValue: expected ${test.expected.optimalValue}, got ${result.optimalValue}`);
        }
      }

      if (test.expected.solution) {
        for (let i = 0; i < test.expected.solution.length; i++) {
          const got = result.solutionOriginal[i] ?? NaN;
          if (!approxEqual(got, test.expected.solution[i])) {
            errors.push(`solution[x${i + 1}]: expected ${test.expected.solution[i]}, got ${got}`);
          }
        }
      }

      if (errors.length > 0) {
        console.log(`❌ FAIL [${method.padEnd(9)}] ${test.name}`);
        errors.forEach((e) => console.log(`   → ${e}`));
        console.log(`   Full: status=${result.status}, z=${result.optimalValue}, x=[${result.solutionOriginal}]`);
        failed++;
      } else {
        console.log(`✅ PASS [${method.padEnd(9)}] ${test.name}`);
        passed++;
      }
    } catch (e: any) {
      console.log(`💥 CRASH [${method.padEnd(9)}] ${test.name}`);
      console.log(`   → ${e.message}`);
      failed++;
    }
  }
}

// ============ Geometric Solver Tests ============
console.log('\n========== Geometric Solver Tests ==========\n');

for (const test of tests) {
  if (test.input.n !== 2) continue;
  try {
    const result = solveGeometric(test.input);
    const errors: string[] = [];

    if (test.expected.status === 'infeasible') {
      if (result.status !== 'infeasible') {
        errors.push(`status: expected infeasible, got "${result.status}"`);
      }
    } else if (test.expected.status === 'unbounded') {
      // Geometric solver cannot detect unbounded — log as known limitation
      if (result.status === 'optimal' && result.optimalPoint) {
        errors.push(`should be unbounded, but got optimal z=${result.optimalPoint.value} (KNOWN LIMITATION)`);
      }
    } else if (test.expected.optimalValue !== undefined && test.expected.optimalValue !== null) {
      if (!result.optimalPoint || !approxEqual(result.optimalPoint.value, test.expected.optimalValue)) {
        errors.push(`optimalValue: expected ${test.expected.optimalValue}, got ${result.optimalPoint?.value}`);
      }
    }

    if (errors.length > 0) {
      console.log(`❌ FAIL [geometric ] ${test.name}`);
      errors.forEach((e) => console.log(`   → ${e}`));
      failed++;
    } else {
      console.log(`✅ PASS [geometric ] ${test.name}`);
      passed++;
    }
  } catch (e: any) {
    console.log(`💥 CRASH [geometric ] ${test.name}`);
    console.log(`   → ${e.message}`);
    failed++;
  }
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(50)}`);
if (failed > 0) process.exit(1);
