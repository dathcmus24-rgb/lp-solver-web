import { lpExamples } from '../src/lib/examples';
import { solveLP } from '../src/lib/simplex';
import { analyzeTwoPhaseX0 } from '../src/lib/twoPhaseX0';
import { buildResultSummary } from '../src/lib/solutionSummary';
import type { LPInput } from '../src/lib/types';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function expectedStatusText(status: string): string {
  if (status === 'optimal') return 'Tối ưu';
  if (status === 'infeasible') return 'Vô nghiệm';
  if (status === 'unbounded') return 'Không giới nội';
  throw new Error(`Unexpected status for Two-Phase x0 summary test: ${status}`);
}

function checkCase(name: string, input: LPInput): void {
  const result = solveLP(input, 'two-phase');
  const x0 = analyzeTwoPhaseX0(result.standard);
  const summary = buildResultSummary(result);

  if (!x0.hasNegativeRhs || x0.status === 'skip') {
    return;
  }

  assert(
    summary.statusText === expectedStatusText(x0.status),
    `${name}: summary status "${summary.statusText}" must match x0 status "${x0.status}".`,
  );

  if (x0.status === 'infeasible') {
    assert(summary.solutionText === 'Không có nghiệm khả thi', `${name}: infeasible summary must not show an optimal solution.`);
    const conclusion = summary.conclusion.toLowerCase();
    assert(
      (conclusion.includes('x₀') || conclusion.includes('x0')) &&
        conclusion.includes('> 0') &&
        conclusion.includes('vô nghiệm'),
      `${name}: infeasible conclusion must mention the Phase 1 rule x0 > 0 implies infeasible. Got: "${summary.conclusion}".`,
    );
  }

  if (x0.status === 'optimal') {
    assert(summary.solutionText.includes('x1 =') || summary.solutionText.includes('x2 ='), `${name}: optimal summary must show a solution vector.`);
    assert(summary.optimalValueText.includes('z ='), `${name}: optimal summary must show objective value.`);
  }

  if (x0.status === 'unbounded') {
    assert(summary.solutionText === 'Không có nghiệm tối ưu hữu hạn', `${name}: unbounded summary must not show a finite solution.`);
    assert(summary.optimalValueText.includes('∞'), `${name}: unbounded summary must show infinite objective conclusion.`);
  }
}

const twoPhaseExamples = lpExamples.filter((example) => example.method === 'two-phase');
assert(twoPhaseExamples.length > 0, 'Expected at least one two-phase example.');

for (const example of twoPhaseExamples) {
  checkCase(example.title, example.input);
}

// Regression case: the detailed Two-Phase x0 view can conclude infeasible
// even when a generic SimplexResult object contains a finite tableau value.
// The summary must follow the x0 verdict.
const x0InfeasibleRegression: LPInput = {
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
  variableTypes: ['nonnegative', 'nonnegative'],
};

checkCase('Regression: x0 phase-one infeasible summary', x0InfeasibleRegression);

console.log('✓ Two-Phase summaries are synchronized with the x0 phase verdict.');
