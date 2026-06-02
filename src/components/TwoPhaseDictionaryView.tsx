import type { ConstraintSign, SimplexResult } from '../lib/types';
import { cleanNumber, displaySolverVar, fmt } from '../lib/format';

type DictRow = {
  basis: string;
  rhs: number;
  coeffs: Record<string, number>;
};

type Dictionary = {
  objectiveName: 'delta' | 'z';
  objectiveRhs: number;
  objectiveCoeffs: Record<string, number>;
  rows: DictRow[];
  nonBasic: string[];
  pivot?: { row: number; col: string; value: number; entering: string; leaving: string } | null;
  title: string;
  note?: string;
};

type AuxRow = {
  a: number[];
  b: number;
  sign: ConstraintSign;
};

const EPS = 1e-9;

function signText(sign: string): string {
  if (sign === '<=') return '≤';
  if (sign === '>=') return '≥';
  return '=';
}

function subVarName(name: string): string {
  return displaySolverVar(name);
}

function displayName(name: string): string {
  if (name === 'x0') return 'x₀';
  if (name === 'delta') return 'delta';
  if (name === 'z') return 'z';
  return subVarName(name);
}

function linearText(coeffs: number[], names: string[]): string {
  const parts: string[] = [];

  coeffs.forEach((coef, i) => {
    const value = Number(coef);
    if (Math.abs(value) < EPS) return;

    const abs = Math.abs(value);
    const coefText = Math.abs(abs - 1) < EPS ? '' : fmt(abs);
    const term = `${coefText}${displayName(names[i] ?? `x${i + 1}`)}`;

    if (parts.length === 0) parts.push(value < 0 ? `-${term}` : term);
    else parts.push(value < 0 ? `− ${term}` : `+ ${term}`);
  });

  return parts.length > 0 ? parts.join(' ') : '0';
}

function constraintRowsForAux(result: SimplexResult): AuxRow[] {
  // Dùng đúng dạng chuẩn: min c^T x, A x <= b, x >= 0.
  // Không đổi dấu chỉ vì b < 0. b < 0 chính là lý do cần Pha 1.
  return result.standard.constraints.map((row) => ({
    a: [...row.a],
    b: row.b,
    sign: '<=' as ConstraintSign,
  }));
}

function objectiveCoefficientsMin(result: SimplexResult): number[] {
  const input = result.standard.original;
  return input.optimization === 'max' ? input.c.map((v) => -v) : [...input.c];
}

function originalVariableNames(result: SimplexResult): string[] {
  return Array.from({ length: result.standard.original.n }, (_, i) => `x${i + 1}`);
}

