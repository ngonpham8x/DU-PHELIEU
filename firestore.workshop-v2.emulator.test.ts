import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const PROJECT_ID = 'demo-du-nhua-workshop-v2';
const RULES_FILE = 'docs/FIRESTORE_WORKSHOP_V2_DRAFT.rules';
const WORKSHOP_A = 'du_nhua_01';
const WORKSHOP_B = 'xuong_khac_02';

let testEnv: RulesTestEnvironment;

function dbFor(uid: string, email: string, verified = true) {
  return testEnv.authenticatedContext(uid, { email, email_verified: verified }).firestore();
}

async function seedMember(
  workshopId: string,
  uid: string,
  email: string,
  role: 'owner' | 'manager' | 'hr' | 'accountant' | 'production' | 'worker',
  status: 'active' | 'suspended' = 'active',
  employeeId = '',
) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'workshops', workshopId), {
      id: workshopId,
      name: workshopId,
      status: 'active',
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'workshops', workshopId, 'members', uid), {
      uid,
      email,
      workshopId,
      role,
      status,
      employeeId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'user_workshops', uid), {
      uid,
      email,
      workshopId,
      status,
      updatedAt: Timestamp.now(),
    });
  });
}

async function seedPrivateData(workshopId: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'workshops', workshopId, 'payroll_items', 'PAY_CN_001'), {
      workshopId,
      employeeId: 'CN-001',
      netPay: 8_000_000,
    });
    await setDoc(doc(db, 'workshops', workshopId, 'payroll_items', 'PAY_CN_002'), {
      workshopId,
      employeeId: 'CN-002',
      netPay: 9_000_000,
    });
    await setDoc(doc(db, 'workshops', workshopId, 'payroll_sources', 'ATT_CN_001'), {
      workshopId,
      eventId: 'ATT_CN_001',
      periodId: '2026_11',
    });
    await setDoc(doc(db, 'workshops', workshopId, 'payroll_adjustments', 'ADJ_001'), {
      workshopId,
      periodId: '2026_11',
      employeeId: 'CN-001',
    });
    await setDoc(doc(db, 'workshops', workshopId, 'attendance_events', 'ATT_CN_001'), {
      workshopId,
      employeeId: 'CN-001',
      eventType: 'check_in',
    });
    await setDoc(doc(db, 'workshops', workshopId, 'cash_transactions', 'TX_001'), {
      workshopId,
      amount: 100_000,
    });
    await setDoc(doc(db, 'workshops', workshopId, 'inventory_items', 'PET_01'), {
      id: 'PET_01',
      workshopId,
      stockGrams: 10_000,
    });
    await setDoc(doc(db, 'workshops', workshopId, 'stock_sources', 'weigh_ticket_PC_001'), {
      workshopId,
      sourceType: 'weigh_ticket',
      sourceId: 'PC_001',
      movementId: 'MOV_001',
    });
    await setDoc(doc(db, 'workshops', workshopId, 'machines', 'MAY_01'), {
      id: 'MAY_01', workshopId, name: 'Máy băm 01', status: 'active',
    });
    await setDoc(doc(db, 'workshops', workshopId, 'weigh_tickets', 'PC_001'), {
      id: 'PC_001', workshopId, status: 'approved', billableGrams: 1_000_000,
    });
    await setDoc(doc(db, 'workshops', workshopId, 'production_batches', 'BATCH_001'), {
      id: 'BATCH_001', workshopId, status: 'pending_review', inputGrams: 1_000_000,
    });
    await setDoc(doc(db, 'workshops', workshopId, 'production_sources', 'PC_001'), {
      workshopId, weighTicketId: 'PC_001', batchId: 'BATCH_001',
    });
  });
}

