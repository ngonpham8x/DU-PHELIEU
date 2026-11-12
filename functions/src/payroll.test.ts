import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextPayrollStatus,
  payrollTransition,
  preparePayrollPayment,
  validatePayrollPaymentInput,
  validatePayrollTransitionInput,
} from './payroll.js';

test('backend payroll chỉ cho chuyển đúng draft → pending → approved → finalized', () => {
  assert.equal(nextPayrollStatus('draft', 'submit'), 'pending_review');
  assert.equal(nextPayrollStatus('pending_review', 'approve'), 'approved');
  assert.equal(nextPayrollStatus('approved', 'finalize'), 'finalized');
  assert.deepEqual(payrollTransition('approve'), { from: 'pending_review', to: 'approved' });
});

test('backend payroll chặn bỏ qua hoặc lặp trạng thái', () => {
  assert.throws(() => nextPayrollStatus('draft', 'approve'), /Không thể/);
  assert.throws(() => nextPayrollStatus('approved', 'approve'), /Không thể/);
  assert.throws(() => nextPayrollStatus('paid', 'finalize'), /Không thể/);
});

test('backend payroll kiểm tra input chuyển trạng thái', () => {
  const result = validatePayrollTransitionInput({ workshopId: 'du_nhua_01', periodId: '2026-11', action: 'submit' });
  assert.equal(result.action, 'submit');
  assert.throws(() => validatePayrollTransitionInput({ ...result, action: 'delete' }), /không hợp lệ/);
});

test('backend payroll thanh toán một phần và tất toán chính xác', () => {
  const partial = preparePayrollPayment({ status: 'finalized', netTotal: 10_000_000, paidTotal: 0 }, 4_000_000);
  assert.deepEqual(partial, { newPaidTotal: 4_000_000, remainingAfter: 6_000_000, nextStatus: 'partially_paid' });
  const paid = preparePayrollPayment({ status: 'partially_paid', netTotal: 10_000_000, paidTotal: 4_000_000 }, 6_000_000);
  assert.deepEqual(paid, { newPaidTotal: 10_000_000, remainingAfter: 0, nextStatus: 'paid' });
});

test('backend payroll chặn vượt số còn lại, kỳ chưa chốt và số liệu kỳ sai', () => {
  assert.throws(() => preparePayrollPayment({ status: 'finalized', netTotal: 10, paidTotal: 5 }, 6), /vượt/);
  assert.throws(() => preparePayrollPayment({ status: 'approved', netTotal: 10, paidTotal: 0 }, 1), /chưa được chốt/);
  assert.throws(() => preparePayrollPayment({ status: 'finalized', netTotal: 10, paidTotal: 11 }, 1), /đã trả/);
});

test('backend payroll chỉ nhận số tiền nguyên dương và tài khoản hợp lệ', () => {
  const result = validatePayrollPaymentInput({ workshopId: 'du_nhua_01', periodId: '2026-11', paymentId: 'PAY_001', amount: 1000, accountType: 'bank', note: 'Trả lương' });
  assert.equal(result.amount, 1000);
  assert.throws(() => validatePayrollPaymentInput({ ...result, amount: 1.5 }), /số nguyên dương/);
  assert.throws(() => validatePayrollPaymentInput({ ...result, accountType: 'crypto' }), /không hợp lệ/);
});
