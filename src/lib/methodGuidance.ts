import type { LPInput, SolveMethod } from './types';
import { EPS } from './format';
import { standardize } from './standardize';

export type GuidanceSeverity = 'ok' | 'info' | 'warning' | 'error';

export interface MethodGuidance {
  severity: GuidanceSeverity;
  canRun: boolean;
  title: string;
  message: string;
  recommendedMethod?: SolveMethod;
  reasons: string[];
  nextSteps: string[];
  facts: {
    hasNegativeRhs: boolean;
    hasZeroRhs: boolean;
    minRhs: number;
    standardizedRows: number;
    variableCount: number;
  };
}

function baseFacts(input: LPInput) {
  const standard = standardize(input);
  const rhsValues = standard.constraints.map((row) => row.b);
  const minRhs = rhsValues.length > 0 ? Math.min(...rhsValues) : 0;

  return {
    standard,
    facts: {
      hasNegativeRhs: rhsValues.some((b) => b < -EPS),
      hasZeroRhs: rhsValues.some((b) => Math.abs(b) <= EPS),
      minRhs,
      standardizedRows: standard.constraints.length,
      variableCount: input.n,
    },
  };
}

export function analyzeMethod(input: LPInput, method: SolveMethod): MethodGuidance {
  const { facts } = baseFacts(input);

  if (method === 'geometric') {
    if (input.n !== 2) {
      return {
        severity: 'error',
        canRun: false,
        title: 'Không thể dùng phương pháp hình học',
        message: `Phương pháp hình học trong app chỉ hỗ trợ bài toán 2 biến, nhưng bài toán hiện có ${input.n} biến.`,
        recommendedMethod: facts.hasNegativeRhs ? 'two-phase' : facts.hasZeroRhs ? 'bland' : 'simplex',
        reasons: [
          'Phương pháp hình học cần vẽ miền nghiệm trên mặt phẳng Oxy.',
          'Khi số biến khác 2, miền nghiệm không thể hiển thị bằng đồ thị 2D hiện tại.',
        ],
        nextSteps: ['Chọn Simplex, Bland hoặc Two-Phase tùy theo dấu của bᵢ sau chuẩn hóa.'],
        facts,
      };
    }

    return {
      severity: 'ok',
      canRun: true,
      title: 'Có thể dùng phương pháp hình học',
      message: 'Bài toán có 2 biến nên có thể vẽ miền nghiệm và kiểm tra trực quan.',
      reasons: ['Số biến bằng 2.'],
      nextSteps: ['Bấm Chạy toàn bộ để xem đồ thị và kết quả hình học.'],
      facts,
    };
  }

  if (method === 'simplex') {
    if (facts.hasNegativeRhs) {
      return {
        severity: 'error',
        canRun: false,
        title: 'Chọn sai phương pháp: Simplex chưa khởi tạo được',
        message: 'Sau khi đưa về dạng chuẩn còn tồn tại bᵢ < 0. Simplex trực tiếp không có từ vựng xuất phát khả thi.',
        recommendedMethod: 'two-phase',
        reasons: [
          'Dạng chuẩn của project là min cᵀx, Ax ≤ b, xᵢ ≥ 0.',
          'Nếu có bᵢ < 0, biến cơ sở wᵢ = bᵢ ban đầu âm nên chưa khả thi.',
          'Simplex trực tiếp cần một từ vựng xuất phát khả thi.',
        ],
        nextSteps: ['Chuyển sang Two-Phase để tạo từ vựng khả thi bằng biến x₀.'],
        facts,
      };
    }

    if (facts.hasZeroRhs) {
      return {
        severity: 'warning',
        canRun: true,
        title: 'Simplex chạy được nhưng có thể suy biến',
        message: 'Sau khi chuẩn hóa có bᵢ = 0. Simplex vẫn có thể chạy, nhưng có nguy cơ suy biến/cycling.',
        recommendedMethod: 'bland',
        reasons: [
          'bᵢ = 0 làm một biến cơ sở ban đầu bằng 0.',
          'Đây là dấu hiệu suy biến trong từ vựng xuất phát.',
        ],
        nextSteps: ['Có thể chạy Simplex, nhưng Bland Rule là lựa chọn an toàn hơn.'],
        facts,
      };
    }

    return {
      severity: 'ok',
      canRun: true,
      title: 'Simplex phù hợp',
      message: 'Sau khi đưa về dạng chuẩn, mọi bᵢ > 0 nên có từ vựng xuất phát khả thi.',
      reasons: ['Không có RHS âm.', 'Không có RHS bằng 0.'],
      nextSteps: ['Bấm Chạy toàn bộ để giải trực tiếp bằng Simplex.'],
      facts,
    };
  }

  if (method === 'bland') {
    if (facts.hasNegativeRhs) {
      return {
        severity: 'error',
        canRun: false,
        title: 'Chọn sai phương pháp: Bland cũng cần khởi tạo khả thi',
        message: 'Bland chống cycling tốt, nhưng nếu còn bᵢ < 0 thì vẫn chưa có từ vựng xuất phát khả thi.',
        recommendedMethod: 'two-phase',
        reasons: [
          'Bland chỉ thay đổi quy tắc chọn biến vào/ra.',
          'Bland không tự tạo từ vựng khả thi khi RHS âm.',
          'Nếu bᵢ < 0, cần Pha 1 để khởi tạo.',
        ],
        nextSteps: ['Chuyển sang Two-Phase.'],
        facts,
      };
    }

    if (facts.hasZeroRhs) {
      return {
        severity: 'ok',
        canRun: true,
        title: 'Bland phù hợp cho trường hợp suy biến',
        message: 'Sau khi chuẩn hóa có bᵢ = 0. Bland Rule là lựa chọn tốt vì giảm nguy cơ cycling.',
        reasons: [
          'bᵢ = 0 có thể gây suy biến.',
          'Bland chọn biến theo chỉ số nhỏ để tránh lặp vô hạn.',
        ],
        nextSteps: ['Bấm Chạy toàn bộ để giải bằng Bland Rule.'],
        facts,
      };
    }

    return {
      severity: 'ok',
      canRun: true,
      title: 'Bland có thể giải trực tiếp',
      message: 'Sau khi đưa về dạng chuẩn, mọi bᵢ > 0. Bland sẽ giải trực tiếp như Simplex nhưng chọn biến theo chỉ số nhỏ.',
      reasons: ['Không có RHS âm.', 'Từ vựng xuất phát khả thi.'],
      nextSteps: ['Bấm Chạy toàn bộ để giải bằng Bland Rule.'],
      facts,
    };
  }

  if (facts.hasNegativeRhs) {
    return {
      severity: 'ok',
      canRun: true,
      title: 'Two-Phase là phương pháp phù hợp',
      message: 'Sau khi đưa về dạng chuẩn có bᵢ < 0. Cần Pha 1 với biến x₀ để tìm từ vựng xuất phát khả thi.',
      reasons: [
        'Có ít nhất một RHS âm.',
        'Two-Phase sẽ tạo bài toán bổ trợ, pivot x₀ vào hàng có RHS âm, rồi giải Pha 1.',
      ],
      nextSteps: ['Bấm Chạy toàn bộ để xem Pha 1 và Pha 2.'],
      facts,
    };
  }

  return {
    severity: 'info',
    canRun: true,
    title: 'Two-Phase không bắt buộc trong bài này',
    message: 'Sau khi đưa về dạng chuẩn, mọi bᵢ ≥ 0 nên bài toán đã có từ vựng xuất phát khả thi.',
    recommendedMethod: facts.hasZeroRhs ? 'bland' : 'simplex',
    reasons: [
      'Không có RHS âm.',
      'Pha 1 không cần thiết vì đã có cơ sở xuất phát khả thi.',
    ],
    nextSteps: ['Có thể chạy Two-Phase để xem app xử lý, hoặc chuyển sang Simplex/Bland để giải trực tiếp.'],
    facts,
  };
}
