import test from 'node:test';
import assert from 'node:assert/strict';
import type { EmployeeProfile, ShiftDefinition } from '../../types/factory';
import { createWorkshopMigrationPreview } from './migrationPreview';

const shift: ShiftDefinition = {
  id: 'ca-ngay', name: 'Ca ngày', startTime: '08:00', endTime: '17:00',
  breakMinutes: 60, graceLateMinutes: 5, hoursCount: 8,
};

const employee: EmployeeProfile = {
  code: 'CN-001', fullName: 'Nguyễn Văn A', phone: '0900000000', department: 'Phân loại',
  position: 'Công nhân', shiftName: 'Ca ngày', salaryType: 'Ngày', baseRate: 300000,
  faceEnrolled: true, enrolledAngles: 3, faceTemplateHash: 'secret-template', status: 'Đang làm việc',
};

test('4B migration preview ánh xạ hồ sơ hợp lệ nhưng loại dữ liệu sinh trắc học', () => {
  const result = createWorkshopMigrationPreview('du_nhua_01', [employee], [shift], '2026-11-12T00:00:00.000Z');
  assert.equal(result.dryRun, true);
  assert.equal(result.safety.writesFirestore, false);
  assert.equal(result.summary.errorCount, 0);
  assert.equal(result.employees[0].shiftId, 'ca-ngay');
  assert.equal(result.employees[0].biometricStatus, 'requires_reenrollment');
  assert.equal('faceTemplateHash' in result.employees[0], false);
  assert.ok(result.issues.some((issue) => issue.code === 'BIOMETRIC_EXCLUDED'));
});

test('4B migration preview chặn mã xưởng không an toàn', () => {
  const result = createWorkshopMigrationPreview('xưởng có dấu/cách', [employee], [shift]);
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_WORKSHOP_ID' && issue.severity === 'error'));
});

test('4B migration preview phát hiện trùng mã nhân viên', () => {
  const result = createWorkshopMigrationPreview('du_nhua_01', [employee, { ...employee, code: 'cn-001' }], [shift]);
  assert.ok(result.issues.some((issue) => issue.code === 'DUPLICATE_EMPLOYEE_CODE'));
});

test('4B migration preview chặn nhân viên tham chiếu ca không tồn tại', () => {
  const result = createWorkshopMigrationPreview('du_nhua_01', [{ ...employee, shiftName: 'Ca mất' }], [shift]);
  assert.ok(result.issues.some((issue) => issue.code === 'SHIFT_NOT_FOUND'));
  assert.equal(result.employees[0].shiftId, '');
});

test('4B migration preview chặn đơn giá âm hoặc vượt giới hạn', () => {
  const result = createWorkshopMigrationPreview('du_nhua_01', [{ ...employee, baseRate: -1 }], [shift]);
  assert.ok(result.issues.some((issue) => issue.code === 'INVALID_BASE_RATE'));
});

test('4B migration preview chuyển trạng thái nghỉ việc thành inactive', () => {
  const result = createWorkshopMigrationPreview('du_nhua_01', [{ ...employee, status: 'Đã nghỉ', faceEnrolled: false }], [shift]);
  assert.equal(result.employees[0].status, 'inactive');
  assert.equal(result.summary.activeEmployeeCount, 0);
});
