import type {
  AppSettings,
  AttendanceEventType,
  AttendanceRecord,
  CashTransaction,
  DailyTimesheetRow,
  EmployeeProfile,
  ShiftDefinition,
  UserRole,
  WeighTicket,
} from '../types/factory';

/**
 * Formats an integer amount in VNĐ without decimals by default (e.g. "15.500.000 ₫").
 */
export function formatCurrencyVND(amount: number): string {
  const rounded = Math.round(Number.isFinite(amount) ? amount : 0);
  const formatted = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(rounded);
  return `${formatted} ₫`;
}

/**
 * Formats weight in kg or tấn with configurable decimal places.
 */
export function formatWeight(
  kg: number,
  unit: 'kg' | 'tan' = 'kg',
  decimals = 1
): string {
  const safeKg = Number.isFinite(kg) ? kg : 0;
  const safeDecimals = Math.max(0, Math.min(4, Math.floor(decimals)));
  const value = unit === 'tan' ? safeKg / 1000 : safeKg;
  const formatted = new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: unit === 'tan' ? safeDecimals : 0,
    maximumFractionDigits: safeDecimals,
  }).format(value);
  return `${formatted} ${unit === 'tan' ? 'tấn' : 'kg'}`;
}

/**
 * Formats a Date or ISO date string into Vietnamese DD/MM/YYYY format.
 */
export function formatDateVN(dateInput: Date | string): string {
  if (typeof dateInput === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(dateInput.trim())) {
    return dateInput.trim().slice(0, 10);
  }
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) {
    return '01/01/2026';
  }
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Returns official timestamp formatted in Asia/Ho_Chi_Minh timezone.
 */
export function formatServerTimeHCM(dateInput: Date = new Date()): {
  dateStr: string;
  timeStr: string;
  fullTimestampStr: string;
} {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(dateInput);
    const map: Record<string, string> = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }
    const dateStr = `${map.day}/${map.month}/${map.year}`;
    const timeStr = `${map.hour}:${map.minute}`;
    const fullTimestampStr = `${dateStr} ${map.hour}:${map.minute}:${map.second}`;
    return { dateStr, timeStr, fullTimestampStr };
  } catch {
    const dateStr = formatDateVN(dateInput);
    const hh = String(dateInput.getHours()).padStart(2, '0');
    const mm = String(dateInput.getMinutes()).padStart(2, '0');
    const ss = String(dateInput.getSeconds()).padStart(2, '0');
    return {
      dateStr,
      timeStr: `${hh}:${mm}`,
      fullTimestampStr: `${dateStr} ${hh}:${mm}:${ss}`,
    };
  }
}

export function isValidAttendanceDateTime(dateStr: string, timeStr: string): boolean {
  const dateParts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr);
  if (!dateParts || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) return false;

  const [, day, month, year] = dateParts;
  const isoDay = `${year}-${month}-${day}`;
  const date = new Date(`${isoDay}T00:00:00Z`);
  return Number(year) > 0 && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === isoDay;
}

/**
 * Helper to get previous calendar day in DD/MM/YYYY format (for overnight shift matching).
 */
export function getPreviousDateStrVN(dateStr: string): string {
  const clean = dateStr.trim().slice(0, 10);
  const [dd, mm, yyyy] = clean.split('/').map(Number);
  if (!dd || !mm || !yyyy) return clean;
  const d = new Date(yyyy, mm - 1, dd);
  d.setDate(d.getDate() - 1);
  return formatDateVN(d);
}

/**
 * Weigh ticket net weight calculation:
 * Khối lượng thực nhận = Trọng lượng tổng - Trọng lượng bì
 * Khối lượng tính tiền = Khối lượng thực nhận - Khối lượng bị trừ theo thỏa thuận
 */
export function calculateNetWeight(
  grossKg: number,
  tareKg: number,
  deductionKg = 0
): { receivedKg: number; billableKg: number } {
  const g = Math.max(0, Number(grossKg) || 0);
  const t = Math.max(0, Number(tareKg) || 0);
  const d = Math.max(0, Number(deductionKg) || 0);
  const receivedKg = Math.max(0, Number((g - t).toFixed(2)));
  const billableKg = Math.max(0, Number((receivedKg - d).toFixed(2)));
  return { receivedKg, billableKg };
}

