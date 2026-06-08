import { lpExamples } from '../src/lib/examples';
import { solveLP } from '../src/lib/simplex';
import { solveGeometric } from '../src/lib/geometry';
import { buildResultSummary } from '../src/lib/solutionSummary';
import { analyzeTwoPhaseX0 } from '../src/lib/twoPhaseX0';
import type { LPInput, SolveMethod } from '../src/lib/types';

type AuditLevel = 'PASS' | 'WARN' | 'FAIL';

type AuditItem = {
  level: AuditLevel;
  group: string;
  name: string;
  detail: string;
};

const items: AuditItem[] = [];

function log(level: AuditLevel, group: string, name: string, detail: string): void {
  items.push({ level, group, name, detail });
}

function assertAudit(condition: unknown, group: string, name: string, detail: string): void {
  log(condition ? 'PASS' : 'FAIL', group, name, detail);
}

function approx(a: number | null | undefined, b: number | null | undefined, eps = 1e-7): boolean {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(a - b) <= eps;
}

function statusTextFromX0(status: string): string {
  if (status === 'optimal') return 'Tối ưu';
  if (status === 'infeasible') return 'Vô nghiệm';
  if (status === 'unbounded') return 'Không giới nội';
  return 'Chưa chạy';
}

function solveByMethod(input: LPInput, method: SolveMethod) {
  if (method === 'geometric') return null;
  return solveLP(input, method);
}

function checkExamples(): void {
  for (const example of lpExamples) {
    if (example.method === 'geometric') {
      const geom = solveGeometric(example.input);
      assertAudit(
        geom.status === example.expectedStatus,
        'Examples / Geometric',
        example.title,
        `Expected ${example.expectedStatus}, got ${geom.status}.`,
      );
      continue;
    }

    const result = solveLP(example.input, example.method);
    assertAudit(
      result.status === example.expectedStatus,
      `Examples / ${example.method}`,
      example.title,
      `Expected ${example.expectedStatus}, got ${result.status}.`,
    );

    const summary = buildResultSummary(result);
    assertAudit(
      summary.methodText.length > 0 && summary.statusText.length > 0 && summary.conclusion.length > 0,
      'Summary',
      example.title,
      `Summary status: ${summary.statusText}.`,
    );
  }
}

function checkTwoPhaseSummarySync(): void {
  for (const example of lpExamples) {
    const result = solveLP(example.input, 'two-phase');
    const analysis = analyzeTwoPhaseX0(result.standard);

    if (!analysis.hasNegativeRhs || analysis.status === 'skip') {
      log('PASS', 'Two-Phase sync', example.title, 'No negative RHS after standardization, Phase 1 skipped.');
      continue;
    }

    const summary = buildResultSummary(result);
    const expected = statusTextFromX0(analysis.status);

    assertAudit(
      summary.statusText === expected,
      'Two-Phase sync',
      example.title,
      `Summary status should match analyzeTwoPhaseX0. Expected ${expected}, got ${summary.statusText}.`,
    );

    if (analysis.status === 'optimal') {
      assertAudit(
        summary.solutionText !== 'Không có nghiệm khả thi' && summary.optimalValueText.includes('z ='),
        'Two-Phase sync',
        example.title,
        `Optimal summary should show solution/value. Got "${summary.solutionText}" and "${summary.optimalValueText}".`,
      );
    }
  }
}

function containsInfiniteOptimumText(text: string): boolean {
  return text.toLowerCase().includes('vô số nghiệm');
}

function looksLikeSingleSolutionOnly(text: string): boolean {
  return /^x\d+\s*=/.test(text.trim());
}

function checkResultSummaryConsistency(): void {
  for (const example of lpExamples) {
    const methods: SolveMethod[] = example.method === 'geometric'
      ? ['geometric']
      : ['simplex', 'bland', 'two-phase'];

    for (const method of methods) {
      const result = method === 'geometric'
        ? solveLP(example.input, 'geometric')
        : solveLP(example.input, method);

      const summary = buildResultSummary(result);
      const label = `${example.title} / ${method}`;

      if (summary.conclusion.toLowerCase().includes('vô số nghiệm')) {
        assertAudit(
          containsInfiniteOptimumText(summary.solutionText),
          'Summary consistency',
          label,
          `Conclusion says alternate optimum, solutionText must also say alternate optimum. solutionText="${summary.solutionText}".`,
        );

        assertAudit(
          !looksLikeSingleSolutionOnly(summary.solutionText),
          'Summary consistency',
          label,
          `Alternate optimum must not be displayed as a single plain vector only. solutionText="${summary.solutionText}".`,
        );
      }

      if (result.hasAlternateOptimum) {
        assertAudit(
          containsInfiniteOptimumText(summary.solutionText),
          'Summary consistency',
          label,
          `result.hasAlternateOptimum is true, solutionText should contain "Vô số nghiệm". Got "${summary.solutionText}".`,
        );
      }

      if (method === 'two-phase') {
        const analysis = analyzeTwoPhaseX0(result.standard);
        if (analysis.status === 'optimal' && analysis.hasAlternateOptimum) {
          assertAudit(
            containsInfiniteOptimumText(summary.solutionText),
            'Summary consistency',
            label,
            `Two-Phase analysis.hasAlternateOptimum is true, solutionText should contain "Vô số nghiệm". Got "${summary.solutionText}".`,
          );
        }
      }

      if (result.status === 'infeasible') {
        assertAudit(
          summary.solutionText === 'Không có nghiệm khả thi',
          'Summary consistency',
          label,
          `Infeasible result must show no feasible solution. Got "${summary.solutionText}".`,
        );
      }

      if (result.status === 'unbounded') {
        assertAudit(
          summary.solutionText === 'Không có nghiệm tối ưu hữu hạn',
          'Summary consistency',
          label,
          `Unbounded result must show no finite optimum. Got "${summary.solutionText}".`,
        );
      }
    }
  }
}

