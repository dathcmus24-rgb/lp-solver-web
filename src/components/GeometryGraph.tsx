import { useEffect, useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3Line } from 'd3-shape';
import type { GeometryLine, GeometryResult, LPInput, Point2D } from '../lib/types';
import { fmt } from '../lib/format';
import { Card } from './Card';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function addUniquePoint(points: Array<{ x: number; y: number }>, p: { x: number; y: number }): void {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
  if (points.some((q) => Math.abs(q.x - p.x) < 1e-7 && Math.abs(q.y - p.y) < 1e-7)) return;
  points.push(p);
}

function lineViewportSegment(
  a: number,
  b: number,
  rhs: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];

  if (Math.abs(b) > 1e-9) {
    addUniquePoint(points, { x: minX, y: (rhs - a * minX) / b });
    addUniquePoint(points, { x: maxX, y: (rhs - a * maxX) / b });
  }

  if (Math.abs(a) > 1e-9) {
    addUniquePoint(points, { x: (rhs - b * minY) / a, y: minY });
    addUniquePoint(points, { x: (rhs - b * maxY) / a, y: maxY });
  }

  const visible = points.filter((p) => p.x >= minX - 1e-7 && p.x <= maxX + 1e-7 && p.y >= minY - 1e-7 && p.y <= maxY + 1e-7);

  if (visible.length <= 2) return visible;

  let bestPair: Array<{ x: number; y: number }> = [];
  let bestDistance = -1;

  for (let i = 0; i < visible.length; i += 1) {
    for (let j = i + 1; j < visible.length; j += 1) {
      const distance = (visible[i].x - visible[j].x) ** 2 + (visible[i].y - visible[j].y) ** 2;
      if (distance > bestDistance) {
        bestDistance = distance;
        bestPair = [visible[i], visible[j]];
      }
    }
  }

  return bestPair;
}

function objectiveLineSegment(
  c1: number,
  c2: number,
  z: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): Array<{ x: number; y: number }> {
  return lineViewportSegment(c1, c2, z, minX, maxX, minY, maxY);
}

function formatObjectiveFormula(c1: number, c2: number): string {
  const parts: string[] = [];

  if (Math.abs(c1) > 1e-9) parts.push(`${fmt(c1)}x₁`);
  if (Math.abs(c2) > 1e-9) {
    const prefix = c2 >= 0 && parts.length > 0 ? '+ ' : '';
    parts.push(`${prefix}${fmt(c2)}x₂`);
  }

  return parts.length ? parts.join(' ') : '0';
}

function objectiveValueAt(input: LPInput, x: number, y: number): number {
  return (input.c[0] ?? 0) * x + (input.c[1] ?? 0) * y;
}

function satisfiesLine(point: Point2D, line: GeometryLine): boolean {
  const value = line.a * point.x + line.b * point.y;

  if (line.sign === '<=') return value <= line.rhs + 1e-7;
  if (line.sign === '>=') return value >= line.rhs - 1e-7;
  return Math.abs(value - line.rhs) <= 1e-7;
}

function segmentLineIntersection(start: Point2D, end: Point2D, line: GeometryLine): Point2D | null {
  const startValue = line.a * start.x + line.b * start.y - line.rhs;
  const endValue = line.a * end.x + line.b * end.y - line.rhs;
  const denom = startValue - endValue;

  if (Math.abs(denom) < 1e-12) return null;

  const t = startValue / denom;
  if (t < -1e-7 || t > 1 + 1e-7) return null;

  return {
    x: start.x + t * (end.x - start.x),
    y: start.y + t * (end.y - start.y),
    value: 0,
  };
}

function clipPolygonByOneSide(polygon: Point2D[], line: GeometryLine): Point2D[] {
  if (polygon.length === 0) return [];

  const out: Point2D[] = [];

  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const previous = polygon[(i - 1 + polygon.length) % polygon.length];
    const currentInside = satisfiesLine(current, line);
    const previousInside = satisfiesLine(previous, line);

    if (currentInside) {
      if (!previousInside) {
        const intersection = segmentLineIntersection(previous, current, line);
        if (intersection) out.push(intersection);
      }
      out.push(current);
    } else if (previousInside) {
      const intersection = segmentLineIntersection(previous, current, line);
      if (intersection) out.push(intersection);
    }
  }

  return out.filter((point, index) => out.findIndex((other) => Math.abs(point.x - other.x) < 1e-7 && Math.abs(point.y - other.y) < 1e-7) === index);
}