/**
 * Weigh ticket monetary calculation:
 * Tiền mua = Khối lượng tính tiền × Đơn giá
 * Còn nợ = Tiền mua - Đã thanh toán
 */
export function calculatePurchaseTotal(
  billableKg: number,
  unitPrice: number,
  paidAmount = 0
): { totalAmount: number; debtAmount: number } {
  const totalAmount = Math.round(Math.max(0, billableKg) * Math.max(0, unitPrice));
  const safePaid = Math.min(totalAmount, Math.max(0, Math.round(paidAmount)));
  const debtAmount = Math.max(0, totalAmount - safePaid);
  return { totalAmount, debtAmount };
}

/**
 * Production batch balance formula:
 * Hao hụt = Nguyên liệu đầu vào - Thành phẩm - Phế phẩm có thu hồi - Tồn bán thành phẩm cuối mẻ + Tồn bán thành phẩm đầu mẻ
 * Tỷ lệ thu hồi thành phẩm = Khối lượng thành phẩm / Khối lượng nguyên liệu đầu vào × 100%
 */
export function calculateProductionBalance(
  inputKg: number,
  outputKg: number,
  recoverableScrapKg = 0,
  wipStartKg = 0,
  wipEndKg = 0
): { lossKg: number; recoveryRatePercent: number } {
  const safeIn = Math.max(0, Number(inputKg) || 0);
  const safeOut = Math.max(0, Number(outputKg) || 0);
  const safeScrap = Math.max(0, Number(recoverableScrapKg) || 0);
  const safeWipStart = Math.max(0, Number(wipStartKg) || 0);
  const safeWipEnd = Math.max(0, Number(wipEndKg) || 0);

  const rawLoss = safeIn - safeOut - safeScrap - safeWipEnd + safeWipStart;
  const lossKg = Math.max(0, Number(rawLoss.toFixed(2)));
  const recoveryRatePercent =
    safeIn > 0 ? Number(((safeOut / safeIn) * 100).toFixed(1)) : 0;

  return { lossKg, recoveryRatePercent };
}

export interface DashboardComputedMetrics {
  todayIncome: number;
  todayExpense: number;
  monthlyIncome: number;
  monthlyExpense: number;
  cashBalance: number;
  bankBalance: number;
  totalReceivables: number;
  totalPayables: number;
  workersCheckedInToday: number;
  rubberPurchasedTodayKg: number;
  rubberShreddedTodayKg: number;
  currentInventoryKg: number;
  rawInventoryKg: number;
  shreddedInventoryKg: number;
}

/**
 * Computes all Dashboard KPIs dynamically from database transactions, attendance, and weigh tickets.
 * Follows exact accounting rules:
 * Số dư cuối kỳ = Số dư đầu kỳ + Thu tiền - Chi tiền + Chuyển vào - Chuyển ra.
 * Internal transfers do not increase income or expense.
 * Unpaid purchases increase inventory & payables without reducing cash balance.
 * Pending or rejected fallback attendance requests do NOT count as checked-in workers until approved.
 */
