import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBootstrapEmails,
  validateMigrationBundle,
  validateProvisionMemberInput,
} from './domain.js';

const shift = {
  id: 'ca_ngay', workshopId: 'du_nhua_01', name: 'Ca ngày', shiftType: 'admin',
  startTime: '08:00', endTime: '17:00', breakMinutes: 60, graceLateMinutes: 5,
  hoursCount: 8, isOvernight: false, overtimeMultiplier: 1.5,
};
const employee = {
  id: 'CN-001', workshopId: 'du_nhua_01', code: 'CN-001', fullName: 'Nguyễn Văn A',
  phone: '', department: 'Phân loại', position: 'Công nhân', shiftId: 'ca_ngay',
  salaryBasis: 'day', baseRate: 300000, status: 'active', biometricStatus: 'not_enrolled',
};
function bundle(overrides: Record<string, unknown> = {}) {
  return {
    migrationId: 'migration_001', workshopId: 'du_nhua_01',
    format: 'du-nhua-workshop-migration-preview-v1', dryRun: true,
    summary: { errorCount: 0 }, shifts: [shift], employees: [employee], ...overrides,
  };
}

test('bootstrap emails được chuẩn hóa và loại trùng', () => {
  assert.deepEqual(parseBootstrapEmails('OWNER@example.com, owner@example.com, second@example.com'), ['owner@example.com', 'second@example.com']);
});

test('bootstrap config rỗng hoặc email sai bị chặn', () => {
  assert.throws(() => parseBootstrapEmails(''), /chưa được cấu hình/);
  assert.throws(() => parseBootstrapEmails('not-an-email'), /chưa được cấu hình/);
});

test('provision member chuẩn hóa email và bắt worker gắn employeeId', () => {
  const result = validateProvisionMemberInput({ workshopId: 'du_nhua_01', uid: 'worker_01', email: ' Worker@Example.com ', role: 'worker', employeeId: 'CN-001' });
  assert.equal(result.email, 'worker@example.com');
  assert.throws(() => validateProvisionMemberInput({ ...result, employeeId: '' }), /phải gắn mã nhân viên/);
});

test('migration hợp lệ được làm sạch và tạo hash ổn định', () => {
  const first = validateMigrationBundle(bundle());
  const second = validateMigrationBundle(bundle());
  assert.equal(first.payloadHash, second.payloadHash);
  assert.equal(first.employees[0].workshopId, 'du_nhua_01');
  assert.equal('createdAt' in first.employees[0], false);
});

test('migration chặn dữ liệu sinh trắc học và trường hash', () => {
  assert.throws(() => validateMigrationBundle(bundle({ employees: [{ ...employee, faceTemplateHash: 'secret' }] })), /sinh trắc học/);
  assert.throws(() => validateMigrationBundle(bundle({ employees: [{ ...employee, passwordHash: 'secret' }] })), /sinh trắc học/);
});

test('migration chặn ca thiếu, mã trùng và gói còn lỗi', () => {
  assert.throws(() => validateMigrationBundle(bundle({ employees: [{ ...employee, shiftId: 'missing' }] })), /ca không tồn tại/);
  assert.throws(() => validateMigrationBundle(bundle({ employees: [employee, employee] })), /bị trùng/);
  assert.throws(() => validateMigrationBundle(bundle({ summary: { errorCount: 1 } })), /còn lỗi/);
});

test('migration chặn kiểu boolean giả và số phút lẻ', () => {
  assert.throws(() => validateMigrationBundle(bundle({ shifts: [{ ...shift, isOvernight: 'false' }] })), /qua đêm/);
  assert.throws(() => validateMigrationBundle(bundle({ shifts: [{ ...shift, breakMinutes: 1.5 }] })), /số nguyên/);
});

test('migration giới hạn 200 bản ghi để giao dịch có thể quay lui', () => {
  const employees = Array.from({ length: 200 }, (_, index) => ({ ...employee, id: `CN-${index}`, code: `CN-${index}` }));
  assert.throws(() => validateMigrationBundle(bundle({ employees })), /tối đa 200/);
});
