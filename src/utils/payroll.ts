/**
 * Phase 4B: local DEMO payroll estimate only.
 * This module has no Firebase writes and must not be used as a legal payslip.
 */
import type { DailyTimesheetRow, ShiftDefinition } from '../types/factory';

export type PayrollBasis = 'Ngày' | 'Giờ' | 'Tháng' | 'Sản lượng';
export interface PayrollPreviewInput {
  basis: PayrollBasis;
  rate: number;                // VND/day, hour, month or accepted kilogram
  paidDays: number;
  regularHours: number;        // excludes overtime to avoid double payment
  overtimeHours: number;
  overtimeMultiplier: number;  // configurable; no legal default asserted
  standardDays: number;
  standardHoursPerDay: number;
  acceptedProductionKg: number; // must be separately approved before production use
  overtimeRatePerHour?: number; // required to pay OT for piecework employees
  allowance: number;
  bonus: number;
  advance: number;
  deductions: number;
}
export interface PayrollPreviewResult {
  basePay: number;
  overtimePay: number;
  grossPay: number;
  totalDeduction: number;
  netPay: number;
  uncoveredDeduction: number;
}

function validAmount(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} phải là số không âm hợp lệ.`);
  return value;
}
export function calculatePayrollPreview(input: PayrollPreviewInput): PayrollPreviewResult {
  const rate = validAmount('Đơn giá', input.rate);
  const days = validAmount('Ngày công', input.paidDays);
  const regularHours = validAmount('Giờ công', input.regularHours);
  const overtimeHours = validAmount('Giờ tăng ca', input.overtimeHours);
  const multiplier = validAmount('Hệ số tăng ca', input.overtimeMultiplier);
  const standardDays = validAmount('Ngày công chuẩn', input.standardDays);
  const standardHours = validAmount('Giờ chuẩn/ngày', input.standardHoursPerDay);
  const productionKg = validAmount('Sản lượng', input.acceptedProductionKg);
  const allowance = validAmount('Phụ cấp', input.allowance);
  const bonus = validAmount('Thưởng', input.bonus);
  const advance = validAmount('Tạm ứng', input.advance);
  const deductions = validAmount('Khấu trừ', input.deductions);
  let base = 0;
  let hourlyRate = 0;
  if (input.basis === 'Ngày') {
    if (standardHours <= 0) throw new Error('Giờ chuẩn/ngày phải lớn hơn 0.');
    base = days * rate;
    hourlyRate = rate / standardHours;
  } else if (input.basis === 'Giờ') {
    base = regularHours * rate;
    hourlyRate = rate;
  } else if (input.basis === 'Tháng') {
    if (standardDays <= 0 || standardHours <= 0) throw new Error('Ngày và giờ chuẩn phải lớn hơn 0.');
    base = Math.min(days / standardDays, 1) * rate;
    hourlyRate = rate / (standardDays * standardHours);
  } else if (input.basis === 'Sản lượng') {
    base = productionKg * rate;
    if (overtimeHours > 0 && input.overtimeRatePerHour === undefined) {
      throw new Error('Lương sản lượng có tăng ca cần đơn giá tăng ca/giờ riêng.');
    }
    hourlyRate = validAmount('Đơn giá tăng ca riêng', input.overtimeRatePerHour ?? 0);
  } else {
    throw new Error('Hình thức trả lương không hợp lệ.');
  }
  const basePay = Math.round(base);
  const overtimePay = Math.round(overtimeHours * hourlyRate * multiplier);
  const grossPay = basePay + overtimePay + Math.round(allowance) + Math.round(bonus);
  const totalDeduction = Math.round(advance) + Math.round(deductions);
  return {
    basePay,
    overtimePay,
    grossPay,
    totalDeduction,
    netPay: Math.max(0, grossPay - totalDeduction),
    uncoveredDeduction: Math.max(0, totalDeduction - grossPay),
  };
}

/** Only completed check-in / check-out pairs (and approved fallback events) are counted. */
export function aggregateApprovedTime(
  rows: DailyTimesheetRow[],
  employeeCode: string,
  yyyyMM: string,
  shifts: ShiftDefinition[],
): { paidDays: number; regularHours: number; overtimeHours: number; completedShifts: number } {
  let paidDays = 0;
  let regularHours = 0;
  let overtimeHours = 0;
  let completedShifts = 0;
  for (const row of rows) {
    if (row.employeeCode !== employeeCode ||
        `${row.workDateStr.slice(6, 10)}-${row.workDateStr.slice(3, 5)}` !== yyyyMM ||
        row.checkInTime === '—' || row.checkOutTime === '—' || row.actualHours <= 0) continue;
    const regular = Math.max(0, row.actualHours - row.overtimeHours);
    const shift = shifts.find(s => s.name === row.shiftName);
    const standard = Math.max(0.1, shift?.hoursCount || 8);
    regularHours += regular;
    overtimeHours += Math.max(0, row.overtimeHours);
    paidDays += Math.min(1, regular / standard);
    completedShifts++;
  }
  return {
    paidDays: Math.round(paidDays * 100) / 100,
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    completedShifts,
  };
}