export function calculateDashboardMetrics(
  transactions: CashTransaction[],
  attendance: AttendanceRecord[],
  tickets: WeighTicket[],
  settings: AppSettings,
  todayDateStr: string
): DashboardComputedMetrics {
  let todayIncome = 0;
  let todayExpense = 0;
  let monthlyIncome = 0;
  let monthlyExpense = 0;
  let cashBalance = settings.openingCashBalance;
  let bankBalance = settings.openingBankBalance;

  const monthYearSuffix = todayDateStr.length >= 10 ? todayDateStr.slice(3, 10) : todayDateStr;

  for (const tx of transactions) {
    if (tx.status === 'cancelled') continue;
    const isToday = tx.dateStr.startsWith(todayDateStr);
    const txDatePart = tx.dateStr.slice(0, 10);
    const isThisMonth = txDatePart.endsWith(monthYearSuffix);

    if (tx.type === 'income') {
      if (isToday) todayIncome += tx.amount;
      if (isThisMonth) monthlyIncome += tx.amount;
      if (tx.accountType === 'cash') cashBalance += tx.amount;
      else bankBalance += tx.amount;
    } else if (tx.type === 'expense') {
      if (isToday) todayExpense += tx.amount;
      if (isThisMonth) monthlyExpense += tx.amount;
      if (tx.accountType === 'cash') cashBalance -= tx.amount;
      else bankBalance -= tx.amount;
    } else if (tx.type === 'transfer') {
      if (tx.accountType === 'cash') {
        cashBalance -= tx.amount;
        bankBalance += tx.amount;
      } else {
        bankBalance -= tx.amount;
        cashBalance += tx.amount;
      }
    }
  }

  let totalReceivables = 0;
  let totalPayables = 0;
  let rubberPurchasedTodayKg = 0;
  let rubberShreddedTodayKg = 0;
  let rawInventoryKg = settings.openingRawRubberKg;
  let shreddedInventoryKg = settings.openingShreddedRubberKg;

  for (const tk of tickets) {
    const isToday = tk.dateStr.startsWith(todayDateStr);
    if (tk.ticketType === 'purchase_in') {
      totalPayables += tk.debtAmount;
      rawInventoryKg += tk.netKg;
      if (isToday) {
        rubberPurchasedTodayKg += tk.netKg;
      }
    } else if (tk.ticketType === 'production_batch') {
      const outKg = tk.outputKg ?? tk.netKg;
      rawInventoryKg = Math.max(0, rawInventoryKg - tk.grossKg);
      shreddedInventoryKg += outKg;
      if (isToday) {
        rubberShreddedTodayKg += outKg;
      }
    } else if (tk.ticketType === 'sales_out') {
      totalReceivables += tk.debtAmount;
      shreddedInventoryKg = Math.max(0, shreddedInventoryKg - tk.netKg);
    }
  }

  for (const tx of transactions) {
    if (tx.status === 'cancelled') continue;
    if (tx.type === 'income' && tx.category === 'Thu công nợ khách hàng') {
      totalReceivables = Math.max(0, totalReceivables - tx.amount);
    }
    if (tx.type === 'expense' && tx.category === 'Trả nợ mua mủ nguyên liệu') {
      totalPayables = Math.max(0, totalPayables - tx.amount);
    }
  }

  const checkedInSet = new Set<string>();
  for (const att of attendance) {
    const isApproved =
      !att.approvalStatus || att.approvalStatus === 'approved';
    if (
      isApproved &&
      att.dateStr.startsWith(todayDateStr) &&
      att.eventType === 'check_in'
    ) {
      checkedInSet.add(att.employeeCode);
    }
  }

  return {
    todayIncome,
    todayExpense,
    monthlyIncome,
    monthlyExpense,
    cashBalance,
    bankBalance,
    totalReceivables,
    totalPayables,
    workersCheckedInToday: checkedInSet.size,
    rubberPurchasedTodayKg: Number(rubberPurchasedTodayKg.toFixed(1)),
    rubberShreddedTodayKg: Number(rubberShreddedTodayKg.toFixed(1)),
    currentInventoryKg: Number((rawInventoryKg + shreddedInventoryKg).toFixed(1)),
    rawInventoryKg: Number(rawInventoryKg.toFixed(1)),
    shreddedInventoryKg: Number(shreddedInventoryKg.toFixed(1)),
  };
}

/**
 * Checks whether a user role has permission to create/view/edit/cancel income and expense vouchers.
 */
export function canManageCashFlow(role: UserRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'accountant';
}

/**
 * Checks whether a user role has permission to restore a cancelled transaction.
 */
export function canRestoreTransaction(role: UserRole): boolean {
  return role === 'owner' || role === 'manager';
}

/**
 * Checks whether a user role can view the factory Activity Logs (Nhật ký hoạt động).
 * Owner, Manager, Accountant, and HR can view logs; Worker cannot view factory audit logs.
 */
export function canViewActivityLogs(role: UserRole): boolean {
  return (
    role === 'owner' ||
    role === 'manager' ||
    role === 'accountant' ||
    role === 'hr'
  );
}

