import { useState } from 'react';
import type { LPInput } from '../lib/types';
import { parseLPText } from '../lib/parser';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-indigo-950';

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
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-bold text-slate-900 dark:text-slate-100">Nhập bằng văn bản</div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Dùng format toán học chuẩn. Sau khi phân tích, dữ liệu sẽ được đổ sang bảng hệ số để bạn kiểm tra hoặc chỉnh tay.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setText(BASIC_EXAMPLE)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900">VD cơ bản</button>
            <button type="button" onClick={() => setText(TWO_PHASE_EXAMPLE)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900">VD 2 pha</button>
            <button type="button" onClick={() => { setText(''); setMessages([]); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900">Xóa</button>
          </div>
        </div>

        <textarea
          className={`${inputClass} min-h-[220px] font-mono leading-6`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          placeholder={`max z = 3x1 + 5x2\nx1 <= 4\n2x2 <= 12\n3x1 + 2x2 <= 18\nx1, x2 >= 0`}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={parse} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-glow hover:bg-indigo-500">Phân tích dữ liệu</button>
          <span className="text-xs text-slate-500 dark:text-slate-400">Hỗ trợ: max/min, &lt;=, &gt;=, =, ≤, ≥, x1, x2, ..., free. Không hỗ trợ định dạng tiếng Việt.</span>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="space-y-2">
          {messages.map((message, index) => (
            <div
              key={`${message.type}-${index}`}
              className={`rounded-xl border px-3 py-2 text-sm ${
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
        <div className="font-bold text-slate-900 dark:text-slate-100">Format khuyến nghị</div>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs leading-5 dark:bg-slate-900">{`max z = 3x1 + 5x2
x1 <= 4
2x2 <= 12
3x1 + 2x2 <= 18
x1, x2 >= 0`}</pre>
      </div>
    </div>
  );
}
