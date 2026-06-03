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

  const nonBasicColumns = Array.from({ length: rhsCol }, (_, col) => col).filter((col) => !basisSet.has(col));
  const displayColumns = [rhsCol, ...nonBasicColumns];

  const enteringCol = step.pivot?.col ?? null;
  const leavingRow = step.pivot?.row ?? null;

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

    // Dạng từ vựng: biến cơ sở = RHS - hệ số * biến không cơ sở.
    if (rowIndex > 0 && colIndex !== rhsCol) return -value;

    return value;
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      {step.pivot && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-black text-emerald-700 ring-1 ring-emerald-400/30 dark:text-emerald-200">
              Biến vào: {displayVariableName(step, step.pivot.col)}
            </span>
            {step.leavingVariable != null && (
              <span className="rounded-full bg-rose-500/15 px-3 py-1 font-black text-rose-700 ring-1 ring-rose-400/30 dark:text-rose-200">
                Biến ra: {displayVariableName(step, step.leavingVariable)}
              </span>
            )}
          </div>
          <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-black text-white">Ô đỏ là pivot</span>
        </div>
      )}

      <div className="w-full max-w-full overflow-x-auto">
        <table className="w-max min-w-full border-collapse text-sm notranslate" translate="no">
          <thead>
            <tr className="bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-center font-black dark:border-slate-800 dark:bg-slate-900">
                Cơ sở
              </th>
              {displayColumns.map((colIndex) => {
                const isEnteringCol = enteringCol === colIndex;
                const isRhs = colIndex === rhsCol;

                return (
                  <th
                    key={colIndex}
                    className={[
                      'border-b border-r border-slate-200 px-4 py-3 text-center font-black dark:border-slate-800',
                      isEnteringCol ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200' : '',
                      isRhs ? 'bg-slate-200/70 text-indigo-700 dark:bg-slate-800/80 dark:text-indigo-300' : '',
                    ].join(' ')}
                  >
                    {getColumnLabel(colIndex)}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {step.tableau.map((_, rowIndex) => {
              const isLeavingRow = leavingRow === rowIndex;
              const isObjectiveRow = rowIndex === 0;

              return (
                <tr key={rowIndex} className={isLeavingRow ? 'bg-rose-500/10' : isObjectiveRow ? 'bg-indigo-500/5' : ''}>
                  <td
                    className={[
                      'sticky left-0 z-10 border-b border-r border-slate-200 px-4 py-3 text-center font-black dark:border-slate-800',
                      isLeavingRow ? 'bg-rose-500/15 text-rose-700 dark:text-rose-200' : 'bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100',
                      isObjectiveRow ? 'text-indigo-700 dark:text-indigo-300' : '',
                    ].join(' ')}
                  >
                    {getRowLabel(rowIndex)}
                  </td>

                  {displayColumns.map((colIndex) => {
                    const isPivot = step.pivot && step.pivot.row === rowIndex && step.pivot.col === colIndex;
                    const isEnteringCol = enteringCol === colIndex;
                    const isRhs = colIndex === rhsCol;
                    const value = getDisplayValue(rowIndex, colIndex);

                    return (
                      <td
                        key={colIndex}
                        className={[
                          'border-b border-r border-slate-200 px-4 py-3 text-center font-mono tabular-nums dark:border-slate-800',
                          isPivot
                            ? 'bg-rose-600 font-black text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,0.35)]'
                            : isLeavingRow
                              ? 'bg-rose-500/10 text-slate-950 dark:text-slate-50'
                              : isEnteringCol
                                ? 'bg-emerald-500/10 text-slate-950 dark:text-slate-50'
                                : 'bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100',
                          isRhs && !isPivot ? 'font-black text-indigo-700 dark:text-indigo-300' : '',
                        ].join(' ')}
                      >
                        {fmt(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
