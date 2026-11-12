import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCurrencyVND,
  formatWeight,
  formatDateVN,
  calculateNetWeight,
  calculatePurchaseTotal,
  calculateProductionBalance,
  calculateDashboardMetrics,
  canManageCashFlow,
  canRestoreTransaction,
  canViewActivityLogs,
  canViewFullAttendanceTable,
  canEditAttendanceTime,
  canManageFaceEnrollment,
  canApproveFallbackAttendance,
  isDuplicateAttendanceEvent,
  validateAttendanceSequence,
  suggestAttendanceEvent,
  verifyFace1To1,
  computeDailyTimesheetRows,
} from './calculations';

test('suggestAttendanceEvent proposes check-in first and check-out after an open check-in', () => {
  assert.equal(suggestAttendanceEvent([], 'CN-001', '12/11/2026').eventType, 'check_in');
  const records = [{
    id: 'att-open', ownerId: 'demo', employeeCode: 'CN-001', employeeName: 'Nguyễn Văn Hùng',
    department: 'Sản xuất', shiftName: 'Ca sáng', eventType: 'check_in' as const,
    method: 'face_verified' as const, approvalStatus: 'approved' as const, confidence: 98.9,
    workDateStr: '12/11/2026', dateStr: '12/11/2026', timeStr: '06:30', createdAt: '2026-11-12T06:30:00+07:00',
  }];
  assert.equal(suggestAttendanceEvent(records, 'CN-001', '12/11/2026').eventType, 'check_out');
});

test('formatCurrencyVND formats Vietnamese Dong without decimals', () => {
  const result = formatCurrencyVND(15500000);
  assert.ok(result.includes('15.500.000') && result.includes('₫'));
});

test('formatWeight switches between kg and tấn with custom decimals', () => {
  assert.equal(formatWeight(2450, 'kg', 0), '2.450 kg');
  assert.equal(formatWeight(2450, 'tan', 2), '2,45 tấn');
});

test('formatDateVN preserves DD/MM/YYYY format', () => {
  assert.equal(formatDateVN('11/11/2026 08:30'), '11/11/2026');
  assert.equal(formatDateVN(new Date('2026-11-11T10:00:00Z')), '11/11/2026');
});

test('calculateNetWeight computes receivedKg and billableKg accurately', () => {
  const res = calculateNetWeight(5200, 1200, 150);
  assert.equal(res.receivedKg, 4000);
  assert.equal(res.billableKg, 3850);
});

test('calculatePurchaseTotal computes total money and remaining payable debt', () => {
  const res = calculatePurchaseTotal(1000, 32000, 12000000);
  assert.equal(res.totalAmount, 32000000);
  assert.equal(res.debtAmount, 20000000);
});

test('calculateProductionBalance computes lossKg and recoveryRatePercent', () => {
  const res = calculateProductionBalance(5000, 4600, 100, 0, 0);
  assert.equal(res.lossKg, 300);
  assert.equal(res.recoveryRatePercent, 92);
});

