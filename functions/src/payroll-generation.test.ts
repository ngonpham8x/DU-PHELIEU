import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayrollDraft, preparePayrollAdjustment, validateGeneratePayrollInput, validatePayrollAdjustmentInput } from './payroll-generation.js';

const employees = [
  { id: 'CN_001', workshopId: 'du_nhua_01', fullName: 'Nguyễn Văn A', shiftId: 'CA_1', salaryBasis: 'day' as const, baseRate: 300_000, status: 'active' },
  { id: 'CN_002', workshopId: 'du_nhua_01', fullName: 'Nguyễn Văn B', shiftId: 'CA_1', salaryBasis: 'month' as const, baseRate: 7_800_000, status: 'active' },
];
const shifts = [{ id: 'CA_1', workshopId: 'du_nhua_01', hoursCount: 8, breakMinutes: 60, isOvernight: false }];
const event = (id: string, employeeId: string, day: string, eventType: 'check_in' | 'check_out', timeMinutes: number) => ({
  id, employeeId, eventType, timeMinutes, workDate: `2026-11-${day}`, workshopId: 'du_nhua_01', approvalStatus: 'approved' as const,
});

test('backend tạo kỳ lương từ cặp công đã duyệt và giữ tiền ở số nguyên', () => {
  const result = buildPayrollDraft({
    workshopId: 'du_nhua_01', month: '2026-11', standardDays: 26, employees, shifts,
    attendance: [
      event('A_IN', 'CN_001', '01', 'check_in', 480), event('A_OUT', 'CN_001', '01', 'check_out', 1020),
      event('B_IN', 'CN_002', '01', 'check_in', 480), event('B_OUT', 'CN_002', '01', 'check_out', 1020),
    ],
  });
  assert.equal(result.lines[0].netPay, 300_000);
  assert.equal(result.lines[1].netPay, 300_000);
  assert.equal(result.netTotal, 600_000);
  assert.equal(result.sourceEventCount, 4);
});

test('backend không tính công thiếu ra ca và đánh dấu tăng ca cần đối soát', () => {
  const result = buildPayrollDraft({
    workshopId: 'du_nhua_01', month: '2026-11', standardDays: 26, employees: employees.slice(0, 1), shifts,
    attendance: [
      event('IN_ONLY', 'CN_001', '01', 'check_in', 480),
      event('IN_2', 'CN_001', '02', 'check_in', 480), event('OUT_2', 'CN_001', '02', 'check_out', 1080),
    ],
  });
  assert.equal(result.lines[0].paidDays, 1);
  assert.equal(result.lines[0].overtimeMinutes, 60);
  assert.equal(result.lines[0].requiresReview, true);
  assert.equal(result.unmatchedEventCount, 1);
});

test('backend hỗ trợ ca qua đêm nhưng chặn sự kiện sai tháng', () => {
  const nightShifts = [{ ...shifts[0], isOvernight: true }];
  const result = buildPayrollDraft({
    workshopId: 'du_nhua_01', month: '2026-11', standardDays: 26, employees: employees.slice(0, 1), shifts: nightShifts,
    attendance: [event('N_IN', 'CN_001', '03', 'check_in', 1320), event('N_OUT', 'CN_001', '03', 'check_out', 360)],
  });
  assert.equal(result.lines[0].paidDays, 1);
  assert.throws(() => buildPayrollDraft({
    workshopId: 'du_nhua_01', month: '2026-11', standardDays: 26, employees: employees.slice(0, 1), shifts,
    attendance: [{ ...event('BAD', 'CN_001', '03', 'check_in', 480), workDate: '2026-12-03' }],
  }), /không hợp lệ/);
});

test('backend kiểm tra tháng, ngày công chuẩn và giới hạn dữ liệu', () => {
  assert.deepEqual(validateGeneratePayrollInput({ workshopId: 'du_nhua_01', periodId: '2026_11', month: '2026-11' }), {
    workshopId: 'du_nhua_01', periodId: '2026_11', month: '2026-11', standardDays: 26,
  });
  assert.throws(() => validateGeneratePayrollInput({ workshopId: 'du_nhua_01', periodId: '2026_11', month: '11/2026' }), /YYYY-MM/);
});

test('backend đối soát tăng ca cập nhật thực nhận và không cho khấu trừ vượt thu nhập', () => {
  const adjustment = validatePayrollAdjustmentInput({
    workshopId: 'du_nhua_01', periodId: '2026_11', employeeId: 'CN_001', adjustmentId: 'ADJ_001',
    overtimePay: 100_000, allowance: 50_000, bonus: 0, advance: 50_000, deductions: 0,
    acceptedProductionGrams: 0, reason: 'Đã kiểm tra phiếu tăng ca',
  });
  const result = preparePayrollAdjustment({
    salaryBasis: 'day', rate: 300_000, basePay: 300_000, netPay: 300_000, overtimeMinutes: 60, requiresReview: true,
  }, adjustment);
  assert.equal(result.netPay, 400_000);
  assert.equal(result.netDelta, 100_000);
  assert.throws(() => preparePayrollAdjustment(
    { salaryBasis: 'day', rate: 300_000, basePay: 300_000, netPay: 300_000, overtimeMinutes: 60 },
    { ...adjustment, advance: 1_000_000 },
  ), /không được vượt/);
});

test('backend tính lương sản lượng theo gram nghiệm thu', () => {
  const adjustment = validatePayrollAdjustmentInput({
    workshopId: 'du_nhua_01', periodId: '2026_11', employeeId: 'CN_003', adjustmentId: 'ADJ_002',
    acceptedProductionGrams: 1_250_000, reason: 'Sản lượng đã nghiệm thu',
  });
  const result = preparePayrollAdjustment({
    salaryBasis: 'piecework', rate: 500, basePay: 0, netPay: 0, overtimeMinutes: 0, requiresReview: true,
  }, adjustment);
  assert.equal(result.basePay, 625_000);
  assert.equal(result.productionGrams, 1_250_000);
});
