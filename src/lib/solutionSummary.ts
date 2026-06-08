import type { GeometryOptimalLine, GeometryOptimalRay, SimplexResult, SolveMethod } from './types';
import { fmt } from './format';
import { solveGeometric } from './geometry';
import { analyzeTwoPhaseX0, type TwoPhaseX0Analysis } from './twoPhaseX0';

export interface ResultSummary {
  methodText: string;
  statusText: string;
  solutionText: string;
  optimalValueText: string;
  conclusion: string;
  optimalSegment?: {
    a: { x: number; y: number };
    b: { x: number; y: number };
  };
  optimalLine?: GeometryOptimalLine;
  optimalRay?: GeometryOptimalRay;
}

const methodLabels: Record<SolveMethod, string> = {
  geometric: 'Phương pháp hình học',
  simplex: 'Phương pháp đơn hình',
  bland: 'Quy tắc Bland',
  'two-phase': 'Phương pháp hai pha',
};

function statusText(status: SimplexResult['status']): string {
  if (status === 'optimal') return 'Tối ưu';
  if (status === 'infeasible') return 'Vô nghiệm';
  if (status === 'unbounded') return 'Không giới nội';
  if (status === 'iteration-limit') return 'Vượt giới hạn lặp';
  if (status === 'error') return 'Lỗi / chưa thể giải';
  return 'Chưa chạy';
}

function objectivePrefix(result: SimplexResult): 'max' | 'min' {
  return result.standard.original.optimization;
}

function objectiveValueText(result: SimplexResult): string {
  const prefix = objectivePrefix(result);

  if (result.status === 'optimal' && result.optimalValue != null) {
    return `${prefix} z = ${fmt(result.optimalValue)}`;
  }

  if (result.status === 'infeasible') {
    return prefix === 'max' ? 'max z = -∞' : 'min z = +∞';
  }

  if (result.status === 'unbounded') {
    return prefix === 'max' ? 'max z = +∞' : 'min z = -∞';
  }

  return '—';
}

function objectiveValueTextFromTwoPhaseX0(result: SimplexResult, analysis: TwoPhaseX0Analysis): string {
  const prefix = objectivePrefix(result);

  if (analysis.status === 'optimal' && analysis.optimalValue != null) {
    return `${prefix} z = ${fmt(analysis.optimalValue)}`;
  }

  if (analysis.status === 'infeasible') {
    return prefix === 'max' ? 'max z = -∞' : 'min z = +∞';
  }

  if (analysis.status === 'unbounded') {
    return prefix === 'max' ? 'max z = +∞' : 'min z = -∞';
  }

  return '—';
}

function formatSolutionVector(result: SimplexResult): string {
  if (result.solutionOriginal.length === 0) return '—';

  return result.solutionOriginal
    .map((value, index) => `x${index + 1} = ${fmt(value)}`)
    .join(', ');
}

function formatOriginalVector(solution: number[] | undefined): string {
  if (!solution || solution.length === 0) return '—';

  return solution
    .map((value, index) => `x${index + 1} = ${fmt(value)}`)
    .join(', ');
}

function formatTwoPhaseX0Solution(analysis: TwoPhaseX0Analysis): string {
  if (analysis.status === 'infeasible') return 'Không có nghiệm khả thi';
  if (analysis.status === 'unbounded') return 'Không có nghiệm tối ưu hữu hạn';
  if (analysis.status !== 'optimal') return '—';

  if (analysis.solutionOriginal.length === 0) return '—';

  if (analysis.hasAlternateOptimum) {
    const alternate = analysis.alternateSolutionOriginal ? `; một nghiệm tối ưu khác là ${formatOriginalVector(analysis.alternateSolutionOriginal)}` : '';
    return `Vô số nghiệm tối ưu; một nghiệm đại diện là ${formatOriginalVector(analysis.solutionOriginal)}${alternate}`;
  }

  return formatOriginalVector(analysis.solutionOriginal);
}

