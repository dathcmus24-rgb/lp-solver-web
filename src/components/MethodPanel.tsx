import { CheckCircle2, Compass, Layers3, Play, RotateCcw, ShieldCheck, Sigma } from 'lucide-react';
import type { LPInput, SolveMethod } from '../lib/types';
import { analyzeMethod } from '../lib/methodGuidance';
import { Card } from './Card';
import { MethodWarningCard } from './MethodWarningCard';

const methods: Array<{
  id: SolveMethod;
  title: string;
  tag: string;
  desc: string;
  icon: typeof Sigma;
}> = [
  {
    id: 'simplex',
    title: 'Simplex',
    tag: 'Direct',
    desc: 'Giải trực tiếp khi bài toán đã có cơ sở khả thi sau chuẩn hóa.',
    icon: Sigma,
  },
  {
    id: 'bland',
    title: 'Bland Rule',
    tag: 'Anti-cycling',
    desc: 'Dùng quy tắc Bland để giảm nguy cơ xoay vòng khi bài toán suy biến.',
    icon: ShieldCheck,
  },
  {
    id: 'two-phase',
    title: 'Two-Phase',
    tag: 'x₀ / Phase 1',
    desc: 'Tìm cơ sở khả thi bằng Pha 1 rồi khôi phục hàm mục tiêu ở Pha 2.',
    icon: Layers3,
  },
  {
    id: 'geometric',
    title: 'Hình học',
    tag: '2D',
    desc: 'Minh họa miền nghiệm và điểm tối ưu cho bài toán có đúng 2 biến.',
    icon: Compass,
  },
];

const methodActionText: Record<SolveMethod, string> = {
  simplex: 'Hệ thống sẽ giải trực tiếp bằng tableau đơn hình và hiển thị từng bước xoay.',
  bland: 'Hệ thống sẽ dùng quy tắc Bland để chọn biến vào/ra theo hướng ổn định hơn.',
  'two-phase': 'Hệ thống sẽ lập Pha 1 để kiểm tra khả thi, sau đó chuyển sang Pha 2 nếu hợp lệ.',
  geometric: 'Hệ thống sẽ dựng miền nghiệm khả thi và xác định nghiệm tối ưu trên đồ thị.',
};

function methodLabel(method: SolveMethod): string {
  if (method === 'geometric') return 'Hình học';
  if (method === 'simplex') return 'Simplex';
  if (method === 'bland') return 'Bland Rule';
  return 'Two-Phase';
}

export function MethodPanel({
  input,
  method,
  setMethod,
  onSolve,
}: {
  input: LPInput;
  method: SolveMethod;
  setMethod: (m: SolveMethod) => void;
  onSolve: () => void;
}) {
  const guidance = analyzeMethod(input, method);
  const selectedMethod = methods.find((item) => item.id === method) ?? methods[0];

  return (
    <Card
      title="2. Chọn phương pháp"
      right={
        <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-black text-indigo-700 ring-1 ring-indigo-400/30 dark:text-indigo-200">
          {methodLabel(method)}
        </span>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {methods.map((item) => {
            const Icon = item.icon;
            const selected = method === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMethod(item.id)}
                className={[
                  'group relative overflow-hidden rounded-3xl border p-4 text-left transition',
                  selected
                    ? 'border-indigo-400 bg-indigo-50/90 text-indigo-950 shadow-glow dark:border-indigo-500/70 dark:bg-indigo-950/50 dark:text-indigo-50'
                    : 'border-slate-200 bg-white/80 text-slate-900 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={[
                      'grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition',
                      selected
                        ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700 dark:bg-slate-900 dark:text-slate-300 dark:group-hover:bg-indigo-950 dark:group-hover:text-indigo-200',
                    ].join(' ')}
                  >
                    <Icon size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-black leading-tight">{item.title}</div>
                        <div
                          className={[
                            'mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-black',
                            selected
                              ? 'bg-white/70 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-100'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400',
                          ].join(' ')}
                        >
                          {item.tag}
                        </div>
                      </div>
                      {selected && <CheckCircle2 className="shrink-0 text-indigo-600 dark:text-indigo-200" size={18} />}
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <MethodWarningCard guidance={guidance} onSwitchMethod={setMethod} compact={guidance.severity === 'ok'} />

        <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Sẵn sàng giải</div>
              <div className="mt-1 font-black text-slate-950 dark:text-white">{selectedMethod.title}</div>
            </div>
            <span
              className={[
                'rounded-full px-3 py-1 text-xs font-black ring-1',
                guidance.canRun
                  ? 'bg-emerald-500/15 text-emerald-700 ring-emerald-400/30 dark:text-emerald-200'
                  : 'bg-rose-500/15 text-rose-700 ring-rose-400/30 dark:text-rose-200',
              ].join(' ')}
            >
              {guidance.canRun ? 'Có thể chạy' : 'Cần kiểm tra'}
            </span>
          </div>

          <button
            type="button"
            onClick={onSolve}
            className={[
              'flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black tracking-tight text-white shadow-glow transition hover:-translate-y-0.5',
              guidance.canRun
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500'
                : 'bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500',
            ].join(' ')}
          >
            {guidance.canRun ? <Play size={18} /> : <RotateCcw size={18} />}
            {guidance.canRun ? 'Giải bài toán' : 'Kiểm tra cảnh báo trước khi giải'}
          </button>

          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {guidance.canRun ? methodActionText[method] : 'Phương pháp hiện tại chưa phù hợp. Xem cảnh báo phía trên hoặc chuyển sang phương pháp được đề xuất.'}
          </p>
        </section>
      </div>
    </Card>
  );
}
