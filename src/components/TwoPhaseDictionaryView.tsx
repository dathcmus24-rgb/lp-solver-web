import type { ReactNode } from 'react';
import type { SimplexResult } from '../lib/types';
import { displaySolverVar, fmt } from '../lib/format';
import { analyzeTwoPhaseX0, type TwoPhasePivotStep, type TwoPhaseX0Dictionary, type TwoPhaseX0Row } from '../lib/twoPhaseX0';

function signText(sign: string): string {
  if (sign === '<=') return '≤';
  if (sign === '>=') return '≥';
  return '=';
}

function displayName(name: string): string {
  return displaySolverVar(name);
}

function linearText(coeffs: number[], names: string[]): string {
  const parts: string[] = [];

  coeffs.forEach((coef, i) => {
    const value = Number(coef);
    if (Math.abs(value) < 1e-9) return;

    const abs = Math.abs(value);
    const coefText = Math.abs(abs - 1) < 1e-9 ? '' : fmt(abs);
    const term = `${coefText}${names[i] ?? `x${i + 1}`}`;

    if (parts.length === 0) parts.push(value < 0 ? `-${term}` : term);
    else parts.push(value < 0 ? `− ${term}` : `+ ${term}`);
  });

  return parts.length > 0 ? parts.join(' ') : '0';
}

function formatOriginalSolution(solution: number[] | undefined): string {
  if (!solution || solution.length === 0) return '—';
  return solution.map((value, index) => `x${index + 1} = ${fmt(value)}`).join(', ');
}

function StandardProblem({ result }: { result: SimplexResult }) {
  const names = result.standard.mappings.map((mapping) => displayName(mapping.label));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <h4 className="mb-3 font-bold text-slate-900 dark:text-slate-100">1. Đưa về dạng chuẩn</h4>
      <div className="overflow-x-auto font-serif text-base leading-8 text-slate-900 dark:text-slate-100">
        <div className="grid min-w-max grid-cols-[auto_auto_1fr] gap-x-4">
          <div className="text-right italic">min</div>
          <div />
          <div>{linearText(result.standard.c, names)}</div>

          {result.standard.constraints.map((row, index) => (
            <div key={index} className="contents">
              <div className="text-right italic">{index === 0 ? 's.t.' : ''}</div>
              <div />
              <div>
                {linearText(row.a, names)} <span className="px-2">{signText(row.sign)}</span> {fmt(row.b)}
              </div>
            </div>
          ))}

          <div />
          <div />
          <div>{names.join(', ')} <span className="px-2">≥</span> 0</div>
        </div>
      </div>
    </section>
  );
}

function AuxiliaryProblemBox({ result }: { result: SimplexResult }) {
  const names = result.standard.mappings.map((mapping) => displayName(mapping.label));

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <h4 className="mb-3 font-bold text-amber-900 dark:text-amber-100">2. Pha 1: Giải bài toán bổ trợ</h4>
      <div className="overflow-x-auto font-serif text-base leading-8 text-amber-950 dark:text-amber-100">
        <div className="grid min-w-max grid-cols-[auto_auto_1fr] gap-x-4">
          <div className="text-right italic">min</div>
          <div />
          <div>delta = {displayName('x0')}</div>

          {result.standard.constraints.map((row, index) => (
            <div key={index} className="contents">
              <div className="text-right italic">{index === 0 ? 's.t.' : ''}</div>
              <div />
              <div>
                {linearText(row.a, names)} − {displayName('x0')} <span className="px-2">≤</span> {fmt(row.b)}
              </div>
            </div>
          ))}

          <div />
          <div />
          <div>{[...names, displayName('x0')].join(', ')} <span className="px-2">≥</span> 0</div>
        </div>
      </div>
      <p className="mt-3 text-sm text-amber-900 dark:text-amber-100">
        Bài toán bổ trợ được lập trực tiếp từ dạng chuẩn ở trên. Vì vậy nếu dạng chuẩn có {displayName('x1⁺')}, {displayName('x1⁻')} thì Pha 1 cũng dùng đúng các biến chuẩn đó.
      </p>
    </section>
  );
}

function valueAt(row: TwoPhaseX0Row, column: string): number {
  if (column === 'RHS') return row.rhs;
  return row.coeffs[column] ?? 0;
}

