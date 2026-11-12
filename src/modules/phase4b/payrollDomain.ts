/** Phase 4B: workflow độc lập. Chỉ lưu sổ lương DEMO; Production cần backend server-side. */
import { calculatePayrollPreview, type PayrollBasis } from '../../utils/payroll';
export type PayrollStatus = 'draft' | 'submitted' | 'approved' | 'locked' | 'partially_paid' | 'paid';
export interface PayrollLine {
  employeeCode: string;
  employeeName: string;
  basis: string;
  paidDays: number;
  regularHours: number;
  overtimeHours: number;
  rate: number;
  productionKg: number;
  basePay: number;
  overtimePay: number;
  allowance: number;
  bonus: number;
  advance: number;
  deductions: number;
  netPay: number;
  overtimeMultiplier?: number; standardDays?: number; standardHoursPerDay?: number; overtimeRatePerHour?: number;
}
export interface PayrollPayment {
  id: string; employeeCode: string; amount: number; account: 'cash' | 'bank'; createdAt: string;
}
export interface PayrollPeriod {
  id: string;
  month: string;
  status: PayrollStatus;
  createdAt: string;
  updatedAt: string;
  lines: PayrollLine[];
  payments: PayrollPayment[];
  lastAction: string;
}
const allowed: Record<PayrollStatus, PayrollStatus[]> = {
  draft: ['submitted'],
  submitted: ['draft','approved'],
  approved: ['submitted','locked'],
  locked: [], partially_paid: [], paid: []
};
export function transitionPayroll(period: PayrollPeriod, next: PayrollStatus, at: string): PayrollPeriod {
  if (!allowed[period.status].includes(next)) throw new Error(`Không thể chuyển kỳ lương ${period.status} → ${next}`);
  return {...period, status:next,updatedAt:at,lastAction:`${period.status} → ${next}`};
}
export function totalNet(period: PayrollPeriod): number { return period.lines.reduce((s,i)=>s+i.netPay,0); }
export function totalPaid(period: PayrollPeriod): number { return period.payments.reduce((s,i)=>s+i.amount,0); }
export function payrollRemaining(period: PayrollPeriod, employeeCode?: string): number {
  const due = period.lines.filter(x=>!employeeCode || x.employeeCode===employeeCode).reduce((s,i)=>s+i.netPay,0);
  const paid = period.payments.filter(x=>!employeeCode || x.employeeCode===employeeCode).reduce((s,i)=>s+i.amount,0);
  return Math.max(0,due-paid);
}
export function registerPayrollPayment(period: PayrollPeriod, payment: PayrollPayment): PayrollPeriod {
  if (!['locked','partially_paid'].includes(period.status)) throw new Error('Kỳ lương chưa chốt hoặc đã thanh toán hết.');
  if (!period.lines.some(x=>x.employeeCode===payment.employeeCode)) throw new Error('Không tìm thấy nhân viên trong kỳ lương.');
  if (period.payments.some(x=>x.id===payment.id)) return period; // idempotent retry
  if (!Number.isSafeInteger(payment.amount) || payment.amount<=0) throw new Error('Số tiền thanh toán phải là số nguyên VNĐ dương.');
  if (payment.amount>payrollRemaining(period,payment.employeeCode)) throw new Error('Thanh toán vượt số tiền phải trả.');
  const payments=[...period.payments,payment];
  const balance=totalNet(period)-payments.reduce((s,x)=>s+x.amount,0);
  return {...period,payments,status:balance===0?'paid':'partially_paid',updatedAt:payment.createdAt,lastAction:`Thanh toán ${payment.id}`};
}
/** Draft-only recalculation; approved/locked periods are immutable snapshots. */
export function editPayrollLine(period:PayrollPeriod,employeeCode:string,patch:Partial<PayrollLine>,at:string):PayrollPeriod{
  if(period.status!=='draft')throw Error('Không thể sửa kỳ lương đã gửi duyệt hoặc đã chốt.');
  const prior=period.lines.find(x=>x.employeeCode===employeeCode);
  if(!prior)throw Error('Không tìm thấy nhân viên cần sửa.');
  const line:PayrollLine={...prior,...patch,employeeCode:prior.employeeCode,employeeName:prior.employeeName};
  const result=calculatePayrollPreview({
    basis:line.basis as PayrollBasis, rate:line.rate,paidDays:line.paidDays,
    regularHours:line.regularHours,overtimeHours:line.overtimeHours,
    overtimeMultiplier:line.overtimeMultiplier??0,standardDays:line.standardDays??26,
    standardHoursPerDay:line.standardHoursPerDay??8,
    acceptedProductionKg:line.productionKg,overtimeRatePerHour:line.overtimeRatePerHour??0,
    allowance:line.allowance,bonus:line.bonus,advance:line.advance,deductions:line.deductions
  });
  line.basePay=result.basePay;line.overtimePay=result.overtimePay;line.netPay=result.netPay;
  return {...period,lines:period.lines.map(x=>x.employeeCode===employeeCode?line:x),updatedAt:at,lastAction:`Chỉnh nháp ${employeeCode}`};
}
export function validatePayrollPeriod(p: PayrollPeriod): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month)) throw new Error('Kỳ lương không hợp lệ.');
  if (p.lines.length===0) throw new Error('Kỳ lương chưa có nhân viên.');
  if (new Set(p.lines.map(x=>x.employeeCode)).size!==p.lines.length) throw new Error('Nhân viên bị trùng trong kỳ lương.');
  p.lines.forEach(x=>{if (!Number.isSafeInteger(x.netPay)||x.netPay<0) throw new Error('Tiền lương thực nhận phải là VNĐ nguyên không âm.');});
}
export function safeCsvCell(value: unknown): string {
  let s=String(value??'');
  if (/^[=+@\-\t\r]/.test(s)) s="'"+s; // discourage spreadsheet formula injection
  return '"'+s.replace(/"/g,'""')+'"';
}
export function payrollCsv(period: PayrollPeriod): string {
  const rows=[['Mã NV','Họ tên','Công','Giờ thường','Tăng ca','Lương chính','Lương tăng ca','Ứng','Thực nhận','Đã trả','Còn trả'],...period.lines.map(x=>[x.employeeCode,x.employeeName,x.paidDays,x.regularHours,x.overtimeHours,x.basePay,x.overtimePay,x.advance,x.netPay,period.payments.filter(y=>y.employeeCode===x.employeeCode).reduce((s,y)=>s+y.amount,0),payrollRemaining(period,x.employeeCode)])];
  return '\uFEFF'+rows.map(x=>x.map(safeCsvCell).join(',')).join('\r\n');
}
