import type { ConstraintSign, GeometryLine, GeometryResult, LPInput, Point2D } from './types';
import { EPS, cleanNumber, fmt } from './format';

type HalfPlane = { a: number; b: number; rhs: number; label: string };
type Equality = { a: number; b: number; rhs: number; label: string };
type Line = { a: number; b: number; rhs: number; sign: ConstraintSign; label: string };

function dot(a: number, b: number, x: number, y: number): number {
  return a * x + b * y;
}

function objectiveValue(input: LPInput, x: number, y: number): number {
  return cleanNumber((input.c[0] ?? 0) * x + (input.c[1] ?? 0) * y);
}

function isFeasible(input: LPInput, x: number, y: number): boolean {
  for (let i = 0; i < input.m; i += 1) {
    const lhs = (input.A[i][0] ?? 0) * x + (input.A[i][1] ?? 0) * y;
    const rhs = input.b[i] ?? 0;
    const sign = input.signs[i];

    if (sign === '<=' && lhs - rhs > 1e-7) return false;
    if (sign === '>=' && rhs - lhs > 1e-7) return false;
    if (sign === '=' && Math.abs(lhs - rhs) > 1e-7) return false;
  }

  if (input.variableTypes[0] === 'nonnegative' && x < -EPS) return false;
  if (input.variableTypes[0] === 'nonpositive' && x > EPS) return false;
  if (input.variableTypes[1] === 'nonnegative' && y < -EPS) return false;
  if (input.variableTypes[1] === 'nonpositive' && y > EPS) return false;

  return true;
}

function intersect(l1: Line, l2: Line): { x: number; y: number } | null {
  const det = l1.a * l2.b - l2.a * l1.b;
  if (Math.abs(det) < EPS) return null;

  const x = (l1.rhs * l2.b - l2.rhs * l1.b) / det;
  const y = (l1.a * l2.rhs - l2.a * l1.rhs) / det;

  return { x, y };
}


function buildLines(input: LPInput): GeometryLine[] {
  const lines: GeometryLine[] = input.A.map((row, i) => ({
    a: row[0] ?? 0,
    b: row[1] ?? 0,
    rhs: input.b[i] ?? 0,
    sign: input.signs[i],
    label: `R${i + 1}`,
  }));

  if (input.variableTypes[0] !== 'free') {
    lines.push({
      a: 1,
      b: 0,
      rhs: 0,
      sign: input.variableTypes[0] === 'nonnegative' ? '>=' : '<=',
      label: 'x₁ sign',
    });
  }

  if (input.variableTypes[1] !== 'free') {
    lines.push({
      a: 0,
      b: 1,
      rhs: 0,
      sign: input.variableTypes[1] === 'nonnegative' ? '>=' : '<=',
      label: 'x₂ sign',
    });
  }

  return lines;
}

function toHalfPlanesAndEqualities(lines: GeometryLine[]): { halfPlanes: HalfPlane[]; equalities: Equality[] } {
  const halfPlanes: HalfPlane[] = [];
  const equalities: Equality[] = [];

  lines.forEach((line) => {
    if (line.sign === '<=') {
      halfPlanes.push({ a: line.a, b: line.b, rhs: line.rhs, label: line.label });
    } else if (line.sign === '>=') {
      halfPlanes.push({ a: -line.a, b: -line.b, rhs: -line.rhs, label: line.label });
    } else {
      equalities.push({ a: line.a, b: line.b, rhs: line.rhs, label: line.label });
    }
  });

  return { halfPlanes, equalities };
}

function addUniquePoint(points: Point2D[], input: LPInput, x: number, y: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (!isFeasible(input, x, y)) return;
  if (points.some((p) => Math.abs(p.x - x) < 1e-7 && Math.abs(p.y - y) < 1e-7)) return;

  points.push({
    x: cleanNumber(x),
    y: cleanNumber(y),
    value: objectiveValue(input, x, y),
  });
}

function collectFeasiblePoints(input: LPInput, lines: GeometryLine[]): Point2D[] {
  const points: Point2D[] = [];

  // Chỉ lấy giao điểm giữa hai đường biên ràng buộc.
  // Không thêm (0,0) thủ công và không thêm hình chiếu gần gốc lên từng đường,
  // vì các điểm đó có thể là điểm phụ nằm giữa cạnh, không phải đỉnh cực biên.
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const p = intersect(lines[i], lines[j]);
      if (p) addUniquePoint(points, input, p.x, p.y);
    }
  }

  if (points.length >= 3) {
    const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    points.sort((p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx));
  } else {
    points.sort((p, q) => Math.atan2(p.y, p.x) - Math.atan2(q.y, q.x));
  }

  return points;
}

