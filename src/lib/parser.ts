import type { ConstraintSign, LPInput, OptimizationType, VariableType } from './types';

export type ParseResult =
  | { ok: true; input: LPInput; warnings: string[] }
  | { ok: false; errors: string[] };

type LinearMap = Map<number, number>;

type ParsedConstraint = {
  coeffs: LinearMap;
  sign: ConstraintSign;
  rhs: number;
};

const SIGN_RE = /(<=|>=|≤|≥|=)/;

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/\*/g, '');
}

function parseNumber(raw: string | undefined): number {
  if (raw == null || raw === '') return 1;

  if (raw.includes('/')) {
    const [a, b] = raw.split('/').map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(b) < 1e-12) return Number.NaN;
    return a / b;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.NaN;
}

function addCoeff(map: LinearMap, index: number, value: number): void {
  map.set(index, (map.get(index) ?? 0) + value);
}

function parseLinearExpression(expr: string, lineNo: number, errors: string[]): LinearMap {
  const clean = expr
    .replace(/\s+/g, '')
    .replace(/^z=/i, '')
    .replace(/^z/i, '');

  const result: LinearMap = new Map();

  if (!clean) {
    errors.push(`Line ${lineNo}: linear expression is empty.`);
    return result;
  }

  const prepared = clean[0] === '+' || clean[0] === '-' ? clean : `+${clean}`;
  const termRe = /([+-])((?:\d+(?:\.\d+)?|\.\d+)(?:\/(?:\d+(?:\.\d+)?|\.\d+))?)?x(\d+)/gi;
  let reconstructed = '';
  let match: RegExpExecArray | null;

  while ((match = termRe.exec(prepared)) !== null) {
    const sign = match[1] === '-' ? -1 : 1;
    const coef = parseNumber(match[2]);
    const index = Number(match[3]);

    if (!Number.isFinite(coef) || !Number.isInteger(index) || index <= 0) {
      errors.push(`Line ${lineNo}: cannot read term "${match[0]}".`);
      continue;
    }

    addCoeff(result, index, sign * coef);
    reconstructed += match[0];
  }

  if (reconstructed.length !== prepared.length) {
    errors.push(`Line ${lineNo}: only expressions like 2x1 - x2 + 3x3 are supported. Cannot read "${prepared}".`);
  }

  return result;
}

function toVector(coeffs: LinearMap, n: number): number[] {
  return Array.from({ length: n }, (_, i) => coeffs.get(i + 1) ?? 0);
}

function parseObjective(line: string, lineNo: number, errors: string[]): { optimization: OptimizationType; coeffs: LinearMap } | null {
  const match = line.match(/^\s*(max|maximize|min|minimize)\b\s*(.*)$/i);
  if (!match) return null;

  const optimization: OptimizationType = match[1].toLowerCase().startsWith('max') ? 'max' : 'min';
  let expr = match[2].trim();

  if (expr.includes('=')) expr = expr.slice(expr.indexOf('=') + 1);
  else expr = expr.replace(/^z\b/i, '').trim();

  return { optimization, coeffs: parseLinearExpression(expr, lineNo, errors) };
}

function parseSign(sign: string): ConstraintSign {
  if (sign === '<=' || sign === '≤') return '<=';
  if (sign === '>=' || sign === '≥') return '>=';
  return '=';
}

function splitBySign(line: string): { left: string; sign: ConstraintSign; right: string } | null {
  const match = line.match(SIGN_RE);
  if (!match || match.index == null) return null;

  const signRaw = match[1];
  return {
    left: line.slice(0, match.index).trim(),
    sign: parseSign(signRaw),
    right: line.slice(match.index + signRaw.length).trim(),
  };
}

function parseVariableList(raw: string): number[] | null {
  const names = raw.split(',').map((item) => item.trim()).filter(Boolean);
  if (names.length === 0) return null;

  const indexes: number[] = [];

  for (const name of names) {
    const match = name.match(/^x(\d+)$/i);
    if (!match) return null;
    indexes.push(Number(match[1]));
  }

  return indexes;
}

