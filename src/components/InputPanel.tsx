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
  examples?: LPExample[];
  selectedExampleId?: string;
  onExampleSelect?: (id: string) => void;
}

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-100 dark:focus:ring-indigo-950';
const compactInputClass = 'w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-100 dark:focus:ring-indigo-950';
const labelClass = 'text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400';

function methodLabel(method: string): string {
  if (method === 'geometric') return 'Hình học';
  if (method === 'simplex') return 'Simplex';
  if (method === 'bland') return 'Bland';
  if (method === 'two-phase') return 'Two-Phase';
  return method;
}

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
    <Card
      title="1. Nhập dữ liệu"
      right={
        <div className="flex shrink-0 gap-2">
          <button onClick={onSample} className="rounded-2xl bg-indigo-600 px-3 py-2 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-indigo-500">
            Ví dụ mẫu
          </button>
          <button onClick={onReset} className="rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-black transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:text-rose-300">
            Reset
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {examples.length > 0 && (
          <section className="rounded-3xl border border-indigo-200 bg-indigo-50/80 p-4 dark:border-indigo-900/80 dark:bg-indigo-950/25">
            <label className="space-y-2">
              <span className={labelClass}>Thư viện bài mẫu</span>
              <select className={inputClass} value={selectedExampleId} onChange={(e) => onExampleSelect?.(e.target.value)}>
                <option value="">Chọn bài mẫu để tự điền dữ liệu...</option>
                {examples.map((example) => (
                  <option key={example.id} value={example.id}>
                    [{example.category}] {example.title}
                  </option>
                ))}
              </select>
            </label>

            {selectedExample && (
              <div className="mt-3 rounded-2xl border border-white/70 bg-white/80 p-3 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-black text-slate-950 dark:text-white">{selectedExample.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{selectedExample.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 font-black text-indigo-700 ring-1 ring-indigo-400/30 dark:text-indigo-200">
                      {methodLabel(selectedExample.method)}
                    </span>
                    <span className="rounded-full bg-slate-500/10 px-2.5 py-1 font-black text-slate-700 ring-1 ring-slate-400/20 dark:text-slate-200">
                      {selectedExample.expectedStatus}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setInputMode('table')}
              className={`rounded-2xl px-4 py-2.5 text-sm font-black transition ${
                inputMode === 'table'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-glow'
                  : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Bảng hệ số
            </button>
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className={`rounded-2xl px-4 py-2.5 text-sm font-black transition ${
                inputMode === 'text'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-glow'
                  : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Văn bản đề bài
            </button>
          </div>
        </div>

        {inputMode === 'text' ? (
          <TextInputPanel onParsed={(next) => { onChange(next); setInputMode('table'); }} />
        ) : (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="mb-4">
                <p className="font-black text-slate-950 dark:text-white">Thông tin bài toán</p>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Thiết lập loại tối ưu, số biến và số ràng buộc.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="rounded-2xl border border-slate-200 bg-white/75 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Loại bài toán</span>
                  <select className={inputClass} value={input.optimization} onChange={(e) => onChange({ ...input, optimization: e.target.value as LPInput['optimization'] })}>
                    <option value="min">Min</option>
                    <option value="max">Max</option>
                  </select>
                </label>
                <label className="rounded-2xl border border-slate-200 bg-white/75 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Số biến</span>
                  <input className={inputClass} type="number" min={1} value={input.n} onChange={(e) => resize(Math.max(1, Number(e.target.value)), input.m)} />
                </label>
                <label className="rounded-2xl border border-slate-200 bg-white/75 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <span className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Số ràng buộc</span>
                  <input className={inputClass} type="number" min={1} value={input.m} onChange={(e) => resize(input.n, Math.max(1, Number(e.target.value)))} />
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-black text-slate-950 dark:text-white">Hàm mục tiêu</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Nhập các hệ số c₁, c₂, ... của z. Có thể cuộn ngang khi số biến lớn.</p>
                </div>
                <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-black text-indigo-700 ring-1 ring-indigo-400/30 dark:text-indigo-200">
                  {input.optimization.toUpperCase()} z
                </span>
              </div>
              <div className="max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                <div className="grid min-w-max gap-3" style={{ gridTemplateColumns: `repeat(${input.n}, minmax(120px, 140px))` }}>
                  {input.c.map((v, j) => (
                    <label key={j} className="space-y-1">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">c{j + 1}</span>
                      <input className={compactInputClass} type="number" value={v} onChange={(e) => setC(j, Number(e.target.value))} placeholder={`c${j + 1}`} />
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="mb-3">
                <p className="font-black text-slate-950 dark:text-white">Ma trận ràng buộc</p>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Mỗi dòng là một ràng buộc dạng a₁x₁ + ... + aₙxₙ ≤/≥/= b.</p>
              </div>
              <div className="max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                <div className="min-w-[720px] space-y-2">
                  {input.A.map((row, i) => (
                    <div key={i} className="grid items-center gap-2 rounded-2xl bg-slate-50 p-2 dark:bg-slate-900/70" style={{ gridTemplateColumns: `64px repeat(${input.n}, minmax(72px, 1fr)) 86px minmax(88px, 1fr)` }}>
                      <span className="rounded-xl bg-indigo-500/10 px-3 py-2 text-center text-sm font-black text-indigo-700 dark:text-indigo-200">R{i + 1}</span>
                      {row.map((v, j) => (
                        <input key={j} className={compactInputClass} type="number" value={v} onChange={(e) => setA(i, j, Number(e.target.value))} aria-label={`A ${i + 1} ${j + 1}`} />
                      ))}
                      <select className={compactInputClass} value={input.signs[i]} onChange={(e) => setSign(i, e.target.value as ConstraintSign)}>
                        <option value="<=">≤</option>
                        <option value=">=">≥</option>
                        <option value="=">=</option>
                      </select>
                      <input className={compactInputClass} type="number" value={input.b[i]} onChange={(e) => setB(i, Number(e.target.value))} aria-label={`b ${i + 1}`} />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="mb-3">
                <p className="font-black text-slate-950 dark:text-white">Loại biến</p>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Chọn điều kiện dấu cho từng biến quyết định.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {input.variableTypes.map((type, j) => (
                  <label key={j} className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                    <span className="mb-2 block text-sm font-black text-slate-900 dark:text-slate-100">x{j + 1}</span>
                    <select className={compactInputClass} value={type} onChange={(e) => setVar(j, e.target.value as VariableType)}>
                      <option value="nonnegative">x ≥ 0</option>
                      <option value="nonpositive">x ≤ 0</option>
                      <option value="free">x tự do</option>
                    </select>
                  </label>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </Card>
  );
}
