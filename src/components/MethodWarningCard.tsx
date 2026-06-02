import type { MethodGuidance } from '../lib/methodGuidance';
import type { SolveMethod } from '../lib/types';
import { fmt } from '../lib/format';

function guidanceClasses(severity: string): string {
  if (severity === 'error') return 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100';
  if (severity === 'warning') return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  if (severity === 'info') return 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100';
  return 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100';
}

function badgeClasses(severity: string): string {
  if (severity === 'error') return 'bg-rose-600 text-white';
  if (severity === 'warning') return 'bg-amber-500 text-slate-950';
  if (severity === 'info') return 'bg-sky-600 text-white';
  return 'bg-emerald-600 text-white';
}

function severityLabel(severity: string): string {
  if (severity === 'error') return 'Không nên chạy';
  if (severity === 'warning') return 'Cảnh báo';
  if (severity === 'info') return 'Ghi chú';
  return 'Phù hợp';
}

export function MethodWarningCard({
  guidance,
  onSwitchMethod,
  compact = false,
  blocked = false,
}: {
  guidance: MethodGuidance;
  onSwitchMethod?: (method: SolveMethod) => void;
  compact?: boolean;
  blocked?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 text-sm ${guidanceClasses(guidance.severity)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-xs font-black ${badgeClasses(guidance.severity)}`}>
              {blocked ? 'Đã chặn chạy' : severityLabel(guidance.severity)}
            </span>
            <h3 className="font-black">{guidance.title}</h3>
          </div>
          <p className="mt-2">{guidance.message}</p>
        </div>

        {guidance.recommendedMethod && onSwitchMethod && (
          <button
            type="button"
            onClick={() => onSwitchMethod(guidance.recommendedMethod!)}
            className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white shadow-sm dark:bg-white dark:text-slate-950"
          >
            Chuyển sang {guidance.recommendedMethod}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs opacity-90">
        <span className="rounded-full bg-white/60 px-2 py-1 dark:bg-black/20">min bᵢ = {fmt(guidance.facts.minRhs)}</span>
        <span className="rounded-full bg-white/60 px-2 py-1 dark:bg-black/20">{guidance.facts.hasNegativeRhs ? 'Có bᵢ < 0' : 'Không có bᵢ < 0'}</span>
        <span className="rounded-full bg-white/60 px-2 py-1 dark:bg-black/20">{guidance.facts.hasZeroRhs ? 'Có bᵢ = 0' : 'Không có bᵢ = 0'}</span>
        <span className="rounded-full bg-white/60 px-2 py-1 dark:bg-black/20">Số ràng buộc chuẩn: {guidance.facts.standardizedRows}</span>
      </div>

      {!compact && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20">
            <div className="text-xs font-black uppercase tracking-wide opacity-70">Lý do</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {guidance.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
          <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20">
            <div className="text-xs font-black uppercase tracking-wide opacity-70">Nên làm</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {guidance.nextSteps.map((step) => <li key={step}>{step}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
