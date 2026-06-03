import type { StandardModel } from './types';
import { cleanNumber } from './format';
import { recoverOriginalSolution } from './standardize';

const EPS = 1e-9;

export type TwoPhaseX0Row = {
  basis: string;
  rhs: number;
  coeffs: Record<string, number>;
};

export type TwoPhaseX0Dictionary = {
  objectiveName: 'delta' | 'z';
  objectiveRhs: number;
  objectiveCoeffs: Record<string, number>;
  rows: TwoPhaseX0Row[];
  nonBasic: string[];
};

export type TwoPhasePivotStep = {
  phase: 'Phase 1' | 'Phase 2';
  title: string;
  before: TwoPhaseX0Dictionary;
  after: TwoPhaseX0Dictionary;
  entering: string;
  leaving: string;
  leavingRow: number;
  pivotValue: number;
};

export type TwoPhaseX0Analysis = {
  hasNegativeRhs: boolean;
  canGoToPhaseTwo: boolean;
  phaseOneInfeasible: boolean;
  phaseTwoUnbounded: boolean;
  status: 'skip' | 'infeasible' | 'optimal' | 'unbounded';
  solutionStandard: number[];
  solutionOriginal: number[];
  optimalValue: number | null;
  reason: string;

  hasAlternateOptimum: boolean;
  alternateSolutionOriginal?: number[];
  alternateEntering?: string;

  standardVariableNames: string[];
  phaseOneInitial?: TwoPhaseX0Dictionary;
  phaseOneAfterInitialPivot?: TwoPhaseX0Dictionary;
  phaseOneFinal?: TwoPhaseX0Dictionary;
  phaseTwoStart?: TwoPhaseX0Dictionary;
  phaseTwoFinal?: TwoPhaseX0Dictionary;
  phaseOnePivotSteps: TwoPhasePivotStep[];
  phaseTwoPivotSteps: TwoPhasePivotStep[];
  x0Value?: number;
};

function standardVariableNames(model: StandardModel): string[] {
  return model.mappings.map((mapping) => mapping.label);
}

function slackName(index: number): string {
  return `w${index + 1}`;
}

function cloneDictionary(dict: TwoPhaseX0Dictionary): TwoPhaseX0Dictionary {
  return {
    objectiveName: dict.objectiveName,
    objectiveRhs: dict.objectiveRhs,
    objectiveCoeffs: { ...dict.objectiveCoeffs },
    rows: dict.rows.map((row) => ({
      basis: row.basis,
      rhs: row.rhs,
      coeffs: { ...row.coeffs },
    })),
    nonBasic: [...dict.nonBasic],
  };
}

function normalizeDict(dict: TwoPhaseX0Dictionary): void {
  dict.objectiveRhs = cleanNumber(dict.objectiveRhs);

  Object.keys(dict.objectiveCoeffs).forEach((key) => {
    dict.objectiveCoeffs[key] = cleanNumber(dict.objectiveCoeffs[key]);
    if (Math.abs(dict.objectiveCoeffs[key]) < EPS) dict.objectiveCoeffs[key] = 0;
  });

  dict.rows.forEach((row) => {
    row.rhs = cleanNumber(row.rhs);
    Object.keys(row.coeffs).forEach((key) => {
      row.coeffs[key] = cleanNumber(row.coeffs[key]);
      if (Math.abs(row.coeffs[key]) < EPS) row.coeffs[key] = 0;
    });
  });
}

function buildAuxiliaryDictionary(model: StandardModel): TwoPhaseX0Dictionary {
  const yNames = standardVariableNames(model);
  const nonBasic = [...yNames, 'x0'];

  const dict: TwoPhaseX0Dictionary = {
    objectiveName: 'delta',
    objectiveRhs: 0,
    objectiveCoeffs: Object.fromEntries(nonBasic.map((name) => [name, name === 'x0' ? 1 : 0])),
    rows: model.constraints.map((row, i) => {
      const coeffs: Record<string, number> = {};

      yNames.forEach((name, j) => {
        // Từ dạng chuẩn: a*y <= b.
        // Bài toán bổ trợ x0: a*y - x0 <= b.
        // Từ vựng: w = b - a*y + x0.
        coeffs[name] = -(row.a[j] ?? 0);
      });

      coeffs.x0 = 1;

      return {
        basis: slackName(i),
        rhs: row.b,
        coeffs,
      };
    }),
    nonBasic,
  };

  normalizeDict(dict);
  return dict;
}