function collectFeasibleWitnesses(input: LPInput, lines: GeometryLine[]): Point2D[] {
  const witnesses: Point2D[] = [];

  // Witness points are used only to prove that the feasible region is non-empty.
  // They must never be treated as optimal vertices.
  addUniquePoint(witnesses, input, 0, 0);

  const seeds = [-10, -5, -1, 1, 5, 10];
  seeds.forEach((v) => {
    addUniquePoint(witnesses, input, v, 0);
    addUniquePoint(witnesses, input, 0, v);
  });

  lines.forEach((line) => {
    if (Math.abs(line.b) > EPS) addUniquePoint(witnesses, input, 0, line.rhs / line.b);
    if (Math.abs(line.a) > EPS) addUniquePoint(witnesses, input, line.rhs / line.a, 0);
  });

  return witnesses;
}

function scalarMultiple(baseA: number, baseB: number, targetA: number, targetB: number): number | null {
  if (Math.abs(baseA) <= EPS && Math.abs(baseB) <= EPS) return null;
  if (Math.abs(baseA * targetB - baseB * targetA) > 1e-8) return null;

  if (Math.abs(baseA) > EPS) return targetA / baseA;
  return targetB / baseB;
}

function formatLineLabel(a: number, b: number, rhs: number): string {
  const parts: string[] = [];

  const pushTerm = (coef: number, name: string) => {
    if (Math.abs(coef) <= EPS) return;

    const abs = Math.abs(coef);
    const term = `${abs === 1 ? '' : fmt(abs)}${name}`;

    if (parts.length === 0) {
      parts.push(coef < 0 ? `-${term}` : term);
    } else {
      parts.push(coef < 0 ? `- ${term}` : `+ ${term}`);
    }
  };

  pushTerm(a, 'x1');
  pushTerm(b, 'x2');

  return `${parts.length ? parts.join(' ') : '0'} = ${fmt(rhs)}`;
}

function lineHasFeasiblePoint(input: LPInput, line: GeometryLine): boolean {
  const candidates: Array<{ x: number; y: number }> = [];

  if (Math.abs(line.b) > EPS) candidates.push({ x: 0, y: line.rhs / line.b });
  if (Math.abs(line.a) > EPS) candidates.push({ x: line.rhs / line.a, y: 0 });

  const base = candidates[0];
  const dx = -line.b;
  const dy = line.a;

  if (base) {
    candidates.push(
      { x: base.x + dx, y: base.y + dy },
      { x: base.x - dx, y: base.y - dy },
      { x: base.x + 5 * dx, y: base.y + 5 * dy },
      { x: base.x - 5 * dx, y: base.y - 5 * dy },
    );
  }

  return candidates.some((p) => isFeasible(input, p.x, p.y));
}

function findBoundaryOptimalLineWithoutVertices(input: LPInput, lines: GeometryLine[]): GeometryResult['optimalLine'] {
  let best: GeometryResult['optimalLine'];

  lines.forEach((line) => {
    if (line.sign === '=') return;

    const multiplier = scalarMultiple(line.a, line.b, input.c[0] ?? 0, input.c[1] ?? 0);
    if (multiplier == null || Math.abs(multiplier) <= EPS) return;

    const boundsObjective =
      (input.optimization === 'max' && ((line.sign === '<=' && multiplier > EPS) || (line.sign === '>=' && multiplier < -EPS))) ||
      (input.optimization === 'min' && ((line.sign === '>=' && multiplier > EPS) || (line.sign === '<=' && multiplier < -EPS)));

    if (!boundsObjective) return;
    if (!lineHasFeasiblePoint(input, line)) return;

    const candidate = {
      a: cleanNumber(line.a),
      b: cleanNumber(line.b),
      rhs: cleanNumber(line.rhs),
      value: cleanNumber(multiplier * line.rhs),
      label: formatLineLabel(line.a, line.b, line.rhs),
    };

    if (
      best == null ||
      (input.optimization === 'max' && candidate.value > best.value + 1e-8) ||
      (input.optimization === 'min' && candidate.value < best.value - 1e-8)
    ) {
      best = candidate;
    }
  });

  return best;
}


