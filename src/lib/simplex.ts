import type { ConstraintRow, SimplexResult, SolveMethod, StandardModel, TableauStep } from './types';
import { cleanNumber, cloneMatrix, EPS, nearlyZero } from './format';
import { recoverOriginalSolution, standardize } from './standardize';
import { solveGeometric } from './geometry';

interface TableauState {
  tableau: number[][];
  basis: number[];
  variableNames: string[];
  originalVariableCount: number;
  artificial: Set<number>;
}

function objectiveValue(tableau: number[][]): number {
  return cleanNumber(-tableau[0][tableau[0].length - 1]);
}

function canonicalizeObjective(tableau: number[][], basis: number[], costs: number[]): void {
  const rhs = tableau[0].length - 1;
  for (let j = 0; j < rhs; j += 1) tableau[0][j] = costs[j] ?? 0;
  tableau[0][rhs] = 0;

  basis.forEach((basicVar, i) => {
    const cost = costs[basicVar] ?? 0;
    if (nearlyZero(cost)) return;
    for (let j = 0; j <= rhs; j += 1) tableau[0][j] -= cost * tableau[i + 1][j];
  });
}

function findEntering(tableau: number[][], bland: boolean, allowedColumns?: Set<number>): number | null {
  const rhs = tableau[0].length - 1;
  if (bland) {
    for (let j = 0; j < rhs; j += 1) {
      if ((allowedColumns == null || allowedColumns.has(j)) && tableau[0][j] < -EPS) return j;
    }
    return null;
  }

  let col: number | null = null;
  let best = -EPS;
  for (let j = 0; j < rhs; j += 1) {
    if (allowedColumns != null && !allowedColumns.has(j)) continue;
    if (tableau[0][j] < best) {
      best = tableau[0][j];
      col = j;
    }
  }
  return col;
}

function ratioTest(tableau: number[][], basis: number[], col: number, bland: boolean) {
  const rhs = tableau[0].length - 1;
  const ratios = basis.map((basic, i) => {
    const row = i + 1;
    const a = tableau[row][col];
    return { row, basis: basic, value: a > EPS ? tableau[row][rhs] / a : null };
  });
  const valid = ratios.filter((r) => r.value != null) as Array<{ row: number; basis: number; value: number }>;
  if (valid.length === 0) return { leaving: null, ratios };

  const minValue = Math.min(...valid.map((r) => r.value));
  const tied = valid.filter((r) => Math.abs(r.value - minValue) < EPS);
  const chosen = bland ? tied.sort((a, b) => a.basis - b.basis)[0] : tied[0];
  return { leaving: chosen.row, ratios };
}

function pivot(tableau: number[][], basis: number[], row: number, col: number): void {
  const rhs = tableau[0].length - 1;
  const pivotValue = tableau[row][col];

  for (let j = 0; j <= rhs; j += 1) {
    tableau[row][j] = cleanNumber(tableau[row][j] / pivotValue);
  }

  for (let i = 0; i < tableau.length; i += 1) {
    if (i === row) continue;
    const factor = tableau[i][col];
    if (nearlyZero(factor)) continue;

    for (let j = 0; j <= rhs; j += 1) {
      tableau[i][j] = cleanNumber(tableau[i][j] - factor * tableau[row][j]);
    }
  }

  basis[row - 1] = col;
}

function snapshot(
  phase: TableauStep['phase'],
  iteration: number,
  state: TableauState,
  entering: number | null,
  leavingRow: number | null,
  leavingVariable: number | null,
  pivotValue: number | null,
  reducedCost: number | null,
  ratios: TableauStep['ratioTest'],
  note?: string,
): TableauStep {
  return {
    phase,
    iteration,
    entering,
    leavingRow,
    leavingVariable,
    pivot: entering == null || leavingRow == null || pivotValue == null ? null : { row: leavingRow, col: entering, value: cleanNumber(pivotValue) },
    reducedCost: reducedCost == null ? null : cleanNumber(reducedCost),
    ratioTest: ratios.map((r) => ({ ...r, value: r.value == null ? null : cleanNumber(r.value) })),
    basis: [...state.basis],
    tableau: cloneMatrix(state.tableau).map((row) => row.map(cleanNumber)),
    objectiveValue: objectiveValue(state.tableau),
    variableNames: [...state.variableNames],
    note,
  };
}