function parseVariableCondition(line: string): { indexes: number[]; type: VariableType } | null {
  const freeMatch = line.match(/^\s*(x\d+(?:\s*,\s*x\d+)*)\s*free\s*$/i);
  if (freeMatch) {
    const indexes = parseVariableList(freeMatch[1]);
    return indexes ? { indexes, type: 'free' } : null;
  }

  const split = splitBySign(line);
  if (!split) return null;

  const indexes = parseVariableList(split.left);
  if (!indexes) return null;

  const rhs = Number(split.right);
  if (!Number.isFinite(rhs) || Math.abs(rhs) > 1e-12) return null;

  if (split.sign === '>=') return { indexes, type: 'nonnegative' };
  if (split.sign === '<=') return { indexes, type: 'nonpositive' };

  return null;
}

function parseConstraint(line: string, lineNo: number, errors: string[]): ParsedConstraint | null {
  const split = splitBySign(line);
  if (!split) {
    errors.push(`Line ${lineNo}: cannot find <=, >=, or =.`);
    return null;
  }

  const rhs = Number(split.right);
  if (!Number.isFinite(rhs)) {
    errors.push(`Line ${lineNo}: right-hand side must be a number. Received "${split.right}".`);
    return null;
  }

  return {
    coeffs: parseLinearExpression(split.left, lineNo, errors),
    sign: split.sign,
    rhs,
  };
}

export function parseLPText(text: string): ParseResult {
  const normalized = normalizeText(text);
  const rawLines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !/^s\.?t\.?$/i.test(line) && !/^subject\s+to$/i.test(line));

  const errors: string[] = [];
  const warnings: string[] = [];

  let objective: { optimization: OptimizationType; coeffs: LinearMap } | null = null;
  const constraints: ParsedConstraint[] = [];
  const variableTypes = new Map<number, VariableType>();
  let maxVar = 0;

  rawLines.forEach((line, idx) => {
    const lineNo = idx + 1;

    if (/^(max|maximize|min|minimize)\b/i.test(line)) {
      if (objective) {
        errors.push(`Line ${lineNo}: only one objective line is allowed.`);
        return;
      }

      objective = parseObjective(line, lineNo, errors);
      objective?.coeffs.forEach((_, index) => {
        maxVar = Math.max(maxVar, index);
      });
      return;
    }

    const varCondition = parseVariableCondition(line);
    if (varCondition) {
      varCondition.indexes.forEach((index) => {
        variableTypes.set(index, varCondition.type);
        maxVar = Math.max(maxVar, index);
      });
      return;
    }

    const constraint = parseConstraint(line, lineNo, errors);
    if (constraint) {
      constraints.push(constraint);
      constraint.coeffs.forEach((_, index) => {
        maxVar = Math.max(maxVar, index);
      });
    }
  });

  if (!objective) errors.push('Objective line not found. Example: max z = 3x1 + 5x2.');
  if (constraints.length === 0) errors.push('No constraints found.');
  if (maxVar <= 0) errors.push('No variables found. Use x1, x2, x3, ...');

  if (errors.length > 0 || !objective || maxVar <= 0) {
    return { ok: false, errors };
  }

  for (let i = 1; i <= maxVar; i += 1) {
    if (!variableTypes.has(i)) variableTypes.set(i, 'nonnegative');
  }

  if (![...variableTypes.values()].some((type) => type !== 'nonnegative')) {
    warnings.push('Variables without explicit conditions are treated as x_i >= 0.');
  }

  const parsedObjective = objective as { optimization: OptimizationType; coeffs: LinearMap };

  const input: LPInput = {
    optimization: parsedObjective.optimization,
    n: maxVar,
    m: constraints.length,
    c: toVector(parsedObjective.coeffs, maxVar),
    A: constraints.map((constraint) => toVector(constraint.coeffs, maxVar)),
    signs: constraints.map((constraint) => constraint.sign),
    b: constraints.map((constraint) => constraint.rhs),
    variableTypes: Array.from({ length: maxVar }, (_, i) => variableTypes.get(i + 1) ?? 'nonnegative'),
  };

  return { ok: true, input, warnings };
}