function directionSatisfiesRecessionCone(dx: number, dy: number, halfPlanes: HalfPlane[], equalities: Equality[]): boolean {
  if (Math.hypot(dx, dy) < EPS) return false;

  for (const hp of halfPlanes) {
    if (dot(hp.a, hp.b, dx, dy) > 1e-8) return false;
  }

  for (const eq of equalities) {
    if (Math.abs(dot(eq.a, eq.b, dx, dy)) > 1e-8) return false;
  }

  return true;
}

function improvesObjective(input: LPInput, dx: number, dy: number): boolean {
  const delta = (input.c[0] ?? 0) * dx + (input.c[1] ?? 0) * dy;
  return input.optimization === 'max' ? delta > 1e-8 : delta < -1e-8;
}

function hasImprovingRecessionDirection(input: LPInput, halfPlanes: HalfPlane[], equalities: Equality[]): boolean {
  const candidates: Array<{ dx: number; dy: number }> = [];

  const sign = input.optimization === 'max' ? 1 : -1;
  candidates.push({ dx: sign * (input.c[0] ?? 0), dy: sign * (input.c[1] ?? 0) });
  candidates.push({ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 });

  [...halfPlanes, ...equalities].forEach((line) => {
    candidates.push({ dx: -line.b, dy: line.a }, { dx: line.b, dy: -line.a });
  });

  return candidates.some(({ dx, dy }) => directionSatisfiesRecessionCone(dx, dy, halfPlanes, equalities) && improvesObjective(input, dx, dy));
}

function objectiveDelta(input: LPInput, dx: number, dy: number): number {
  return (input.c[0] ?? 0) * dx + (input.c[1] ?? 0) * dy;
}

function normalizeDirection(dx: number, dy: number): { dx: number; dy: number } {
  const length = Math.hypot(dx, dy);
  if (length < EPS) return { dx: 0, dy: 0 };
  return { dx: cleanNumber(dx / length), dy: cleanNumber(dy / length) };
}

function activeOptimalLineLabel(input: LPInput, point: Point2D, lines: GeometryLine[]): string | undefined {
  for (const line of lines) {
    if (Math.abs(line.a * point.x + line.b * point.y - line.rhs) > 1e-7) continue;
    if (scalarMultiple(line.a, line.b, input.c[0] ?? 0, input.c[1] ?? 0) == null) continue;
    return formatLineLabel(line.a, line.b, line.rhs);
  }

  return undefined;
}

function findOptimalRayFromPoint(
  input: LPInput,
  point: Point2D,
  halfPlanes: HalfPlane[],
  equalities: Equality[],
  lines: GeometryLine[],
): GeometryResult['optimalRay'] {
  const candidates: Array<{ dx: number; dy: number }> = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  lines.forEach((line) => {
    candidates.push({ dx: -line.b, dy: line.a }, { dx: line.b, dy: -line.a });
  });

  for (const candidate of candidates) {
    if (!directionSatisfiesRecessionCone(candidate.dx, candidate.dy, halfPlanes, equalities)) continue;
    if (Math.abs(objectiveDelta(input, candidate.dx, candidate.dy)) > 1e-8) continue;

    const direction = normalizeDirection(candidate.dx, candidate.dy);
    if (Math.hypot(direction.dx, direction.dy) < EPS) continue;

    return {
      start: point,
      dx: direction.dx,
      dy: direction.dy,
      value: cleanNumber(point.value),
      lineLabel: activeOptimalLineLabel(input, point, lines),
    };
  }

  return undefined;
}

function fmtPoint(p: Point2D): string {
  return `${cleanNumber(p.x)}, ${cleanNumber(p.y)}`;
}

function findOptimalSegment(points: Point2D[], optimalValue: number): { a: Point2D; b: Point2D } | undefined {
  const optimalPoints = points.filter((p) => Math.abs(p.value - optimalValue) < 1e-7);

  if (optimalPoints.length < 2) return undefined;

  let bestPair: { a: Point2D; b: Point2D } | undefined;
  let bestDistance = -1;

  for (let i = 0; i < optimalPoints.length; i += 1) {
    for (let j = i + 1; j < optimalPoints.length; j += 1) {
      const p = optimalPoints[i];
      const q = optimalPoints[j];
      const distance = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

      if (distance > bestDistance) {
        bestDistance = distance;
        bestPair = { a: p, b: q };
      }
    }
  }

  return bestPair;
}