function checkStandardToPhaseOneConsistency(): void {
  for (const example of lpExamples) {
    const result = solveLP(example.input, 'two-phase');
    const analysis = analyzeTwoPhaseX0(result.standard);

    if (!analysis.hasNegativeRhs || !analysis.phaseOneInitial) continue;

    const standardNames = result.standard.mappings.map((mapping) => mapping.label);
    const nonBasic = new Set(analysis.phaseOneInitial.nonBasic);
    const missing = standardNames.filter((name) => !nonBasic.has(name));

    assertAudit(
      missing.length === 0,
      'Two-Phase standard consistency',
      example.title,
      missing.length === 0
        ? 'Phase 1 uses all variables from standard form.'
        : `Phase 1 is missing standard variables: ${missing.join(', ')}.`,
    );
  }
}

function checkAlternateOptimumPostCheck(): void {
  for (const example of lpExamples) {
    const result = solveLP(example.input, 'two-phase');
    const analysis = analyzeTwoPhaseX0(result.standard);

    if (analysis.status !== 'optimal' || !analysis.phaseTwoFinal) continue;

    const zeroCandidates = analysis.phaseTwoFinal.nonBasic.filter((name) => Math.abs(analysis.phaseTwoFinal?.objectiveCoeffs[name] ?? 0) <= 1e-7);
    const dependentCandidates = zeroCandidates.filter((name) => analysis.phaseTwoFinal?.rows.some((row) => Math.abs(row.coeffs[name] ?? 0) > 1e-7));

    if (dependentCandidates.length > 0 && !analysis.hasAlternateOptimum) {
      log(
        'WARN',
        'Two-Phase alternate optimum',
        example.title,
        `Final dictionary has zero-cost dependent nonbasic variables (${dependentCandidates.join(', ')}), but no alternate original solution was detected. This may be degeneracy or same original solution after mappings.`,
      );
    } else {
      log(
        'PASS',
        'Two-Phase alternate optimum',
        example.title,
        analysis.hasAlternateOptimum
          ? `Alternate optimum detected using ${analysis.alternateEntering ?? 'unknown variable'}.`
          : 'No alternate optimum detected from final dictionary post-check.',
      );
    }
  }
}

function checkTwoPhaseX0LeavingPriority(): void {
  const model: StandardModel = {
    c: [-1, 0],
    constraints: [
      { a: [-1, 0], sign: '<=', b: -1, label: 'R1' },
      { a: [-2, 0], sign: '<=', b: -2, label: 'R2' },
      { a: [1, 0], sign: '<=', b: 4, label: 'R3' },
    ],
    mappings: [
      { originalIndex: 0, kind: 'same', label: 'x1' },
      { originalIndex: 1, kind: 'same', label: 'x2' },
    ],
    original: {
      optimization: 'min',
      n: 2,
      m: 3,
      c: [-1, 0],
      A: [
        [-1, 0],
        [-2, 0],
        [1, 0],
      ],
      signs: ['<=', '<=', '<='],
      b: [-1, -2, 4],
      variableTypes: ['nonnegative', 'nonnegative'],
    },
    latex: '',
  };

  const analysis = analyzeTwoPhaseX0(model);
  const phaseOneOptimizationPivot = analysis.phaseOnePivotSteps?.find((step) => step.phase === 'Phase 1' && step.entering !== 'x0');

  assertAudit(
    phaseOneOptimizationPivot?.leaving === 'x0',
    'Two-Phase x0 priority',
    'Minimum-ratio tie with x0 in Phase 1',
    `When x0 ties in the minimum-ratio test, x0 should leave. Got leaving=${phaseOneOptimizationPivot?.leaving ?? 'none'}.`,
  );
}