function pivotDictionary(dict: TwoPhaseX0Dictionary, entering: string, rowIndex: number): void {
  const row = dict.rows[rowIndex];
  const leaving = row.basis;
  const pivotValue = row.coeffs[entering] ?? 0;

  if (Math.abs(pivotValue) < EPS) {
    throw new Error('Pivot value is zero.');
  }

  const oldNonBasic = [...dict.nonBasic];
  const newNonBasic = oldNonBasic.map((name) => (name === entering ? leaving : name));
  const oldRowCoeffs = { ...row.coeffs };
  const oldRhs = row.rhs;

  // Dictionary convention:
  // basis = rhs + sum(coeff[name] * nonbasic[name])
  // Solve the leaving row for entering.
  const enteringExpression: TwoPhaseX0Row = {
    basis: entering,
    rhs: -oldRhs / pivotValue,
    coeffs: {},
  };

  oldNonBasic.forEach((name) => {
    if (name === entering) return;
    enteringExpression.coeffs[name] = -(oldRowCoeffs[name] ?? 0) / pivotValue;
  });
  enteringExpression.coeffs[leaving] = 1 / pivotValue;

  const substitute = (rhs: number, coeffs: Record<string, number>) => {
    const factor = coeffs[entering] ?? 0;
    const nextCoeffs: Record<string, number> = {};

    newNonBasic.forEach((name) => {
      if (name === leaving) nextCoeffs[name] = 0;
      else nextCoeffs[name] = coeffs[name] ?? 0;
    });

    let nextRhs = rhs;

    if (Math.abs(factor) > EPS) {
      nextRhs += factor * enteringExpression.rhs;
      newNonBasic.forEach((name) => {
        nextCoeffs[name] = (nextCoeffs[name] ?? 0) + factor * (enteringExpression.coeffs[name] ?? 0);
      });
    }

    delete nextCoeffs[entering];
    return { rhs: nextRhs, coeffs: nextCoeffs };
  };

  dict.rows = dict.rows.map((current, i) => {
    if (i === rowIndex) {
      const coeffs: Record<string, number> = {};
      newNonBasic.forEach((name) => {
        coeffs[name] = enteringExpression.coeffs[name] ?? 0;
      });
      return { basis: entering, rhs: enteringExpression.rhs, coeffs };
    }

    const updated = substitute(current.rhs, current.coeffs);
    return { basis: current.basis, rhs: updated.rhs, coeffs: updated.coeffs };
  });

  const updatedObjective = substitute(dict.objectiveRhs, dict.objectiveCoeffs);
  dict.objectiveRhs = updatedObjective.rhs;
  dict.objectiveCoeffs = updatedObjective.coeffs;
  dict.nonBasic = newNonBasic;
  normalizeDict(dict);
}

function pivotWithStep(dict: TwoPhaseX0Dictionary, entering: string, rowIndex: number, phase: 'Phase 1' | 'Phase 2', title: string): TwoPhasePivotStep {
  const before = cloneDictionary(dict);
  const leaving = dict.rows[rowIndex].basis;
  const pivotValue = dict.rows[rowIndex].coeffs[entering] ?? 0;

  pivotDictionary(dict, entering, rowIndex);

  return {
    phase,
    title,
    before,
    after: cloneDictionary(dict),
    entering,
    leaving,
    leavingRow: rowIndex,
    pivotValue: cleanNumber(pivotValue),
  };
}

function chooseMostNegativeRhsRow(dict: TwoPhaseX0Dictionary): number | null {
  let rowIndex: number | null = null;
  let best = -EPS;

  dict.rows.forEach((row, i) => {
    if (row.rhs < best) {
      best = row.rhs;
      rowIndex = i;
    }
  });

  return rowIndex;
}

function chooseEnteringForMin(dict: TwoPhaseX0Dictionary): string | null {
  let entering: string | null = null;
  let best = -EPS;

  dict.nonBasic.forEach((name) => {
    const value = dict.objectiveCoeffs[name] ?? 0;
    if (value < best) {
      best = value;
      entering = name;
    }
  });

  return entering;
}

