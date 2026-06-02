import type { StandardModel } from './types';
import { cleanNumber } from './format';

const EPS = 1e-9;

type DictRow = {
  basis: string;
  rhs: number;
  coeffs: Record<string, number>;
};

type Dictionary = {
  objectiveRhs: number;
  objectiveCoeffs: Record<string, number>;
  rows: DictRow[];
  nonBasic: string[];
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
};

function originalVariableNames(model: StandardModel): string[] {
  return Array.from({ length: model.original.n }, (_, i) => `x${i + 1}`);
}

function normalizeDict(dict: Dictionary): void {
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

function buildAuxiliaryDictionary(model: StandardModel): Dictionary {
  const xNames = originalVariableNames(model);
  const nonBasic = [...xNames, 'x0'];

  return {
    objectiveRhs: 0,
    objectiveCoeffs: Object.fromEntries(nonBasic.map((name) => [name, name === 'x0' ? 1 : 0])),
    rows: model.constraints.map((row, i) => {
      const coeffs: Record<string, number> = {};
      xNames.forEach((name, j) => {
        // a*x - x0 <= b  =>  w = b - a*x + x0
        coeffs[name] = -(row.a[j] ?? 0);
      });
      coeffs.x0 = 1;
      return { basis: `w${i + 1}`, rhs: row.b, coeffs };
    }),
    nonBasic,
  };
}

function pivotDictionary(dict: Dictionary, entering: string, rowIndex: number): void {
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

  const enteringExpression: DictRow = {
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

function chooseMostNegativeRhsRow(dict: Dictionary): number | null {
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

function chooseEnteringForMin(dict: Dictionary): string | null {
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

function chooseLeavingForEntering(dict: Dictionary, entering: string): number | null {
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

function deltaContainsX0(dict: Dictionary): boolean {
  return dict.nonBasic.includes('x0') && Math.abs(dict.objectiveCoeffs.x0 ?? 0) > EPS;
}

function objectiveCoefficientsMin(model: StandardModel): number[] {
  const input = model.original;
  return input.optimization === 'max' ? input.c.map((v) => -v) : [...input.c];
}

function cloneDictionary(dict: Dictionary): Dictionary {
  return {
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

function removeX0FromDictionary(dict: Dictionary): Dictionary {
  const out = cloneDictionary(dict);

  const basicX0Row = out.rows.findIndex((row) => row.basis === 'x0');
  if (basicX0Row >= 0) {
    const replacement = out.nonBasic.find((name) => name !== 'x0' && Math.abs(out.rows[basicX0Row].coeffs[name] ?? 0) > EPS);
    if (replacement) pivotDictionary(out, replacement, basicX0Row);
  }

  out.nonBasic = out.nonBasic.filter((name) => name !== 'x0');
  out.rows = out.rows.filter((row) => row.basis !== 'x0');
  out.rows.forEach((row) => delete row.coeffs.x0);
  delete out.objectiveCoeffs.x0;
  normalizeDict(out);

  return out;
}

function restoreOriginalObjective(model: StandardModel, phaseOneFinal: Dictionary): Dictionary {
  const dict = removeX0FromDictionary(phaseOneFinal);
  const xNames = originalVariableNames(model);
  const minCoefs = objectiveCoefficientsMin(model);

  dict.objectiveRhs = 0;
  dict.objectiveCoeffs = Object.fromEntries(dict.nonBasic.map((name) => [name, 0]));

  xNames.forEach((name, index) => {
    const cost = minCoefs[index] ?? 0;
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

function runDictionarySimplex(dict: Dictionary): { status: 'optimal' | 'unbounded'; finalDict: Dictionary } {
  for (let guard = 0; guard < 100; guard += 1) {
    const entering = chooseEnteringForMin(dict);
    if (!entering) return { status: 'optimal', finalDict: dict };

    const leavingRow = chooseLeavingForEntering(dict, entering);
    if (leavingRow == null) return { status: 'unbounded', finalDict: dict };

    pivotDictionary(dict, entering, leavingRow);
  }

  return { status: 'optimal', finalDict: dict };
}

function collectOriginalSolution(model: StandardModel, dict: Dictionary): number[] {
  const names = originalVariableNames(model);

  return names.map((name) => {
    const row = dict.rows.find((item) => item.basis === name);
    return cleanNumber(row?.rhs ?? 0);
  });
}

export function analyzeTwoPhaseX0(model: StandardModel): TwoPhaseX0Analysis {
  const hasNegativeRhs = model.constraints.some((row) => row.b < -EPS);

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
    };
  }

  const dict = buildAuxiliaryDictionary(model);
  const negativeRow = chooseMostNegativeRhsRow(dict);

  if (negativeRow != null) {
    pivotDictionary(dict, 'x0', negativeRow);
  }

  for (let guard = 0; guard < 100; guard += 1) {
    const entering = chooseEnteringForMin(dict);
    if (!entering) break;

    const leavingRow = chooseLeavingForEntering(dict, entering);
    if (leavingRow == null) break;

    pivotDictionary(dict, entering, leavingRow);
  }

  const canGoToPhaseTwo = deltaContainsX0(dict);

  if (!canGoToPhaseTwo) {
    return {
      hasNegativeRhs: true,
      canGoToPhaseTwo: false,
      phaseOneInfeasible: true,
      phaseTwoUnbounded: false,
      status: 'infeasible',
      solutionStandard: [],
      solutionOriginal: [],
      optimalValue: null,
      reason: 'Hàng delta của từ vựng tối ưu Pha 1 không còn chứa x0, nên bài toán gốc vô nghiệm theo quy tắc Two-Phase x0.',
    };
  }

  const phaseTwoStart = restoreOriginalObjective(model, dict);
  const phaseTwo = runDictionarySimplex(phaseTwoStart);

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
      reason: 'Pha 2 không có hàng rời hợp lệ, nên bài toán không giới nội.',
    };
  }

  const solutionOriginal = collectOriginalSolution(model, phaseTwo.finalDict);
  const minValue = cleanNumber(phaseTwo.finalDict.objectiveRhs);
  const optimalValue = model.original.optimization === 'max' ? cleanNumber(-minValue) : minValue;

  return {
    hasNegativeRhs: true,
    canGoToPhaseTwo: true,
    phaseOneInfeasible: false,
    phaseTwoUnbounded: false,
    status: 'optimal',
    solutionStandard: [...solutionOriginal],
    solutionOriginal,
    optimalValue,
    reason: 'Pha 2 đã tối ưu. Nghiệm được lấy từ RHS của các biến cơ sở trong từ vựng tối ưu Pha 2.',
  };
}