function runSimplexLoop(
  state: TableauState,
  phase: TableauStep['phase'],
  steps: TableauStep[],
  bland: boolean,
  allowedColumns?: Set<number>,
): 'optimal' | 'unbounded' | 'iteration-limit' {
  steps.push(snapshot(phase, 0, state, null, null, null, null, null, [], 'Tableau ban đầu'));

  for (let iter = 1; iter <= 200; iter += 1) {
    const entering = findEntering(state.tableau, bland, allowedColumns);
    if (entering == null) {
      steps.push(snapshot(phase, iter, state, null, null, null, null, null, [], 'Không còn reduced cost âm → đạt tối ưu.'));
      return 'optimal';
    }

    const { leaving, ratios } = ratioTest(state.tableau, state.basis, entering, bland);
    if (leaving == null) {
      steps.push(snapshot(phase, iter, state, entering, null, null, null, state.tableau[0][entering], ratios, 'Không có tỉ số hợp lệ → bài toán không bị chặn.'));
      return 'unbounded';
    }

    const reducedCostBefore = state.tableau[0][entering];
    const pv = state.tableau[leaving][entering];
    const leavingBefore = state.basis[leaving - 1];
    const enteringName = state.variableNames[entering] ?? `x${entering + 1}`;
    const leavingName = state.variableNames[leavingBefore] ?? `x${leavingBefore + 1}`;

    // Store the tableau BEFORE pivoting so the UI can highlight the exact
    // intersection of the entering column and the leaving row, matching the
    // textbook/Excel-style tableau.
    steps.push(snapshot(phase, iter, state, entering, leaving, leavingBefore, pv, reducedCostBefore, ratios, `Pivot: ${enteringName} vào, ${leavingName} ra.`));

    pivot(state.tableau, state.basis, leaving, entering);
  }
  return 'iteration-limit';
}

function buildDirectTableau(model: StandardModel): TableauState | null {
  if (model.constraints.some((r) => r.sign !== '<=' || r.b < -EPS)) return null;
  const n = model.c.length;
  const m = model.constraints.length;
  const total = n + m;
  const tableau = Array.from({ length: m + 1 }, () => Array.from({ length: total + 1 }, () => 0));
  const basis: number[] = [];
  const variableNames = [...model.mappings.map((m) => m.label)];

  for (let i = 0; i < m; i += 1) {
    const r = model.constraints[i];
    r.a.forEach((v, j) => (tableau[i + 1][j] = v));
    tableau[i + 1][n + i] = 1;
    tableau[i + 1][total] = r.b;
    basis.push(n + i);
    variableNames.push(`s${i + 1}`);
  }
  canonicalizeObjective(tableau, basis, [...model.c, ...Array.from({ length: m }, () => 0)]);
  return { tableau, basis, variableNames, originalVariableCount: n, artificial: new Set() };
}

function buildPhaseOneTableau(model: StandardModel): TableauState {
  const n = model.c.length;
  const variableNames = [...model.mappings.map((m) => m.label)];
  const basis: number[] = [];
  const artificial = new Set<number>();
  const rows: number[][] = [];
  let varCount = n;

  model.constraints.forEach((r, i) => {
    if (r.sign !== '<=') {
      throw new Error('Model must be in standard form Ax <= b before Phase 1.');
    }

    const row = Array.from({ length: varCount }, (_, j) => r.a[j] ?? 0);
    const extendPreviousRows = () => rows.forEach((old) => old.splice(old.length - 1, 0, 0));

    if (r.b >= -EPS) {
      // a x + w = b, w là biến cơ sở xuất phát khả thi khi b >= 0.
      extendPreviousRows();
      row.push(1);
      variableNames.push(`s${i + 1}`);
      basis.push(varCount);
      varCount += 1;
      row.push(Math.max(0, r.b));
      rows.push(row);
    } else {
      // a x + w = b với b < 0 không khả thi.
      // Nhân dòng với -1: -a x - w = -b, thêm biến giả để có cơ sở Pha 1:
      // -a x - w + a_i = -b.
      for (let j = 0; j < n; j += 1) row[j] = -(r.a[j] ?? 0);

      extendPreviousRows();
      row.push(-1);
      variableNames.push(`s${i + 1}`);
      varCount += 1;

      extendPreviousRows();
      row.push(1);
      variableNames.push(`a${i + 1}`);
      artificial.add(varCount);
      basis.push(varCount);
      varCount += 1;

      row.push(-r.b);
      rows.push(row);
    }
  });

  const width = varCount + 1;
  rows.forEach((row) => {
    while (row.length < width) row.splice(row.length - 1, 0, 0);
  });
  const tableau = [Array.from({ length: width }, () => 0), ...rows];
  const phaseOneCosts = Array.from({ length: varCount }, (_, j) => (artificial.has(j) ? 1 : 0));
  canonicalizeObjective(tableau, basis, phaseOneCosts);
  return { tableau, basis, variableNames, originalVariableCount: n, artificial };
}