function validEmployee(workshopId = WORKSHOP_A) {
  return {
    id: 'CN-001',
    workshopId,
    code: 'CN-001',
    fullName: 'Nguyễn Văn A',
    phone: '0900000000',
    department: 'Phân loại',
    position: 'Công nhân',
    shiftId: 'ca_ngay',
    salaryBasis: 'day',
    baseRate: 300_000,
    status: 'active',
    biometricStatus: 'not_enrolled',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function validShift(workshopId = WORKSHOP_A) {
  return {
    id: 'ca_ngay',
    workshopId,
    name: 'Ca ngày',
    shiftType: 'admin',
    startTime: '08:00',
    endTime: '17:00',
    breakMinutes: 60,
    graceLateMinutes: 5,
    hoursCount: 8,
    isOvernight: false,
    overtimeMultiplier: 1.5,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

before(async () => {
  const [host, portText] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085').split(':');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port: Number(portText),
      rules: readFileSync(RULES_FILE, 'utf8'),
    },
  });
});

beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv.cleanup());

test('V2 chỉ cho thành viên active, đúng email đọc xưởng và con trỏ của mình', async () => {
  await seedMember(WORKSHOP_A, 'owner_a', 'owner@example.com', 'owner');
  const ownerDb = dbFor('owner_a', 'owner@example.com');
  await assertSucceeds(getDoc(doc(ownerDb, 'user_workshops', 'owner_a')));
  await assertSucceeds(getDoc(doc(ownerDb, 'workshops', WORKSHOP_A)));
  await assertFails(getDoc(doc(ownerDb, 'user_workshops', 'other_uid')));
  await assertFails(getDoc(doc(dbFor('owner_a', 'wrong@example.com'), 'workshops', WORKSHOP_A)));
});

test('V2 chủ xưởng và nhân sự tạo hồ sơ hợp lệ, quản lý chỉ đọc', async () => {
  await seedMember(WORKSHOP_A, 'owner_a', 'owner@example.com', 'owner');
  await seedMember(WORKSHOP_A, 'hr_a', 'hr@example.com', 'hr');
  await seedMember(WORKSHOP_A, 'manager_a', 'manager@example.com', 'manager');

  await assertSucceeds(setDoc(
    doc(dbFor('owner_a', 'owner@example.com'), 'workshops', WORKSHOP_A, 'employees', 'CN-001'),
    validEmployee(),
  ));
  await assertSucceeds(setDoc(
    doc(dbFor('hr_a', 'hr@example.com'), 'workshops', WORKSHOP_A, 'employees', 'CN-002'),
    { ...validEmployee(), id: 'CN-002', code: 'CN-002' },
  ));
  await assertSucceeds(getDocs(collection(
    dbFor('manager_a', 'manager@example.com'), 'workshops', WORKSHOP_A, 'employees',
  )));
  await assertFails(setDoc(
    doc(dbFor('manager_a', 'manager@example.com'), 'workshops', WORKSHOP_A, 'employees', 'CN-003'),
    { ...validEmployee(), id: 'CN-003', code: 'CN-003' },
  ));
});

