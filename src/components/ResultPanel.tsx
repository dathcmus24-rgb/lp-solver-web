import { Fragment } from 'react';
import type { SimplexResult } from '../lib/types';
import { displaySolverText, displaySolverVar, fmt, formatVarNameHtml } from '../lib/format';
import { buildResultSummary } from '../lib/solutionSummary';
import { Card } from './Card';
import { TableauView } from './TableauView';
import { TwoPhaseDictionaryView } from './TwoPhaseDictionaryView';

export function ResultPanel({ result, visibleStep, setVisibleStep }: { result: SimplexResult | null; visibleStep: number; setVisibleStep: (n: number) => void }) {
  if (!result) {
    return <Card title="3. Kết quả"><div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">Nhập bài toán và bấm “Chạy toàn bộ” để xem dạng chuẩn, tableau và từng bước giải.</div></Card>;
  }

  const maxStep = Math.max(0, result.steps.length - 1);
  const shown = result.steps.slice(0, visibleStep + 1);

  return (
    <Card title="3. Kết quả giải chi tiết">
      <ResultSummaryView result={result} />

      <div className="mt-6 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
        <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Dạng chuẩn sau biến đổi</p>
        <StandardFormView result={result} />
      </div>

      {result.method === 'two-phase' ? (
        <div className="mt-5">
          <TwoPhaseDictionaryView result={result} />
        </div>
      ) : (
        <>
          {result.steps.length > 0 && <div className="my-5 flex flex-wrap items-center gap-3"><button onClick={() => setVisibleStep(Math.max(0, visibleStep - 1))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700">Bước trước</button><button onClick={() => setVisibleStep(Math.min(maxStep, visibleStep + 1))} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Bước sau</button><input type="range" min={0} max={maxStep} value={visibleStep} onChange={(e) => setVisibleStep(Number(e.target.value))} className="min-w-[180px] flex-1 accent-indigo-600" /><span className="text-sm text-slate-500">{visibleStep + 1}/{result.steps.length}</span></div>}

          <div className="space-y-5">
            {shown.map((step, idx) => (
              <article key={`${step.phase}-${idx}`} className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="font-bold text-slate-900 dark:text-slate-100">{step.phase} — Iteration {step.iteration}</h3><p className="text-sm text-slate-500">{displaySolverText(step.note ?? '')}</p></div>
                  <div className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">z = {fmt(step.objectiveValue)}</div>
                </div>
                <div className="mb-3 grid gap-3 md:grid-cols-5">
                  <Info label="Biến vào" value={step.entering == null ? '—' : displaySolverVar(step.variableNames[step.entering] ?? `x${step.entering + 1}`)} />
                  <Info label="Biến ra" value={step.leavingVariable == null ? '—' : displaySolverVar(step.variableNames[step.leavingVariable] ?? `x${step.leavingVariable + 1}`)} />
                  <Info label="Reduced cost" value={step.reducedCost == null ? '—' : fmt(step.reducedCost)} />
                  <Info label="Pivot" value={step.pivot == null ? '—' : fmt(step.pivot.value)} />
                  <Info label="Basis" value={step.basis.map((b) => displaySolverVar(step.variableNames[b] ?? `x${b + 1}`)).join(', ')} />
                </div>
                {step.ratioTest.length > 0 && <div className="mb-3 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-950"><span className="font-semibold">Ratio test: </span>{step.ratioTest.map((r) => `${displaySolverVar(step.variableNames[r.basis] ?? `x${r.basis + 1}`)}: ${r.value == null ? '—' : fmt(r.value)}`).join(' | ')}</div>}
                <TableauView step={step} />
              </article>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function ResultSummaryView({ result }: { result: SimplexResult }) {
  const summary = buildResultSummary(result);

  return (
    <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-indigo-950 dark:text-indigo-100">4. Tổng kết kết quả</h3>
          <p className="mt-1 text-sm text-indigo-800 dark:text-indigo-200">Tóm tắt theo phương pháp, trạng thái, nghiệm, giá trị tối ưu và kết luận.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-indigo-700 dark:bg-slate-900 dark:text-indigo-200">{summary.statusText}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryBox title="1. Phương pháp được dùng" value={summary.methodText} />
        <SummaryBox title="2. Trạng thái bài toán" value={summary.statusText} />
        <SummaryBox title="3. Nghiệm tối ưu" value={summary.solutionText} mono />
        <SummaryBox title="4. Giá trị hàm mục tiêu" value={summary.optimalValueText} large />
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 dark:bg-slate-900">
        <div className="text-xs font-black uppercase tracking-wide text-slate-500">5. Kết luận bằng lời</div>
        <p className="mt-3 text-sm leading-6 text-slate-800 dark:text-slate-100">{summary.conclusion}</p>
        {summary.optimalSegment && (
          <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100">
            Miền nghiệm tối ưu: đoạn thẳng AB với A = ({fmt(summary.optimalSegment.a.x)}, {fmt(summary.optimalSegment.a.y)}) và B = ({fmt(summary.optimalSegment.b.x)}, {fmt(summary.optimalSegment.b.y)}).
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryBox({ title, value, mono, large }: { title: string; value: string; mono?: boolean; large?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">{title}</div>
      <div className={`mt-2 break-words ${mono ? 'font-mono text-sm' : ''} ${large ? 'text-2xl font-black' : 'font-bold'}`}>{value}</div>
    </div>
  );
}

function signText(sign: string): string {
  if (sign === '<=') return '≤';
  if (sign === '>=') return '≥';
  return '=';
}

function linearText(coeffs: number[], names: string[]): string {
  const parts: string[] = [];

  coeffs.forEach((coef, i) => {
    const value = Number(coef);
    if (Math.abs(value) < 1e-9) return;

    const abs = Math.abs(value);
    const coefText = Math.abs(abs - 1) < 1e-9 ? '' : fmt(abs);
    const term = `${coefText}${names[i] ?? `x${i + 1}`}`;

    if (parts.length === 0) {
      parts.push(value < 0 ? `-${term}` : term);
    } else {
      parts.push(value < 0 ? `− ${term}` : `+ ${term}`);
    }
  });

  return parts.length > 0 ? parts.join(' ') : '0';
}

function StandardFormView({ result }: { result: SimplexResult }) {
  const variableNames = result.standard.mappings.map((mapping) => formatVarNameHtml(mapping.label));
  const objective = linearText(result.standard.c, variableNames);
  const constraints = result.standard.constraints;

  return (
    <div className="overflow-x-auto rounded-xl bg-white/50 p-4 font-serif text-lg leading-9 text-slate-900 dark:bg-slate-900/50 dark:text-slate-100">
      <div className="grid min-w-max grid-cols-[auto_auto_1fr] gap-x-4">
        <div className="text-right italic">min</div>
        <div />
        <div>{objective}</div>

        {constraints.map((row, index) => (
          <Fragment key={row.label ?? index}>
            <div className="text-right italic">{index === 0 ? 's.t.' : ''}</div>
            <div />
            <div>{linearText(row.a, variableNames)} <span className="px-2">{signText(row.sign)}</span> {fmt(row.b)}</div>
          </Fragment>
        ))}

        <div />
        <div />
        <div>{variableNames.join(', ')} <span className="px-2">≥</span> 0</div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 truncate font-semibold">{value}</div></div>;
}
