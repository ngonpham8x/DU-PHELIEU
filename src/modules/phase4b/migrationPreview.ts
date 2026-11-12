import type { EmployeeProfile, ShiftDefinition } from '../../types/factory';

export type MigrationIssue = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
};

export type WorkshopMigrationPreview = {
  format: 'du-nhua-workshop-migration-preview-v1';
  dryRun: true;
  generatedAt: string;
  workshopId: string;
  summary: {
    employeeCount: number;
    shiftCount: number;
    activeEmployeeCount: number;
    errorCount: number;
    warningCount: number;
  };
  safety: {
    writesFirestore: false;
    biometricDataExcluded: true;
    requiresVerifiedBackup: true;
    requiresServerTimestamps: true;
  };
  issues: MigrationIssue[];
  shifts: Array<{
    id: string;
    workshopId: string;
    name: string;
    shiftType: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    graceLateMinutes: number;
    hoursCount: number;
    isOvernight: boolean;
    overtimeMultiplier: number;
  }>;
  employees: Array<{
    id: string;
    workshopId: string;
    code: string;
    fullName: string;
    phone: string;
    department: string;
    position: string;
    shiftId: string;
    salaryBasis: 'day' | 'month' | 'piecework';
    baseRate: number;
    status: 'active' | 'leave' | 'inactive';
    biometricStatus: 'not_enrolled' | 'requires_reenrollment';
  }>;
};

const SAFE_ID = /^[A-Za-z0-9_-]{2,64}$/;

function normalizedId(value: string, fallback: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return normalized || fallback;
}

function salaryBasis(value: EmployeeProfile['salaryType']) {
  if (value === 'Tháng') return 'month' as const;
  if (value === 'Sản lượng') return 'piecework' as const;
  return 'day' as const;
}

function employeeStatus(value: EmployeeProfile['status']) {
  if (value === 'Đã nghỉ') return 'inactive' as const;
  if (value === 'Nghỉ phép') return 'leave' as const;
  return 'active' as const;
}

