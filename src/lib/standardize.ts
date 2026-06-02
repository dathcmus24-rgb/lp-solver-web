import type { ConstraintRow, LPInput, StandardModel, VariableMapping } from './types';
import { cleanNumber, flipSign, linearLatex, signToLatex, varNameToLatex } from './format';

export function createEmptyLP(n = 2, m = 3): LPInput {
  return {
    optimization: 'max',
    n,
    m,
    c: Array.from({ length: n }, () => 0),
    A: Array.from({ length: m }, () => Array.from({ length: n }, () => 0)),
    signs: Array.from({ length: m }, () => '<='),
    b: Array.from({ length: m }, () => 0),
    variableTypes: Array.from({ length: n }, () => 'nonnegative'),
  };
}

export const sampleProblem: LPInput = {
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
};

function pushExpandedColumn(
  c: number[],
  rows: number[][],
  mappings: VariableMapping[],
  originalIndex: number,
  objectiveCoef: number,
  columnValues: number[],
  label: string,
  kind: VariableMapping['kind'],
): void {
  c.push(objectiveCoef);
  rows.forEach((row, i) => row.push(columnValues[i]));
  mappings.push({ originalIndex, kind, label });
}

export function standardize(input: LPInput): StandardModel {
  const expandedRows = input.A.map(() => [] as number[]);
  const c: number[] = [];
  const mappings: VariableMapping[] = [];
  const objSign = input.optimization === 'max' ? -1 : 1;

  for (let j = 0; j < input.n; j += 1) {
    const column = input.A.map((row) => row[j] ?? 0);
    const coef = objSign * (input.c[j] ?? 0);
    const type = input.variableTypes[j];

    if (type === 'free') {
      pushExpandedColumn(c, expandedRows, mappings, j, coef, column, `x${j + 1}⁺`, 'free-positive');
      pushExpandedColumn(c, expandedRows, mappings, j, -coef, column.map((v) => -v), `x${j + 1}⁻`, 'free-negative');
    } else if (type === 'nonpositive') {
      pushExpandedColumn(c, expandedRows, mappings, j, -coef, column.map((v) => -v), `u${j + 1}`, 'negated');
    } else {
      pushExpandedColumn(c, expandedRows, mappings, j, coef, column, `x${j + 1}`, 'same');
    }
  }

  // Dạng chuẩn dùng trong project:
  //   min c^T x
  //   A x <= b
  //   x_i >= 0
  //
  // Chú ý: KHÔNG nhân dòng chỉ vì b < 0.
  // Nếu sau chuẩn hóa có b_i < 0 thì từ vựng xuất phát chưa khả thi,
  // khi đó mới dùng phương pháp 2 pha.
  const constraints: ConstraintRow[] = [];
  expandedRows.forEach((a, i) => {
    const row = a.map(cleanNumber);
    const rhs = cleanNumber(input.b[i] ?? 0);
    const sign = input.signs[i];

    if (sign === '<=') {
      constraints.push({ a: row, sign: '<=', b: rhs, label: `R${i + 1}` });
    } else if (sign === '>=') {
      constraints.push({ a: row.map((v) => cleanNumber(-v)), sign: '<=', b: cleanNumber(-rhs), label: `R${i + 1}` });
    } else {
      // a x = b tương đương a x <= b và -a x <= -b.
      constraints.push({ a: row, sign: '<=', b: rhs, label: `R${i + 1}a` });
      constraints.push({ a: row.map((v) => cleanNumber(-v)), sign: '<=', b: cleanNumber(-rhs), label: `R${i + 1}b` });
    }
  });

  const names = mappings.map((m) => m.label.replace(/[⁺⁻]/g, (ch) => (ch === '⁺' ? '^+' : '^-')));
  const latexNames = names.map(varNameToLatex);
  const constraintText = constraints
    .map((r) => `${linearLatex(r.a, latexNames)} ${signToLatex(r.sign)} ${cleanNumber(r.b)}`)
    .join(',\\; ');
  const latex = `\\min\\; ${linearLatex(c, latexNames)} \\quad \\text{s.t.}\\quad ${constraintText},\\; ${latexNames.join(', ')} \\ge 0`;

  return { c: c.map(cleanNumber), constraints, mappings, original: input, latex };
}

export function recoverOriginalSolution(standardSolution: number[], model: StandardModel): number[] {
  const out = Array.from({ length: model.original.n }, () => 0);
  model.mappings.forEach((mapping, i) => {
    const value = standardSolution[i] ?? 0;
    if (mapping.kind === 'same') out[mapping.originalIndex] += value;
    if (mapping.kind === 'negated') out[mapping.originalIndex] -= value;
    if (mapping.kind === 'free-positive') out[mapping.originalIndex] += value;
    if (mapping.kind === 'free-negative') out[mapping.originalIndex] -= value;
  });
  return out.map(cleanNumber);
}