function findOptimalSegment(result: SimplexResult): ResultSummary['optimalSegment'] {
  if (result.status !== 'optimal') return undefined;
  if (!result.hasAlternateOptimum) return undefined;
  if (result.standard.original.n !== 2) return undefined;
  if (result.optimalValue == null) return undefined;

  const geom = solveGeometric(result.standard.original);
  if (geom.optimalSegment) return { a: geom.optimalSegment.a, b: geom.optimalSegment.b };

  const optimalPoints = geom.feasiblePoints.filter((point) => Math.abs(point.value - result.optimalValue!) < 1e-7);

  if (optimalPoints.length < 2) return undefined;

  let bestPair: ResultSummary['optimalSegment'] | undefined;
  let bestDistance = -1;

  for (let i = 0; i < optimalPoints.length; i += 1) {
    for (let j = i + 1; j < optimalPoints.length; j += 1) {
      const p = optimalPoints[i];
      const q = optimalPoints[j];
      const distance = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

      if (distance > bestDistance) {
        bestDistance = distance;
        bestPair = { a: { x: p.x, y: p.y }, b: { x: q.x, y: q.y } };
      }
    }
  }

  return bestPair;
}

function findOptimalLine(result: SimplexResult): GeometryOptimalLine | undefined {
  if (result.status !== 'optimal') return undefined;
  if (result.standard.original.n !== 2) return undefined;

  const geom = solveGeometric(result.standard.original);
  return geom.optimalLine;
}

function optimalLineText(line: GeometryOptimalLine): string {
  return line.label ?? `${fmt(line.a)}x1 + ${fmt(line.b)}x2 = ${fmt(line.rhs)}`;
}

function findOptimalRay(result: SimplexResult): GeometryOptimalRay | undefined {
  if (result.status !== 'optimal') return undefined;
  if (result.standard.original.n !== 2) return undefined;

  const geom = solveGeometric(result.standard.original);
  return geom.optimalRay;
}

function optimalRayText(ray: GeometryOptimalRay): string {
  const line = ray.lineLabel ? ` thuộc đường ${ray.lineLabel}` : '';
  return `Vô số nghiệm tối ưu trên tia${line}, bắt đầu tại A = (${fmt(ray.start.x)}, ${fmt(ray.start.y)})`;
}

function solutionText(
  result: SimplexResult,
  optimalSegment?: ResultSummary['optimalSegment'],
  optimalLine?: GeometryOptimalLine,
  optimalRay?: GeometryOptimalRay,
): string {
  if (result.status === 'infeasible') return 'Không có nghiệm khả thi';
  if (result.status === 'unbounded') return 'Không có nghiệm tối ưu hữu hạn';
  if (result.status !== 'optimal') return '—';

  if (result.hasAlternateOptimum) {
    if (optimalLine) {
      return `Vô số nghiệm tối ưu trên đường ${optimalLineText(optimalLine)}`;
    }

    if (optimalRay) {
      return optimalRayText(optimalRay);
    }

    if (optimalSegment) {
      return `Vô số nghiệm trên đoạn AB, A = (${fmt(optimalSegment.a.x)}, ${fmt(optimalSegment.a.y)}), B = (${fmt(optimalSegment.b.x)}, ${fmt(optimalSegment.b.y)})`;
    }

    return `Vô số nghiệm tối ưu; một nghiệm đại diện là ${formatSolutionVector(result)}`;
  }

  return formatSolutionVector(result);
}

function buildTwoPhaseX0Summary(result: SimplexResult, analysis: TwoPhaseX0Analysis): ResultSummary {
  const valueText = objectiveValueTextFromTwoPhaseX0(result, analysis);
  const prefix = objectivePrefix(result);

  if (analysis.status === 'infeasible') {
    return {
      methodText: methodLabels[result.method],
      statusText: 'Vô nghiệm',
      solutionText: 'Không có nghiệm khả thi',
      optimalValueText: valueText,
      conclusion: `${analysis.reason} Theo quy ước kết luận hàm mục tiêu, ${prefix === 'max' ? 'max z = -∞' : 'min z = +∞'}.`,
    };
  }

  if (analysis.status === 'unbounded') {
    return {
      methodText: methodLabels[result.method],
      statusText: 'Không giới nội',
      solutionText: 'Không có nghiệm tối ưu hữu hạn',
      optimalValueText: valueText,
      conclusion: `${analysis.reason} Kết luận: ${prefix === 'max' ? 'max z = +∞' : 'min z = -∞'}.`,
    };
  }

  if (analysis.status === 'optimal') {
    const solution = formatTwoPhaseX0Solution(analysis);

    if (analysis.hasAlternateOptimum) {
      return {
        methodText: methodLabels[result.method],
        statusText: 'Tối ưu',
        solutionText: solution,
        optimalValueText: valueText,
        conclusion: `Bài toán có vô số nghiệm tối ưu. Một nghiệm tối ưu đại diện là ${formatOriginalVector(analysis.solutionOriginal)}${analysis.alternateSolutionOriginal ? `; một nghiệm tối ưu khác là ${formatOriginalVector(analysis.alternateSolutionOriginal)}` : ''}. Giá trị tối ưu của hàm mục tiêu là ${valueText}.`,
      };
    }

    return {
      methodText: methodLabels[result.method],
      statusText: 'Tối ưu',
      solutionText: solution,
      optimalValueText: valueText,
      conclusion: `Bài toán có nghiệm tối ưu tại ${solution}. Giá trị tối ưu của hàm mục tiêu là ${valueText}.`,
    };
  }

  return {
    methodText: methodLabels[result.method],
    statusText: statusText(result.status),
    solutionText: solutionText(result),
    optimalValueText: objectiveValueText(result),
    conclusion: result.message,
  };
}

