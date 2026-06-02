import type { LPInput, SolveMethod } from '../lib/types';
import { analyzeMethod } from '../lib/methodGuidance';
import { Card } from './Card';
import { MethodWarningCard } from './MethodWarningCard';

const methods: Array<{ id: SolveMethod; title: string; desc: string }> = [
  { id: 'geometric', title: 'Hình học', desc: 'Vẽ miền nghiệm cho bài toán 2 biến.' },
  { id: 'simplex', title: 'Simplex', desc: 'Giải trực tiếp khi dạng chuẩn có bᵢ ≥ 0.' },
  { id: 'bland', title: 'Bland Rule', desc: 'Giải trực tiếp và chống cycling khi có suy biến.' },
  { id: 'two-phase', title: 'Two-Phase', desc: 'Dùng khi sau chuẩn hóa có bᵢ < 0.' },
];

export function MethodPanel({ input, method, setMethod, onSolve, stepMode, setStepMode, speed, setSpeed }: {
  input: LPInput;
  method: SolveMethod;
  setMethod: (m: SolveMethod) => void;
  onSolve: () => void;
  stepMode: boolean;
  setStepMode: (v: boolean) => void;
  speed: number;
  setSpeed: (v: number) => void;
}) {
  const guidance = analyzeMethod(input, method);

  return (
    <Card title="2. Chọn phương pháp">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {methods.map((m) => (
          <button key={m.id} onClick={() => setMethod(m.id)} className={`rounded-2xl border p-4 text-left transition ${method === m.id ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-glow dark:bg-indigo-950/50 dark:text-indigo-100' : 'border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-950'}`}>
            <div className="font-semibold">{m.title}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{m.desc}</div>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <MethodWarningCard guidance={guidance} onSwitchMethod={setMethod} compact={guidance.severity === 'ok'} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
          <input type="checkbox" checked={stepMode} onChange={(e) => setStepMode(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
          <span className="text-sm font-medium">Giải từng bước</span>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Tốc độ animation: {speed} ms</span>
          <input type="range" min={150} max={1800} step={50} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full accent-indigo-600" />
        </label>
        <button
          onClick={onSolve}
          className={`rounded-2xl px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 ${guidance.canRun ? 'bg-slate-950 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500' : 'bg-rose-600 hover:bg-rose-500'}`}
        >
          {guidance.canRun ? 'Chạy toàn bộ' : 'Kiểm tra cảnh báo'}
        </button>
      </div>
    </Card>
  );
}