function removeArtificialAndSetPhaseTwo(state: TableauState, costs: number[]): boolean {
  const rhs = state.tableau[0].length - 1;
  const rowsToRemove = new Set<number>();

  for (let i = 0; i < state.basis.length; i += 1) {
    if (!state.artificial.has(state.basis[i])) continue;
    let pivotCol: number | null = null;
    for (let j = 0; j < rhs; j += 1) {
      if (!state.artificial.has(j) && Math.abs(state.tableau[i + 1][j]) > EPS) {
        pivotCol = j;
        break;
      }
    }
    if (pivotCol != null) {
      pivot(state.tableau, state.basis, i + 1, pivotCol);
    } else {
      // Dòng dư thừa: 0 * x = 0
      if (Math.abs(state.tableau[i + 1][rhs]) > EPS) return false;
      rowsToRemove.add(i + 1);
    }
  }

  if (rowsToRemove.size > 0) {
    state.tableau = state.tableau.filter((_, idx) => !rowsToRemove.has(idx));
    state.basis = state.basis.filter((_, idx) => !rowsToRemove.has(idx + 1));
  }

  const keep = Array.from({ length: rhs }, (_, i) => i).filter((j) => !state.artificial.has(j));
  const remap = new Map<number, number>();
  keep.forEach((old, idx) => remap.set(old, idx));

  state.tableau = state.tableau.map((row) => [...keep.map((j) => row[j]), row[rhs]]);
  state.variableNames = keep.map((j) => state.variableNames[j]);
  state.basis = state.basis.map((old) => remap.get(old) ?? -1);
  state.artificial = new Set();
  canonicalizeObjective(state.tableau, state.basis, costs);
  return true;
}

function hasPositiveAlternateMove(tableau: number[][], col: number): boolean {
  const rhs = tableau[0].length - 1;
  let maxStep = Number.POSITIVE_INFINITY;
  let hasLimiter = false;

  for (let i = 1; i < tableau.length; i += 1) {
    const a = tableau[i][col];

    // Use the same sign convention as ratioTest: only a > EPS limits an
    // increase of the non-basic variable. Rows with a <= EPS do not block a
    // positive move in this tableau convention.
    if (a > EPS) {
      hasLimiter = true;
      maxStep = Math.min(maxStep, tableau[i][rhs] / a);
    }
  }

  // No limiting row means the zero-reduced-cost direction can move positively
  // without changing the objective value.
  if (!hasLimiter) return true;

  // In a degenerate optimum, every limiting ratio may be 0. Then the tableau
  // has a zero reduced cost, but it does not produce a distinct feasible
  // optimum by increasing this variable.
  return maxStep > EPS;
}

function hasAlternateOptimum(tableau: number[][], basis: number[], originalCount: number): boolean {
  const basic = new Set(basis);

  for (let j = 0; j < originalCount; j += 1) {
    if (basic.has(j)) continue;
    if (!nearlyZero(tableau[0][j])) continue;
    if (hasPositiveAlternateMove(tableau, j)) return true;
  }

  return false;
}

function collectSolution(state: TableauState): number[] {
  const rhs = state.tableau[0].length - 1;
  const sol = Array.from({ length: state.originalVariableCount }, () => 0);
  state.basis.forEach((basic, i) => {
    if (basic >= 0 && basic < state.originalVariableCount) sol[basic] = state.tableau[i + 1][rhs];
  });
  return sol.map(cleanNumber);
}

