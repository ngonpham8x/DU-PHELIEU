import { createHash } from 'node:crypto';

export const MEMBER_ROLES = ['owner', 'manager', 'hr', 'accountant', 'production', 'worker'] as const;
export type MemberRole = typeof MEMBER_ROLES[number];

export type ProvisionMemberInput = {
  workshopId: string;
  uid: string;
  email: string;
  role: MemberRole;
  employeeId: string;
};

export type SanitizedMigration = {
  migrationId: string;
  workshopId: string;
  employees: Array<Record<string, unknown>>;
  shifts: Array<Record<string, unknown>>;
  payloadHash: string;
};

const SAFE_ID = /^[A-Za-z0-9_-]{2,64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} không hợp lệ.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number, allowEmpty = false) {
  if (typeof value !== 'string') throw new Error(`${label} phải là chuỗi.`);
  const normalized = value.trim();
  if ((!allowEmpty && !normalized) || normalized.length > max) throw new Error(`${label} không hợp lệ.`);
  return normalized;
}

function finiteNumber(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} không hợp lệ.`);
  }
  return value;
}

function finiteInteger(value: unknown, label: string, min: number, max: number) {
  const number = finiteNumber(value, label, min, max);
  if (!Number.isInteger(number)) throw new Error(`${label} phải là số nguyên.`);
  return number;
}

export function normalizeEmail(value: unknown) {
  const normalized = text(value, 'Email', 160).toLowerCase();
  if (!EMAIL.test(normalized)) throw new Error('Email không hợp lệ.');
  return normalized;
}

export function requireSafeId(value: unknown, label: string) {
  const normalized = text(value, label, 64);
  if (!SAFE_ID.test(normalized)) throw new Error(`${label} chỉ được gồm chữ, số, gạch ngang hoặc gạch dưới.`);
  return normalized;
}

export function requireUid(value: unknown) {
  const normalized = text(value, 'UID', 128);
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) throw new Error('UID không an toàn để dùng làm mã tài liệu.');
  return normalized;
}

export function parseBootstrapEmails(raw: string) {
  const result = [...new Set(raw.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))];
  if (result.length === 0 || result.some((email) => !EMAIL.test(email))) {
    throw new Error('BOOTSTRAP_ADMIN_EMAILS chưa được cấu hình hợp lệ.');
  }
  return result;
}

export function validateProvisionMemberInput(value: unknown): ProvisionMemberInput {
  const input = object(value, 'Dữ liệu thành viên');
  const role = text(input.role, 'Vai trò', 20) as MemberRole;
  if (!MEMBER_ROLES.includes(role)) throw new Error('Vai trò không hợp lệ.');
  const employeeId = input.employeeId ? requireSafeId(input.employeeId, 'Mã nhân viên') : '';
  if (role === 'worker' && !employeeId) throw new Error('Tài khoản công nhân phải gắn mã nhân viên.');
  return {
    workshopId: requireSafeId(input.workshopId, 'Mã xưởng'),
    uid: requireUid(input.uid),
    email: normalizeEmail(input.email),
    role,
    employeeId,
  };
}

function assertNoBiometricSecrets(record: Record<string, unknown>) {
  for (const key of Object.keys(record)) {
    const lower = key.toLowerCase();
    if (lower === 'biometricstatus') continue;
    if (lower.includes('template') || lower.includes('face') || lower.includes('biometric') || lower.includes('hash')) {
      throw new Error(`Không được chuyển trường sinh trắc học: ${key}.`);
    }
  }
}

function sanitizeShift(value: unknown, workshopId: string) {
  const item = object(value, 'Ca làm');
  assertNoBiometricSecrets(item);
  const id = requireSafeId(item.id, 'Mã ca');
  const startTime = text(item.startTime, 'Giờ bắt đầu', 5);
  const endTime = text(item.endTime, 'Giờ kết thúc', 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
    throw new Error(`Ca ${id} có thời gian không hợp lệ.`);
  }
  if (typeof item.isOvernight !== 'boolean') throw new Error(`Ca ${id} có cờ qua đêm không hợp lệ.`);
  return {
    id,
    workshopId,
    name: text(item.name, 'Tên ca', 100),
    shiftType: text(item.shiftType, 'Loại ca', 30),
    startTime,
    endTime,
    breakMinutes: finiteInteger(item.breakMinutes, 'Thời gian nghỉ', 0, 720),
    graceLateMinutes: finiteInteger(item.graceLateMinutes, 'Số phút trễ', 0, 180),
    hoursCount: finiteNumber(item.hoursCount, 'Số giờ ca', 0, 24),
    isOvernight: item.isOvernight,
    overtimeMultiplier: finiteNumber(item.overtimeMultiplier, 'Hệ số tăng ca', 1, 5),
  };
}

function sanitizeEmployee(value: unknown, workshopId: string, shiftIds: Set<string>) {
  const item = object(value, 'Nhân viên');
  assertNoBiometricSecrets(item);
  const id = requireSafeId(item.id, 'Mã tài liệu nhân viên');
  const shiftId = requireSafeId(item.shiftId, 'Mã ca nhân viên');
  if (!shiftIds.has(shiftId)) throw new Error(`Nhân viên ${id} tham chiếu ca không tồn tại.`);
  const salaryBasis = text(item.salaryBasis, 'Cách tính lương', 20);
  if (!['day', 'month', 'piecework'].includes(salaryBasis)) throw new Error(`Nhân viên ${id} có cách tính lương sai.`);
  const status = text(item.status, 'Trạng thái nhân viên', 20);
  if (!['active', 'leave', 'inactive'].includes(status)) throw new Error(`Nhân viên ${id} có trạng thái sai.`);
  const biometricStatus = text(item.biometricStatus, 'Trạng thái sinh trắc', 30);
  if (!['not_enrolled', 'requires_reenrollment'].includes(biometricStatus)) throw new Error(`Nhân viên ${id} có trạng thái sinh trắc sai.`);
  return {
    id,
    workshopId,
    code: text(item.code, 'Mã nhân viên', 32),
    fullName: text(item.fullName, 'Họ tên', 100),
    phone: text(item.phone, 'Điện thoại', 30, true),
    department: text(item.department, 'Bộ phận', 100),
    position: text(item.position, 'Chức vụ', 100, true),
    shiftId,
    salaryBasis,
    baseRate: finiteNumber(item.baseRate, 'Đơn giá', 0, 1_000_000_000),
    status,
    biometricStatus,
  };
}

export function validateMigrationBundle(value: unknown): SanitizedMigration {
  const input = object(value, 'Gói migration');
  const migrationId = requireSafeId(input.migrationId, 'Mã migration');
  const workshopId = requireSafeId(input.workshopId, 'Mã xưởng');
  if (input.format !== 'du-nhua-workshop-migration-preview-v1' || input.dryRun !== true) {
    throw new Error('Sai định dạng gói xem trước migration.');
  }
  const summary = object(input.summary, 'Tổng hợp migration');
  if (summary.errorCount !== 0) throw new Error('Gói migration vẫn còn lỗi phải sửa.');
  if (!Array.isArray(input.shifts) || !Array.isArray(input.employees)) throw new Error('Danh sách ca/nhân viên không hợp lệ.');
  if (input.shifts.length + input.employees.length > 200) throw new Error('Mỗi migration tối đa 200 bản ghi.');

  const shifts = input.shifts.map((item) => sanitizeShift(item, workshopId));
  const shiftIds = new Set(shifts.map((item) => item.id));
  if (shiftIds.size !== shifts.length) throw new Error('Mã ca bị trùng.');
  const employees = input.employees.map((item) => sanitizeEmployee(item, workshopId, shiftIds));
  const employeeIds = new Set(employees.map((item) => item.id));
  if (employeeIds.size !== employees.length) throw new Error('Mã nhân viên bị trùng.');

  const payloadHash = createHash('sha256').update(JSON.stringify({ workshopId, shifts, employees })).digest('hex');
  return { migrationId, workshopId, shifts, employees, payloadHash };
}
