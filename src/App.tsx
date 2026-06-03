import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, Sigma } from 'lucide-react';
import type { GeometryResult, LPInput, SimplexResult, SolveMethod } from './lib/types';
import type { MethodGuidance } from './lib/methodGuidance';
import { createEmptyLP, sampleProblem } from './lib/standardize';
import { cloneExampleInput, lpExamples } from './lib/examples';
import { analyzeMethod } from './lib/methodGuidance';
import { solveLP } from './lib/simplex';
import { solveGeometric } from './lib/geometry';
import { InputPanel } from './components/InputPanel';
import { MethodPanel } from './components/MethodPanel';
import { ResultPanel } from './components/ResultPanel';
import { GeometryGraph } from './components/GeometryGraph';
import { GeometryResultPanel } from './components/GeometryResultPanel';
import { MethodWarningCard } from './components/MethodWarningCard';

const methodLabels: Record<SolveMethod, string> = {
  geometric: 'Hình học',
  simplex: 'Simplex',
  bland: 'Bland',
  'two-phase': 'Two-Phase',
};

export default function App() {
  const [dark, setDark] = useState(true);
  const [input, setInput] = useState<LPInput>(sampleProblem);
  const [method, setMethod] = useState<SolveMethod>('simplex');
  const [selectedExampleId, setSelectedExampleId] = useState('simplex-basic-positive-b');
  const [result, setResult] = useState<SimplexResult | null>(null);
  const [geometryResult, setGeometryResult] = useState<GeometryResult | null>(null);
  const [blockedRunGuidance, setBlockedRunGuidance] = useState<MethodGuidance | null>(null);
  const [visibleStep, setVisibleStep] = useState(0);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const methodGuidance = useMemo(() => analyzeMethod(input, method), [input, method]);

  useEffect(() => {
    setBlockedRunGuidance(null);
    setResult(null);
    setGeometryResult(null);
    setVisibleStep(0);
  }, [input, method]);

  const loadExample = (id: string) => {
    const example = lpExamples.find((item) => item.id === id);
    if (!example) {
      setSelectedExampleId('');
      return;
    }

    setSelectedExampleId(id);
    setInput(cloneExampleInput(example));
    setMethod(example.method);
    setResult(null);
    setGeometryResult(null);
    setBlockedRunGuidance(null);
    setVisibleStep(0);
  };

  const run = () => {
    const guidance = analyzeMethod(input, method);

    if (!guidance.canRun) {
      setBlockedRunGuidance(guidance);
      setResult(null);
      setGeometryResult(null);
      setVisibleStep(0);
      return;
    }

    setBlockedRunGuidance(null);

    if (method === 'geometric') {
      const nextGeometry = solveGeometric(input);
      setGeometryResult(nextGeometry);
      setResult(null);
      setVisibleStep(0);
      return;
    }

    const next = solveLP(input, method);
    setGeometryResult(null);
    setResult(next);
    setVisibleStep(Math.max(0, next.steps.length - 1));
  };

  const solved = method === 'geometric' ? Boolean(geometryResult) : Boolean(result);
  const statusText = solved ? 'Đã có kết quả' : blockedRunGuidance ? 'Cần kiểm tra' : 'Sẵn sàng';
  const statusClass = solved
    ? 'bg-emerald-500/15 text-emerald-700 ring-emerald-400/30 dark:text-emerald-200'
    : blockedRunGuidance
      ? 'bg-rose-500/15 text-rose-700 ring-rose-400/30 dark:text-rose-200'
      : methodGuidance.canRun
        ? 'bg-indigo-500/15 text-indigo-700 ring-indigo-400/30 dark:text-indigo-200'
        : 'bg-amber-500/15 text-amber-700 ring-amber-400/30 dark:text-amber-100';

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-100 px-4 py-6 text-slate-900 dark:bg-[#07111f] dark:text-slate-100 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-12rem] h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute right-[-8rem] top-24 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-[1500px]">
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 overflow-hidden rounded-[2rem] border border-white/60 bg-white/80 p-5 shadow-glow backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/70"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-700 text-white shadow-glow">
                <Sigma size={28} />
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-black uppercase tracking-[0.10em] text-indigo-700 ring-1 ring-indigo-400/30 dark:text-indigo-200">
                    QHTT Project
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClass}`}>{statusText}</span>
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white md:text-3xl">Linear Programming Solver</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Giải bài toán quy hoạch tuyến tính bằng Simplex, Bland, Two-Phase và hình học.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/70">
                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Phương pháp hiện tại</div>
                <div className="mt-1 font-black text-slate-900 dark:text-slate-100">{methodLabels[method]}</div>
              </div>
              <button
                onClick={() => setDark((v) => !v)}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-bold transition hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:text-indigo-200"
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
                {dark ? 'Light' : 'Dark'} mode
              </button>
            </div>
          </div>
        </motion.header>

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardMetric label="Số biến" value={String(input.n)} helper="Biến quyết định" />
          <DashboardMetric label="Số ràng buộc" value={String(input.m)} helper="Điều kiện bài toán" />
          <DashboardMetric label="Kiểu bài toán" value={input.optimization.toUpperCase()} helper="Hàm mục tiêu ban đầu" />
          <DashboardMetric label="Trạng thái phương pháp" value={methodGuidance.canRun ? 'Phù hợp' : 'Cảnh báo'} helper={methodGuidance.canRun ? 'Có thể chạy' : 'Cần xem gợi ý'} tone={methodGuidance.canRun ? 'ok' : 'warn'} />
        </section>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(360px,460px)_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-6 xl:sticky xl:top-6 xl:self-start">
            <InputPanel
              input={input}
              onChange={(next) => {
                setInput(next);
                setSelectedExampleId('');
              }}
              examples={lpExamples}
              selectedExampleId={selectedExampleId}
              onExampleSelect={loadExample}
              onSample={() => loadExample('simplex-basic-positive-b')}
              onReset={() => {
                setInput(createEmptyLP(2, 2));
                setSelectedExampleId('');
                setResult(null);
                setGeometryResult(null);
                setBlockedRunGuidance(null);
                setVisibleStep(0);
              }}
            />
            <MethodPanel input={input} method={method} setMethod={setMethod} onSolve={run} />
          </aside>

          <section className="min-w-0 space-y-6">
            {blockedRunGuidance && <MethodWarningCard guidance={blockedRunGuidance} onSwitchMethod={setMethod} blocked />}
            {method === 'geometric' ? (
              <GeometryResultPanel result={geometryResult} input={input} />
            ) : (
              <ResultPanel result={result} visibleStep={visibleStep} setVisibleStep={setVisibleStep} />
            )}
            {method === 'geometric' && geometryResult && <GeometryGraph result={geometryResult} input={input} />}
          </section>
        </div>
      </div>
    </main>
  );
}

function DashboardMetric({ label, value, helper, tone = 'default' }: { label: string; value: string; helper: string; tone?: 'default' | 'ok' | 'warn' }) {
  const toneClass =
    tone === 'ok'
      ? 'text-emerald-700 dark:text-emerald-200'
      : tone === 'warn'
        ? 'text-amber-700 dark:text-amber-100'
        : 'text-indigo-700 dark:text-indigo-200';

  return (
    <div className="rounded-3xl border border-white/60 bg-white/75 p-4 shadow-sm backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/60">
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-black tracking-tight ${toneClass}`}>{value}</div>
      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{helper}</div>
    </div>
  );
}