function validateOriginalFeasibility(input: import('./types').LPInput, solution: number[]): { ok: boolean; reason: string } {
  for (let j = 0; j < input.n; j += 1) {
    const value = solution[j] ?? 0;
    const type = input.variableTypes[j];

    if (!Number.isFinite(value)) {
      return { ok: false, reason: `Biến x${j + 1} có giá trị không hợp lệ.` };
    }

    if (type === 'nonnegative' && value < -EPS) {
      return { ok: false, reason: `Biến x${j + 1} = ${cleanNumber(value)} vi phạm điều kiện x${j + 1} ≥ 0.` };
    }

    if (type === 'nonpositive' && value > EPS) {
      return { ok: false, reason: `Biến x${j + 1} = ${cleanNumber(value)} vi phạm điều kiện x${j + 1} ≤ 0.` };
    }
  }

  for (let i = 0; i < input.m; i += 1) {
    const lhs = input.A[i].reduce((sum, coef, j) => sum + coef * (solution[j] ?? 0), 0);
    const rhs = input.b[i] ?? 0;
    const sign = input.signs[i];

    if (sign === '<=' && lhs > rhs + EPS) {
      return {
        ok: false,
        reason: `Ràng buộc R${i + 1} bị vi phạm: LHS = ${cleanNumber(lhs)} > RHS = ${cleanNumber(rhs)}.`,
      };
    }

    if (sign === '>=' && lhs < rhs - EPS) {
      return {
        ok: false,
        reason: `Ràng buộc R${i + 1} bị vi phạm: LHS = ${cleanNumber(lhs)} < RHS = ${cleanNumber(rhs)}.`,
      };
    }

    if (sign === '=' && Math.abs(lhs - rhs) > EPS) {
      return {
        ok: false,
        reason: `Ràng buộc R${i + 1} bị vi phạm: LHS = ${cleanNumber(lhs)} khác RHS = ${cleanNumber(rhs)}.`,
      };
    }
  }

  return { ok: true, reason: 'Nghiệm thỏa bài toán gốc.' };
}

