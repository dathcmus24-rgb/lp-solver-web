import type { GeometryResult, LPInput } from '../lib/types';
import { fmt } from '../lib/format';
import { Card } from './Card';

type OptionalSegment = {
  optimalSegment?: {
    a: { x: number; y: number; value: number };
    b: { x: number; y: number; value: number };
  };
};

type GeometryTone = {
  banner: string;
  badge: string;
  border: string;
};

function methodName() {
  return 'Phương pháp hình học';
}

function statusLabel(status: GeometryResult['status']): string {
  if (status === 'optimal') return 'Tối ưu';
  if (status === 'infeasible') return 'Vô nghiệm';
  if (status === 'unbounded') return 'Không giới nội';
  if (status === 'error') return 'Lỗi';
  if (status === 'iteration-limit') return 'Vượt giới hạn';
  return 'Chưa chạy';
}

function getTone(result: GeometryResult | null): GeometryTone {
  if (!result) {
    return {
      banner: 'border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100',
      badge: 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-950',
      border: 'border-slate-300 dark:border-slate-800',
    };
  }

  const segment = (result as GeometryResult & OptionalSegment).optimalSegment;

  if (result.status === 'optimal' && segment) {
    return {
      banner: 'border-indigo-300 bg-indigo-50 text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100',
      badge: 'bg-indigo-600 text-white',
      border: 'border-indigo-300 dark:border-indigo-900',
    };
  }

  if (result.status === 'optimal') {
    return {
      banner: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
      badge: 'bg-emerald-600 text-white',
      border: 'border-emerald-300 dark:border-emerald-900',
    };
  }

  if (result.status === 'infeasible') {
    return {
      banner: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100',
      badge: 'bg-rose-600 text-white',
      border: 'border-rose-300 dark:border-rose-900',
    };
  }

  if (result.status === 'unbounded') {
    return {
      banner: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
      badge: 'bg-amber-500 text-slate-950',
      border: 'border-amber-300 dark:border-amber-900',
    };
  }

  return {
    banner: 'border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100',
    badge: 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-950',
    border: 'border-slate-300 dark:border-slate-800',
  };
}

function objectiveText(input: LPInput, result: GeometryResult | null): string {
  const prefix = input.optimization === 'max' ? 'max z' : 'min z';

  if (!result) return '—';

  if (result.status === 'optimal' && result.optimalPoint) {
    return `${prefix} = ${fmt(result.optimalPoint.value)}`;
  }

  if (result.status === 'infeasible') {
    return input.optimization === 'max' ? 'max z = -∞' : 'min z = +∞';
  }

  if (result.status === 'unbounded') {
    return input.optimization === 'max' ? 'max z = +∞' : 'min z = -∞';
  }

  return '—';
}

function solutionText(result: GeometryResult | null): string {
  if (!result) return '—';

  const segment = (result as GeometryResult & OptionalSegment).optimalSegment;

  if (result.status === 'optimal' && segment) {
    return `Vô số nghiệm trên đoạn AB, A = (${fmt(segment.a.x)}, ${fmt(segment.a.y)}), B = (${fmt(segment.b.x)}, ${fmt(segment.b.y)})`;
  }

  if (result.status === 'optimal' && result.optimalPoint) {
    return `x₁ = ${fmt(result.optimalPoint.x)}, x₂ = ${fmt(result.optimalPoint.y)}`;
  }

  if (result.status === 'infeasible') return 'Không có nghiệm khả thi';
  if (result.status === 'unbounded') return 'Không có nghiệm tối ưu hữu hạn';

  return '—';
}

function conclusionText(input: LPInput, result: GeometryResult | null): string {
  if (!result) {
    return 'Nhập bài toán, chọn phương pháp hình học và bấm “Giải bài toán” để xem kết quả.';
  }

  const segment = (result as GeometryResult & OptionalSegment).optimalSegment;

  if (result.status === 'optimal' && segment) {
    return `Bài toán có vô số nghiệm tối ưu trên đoạn nối A(${fmt(segment.a.x)}, ${fmt(segment.a.y)}) và B(${fmt(segment.b.x)}, ${fmt(segment.b.y)}). Mọi điểm trên đoạn AB đều là nghiệm tối ưu. Giá trị tối ưu là ${objectiveText(input, result)}.`;
  }

  if (result.status === 'optimal' && result.optimalPoint) {
    return `Bài toán có nghiệm tối ưu tại x₁ = ${fmt(result.optimalPoint.x)}, x₂ = ${fmt(result.optimalPoint.y)}. Giá trị tối ưu là ${objectiveText(input, result)}.`;
  }

  if (result.status === 'infeasible') {
    return `Miền nghiệm rỗng nên bài toán vô nghiệm. Theo quy ước kết luận, ${objectiveText(input, result)}.`;
  }

  if (result.status === 'unbounded') {
    return `Bài toán không giới nội theo hướng cải thiện hàm mục tiêu. Do đó ${objectiveText(input, result)}.`;
  }

  return result.message || 'Chưa có kết quả hình học.';
}

export function GeometryResultPanel({ result, input }: { result: GeometryResult | null; input: LPInput }) {
  const status = result ? statusLabel(result.status) : 'Chưa chạy';
  const tone = getTone(result);
  const conclusion = conclusionText(input, result);

  return (
    <Card title="3. Tổng kết kết quả">
      {!result ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center dark:border-slate-700 dark:bg-slate-950/50">
          <div className="text-lg font-black text-slate-900 dark:text-slate-100">Chưa có kết quả hình học</div>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Nhập bài toán, chọn phương pháp hình học và bấm “Giải bài toán” để xem miền nghiệm, nghiệm tối ưu và kết luận.
          </p>
        </div>
      ) : (
        <section className={`overflow-hidden rounded-3xl border p-5 ${tone.banner}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.18em] opacity-70">Tổng kết hình học</div>
              <h3 className="mt-2 text-2xl font-black tracking-tight">{status}</h3>
              <p className="mt-2 max-w-3xl break-words text-sm leading-6 opacity-90">{conclusion}</p>
            </div>
            <span className={`shrink-0 rounded-full px-4 py-2 text-sm font-black shadow-sm ${tone.badge}`}>{status}</span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryMetric title="Phương pháp" value={methodName()} />
            <SummaryMetric title="Trạng thái" value={status} />
            <SummaryMetric title="Nghiệm tối ưu" value={solutionText(result)} important />
            <SummaryMetric title="Giá trị hàm mục tiêu" value={objectiveText(input, result)} valueClassName="text-2xl font-black" />
          </div>

          <div className={`mt-4 rounded-2xl border-l-4 bg-white/65 p-4 dark:bg-black/20 ${tone.border}`}>
            <div className="text-xs font-black uppercase tracking-[0.16em] opacity-70">Kết luận bằng lời</div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{conclusion}</p>
          </div>

          {result.message && (
            <div className="mt-4 rounded-2xl border border-white/60 bg-white/50 p-4 text-sm dark:border-slate-800 dark:bg-black/20">
              <span className="font-bold">Ghi chú hệ thống: </span>{result.message}
            </div>
          )}
        </section>
      )}
    </Card>
  );
}

function SummaryMetric({ title, value, important = false, valueClassName = 'font-black' }: { title: string; value: string; important?: boolean; valueClassName?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/75 p-4 shadow-sm dark:bg-black/20">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{title}</div>
      <div className={`mt-2 whitespace-pre-wrap break-words leading-6 ${important ? 'text-sm font-black' : valueClassName}`}>{value}</div>
    </div>
  );
}