function chooseLeavingForEntering(dict: TwoPhaseX0Dictionary, entering: string): number | null {
  let rowIndex: number | null = null;
  let best = Number.POSITIVE_INFINITY;

  dict.rows.forEach((row, i) => {
    const coeff = row.coeffs[entering] ?? 0;
    if (coeff < -EPS) {
      const ratio = row.rhs / -coeff;
      if (ratio < best - EPS) {
        best = ratio;
        rowIndex = i;
      }
    }
  });

  return rowIndex;
}

function basicValue(dict: TwoPhaseX0Dictionary, variable: string): number {
  const row = dict.rows.find((item) => item.basis === variable);
  if (row) return cleanNumber(row.rhs);
  return 0;
}

function removeX0FromDictionary(dict: TwoPhaseX0Dictionary): TwoPhaseX0Dictionary {
  const out = cloneDictionary(dict);

  const basicX0Row = out.rows.findIndex((row) => row.basis === 'x0');

  if (basicX0Row >= 0) {
    const replacement = out.nonBasic.find((name) => name !== 'x0' && Math.abs(out.rows[basicX0Row].coeffs[name] ?? 0) > EPS);

    if (replacement) {
      pivotDictionary(out, replacement, basicX0Row);
    } else {
      // x0 = 0 and the row has no useful pivot candidate, so the row is redundant.
      out.rows.splice(basicX0Row, 1);
    }
  }

  out.nonBasic = out.nonBasic.filter((name) => name !== 'x0');
  out.rows.forEach((row) => delete row.coeffs.x0);
  delete out.objectiveCoeffs.x0;
  normalizeDict(out);

  return out;
}

function restoreOriginalObjective(model: StandardModel, phaseOneFinal: TwoPhaseX0Dictionary): TwoPhaseX0Dictionary {
  const dict = removeX0FromDictionary(phaseOneFinal);
  const yNames = standardVariableNames(model);

  dict.objectiveName = 'z';
  dict.objectiveRhs = 0;
  dict.objectiveCoeffs = Object.fromEntries(dict.nonBasic.map((name) => [name, 0]));

  yNames.forEach((name, index) => {
    // IMPORTANT: Pha 2 phải khôi phục hàm mục tiêu theo biến chuẩn,
    // nên dùng model.c, không dùng model.original.c.
    const cost = model.c[index] ?? 0;
    if (Math.abs(cost) < EPS) return;

    const basicRow = dict.rows.find((row) => row.basis === name);

    if (basicRow) {
      dict.objectiveRhs += cost * basicRow.rhs;
      dict.nonBasic.forEach((nonBasic) => {
        dict.objectiveCoeffs[nonBasic] = (dict.objectiveCoeffs[nonBasic] ?? 0) + cost * (basicRow.coeffs[nonBasic] ?? 0);
      });
    } else if (dict.nonBasic.includes(name)) {
      dict.objectiveCoeffs[name] = (dict.objectiveCoeffs[name] ?? 0) + cost;
    }
  });

  normalizeDict(dict);
  return dict;
}

function runDictionarySimplex(dict: TwoPhaseX0Dictionary, phase: 'Phase 1' | 'Phase 2'): { status: 'optimal' | 'unbounded'; finalDict: TwoPhaseX0Dictionary; pivotSteps: TwoPhasePivotStep[] } {
  const pivotSteps: TwoPhasePivotStep[] = [];

  for (let guard = 0; guard < 100; guard += 1) {
    const entering = chooseEnteringForMin(dict);
    if (!entering) return { status: 'optimal', finalDict: dict, pivotSteps };

    const leavingRow = chooseLeavingForEntering(dict, entering);
    if (leavingRow == null) return { status: 'unbounded', finalDict: dict, pivotSteps };

    pivotSteps.push(pivotWithStep(dict, entering, leavingRow, phase, `${entering} vào, ${dict.rows[leavingRow]?.basis ?? ''} ra`));
  }

  return { status: 'optimal', finalDict: dict, pivotSteps };
}

function collectStandardSolution(model: StandardModel, dict: TwoPhaseX0Dictionary): number[] {
  return standardVariableNames(model).map((name) => basicValue(dict, name));
}

