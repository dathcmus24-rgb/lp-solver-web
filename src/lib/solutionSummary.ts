import type { SimplexResult, SolveMethod } from './types';
import { fmt } from './format';
import { solveGeometric } from './geometry';

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

function formatSolutionVector(result: SimplexResult): string {
  if (result.solutionOriginal.length === 0) return '—';

  return result.solutionOriginal
    .map((value, index) => `x${index + 1} = ${fmt(value)}`)
    .join(', ');
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

function solutionText(result: SimplexResult, optimalSegment?: ResultSummary['optimalSegment']): string {
  if (result.status === 'infeasible') return 'Không có nghiệm khả thi';
  if (result.status === 'unbounded') return 'Không có nghiệm tối ưu hữu hạn';
  if (result.status !== 'optimal') return '—';

  if (result.hasAlternateOptimum) {
    if (optimalSegment) {
      return `Vô số nghiệm trên đoạn AB, A = (${fmt(optimalSegment.a.x)}, ${fmt(optimalSegment.a.y)}), B = (${fmt(optimalSegment.b.x)}, ${fmt(optimalSegment.b.y)})`;
    }

    return `Vô số nghiệm tối ưu; một nghiệm đại diện: ${formatSolutionVector(result)}`;
  }

  return formatSolutionVector(result);
}

export function buildResultSummary(result: SimplexResult): ResultSummary {
  const optimalSegment = findOptimalSegment(result);
  const prefix = objectivePrefix(result);
  const valueText = objectiveValueText(result);
  let conclusion = result.message;

  if (result.status === 'optimal') {
    if (result.hasAlternateOptimum) {
      if (optimalSegment) {
        conclusion = `Bài toán có vô số nghiệm tối ưu. Miền nghiệm tối ưu là đoạn thẳng AB với A = (${fmt(optimalSegment.a.x)}, ${fmt(optimalSegment.a.y)}) và B = (${fmt(optimalSegment.b.x)}, ${fmt(optimalSegment.b.y)}). Mọi điểm trên đoạn AB đều là nghiệm tối ưu. Giá trị tối ưu của hàm mục tiêu là ${valueText}.`;
      } else {
        conclusion = `Bài toán có vô số nghiệm tối ưu do tồn tại phương án tối ưu khác. Giá trị tối ưu của hàm mục tiêu là ${valueText}.`;
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
    solutionText: solutionText(result, optimalSegment),
    optimalValueText: valueText,
    conclusion,
    optimalSegment,
  };
}
