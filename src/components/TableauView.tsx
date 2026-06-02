import type { TableauStep } from '../lib/types';
import { displaySolverVar, fmt } from '../lib/format';

function rawVariableName(step: TableauStep, index: number): string {
  return step.variableNames[index] ?? `x${index + 1}`;
}

function displayVariableName(step: TableauStep, index: number): string {
  return displaySolverVar(rawVariableName(step, index));
}

export function TableauView({ step }: { step: TableauStep }) {
  const rhsCol = step.tableau[0].length - 1;
  const basisSet = new Set(step.basis);

  // Excel/textbook dictionary style:
  // first column = basis variable, second column = RHS,
  // remaining columns = current non-basic variables.
  const nonBasicColumns = Array.from({ length: rhsCol }, (_, col) => col).filter((col) => !basisSet.has(col));
  const displayColumns = [rhsCol, ...nonBasicColumns];

  const getRowLabel = (rowIndex: number): string => {
    if (rowIndex === 0) return 'z';

    const basisVarIndex = step.basis[rowIndex - 1];
    return displayVariableName(step, basisVarIndex);
  };

  const getColumnLabel = (colIndex: number): string => {
    if (colIndex === rhsCol) return 'RHS';
    return displayVariableName(step, colIndex);
  };

  const getDisplayValue = (rowIndex: number, colIndex: number): number => {
    const value = step.tableau[rowIndex][colIndex];

    // In dictionary form, constraint rows are displayed as:
    // basic = RHS - coefficients * nonbasic variables.
    // Therefore non-RHS coefficients in constraint rows are negated.
    if (rowIndex > 0 && colIndex !== rhsCol) return -value;

    return value;
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950">
      <table className="min-w-full border-collapse text-sm notranslate" translate="no">
        <thead>
          <tr className="bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
            <th className="border border-slate-300 px-4 py-2 text-center font-semibold dark:border-slate-700">&nbsp;</th>
            {displayColumns.map((colIndex) => (
              <th key={colIndex} className="border border-slate-300 px-4 py-2 text-center font-semibold dark:border-slate-700">
                {getColumnLabel(colIndex)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {step.tableau.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <td className="border border-slate-300 bg-white px-4 py-2 text-center font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                {getRowLabel(rowIndex)}
              </td>

              {displayColumns.map((colIndex) => {
                const isPivot = step.pivot && step.pivot.row === rowIndex && step.pivot.col === colIndex;
                const value = getDisplayValue(rowIndex, colIndex);

                return (
                  <td
                    key={colIndex}
                    className={[
                      'border border-slate-300 px-4 py-2 text-center tabular-nums dark:border-slate-700',
                      isPivot ? 'bg-red-500 font-bold text-white' : 'bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100',
                    ].join(' ')}
                  >
                    {fmt(value)}
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
