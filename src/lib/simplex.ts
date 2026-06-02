import type { ConstraintRow, SimplexResult, SolveMethod, StandardModel, TableauStep } from './types';
import { cleanNumber, cloneMatrix, EPS, nearlyZero } from './format';
import { recoverOriginalSolution, standardize } from './standardize';
import { solveGeometric } from './geometry';
import { analyzeTwoPhaseX0 } from './twoPhaseX0';

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
  for (let j = 0; j <= rhs; j += 1) tableau[row][j] /= pivotValue;

  for (let i = 0; i < tableau.length; i += 1) {
    if (i === row) continue;
    const factor = tableau[i][col];
    if (nearlyZero(factor)) continue;
    for (let j = 0; j <= rhs; j += 1) tableau[i][j] -= factor * tableau[row][j];
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

    // Lưu snapshot TRƯỚC khi pivot để UI tô đỏ đúng ô pivot trên bảng hiện tại.
    // Thuật toán không đổi: sau khi lưu bảng để hiển thị, ta vẫn pivot như cũ.
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
    const row = Array.from({ length: varCount }, (_, j) => r.a[j] ?? 0);
    const extendPreviousRows = () => rows.forEach((old) => old.splice(old.length - 1, 0, 0));

    if (r.sign === '<=') {
      extendPreviousRows();
      row.push(1);
      variableNames.push(`s${i + 1}`);
      basis.push(varCount);
      varCount += 1;
    } else if (r.sign === '>=') {
      extendPreviousRows();
      row.push(-1);
      variableNames.push(`e${i + 1}`);
      varCount += 1;
      extendPreviousRows();
      row.push(1);
      variableNames.push(`a${i + 1}`);
      artificial.add(varCount);
      basis.push(varCount);
      varCount += 1;
    } else {
      extendPreviousRows();
      row.push(1);
      variableNames.push(`a${i + 1}`);
      artificial.add(varCount);
      basis.push(varCount);
      varCount += 1;
    }
    row.push(r.b);
    rows.push(row);
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

function hasAlternateOptimum(tableau: number[][], basis: number[], originalCount: number): boolean {
  const basic = new Set(basis);
  const rhs = tableau[0].length - 1;

  for (let j = 0; j < originalCount; j += 1) {
    if (basic.has(j) || !nearlyZero(tableau[0][j])) continue;

    // Reduced cost = 0 chỉ là dấu hiệu nghi ngờ có đa nghiệm.
    // Nếu mọi bước di chuyển khả dĩ đều bằng 0, đó chỉ là pivot suy biến,
    // không tạo ra nghiệm tối ưu khác.
    let minRatio = Infinity;
    let hasLeavingCandidate = false;

    for (let i = 1; i < tableau.length; i += 1) {
      const col = tableau[i][j];
      if (col <= EPS) continue;

      hasLeavingCandidate = true;
      const ratio = tableau[i][rhs] / col;
      if (ratio >= -EPS) minRatio = Math.min(minRatio, ratio);
    }

    // Reduced cost = 0 và không có hàng chặn nghĩa là có tia tối ưu.
    if (!hasLeavingCandidate) return true;

    // Chỉ kết luận đa nghiệm nếu có thể tăng biến ngoài cơ sở một lượng dương.
    if (Number.isFinite(minRatio) && minRatio > EPS) return true;
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
        hasAlternateOptimum: false,
        message: geom.message,
      };
    } else {
      return {
        status: geom.status === 'infeasible' ? 'infeasible' : 'error',
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
        message: geom.message,
      };
    }
  }

  if (method === 'two-phase') {
    const phaseOneX0 = analyzeTwoPhaseX0(standard);

    if (phaseOneX0.status === 'infeasible') {
      return {
        status: 'infeasible',
        method,
        standard,
        variableNames,
        basisNames: [],
        steps,
        solutionStandard: [],
        solutionOriginal: [],
        optimalValue: null,
        isDegenerate: false,
        hasAlternateOptimum: false,
        message: phaseOneX0.reason,
      };
    }

    if (phaseOneX0.status === 'unbounded') {
      return {
        status: 'unbounded',
        method,
        standard,
        variableNames,
        basisNames: [],
        steps,
        solutionStandard: [],
        solutionOriginal: [],
        optimalValue: null,
        isDegenerate: false,
        hasAlternateOptimum: false,
        message: phaseOneX0.reason,
      };
    }

    if (phaseOneX0.status === 'optimal') {
      return {
        status: 'optimal',
        method,
        standard,
        variableNames,
        basisNames: [],
        steps,
        solutionStandard: phaseOneX0.solutionStandard,
        solutionOriginal: phaseOneX0.solutionOriginal,
        optimalValue: phaseOneX0.optimalValue,
        isDegenerate: false,
        hasAlternateOptimum: false,
        message: phaseOneX0.reason,
      };
    }
  }

  let state: TableauState | null = null;
  let loopStatus: 'optimal' | 'unbounded' | 'iteration-limit' = 'optimal';

  if (method === 'simplex' || method === 'bland') {
    state = buildDirectTableau(standard);
    if (state == null) {
      state = buildPhaseOneTableau(standard);
      loopStatus = runSimplexLoop(state, 'Phase 1', steps, bland);
      if (loopStatus !== 'optimal') {
        return baseResult(input, method, standard, state, steps, loopStatus === 'unbounded' ? 'infeasible' : 'error', 'Không tìm được phương án cơ sở ban đầu ở Pha 1.');
      }
      if (objectiveValue(state.tableau) > EPS) {
        return baseResult(input, method, standard, state, steps, 'infeasible', 'Pha 1 có giá trị tối ưu > 0, bài toán vô nghiệm.');
      }
      const phase2Costs = [...standard.c, ...Array.from({ length: state.tableau[0].length - 1 - standard.c.length }, () => 0)];
      if (!removeArtificialAndSetPhaseTwo(state, phase2Costs)) {
        return baseResult(input, method, standard, state, steps, 'infeasible', 'Không loại được biến giả khỏi cơ sở.');
      }
      loopStatus = runSimplexLoop(state, bland ? 'Bland' : 'Simplex', steps, bland);
    } else {
      loopStatus = runSimplexLoop(state, bland ? 'Bland' : 'Simplex', steps, bland);
    }
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

  if (loopStatus === 'unbounded') return baseResult(input, method, standard, state, steps, 'unbounded', 'Bài toán không bị chặn.');
  if (loopStatus === 'iteration-limit') return baseResult(input, method, standard, state, steps, 'error', 'Vượt quá giới hạn số bước lặp.');

  const solStd = collectSolution(state);
  const solOriginal = recoverOriginalSolution(solStd, standard);
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
    message: alternate ? 'Đã tìm được nghiệm tối ưu và có dấu hiệu đa nghiệm.' : 'Đã tìm được nghiệm tối ưu.',
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
    message,
  };
}
