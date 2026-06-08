export type OptimizationType = 'min' | 'max';
export type ConstraintSign = '<=' | '>=' | '=';
export type VariableType = 'nonnegative' | 'nonpositive' | 'free';
export type SolveMethod = 'geometric' | 'simplex' | 'bland' | 'two-phase';
export type SolveStatus = 'not-run' | 'optimal' | 'infeasible' | 'unbounded' | 'iteration-limit' | 'error';

export interface LPInput {
  optimization: OptimizationType;
  n: number;
  m: number;
  c: number[];
  A: number[][];
  signs: ConstraintSign[];
  b: number[];
  variableTypes: VariableType[];
}

export interface ConstraintRow {
  a: number[];
  sign: ConstraintSign;
  b: number;
  label: string;
}

export interface VariableMapping {
  originalIndex: number;
  kind: 'same' | 'negated' | 'free-positive' | 'free-negative';
  label: string;
}

export interface StandardModel {
  c: number[];
  constraints: ConstraintRow[];
  mappings: VariableMapping[];
  original: LPInput;
  latex: string;
}

export interface TableauStep {
  phase: 'Simplex' | 'Bland' | 'Phase 1' | 'Phase 2';
  iteration: number;
  entering: number | null;
  leavingRow: number | null;
  leavingVariable: number | null;
  pivot: { row: number; col: number; value: number } | null;
  reducedCost: number | null;
  ratioTest: Array<{ row: number; basis: number; value: number | null }>;
  basis: number[];
  tableau: number[][];
  objectiveValue: number;
  variableNames: string[];
  note?: string;
}

export interface SolveDiagnostics {
  isDegenerate: boolean;
  hasAlternateOptimum: boolean;
  isCyclingRisk: boolean;
}

export interface SimplexResult {
  status: SolveStatus;
  method: SolveMethod;
  standard: StandardModel;
  variableNames: string[];
  basisNames: string[];
  steps: TableauStep[];
  solutionStandard: number[];
  solutionOriginal: number[];
  optimalValue: number | null;
  isDegenerate: boolean;
  hasAlternateOptimum: boolean;
  diagnostics: SolveDiagnostics;
  message: string;
}

export interface GeometryLine {
  a: number;
  b: number;
  rhs: number;
  sign: ConstraintSign;
  label: string;
}

export interface Point2D {
  x: number;
  y: number;
  value: number;
}

export interface GeometryOptimalLine {
  a: number;
  b: number;
  rhs: number;
  value: number;
  label?: string;
}

export interface GeometryOptimalRay {
  start: Point2D;
  dx: number;
  dy: number;
  value: number;
  lineLabel?: string;
}

export interface GeometryResult {
  supported: boolean;
  lines: GeometryLine[];
  feasiblePoints: Point2D[];
  optimalPoint: Point2D | null;
  optimalSegment?: { a: Point2D; b: Point2D };
  optimalLine?: GeometryOptimalLine;
  optimalRay?: GeometryOptimalRay;
  status: SolveStatus;
  message: string;
}
