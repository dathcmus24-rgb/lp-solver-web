import { useState } from 'react';
import type { LPInput, ConstraintSign, VariableType } from '../lib/types';
import type { LPExample } from '../lib/examples';
import { createEmptyLP } from '../lib/standardize';
import { Card } from './Card';
import { TextInputPanel } from './TextInputPanel';

interface Props {
  input: LPInput;
  onChange: (input: LPInput) => void;
  onSample: () => void;
  onReset: () => void;
  examples?: Array<{ id: string; title: string; category?: string; method?: string; expectedStatus?: string; description?: string }>;
  selectedExampleId?: string;
  onExampleSelect?: (id: string) => void;
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-indigo-950';
const labelClass = 'text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400';

export function InputPanel({ input, onChange, onSample, onReset, examples = [], selectedExampleId = '', onExampleSelect }: Props) {
  const selectedExample = examples.find((example) => example.id === selectedExampleId);
  const [inputMode, setInputMode] = useState<'table' | 'text'>('table');
const resize = (n: number, m: number) => {
    const next = createEmptyLP(n, m);
    next.optimization = input.optimization;
    next.c = Array.from({ length: n }, (_, i) => input.c[i] ?? 0);
    next.A = Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => input.A[i]?.[j] ?? 0));
    next.signs = Array.from({ length: m }, (_, i) => input.signs[i] ?? '<=');
    next.b = Array.from({ length: m }, (_, i) => input.b[i] ?? 0);
    next.variableTypes = Array.from({ length: n }, (_, i) => input.variableTypes[i] ?? 'nonnegative');
    onChange(next);
  };

  const setC = (j: number, value: number) => onChange({ ...input, c: input.c.map((x, i) => (i === j ? value : x)) });
  const setA = (i: number, j: number, value: number) => onChange({ ...input, A: input.A.map((row, r) => (r === i ? row.map((x, c) => (c === j ? value : x)) : row)) });
  const setB = (i: number, value: number) => onChange({ ...input, b: input.b.map((x, r) => (r === i ? value : x)) });
  const setSign = (i: number, value: ConstraintSign) => onChange({ ...input, signs: input.signs.map((x, r) => (r === i ? value : x)) });
  const setVar = (j: number, value: VariableType) => onChange({ ...input, variableTypes: input.variableTypes.map((x, i) => (i === j ? value : x)) });

  return (
    <Card title="1. Nhập dữ liệu" right={<div className="flex gap-2"><button onClick={onSample} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-glow hover:bg-indigo-500">Ví dụ mẫu</button><button onClick={onReset} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700">Reset</button></div>}>
      {examples.length > 0 && (
        <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
          <label className="space-y-2">
            <span className={labelClass}>Thư viện bài mẫu</span>
            <select className={inputClass} value={selectedExampleId} onChange={(e) => onExampleSelect?.(e.target.value)}>
              <option value="">Chọn bài mẫu để tự điền dữ liệu...</option>
              {examples.map((example) => (
                <option key={example.id} value={example.id}>
                  [{example.category ?? 'Example'}] {example.title}
                </option>
              ))}
            </select>
          </label>

          {selectedExample && (
            <div className="mt-3 rounded-xl bg-white/70 p-3 text-sm text-slate-700 dark:bg-slate-950/50 dark:text-slate-200">
              <div className="font-bold">{selectedExample.title}</div>
              {selectedExample.description && <p className="mt-1">{selectedExample.description}</p>}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {selectedExample.method && <span className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100">Phương pháp: {selectedExample.method}</span>}
                {selectedExample.expectedStatus && <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Kỳ vọng: {selectedExample.expectedStatus}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
        <button
          type="button"
          onClick={() => setInputMode('table')}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${inputMode === 'table' ? 'bg-indigo-600 text-white shadow-glow' : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}`}
        >
          Bảng hệ số
        </button>
        <button
          type="button"
          onClick={() => setInputMode('text')}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${inputMode === 'text' ? 'bg-indigo-600 text-white shadow-glow' : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}`}
        >
          Văn bản đề bài
        </button>
      </div>

      {inputMode === 'text' ? (
        <TextInputPanel onParsed={(next) => { onChange(next); setInputMode('table'); }} />
      ) : (
        <>

      {examples.length > 0 && (
        <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
          <label className="space-y-2">
            <span className={labelClass}>Thư viện bài mẫu</span>
            <select
              className={inputClass}
              value={selectedExampleId}
              onChange={(e) => onExampleSelect?.(e.target.value)}
            >
              <option value="">Chọn bài mẫu để tự điền dữ liệu...</option>
              {examples.map((example) => (
                <option key={example.id} value={example.id}>
                  [{example.category}] {example.title}
                </option>
              ))}
            </select>
          </label>

          {selectedExample && (
            <div className="mt-3 rounded-xl bg-white/70 p-3 text-sm text-slate-700 dark:bg-slate-950/50 dark:text-slate-200">
              <div className="font-bold">{selectedExample.title}</div>
              <p className="mt-1">{selectedExample.description}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100">Phương pháp: {selectedExample.method}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Kỳ vọng: {selectedExample.expectedStatus}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1"><span className={labelClass}>Loại bài toán</span><select className={inputClass} value={input.optimization} onChange={(e) => onChange({ ...input, optimization: e.target.value as LPInput['optimization'] })}><option value="min">Min</option><option value="max">Max</option></select></label>
        <label className="space-y-1"><span className={labelClass}>Số biến n</span><input className={inputClass} type="number" min={1} value={input.n} onChange={(e) => resize(Math.max(1, Number(e.target.value)), input.m)} /></label>
        <label className="space-y-1"><span className={labelClass}>Số ràng buộc m</span><input className={inputClass} type="number" min={1} value={input.m} onChange={(e) => resize(input.n, Math.max(1, Number(e.target.value)))} /></label>
      </div>

      <div className="mt-6">
        <p className={labelClass}>Hàm mục tiêu</p>
        <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${input.n}, minmax(80px, 1fr))` }}>
          {input.c.map((v, j) => <input key={j} className={inputClass} type="number" value={v} onChange={(e) => setC(j, Number(e.target.value))} placeholder={`c${j + 1}`} />)}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <p className={labelClass}>Ma trận ràng buộc A, dấu, vector b</p>
        <div className="mt-2 min-w-[680px] space-y-2">
          {input.A.map((row, i) => (
            <div key={i} className="grid items-center gap-2" style={{ gridTemplateColumns: `70px repeat(${input.n}, minmax(70px, 1fr)) 90px minmax(90px, 1fr)` }}>
              <span className="text-sm font-semibold text-slate-500">R{i + 1}</span>
              {row.map((v, j) => <input key={j} className={inputClass} type="number" value={v} onChange={(e) => setA(i, j, Number(e.target.value))} />)}
              <select className={inputClass} value={input.signs[i]} onChange={(e) => setSign(i, e.target.value as ConstraintSign)}><option value="<=">≤</option><option value=">=">≥</option><option value="=">=</option></select>
              <input className={inputClass} type="number" value={input.b[i]} onChange={(e) => setB(i, Number(e.target.value))} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className={labelClass}>Loại biến</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {input.variableTypes.map((type, j) => (
            <label key={j} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
              <span className="mb-2 block text-sm font-semibold">x{j + 1}</span>
              <select className={inputClass} value={type} onChange={(e) => setVar(j, e.target.value as VariableType)}><option value="nonnegative">x ≥ 0</option><option value="nonpositive">x ≤ 0</option><option value="free">x tự do</option></select>
            </label>
          ))}
        </div>
      </div>
        </>
      )}
    </Card>
  );
}