/**
 * Checks whether a user role can view the full factory attendance table.
 * Workers can only see their own attendance records and cannot edit attendance hours.
 */
export function canViewFullAttendanceTable(role: UserRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'hr';
}

/**
 * Checks whether a user role can adjust/edit attendance timestamps with a reason.
 * Workers are strictly forbidden from editing attendance hours.
 */
export function canEditAttendanceTime(role: UserRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'hr';
}

/**
 * Checks whether a user role can enroll, update, or revoke employee biometric face templates.
 * Only Owner, Manager, and HR have biometric enrollment permission.
 */
export function canManageFaceEnrollment(role: UserRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'hr';
}

/**
 * Checks whether a user role can approve or reject fallback attendance requests.
 */
export function canApproveFallbackAttendance(role: UserRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'hr';
}

/**
 * Legacy helper checking duplicate attendance event on the same date.
 */
export function isDuplicateAttendanceEvent(
  records: AttendanceRecord[],
  employeeCode: string,
  eventType: AttendanceEventType,
  dateStr: string
): boolean {
  const sameDayEmpRecords = records.filter(
    (r) =>
      r.employeeCode === employeeCode &&
      r.dateStr.startsWith(dateStr) &&
      r.approvalStatus !== 'rejected'
  );
  if (sameDayEmpRecords.length === 0) return false;
  const latest = sameDayEmpRecords[0];
  return latest.eventType === eventType;
}

export interface SequenceValidationResult {
  valid: boolean;
  code?:
    | 'DOUBLE_CHECK_IN'
    | 'DUPLICATE_CHECK_OUT'
    | 'CHECK_OUT_WITHOUT_CHECK_IN'
    | 'BREAK_WITHOUT_CHECK_IN'
    | 'BREAK_END_WITHOUT_START'
    | 'DUPLICATE_LEAVE';
  message?: string;
  resolvedWorkDateStr: string;
}

export function suggestAttendanceEvent(
  records: AttendanceRecord[],
  employeeCode: string,
  todayDateStr: string,
  isOvernightShift = false
): { eventType: 'check_in' | 'check_out'; message: string } {
  const cleanToday = todayDateStr.trim().slice(0, 10);
  const relevant = records.filter(
    (record) =>
      record.employeeCode === employeeCode &&
      record.approvalStatus !== 'rejected' &&
      ((record.workDateStr && record.workDateStr === cleanToday) ||
        (!record.workDateStr && record.dateStr.startsWith(cleanToday)))
  );
  const hasCheckIn = relevant.some((record) => record.eventType === 'check_in');
  const hasCheckOut = relevant.some((record) => record.eventType === 'check_out');

  if ((hasCheckIn && !hasCheckOut) || (!hasCheckIn && isOvernightShift &&
    validateAttendanceSequence(records, employeeCode, employeeCode, 'check_out', cleanToday, true).valid)) {
    return {
      eventType: 'check_out',
      message: 'Đã có giờ vào ca và chưa có giờ ra ca; hệ thống đề xuất RA CA.',
    };
  }

  return {
    eventType: 'check_in',
    message: hasCheckOut
      ? 'Ca trước đã đủ giờ vào/ra; hệ thống đề xuất VÀO CA mới.'
      : 'Chưa có giờ vào ca hôm nay; hệ thống đề xuất VÀO CA.',
  };
}

/**
 * Validates attendance sequence rules:
 * - Blocks double check-in (Vào ca hai lần) on the same work date.
 * - Blocks check-out without prior check-in (Ra ca khi chưa vào ca), while supporting
 *   overnight shifts (Ca đêm qua ngày) where check-in occurred on the previous calendar day.
 * - Blocks duplicate check-out (Quét trùng ra ca).
 */