test('V2 chặn trường ẩn, sai workshopId, đổi mã và xóa nhân viên', async () => {
  await seedMember(WORKSHOP_A, 'owner_a', 'owner@example.com', 'owner');
  const db = dbFor('owner_a', 'owner@example.com');
  const employeeRef = doc(db, 'workshops', WORKSHOP_A, 'employees', 'CN-001');

  await assertFails(setDoc(employeeRef, { ...validEmployee(), hiddenAdmin: true }));
  await assertFails(setDoc(employeeRef, validEmployee(WORKSHOP_B)));
  await assertSucceeds(setDoc(employeeRef, validEmployee()));
  await assertFails(updateDoc(employeeRef, { code: 'CN-999', updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(employeeRef));
});

test('V2 ca làm cho thành viên đọc nhưng chỉ owner/manager/hr được tạo hợp lệ', async () => {
  await seedMember(WORKSHOP_A, 'manager_a', 'manager@example.com', 'manager');
  await seedMember(WORKSHOP_A, 'worker_a', 'worker@example.com', 'worker', 'active', 'CN-001');
  const managerDb = dbFor('manager_a', 'manager@example.com');
  const shiftRef = doc(managerDb, 'workshops', WORKSHOP_A, 'shifts', 'ca_ngay');

  await assertSucceeds(setDoc(shiftRef, validShift()));
  await assertSucceeds(getDocs(collection(dbFor('worker_a', 'worker@example.com'), 'workshops', WORKSHOP_A, 'shifts')));
  await assertFails(setDoc(
    doc(dbFor('worker_a', 'worker@example.com'), 'workshops', WORKSHOP_A, 'shifts', 'ca_dem'),
    { ...validShift(), id: 'ca_dem', name: 'Ca đêm' },
  ));
  await assertFails(setDoc(doc(managerDb, 'workshops', WORKSHOP_A, 'shifts', 'bad_time'), {
    ...validShift(), id: 'bad_time', startTime: '99:00',
  }));
});

test('V2 công nhân chỉ đọc công và lương của chính mình', async () => {
  await seedMember(WORKSHOP_A, 'worker_a', 'worker@example.com', 'worker', 'active', 'CN-001');
  await seedPrivateData(WORKSHOP_A);
  const db = dbFor('worker_a', 'worker@example.com');

  await assertSucceeds(getDoc(doc(db, 'workshops', WORKSHOP_A, 'payroll_items', 'PAY_CN_001')));
  await assertFails(getDoc(doc(db, 'workshops', WORKSHOP_A, 'payroll_items', 'PAY_CN_002')));
  await assertSucceeds(getDocs(query(
    collection(db, 'workshops', WORKSHOP_A, 'payroll_items'),
    where('employeeId', '==', 'CN-001'),
  )));
  await assertSucceeds(getDoc(doc(db, 'workshops', WORKSHOP_A, 'attendance_events', 'ATT_CN_001')));
  await assertFails(getDoc(doc(db, 'workshops', WORKSHOP_A, 'payroll_sources', 'ATT_CN_001')));
  await assertFails(getDoc(doc(db, 'workshops', WORKSHOP_A, 'payroll_adjustments', 'ADJ_001')));
  await assertFails(getDoc(doc(db, 'workshops', WORKSHOP_A, 'cash_transactions', 'TX_001')));
});

test('V2 kế toán đọc lương và sổ tiền nhưng không quản lý membership', async () => {
  await seedMember(WORKSHOP_A, 'accountant_a', 'accountant@example.com', 'accountant');
  await seedPrivateData(WORKSHOP_A);
  const db = dbFor('accountant_a', 'accountant@example.com');

  await assertSucceeds(getDocs(collection(db, 'workshops', WORKSHOP_A, 'payroll_items')));
  await assertSucceeds(getDocs(collection(db, 'workshops', WORKSHOP_A, 'payroll_sources')));
  await assertSucceeds(getDocs(collection(db, 'workshops', WORKSHOP_A, 'payroll_adjustments')));
  await assertSucceeds(getDocs(collection(db, 'workshops', WORKSHOP_A, 'cash_transactions')));
  await assertSucceeds(getDocs(collection(db, 'workshops', WORKSHOP_A, 'inventory_items')));
  await assertSucceeds(getDocs(collection(db, 'workshops', WORKSHOP_A, 'stock_sources')));
  await assertFails(getDocs(collection(db, 'workshops', WORKSHOP_A, 'members')));
  await assertFails(setDoc(doc(db, 'workshops', WORKSHOP_A, 'members', 'attacker'), {
    uid: 'attacker', email: 'attacker@example.com', workshopId: WORKSHOP_A, role: 'owner', status: 'active',
  }));
});

test('V2 dữ liệu sản xuất đọc theo vai trò nhưng chỉ máy chủ được ghi', async () => {
  await seedMember(WORKSHOP_A, 'production_a', 'production@example.com', 'production');
  await seedPrivateData(WORKSHOP_A);
  const db = dbFor('production_a', 'production@example.com');

  await assertSucceeds(getDocs(collection(db, 'workshops', WORKSHOP_A, 'machines')));
  await assertSucceeds(getDocs(collection(db, 'workshops', WORKSHOP_A, 'weigh_tickets')));
  await assertSucceeds(getDocs(collection(db, 'workshops', WORKSHOP_A, 'production_batches')));
  await assertSucceeds(getDocs(collection(db, 'workshops', WORKSHOP_A, 'production_sources')));
  await assertFails(setDoc(
    doc(db, 'workshops', WORKSHOP_A, 'production_batches', 'BATCH_CLIENT'),
    { id: 'BATCH_CLIENT', workshopId: WORKSHOP_A, status: 'completed' },
  ));
});

test('V2 cách ly tuyệt đối dữ liệu giữa hai xưởng', async () => {
  await seedMember(WORKSHOP_A, 'owner_a', 'owner-a@example.com', 'owner');
  await seedMember(WORKSHOP_B, 'owner_b', 'owner-b@example.com', 'owner');
  await seedPrivateData(WORKSHOP_B);

  const ownerA = dbFor('owner_a', 'owner-a@example.com');
  await assertFails(getDoc(doc(ownerA, 'workshops', WORKSHOP_B)));
  await assertFails(getDocs(collection(ownerA, 'workshops', WORKSHOP_B, 'cash_transactions')));
});

test('V2 tài khoản suspended, email chưa xác minh và client ghi ledger đều bị chặn', async () => {
  await seedMember(WORKSHOP_A, 'suspended_a', 'suspended@example.com', 'owner', 'suspended');
  await seedMember(WORKSHOP_A, 'owner_a', 'owner@example.com', 'owner');

  await assertFails(getDoc(doc(dbFor('suspended_a', 'suspended@example.com'), 'workshops', WORKSHOP_A)));
  await assertFails(getDoc(doc(dbFor('owner_a', 'owner@example.com', false), 'workshops', WORKSHOP_A)));
  await assertFails(setDoc(
    doc(dbFor('owner_a', 'owner@example.com'), 'workshops', WORKSHOP_A, 'cash_transactions', 'TX_CLIENT'),
    { workshopId: WORKSHOP_A, amount: 1, createdAt: serverTimestamp() },
  ));
  await assertFails(setDoc(
    doc(dbFor('owner_a', 'owner@example.com'), 'workshops', WORKSHOP_A, 'inventory_items', 'PET_CLIENT'),
    { id: 'PET_CLIENT', workshopId: WORKSHOP_A, stockGrams: 1 },
  ));
});

test('V2 giữ dấu vết migration khi sửa hồ sơ và chỉ owner xem migration job', async () => {
  await seedMember(WORKSHOP_A, 'owner_a', 'owner@example.com', 'owner');
  await seedMember(WORKSHOP_A, 'hr_a', 'hr@example.com', 'hr');
  await seedMember(WORKSHOP_A, 'manager_a', 'manager@example.com', 'manager');
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const now = Timestamp.now();
    await setDoc(doc(db, 'workshops', WORKSHOP_A, 'employees', 'CN-001'), {
      ...validEmployee(),
      migrationId: 'migration_001',
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'workshops', WORKSHOP_A, 'migration_jobs', 'migration_001'), {
      migrationId: 'migration_001', workshopId: WORKSHOP_A, status: 'applied', createdAt: now,
    });
  });

  const employeeRef = doc(dbFor('hr_a', 'hr@example.com'), 'workshops', WORKSHOP_A, 'employees', 'CN-001');
  await assertSucceeds(updateDoc(employeeRef, { fullName: 'Nguyễn Văn B', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(employeeRef, { migrationId: deleteField(), updatedAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(dbFor('owner_a', 'owner@example.com'), 'workshops', WORKSHOP_A, 'migration_jobs', 'migration_001')));
  await assertFails(getDoc(doc(dbFor('manager_a', 'manager@example.com'), 'workshops', WORKSHOP_A, 'migration_jobs', 'migration_001')));
});
