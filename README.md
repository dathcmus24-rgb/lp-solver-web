# Linear Programming Solver Web

Website học tập để giải bài toán Quy hoạch tuyến tính bằng React + TypeScript + TailwindCSS.

## Tính năng

- Nhập bài toán LP từ form: min/max, số biến, số ràng buộc, ma trận A, dấu ràng buộc, vector b.
- Hỗ trợ loại biến: `x >= 0`, `x <= 0`, `x tự do`.
- Tự chuyển về mô hình chuẩn để giải trên biến không âm.
- Tự cài đặt thuật toán, không dùng LP solver có sẵn:
  - Simplex tableau
  - Bland Rule
  - Two-Phase Simplex
- Hiển thị chi tiết từng iteration:
  - biến vào
  - biến ra
  - reduced cost
  - ratio test
  - pivot element
  - basis hiện tại
  - tableau sau pivot
- Phương pháp hình học cho bài toán 2 biến.
- Dark mode, responsive layout, animation bằng Framer Motion.

## Cài đặt

```bash
npm install
npm run dev
```

Sau đó mở địa chỉ Vite hiển thị trong terminal, thường là:

```bash
http://localhost:5173
```

## Cấu trúc thư mục

```text
lp-solver-web/
├── src/
│   ├── components/
│   │   ├── Card.tsx
│   │   ├── GeometryGraph.tsx
│   │   ├── InputPanel.tsx
│   │   ├── MethodPanel.tsx
│   │   ├── ResultPanel.tsx
│   │   └── TableauView.tsx
│   ├── lib/
│   │   ├── format.ts
│   │   ├── geometry.ts
│   │   ├── simplex.ts
│   │   ├── standardize.ts
│   │   └── types.ts
│   ├── styles/
│   │   └── index.css
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Ghi chú thuật toán

Quy ước nội bộ của simplex là giải bài toán minimization. Nếu người dùng nhập bài toán `max`, chương trình đổi thành `min -c^T x`, sau đó đổi dấu giá trị tối ưu khi hiển thị kết quả cuối.

Biến tự do được đổi theo công thức:

```text
x = x⁺ - x⁻, x⁺ >= 0, x⁻ >= 0
```

Biến `x <= 0` được đổi thành:

```text
x = -u, u >= 0
```

Two-Phase thêm biến giả cho các ràng buộc `>=` và `=`, chạy Phase 1 để tìm phương án cơ sở khả thi, sau đó loại biến giả và chạy Phase 2 với hàm mục tiêu thật.