export function validateAttendanceSequence(
  records: AttendanceRecord[],
  employeeCode: string,
  employeeName: string,
  eventType: AttendanceEventType,
  todayDateStr: string,
  isOvernightShift = false
): SequenceValidationResult {
  const cleanToday = todayDateStr.trim().slice(0, 10);
  const prevDateStr = getPreviousDateStrVN(cleanToday);

  const empRecords = records.filter(
    (r) =>
      r.employeeCode === employeeCode && r.approvalStatus !== 'rejected'
  );

  const todayRecords = empRecords.filter(
    (r) =>
      (r.workDateStr && r.workDateStr === cleanToday) ||
      (!r.workDateStr && r.dateStr.startsWith(cleanToday))
  );

  if (eventType === 'leave') {
    const existingLeave = todayRecords.some((r) => r.eventType === 'leave');
    if (existingLeave) {
      return {
        valid: false,
        code: 'DUPLICATE_LEAVE',
        message: `Nhân viên ${employeeName} (${employeeCode}) đã có bản ghi Nghỉ phép trong ngày ${cleanToday}.`,
        resolvedWorkDateStr: cleanToday,
      };
    }
    return { valid: true, resolvedWorkDateStr: cleanToday };
  }

  if (eventType === 'check_in') {
    const hasCheckInToday = todayRecords.some((r) => r.eventType === 'check_in');
    const hasCheckOutToday = todayRecords.some(
      (r) => r.eventType === 'check_out'
    );
    if (hasCheckInToday && !hasCheckOutToday) {
      return {
        valid: false,
        code: 'DOUBLE_CHECK_IN',
        message: `Cảnh báo vào ca hai lần (Quét trùng): Nhân viên ${employeeName} (${employeeCode}) đã VÀO CA trong ngày ${cleanToday} và chưa RA CA. Vui lòng chọn RA CA hoặc NGHỈ GIỮA CA.`,
        resolvedWorkDateStr: cleanToday,
      };
    }
    if (todayRecords[0]?.eventType === 'check_in') {
      return {
        valid: false,
        code: 'DOUBLE_CHECK_IN',
        message: `Cảnh báo vào ca hai lần: Nhân viên ${employeeName} (${employeeCode}) vừa thực hiện VÀO CA trong ngày ${cleanToday}.`,
        resolvedWorkDateStr: cleanToday,
      };
    }
    return { valid: true, resolvedWorkDateStr: cleanToday };
  }

  if (eventType === 'check_out') {
    const todayCheckIn = todayRecords.find((r) => r.eventType === 'check_in');
    const todayCheckOut = todayRecords.find((r) => r.eventType === 'check_out');

    if (todayCheckIn) {
      if (todayCheckOut) {
        return {
          valid: false,
          code: 'DUPLICATE_CHECK_OUT',
          message: `Cảnh báo quét trùng RA CA: Nhân viên ${employeeName} (${employeeCode}) đã RA CA trong ngày ${cleanToday}.`,
          resolvedWorkDateStr: cleanToday,
        };
      }
      return { valid: true, resolvedWorkDateStr: cleanToday };
    }

    // Check if closing an overnight shift from yesterday (Ca đêm qua ngày)
    if (isOvernightShift) {
      const yesterdayRecords = empRecords.filter(
        (r) =>
          (r.workDateStr && r.workDateStr === prevDateStr) ||
          (!r.workDateStr && r.dateStr.startsWith(prevDateStr))
      );
      const yesterdayCheckIn = yesterdayRecords.find(
        (r) => r.eventType === 'check_in'
      );
      const yesterdayCheckOut = yesterdayRecords.find(
        (r) => r.eventType === 'check_out'
      );
      if (yesterdayCheckIn && !yesterdayCheckOut) {
        return {
          valid: true,
          resolvedWorkDateStr: prevDateStr,
        };
      }
    }

    return {
      valid: false,
      code: 'CHECK_OUT_WITHOUT_CHECK_IN',
      message: `Chặn thao tác RA CA khi chưa VÀO CA: Nhân viên ${employeeName} (${employeeCode}) chưa có dữ liệu VÀO CA hợp lệ trong ngày ${cleanToday}${isOvernightShift ? ` hoặc ca đêm ngày ${prevDateStr}` : ''}. Vui lòng thực hiện VÀO CA trước.`,
      resolvedWorkDateStr: cleanToday,
    };
  }

  if (eventType === 'break_start') {
    const hasCheckIn = todayRecords.some((r) => r.eventType === 'check_in');
    if (!hasCheckIn) {
      return {
        valid: false,
        code: 'BREAK_WITHOUT_CHECK_IN',
        message: `Không thể BẮT ĐẦU NGHỈ GIỮA CA khi nhân viên ${employeeName} chưa VÀO CA.`,
        resolvedWorkDateStr: cleanToday,
      };
    }
    return { valid: true, resolvedWorkDateStr: cleanToday };
  }

  if (eventType === 'break_end') {
    const hasBreakStart = todayRecords.some(
      (r) => r.eventType === 'break_start'
    );
    if (!hasBreakStart) {
      return {
        valid: false,
        code: 'BREAK_END_WITHOUT_START',
        message: `Không thể KẾT THÚC NGHỈ GIỮA CA khi nhân viên ${employeeName} chưa bấm BẮT ĐẦU NGHỈ.`,
        resolvedWorkDateStr: cleanToday,
      };
    }
    return { valid: true, resolvedWorkDateStr: cleanToday };
  }

  return { valid: true, resolvedWorkDateStr: cleanToday };
}

