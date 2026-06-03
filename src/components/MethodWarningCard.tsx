import { AlertTriangle, CheckCircle2, Info, ShieldAlert, Sparkles } from 'lucide-react';
import type { MethodGuidance } from '../lib/methodGuidance';
import type { SolveMethod } from '../lib/types';
import { fmt } from '../lib/format';

function methodLabel(method: SolveMethod): string {
  if (method === 'geometric') return 'Hình học';
  if (method === 'simplex') return 'Simplex';
  if (method === 'bland') return 'Bland Rule';
  return 'Two-Phase';
}

function toneClasses(severity: string): {
  wrap: string;
  icon: string;
  badge: string;
  button: string;
} {
  if (severity === 'error') {
    return {
      wrap: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100',
      icon: 'bg-rose-600 text-white',
      badge: 'bg-rose-600 text-white',
      button: 'bg-rose-600 text-white hover:bg-rose-500',
    };
  }

  if (severity === 'warning') {
    return {
      wrap: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
      icon: 'bg-amber-500 text-slate-950',
      badge: 'bg-amber-500 text-slate-950',
      button: 'bg-amber-500 text-slate-950 hover:bg-amber-400',
    };
  }

  if (severity === 'info') {
    return {
      wrap: 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100',
      icon: 'bg-sky-600 text-white',
      badge: 'bg-sky-600 text-white',
      button: 'bg-sky-600 text-white hover:bg-sky-500',
    };
  }

  return {
    wrap: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
    icon: 'bg-emerald-600 text-white',
    badge: 'bg-emerald-600 text-white',
    button: 'bg-emerald-600 text-white hover:bg-emerald-500',
  };
}

function severityLabel(severity: string, blocked: boolean): string {
  if (blocked) return 'Đã chặn chạy';
  if (severity === 'error') return 'Không nên chạy';
  if (severity === 'warning') return 'Cảnh báo';
  if (severity === 'info') return 'Gợi ý';
  return 'Phù hợp';
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === 'error') return <ShieldAlert size={18} />;
  if (severity === 'warning') return <AlertTriangle size={18} />;
  if (severity === 'info') return <Info size={18} />;
  return <CheckCircle2 size={18} />;
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
  const tone = toneClasses(guidance.severity);

  return (
    <div className={`rounded-3xl border p-4 text-sm ${tone.wrap}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${tone.icon}`}>
            <SeverityIcon severity={guidance.severity} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-black ${tone.badge}`}>{severityLabel(guidance.severity, blocked)}</span>
              <h3 className="font-black tracking-tight">{guidance.title}</h3>
            </div>
            <p className="mt-2 leading-6">{guidance.message}</p>
          </div>
        </div>

        {guidance.recommendedMethod && onSwitchMethod && (
          <button
            type="button"
            onClick={() => onSwitchMethod(guidance.recommendedMethod!)}
            className={`flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-xs font-black shadow-sm transition hover:-translate-y-0.5 ${tone.button}`}
          >
            <Sparkles size={15} />
            Chuyển sang {methodLabel(guidance.recommendedMethod)}
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
        <FactChip label="min bᵢ" value={fmt(guidance.facts.minRhs)} />
        <FactChip label="RHS âm" value={guidance.facts.hasNegativeRhs ? 'Có' : 'Không'} />
        <FactChip label="RHS bằng 0" value={guidance.facts.hasZeroRhs ? 'Có' : 'Không'} />
        <FactChip label="Ràng buộc chuẩn" value={String(guidance.facts.standardizedRows)} />
      </div>

      {!compact && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <DetailBox title="Lý do" items={guidance.reasons} />
          <DetailBox title="Nên làm" items={guidance.nextSteps} />
        </div>
      )}
    </div>
  );
}

function FactChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/65 px-3 py-2 dark:bg-black/20">
      <div className="text-[10px] font-black uppercase tracking-wide opacity-60">{label}</div>
      <div className="mt-1 font-black">{value}</div>
    </div>
  );
}

function DetailBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-white/65 p-3 dark:bg-black/20">
      <div className="text-xs font-black uppercase tracking-wide opacity-70">{title}</div>
      <ul className="mt-2 list-disc space-y-1 pl-5 leading-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
