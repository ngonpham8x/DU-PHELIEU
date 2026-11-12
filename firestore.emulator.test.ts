import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const PROJECT_ID = 'demo-du-nhua-phase4';
const OWNER_EMAIL = 'nguyenvandu1990mc@gmail.com';
const EMERGENCY_ADMIN_EMAIL = 'tayninhdoimoi@gmail.com';

let testEnv: RulesTestEnvironment;

function auth(uid: string, email: string, verified = true) {
  return testEnv.authenticatedContext(uid, { email, email_verified: verified }).firestore();
}

async function seedUser(uid: string, email: string, role: string, accessStatus = 'active') {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', uid), {
      uid,
      displayName: uid,
      email,
      role,
      department: 'Xưởng',
      accessStatus,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
}

function cashTransaction(ownerId: string) {
  return {
    ownerId,
    code: 'PT_001',
    type: 'income',
    amount: 100_000,
    counterparty: 'Khách thử nghiệm',
    category: 'Bán nhựa',
    accountType: 'cash',
    description: 'Kiểm thử Emulator',
    dateStr: '12/11/2026',
    status: 'active',
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
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

test('từ chối hoàn toàn người chưa đăng nhập', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'users', 'owner_uid')));
  await assertFails(setDoc(doc(db, 'cash_transactions', 'TX_ANON'), cashTransaction('anonymous')));
});

test('hai quản trị viên bootstrap tạo được hồ sơ owner của chính mình', async () => {
  for (const [uid, email] of [
    ['owner_uid', OWNER_EMAIL],
    ['emergency_uid', EMERGENCY_ADMIN_EMAIL],
  ]) {
    const db = auth(uid, email);
    await assertSucceeds(setDoc(doc(db, 'users', uid), {
      uid,
      displayName: 'Quản trị viên',
      email,
      role: 'owner',
      department: 'Ban quản trị',
      accessStatus: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  }
});

test('tài khoản lạ chỉ ghi được cảnh báo của chính mình, không ghi nghiệp vụ', async () => {
  const uid = 'unknown_uid';
  const email = 'unknown@example.com';
  const db = auth(uid, email);

  await assertSucceeds(setDoc(doc(db, 'security_events', uid), {
    uid,
    email,
    type: 'unknown_account',
    severity: 'critical',
    message: 'Tài khoản chưa được cấp quyền',
    userAgent: 'rules-emulator-test',
    createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(db, 'cash_transactions', 'TX_UNKNOWN'), cashTransaction(uid)));
  await assertFails(getDocs(collection(db, 'users')));
});

test('kế toán đang hoạt động được ghi sổ của mình nhưng không giả ownerId', async () => {
  const uid = 'accountant_uid';
  const email = 'accountant@example.com';
  await seedUser(uid, email, 'accountant');
  const db = auth(uid, email);

  await assertSucceeds(setDoc(doc(db, 'cash_transactions', 'TX_OK'), cashTransaction(uid)));
  await assertFails(setDoc(doc(db, 'cash_transactions', 'TX_SPOOF'), cashTransaction('owner_uid')));
});

test('nhân viên không được ghi sổ tiền nhưng được gửi chấm công dự phòng có dấu vết', async () => {
  const uid = 'worker_uid';
  const email = 'worker@example.com';
  await seedUser(uid, email, 'worker');
  const db = auth(uid, email);

  await assertFails(setDoc(doc(db, 'cash_transactions', 'TX_WORKER'), cashTransaction(uid)));
  await assertSucceeds(setDoc(doc(db, 'attendance_events', 'ATT_WORKER_001'), {
    ownerId: uid,
    employeeCode: 'NV001',
    employeeName: 'Nhân viên thử nghiệm',
    department: 'Phân loại',
    shiftName: 'Ca ngày',
    eventType: 'check_in',
    method: 'fallback_manual',
    confidence: 0,
    approvalStatus: 'pending_approval',
    fallbackReason: 'Camera lỗi, chờ quản lý duyệt',
    dateStr: '12/11/2026 08:00',
    createdAt: serverTimestamp(),
  }));
});

test('tài khoản bị đình chỉ hoặc email token không khớp đều bị khóa', async () => {
  await seedUser('suspended_uid', 'suspended@example.com', 'manager', 'suspended');
  await seedUser('mismatch_uid', 'correct@example.com', 'manager');

  await assertFails(setDoc(
    doc(auth('suspended_uid', 'suspended@example.com'), 'cash_transactions', 'TX_SUSPENDED'),
    cashTransaction('suspended_uid'),
  ));
  await assertFails(setDoc(
    doc(auth('mismatch_uid', 'wrong@example.com'), 'cash_transactions', 'TX_MISMATCH'),
    cashTransaction('mismatch_uid'),
  ));
});

test('nhật ký hoạt động không cho giả actorUid và không thể sửa hoặc xóa', async () => {
  const uid = 'manager_uid';
  const email = 'manager@example.com';
  await seedUser(uid, email, 'manager');
  const db = auth(uid, email);
  const logRef = doc(db, 'activity_logs', 'LOG_001');
  const baseLog = {
    ownerId: uid,
    actorName: 'Quản lý',
    actorUid: uid,
    actorRole: 'manager',
    timestampStr: '12/11/2026 09:00',
    moduleName: 'Hệ thống',
    actionType: 'Kiểm thử',
    targetCode: 'TEST',
    previousValue: '',
    newValue: 'Đã kiểm tra',
    reason: 'Phase 4F',
    resultStatus: 'Thành công',
    createdAt: serverTimestamp(),
  };

  await assertFails(setDoc(doc(db, 'activity_logs', 'LOG_SPOOF'), { ...baseLog, actorUid: 'other_uid' }));
  await assertSucceeds(setDoc(logRef, baseLog));
  await assertFails(setDoc(logRef, { ...baseLog, reason: 'Sửa log' }));
  await assertFails(deleteDoc(logRef));
});