export function solveGeometric(input: LPInput): GeometryResult {
  if (input.n !== 2) {
    return {
      supported: false,
      lines: [],
      feasiblePoints: [],
      optimalPoint: null,
      status: 'error',
      message: 'Phương pháp hình học chỉ hỗ trợ bài toán 2 biến.',
    };
  }

  const lines = buildLines(input);
  const { halfPlanes, equalities } = toHalfPlanesAndEqualities(lines);
  const feasiblePoints = collectFeasiblePoints(input, lines);

  if (feasiblePoints.length === 0) {
    const witnesses = collectFeasibleWitnesses(input, lines);

    if (witnesses.length === 0) {
      return {
        supported: true,
        lines,
        feasiblePoints: [],
        optimalPoint: null,
        status: 'infeasible',
        message: 'Miền nghiệm rỗng, không tồn tại điểm khả thi thỏa mãn tất cả ràng buộc.',
      };
    }

    if (hasImprovingRecessionDirection(input, halfPlanes, equalities)) {
      return {
        supported: true,
        lines,
        feasiblePoints: witnesses,
        optimalPoint: null,
        status: 'unbounded',
        message: 'Miền nghiệm không rỗng nhưng có hướng làm hàm mục tiêu cải thiện vô hạn, nên bài toán không giới nội.',
      };
    }

    const optimalLine = findBoundaryOptimalLineWithoutVertices(input, lines);

    if (optimalLine) {
      return {
        supported: true,
        lines,
        feasiblePoints: witnesses,
        optimalPoint: null,
        optimalLine,
        status: 'optimal',
        message: `Bài toán có vô số nghiệm tối ưu trên đường ${optimalLine.label ?? 'biên tối ưu'}. Giá trị tối ưu là ${input.optimization} z = ${fmt(optimalLine.value)}.`,
      };
    }

    return {
      supported: true,
      lines,
      feasiblePoints: witnesses,
      optimalPoint: null,
      status: 'unbounded',
      message: 'Miền nghiệm không rỗng nhưng không có đỉnh hữu hạn; chưa xác định được biên tối ưu hữu hạn nên bài toán được xem là không giới nội.',
    };
  }

  if (hasImprovingRecessionDirection(input, halfPlanes, equalities)) {
    return {
      supported: true,
      lines,
      feasiblePoints,
      optimalPoint: null,
      status: 'unbounded',
      message: 'Miền nghiệm có hướng làm hàm mục tiêu cải thiện vô hạn, nên bài toán không giới nội.',
    };
  }

  const optimalPoint = feasiblePoints.reduce((best, p) => {
    if (input.optimization === 'max') return p.value > best.value + 1e-8 ? p : best;
    return p.value < best.value - 1e-8 ? p : best;
  }, feasiblePoints[0]);

  const optimalSegment = findOptimalSegment(feasiblePoints, optimalPoint.value);

  if (optimalSegment) {
    return {
      supported: true,
      lines,
      feasiblePoints,
      optimalPoint,
      optimalSegment,
      status: 'optimal',
      message: `Bài toán có vô số nghiệm tối ưu. Miền nghiệm tối ưu là đoạn thẳng AB với A = (${fmtPoint(optimalSegment.a)}) và B = (${fmtPoint(optimalSegment.b)}).`,
    };
  }

  const optimalRay = findOptimalRayFromPoint(input, optimalPoint, halfPlanes, equalities, lines);

  if (optimalRay) {
    return {
      supported: true,
      lines,
      feasiblePoints,
      optimalPoint,
      optimalRay,
      status: 'optimal',
      message: `Bài toán có vô số nghiệm tối ưu trên tia${optimalRay.lineLabel ? ` thuộc đường ${optimalRay.lineLabel}` : ''}. Một điểm đầu tia là (${fmtPoint(optimalRay.start)}).`,
    };
  }

  return {
    supported: true,
    lines,
    feasiblePoints,
    optimalPoint,
    status: 'optimal',
    message: `Bài toán có nghiệm tối ưu duy nhất tại (${fmtPoint(optimalPoint)}).`,
  };
}
