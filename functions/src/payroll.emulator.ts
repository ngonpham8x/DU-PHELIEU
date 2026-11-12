import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { payPayrollPeriod, postStockMovement, transitionPayrollPeriod } from './index.js';

const WORKSHOP_ID = 'du_nhua_01';
const PERIOD_ID = '2026_11';
const db = getFirestore();

type TestRole = 'owner' | 'manager' | 'hr' | 'accountant';

function callableRequest(uid: string, email: string, data: Record<string, unknown>) {
  return {
    data,
    auth: {
      uid,
      token: { email, email_verified: true },
    },
    app: { appId: 'payroll-emulator-test' },
    instanceIdToken: undefined,
    rawRequest: {} as never,
    acceptsStreaming: false,
  } as never;
}

async function seedMember(uid: string, email: string, role: TestRole) {
  await db.doc(`workshops/${WORKSHOP_ID}/members/${uid}`).set({
    uid,
    email,
    workshopId: WORKSHOP_ID,
    role,
    status: 'active',
    employeeId: '',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Bài kiểm tra chỉ được chạy với Firestore Emulator.');
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection('workshops').doc(WORKSHOP_ID));
  await db.doc(`workshops/${WORKSHOP_ID}`).set({ id: WORKSHOP_ID, name: 'Xưởng kiểm thử', status: 'active' });
  await Promise.all([
    seedMember('owner_1', 'owner@example.com', 'owner'),
    seedMember('manager_1', 'manager@example.com', 'manager'),
    seedMember('hr_1', 'hr@example.com', 'hr'),
    seedMember('accountant_1', 'accountant@example.com', 'accountant'),
  ]);
  await db.doc(`workshops/${WORKSHOP_ID}/payroll_periods/${PERIOD_ID}`).set({
    id: PERIOD_ID,
    workshopId: WORKSHOP_ID,
    month: '2026-11',
    status: 'draft',
    netTotal: 10_000_000,
    paidTotal: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db.doc(`workshops/${WORKSHOP_ID}/inventory_items/PET_01`).set({
    id: 'PET_01',
    workshopId: WORKSHOP_ID,
    name: 'Nhựa PET',
    stockGrams: 10_000_000,
    inGrams: 20_000_000,
    outGrams: 10_000_000,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
});

after(async () => {
  await db.recursiveDelete(db.collection('workshops').doc(WORKSHOP_ID));
  await db.terminate();
});

test('Functions chuyển kỳ lương đúng quyền và bắt buộc người duyệt khác người gửi', async () => {
  const submit = await transitionPayrollPeriod.run(callableRequest('hr_1', 'hr@example.com', {
    workshopId: WORKSHOP_ID,
    periodId: PERIOD_ID,
    action: 'submit',
  }));
  assert.equal(submit.status, 'pending_review');

  await assert.rejects(
    transitionPayrollPeriod.run(callableRequest('hr_1', 'hr@example.com', {
      workshopId: WORKSHOP_ID,
      periodId: PERIOD_ID,
      action: 'approve',
    })),
    /quyền thực hiện/,
  );

  const approved = await transitionPayrollPeriod.run(callableRequest('manager_1', 'manager@example.com', {
    workshopId: WORKSHOP_ID,
    periodId: PERIOD_ID,
    action: 'approve',
  }));
  assert.equal(approved.status, 'approved');

  const finalized = await transitionPayrollPeriod.run(callableRequest('accountant_1', 'accountant@example.com', {
    workshopId: WORKSHOP_ID,
    periodId: PERIOD_ID,
    action: 'finalize',
  }));
  assert.equal(finalized.status, 'finalized');
  const period = (await db.doc(`workshops/${WORKSHOP_ID}/payroll_periods/${PERIOD_ID}`).get()).data();
  assert.equal(period?.status, 'finalized');
  assert.equal(period?.paidTotal, 0);
});

test('Functions thanh toán lương nguyên tử, chống ghi trùng và tất toán chính xác', async () => {
  await db.doc(`workshops/${WORKSHOP_ID}/payroll_periods/${PERIOD_ID}`).update({ status: 'finalized' });
  const firstInput = {
    workshopId: WORKSHOP_ID,
    periodId: PERIOD_ID,
    paymentId: 'PAY_001',
    amount: 4_000_000,
    accountType: 'bank',
    note: 'Thanh toán đợt 1',
  };
  const first = await payPayrollPeriod.run(callableRequest('accountant_1', 'accountant@example.com', firstInput));
  assert.deepEqual(
    { paid: first.paid, status: first.status, paidTotal: first.paidTotal, remaining: first.remaining },
    { paid: true, status: 'partially_paid', paidTotal: 4_000_000, remaining: 6_000_000 },
  );

  const retry = await payPayrollPeriod.run(callableRequest('accountant_1', 'accountant@example.com', firstInput));
  assert.equal(retry.idempotent, true);
  assert.equal(retry.paid, false);

  const [periodAfterFirst, payment, cash] = await Promise.all([
    db.doc(`workshops/${WORKSHOP_ID}/payroll_periods/${PERIOD_ID}`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/payroll_payments/PAY_001`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/cash_transactions/payroll_PAY_001`).get(),
  ]);
  assert.equal(periodAfterFirst.data()?.paidTotal, 4_000_000);
  assert.equal(payment.data()?.amount, 4_000_000);
  assert.equal(cash.data()?.referenceId, 'PAY_001');

  await assert.rejects(
    payPayrollPeriod.run(callableRequest('accountant_1', 'accountant@example.com', { ...firstInput, amount: 5_000_000 })),
    /đã được sử dụng/,
  );

  const finalPayment = await payPayrollPeriod.run(callableRequest('owner_1', 'owner@example.com', {
    ...firstInput,
    paymentId: 'PAY_002',
    amount: 6_000_000,
    note: 'Tất toán',
  }));
  assert.equal(finalPayment.status, 'paid');
  assert.equal(finalPayment.remaining, 0);
  assert.equal((await db.doc(`workshops/${WORKSHOP_ID}/payroll_periods/${PERIOD_ID}`).get()).data()?.paidTotal, 10_000_000);
});

test('Functions kho chống xuất vượt tồn và khóa chứng từ nguồn chống đồng bộ hai lần', async () => {
  const firstInput = {
    workshopId: WORKSHOP_ID,
    movementId: 'MOV_001',
    itemId: 'PET_01',
    type: 'out',
    quantityGrams: 2_500_000,
    sourceType: 'weigh_ticket',
    sourceId: 'PX_001',
    note: 'Xuất theo phiếu cân',
  };
  const posted = await postStockMovement.run(callableRequest('manager_1', 'manager@example.com', firstInput));
  assert.deepEqual(
    { posted: posted.posted, before: posted.stockBefore, after: posted.stockAfter },
    { posted: true, before: 10_000_000, after: 7_500_000 },
  );

  const retry = await postStockMovement.run(callableRequest('manager_1', 'manager@example.com', firstInput));
  assert.equal(retry.idempotent, true);
  assert.equal(retry.stockAfter, 7_500_000);

  await assert.rejects(
    postStockMovement.run(callableRequest('manager_1', 'manager@example.com', {
      ...firstInput,
      movementId: 'MOV_002',
    })),
    /đã được đồng bộ/,
  );
  await assert.rejects(
    postStockMovement.run(callableRequest('manager_1', 'manager@example.com', {
      ...firstInput,
      movementId: 'MOV_003',
      sourceId: 'PX_003',
      quantityGrams: 8_000_000,
    })),
    /vượt tồn/,
  );

  const [item, movement, source] = await Promise.all([
    db.doc(`workshops/${WORKSHOP_ID}/inventory_items/PET_01`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/stock_movements/MOV_001`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/stock_sources/weigh_ticket_PX_001`).get(),
  ]);
  assert.equal(item.data()?.stockGrams, 7_500_000);
  assert.equal(movement.data()?.stockAfter, 7_500_000);
  assert.equal(source.data()?.movementId, 'MOV_001');
});