function clipPolygonByLine(polygon: Point2D[], line: GeometryLine): Point2D[] {
  if (line.sign !== '=') return clipPolygonByOneSide(polygon, line);

  const less = clipPolygonByOneSide(polygon, { ...line, sign: '<=' });
  return clipPolygonByOneSide(less, { ...line, sign: '>=' });
}

function buildVisibleFeasibleRegion(lines: GeometryLine[], minX: number, maxX: number, minY: number, maxY: number): Point2D[] {
  let polygon: Point2D[] = [
    { x: minX, y: minY, value: 0 },
    { x: maxX, y: minY, value: 0 },
    { x: maxX, y: maxY, value: 0 },
    { x: minX, y: maxY, value: 0 },
  ];

  for (const line of lines) {
    polygon = clipPolygonByLine(polygon, line);
    if (polygon.length === 0) return [];
  }

  if (polygon.length >= 3) {
    const cx = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
    const cy = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;
    polygon.sort((p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx));
  }

  return polygon;
}

function applyZoom(min: number, max: number, zoom: number): [number, number] {
  const center = (min + max) / 2;
  const half = ((max - min) * zoom) / 2;
  return [center - half, center + half];
}

function niceTicks(min: number, max: number, count = 10): number[] {
  const span = Math.max(1e-9, max - min);
  const rough = span / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const ratio = rough / pow;
  const step = (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10) * pow;
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];

  for (let value = first; value <= max + step * 0.5; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }

  return ticks;
}

function lineDisplay(line: GeometryLine): string {
  const left: string[] = [];

  if (Math.abs(line.a) > 1e-9) left.push(`${fmt(line.a)}x₁`);
  if (Math.abs(line.b) > 1e-9) {
    const sign = line.b >= 0 && left.length > 0 ? '+ ' : '';
    left.push(`${sign}${fmt(line.b)}x₂`);
  }

  const body = left.length ? left.join(' ') : '0';
  const symbol = line.sign === '<=' ? '≤' : line.sign === '>=' ? '≥' : '=';

  return `${line.label}: ${body} ${symbol} ${fmt(line.rhs)}`;
}

function labelForPoint(point: Point2D, points: Point2D[]): string {
  const index = points.findIndex((p) => Math.abs(p.x - point.x) < 1e-7 && Math.abs(p.y - point.y) < 1e-7);
  return index >= 0 ? LETTERS[index] ?? `P${index + 1}` : '';
}