function DictionaryTable({ dict, pivotStep }: { dict: TwoPhaseX0Dictionary; pivotStep?: TwoPhasePivotStep }) {
  const columns = ['RHS', ...dict.nonBasic];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950">
      <table className="min-w-full border-collapse text-sm notranslate" translate="no">
        <thead>
          <tr className="bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
            <th className="border border-slate-300 px-4 py-2 text-center font-semibold dark:border-slate-700">&nbsp;</th>
            {columns.map((column) => {
              const isEnteringColumn = pivotStep?.entering === column;

              return (
                <th
                  key={column}
                  className={[
                    'border border-slate-300 px-4 py-2 text-center font-semibold dark:border-slate-700',
                    isEnteringColumn ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200' : '',
                    column === 'RHS' ? 'bg-slate-100 dark:bg-slate-900' : '',
                  ].join(' ')}
                >
                  {column === 'RHS' ? 'RHS' : displayName(column)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-300 bg-white px-4 py-2 text-center font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
              {dict.objectiveName}
            </td>
            {columns.map((column) => (
              <td key={column} className="border border-slate-300 bg-white px-4 py-2 text-center tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                {fmt(column === 'RHS' ? dict.objectiveRhs : dict.objectiveCoeffs[column] ?? 0)}
              </td>
            ))}
          </tr>

          {dict.rows.map((row, rowIndex) => {
            const isLeavingRow = pivotStep?.leavingRow === rowIndex;

            return (
              <tr key={row.basis} className={isLeavingRow ? 'bg-rose-500/10' : ''}>
                <td
                  className={[
                    'border border-slate-300 px-4 py-2 text-center font-semibold dark:border-slate-700',
                    isLeavingRow ? 'bg-rose-500/15 text-rose-700 dark:text-rose-200' : 'bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100',
                  ].join(' ')}
                >
                  {displayName(row.basis)}
                </td>
                {columns.map((column) => {
                  const isPivot = pivotStep?.leavingRow === rowIndex && pivotStep.entering === column;
                  const isEnteringColumn = pivotStep?.entering === column;

                  return (
                    <td
                      key={column}
                      className={[
                        'border border-slate-300 px-4 py-2 text-center tabular-nums dark:border-slate-700',
                        isPivot
                          ? 'bg-red-500 font-bold text-white'
                          : isLeavingRow
                            ? 'bg-rose-500/10 text-slate-900 dark:text-slate-100'
                            : isEnteringColumn
                              ? 'bg-emerald-500/10 text-slate-900 dark:text-slate-100'
                              : 'bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100',
                      ].join(' ')}
                    >
                      {fmt(valueAt(row, column))}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DictionaryCard({ title, note, dict }: { title: string; note?: string; dict?: TwoPhaseX0Dictionary }) {
  if (!dict) return null;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3">
        <h5 className="font-bold text-slate-900 dark:text-slate-100">{title}</h5>
        {note && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{note}</p>}
      </div>
      <DictionaryTable dict={dict} />
    </article>
  );
}

function PivotStepCard({ step, index }: { step: TwoPhasePivotStep; index: number }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="font-bold text-slate-900 dark:text-slate-100">
            Bước pivot {index + 1}: {displayName(step.entering)} vào, {displayName(step.leaving)} ra
          </h5>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Bảng bên dưới là từ vựng trước khi xoay. Cột xanh là biến vào, hàng đỏ là biến ra, ô đỏ là pivot.
          </p>
        </div>
        <div className="rounded-full bg-red-500 px-3 py-1 text-sm font-bold text-white">Pivot = {fmt(step.pivotValue)}</div>
      </div>

      <DictionaryTable dict={step.before} pivotStep={step} />
    </article>
  );
}

function PhaseConclusion({ title, children, tone = 'indigo' }: { title: string; children: ReactNode; tone?: 'indigo' | 'emerald' | 'rose' | 'amber' }) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
      : tone === 'rose'
        ? 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
        : tone === 'amber'
          ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
          : 'border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100';

  return (
    <div className={`rounded-2xl border-l-4 p-4 ${toneClass}`}>
      <h4 className="font-bold">{title}</h4>
      <p className="mt-1 text-sm leading-6">{children}</p>
    </div>
  );
}

export function TwoPhaseDictionaryView({ result }: { result: SimplexResult }) {
  const analysis = analyzeTwoPhaseX0(result.standard);

  if (!analysis.hasNegativeRhs || analysis.status === 'skip') {
    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-purple-200 bg-purple-50 p-5 dark:border-purple-900 dark:bg-purple-950/30">
          <h3 className="text-lg font-black text-purple-900 dark:text-purple-100">Lời giải phương pháp hai pha</h3>
          <p className="mt-1 text-sm text-purple-800 dark:text-purple-200">
            Sau chuẩn hóa không có RHS âm nên không cần Pha 1. Có thể giải trực tiếp bằng đơn hình.
          </p>
        </div>
        <StandardProblem result={result} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-purple-200 bg-purple-50 p-5 dark:border-purple-900 dark:bg-purple-950/30">
        <h3 className="text-lg font-black text-purple-900 dark:text-purple-100">Lời giải phương pháp hai pha</h3>
        <p className="mt-1 text-sm text-purple-800 dark:text-purple-200">
          Phần này trình bày theo đúng luồng: đưa về dạng chuẩn, lập bài toán bổ trợ từ chính dạng chuẩn, giải Pha 1, loại {displayName('x0')} nếu khả thi rồi khôi phục hàm mục tiêu Pha 2 bằng hệ số chuẩn.
        </p>
      </div>

      <StandardProblem result={result} />
      <AuxiliaryProblemBox result={result} />

      <section className="space-y-4">
        <PhaseConclusion title="3. Các từ vựng Pha 1">
          Pha 1 được lập từ các biến chuẩn: {analysis.standardVariableNames.map(displayName).join(', ')} và biến bổ trợ {displayName('x0')}.
        </PhaseConclusion>
        <DictionaryCard title="Từ vựng xuất phát của Pha 1" dict={analysis.phaseOneInitial} />
        {analysis.phaseOnePivotSteps.map((step, index) => (
          <PivotStepCard key={`phase1-pivot-${index}`} step={step} index={index} />
        ))}
        <DictionaryCard title="Từ vựng tối ưu của Pha 1" dict={analysis.phaseOneFinal} />
      </section>

      {analysis.status === 'infeasible' && (
        <PhaseConclusion title="4. Kết luận sau Pha 1" tone="rose">
          {analysis.reason}
        </PhaseConclusion>
      )}

      {analysis.status !== 'infeasible' && (
        <>
          <PhaseConclusion title="4. Chuyển sang Pha 2" tone="emerald">
            Pha 1 cho {displayName('x0')}* = {fmt(analysis.x0Value ?? 0)} nên bài toán gốc khả thi. Loại {displayName('x0')}, khôi phục hàm mục tiêu bằng model.c của dạng chuẩn và tiếp tục Pha 2.
          </PhaseConclusion>

          <section className="space-y-4">
            <DictionaryCard title="Từ vựng xuất phát cho Pha 2" dict={analysis.phaseTwoStart} />
            {analysis.phaseTwoPivotSteps.map((step, index) => (
              <PivotStepCard key={`phase2-pivot-${index}`} step={step} index={index} />
            ))}
            <DictionaryCard title="Từ vựng tối ưu của Pha 2" dict={analysis.phaseTwoFinal} />
          </section>
        </>
      )}

      {analysis.status === 'optimal' && (
        <PhaseConclusion title="5. Kết luận Pha 2" tone="emerald">
          {analysis.hasAlternateOptimum ? (
            <>
              Pha 2 tối ưu. Từ vựng tối ưu còn biến không cơ sở có hệ số 0 trong hàng z, các hàng bên dưới phụ thuộc vào biến đó và khi thay đổi biến này nghiệm gốc khôi phục bằng mappings khác nghiệm đại diện. Vì vậy bài toán có vô số nghiệm tối ưu. Một nghiệm đại diện là {formatOriginalSolution(analysis.solutionOriginal)}
              {analysis.alternateSolutionOriginal ? `; một nghiệm tối ưu khác là ${formatOriginalSolution(analysis.alternateSolutionOriginal)}` : ''}. Giá trị tối ưu là {result.standard.original.optimization} z = {analysis.optimalValue == null ? '—' : fmt(analysis.optimalValue)}.
            </>
          ) : (
            <>
              Pha 2 tối ưu. Nghiệm chuẩn được khôi phục về nghiệm gốc bằng mappings. Giá trị tối ưu là {result.standard.original.optimization} z = {analysis.optimalValue == null ? '—' : fmt(analysis.optimalValue)}.
            </>
          )}
        </PhaseConclusion>
      )}

      {analysis.status === 'unbounded' && (
        <PhaseConclusion title="5. Kết luận Pha 2" tone="amber">
          {analysis.reason}
        </PhaseConclusion>
      )}
    </div>
  );
}