export function buildResultSummary(result: SimplexResult): ResultSummary {
  // Với phương pháp hai pha, phần tổng kết đọc trực tiếp kết quả đã được
  // phân tích từ đúng dạng chuẩn trong analyzeTwoPhaseX0.
  if (result.method === 'two-phase') {
    const x0Analysis = analyzeTwoPhaseX0(result.standard);

    if (x0Analysis.hasNegativeRhs && x0Analysis.status !== 'skip') {
      return buildTwoPhaseX0Summary(result, x0Analysis);
    }
  }

  const optimalSegment = findOptimalSegment(result);
  const optimalLine = findOptimalLine(result);
  const optimalRay = findOptimalRay(result);
  const prefix = objectivePrefix(result);
  const valueText = objectiveValueText(result);
  let conclusion = result.message;

  if (result.status === 'optimal') {
    if (result.hasAlternateOptimum) {
      if (optimalLine) {
        conclusion = `Bài toán có vô số nghiệm tối ưu trên đường ${optimalLineText(optimalLine)}. Giá trị tối ưu của hàm mục tiêu là ${valueText}.`;
      } else if (optimalRay) {
        conclusion = `${optimalRayText(optimalRay)}. Giá trị tối ưu của hàm mục tiêu là ${valueText}.`;
      } else if (optimalSegment) {
        conclusion = `Bài toán có vô số nghiệm tối ưu. Miền nghiệm tối ưu là đoạn thẳng AB với A = (${fmt(optimalSegment.a.x)}, ${fmt(optimalSegment.a.y)}) và B = (${fmt(optimalSegment.b.x)}, ${fmt(optimalSegment.b.y)}). Mọi điểm trên đoạn AB đều là nghiệm tối ưu. Giá trị tối ưu của hàm mục tiêu là ${valueText}.`;
      } else {
        conclusion = `Bài toán có vô số nghiệm tối ưu do tồn tại phương án tối ưu khác. Một nghiệm tối ưu đại diện là ${formatSolutionVector(result)}. Giá trị tối ưu của hàm mục tiêu là ${valueText}.`;
      }
    } else {
      conclusion = `Bài toán có nghiệm tối ưu duy nhất tại ${formatSolutionVector(result)}. Giá trị tối ưu của hàm mục tiêu là ${valueText}.`;
    }
  } else if (result.status === 'infeasible') {
    conclusion = `Bài toán không có nghiệm khả thi. Theo quy ước kết luận hàm mục tiêu, ${prefix === 'max' ? 'max z = -∞' : 'min z = +∞'}.`;
  } else if (result.status === 'unbounded') {
    conclusion = `Bài toán không giới nội theo hướng làm hàm mục tiêu cải thiện vô hạn. Kết luận: ${prefix === 'max' ? 'max z = +∞' : 'min z = -∞'}.`;
  } else if (result.status === 'iteration-limit') {
    conclusion = 'Thuật toán đã vượt giới hạn số bước lặp. Cần kiểm tra lại bài toán hoặc dùng quy tắc Bland.';
  } else if (result.status === 'error') {
    conclusion = result.message || 'App chưa thể giải bài toán với phương pháp đang chọn.';
  }

  return {
    methodText: methodLabels[result.method] ?? result.method,
    statusText: statusText(result.status),
    solutionText: solutionText(result, optimalSegment, optimalLine, optimalRay),
    optimalValueText: valueText,
    conclusion,
    optimalSegment,
    optimalLine,
    optimalRay,
  };
}