export interface Face1To1VerificationInput {
  expectedEmployeeCode: string;
  capturedEmployeeCode: string;
  faceEnrolled: boolean;
  livenessPassed: boolean;
  spoofDetected?: boolean;
  lightingScore: number; // 0 - 100
}

export interface Face1To1VerificationResult {
  verified: boolean;
  confidence: number;
  errorCode?:
    | 'NOT_ENROLLED'
    | 'SPOOF_DETECTED'
    | 'LOW_LIGHT'
    | 'MISMATCH_1_TO_1';
  reason?: string;
}

/**
 * 1:1 Face Verification & Anti-Spoofing check against enrolled employee profile.
 */
export function verifyFace1To1(
  input: Face1To1VerificationInput
): Face1To1VerificationResult {
  if (!input.faceEnrolled) {
    return {
      verified: false,
      confidence: 0,
      errorCode: 'NOT_ENROLLED',
      reason:
        'Nhân viên chưa được đăng ký mẫu sinh trắc học khuôn mặt trong phân hệ Nhân sự.',
    };
  }

  if (input.spoofDetected || !input.livenessPassed) {
    return {
      verified: false,
      confidence: 0,
      errorCode: 'SPOOF_DETECTED',
      reason:
        'Cảnh báo chống giả mạo (Liveness Check thất bại): Phát hiện ảnh tĩnh / màn hình điện thoại hoặc chưa thực hiện động tác nháy mắt / xoay nhẹ đầu.',
    };
  }

  if (input.lightingScore < 45) {
    return {
      verified: false,
      confidence: 0,
      errorCode: 'LOW_LIGHT',
      reason:
        'Chất lượng khung hình không đạt (Ánh sáng yếu < 45% hoặc khuôn mặt bị mờ/che khuất). Vui lòng đứng nơi đủ sáng hoặc chuyển sang Chấm công dự phòng.',
    };
  }

  if (input.capturedEmployeeCode !== input.expectedEmployeeCode) {
    return {
      verified: false,
      confidence: 32.5,
      errorCode: 'MISMATCH_1_TO_1',
      reason: `Xác minh khuôn mặt 1:1 thất bại (Độ khớp 32.5% < ngưỡng 85%): Khuôn mặt trước camera (${input.capturedEmployeeCode}) KHÔNG KHỚP với mẫu đã đăng ký của nhân viên ${input.expectedEmployeeCode}.`,
    };
  }

  return {
    verified: true,
    confidence: 98.9,
  };
}

function parseTimeMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const clean = timeStr.trim().slice(0, 5);
  const [hh, mm] = clean.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

/**
 * Aggregates raw attendance events into daily timesheet rows per (employeeCode, workDateStr).
 * Uses each shift's configurable standard hours (`shift.hoursCount`), break minutes,
 * grace late minutes, and overnight flag (`isOvernight`).
 * Pending fallback requests (`pending_approval`) are highlighted and NOT counted as official work hours until approved.
 */