export function GeometryGraph({ result, input }: { result: GeometryResult | null; input: LPInput }) {
  const [manualZ, setManualZ] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showFeasible, setShowFeasible] = useState(true);
  const [showObjective, setShowObjective] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);

  useEffect(() => {
    setManualZ(null);
    setZoom(1);
    setActiveLineIndex(null);
  }, [input.c[0], input.c[1], input.optimization, input.n, input.m, JSON.stringify(input.A), JSON.stringify(input.b), JSON.stringify(input.signs)]);

  const objective = useMemo(() => ({
    c1: input.c[0] ?? 0,
    c2: input.c[1] ?? 0,
  }), [input.c]);

  if (!result) return null;
  if (!result.supported) return <Card title="Đồ thị hình học"><div className="rounded-2xl bg-amber-50 p-4 text-amber-800 dark:bg-amber-950 dark:text-amber-100">{result.message}</div></Card>;

  const pts = result.feasiblePoints;
  const xValues = [0, ...pts.map((p) => p.x), result.optimalPoint?.x ?? 0, result.optimalSegment?.a.x ?? 0, result.optimalSegment?.b.x ?? 0];
  const yValues = [0, ...pts.map((p) => p.y), result.optimalPoint?.y ?? 0, result.optimalSegment?.a.y ?? 0, result.optimalSegment?.b.y ?? 0];

  const rawMinX = Math.min(...xValues) - 2;
  const rawMaxX = Math.max(6, ...xValues) + 2;
  const rawMinY = Math.min(...yValues) - 2;
  const rawMaxY = Math.max(6, ...yValues) + 2;

  const [minX, maxX] = applyZoom(rawMinX, rawMaxX, zoom);
  const [minY, maxY] = applyZoom(rawMinY, rawMaxY, zoom);

  const visibleFeasibleRegion = buildVisibleFeasibleRegion(result.lines, minX, maxX, minY, maxY);

  const cornerValues = [
    objectiveValueAt(input, minX, minY),
    objectiveValueAt(input, minX, maxY),
    objectiveValueAt(input, maxX, minY),
    objectiveValueAt(input, maxX, maxY),
    ...pts.map((p) => objectiveValueAt(input, p.x, p.y)),
  ].filter(Number.isFinite);

  const rawMinZ = Math.min(0, ...cornerValues, result.optimalPoint?.value ?? 0);
  const rawMaxZ = Math.max(1, ...cornerValues, result.optimalPoint?.value ?? 1);
  const paddingZ = Math.max(1, (rawMaxZ - rawMinZ) * 0.15);
  const minZ = rawMinZ - paddingZ;
  const maxZ = rawMaxZ + paddingZ;
  const defaultZ = result.optimalPoint?.value ?? (input.optimization === 'max' ? maxZ : minZ);
  const zValue = manualZ ?? defaultZ;
  const objectiveSegment = objectiveLineSegment(objective.c1, objective.c2, zValue, minX, maxX, minY, maxY);
  const objectiveEnabled = Math.abs(objective.c1) > 1e-9 || Math.abs(objective.c2) > 1e-9;

  const width = 820;
  const height = 500;
  const pad = 52;

  const xScale = scaleLinear().domain([minX, maxX]).range([pad, width - pad]);
  const yScale = scaleLinear().domain([minY, maxY]).range([height - pad, pad]);
  const polygonPath = d3Line<{ x: number; y: number }>().x((d) => xScale(d.x)).y((d) => yScale(d.y));
  const xTicks = niceTicks(minX, maxX, 12);
  const yTicks = niceTicks(minY, maxY, 8);

  const lineSegments = result.lines.map((l) => ({
    ...l,
    samples: lineViewportSegment(l.a, l.b, l.rhs, minX, maxX, minY, maxY),
  }));

  const objectiveFormula = formatObjectiveFormula(objective.c1, objective.c2);
  const optimalZText = result.optimalPoint ? fmt(result.optimalPoint.value) : '—';
  const zStep = (maxZ - minZ) / 50 || 1;

  const directionLength = 44;
  const objectiveNorm = Math.hypot(objective.c1, objective.c2) || 1;
  const directionSign = input.optimization === 'max' ? 1 : -1;
  const directionStart = { x: width - 132, y: 76 };
  const directionEnd = {
    x: directionStart.x + directionSign * (objective.c1 / objectiveNorm) * directionLength,
    y: directionStart.y - directionSign * (objective.c2 / objectiveNorm) * directionLength,
  };

  const optimalSegmentName = result.optimalSegment
    ? `${labelForPoint(result.optimalSegment.a, pts) || 'A'}${labelForPoint(result.optimalSegment.b, pts) || 'B'}`
    : '';

  return (
    <Card title="Đồ thị phương pháp hình học">
      <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-indigo-950 dark:text-indigo-100">Bảng điều khiển hình học</h3>
            <p className="mt-1 text-sm text-indigo-800 dark:text-indigo-200">
              Đường đỏ nét đứt biểu diễn <b>z = {objectiveFormula}</b>. Các điều chỉnh bên dưới chỉ thay đổi hình vẽ, không ảnh hưởng thuật toán.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setManualZ(null)} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500">z tối ưu</button>
            <button type="button" onClick={() => setZoom((v) => Math.max(0.35, v * 0.75))} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-900 dark:bg-slate-950 dark:text-slate-100">Zoom +</button>
            <button type="button" onClick={() => setZoom((v) => Math.min(4, v * 1.35))} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-900 dark:bg-slate-950 dark:text-slate-100">Zoom −</button>
            <button type="button" onClick={() => { setZoom(1); setManualZ(null); }} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-900 dark:bg-slate-950 dark:text-slate-100">Reset view</button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-rose-100 bg-white/80 p-4 dark:border-rose-900/60 dark:bg-slate-950/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-rose-600 dark:text-rose-300">Hàm mục tiêu</div>
              <div className="mt-1 font-mono text-base font-black text-slate-950 dark:text-slate-100">
                z = {objectiveFormula}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-rose-50 px-3 py-2 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100">
                <div className="font-bold">z hiện tại</div>
                <div className="font-mono">{fmt(zValue)}</div>
              </div>
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
                <div className="font-bold">z tối ưu</div>
                <div className="font-mono">{optimalZText}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-center">
            <button
              type="button"
              onClick={() => setManualZ((manualZ ?? defaultZ) - zStep)}
              disabled={!objectiveEnabled}
              className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-black text-rose-900 disabled:opacity-50 dark:bg-rose-950 dark:text-rose-100"
            >
              z −
            </button>
            <input
              type="range"
              min={minZ}
              max={maxZ}
              step={(maxZ - minZ) / 250 || 0.1}
              value={zValue}
              disabled={!objectiveEnabled}
              onChange={(e) => setManualZ(Number(e.target.value))}
              className="w-full accent-rose-500"
            />
            <button
              type="button"
              onClick={() => setManualZ((manualZ ?? defaultZ) + zStep)}
              disabled={!objectiveEnabled}
              className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-black text-rose-900 disabled:opacity-50 dark:bg-rose-950 dark:text-rose-100"
            >
              z +
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <label className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 dark:bg-slate-950/50">
            <input type="checkbox" checked={showFeasible} onChange={(e) => setShowFeasible(e.target.checked)} className="accent-indigo-600" />
            Tô miền nghiệm
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 dark:bg-slate-950/50">
            <input type="checkbox" checked={showObjective} onChange={(e) => setShowObjective(e.target.checked)} className="accent-rose-600" />
            Đường mục tiêu
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 dark:bg-slate-950/50">
            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="accent-emerald-600" />
            Nhãn điểm/đường
          </label>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[780px] rounded-3xl bg-white shadow-inner dark:bg-slate-950">
            <defs>
              <marker id="axis-arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L8,3 z" className="fill-slate-500 dark:fill-slate-400" />
              </marker>
              <marker id="objective-arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L8,3 z" className="fill-rose-500" />
              </marker>
            </defs>

            {/* Minor grid */}
            {xTicks.map((x) => (
              <line key={`x-${x}`} x1={xScale(x)} x2={xScale(x)} y1={pad} y2={height - pad} className="stroke-slate-100 dark:stroke-slate-900" strokeWidth={1} />
            ))}
            {yTicks.map((y) => (
              <line key={`y-${y}`} x1={pad} x2={width - pad} y1={yScale(y)} y2={yScale(y)} className="stroke-slate-100 dark:stroke-slate-900" strokeWidth={1} />
            ))}

            {/* Axes */}
            {minY <= 0 && maxY >= 0 ? (
              <line x1={pad} x2={width - pad} y1={yScale(0)} y2={yScale(0)} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth={1.8} markerEnd="url(#axis-arrow)" />
            ) : (
              <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} className="stroke-slate-400" strokeWidth={1.4} markerEnd="url(#axis-arrow)" />
            )}
            {minX <= 0 && maxX >= 0 ? (
              <line x1={xScale(0)} x2={xScale(0)} y1={height - pad} y2={pad} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth={1.8} markerEnd="url(#axis-arrow)" />
            ) : (
              <line x1={pad} x2={pad} y1={height - pad} y2={pad} className="stroke-slate-400" strokeWidth={1.4} markerEnd="url(#axis-arrow)" />
            )}

            {/* Tick labels */}
            {xTicks.map((x) => (
              <text key={`xt-${x}`} x={xScale(x)} y={height - 18} textAnchor="middle" className="fill-slate-500 text-[11px]">{fmt(x, 1)}</text>
            ))}
            {yTicks.map((y) => (
              <text key={`yt-${y}`} x={20} y={yScale(y) + 4} className="fill-slate-500 text-[11px]">{fmt(y, 1)}</text>
            ))}

            {/* Feasible region clipped by viewport */}
            {showFeasible && visibleFeasibleRegion.length >= 3 && (
              <path d={`${polygonPath(visibleFeasibleRegion) ?? ''}Z`} className="fill-indigo-500/20 stroke-indigo-500" strokeWidth={2.2} />
            )}

            {/* Constraint lines */}
            {lineSegments.map((l, i) => l.samples.length === 2 && (
              <g key={i} onMouseEnter={() => setActiveLineIndex(i)} onMouseLeave={() => setActiveLineIndex(null)}>
                <line
                  x1={xScale(l.samples[0].x)}
                  y1={yScale(l.samples[0].y)}
                  x2={xScale(l.samples[1].x)}
                  y2={yScale(l.samples[1].y)}
                  className={activeLineIndex === i ? 'stroke-sky-600 dark:stroke-sky-400' : 'stroke-slate-400 dark:stroke-slate-600'}
                  strokeWidth={activeLineIndex === i ? 3 : 1.6}
                />
                {showLabels && (
                  <text
                    x={(xScale(l.samples[0].x) + xScale(l.samples[1].x)) / 2 + 6}
                    y={(yScale(l.samples[0].y) + yScale(l.samples[1].y)) / 2 - 6}
                    className={activeLineIndex === i ? 'fill-sky-700 text-xs font-bold dark:fill-sky-300' : 'fill-slate-500 text-[11px] dark:fill-slate-400'}
                  >
                    {l.label}
                  </text>
                )}
              </g>
            ))}

            {/* Adjustable objective line */}
            {showObjective && objectiveEnabled && objectiveSegment.length === 2 && (
              <g>
                <line
                  x1={xScale(objectiveSegment[0].x)}
                  y1={yScale(objectiveSegment[0].y)}
                  x2={xScale(objectiveSegment[1].x)}
                  y2={yScale(objectiveSegment[1].y)}
                  className="stroke-rose-200 dark:stroke-rose-950"
                  strokeWidth={9}
                  strokeLinecap="round"
                  opacity={0.75}
                />
                <line
                  x1={xScale(objectiveSegment[0].x)}
                  y1={yScale(objectiveSegment[0].y)}
                  x2={xScale(objectiveSegment[1].x)}
                  y2={yScale(objectiveSegment[1].y)}
                  className="stroke-rose-500"
                  strokeWidth={3.4}
                  strokeDasharray="9 5"
                  strokeLinecap="round"
                />
                {showLabels && (
                  <g>
                    <rect
                      x={Math.min(width - 180, Math.max(pad, xScale(objectiveSegment[1].x) - 152))}
                      y={Math.max(pad + 6, yScale(objectiveSegment[1].y) - 34)}
                      width={150}
                      height={24}
                      rx={10}
                      className="fill-white stroke-rose-200 dark:fill-slate-950 dark:stroke-rose-900"
                    />
                    <text
                      x={Math.min(width - 105, Math.max(pad + 75, xScale(objectiveSegment[1].x) - 77))}
                      y={Math.max(pad + 22, yScale(objectiveSegment[1].y) - 17)}
                      className="fill-rose-600 text-xs font-black dark:fill-rose-300"
                      textAnchor="middle"
                    >
                      z = {fmt(zValue)}
                    </text>
                  </g>
                )}
              </g>
            )}

            {/* Objective improvement direction */}
            {showObjective && objectiveEnabled && (
              <g>
                <line
                  x1={directionStart.x}
                  y1={directionStart.y}
                  x2={directionEnd.x}
                  y2={directionEnd.y}
                  className="stroke-rose-500"
                  strokeWidth={2.5}
                  markerEnd="url(#objective-arrow)"
                />
                {showLabels && <text x={directionStart.x - 8} y={directionStart.y - 12} className="fill-rose-600 text-xs font-bold dark:fill-rose-400">hướng cải thiện z</text>}
              </g>
            )}

            {/* Optimal segment */}
            {result.optimalSegment && (
              <g>
                <line
                  x1={xScale(result.optimalSegment.a.x)}
                  y1={yScale(result.optimalSegment.a.y)}
                  x2={xScale(result.optimalSegment.b.x)}
                  y2={yScale(result.optimalSegment.b.y)}
                  className="stroke-emerald-500"
                  strokeWidth={6}
                  strokeLinecap="round"
                />
                <circle cx={xScale(result.optimalSegment.a.x)} cy={yScale(result.optimalSegment.a.y)} r={7} className="fill-emerald-600" />
                <circle cx={xScale(result.optimalSegment.b.x)} cy={yScale(result.optimalSegment.b.y)} r={7} className="fill-emerald-600" />
              </g>
            )}

            {/* Vertices */}
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={xScale(p.x)} cy={yScale(p.y)} r={4.5} className="fill-indigo-700 dark:fill-indigo-300" />
                {showLabels && (
                  <text x={xScale(p.x) + 7} y={yScale(p.y) - 7} className="fill-slate-700 text-[11px] font-bold dark:fill-slate-300">
                    {LETTERS[i] ?? `P${i + 1}`}({fmt(p.x)}, {fmt(p.y)})
                  </text>
                )}
              </g>
            ))}

            {/* Unique optimal point */}
            {result.optimalPoint && !result.optimalSegment && (
              <g>
                <circle cx={xScale(result.optimalPoint.x)} cy={yScale(result.optimalPoint.y)} r={8} className="fill-rose-500" />
                {showLabels && (
                  <text x={xScale(result.optimalPoint.x) + 10} y={yScale(result.optimalPoint.y) + 18} className="fill-rose-600 text-xs font-bold dark:fill-rose-400">
                    Tối ưu z={fmt(result.optimalPoint.value)}
                  </text>
                )}
              </g>
            )}

            <text x={width - 34} y={minY <= 0 && maxY >= 0 ? yScale(0) - 8 : height - 22} className="fill-slate-600 text-sm font-bold dark:fill-slate-400">x₁</text>
            <text x={minX <= 0 && maxX >= 0 ? xScale(0) + 8 : 18} y={32} className="fill-slate-600 text-sm font-bold dark:fill-slate-400">x₂</text>
          </svg>
        </div>

        <div className="space-y-3 text-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-2 font-black">Chú thích</div>
            <div className="space-y-2">
              <div><span className="mr-2 inline-block h-3 w-6 rounded bg-indigo-500/30 align-middle" />Miền chấp nhận được</div>
              <div><span className="mr-2 inline-block h-0.5 w-6 bg-slate-500 align-middle" />Đường ràng buộc</div>
              <div><span className="mr-2 inline-block h-0.5 w-6 border-t-2 border-dashed border-rose-500 align-middle" />Đường mục tiêu</div>
              <div><span className="mr-2 inline-block h-2 w-6 rounded bg-emerald-500 align-middle" />Đoạn tối ưu</div>
              <div><span className="mr-2 inline-block h-3 w-3 rounded-full bg-rose-500 align-middle" />Điểm tối ưu duy nhất</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-2 font-black">Ràng buộc</div>
            <div className="max-h-52 space-y-1 overflow-auto pr-1">
              {result.lines.map((line, index) => (
                <button
                  key={`${line.label}-${index}`}
                  type="button"
                  onMouseEnter={() => setActiveLineIndex(index)}
                  onMouseLeave={() => setActiveLineIndex(null)}
                  onClick={() => setActiveLineIndex(activeLineIndex === index ? null : index)}
                  className={`w-full rounded-xl px-2 py-2 text-left text-xs transition ${activeLineIndex === index ? 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100' : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800'}`}
                >
                  {lineDisplay(line)}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="font-black">Trạng thái hình học</div>
            <p className="mt-2 text-slate-600 dark:text-slate-300">{result.message}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">Số đỉnh khả thi: <b>{pts.length}</b></div>
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">Đường mục tiêu hiện tại: <b>z = {fmt(zValue)}</b></div>
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">Viewport zoom: <b>{fmt(1 / zoom, 2)}×</b></div>
      </div>

      {visibleFeasibleRegion.length >= 3 && (
        <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100">
          Miền chấp nhận được đang được tô màu trong khung nhìn hiện tại. Với trường hợp không giới nội, phần được tô là phần miền nghiệm nhìn thấy trên đồ thị.
        </div>
      )}

      {result.optimalSegment && (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          Vô số nghiệm tối ưu: miền nghiệm tối ưu là đoạn {optimalSegmentName || 'AB'} với A = ({fmt(result.optimalSegment.a.x)}, {fmt(result.optimalSegment.a.y)}) và B = ({fmt(result.optimalSegment.b.x)}, {fmt(result.optimalSegment.b.y)}).
        </div>
      )}

      {visibleFeasibleRegion.length === 0 && (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          Không có miền chấp nhận được trong khung nhìn hiện tại. Nếu bài toán vô nghiệm, các ràng buộc không có giao chung.
        </div>
      )}
    </Card>
  );
}
