import React, { useMemo, useState } from 'react';
import type { AttendanceRecord, EmployeeProfile, ShiftDefinition, UserRole } from '../types/factory';
import { computeDailyTimesheetRows, formatCurrencyVND } from '../utils/calculations';
import { aggregateApprovedTime, calculatePayrollPreview, type PayrollBasis } from '../utils/payroll';

interface Props {
  employees: EmployeeProfile[];
  attendance: AttendanceRecord[];
  shifts: ShiftDefinition[];
  envMode: 'demo' | 'production';
  role: UserRole;
}

export const PayrollPreview: React.FC<Props> = ({ employees, attendance, shifts, envMode, role }) => {
  const [employeeCode, setEmployeeCode] = useState('');
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(new Date()));
  const [overrideRate, setOverrideRate] = useState('');
  const [overrideBasis, setOverrideBasis] = useState<PayrollBasis | ''>('');
  const [productionKg, setProductionKg] = useState('0');
  const [overtimeMultiplier, setOvertimeMultiplier] = useState('1.5');
  const [overtimeRate, setOvertimeRate] = useState('0');
  const [standardDays, setStandardDays] = useState('26');
  const [standardHours, setStandardHours] = useState('8');
  const [allowance, setAllowance] = useState('0');
  const [bonus, setBonus] = useState('0');
  const [advance, setAdvance] = useState('0');
  const [deductions, setDeductions] = useState('0');

  const allowed = role === 'owner' || role === 'hr' || role === 'accountant';
  const employee = employees.find(e => e.code === employeeCode) || employees[0];
  const rows = useMemo(() => computeDailyTimesheetRows(attendance, employees, shifts), [attendance, employees, shifts]);
  const time = useMemo(() => aggregateApprovedTime(rows, employee?.code || '', month, shifts), [rows, employee?.code, month, shifts]);
  const basis = (overrideBasis || employee?.salaryType || 'Ngày') as PayrollBasis;
  const amount = (text: string) => Number(text.trim() || 0);
  const input = {
    basis,
    rate: overrideRate !== '' ? amount(overrideRate) : employee?.baseRate || 0,
    paidDays: time.paidDays,
    regularHours: time.regularHours,
    overtimeHours: time.overtimeHours,
    overtimeMultiplier: amount(overtimeMultiplier),
    standardDays: amount(standardDays),
    standardHoursPerDay: amount(standardHours),
    acceptedProductionKg: amount(productionKg),
    overtimeRatePerHour: amount(overtimeRate),
    allowance: amount(allowance), bonus: amount(bonus), advance: amount(advance), deductions: amount(deductions),
  };
  const calculated = (() => { try { return { result: calculatePayrollPreview(input), error: '' }; } catch (e) { return { result: null, error: e instanceof Error ? e.message : 'Dữ liệu không hợp lệ' }; } })();
  const inputCss = 'mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm';
  const labelledNumber = (title: string, value: string, onChange: (v: string) => void, step = '1') => (
    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{title}
      <input className={inputCss} inputMode="decimal" type="number" min="0" step={step} value={value} onChange={e => onChange(e.target.value)}/>
    </label>
  );

  if (envMode === 'production') return null;
  if (!allowed) return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">Bảng lương chỉ dành cho tài khoản được cấp quyền nhân sự hoặc kế toán. (Đang ở DEMO.)</section>
  );
  return (
    <section data-testid="payroll-demo-preview" className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="font-bold text-base text-slate-900 dark:text-white">Bảng tính lương dự kiến – Phase 4B</h2>
        <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold mt-1">DEMO: chỉ xem trước, không phải phiếu lương đã duyệt; không lưu Firestore và không trừ tiền sổ Thu – Chi.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-xs font-semibold">Nhân viên
          <select data-testid="payroll-employee" className={inputCss} value={employee?.code || ''} onChange={e=>{setEmployeeCode(e.target.value);setOverrideBasis('');setOverrideRate('');}}>
            {employees.map(e=><option key={e.code} value={e.code}>{e.code} – {e.fullName}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold">Kỳ lương
          <input data-testid="payroll-month" className={inputCss} type="month" value={month} onChange={e=>setMonth(e.target.value)}/>
        </label>
        <label className="text-xs font-semibold">Hình thức trả lương
          <select className={inputCss} value={basis} onChange={e=>setOverrideBasis(e.target.value as PayrollBasis)}>
            {(['Ngày','Giờ','Tháng','Sản lượng'] as PayrollBasis[]).map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {[['Ca đã đủ vào/ra',time.completedShifts],['Công quy đổi',time.paidDays],['Giờ thường',time.regularHours],['Giờ tăng ca',time.overtimeHours]].map(([label,v])=><div key={label} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3"><span className="block text-slate-500">{label}</span><strong className="text-lg tabular-nums">{v}</strong></div>)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {labelledNumber('Đơn giá lương (VNĐ)',overrideRate !== '' ? overrideRate : String(employee?.baseRate || 0),setOverrideRate)}
        {labelledNumber('Ngày công chuẩn/tháng',standardDays,setStandardDays)}
        {labelledNumber('Giờ chuẩn/ngày',standardHours,setStandardHours,'0.25')}
        {labelledNumber('Hệ số tăng ca (tùy chỉnh)',overtimeMultiplier,setOvertimeMultiplier,'0.1')}
        {labelledNumber('Sản lượng đã nghiệm thu (kg) – nhập thử',productionKg,setProductionKg,'0.01')}
        {labelledNumber('Đơn giá tăng ca riêng cho lương sản lượng',overtimeRate,setOvertimeRate)}
        {labelledNumber('Phụ cấp',allowance,setAllowance)}
        {labelledNumber('Thưởng',bonus,setBonus)}
        {labelledNumber('Đã tạm ứng',advance,setAdvance)}
        {labelledNumber('Khấu trừ hợp lệ khác',deductions,setDeductions)}
      </div>
      {calculated.error && <p role="alert" className="text-sm font-semibold text-rose-600">{calculated.error}</p>}
      {calculated.result && <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span>Lương chính</span><strong>{formatCurrencyVND(calculated.result.basePay)}</strong></div>
        <div className="flex justify-between"><span>Tăng ca</span><strong>{formatCurrencyVND(calculated.result.overtimePay)}</strong></div>
        <div className="flex justify-between"><span>Tổng trước khấu trừ</span><strong>{formatCurrencyVND(calculated.result.grossPay)}</strong></div>
        <div className="flex justify-between"><span>Tạm ứng + khấu trừ</span><strong>−{formatCurrencyVND(calculated.result.totalDeduction)}</strong></div>
        <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-bold text-emerald-700"><span>DỰ KIẾN THỰC NHẬN</span><span data-testid="payroll-preview-net">{formatCurrencyVND(calculated.result.netPay)}</span></div>
        {calculated.result.uncoveredDeduction > 0 && <p className="text-amber-700 text-xs">Khoản khấu trừ vượt lương: {formatCurrencyVND(calculated.result.uncoveredDeduction)}. Cần kiểm tra và xử lý riêng, không tự ghi nợ.</p>}
      </div>}
      <p className="text-xs text-slate-500">Công quy đổi tính từ ca đã có đủ giờ vào/ra được phê duyệt; sản lượng nhập tay chưa được đối chiếu mẻ băm. Đây chỉ là công cụ thử công thức, không chốt lương hay thanh toán.</p>
    </section>
  );
};