function checkGeometricCrossValidation(): void {
  for (const example of lpExamples) {
    if (example.input.n !== 2) continue;

    const geom = solveGeometric(example.input);
    if (!geom.supported) continue;

    const methods: SolveMethod[] = ['simplex', 'bland', 'two-phase'];

    for (const method of methods) {
      const result = solveByMethod(example.input, method);
      if (!result) continue;

      if (geom.status === 'optimal' && result.status === 'optimal' && geom.optimalPoint && result.optimalValue != null) {
        assertAudit(
          approx(geom.optimalPoint.value, result.optimalValue, 1e-6),
          'Cross validation / geometric',
          `${example.title} / ${method}`,
          `Geometric value ${geom.optimalPoint.value}, ${method} value ${result.optimalValue}.`,
        );
      }

      if (geom.status === 'infeasible') {
        assertAudit(
          result.status === 'infeasible' || result.status === 'error',
          'Cross validation / geometric',
          `${example.title} / ${method}`,
          `Geometric infeasible, ${method} got ${result.status}.`,
        );
      }

      if (geom.status === 'unbounded') {
        assertAudit(
          result.status === 'unbounded' || result.status === 'error',
          'Cross validation / geometric',
          `${example.title} / ${method}`,
          `Geometric unbounded, ${method} got ${result.status}.`,
        );
      }
    }
  }
}

function checkGeometryOptimalLineRobustness(): void {
  const freeStrip: LPInput = {
    optimization: 'max',
    n: 2,
    m: 2,
    c: [2, -4],
    A: [
      [1, -2],
      [-1, 2],
    ],
    signs: ['<=', '<='],
    b: [5, 3],
    variableTypes: ['free', 'free'],
  };

  const geom = solveGeometric(freeStrip);
  const summary = buildResultSummary(solveLP(freeStrip, 'geometric'));

  assertAudit(
    geom.status === 'optimal' &&
      geom.optimalLine != null &&
      geom.optimalPoint == null &&
      approx(geom.optimalLine.value, 10, 1e-6),
    'Geometry robustness',
    'Miền khả thi không có đỉnh hữu hạn',
    `Expected optimalLine with max z = 10 and no fake optimalPoint, got status=${geom.status}, optimalPoint=${geom.optimalPoint ? 'present' : 'null'}, value=${geom.optimalLine?.value ?? 'null'}.`,
  );

  assertAudit(
    summary.solutionText.includes('Vô số nghiệm tối ưu trên đường') &&
      !summary.solutionText.includes('x1 = 0, x2 = 0') &&
      summary.optimalValueText === 'max z = 10',
    'Geometry robustness',
    'Summary cho nghiệm tối ưu dạng đường',
    `Expected line-optimum summary without fake witness. solutionText="${summary.solutionText}", optimalValueText="${summary.optimalValueText}".`,
  );
}


function checkGeometryOptimalRayRobustness(): void {
  const optimalRayCase: LPInput = {
    optimization: 'max',
    n: 2,
    m: 3,
    c: [3, 3],
    A: [
      [1, 1],
      [-1, -1],
      [1, -1],
    ],
    signs: ['<=', '<=', '<='],
    b: [4, -2, 2],
    variableTypes: ['free', 'free'],
  };

  const geom = solveGeometric(optimalRayCase);
  const summary = buildResultSummary(solveLP(optimalRayCase, 'geometric'));

  assertAudit(
    geom.status === 'optimal' && geom.optimalRay != null && approx(geom.optimalRay.value, 12, 1e-6),
    'Geometry robustness',
    'Nghiệm tối ưu dạng tia',
    `Expected optimalRay with max z = 12, got status=${geom.status}, value=${geom.optimalRay?.value ?? 'null'}.`,
  );

  assertAudit(
    summary.solutionText.includes('Vô số nghiệm tối ưu trên tia') &&
      summary.optimalValueText === 'max z = 12' &&
      !summary.conclusion.includes('duy nhất'),
    'Geometry robustness',
    'Summary cho nghiệm tối ưu dạng tia',
    `Expected ray-optimum summary. solutionText="${summary.solutionText}", optimalValueText="${summary.optimalValueText}", conclusion="${summary.conclusion}".`,
  );
}

function printReport(): void {
  const grouped = new Map<string, AuditItem[]>();
  for (const item of items) {
    const group = grouped.get(item.group) ?? [];
    group.push(item);
    grouped.set(item.group, group);
  }

  console.log('\n=== LP Solver Audit Regression Report ===\n');

  for (const [group, groupItems] of grouped.entries()) {
    console.log(`## ${group}`);
    for (const item of groupItems) {
      const icon = item.level === 'PASS' ? '✓' : item.level === 'WARN' ? '⚠' : '✗';
      console.log(`${icon} [${item.level}] ${item.name}: ${item.detail}`);
    }
    console.log('');
  }

  const fails = items.filter((item) => item.level === 'FAIL');
  const warns = items.filter((item) => item.level === 'WARN');

  console.log(`Summary: ${items.length} checks, ${fails.length} failed, ${warns.length} warnings.`);

  if (fails.length > 0) {
    throw new Error('Audit regression failed. Fix FAIL items before continuing UI/features.');
  }
}

checkExamples();
checkTwoPhaseSummarySync();
checkResultSummaryConsistency();
checkStandardToPhaseOneConsistency();
checkAlternateOptimumPostCheck();
checkTwoPhaseX0LeavingPriority();
checkGeometricCrossValidation();
checkGeometryOptimalLineRobustness();
checkGeometryOptimalRayRobustness();
printReport();
