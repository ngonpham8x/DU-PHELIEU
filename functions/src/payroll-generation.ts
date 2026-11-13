import { requireSafeId } from './domain.js';

export type PayrollGenerationEmployee = {
  id: string;
  workshopId: string;
  fullName: string;
  shiftId: string;
  salaryBasis: 'day' | 'month' | 'piecework';
  baseRate: number;
  status: string;
};

export type PayrollGenerationShift = {
  id: string;
  workshopId: string;
  hoursCount: number;
  breakMinutes: number;
  isOvernight: boolean;
};

export type PayrollGenerationAttendance = {
  id: string;
  workshopId: string;
  employeeId: string;
  workDate: string;
  timeMinutes: number;
  eventType: 'check_in' | 'check_out';
  approvalStatus: 'approved';
};

export function validateGeneratePayrollInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dữ liệu tạo kỳ lương không hợp lệ.');
  const input = value as Record<string, unknown>;
  const month = typeof input.month === 'string' ? input.month.trim() : '';
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Tháng lương phải có dạng YYYY-MM.');
  const standardDays = input.standardDays ?? 26;
  if (!Number.isSafeInteger(standardDays) || Number(standardDays) < 1 || Number(standardDays) > 31) {
    throw new Error('Số ngày công chuẩn phải là số nguyên từ 1 đến 31.');
  }
  return {
    workshopId: requireSafeId(input.workshopId, 'Mã xưởng'),
    periodId: requireSafeId(input.periodId, 'Mã kỳ lương'),
    month,
    standardDays: Number(standardDays),
  };
}

function safeInteger(value: unknown, label: string, min: number, max: number) {
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) throw new Error(`${label} không hợp lệ.`);
  return Number(value);
}

