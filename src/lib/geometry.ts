import type { ConstraintSign, GeometryLine, GeometryResult, LPInput, Point2D } from './types';
import { EPS, cleanNumber } from './format';

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

  return {
    supported: true,
    lines,
    feasiblePoints,
    optimalPoint,
    status: 'optimal',
    message: `Bài toán có nghiệm tối ưu duy nhất tại (${fmtPoint(optimalPoint)}).`,
  };
}