test('calculateDashboardMetrics obeys fund balance, transfer invariants, and excludes pending fallback attendance', () => {
  const metrics = calculateDashboardMetrics(
    [
      {
        id: '1',
        ownerId: 'u1',
        code: 'PT-001',
        type: 'income',
        amount: 50000000,
        counterparty: 'Công ty Cao Su Miền Nam',
        category: 'Thu bán mủ băm',
        accountType: 'bank',
        description: 'Thu tiền bán mủ CSR10',
        dateStr: '11/11/2026',
        status: 'active',
        createdAt: '2026-11-11T08:00:00Z',
        updatedAt: '2026-11-11T08:00:00Z',
      },
      {
        id: '2',
        ownerId: 'u1',
        code: 'PC-001',
        type: 'expense',
        amount: 10000000,
        counterparty: 'Điện lực Bình Phước',
        category: 'Tiền điện',
        accountType: 'cash',
        description: 'Thanh toán tiền điện máy băm',
        dateStr: '11/11/2026',
        status: 'active',
        createdAt: '2026-11-11T09:00:00Z',
        updatedAt: '2026-11-11T09:00:00Z',
      },
      {
        id: '3',
        ownerId: 'u1',
        code: 'CQ-001',
        type: 'transfer',
        amount: 5000000,
        counterparty: 'Rút tiền ngân hàng nhập quỹ',
        category: 'Chuyển tiền nội bộ',
        accountType: 'bank',
        toAccountType: 'cash',
        description: 'Rút tiền mặt chi lẻ tại xưởng',
        dateStr: '11/11/2026',
        status: 'active',
        createdAt: '2026-11-11T10:00:00Z',
        updatedAt: '2026-11-11T10:00:00Z',
      },
    ],
    [
      {
        id: 'a1',
        ownerId: 'u1',
        employeeCode: 'CN-01',
        employeeName: 'Nguyễn Văn Hùng',
        department: 'Vận hành máy băm',
        shiftName: 'Ca sáng',
        eventType: 'check_in',
        method: 'face_verified',
        approvalStatus: 'approved',
        confidence: 98.4,
        dateStr: '11/11/2026',
        timeStr: '06:55',
        createdAt: '2026-11-11T06:55:00Z',
      },
      {
        id: 'a2',
        ownerId: 'u1',
        employeeCode: 'CN-05',
        employeeName: 'Đặng Minh Tuấn',
        department: 'Bảo trì máy',
        shiftName: 'Ca sáng',
        eventType: 'check_in',
        method: 'fallback_manual',
        approvalStatus: 'pending_approval',
        confidence: 100,
        dateStr: '11/11/2026',
        timeStr: '07:05',
        createdAt: '2026-11-11T07:05:00Z',
      },
    ],
    [
      {
        id: 't1',
        ownerId: 'u1',
        ticketCode: 'PCN-01',
        ticketType: 'purchase_in',
        partnerName: 'Vườn Ông Bảy',
        rubberType: 'Mủ chén',
        grossKg: 2500,
        tareKg: 400,
        deductionKg: 100,
        netKg: 2000,
        unitPrice: 30000,
        totalAmount: 60000000,
        paidAmount: 0,
        debtAmount: 60000000,
        dateStr: '11/11/2026',
        createdAt: '2026-11-11T07:30:00Z',
      },
    ],
    {
      weightUnit: 'kg',
      weightDecimals: 1,
      darkMode: false,
      openingCashBalance: 20000000,
      openingBankBalance: 100000000,
      openingRawRubberKg: 5000,
      openingShreddedRubberKg: 3000,
    },
    '11/11/2026'
  );

  assert.equal(metrics.todayIncome, 50000000);
  assert.equal(metrics.todayExpense, 10000000);
  assert.equal(metrics.cashBalance, 15000000);
  assert.equal(metrics.bankBalance, 145000000);
  // Pending fallback CN-05 is NOT counted until approved!
  assert.equal(metrics.workersCheckedInToday, 1);
});

