import { useState } from 'react';
import type { LPInput } from '../lib/types';
import { parseLPText } from '../lib/parser';

const textareaClass = 'w-full rounded-3xl border border-slate-200 bg-white/90 px-4 py-4 font-mono text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:ring-indigo-950';

const BASIC_EXAMPLE = `max z = 3x1 + 5x2
x1 <= 4
2x2 <= 12
3x1 + 2x2 <= 18
x1, x2 >= 0`;

const TWO_PHASE_EXAMPLE = `max z = 2x1 - 6x2
-x1 + x2 - x3 <= -2
2x1 - x2 + x3 <= 1
x1, x2, x3 >= 0`;

export function TextInputPanel({ onParsed }: { onParsed: (input: LPInput) => void }) {
  const [text, setText] = useState(BASIC_EXAMPLE);
  const [messages, setMessages] = useState<Array<{ type: 'success' | 'warning' | 'error'; text: string }>>([]);

  const parse = () => {
    const result = parseLPText(text);

    if (!result.ok) {
      setMessages(result.errors.map((error) => ({ type: 'error', text: error })));
      return;
    }

    onParsed(result.input);
    setMessages([
      { type: 'success', text: `Parsed successfully: ${result.input.n} variables, ${result.input.m} constraints. Data was copied into the coefficient table.` },
      ...result.warnings.map((warning) => ({ type: 'warning' as const, text: warning })),
    ]);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-black text-slate-950 dark:text-white">Nhập bằng văn bản</div>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Dùng cú pháp toán học đơn giản, không dùng định dạng tiếng Việt. Sau khi áp dụng, dữ liệu sẽ được chuyển sang bảng hệ số để kiểm tra lại.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setText(BASIC_EXAMPLE)} className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-black transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:text-indigo-200">VD cơ bản</button>
            <button type="button" onClick={() => setText(TWO_PHASE_EXAMPLE)} className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-black transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:text-indigo-200">VD 2 pha</button>
            <button type="button" onClick={() => { setText(''); setMessages([]); }} className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-black transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:text-rose-300">Xóa</button>
          </div>
        </div>

        <textarea
          className={`${textareaClass} min-h-[230px]`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          placeholder={`min z = 3x1 + 2x2\nx1 + x2 <= 5\n2x1 - x2 >= 1\nx1 >= 0\nx2 >= 0`}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={parse} className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5 hover:from-indigo-500 hover:to-violet-500">
            Áp dụng đề bài
          </button>
          <span className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            Hỗ trợ: max/min, &lt;=, &gt;=, =, ≤, ≥, x1, x2, ..., free.
          </span>
        </div>
      </section>

      {messages.length > 0 && (
        <div className="space-y-2">
          {messages.map((message, index) => (
            <div
              key={`${message.type}-${index}`}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                message.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                  : message.type === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                    : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
              }`}
            >
              {message.text}
            </div>
          ))}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-black text-slate-950 dark:text-white">Format khuyến nghị</div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mỗi dòng là một phần của đề bài.</p>
          </div>
          <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-black text-indigo-700 dark:text-indigo-200">Plain math</span>
        </div>
        <pre className="overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs leading-6 dark:bg-slate-900">{`min z = 3x1 + 2x2
x1 + x2 <= 5
2x1 - x2 >= 1
x1 >= 0
x2 >= 0`}</pre>
      </section>
    </div>
  );
}