function cloneDict(dict: Dictionary, title: string, note?: string, pivot?: Dictionary['pivot']): Dictionary {
  return {
    objectiveName: dict.objectiveName,
    objectiveRhs: cleanNumber(dict.objectiveRhs),
    objectiveCoeffs: Object.fromEntries(Object.entries(dict.objectiveCoeffs).map(([k, v]) => [k, cleanNumber(v)])),
    rows: dict.rows.map((row) => ({
      basis: row.basis,
      rhs: cleanNumber(row.rhs),
      coeffs: Object.fromEntries(Object.entries(row.coeffs).map(([k, v]) => [k, cleanNumber(v)])),
    })),
    nonBasic: [...dict.nonBasic],
    pivot: pivot ?? null,
    title,
    note,
  };
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

function buildAuxiliaryDictionary(result: SimplexResult): Dictionary {
  const xNames = originalVariableNames(result);
  const rows = constraintRowsForAux(result);
  const nonBasic = [...xNames, 'x0'];

  return {
    objectiveName: 'delta',
    objectiveRhs: 0,
    objectiveCoeffs: Object.fromEntries(nonBasic.map((name) => [name, name === 'x0' ? 1 : 0])),
    rows: rows.map((row, i) => {
      const coeffs: Record<string, number> = {};
      xNames.forEach((name, j) => {
        // Constraint a*x - x0 <= b gives w = b - a*x + x0.
        coeffs[name] = -(row.a[j] ?? 0);
      });
      coeffs.x0 = 1;
      return { basis: `w${i + 1}`, rhs: row.b, coeffs };
    }),
    nonBasic,
    title: 'Từ vựng xuất phát của bài toán bổ trợ',
  };
}

function pivotDictionary(dict: Dictionary, entering: string, rowIndex: number): { leaving: string; pivotValue: number } {
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

  // Solve old basis row for entering variable.
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

  return { leaving, pivotValue };
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
    // In dictionary form basic = RHS + coeff * entering.
    // Feasibility requires coeff < 0 and entering <= RHS / -coeff.
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

function runPhaseOne(result: SimplexResult): { steps: Dictionary[]; finalDict: Dictionary; canGoToPhaseTwo: boolean } {
  const dict = buildAuxiliaryDictionary(result);
  const steps: Dictionary[] = [cloneDict(dict, 'Từ vựng xuất phát của bài toán bổ trợ')];

  const negativeRow = chooseMostNegativeRhsRow(dict);
  if (negativeRow != null) {
    const entering = 'x0';
    const leaving = dict.rows[negativeRow].basis;
    const pivotValue = dict.rows[negativeRow].coeffs[entering] ?? 0;
    steps.push(cloneDict(dict, `${displayName(entering)} vào, ${displayName(leaving)} ra`, undefined, {
      row: negativeRow,
      col: entering,
      value: pivotValue,
      entering,
      leaving,
    }));
    pivotDictionary(dict, entering, negativeRow);
  }

  for (let guard = 0; guard < 100; guard += 1) {
    const entering = chooseEnteringForMin(dict);
    if (!entering) break;

    const leavingRow = chooseLeavingForEntering(dict, entering);
    if (leavingRow == null) break;

    const leaving = dict.rows[leavingRow].basis;
    const pivotValue = dict.rows[leavingRow].coeffs[entering] ?? 0;
    steps.push(cloneDict(dict, `${displayName(entering)} vào, ${displayName(leaving)} ra`, undefined, {
      row: leavingRow,
      col: entering,
      value: pivotValue,
      entering,
      leaving,
    }));
    pivotDictionary(dict, entering, leavingRow);
  }

  steps.push(cloneDict(dict, 'Từ vựng tối ưu của Pha 1'));

  // Theo quy tắc trình bày của bạn:
  // Sau khi Pha 1 tối ưu, nếu hàng delta còn chứa x0 thì cho x0 = 0 và chuyển sang Pha 2.
  // Nếu hàng delta không còn chứa x0 thì kết luận bài toán gốc vô nghiệm.
  return { steps, finalDict: dict, canGoToPhaseTwo: deltaContainsX0(dict) };
}

function removeX0FromDictionary(dict: Dictionary): Dictionary {
  const out = cloneDict(dict, 'Loại biến x₀ khỏi từ vựng');

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

function restoreOriginalObjective(result: SimplexResult, phaseOneFinal: Dictionary): Dictionary {
  const dict = removeX0FromDictionary(phaseOneFinal);
  const xNames = originalVariableNames(result);
  const minCoefs = objectiveCoefficientsMin(result);

  dict.objectiveName = 'z';
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
  dict.title = 'Từ vựng xuất phát cho Pha 2';
  return dict;
}

function runPhaseTwo(result: SimplexResult, phaseOneFinal: Dictionary): Dictionary[] {
  const dict = restoreOriginalObjective(result, phaseOneFinal);
  const steps: Dictionary[] = [cloneDict(dict, 'Từ vựng xuất phát cho Pha 2')];

  for (let guard = 0; guard < 100; guard += 1) {
    const entering = chooseEnteringForMin(dict);
    if (!entering) break;

    const leavingRow = chooseLeavingForEntering(dict, entering);
    if (leavingRow == null) {
      steps.push(cloneDict(dict, 'Bài toán không bị chặn trong Pha 2.'));
      break;
    }

    const leaving = dict.rows[leavingRow].basis;
    const pivotValue = dict.rows[leavingRow].coeffs[entering] ?? 0;
    steps.push(cloneDict(dict, `${displayName(entering)} vào, ${displayName(leaving)} ra`, undefined, {
      row: leavingRow,
      col: entering,
      value: pivotValue,
      entering,
      leaving,
    }));
    pivotDictionary(dict, entering, leavingRow);
  }

  steps.push(cloneDict(dict, 'Từ vựng tối ưu của Pha 2'));
  return steps;
}

function PhaseBar({ children }: { children: string }) {
  return <div className="bg-black px-4 py-2 text-center text-sm font-bold text-red-500">{children}</div>;
}

function StandardProblemTable({ result, standardized = false }: { result: SimplexResult; standardized?: boolean }) {
  const input = result.standard.original;
  const originalNames = originalVariableNames(result);

  if (!standardized) {
    const label = input.optimization;
    return (
      <div className="overflow-x-auto">
        <table className="min-w-[620px] border-collapse bg-white text-sm text-slate-950">
          <tbody>
            <tr>
              <td className="border border-slate-300 px-3 py-1 text-center font-semibold">{label}</td>
              <td className="border border-slate-300 px-3 py-1 text-center">{linearText(input.c, originalNames)}</td>
              <td className="border border-slate-300 px-3 py-1 text-center"></td>
            </tr>
            {input.A.map((row, index) => (
              <tr key={index}>
                <td className="border border-slate-300 px-3 py-1 text-center">{index === 0 ? 's.t.' : ''}</td>
                <td className="border border-slate-300 px-3 py-1 text-center">{linearText(row, originalNames)}</td>
                <td className="border border-slate-300 px-3 py-1 text-center">{signText(input.signs[index])} {fmt(input.b[index] ?? 0)}</td>
              </tr>
            ))}
            <tr>
              <td className="border border-slate-300 px-3 py-1 text-center"></td>
              <td className="border border-slate-300 px-3 py-1 text-center">{originalNames.map(displayName).join(', ')} ≥ 0</td>
              <td className="border border-slate-300 px-3 py-1 text-center"></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  const names = result.standard.mappings.map((mapping) => mapping.label);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[620px] border-collapse bg-white text-sm text-slate-950">
        <tbody>
          <tr>
            <td className="border border-slate-300 px-3 py-1 text-center font-semibold">min</td>
            <td className="border border-slate-300 px-3 py-1 text-center">{linearText(result.standard.c, names)}</td>
            <td className="border border-slate-300 px-3 py-1 text-center"></td>
          </tr>
          {result.standard.constraints.map((row, index) => (
            <tr key={index}>
              <td className="border border-slate-300 px-3 py-1 text-center">{index === 0 ? 's.t.' : ''}</td>
              <td className="border border-slate-300 px-3 py-1 text-center">{linearText(row.a, names)}</td>
              <td className="border border-slate-300 px-3 py-1 text-center">≤ {fmt(row.b)}</td>
            </tr>
          ))}
          <tr>
            <td className="border border-slate-300 px-3 py-1 text-center"></td>
            <td className="border border-slate-300 px-3 py-1 text-center">{names.map(displayName).join(', ')} ≥ 0</td>
            <td className="border border-slate-300 px-3 py-1 text-center"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function AuxiliaryProblem({ result }: { result: SimplexResult }) {
  const input = result.standard.original;
  const names = originalVariableNames(result);
  const rows = constraintRowsForAux(result);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-300 bg-white text-slate-950">
      <PhaseBar>Pha 1:</PhaseBar>
      <div className="p-4">
        <h4 className="mb-3 text-center font-bold">Giải bài toán bổ trợ</h4>
        <div className="overflow-x-auto">
          <table className="min-w-[620px] border-collapse bg-white text-sm text-slate-950">
            <tbody>
              <tr>
                <td className="border border-slate-300 px-3 py-1 text-center font-semibold">min</td>
                <td className="border border-slate-300 px-3 py-1 text-center">delta = x₀</td>
                <td className="border border-slate-300 px-3 py-1 text-center"></td>
              </tr>
              {rows.map((row, index) => {
                const coefs = [...row.a, -1];
                return (
                  <tr key={index}>
                    <td className="border border-slate-300 px-3 py-1 text-center">{index === 0 ? 's.t.' : ''}</td>
                    <td className="border border-slate-300 px-3 py-1 text-center">{linearText(coefs, [...names, 'x0'])}</td>
                    <td className="border border-slate-300 px-3 py-1 text-center">≤ {fmt(row.b)}</td>
                  </tr>
                );
              })}
              <tr>
                <td className="border border-slate-300 px-3 py-1 text-center"></td>
                <td className="border border-slate-300 px-3 py-1 text-center">{names.map(displayName).join(', ')}, x₀ ≥ 0</td>
                <td className="border border-slate-300 px-3 py-1 text-center"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function DictionaryTable({ dict }: { dict: Dictionary }) {
  const columns = ['RHS', ...dict.nonBasic];

  const valueAt = (row: DictRow, column: string) => {
    if (column === 'RHS') return row.rhs;
    return row.coeffs[column] ?? 0;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[620px] border-collapse bg-white text-sm text-slate-950">
        <thead>
          <tr>
            <th className="border border-slate-300 px-3 py-1 text-center"></th>
            {columns.map((column) => (
              <th key={column} className="border border-slate-300 px-3 py-1 text-center font-semibold">
                {column === 'RHS' ? 'RHS' : displayName(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-300 px-3 py-1 text-center font-semibold">{dict.objectiveName}</td>
            {columns.map((column) => {
              const isPivot = dict.pivot && dict.pivot.row === -1 && dict.pivot.col === column;
              const value = column === 'RHS' ? dict.objectiveRhs : dict.objectiveCoeffs[column] ?? 0;
              return (
                <td key={column} className={['border border-slate-300 px-3 py-1 text-center tabular-nums', isPivot ? 'bg-red-600 font-bold text-white' : ''].join(' ')}>
                  {fmt(value)}
                </td>
              );
            })}
          </tr>
          {dict.rows.map((row, rowIndex) => (
            <tr key={row.basis}>
              <td className="border border-slate-300 px-3 py-1 text-center font-semibold">{displayName(row.basis)}</td>
              {columns.map((column) => {
                const isPivot = dict.pivot && dict.pivot.row === rowIndex && dict.pivot.col === column;
                return (
                  <td key={column} className={['border border-slate-300 px-3 py-1 text-center tabular-nums', isPivot ? 'bg-red-600 font-bold text-white' : ''].join(' ')}>
                    {fmt(valueAt(row, column))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DictionaryStep({ dict }: { dict: Dictionary }) {
  return (
    <article className="space-y-2">
      <div className="text-center text-sm font-semibold text-slate-200">{dict.title}</div>
      {dict.pivot && <div className="text-center text-xs text-slate-400">Ô đỏ là pivot: {displayName(dict.pivot.entering)} vào, {displayName(dict.pivot.leaving)} ra.</div>}
      <DictionaryTable dict={dict} />
    </article>
  );
}

export function TwoPhaseDictionaryView({ result }: { result: SimplexResult }) {
  const hasNegativeRhs = result.standard.constraints.some((row) => row.b < -EPS);
  const phaseOne = hasNegativeRhs ? runPhaseOne(result) : null;
  const phaseTwoSteps = phaseOne?.canGoToPhaseTwo ? runPhaseTwo(result, phaseOne.finalDict) : [];

  return (
    <div className="space-y-6 rounded-3xl border border-slate-800 bg-slate-950 p-5">
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <h3 className="text-lg font-black">Lời giải phương pháp hai pha theo biến x₀</h3>
        <p className="mt-1 text-sm text-slate-300">
          Phần này tạo bài toán bổ trợ bằng biến x₀, lập từ vựng xuất phát, pivot x₀ vào hàng có RHS âm, giải Pha 1, rồi kiểm tra hàng delta: còn x₀ thì cho x₀ = 0 và sang Pha 2; không còn x₀ thì kết luận vô nghiệm.
        </p>
      </div>

      <section className="space-y-3">
        <h4 className="font-bold text-slate-100">Bài toán ban đầu</h4>
        <StandardProblemTable result={result} />
      </section>

      <section className="space-y-3">
        <h4 className="font-bold text-slate-100">Đưa về dạng chuẩn</h4>
        <StandardProblemTable result={result} standardized />
      </section>

      {!hasNegativeRhs ? (
        <section className="space-y-3">
          <PhaseBar>Nhận xét</PhaseBar>
          <div className="rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-950">
            Sau khi đưa về dạng chuẩn, tất cả bᵢ ≥ 0 nên bài toán đã có từ vựng xuất phát khả thi.
            Vì vậy không cần dùng Pha 1; có thể giải trực tiếp bằng phương pháp đơn hình hoặc Bland.
          </div>
        </section>
      ) : (
        <>
          <AuxiliaryProblem result={result} />

          <section className="space-y-5">
            <h4 className="font-bold text-slate-100">Từ vựng Pha 1</h4>
            <div className="rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-950">
              Quy tắc kiểm tra sau Pha 1: nếu hàng delta còn chứa x₀ thì đặt x₀ = 0 và giải tiếp Pha 2; nếu hàng delta không còn chứa x₀ thì bài toán gốc vô nghiệm.
            </div>
            {phaseOne?.steps.map((dict, index) => <DictionaryStep key={`p1-${index}`} dict={dict} />)}
            <div className="rounded-xl border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-950">
              {phaseOne?.canGoToPhaseTwo
                ? 'Hàng delta còn chứa x₀. Cho x₀ = 0, loại x₀ và chuyển sang Pha 2.'
                : 'Hàng delta không còn chứa x₀. Khi cho các biến mà delta chứa bằng 0 thì không khôi phục được bài toán gốc, nên kết luận bài toán vô nghiệm.'}
            </div>
          </section>

          {phaseOne?.canGoToPhaseTwo && (
            <section className="space-y-5">
              <PhaseBar>Pha 2:</PhaseBar>
              <div className="rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-950">
                Cho x₀ = 0, loại x₀ khỏi từ vựng, khôi phục hàm mục tiêu gốc rồi tiếp tục giải đơn hình.
              </div>
              {phaseTwoSteps.map((dict, index) => <DictionaryStep key={`p2-${index}`} dict={dict} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