test('Add 1.000.000 -> Edit to 1.500.000 -> Cancel -> Restore recalculates balance without double counting', () => {
  const baseSettings = {
    weightUnit: 'kg' as const,
    weightDecimals: 1,
    darkMode: false,
    openingCashBalance: 64800000,
    openingBankBalance: 472500000,
    openingRawRubberKg: 1000,
    openingShreddedRubberKg: 1000,
  };

  const step0 = calculateDashboardMetrics([], [], [], baseSettings, '11/11/2026');
  assert.equal(step0.cashBalance, 64800000);

  const txAdded = {
    id: 'tx-test-1',
    ownerId: 'demo-user',
    code: 'PT-TEST-001',
    type: 'income' as const,
    amount: 1000000,
    counterparty: 'Khách hàng A',
    category: 'Thu tiền bán hàng',
    accountType: 'cash' as const,
    description: 'Thu tiền mặt 1 triệu',
    dateStr: '11/11/2026 10:00',
    status: 'active' as const,
    createdAt: '2026-11-11T10:00:00Z',
    updatedAt: '2026-11-11T10:00:00Z',
  };
  const step2 = calculateDashboardMetrics([txAdded], [], [], baseSettings, '11/11/2026');
  assert.equal(step2.cashBalance, 65800000);

  const txEdited = { ...txAdded, amount: 1500000 };
  const step4 = calculateDashboardMetrics([txEdited], [], [], baseSettings, '11/11/2026');
  assert.equal(step4.cashBalance, 66300000);

  const txCancelled = {
    ...txEdited,
    status: 'cancelled' as const,
    cancelReason: 'Kiểm thử hủy giao dịch',
  };
  const step6 = calculateDashboardMetrics([txCancelled], [], [], baseSettings, '11/11/2026');
  assert.equal(step6.cashBalance, 64800000);
});

test('RBAC helpers enforce cashflow, restore, activity log, face enrollment, and attendance permissions accurately', () => {
  assert.equal(canManageCashFlow('owner'), true);
  assert.equal(canManageCashFlow('manager'), true);
  assert.equal(canManageCashFlow('accountant'), true);
  assert.equal(canManageCashFlow('worker'), false);

  assert.equal(canRestoreTransaction('owner'), true);
  assert.equal(canRestoreTransaction('manager'), true);
  assert.equal(canRestoreTransaction('accountant'), false);

  assert.equal(canViewActivityLogs('owner'), true);
  assert.equal(canViewActivityLogs('manager'), true);
  assert.equal(canViewActivityLogs('hr'), true);
  assert.equal(canViewActivityLogs('worker'), false);

  assert.equal(canViewFullAttendanceTable('owner'), true);
  assert.equal(canViewFullAttendanceTable('manager'), true);
  assert.equal(canViewFullAttendanceTable('hr'), true);
  assert.equal(canViewFullAttendanceTable('worker'), false);

  assert.equal(canEditAttendanceTime('worker'), false);
  assert.equal(canManageFaceEnrollment('owner'), true);
  assert.equal(canManageFaceEnrollment('hr'), true);
  assert.equal(canManageFaceEnrollment('worker'), false);
  assert.equal(canApproveFallbackAttendance('manager'), true);
  assert.equal(canApproveFallbackAttendance('worker'), false);
});