function validDateInMonth(value: unknown, month: string) {
  if (typeof value !== 'string' || !new RegExp(`^${month}-([0-2]\\d|3[01])$`).test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function buildPayrollDraft(args: {
  workshopId: string;
  month: string;
  standardDays: number;
  employees: PayrollGenerationEmployee[];
  shifts: PayrollGenerationShift[];
  attendance: PayrollGenerationAttendance[];
}) {
  const { workshopId, month, standardDays } = args;
  if (args.employees.length > 100) throw new Error('Mỗi kỳ lương hỗ trợ tối đa 100 nhân viên.');
  if (args.attendance.length > 300) throw new Error('Mỗi lần tạo kỳ hỗ trợ tối đa 300 sự kiện công đã duyệt.');

  const shifts = new Map(args.shifts.map((shift) => {
    if (shift.workshopId !== workshopId) throw new Error('Ca làm không thuộc đúng xưởng.');
    const id = requireSafeId(shift.id, 'Mã ca');
    const hoursCount = typeof shift.hoursCount === 'number' && Number.isFinite(shift.hoursCount) && shift.hoursCount > 0 && shift.hoursCount <= 24
      ? shift.hoursCount : (() => { throw new Error(`Số giờ ca ${id} không hợp lệ.`); })();
    return [id, {
      ...shift,
      hoursCount,
      breakMinutes: safeInteger(shift.breakMinutes, `Thời gian nghỉ ca ${id}`, 0, 720),
      isOvernight: shift.isOvernight === true,
    }] as const;
  }));
  const eventIds = new Set<string>();
  const validAttendance = args.attendance.map((event) => {
    const id = requireSafeId(event.id, 'Mã sự kiện công');
    if (eventIds.has(id)) throw new Error(`Sự kiện công ${id} bị trùng.`);
    eventIds.add(id);
    if (
      event.workshopId !== workshopId || event.approvalStatus !== 'approved' ||
      !validDateInMonth(event.workDate, month) || !['check_in', 'check_out'].includes(event.eventType)
    ) throw new Error(`Sự kiện công ${id} không hợp lệ hoặc không thuộc kỳ.`);
    return {
      ...event,
      id,
      employeeId: requireSafeId(event.employeeId, 'Mã nhân viên của sự kiện công'),
      timeMinutes: safeInteger(event.timeMinutes, `Thời gian sự kiện ${id}`, 0, 1439),
    };
  });

  const usedEventIds: string[] = [];
  const lines = args.employees
    .filter((employee) => employee.status === 'active')
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((employee) => {
      if (employee.workshopId !== workshopId) throw new Error('Nhân viên không thuộc đúng xưởng.');
      const employeeId = requireSafeId(employee.id, 'Mã nhân viên');
      const shift = shifts.get(requireSafeId(employee.shiftId, `Mã ca của ${employeeId}`));
      if (!shift) throw new Error(`Nhân viên ${employeeId} tham chiếu ca không tồn tại.`);
      if (!['day', 'month', 'piecework'].includes(employee.salaryBasis)) throw new Error(`Cách tính lương của ${employeeId} không hợp lệ.`);
      const rate = safeInteger(employee.baseRate, `Đơn giá của ${employeeId}`, 0, 1_000_000_000);
      const byDate = new Map<string, typeof validAttendance>();
      validAttendance.filter((event) => event.employeeId === employeeId).forEach((event) => {
        const list = byDate.get(event.workDate) || [];
        list.push(event);
        byDate.set(event.workDate, list);
      });

      let paidDays = 0;
      let regularMinutes = 0;
      let overtimeMinutes = 0;
      for (const events of byDate.values()) {
        const checkIns = events.filter((event) => event.eventType === 'check_in').sort((a, b) => a.timeMinutes - b.timeMinutes);
        const checkOuts = events.filter((event) => event.eventType === 'check_out');
        const checkIn = checkIns[0];
        if (!checkIn || checkOuts.length === 0) continue;
        const normalizedOuts = checkOuts.map((event) => ({
          event,
          minute: event.timeMinutes <= checkIn.timeMinutes && shift.isOvernight ? event.timeMinutes + 1440 : event.timeMinutes,
        })).filter((item) => item.minute > checkIn.timeMinutes).sort((a, b) => b.minute - a.minute);
        const checkOut = normalizedOuts[0];
        if (!checkOut) continue;
        const span = checkOut.minute - checkIn.timeMinutes;
        const netMinutes = Math.max(0, span - (span >= 300 ? shift.breakMinutes : 0));
        if (netMinutes <= 0 || netMinutes > 24 * 60) continue;
        const standardMinutes = Math.round(shift.hoursCount * 60);
        paidDays += 1;
        regularMinutes += Math.min(netMinutes, standardMinutes);
        overtimeMinutes += Math.max(0, netMinutes - standardMinutes);
        usedEventIds.push(checkIn.id, checkOut.event.id);
      }

      const basePay = employee.salaryBasis === 'day'
        ? rate * paidDays
        : employee.salaryBasis === 'month'
          ? Math.round((rate * paidDays) / standardDays)
          : 0;
      if (!Number.isSafeInteger(basePay) || basePay > 100_000_000_000) throw new Error(`Lương chính của ${employeeId} vượt giới hạn.`);
      return {
        employeeId,
        employeeName: String(employee.fullName || '').trim().slice(0, 100),
        salaryBasis: employee.salaryBasis,
        rate,
        paidDays,
        regularMinutes,
        overtimeMinutes,
        basePay,
        overtimePay: 0,
        allowance: 0,
        bonus: 0,
        advance: 0,
        deductions: 0,
        netPay: basePay,
        requiresReview: employee.salaryBasis === 'piecework' || overtimeMinutes > 0,
      };
    });
  const uniqueSourceIds = [...new Set(usedEventIds)].sort();
  const netTotal = lines.reduce((sum, line) => sum + line.netPay, 0);
  if (!Number.isSafeInteger(netTotal) || netTotal > 100_000_000_000) throw new Error('Tổng lương kỳ vượt giới hạn.');
  return {
    lines,
    sourceEventIds: uniqueSourceIds,
    sourceEventCount: uniqueSourceIds.length,
    unmatchedEventCount: validAttendance.length - uniqueSourceIds.length,
    reviewLineCount: lines.filter((line) => line.requiresReview).length,
    netTotal,
  };
}
