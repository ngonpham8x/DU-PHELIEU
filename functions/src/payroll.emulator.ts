import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { adjustPayrollItem, createProductionBatch, generatePayrollPeriod, payPayrollPeriod, postStockMovement, reviewProductionBatch, transitionPayrollPeriod } from './index.js';

const WORKSHOP_ID = 'du_nhua_01';
const PERIOD_ID = '2026_11';
const db = getFirestore();

type TestRole = 'owner' | 'manager' | 'hr' | 'accountant' | 'production';

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

async function seedPayrollGenerationData(overtime = false) {
  await Promise.all([
    db.doc(`workshops/${WORKSHOP_ID}/shifts/CA_1`).set({
      id: 'CA_1', workshopId: WORKSHOP_ID, hoursCount: 8, breakMinutes: 60, isOvernight: false,
    }),
    db.doc(`workshops/${WORKSHOP_ID}/employees/CN_001`).set({
      id: 'CN_001', workshopId: WORKSHOP_ID, fullName: 'Nguyễn Văn A', shiftId: 'CA_1',
      salaryBasis: 'day', baseRate: 300_000, status: 'active',
    }),
    db.doc(`workshops/${WORKSHOP_ID}/employees/CN_002`).set({
      id: 'CN_002', workshopId: WORKSHOP_ID, fullName: 'Nguyễn Văn B', shiftId: 'CA_1',
      salaryBasis: 'month', baseRate: 7_800_000, status: 'active',
    }),
    db.doc(`workshops/${WORKSHOP_ID}/attendance_events/A_IN`).set({
      id: 'A_IN', workshopId: WORKSHOP_ID, employeeId: 'CN_001', workDate: '2026-11-01',
      timeMinutes: 480, eventType: 'check_in', approvalStatus: 'approved',
    }),
    db.doc(`workshops/${WORKSHOP_ID}/attendance_events/A_OUT`).set({
      id: 'A_OUT', workshopId: WORKSHOP_ID, employeeId: 'CN_001', workDate: '2026-11-01',
      timeMinutes: overtime ? 1080 : 1020, eventType: 'check_out', approvalStatus: 'approved',
    }),
    db.doc(`workshops/${WORKSHOP_ID}/attendance_events/B_IN`).set({
      id: 'B_IN', workshopId: WORKSHOP_ID, employeeId: 'CN_002', workDate: '2026-11-01',
      timeMinutes: 480, eventType: 'check_in', approvalStatus: 'approved',
    }),
    db.doc(`workshops/${WORKSHOP_ID}/attendance_events/B_OUT`).set({
      id: 'B_OUT', workshopId: WORKSHOP_ID, employeeId: 'CN_002', workDate: '2026-11-01',
      timeMinutes: 1020, eventType: 'check_out', approvalStatus: 'approved',
    }),
  ]);
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
    seedMember('production_1', 'production@example.com', 'production'),
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
  await Promise.all([
    db.doc(`workshops/${WORKSHOP_ID}/machines/MAY_01`).set({
      id: 'MAY_01', workshopId: WORKSHOP_ID, name: 'Máy băm 01', status: 'active', totalProcessedGrams: 0,
    }),
    db.doc(`workshops/${WORKSHOP_ID}/weigh_tickets/PC_001`).set({
      id: 'PC_001', workshopId: WORKSHOP_ID, status: 'approved', billableGrams: 1_000_000,
    }),
    db.doc(`workshops/${WORKSHOP_ID}/inventory_items/PET_RAW`).set({
      id: 'PET_RAW', workshopId: WORKSHOP_ID, status: 'active', stockGrams: 2_000_000, inGrams: 2_000_000, outGrams: 0,
    }),
    db.doc(`workshops/${WORKSHOP_ID}/inventory_items/PET_FLAKE`).set({
      id: 'PET_FLAKE', workshopId: WORKSHOP_ID, status: 'active', stockGrams: 0, inGrams: 0, outGrams: 0,
    }),
    db.doc(`workshops/${WORKSHOP_ID}/inventory_items/SCRAP`).set({
      id: 'SCRAP', workshopId: WORKSHOP_ID, status: 'active', stockGrams: 0, inGrams: 0, outGrams: 0,
    }),
  ]);
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

test('Functions tạo kỳ lương từ công duyệt, khóa nguồn và chống tạo trùng', async () => {
  await seedPayrollGenerationData();
  const input = { workshopId: WORKSHOP_ID, periodId: 'GEN_2026_11', month: '2026-11', standardDays: 26 };
  const generated = await generatePayrollPeriod.run(callableRequest('hr_1', 'hr@example.com', input));
  assert.deepEqual(
    { status: generated.status, total: generated.netTotal, employees: generated.employeeCount, sources: generated.sourceEventCount },
    { status: 'draft', total: 600_000, employees: 2, sources: 4 },
  );

  const [period, firstItem, secondItem, source] = await Promise.all([
    db.doc(`workshops/${WORKSHOP_ID}/payroll_periods/GEN_2026_11`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/payroll_items/GEN_2026_11_CN_001`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/payroll_items/GEN_2026_11_CN_002`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/payroll_sources/A_IN`).get(),
  ]);
  assert.equal(period.data()?.blockingIssueCount, 0);
  assert.equal(firstItem.data()?.netPay, 300_000);
  assert.equal(secondItem.data()?.netPay, 300_000);
  assert.equal(source.data()?.periodId, 'GEN_2026_11');

  const retry = await generatePayrollPeriod.run(callableRequest('hr_1', 'hr@example.com', input));
  assert.equal(retry.idempotent, true);
  await assert.rejects(
    generatePayrollPeriod.run(callableRequest('hr_1', 'hr@example.com', { ...input, periodId: 'GEN_DUPLICATE' })),
    /đã được tính vào kỳ lương khác/,
  );
});

test('Functions khóa gửi duyệt tới khi tăng ca được đối soát có dấu vết', async () => {
  await seedPayrollGenerationData(true);
  await generatePayrollPeriod.run(callableRequest('hr_1', 'hr@example.com', {
    workshopId: WORKSHOP_ID, periodId: 'GEN_REVIEW', month: '2026-11', standardDays: 26,
  }));
  await assert.rejects(transitionPayrollPeriod.run(callableRequest('hr_1', 'hr@example.com', {
    workshopId: WORKSHOP_ID, periodId: 'GEN_REVIEW', action: 'submit',
  })), /phải đối soát/);

  const adjustmentInput = {
    workshopId: WORKSHOP_ID, periodId: 'GEN_REVIEW', employeeId: 'CN_001', adjustmentId: 'ADJ_OT_001',
    acceptedProductionGrams: 0, overtimePay: 100_000, allowance: 0, bonus: 0, advance: 0, deductions: 0,
    reason: 'Đã đối chiếu phiếu tăng ca quản lý duyệt',
  };
  const adjusted = await adjustPayrollItem.run(callableRequest('accountant_1', 'accountant@example.com', adjustmentInput));
  assert.equal(adjusted.netPay, 400_000);
  assert.equal(adjusted.netTotal, 700_000);
  assert.equal(adjusted.blockingIssueCount, 0);
  const retry = await adjustPayrollItem.run(callableRequest('accountant_1', 'accountant@example.com', adjustmentInput));
  assert.equal(retry.idempotent, true);

  const submitted = await transitionPayrollPeriod.run(callableRequest('hr_1', 'hr@example.com', {
    workshopId: WORKSHOP_ID, periodId: 'GEN_REVIEW', action: 'submit',
  }));
  assert.equal(submitted.status, 'pending_review');
  const [item, adjustment] = await Promise.all([
    db.doc(`workshops/${WORKSHOP_ID}/payroll_items/GEN_REVIEW_CN_001`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/payroll_adjustments/ADJ_OT_001`).get(),
  ]);
  assert.equal(item.data()?.requiresReview, false);
  assert.equal(adjustment.data()?.netPayBefore, 300_000);
});

test('Functions không tạo kỳ khi còn sự kiện công thiếu cặp', async () => {
  await seedPayrollGenerationData();
  await db.doc(`workshops/${WORKSHOP_ID}/attendance_events/B_OUT`).delete();
  await assert.rejects(
    generatePayrollPeriod.run(callableRequest('hr_1', 'hr@example.com', {
      workshopId: WORKSHOP_ID, periodId: 'GEN_MISSING', month: '2026-11', standardDays: 26,
    })),
    /thiếu cặp/,
  );
  assert.equal((await db.doc(`workshops/${WORKSHOP_ID}/payroll_periods/GEN_MISSING`).get()).exists, false);
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

test('Functions sản xuất chỉ quyết toán kho sau duyệt và khóa phiếu cân dùng một lần', async () => {
  const batchInput = {
    workshopId: WORKSHOP_ID,
    batchId: 'BATCH_001',
    machineId: 'MAY_01',
    weighTicketId: 'PC_001',
    inputItemId: 'PET_RAW',
    outputItemId: 'PET_FLAKE',
    scrapItemId: 'SCRAP',
    inputGrams: 1_000_000,
    outputGrams: 850_000,
    scrapGrams: 50_000,
    note: 'Mẻ ca sáng',
  };
  const created = await createProductionBatch.run(callableRequest('production_1', 'production@example.com', batchInput));
  assert.equal(created.status, 'pending_review');
  assert.equal((await db.doc(`workshops/${WORKSHOP_ID}/inventory_items/PET_RAW`).get()).data()?.stockGrams, 2_000_000);

  await assert.rejects(
    reviewProductionBatch.run(callableRequest('production_1', 'production@example.com', {
      workshopId: WORKSHOP_ID, batchId: 'BATCH_001', action: 'approve',
    })),
    /quyền thực hiện/,
  );
  const approved = await reviewProductionBatch.run(callableRequest('manager_1', 'manager@example.com', {
    workshopId: WORKSHOP_ID, batchId: 'BATCH_001', action: 'approve',
  }));
  assert.equal(approved.status, 'completed');
  assert.equal(approved.lossGrams, 100_000);

  const [raw, output, scrap, ticket, machine, source] = await Promise.all([
    db.doc(`workshops/${WORKSHOP_ID}/inventory_items/PET_RAW`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/inventory_items/PET_FLAKE`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/inventory_items/SCRAP`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/weigh_tickets/PC_001`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/machines/MAY_01`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/production_sources/PC_001`).get(),
  ]);
  assert.equal(raw.data()?.stockGrams, 1_000_000);
  assert.equal(output.data()?.stockGrams, 850_000);
  assert.equal(scrap.data()?.stockGrams, 50_000);
  assert.equal(ticket.data()?.productionBatchId, 'BATCH_001');
  assert.equal(machine.data()?.totalProcessedGrams, 1_000_000);
  assert.equal(source.data()?.batchId, 'BATCH_001');

  const retry = await reviewProductionBatch.run(callableRequest('manager_1', 'manager@example.com', {
    workshopId: WORKSHOP_ID, batchId: 'BATCH_001', action: 'approve',
  }));
  assert.equal(retry.idempotent, true);
  assert.equal((await db.doc(`workshops/${WORKSHOP_ID}/inventory_items/PET_RAW`).get()).data()?.stockGrams, 1_000_000);

  await assert.rejects(
    createProductionBatch.run(callableRequest('production_1', 'production@example.com', { ...batchInput, batchId: 'BATCH_002' })),
    /đã được gắn/,
  );
});

test('Functions sản xuất chặn người lập tự duyệt và hủy mẻ không làm thay đổi kho', async () => {
  const batchInput = {
    workshopId: WORKSHOP_ID,
    batchId: 'BATCH_MANAGER',
    machineId: 'MAY_01',
    weighTicketId: 'PC_001',
    inputItemId: 'PET_RAW',
    outputItemId: 'PET_FLAKE',
    scrapItemId: 'SCRAP',
    inputGrams: 1_000_000,
    outputGrams: 900_000,
    scrapGrams: 25_000,
    note: 'Mẻ quản lý lập',
  };
  await createProductionBatch.run(callableRequest('manager_1', 'manager@example.com', batchInput));
  await assert.rejects(
    reviewProductionBatch.run(callableRequest('manager_1', 'manager@example.com', {
      workshopId: WORKSHOP_ID, batchId: 'BATCH_MANAGER', action: 'approve',
    })),
    /không được tự duyệt/,
  );

  const cancelled = await reviewProductionBatch.run(callableRequest('owner_1', 'owner@example.com', {
    workshopId: WORKSHOP_ID, batchId: 'BATCH_MANAGER', action: 'cancel', reason: 'Sai phân loại nguyên liệu',
  }));
  assert.equal(cancelled.status, 'cancelled');
  const retry = await reviewProductionBatch.run(callableRequest('owner_1', 'owner@example.com', {
    workshopId: WORKSHOP_ID, batchId: 'BATCH_MANAGER', action: 'cancel', reason: 'Sai phân loại nguyên liệu',
  }));
  assert.equal(retry.idempotent, true);

  const [batch, raw, output, ticket] = await Promise.all([
    db.doc(`workshops/${WORKSHOP_ID}/production_batches/BATCH_MANAGER`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/inventory_items/PET_RAW`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/inventory_items/PET_FLAKE`).get(),
    db.doc(`workshops/${WORKSHOP_ID}/weigh_tickets/PC_001`).get(),
  ]);
  assert.equal(batch.data()?.status, 'cancelled');
  assert.equal(raw.data()?.stockGrams, 2_000_000);
  assert.equal(output.data()?.stockGrams, 0);
  assert.equal(ticket.data()?.productionBatchId, undefined);
});