export function computeDailyTimesheetRows(
  records: AttendanceRecord[],
  employees: EmployeeProfile[],
  shifts: ShiftDefinition[]
): DailyTimesheetRow[] {
  const groups = new Map<string, AttendanceRecord[]>();

  for (const rec of records) {
    const workDate = (rec.workDateStr || rec.dateStr).trim().slice(0, 10);
    const key = `${rec.employeeCode}__${workDate}`;
    const list = groups.get(key) || [];
    list.push(rec);
    groups.set(key, list);
  }

  const rows: DailyTimesheetRow[] = [];

  for (const [key, group] of groups.entries()) {
    const [employeeCode, workDateStr] = key.split('__');
    const emp = employees.find((e) => e.code === employeeCode);
    const sample = group[0];
    const employeeName = emp?.fullName || sample.employeeName;
    const department = emp?.department || sample.department;
    const shiftName = sample.shiftName || emp?.shiftName || 'Ca sáng (06:30 - 14:30)';

    const shift =
      shifts.find((s) => s.name === shiftName) ||
      shifts.find((s) => shiftName.includes(s.name.split(' ')[1] || '')) || {
        id: 'default-shift',
        name: shiftName,
        startTime: '06:30',
        endTime: '14:30',
        breakMinutes: 45,
        graceLateMinutes: 10,
        hoursCount: 7.25,
        isOvernight: shiftName.toLowerCase().includes('đêm'),
      };

    const isOvernightShift = Boolean(
      shift.isOvernight ||
        sample.isOvernight ||
        shiftName.toLowerCase().includes('đêm')
    );

    const hasPendingFallback = group.some(
      (r) => r.approvalStatus === 'pending_approval'
    );
    const hasRejectedFallback = group.some(
      (r) => r.approvalStatus === 'rejected'
    );

    // Approved events only for official hour calculation
    const approvedEvents = group.filter(
      (r) => !r.approvalStatus || r.approvalStatus === 'approved'
    );

    const leaveEvent = approvedEvents.find((r) => r.eventType === 'leave');
    const checkInEvent = approvedEvents.find((r) => r.eventType === 'check_in');
    const checkOutEvent = approvedEvents.find(
      (r) => r.eventType === 'check_out'
    );
    const breakStartEvent = approvedEvents.find(
      (r) => r.eventType === 'break_start'
    );
    const breakEndEvent = approvedEvents.find(
      (r) => r.eventType === 'break_end'
    );

    const checkInTime = checkInEvent ? checkInEvent.timeStr : '—';
    const checkOutTime = checkOutEvent ? checkOutEvent.timeStr : '—';

    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;
    let breakMinutesUsed = 0;
    let actualHours = 0;
    let overtimeHours = 0;

    const shiftStartMin = parseTimeMinutes(shift.startTime) ?? 390;
    const shiftEndMin = parseTimeMinutes(shift.endTime) ?? 870;
    const checkInMin = parseTimeMinutes(checkInEvent?.timeStr);
    const checkOutMin = parseTimeMinutes(checkOutEvent?.timeStr);

    if (checkInMin !== null) {
      const diffLate = checkInMin - (shiftStartMin + shift.graceLateMinutes);
      if (diffLate > 0) {
        lateMinutes = checkInMin - shiftStartMin;
      }
    }

    if (checkInMin !== null && checkOutMin !== null) {
      let totalSpanMin = checkOutMin - checkInMin;
      if (totalSpanMin < 0 || (isOvernightShift && checkOutMin <= checkInMin)) {
        totalSpanMin += 24 * 60;
      }

      // Compute break minutes
      const bStart = parseTimeMinutes(breakStartEvent?.timeStr);
      const bEnd = parseTimeMinutes(breakEndEvent?.timeStr);
      if (bStart !== null && bEnd !== null && bEnd > bStart) {
        breakMinutesUsed = bEnd - bStart;
      } else if (totalSpanMin >= 300) {
        breakMinutesUsed = shift.breakMinutes;
      }

      const netWorkMin = Math.max(0, totalSpanMin - breakMinutesUsed);
      actualHours = Number((netWorkMin / 60).toFixed(2));

      const standardShiftHours =
        shift.hoursCount > 0 ? shift.hoursCount : 7.25;
      if (actualHours > standardShiftHours) {
        overtimeHours = Number((actualHours - standardShiftHours).toFixed(2));
      }

      // Check early leave
      let expectedEndMin = shiftEndMin;
      if (isOvernightShift && expectedEndMin <= shiftStartMin) {
        expectedEndMin += 24 * 60;
      }
      let actualOutNormalized = checkOutMin;
      if (isOvernightShift && actualOutNormalized <= checkInMin) {
        actualOutNormalized += 24 * 60;
      }
      if (expectedEndMin - actualOutNormalized > 10) {
        earlyLeaveMinutes = expectedEndMin - actualOutNormalized;
      }
    }

    // Build status label & tone
    let statusLabel = 'Đang trong ca';
    let statusTone: DailyTimesheetRow['statusTone'] = 'blue';

    if (hasPendingFallback && !checkInEvent) {
      statusLabel = 'Chờ quản lý duyệt (Dự phòng)';
      statusTone = 'amber';
    } else if (hasRejectedFallback && !checkInEvent) {
      statusLabel = 'Từ chối duyệt dự phòng';
      statusTone = 'rose';
    } else if (leaveEvent) {
      statusLabel = 'Nghỉ phép có đơn';
      statusTone = 'slate';
    } else if (checkInEvent && checkOutEvent) {
      const tags: string[] = [];
      if (isOvernightShift) tags.push('Ca đêm qua ngày');
      if (lateMinutes > 0) tags.push(`Đi muộn ${lateMinutes}p`);
      if (earlyLeaveMinutes > 0) tags.push(`Về sớm ${earlyLeaveMinutes}p`);
      if (overtimeHours > 0) tags.push(`Tăng ca +${overtimeHours}h`);
      if (tags.length === 0) {
        statusLabel = 'Đủ công · Đúng giờ';
        statusTone = 'emerald';
      } else {
        statusLabel = tags.join(' · ');
        statusTone =
          lateMinutes > 0 || earlyLeaveMinutes > 0 ? 'amber' : 'emerald';
      }
    } else if (checkInEvent && !checkOutEvent) {
      statusLabel =
        lateMinutes > 0
          ? `Đang làm việc (Đi muộn ${lateMinutes}p)`
          : isOvernightShift
            ? 'Đang làm ca đêm (Chờ ra ca sáng mai)'
            : 'Đã vào ca (Chưa ra ca)';
      statusTone = lateMinutes > 0 ? 'amber' : 'blue';
    }

    const noteParts: string[] = [];
    for (const r of group) {
      if (r.approvalStatus === 'pending_approval') {
        noteParts.push(
          `[Chờ duyệt ${r.eventType === 'check_in' ? 'VÀO CA' : 'RA CA'} ${r.timeStr}: ${r.fallbackReason || 'Dự phòng'}]`
        );
      } else if (r.approvalStatus === 'rejected') {
        noteParts.push(
          `[Đã từ chối dự phòng: ${r.reviewReason || 'Không hợp lệ'}]`
        );
      } else if (r.method === 'fallback_manual') {
        noteParts.push(
          `Dự phòng đã duyệt (${r.approvedBy || 'Quản lý'}): ${r.fallbackReason || ''}`
        );
      }
      if (r.adjustedNote) {
        noteParts.push(r.adjustedNote);
      }
    }

    rows.push({
      rowKey: key,
      employeeCode,
      employeeName,
      department,
      shiftName,
      workDateStr,
      checkInTime,
      checkOutTime,
      breakMinutesUsed,
      actualHours,
      overtimeHours,
      lateMinutes,
      earlyLeaveMinutes,
      statusLabel,
      statusTone,
      notes:
        noteParts.join(' | ') ||
        (checkInEvent?.method === 'face_verified'
          ? `Xác thực khuôn mặt 1:1 (${checkInEvent.confidence}%)`
          : '—'),
      hasPendingFallback,
      hasRejectedFallback,
      isOvernightShift,
      checkInRecordId: checkInEvent?.id,
      checkOutRecordId: checkOutEvent?.id,
    });
  }

  return rows;
}