test('validateAttendanceSequence detects double check-in, check-out without check-in, and supports overnight shifts', () => {
  const records = [
    {
      id: 'att-1',
      ownerId: 'u1',
      employeeCode: 'CN-001',
      employeeName: 'Nguyễn Văn Hùng',
      department: 'Vận hành máy băm',
      shiftName: 'Ca sáng (06:30 - 14:30)',
      eventType: 'check_in' as const,
      method: 'face_verified' as const,
      approvalStatus: 'approved' as const,
      confidence: 99.1,
      dateStr: '11/11/2026',
      timeStr: '06:24',
      createdAt: '2026-11-11T06:24:00Z',
    },
    {
      id: 'att-night-in',
      ownerId: 'u1',
      employeeCode: 'CN-004',
      employeeName: 'Phạm Văn Đạt',
      department: 'Bốc xếp & Kho',
      shiftName: 'Ca đêm qua ngày (22:00 - 06:00)',
      eventType: 'check_in' as const,
      method: 'face_verified' as const,
      approvalStatus: 'approved' as const,
      confidence: 98.8,
      workDateStr: '10/11/2026',
      isOvernight: true,
      dateStr: '10/11/2026',
      timeStr: '21:55',
      createdAt: '2026-11-10T21:55:00Z',
    },
  ];

  // 1. Double check-in for CN-001 on 11/11/2026 is blocked
  const doubleCheckIn = validateAttendanceSequence(
    records,
    'CN-001',
    'Nguyễn Văn Hùng',
    'check_in',
    '11/11/2026',
    false
  );
  assert.equal(doubleCheckIn.valid, false);
  assert.equal(doubleCheckIn.code, 'DOUBLE_CHECK_IN');

  // 2. Check-out for CN-001 on 11/11/2026 is allowed
  const validCheckOut = validateAttendanceSequence(
    records,
    'CN-001',
    'Nguyễn Văn Hùng',
    'check_out',
    '11/11/2026',
    false
  );
  assert.equal(validCheckOut.valid, true);
  assert.equal(validCheckOut.resolvedWorkDateStr, '11/11/2026');

  // 3. Check-out without check-in for CN-005 on 11/11/2026 is blocked
  const noCheckIn = validateAttendanceSequence(
    records,
    'CN-005',
    'Đặng Minh Tuấn',
    'check_out',
    '11/11/2026',
    false
  );
  assert.equal(noCheckIn.valid, false);
  assert.equal(noCheckIn.code, 'CHECK_OUT_WITHOUT_CHECK_IN');

  // 4. Overnight shift check-out on 11/11/2026 morning resolves to 10/11/2026 shift date!
  const overnightCheckOut = validateAttendanceSequence(
    records,
    'CN-004',
    'Phạm Văn Đạt',
    'check_out',
    '11/11/2026',
    true
  );
  assert.equal(overnightCheckOut.valid, true);
  assert.equal(overnightCheckOut.resolvedWorkDateStr, '10/11/2026');

  assert.equal(
    isDuplicateAttendanceEvent(records, 'CN-001', 'check_in', '11/11/2026'),
    true
  );
});

test('verifyFace1To1 validates 1:1 matching, liveness anti-spoofing, and lighting', () => {
  // 1. Correct 1:1 match
  const ok = verifyFace1To1({
    expectedEmployeeCode: 'CN-001',
    capturedEmployeeCode: 'CN-001',
    faceEnrolled: true,
    livenessPassed: true,
    lightingScore: 88,
  });
  assert.equal(ok.verified, true);
  assert.ok(ok.confidence >= 95);

  // 2. Mismatch with another employee
  const mismatch = verifyFace1To1({
    expectedEmployeeCode: 'CN-001',
    capturedEmployeeCode: 'CN-002',
    faceEnrolled: true,
    livenessPassed: true,
    lightingScore: 88,
  });
  assert.equal(mismatch.verified, false);
  assert.equal(mismatch.errorCode, 'MISMATCH_1_TO_1');

  // 3. Spoof / static photo rejected
  const spoof = verifyFace1To1({
    expectedEmployeeCode: 'CN-001',
    capturedEmployeeCode: 'CN-001',
    faceEnrolled: true,
    livenessPassed: false,
    spoofDetected: true,
    lightingScore: 88,
  });
  assert.equal(spoof.verified, false);
  assert.equal(spoof.errorCode, 'SPOOF_DETECTED');
});

