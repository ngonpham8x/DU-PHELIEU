import { requireSafeId } from './domain.js';

export type PayrollStatus = 'draft' | 'pending_review' | 'approved' | 'finalized' | 'partially_paid' | 'paid';
export type PayrollAction = 'submit' | 'approve' | 'finalize';

const TRANSITIONS: Record<PayrollAction, { from: PayrollStatus; to: PayrollStatus }> = {
  submit: { from: 'draft', to: 'pending_review' },
  approve: { from: 'pending_review', to: 'approved' },
  finalize: { from: 'approved', to: 'finalized' },
};

export function nextPayrollStatus(current: unknown, action: unknown): PayrollStatus {
  if (typeof action !== 'string' || !(action in TRANSITIONS)) throw new Error('Thao tác kỳ lương không hợp lệ.');
  const transition = TRANSITIONS[action as PayrollAction];
  if (current !== transition.from) throw new Error(`Không thể ${action} khi kỳ lương đang ở trạng thái ${String(current)}.`);
  return transition.to;
}

export function validatePayrollTransitionInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dữ liệu chuyển trạng thái không hợp lệ.');
  const input = value as Record<string, unknown>;
  const action = input.action;
  if (typeof action !== 'string' || !(action in TRANSITIONS)) throw new Error('Thao tác kỳ lương không hợp lệ.');
  return {
    workshopId: requireSafeId(input.workshopId, 'Mã xưởng'),
    periodId: requireSafeId(input.periodId, 'Mã kỳ lương'),
    action: action as PayrollAction,
  };
}

export function validatePayrollPaymentInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dữ liệu thanh toán không hợp lệ.');
  const input = value as Record<string, unknown>;
  if (typeof input.amount !== 'number' || !Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > 100_000_000_000) {
    throw new Error('Số tiền thanh toán phải là số nguyên dương hợp lệ.');
  }
  if (!['cash', 'bank'].includes(String(input.accountType))) throw new Error('Tài khoản chi không hợp lệ.');
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > 200) throw new Error('Ghi chú thanh toán quá dài.');
  return {
    workshopId: requireSafeId(input.workshopId, 'Mã xưởng'),
    periodId: requireSafeId(input.periodId, 'Mã kỳ lương'),
    paymentId: requireSafeId(input.paymentId, 'Mã thanh toán'),
    amount: input.amount,
    accountType: input.accountType as 'cash' | 'bank',
    note,
  };
}

export function preparePayrollPayment(period: Record<string, unknown>, amount: number) {
  if (!['finalized', 'partially_paid'].includes(String(period.status))) {
    throw new Error('Kỳ lương chưa được chốt hoặc đã thanh toán xong.');
  }
  const netTotal = period.netTotal;
  const paidTotal = period.paidTotal ?? 0;
  if (typeof netTotal !== 'number' || !Number.isSafeInteger(netTotal) || netTotal < 0) throw new Error('Tổng lương kỳ không hợp lệ.');
  if (typeof paidTotal !== 'number' || !Number.isSafeInteger(paidTotal) || paidTotal < 0 || paidTotal > netTotal) throw new Error('Số đã trả của kỳ lương không hợp lệ.');
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Số tiền thanh toán không hợp lệ.');
  const remainingBefore = netTotal - paidTotal;
  if (amount > remainingBefore) throw new Error('Số tiền thanh toán vượt phần lương còn lại.');
  const newPaidTotal = paidTotal + amount;
  const remainingAfter = netTotal - newPaidTotal;
  return {
    newPaidTotal,
    remainingAfter,
    nextStatus: remainingAfter === 0 ? 'paid' as const : 'partially_paid' as const,
  };
}
