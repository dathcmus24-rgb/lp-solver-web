import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, Sigma } from 'lucide-react';
import type { LPInput, SimplexResult, SolveMethod } from './lib/types';
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
import { MethodWarningCard } from './components/MethodWarningCard';

export default function App() {
  const [dark, setDark] = useState(true);
  const [input, setInput] = useState<LPInput>(sampleProblem);
  const [method, setMethod] = useState<SolveMethod>('simplex');
  const [selectedExampleId, setSelectedExampleId] = useState('simplex-basic-positive-b');
  const [result, setResult] = useState<SimplexResult | null>(null);
  const [blockedRunGuidance, setBlockedRunGuidance] = useState<MethodGuidance | null>(null);
  const [visibleStep, setVisibleStep] = useState(0);
  const [stepMode, setStepMode] = useState(false);
  const [speed, setSpeed] = useState(500);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const methodGuidance = useMemo(() => analyzeMethod(input, method), [input, method]);
  const geometry = useMemo(() => (method === 'geometric' ? solveGeometric(input) : null), [input, method]);

  useEffect(() => {
    setBlockedRunGuidance(null);
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
    setBlockedRunGuidance(null);
    setVisibleStep(0);
  };

  const run = () => {
    const guidance = analyzeMethod(input, method);

    if (!guidance.canRun) {
      setBlockedRunGuidance(guidance);
      setResult(null);
      setVisibleStep(0);
      return;
    }

    const next = solveLP(input, method);
    setBlockedRunGuidance(null);
    setResult(next);
    setVisibleStep(stepMode ? 0 : Math.max(0, next.steps.length - 1));
  };

  useEffect(() => {
    if (!stepMode || !result || visibleStep >= result.steps.length - 1) return;
    const id = window.setTimeout(() => setVisibleStep((s) => Math.min(s + 1, result.steps.length - 1)), speed);
    return () => window.clearTimeout(id);
  }, [stepMode, result, visibleStep, speed]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-white px-4 py-6 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950 dark:text-slate-100 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/50 bg-white/70 p-5 shadow-glow backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-600 text-white shadow-glow"><Sigma /></div>
            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">Linear Programming Solver</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Simplex • Bland Rule • Two-Phase • Geometric visualization</p>
            </div>
          </div>
          <button onClick={() => setDark((v) => !v)} className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold dark:border-slate-700">{dark ? <Sun size={18} /> : <Moon size={18} />} {dark ? 'Light' : 'Dark'} mode</button>
        </motion.header>

        <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
          <div className="space-y-6">
            <InputPanel input={input} onChange={(next) => { setInput(next); setSelectedExampleId(""); }} examples={lpExamples} selectedExampleId={selectedExampleId} onExampleSelect={loadExample} onSample={() => loadExample("simplex-basic-positive-b")} onReset={() => { setInput(createEmptyLP(2, 2)); setSelectedExampleId(""); setResult(null); }} />
            <MethodPanel input={input} method={method} setMethod={setMethod} onSolve={run} stepMode={stepMode} setStepMode={setStepMode} speed={speed} setSpeed={setSpeed} />
          </div>
          <div className="space-y-6">
            {blockedRunGuidance && <MethodWarningCard guidance={blockedRunGuidance} onSwitchMethod={setMethod} blocked />}
            {method === 'geometric' && methodGuidance.canRun && <GeometryGraph result={geometry} input={input} />}
            <ResultPanel result={result} visibleStep={visibleStep} setVisibleStep={setVisibleStep} />
          </div>
        </div>
      </div>
    </main>
  );
}