test('computeDailyTimesheetRows computes regular hours, overtime, overnight shifts, and pending fallback status', () => {
  const employees = [
    {
      code: 'CN-001',
      fullName: 'Nguyễn Văn Hùng',
      phone: '0918 234 561',
      department: 'Vận hành máy băm',
      position: 'Tổ trưởng',
      shiftName: 'Ca sáng (06:30 - 14:30)',
      salaryType: 'Ngày' as const,
      baseRate: 450000,
      faceEnrolled: true,
      enrolledAngles: 3,
      status: 'Đang làm việc' as const,
    },
    {
      code: 'CN-004',
      fullName: 'Phạm Văn Đạt',
      phone: '0972 910 332',
      department: 'Bốc xếp & Kho',
      position: 'Công nhân kho',
      shiftName: 'Ca đêm qua ngày (22:00 - 06:00)',
      salaryType: 'Ngày' as const,
      baseRate: 420000,
      faceEnrolled: true,
      enrolledAngles: 3,
      status: 'Đang làm việc' as const,
    },
  ];

  const shifts = [
    {
      id: 'shift-morning',
      name: 'Ca sáng (06:30 - 14:30)',
      startTime: '06:30',
      endTime: '14:30',
      breakMinutes: 45,
      graceLateMinutes: 10,
      hoursCount: 7.25,
    },
    {
      id: 'shift-night',
      name: 'Ca đêm qua ngày (22:00 - 06:00)',
      startTime: '22:00',
      endTime: '06:00',
      breakMinutes: 45,
      graceLateMinutes: 10,
      hoursCount: 7.25,
      isOvernight: true,
    },
  ];

  const records = [
    // CN-001 works 06:30 -> 16:30 (10h span - 45m break = 9.25h actual; standard 7.25h -> 2.0h overtime)
    {
      id: 'r1',
      ownerId: 'u1',
      employeeCode: 'CN-001',
      employeeName: 'Nguyễn Văn Hùng',
      department: 'Vận hành máy băm',
      shiftName: 'Ca sáng (06:30 - 14:30)',
      eventType: 'check_in' as const,
      method: 'face_verified' as const,
      approvalStatus: 'approved' as const,
      confidence: 99,
      workDateStr: '11/11/2026',
      dateStr: '11/11/2026',
      timeStr: '06:30',
      createdAt: '2026-11-11T06:30:00Z',
    },
    {
      id: 'r2',
      ownerId: 'u1',
      employeeCode: 'CN-001',
      employeeName: 'Nguyễn Văn Hùng',
      department: 'Vận hành máy băm',
      shiftName: 'Ca sáng (06:30 - 14:30)',
      eventType: 'check_out' as const,
      method: 'face_verified' as const,
      approvalStatus: 'approved' as const,
      confidence: 99,
      workDateStr: '11/11/2026',
      dateStr: '11/11/2026',
      timeStr: '16:30',
      createdAt: '2026-11-11T16:30:00Z',
    },
    // CN-004 works overnight 22:00 (10/11) -> 06:00 (11/11) = 8h span - 45m break = 7.25h actual
    {
      id: 'r3',
      ownerId: 'u1',
      employeeCode: 'CN-004',
      employeeName: 'Phạm Văn Đạt',
      department: 'Bốc xếp & Kho',
      shiftName: 'Ca đêm qua ngày (22:00 - 06:00)',
      eventType: 'check_in' as const,
      method: 'face_verified' as const,
      approvalStatus: 'approved' as const,
      confidence: 98.5,
      workDateStr: '10/11/2026',
      isOvernight: true,
      dateStr: '10/11/2026',
      timeStr: '22:00',
      createdAt: '2026-11-10T22:00:00Z',
    },
    {
      id: 'r4',
      ownerId: 'u1',
      employeeCode: 'CN-004',
      employeeName: 'Phạm Văn Đạt',
      department: 'Bốc xếp & Kho',
      shiftName: 'Ca đêm qua ngày (22:00 - 06:00)',
      eventType: 'check_out' as const,
      method: 'face_verified' as const,
      approvalStatus: 'approved' as const,
      confidence: 98.7,
      workDateStr: '10/11/2026',
      isOvernight: true,
      dateStr: '11/11/2026',
      timeStr: '06:00',
      createdAt: '2026-11-11T06:00:00Z',
    },
  ];

  const rows = computeDailyTimesheetRows(records, employees, shifts);
  const rowCN001 = rows.find((r) => r.employeeCode === 'CN-001');
  const rowCN004 = rows.find((r) => r.employeeCode === 'CN-004');

  assert.ok(rowCN001);
  assert.equal(rowCN001.actualHours, 9.25);
  assert.equal(rowCN001.overtimeHours, 2);

  assert.ok(rowCN004);
  assert.equal(rowCN004.actualHours, 7.25);
  assert.equal(rowCN004.overtimeHours, 0);
  assert.equal(rowCN004.isOvernightShift, true);
});
