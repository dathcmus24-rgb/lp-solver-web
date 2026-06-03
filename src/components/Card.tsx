import type { ReactNode } from 'react';

export function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/75">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