export function solveLP(input: import('./types').LPInput, method: SolveMethod): SimplexResult {
  const standard = standardize(input);
  const steps: TableauStep[] = [];
  const bland = method === 'bland';
  const variableNames = standard.mappings.map((m) => m.label);

  if (method === 'geometric') {
    const geom = solveGeometric(input);
    if (geom.supported && geom.optimalPoint) {
      return {
        status: geom.status,
        method,
        standard,
        variableNames: ['x1', 'x2'],
        basisNames: [],
        steps,
        solutionStandard: [geom.optimalPoint.x, geom.optimalPoint.y],
        solutionOriginal: [geom.optimalPoint.x, geom.optimalPoint.y],
        optimalValue: geom.optimalPoint.value,
        isDegenerate: false,
        hasAlternateOptimum: Boolean(geom.optimalSegment),
        diagnostics: { isDegenerate: false, hasAlternateOptimum: Boolean(geom.optimalSegment), isCyclingRisk: false },
        message: geom.message,
      };
    } else {
      return {
        status: geom.status,
        method,
        standard,
        variableNames: ['x1', 'x2'],
        basisNames: [],
        steps,
        solutionStandard: [],
        solutionOriginal: [],
        optimalValue: null,
        isDegenerate: false,
        hasAlternateOptimum: false,
        diagnostics: { isDegenerate: false, hasAlternateOptimum: false, isCyclingRisk: false },
        message: geom.message,
      };
    }
  }

  let state: TableauState | null = null;
  let loopStatus: 'optimal' | 'unbounded' | 'iteration-limit' = 'optimal';

  const hasNegativeRhs = standard.constraints.some((r) => r.b < -EPS);

  if (method === 'simplex' || method === 'bland') {
    // Simplex và Bland giải trực tiếp trên dạng chuẩn min c^T x, Ax <= b, x >= 0
    // khi từ vựng xuất phát khả thi, tức b_i >= 0. Không tự động chạy 2 pha.
    if (hasNegativeRhs) {
      const emptyState: TableauState = {
        tableau: [[0]],
        basis: [],
        variableNames,
        originalVariableCount: variableNames.length,
        artificial: new Set(),
      };

      return baseResult(
        input,
        method,
        standard,
        emptyState,
        steps,
        'error',
        'Sau khi đưa về dạng chuẩn còn tồn tại b_i < 0, nên Simplex/Bland không có từ vựng xuất phát khả thi. Hãy dùng phương pháp 2 pha.',
      );
    }

    state = buildDirectTableau(standard);
    if (state == null) {
      const emptyState: TableauState = {
        tableau: [[0]],
        basis: [],
        variableNames,
        originalVariableCount: variableNames.length,
        artificial: new Set(),
      };

      return baseResult(
        input,
        method,
        standard,
        emptyState,
        steps,
        'error',
        'Dạng chuẩn chưa phải Ax <= b nên không thể giải trực tiếp bằng Simplex/Bland.',
      );
    }

    loopStatus = runSimplexLoop(state, bland ? 'Bland' : 'Simplex', steps, bland);
  } else {
    // Two-Phase chỉ thật sự cần khi có b_i < 0. Nếu b_i >= 0 hết,
    // bài toán đã có từ vựng xuất phát khả thi và có thể giải trực tiếp.
    if (!hasNegativeRhs) {
      state = buildDirectTableau(standard);
      if (state == null) {
        const emptyState: TableauState = {
          tableau: [[0]],
          basis: [],
          variableNames,
          originalVariableCount: variableNames.length,
          artificial: new Set(),
        };
        return baseResult(input, method, standard, emptyState, steps, 'error', 'Dạng chuẩn chưa phải Ax <= b.');
      }
      loopStatus = runSimplexLoop(state, 'Phase 2', steps, true);
    } else {
      state = buildPhaseOneTableau(standard);
      loopStatus = runSimplexLoop(state, 'Phase 1', steps, true);
      if (loopStatus !== 'optimal') {
        return baseResult(input, method, standard, state, steps, 'infeasible', 'Pha 1 không kết thúc tối ưu.');
      }
      if (objectiveValue(state.tableau) > EPS) {
        return baseResult(input, method, standard, state, steps, 'infeasible', 'Pha 1 có giá trị tối ưu > 0, bài toán vô nghiệm.');
      }
      const phase2Costs = [...standard.c, ...Array.from({ length: state.tableau[0].length - 1 - standard.c.length }, () => 0)];
      if (!removeArtificialAndSetPhaseTwo(state, phase2Costs)) {
        return baseResult(input, method, standard, state, steps, 'infeasible', 'Không loại được biến giả khỏi cơ sở.');
      }
      loopStatus = runSimplexLoop(state, 'Phase 2', steps, true);
    }
  }

  if (loopStatus === 'unbounded') return baseResult(input, method, standard, state, steps, 'unbounded', 'Bài toán không bị chặn.');
  if (loopStatus === 'iteration-limit') return baseResult(input, method, standard, state, steps, 'iteration-limit', 'Vượt quá giới hạn số bước lặp.');

  const solStd = collectSolution(state);
  const solOriginal = recoverOriginalSolution(solStd, standard);
  const feasibility = validateOriginalFeasibility(input, solOriginal);

  if (!feasibility.ok) {
    return baseResult(
      input,
      method,
      standard,
      state,
      steps,
      'infeasible',
      `Nghiệm thu được từ tableau không thỏa bài toán gốc. ${feasibility.reason} Do đó không kết luận tối ưu.`,
    );
  }

  const minValue = objectiveValue(state.tableau);
  const originalValue = input.optimization === 'max' ? -minValue : minValue;
  const degenerate = state.tableau.slice(1).some((row) => nearlyZero(row[row.length - 1]));
  const alternate = hasAlternateOptimum(state.tableau, state.basis, state.originalVariableCount);
  return {
    status: 'optimal',
    method,
    standard,
    variableNames: state.variableNames,
    basisNames: state.basis.map((i) => state.variableNames[i] ?? `x${i + 1}`),
    steps,
    solutionStandard: solStd,
    solutionOriginal: solOriginal,
    optimalValue: cleanNumber(originalValue),
    isDegenerate: degenerate,
    hasAlternateOptimum: alternate,
    diagnostics: { isDegenerate: degenerate, hasAlternateOptimum: alternate, isCyclingRisk: method !== 'bland' && method !== 'two-phase' && degenerate },
    message: alternate ? 'Tối ưu và có dấu hiệu đa nghiệm.' : degenerate ? 'Tối ưu nhưng có suy biến.' : 'Đã tìm được nghiệm tối ưu.',
  };
}

function baseResult(
  input: import('./types').LPInput,
  method: SolveMethod,
  standard: StandardModel,
  state: TableauState,
  steps: TableauStep[],
  status: SimplexResult['status'],
  message: string,
): SimplexResult {
  return {
    status,
    method,
    standard,
    variableNames: state.variableNames,
    basisNames: state.basis.map((i) => state.variableNames[i] ?? `x${i + 1}`),
    steps,
    solutionStandard: [],
    solutionOriginal: [],
    optimalValue: null,
    isDegenerate: false,
    hasAlternateOptimum: false,
    diagnostics: { isDegenerate: false, hasAlternateOptimum: false, isCyclingRisk: false },
    message,
  };
}