export function createWorkshopMigrationPreview(
  workshopIdInput: string,
  employees: EmployeeProfile[],
  shifts: ShiftDefinition[],
  generatedAt = new Date().toISOString(),
): WorkshopMigrationPreview {
  const workshopId = workshopIdInput.trim();
  const issues: MigrationIssue[] = [];

  if (!SAFE_ID.test(workshopId)) {
    issues.push({
      severity: 'error',
      code: 'INVALID_WORKSHOP_ID',
      message: 'Mã xưởng phải dài 2–64 ký tự và chỉ gồm chữ không dấu, số, dấu gạch ngang hoặc gạch dưới.',
    });
  }

  const shiftNameCounts = new Map<string, number>();
  const shiftIdCounts = new Map<string, number>();
  shifts.forEach((shift) => {
    const nameKey = shift.name.trim().toLocaleLowerCase('vi-VN');
    const idKey = normalizedId(shift.id, 'shift').toLowerCase();
    shiftNameCounts.set(nameKey, (shiftNameCounts.get(nameKey) || 0) + 1);
    shiftIdCounts.set(idKey, (shiftIdCounts.get(idKey) || 0) + 1);
    if (!shift.name.trim()) {
      issues.push({ severity: 'error', code: 'EMPTY_SHIFT_NAME', message: `Ca ${shift.id || '(không mã)'} chưa có tên.` });
    }
    if (!/^\d{2}:\d{2}$/.test(shift.startTime) || !/^\d{2}:\d{2}$/.test(shift.endTime)) {
      issues.push({ severity: 'error', code: 'INVALID_SHIFT_TIME', message: `Ca ${shift.name || shift.id} có giờ bắt đầu/kết thúc không hợp lệ.` });
    }
    if (!Number.isFinite(shift.breakMinutes) || shift.breakMinutes < 0 || shift.breakMinutes > 720) {
      issues.push({ severity: 'error', code: 'INVALID_BREAK', message: `Ca ${shift.name || shift.id} có thời gian nghỉ không hợp lệ.` });
    }
  });

  shiftNameCounts.forEach((count, name) => {
    if (name && count > 1) issues.push({ severity: 'error', code: 'DUPLICATE_SHIFT_NAME', message: `Tên ca “${name}” bị trùng ${count} lần.` });
  });
  shiftIdCounts.forEach((count, id) => {
    if (count > 1) issues.push({ severity: 'error', code: 'DUPLICATE_SHIFT_ID', message: `Mã ca “${id}” bị trùng sau khi chuẩn hóa.` });
  });

  const employeeCodeCounts = new Map<string, number>();
  employees.forEach((employee) => {
    const codeKey = employee.code.trim().toLocaleLowerCase('vi-VN');
    employeeCodeCounts.set(codeKey, (employeeCodeCounts.get(codeKey) || 0) + 1);
    if (!employee.fullName.trim()) {
      issues.push({ severity: 'error', code: 'EMPTY_EMPLOYEE_NAME', message: `Nhân viên ${employee.code || '(không mã)'} chưa có họ tên.` });
    }
    if (!Number.isFinite(employee.baseRate) || employee.baseRate < 0 || employee.baseRate > 1_000_000_000) {
      issues.push({ severity: 'error', code: 'INVALID_BASE_RATE', message: `Nhân viên ${employee.code} có đơn giá lương không hợp lệ.` });
    }
    if (!shifts.some((shift) => shift.name === employee.shiftName)) {
      issues.push({ severity: 'error', code: 'SHIFT_NOT_FOUND', message: `Nhân viên ${employee.code} đang tham chiếu ca “${employee.shiftName}” không tồn tại.` });
    }
    if (employee.faceEnrolled || employee.faceTemplateHash || employee.biometricTemplateHash) {
      issues.push({ severity: 'warning', code: 'BIOMETRIC_EXCLUDED', message: `Nhân viên ${employee.code}: mẫu sinh trắc học cũ bị loại khỏi gói; phải đăng ký lại có đồng ý.` });
    }
  });

  employeeCodeCounts.forEach((count, code) => {
    if (!code || count > 1) issues.push({ severity: 'error', code: 'DUPLICATE_EMPLOYEE_CODE', message: `Mã nhân viên “${code || '(trống)'}” bị trùng hoặc để trống.` });
  });

  if (employees.length === 0) {
    issues.push({ severity: 'warning', code: 'NO_EMPLOYEES', message: 'Không có hồ sơ nhân viên để chuyển.' });
  }

  const mappedShifts = shifts.map((shift, index) => ({
    id: normalizedId(shift.id, `shift_${index + 1}`),
    workshopId,
    name: shift.name.trim(),
    shiftType: shift.shiftType || 'flexible',
    startTime: shift.startTime,
    endTime: shift.endTime,
    breakMinutes: shift.breakMinutes,
    graceLateMinutes: shift.graceLateMinutes,
    hoursCount: shift.hoursCount,
    isOvernight: Boolean(shift.isOvernight),
    overtimeMultiplier: shift.overtimeMultiplier ?? 1.5,
  }));

  const shiftIdByName = new Map(mappedShifts.map((shift) => [shift.name, shift.id]));
  const mappedEmployees = employees.map((employee, index) => ({
    id: normalizedId(employee.code, `employee_${index + 1}`),
    workshopId,
    code: employee.code.trim(),
    fullName: employee.fullName.trim(),
    phone: employee.phone.trim(),
    department: employee.department.trim(),
    position: employee.position.trim(),
    shiftId: shiftIdByName.get(employee.shiftName) || '',
    salaryBasis: salaryBasis(employee.salaryType),
    baseRate: employee.baseRate,
    status: employeeStatus(employee.status),
    biometricStatus: employee.faceEnrolled ? 'requires_reenrollment' as const : 'not_enrolled' as const,
  }));

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.length - errorCount;

  return {
    format: 'du-nhua-workshop-migration-preview-v1',
    dryRun: true,
    generatedAt,
    workshopId,
    summary: {
      employeeCount: mappedEmployees.length,
      shiftCount: mappedShifts.length,
      activeEmployeeCount: mappedEmployees.filter((employee) => employee.status === 'active').length,
      errorCount,
      warningCount,
    },
    safety: {
      writesFirestore: false,
      biometricDataExcluded: true,
      requiresVerifiedBackup: true,
      requiresServerTimestamps: true,
    },
    issues,
    shifts: mappedShifts,
    employees: mappedEmployees,
  };
}