function solutionDistance(a: number[], b: number[]): number {
  const size = Math.max(a.length, b.length);
  let distance = 0;

  for (let i = 0; i < size; i += 1) {
    distance = Math.max(distance, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
  }

  return distance;
}

function trialSolutionFromFinalDictionary(model: StandardModel, dict: TwoPhaseX0Dictionary, entering: string, step: number): number[] {
  const yNames = standardVariableNames(model);

  return yNames.map((name) => {
    if (name === entering && dict.nonBasic.includes(name)) {
      return cleanNumber(step);
    }

    const basicRow = dict.rows.find((row) => row.basis === name);
    if (basicRow) {
      return cleanNumber(basicRow.rhs + (basicRow.coeffs[entering] ?? 0) * step);
    }

    return 0;
  });
}

function feasibleStepForNonBasic(dict: TwoPhaseX0Dictionary, entering: string): number | null {
  let upper = Number.POSITIVE_INFINITY;

  for (const row of dict.rows) {
    const coeff = row.coeffs[entering] ?? 0;

    if (coeff < -EPS) {
      upper = Math.min(upper, row.rhs / -coeff);
    }
  }

  if (upper <= EPS) return null;
  if (!Number.isFinite(upper)) return 1;

  return Math.min(1, upper);
}

function findAlternateOptimum(model: StandardModel, dict: TwoPhaseX0Dictionary, solutionOriginal: number[]): { hasAlternateOptimum: boolean; alternateSolutionOriginal?: number[]; alternateEntering?: string } {
  // Chỉ hậu kiểm khi đã có từ vựng tối ưu Pha 2.
  // Không can thiệp quá trình giải và không pivot thật trên từ vựng tối ưu cuối.
  for (const entering of dict.nonBasic) {
    if (entering === 'x0') continue;

    // Điều kiện 1: hệ số của biến không cơ sở trong hàng z bằng 0.
    if (Math.abs(dict.objectiveCoeffs[entering] ?? 0) > EPS) continue;

    // Điều kiện 2: các hàng cơ sở bên dưới có phụ thuộc vào biến này.
    const affectsRows = dict.rows.some((row) => Math.abs(row.coeffs[entering] ?? 0) > EPS);
    if (!affectsRows) continue;

    // Điều kiện 3: có thể tăng biến không cơ sở một lượng dương mà vẫn khả thi.
    const step = feasibleStepForNonBasic(dict, entering);
    if (step == null) continue;

    // Điều kiện 4: nghiệm gốc khôi phục bằng mappings phải khác nghiệm đại diện.
    const alternateStandard = trialSolutionFromFinalDictionary(model, dict, entering, step);
    const alternateOriginal = recoverOriginalSolution(alternateStandard, model);

    if (solutionDistance(alternateOriginal, solutionOriginal) > 1e-7) {
      return {
        hasAlternateOptimum: true,
        alternateSolutionOriginal: alternateOriginal,
        alternateEntering: entering,
      };
    }
  }

  return { hasAlternateOptimum: false };
}

export function analyzeTwoPhaseX0(model: StandardModel): TwoPhaseX0Analysis {
  const hasNegativeRhs = model.constraints.some((row) => row.b < -EPS);
  const standardNames = standardVariableNames(model);

  if (!hasNegativeRhs) {
    return {
      hasNegativeRhs: false,
      canGoToPhaseTwo: true,
      phaseOneInfeasible: false,
      phaseTwoUnbounded: false,
      status: 'skip',
      solutionStandard: [],
      solutionOriginal: [],
      optimalValue: null,
      reason: 'Sau chuẩn hóa không có b_i < 0 nên không cần Pha 1.',
      hasAlternateOptimum: false,
      standardVariableNames: standardNames,
      phaseOnePivotSteps: [],
      phaseTwoPivotSteps: [],
    };
  }

  const phaseOneInitial = buildAuxiliaryDictionary(model);
  const phaseOneWorking = cloneDictionary(phaseOneInitial);
  const phaseOneInitialPivotSteps: TwoPhasePivotStep[] = [];
  let phaseOneAfterInitialPivot: TwoPhaseX0Dictionary | undefined;

  const negativeRow = chooseMostNegativeRhsRow(phaseOneWorking);
  if (negativeRow != null) {
    phaseOneInitialPivotSteps.push(pivotWithStep(phaseOneWorking, 'x0', negativeRow, 'Phase 1', 'x0 vào hàng có RHS âm'));
    phaseOneAfterInitialPivot = cloneDictionary(phaseOneWorking);
  }

  const phaseOne = runDictionarySimplex(phaseOneWorking, 'Phase 1');
  const phaseOneFinal = cloneDictionary(phaseOne.finalDict);
  const phaseOnePivotSteps = [...phaseOneInitialPivotSteps, ...phaseOne.pivotSteps];
  const x0Value = basicValue(phaseOneFinal, 'x0');

  if (x0Value > EPS) {
    return {
      hasNegativeRhs: true,
      canGoToPhaseTwo: false,
      phaseOneInfeasible: true,
      phaseTwoUnbounded: false,
      status: 'infeasible',
      solutionStandard: [],
      solutionOriginal: [],
      optimalValue: null,
      reason: `Tại từ vựng tối ưu Pha 1, x₀* = ${cleanNumber(x0Value)} > 0 nên bài toán gốc vô nghiệm.`,
      hasAlternateOptimum: false,
      standardVariableNames: standardNames,
      phaseOneInitial,
      phaseOneAfterInitialPivot,
      phaseOneFinal,
      phaseOnePivotSteps,
      phaseTwoPivotSteps: [],
      x0Value,
    };
  }

  const phaseTwoStart = restoreOriginalObjective(model, phaseOneFinal);
  const phaseTwo = runDictionarySimplex(cloneDictionary(phaseTwoStart), 'Phase 2');
  const phaseTwoFinal = cloneDictionary(phaseTwo.finalDict);

  if (phaseTwo.status === 'unbounded') {
    return {
      hasNegativeRhs: true,
      canGoToPhaseTwo: true,
      phaseOneInfeasible: false,
      phaseTwoUnbounded: true,
      status: 'unbounded',
      solutionStandard: [],
      solutionOriginal: [],
      optimalValue: null,
      reason: 'Pha 2 không có hàng rời hợp lệ nên bài toán không giới nội.',
      hasAlternateOptimum: false,
      standardVariableNames: standardNames,
      phaseOneInitial,
      phaseOneAfterInitialPivot,
      phaseOneFinal,
      phaseTwoStart,
      phaseTwoFinal,
      phaseOnePivotSteps,
      phaseTwoPivotSteps: phaseTwo.pivotSteps,
      x0Value,
    };
  }

  const solutionStandard = collectStandardSolution(model, phaseTwoFinal);
  const solutionOriginal = recoverOriginalSolution(solutionStandard, model);
  const minValue = cleanNumber(phaseTwoFinal.objectiveRhs);
  const optimalValue = model.original.optimization === 'max' ? cleanNumber(-minValue) : minValue;
  const alternate = findAlternateOptimum(model, phaseTwoFinal, solutionOriginal);

  return {
    hasNegativeRhs: true,
    canGoToPhaseTwo: true,
    phaseOneInfeasible: false,
    phaseTwoUnbounded: false,
    status: 'optimal',
    solutionStandard,
    solutionOriginal,
    optimalValue,
    reason: alternate.hasAlternateOptimum
      ? 'Pha 2 tối ưu. Từ vựng tối ưu còn biến không cơ sở có hệ số 0 trong hàng z, các hàng bên dưới phụ thuộc vào biến đó và khi thay đổi biến này nghiệm gốc khôi phục bằng mappings khác nghiệm đại diện, nên bài toán có vô số nghiệm tối ưu.'
      : 'Pha 1 cho x₀* = 0 nên bài toán gốc khả thi. Pha 2 đã tối ưu trên đúng hệ biến chuẩn và nghiệm gốc được khôi phục bằng mappings.',
    hasAlternateOptimum: alternate.hasAlternateOptimum,
    alternateSolutionOriginal: alternate.alternateSolutionOriginal,
    alternateEntering: alternate.alternateEntering,
    standardVariableNames: standardNames,
    phaseOneInitial,
    phaseOneAfterInitialPivot,
    phaseOneFinal,
    phaseTwoStart,
    phaseTwoFinal,
    phaseOnePivotSteps,
    phaseTwoPivotSteps: phaseTwo.pivotSteps,
    x0Value,
  };
}
