import type { ConstraintSign } from './types';

export const EPS = 1e-10;
export const nearlyZero = (x: number): boolean => Math.abs(x) <= EPS;
export const cloneMatrix = (matrix: number[][]): number[][] => matrix.map((row) => [...row]);

export function cleanNumber(x: number): number {
  // Internal cleanup must not round meaningful decimals.
  // It only removes floating-point noise extremely close to zero.
  return nearlyZero(x) ? 0 : x;
}

export function fmt(x: number, digits = 4): string {
  const v = cleanNumber(x);
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
}

export function flipSign(sign: ConstraintSign): ConstraintSign {
  if (sign === '<=') return '>=';
  if (sign === '>=') return '<=';
  return '=';
}

export function signToLatex(sign: ConstraintSign): string {
  if (sign === '<=') return '\\le';
  if (sign === '>=') return '\\ge';
  return '=';
}

export function linearLatex(coeffs: number[], names: string[]): string {
  const parts: string[] = [];

  coeffs.forEach((coef, i) => {
    if (nearlyZero(coef)) return;

    const abs = Math.abs(coef);
    const term = `${abs === 1 ? '' : fmt(abs)}${names[i] ?? `x_${i + 1}`}`;

    if (parts.length === 0) {
      parts.push(coef < 0 ? `-${term}` : term);
    } else {
      parts.push(coef < 0 ? `- ${term}` : `+ ${term}`);
    }
  });

  return parts.length ? parts.join(' ') : '0';
}

export function varNameToLatex(name: string): string {
  const match = name.match(/^([a-zA-Z]+)(\d+)(?:\^([+-]))?$/);

  if (match) {
    const [, letter, index, sup] = match;
    const supPart = sup ? `^{${sup}}` : '';
    return `${letter}_{${index}}${supPart}`;
  }

  return name.replace(/\^\+/g, '^{+}').replace(/\^-/g, '^{-}');
}

export function formatVarNameHtml(name: string): string {
  return name
    .replace(/\d+/g, (num) => num.split('').map((digit) => '₀₁₂₃₄₅₆₇₈₉'[parseInt(digit, 10)]).join(''))
    .replace(/\^\+/g, '⁺')
    .replace(/\^-/g, '⁻');
}

export function toDisplayVarName(name: string): string {
  // Slack/surplus variables are displayed as w_i in the learning UI.
  if (/^s\d+$/i.test(name)) return name.replace(/^s/i, 'w');
  if (/^e\d+$/i.test(name)) return name.replace(/^e/i, 'w');

  // Artificial variables belong to Phase 1. Display them as x0_i so the
  // two-phase explanation matches the auxiliary-variable notation.
  const artificial = name.match(/^a(\d+)$/i);
  if (artificial) return `x0${artificial[1]}`;

  return name;
}

export function displaySolverVar(name: string): string {
  return formatVarNameHtml(toDisplayVarName(name));
}

export function displaySolverText(text: string): string {
  return text
    .replace(/\bs(\d+)\b/gi, 'w$1')
    .replace(/\be(\d+)\b/gi, 'w$1')
    .replace(/\ba(\d+)\b/gi, 'x0$1');
}
