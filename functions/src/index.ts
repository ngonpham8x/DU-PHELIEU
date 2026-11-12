import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { DocumentData, DocumentReference, FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { defineString } from 'firebase-functions/params';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import {
  normalizeEmail,
  parseBootstrapEmails,
  requireSafeId,
  requireUid,
  validateMigrationBundle,
  validateProvisionMemberInput,
  type MemberRole,
} from './domain.js';

initializeApp();
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10 });

const db = getFirestore();
const bootstrapAdminEmails = defineString('BOOTSTRAP_ADMIN_EMAILS');
const sensitiveCallable = {
  enforceAppCheck: true,
  consumeAppCheckToken: true,
  timeoutSeconds: 120,
  memory: '512MiB' as const,
};

type Caller = { uid: string; email: string };

function fail(code: 'invalid-argument' | 'unauthenticated' | 'permission-denied' | 'failed-precondition' | 'already-exists', message: string): never {
  throw new HttpsError(code, message);
}

function callerFrom(request: CallableRequest<unknown>): Caller {
  if (!request.auth) fail('unauthenticated', 'Bạn phải đăng nhập.');
  if (request.auth.token.email_verified !== true) fail('permission-denied', 'Email chưa được xác minh.');
  try {
    return { uid: requireUid(request.auth.uid), email: normalizeEmail(request.auth.token.email) };
  } catch {
    fail('permission-denied', 'Danh tính đăng nhập không hợp lệ.');
  }
}

function safeInput<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    fail('invalid-argument', error instanceof Error ? error.message : 'Dữ liệu không hợp lệ.');
  }
}

async function requireWorkshopRole(workshopId: string, caller: Caller, roles: MemberRole[]) {
  const memberRef = db.doc(`workshops/${workshopId}/members/${caller.uid}`);
  const snapshot = await memberRef.get();
  const data = snapshot.data();
  if (!snapshot.exists || data?.status !== 'active' || data?.email !== caller.email || !roles.includes(data?.role)) {
    fail('permission-denied', 'Bạn không có quyền thực hiện thao tác này.');
  }
  return data as { role: MemberRole; employeeId?: string };
}

export const bootstrapWorkshop = onCall(sensitiveCallable, async (request) => {
  const caller = callerFrom(request);
  const allowedEmails = safeInput(() => parseBootstrapEmails(bootstrapAdminEmails.value()));
  if (!allowedEmails.includes(caller.email)) fail('permission-denied', 'Tài khoản không thuộc danh sách bootstrap được cấu hình.');

  const input = safeInput(() => {
    const value = request.data as Record<string, unknown> | null;
    return {
      workshopId: requireSafeId(value?.workshopId, 'Mã xưởng'),
      name: typeof value?.name === 'string' && value.name.trim().length >= 2 && value.name.trim().length <= 120
        ? value.name.trim()
        : fail('invalid-argument', 'Tên xưởng không hợp lệ.'),
    };
  });

  const workshopRef = db.doc(`workshops/${input.workshopId}`);
  const memberRef = workshopRef.collection('members').doc(caller.uid);
  const pointerRef = db.doc(`user_workshops/${caller.uid}`);
  const auditRef = workshopRef.collection('audit_logs').doc();

  const result = await db.runTransaction(async (transaction) => {
    const [workshopSnapshot, pointerSnapshot] = await Promise.all([
      transaction.get(workshopRef),
      transaction.get(pointerRef),
    ]);

    if (pointerSnapshot.exists && pointerSnapshot.data()?.workshopId !== input.workshopId) {
      fail('already-exists', 'Tài khoản đã được gắn với một xưởng khác.');
    }
    if (workshopSnapshot.exists) {
      if (workshopSnapshot.data()?.bootstrapUid === caller.uid) return { created: false };
      fail('already-exists', 'Mã xưởng đã tồn tại.');
    }

    const now = FieldValue.serverTimestamp();
    transaction.create(workshopRef, {
      id: input.workshopId,
      name: input.name,
      status: 'active',
      bootstrapUid: caller.uid,
      schemaVersion: 2,
      createdAt: now,
      updatedAt: now,
    });
    transaction.set(memberRef, {
      uid: caller.uid,
      email: caller.email,
      workshopId: input.workshopId,
      role: 'owner',
      status: 'active',
      employeeId: '',
      createdAt: now,
      updatedAt: now,
    });
    transaction.set(pointerRef, {
      uid: caller.uid,
      email: caller.email,
      workshopId: input.workshopId,
      status: 'active',
      updatedAt: now,
    });
    transaction.create(auditRef, {
      type: 'workshop_bootstrapped',
      actorUid: caller.uid,
      actorEmail: caller.email,
      targetId: input.workshopId,
      createdAt: now,
    });
    return { created: true };
  });

  return { ok: true, workshopId: input.workshopId, ...result };
});

export const provisionWorkshopMember = onCall(sensitiveCallable, async (request) => {
  const caller = callerFrom(request);
  const input = safeInput(() => validateProvisionMemberInput(request.data));
  await requireWorkshopRole(input.workshopId, caller, ['owner']);

  const authUser = await getAuth().getUser(input.uid).catch(() => fail('failed-precondition', 'UID chưa tồn tại trong Firebase Authentication.'));
  if (!authUser.emailVerified || normalizeEmail(authUser.email) !== input.email) {
    fail('failed-precondition', 'Email Firebase Authentication chưa xác minh hoặc không khớp.');
  }

  const workshopRef = db.doc(`workshops/${input.workshopId}`);
  const memberRef = workshopRef.collection('members').doc(input.uid);
  const pointerRef = db.doc(`user_workshops/${input.uid}`);
  const auditRef = workshopRef.collection('audit_logs').doc();

  const result = await db.runTransaction(async (transaction) => {
    const [memberSnapshot, pointerSnapshot] = await Promise.all([
      transaction.get(memberRef),
      transaction.get(pointerRef),
    ]);
    if (pointerSnapshot.exists && pointerSnapshot.data()?.workshopId !== input.workshopId) {
      fail('already-exists', 'Thành viên đã thuộc một xưởng khác.');
    }
    const existing = memberSnapshot.data();
    if (memberSnapshot.exists && existing?.email === input.email && existing?.role === input.role && existing?.employeeId === input.employeeId && existing?.status === 'active') {
      return { created: false };
    }

    const now = FieldValue.serverTimestamp();
    transaction.set(memberRef, {
      uid: input.uid,
      email: input.email,
      workshopId: input.workshopId,
      role: input.role,
      status: 'active',
      employeeId: input.employeeId,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
    transaction.set(pointerRef, {
      uid: input.uid,
      email: input.email,
      workshopId: input.workshopId,
      status: 'active',
      updatedAt: now,
    });
    transaction.create(auditRef, {
      type: memberSnapshot.exists ? 'member_updated' : 'member_provisioned',
      actorUid: caller.uid,
      actorEmail: caller.email,
      targetId: input.uid,
      role: input.role,
      createdAt: now,
    });
    return { created: !memberSnapshot.exists };
  });

  return { ok: true, workshopId: input.workshopId, uid: input.uid, ...result };
});

type MigrationTarget = {
  kind: 'employees' | 'shifts';
  id: string;
  data: Record<string, unknown>;
  ref: DocumentReference<DocumentData>;
};

export const applyWorkshopMigration = onCall(sensitiveCallable, async (request) => {
  const caller = callerFrom(request);
  const migration = safeInput(() => validateMigrationBundle(request.data));
  await requireWorkshopRole(migration.workshopId, caller, ['owner']);

  const workshopRef = db.doc(`workshops/${migration.workshopId}`);
  const jobRef = workshopRef.collection('migration_jobs').doc(migration.migrationId);
  const auditRef = workshopRef.collection('audit_logs').doc();
  const targets: MigrationTarget[] = [
    ...migration.shifts.map((data) => ({ kind: 'shifts' as const, id: String(data.id), data, ref: workshopRef.collection('shifts').doc(String(data.id)) })),
    ...migration.employees.map((data) => ({ kind: 'employees' as const, id: String(data.id), data, ref: workshopRef.collection('employees').doc(String(data.id)) })),
  ];

  const result = await db.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(jobRef);
    if (jobSnapshot.exists) {
      const job = jobSnapshot.data();
      if (job?.status === 'applied' && job?.payloadHash === migration.payloadHash) return { applied: false, idempotent: true };
      fail('already-exists', 'Mã migration đã được sử dụng với nội dung hoặc trạng thái khác.');
    }

    const targetSnapshots = await Promise.all(targets.map((target) => transaction.get(target.ref)));
    const now = FieldValue.serverTimestamp();
    targets.forEach((target, index) => {
      const snapshot = targetSnapshots[index];
      const backupRef = jobRef.collection('backups').doc(`${target.kind}_${target.id}`);
      transaction.create(backupRef, {
        targetPath: target.ref.path,
        existed: snapshot.exists,
        data: snapshot.exists ? snapshot.data() : null,
        createdAt: now,
      });
      transaction.set(target.ref, {
        ...target.data,
        migrationId: migration.migrationId,
        createdAt: snapshot.exists ? snapshot.data()?.createdAt || now : now,
        updatedAt: now,
      });
    });
    transaction.create(jobRef, {
      migrationId: migration.migrationId,
      workshopId: migration.workshopId,
      payloadHash: migration.payloadHash,
      status: 'applied',
      employeeCount: migration.employees.length,
      shiftCount: migration.shifts.length,
      actorUid: caller.uid,
      appliedAt: now,
      createdAt: now,
    });
    transaction.create(auditRef, {
      type: 'migration_applied',
      actorUid: caller.uid,
      actorEmail: caller.email,
      targetId: migration.migrationId,
      payloadHash: migration.payloadHash,
      createdAt: now,
    });
    return { applied: true, idempotent: false };
  });

  return { ok: true, migrationId: migration.migrationId, ...result };
});

export const rollbackWorkshopMigration = onCall(sensitiveCallable, async (request) => {
  const caller = callerFrom(request);
  const input = safeInput(() => {
    const data = request.data as Record<string, unknown> | null;
    return {
      workshopId: requireSafeId(data?.workshopId, 'Mã xưởng'),
      migrationId: requireSafeId(data?.migrationId, 'Mã migration'),
    };
  });
  await requireWorkshopRole(input.workshopId, caller, ['owner']);

  const workshopRef = db.doc(`workshops/${input.workshopId}`);
  const jobRef = workshopRef.collection('migration_jobs').doc(input.migrationId);
  const backupSnapshots = await jobRef.collection('backups').get();
  if (backupSnapshots.size > 200) fail('failed-precondition', 'Bản sao vượt giới hạn rollback an toàn.');

  const backups = backupSnapshots.docs.map((snapshot) => {
    const data = snapshot.data();
    const targetPath = typeof data.targetPath === 'string' ? data.targetPath : '';
    const allowedPrefix = `workshops/${input.workshopId}/`;
    if (!targetPath.startsWith(allowedPrefix) || (!targetPath.includes('/employees/') && !targetPath.includes('/shifts/'))) {
      fail('failed-precondition', 'Đường dẫn bản sao không hợp lệ.');
    }
    return { data, ref: db.doc(targetPath) };
  });
  const auditRef = workshopRef.collection('audit_logs').doc();

  const result = await db.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(jobRef);
    if (!jobSnapshot.exists) fail('failed-precondition', 'Không tìm thấy migration.');
    const job = jobSnapshot.data();
    if (job?.status === 'rolled_back') return { rolledBack: false, idempotent: true };
    if (job?.status !== 'applied' || !(job?.appliedAt instanceof Timestamp)) fail('failed-precondition', 'Migration không ở trạng thái có thể rollback.');

    const currentSnapshots = await Promise.all(backups.map((backup) => transaction.get(backup.ref)));
    currentSnapshots.forEach((snapshot) => {
      const updatedAt = snapshot.data()?.updatedAt;
      if (!snapshot.exists || snapshot.data()?.migrationId !== input.migrationId || !(updatedAt instanceof Timestamp) || !updatedAt.isEqual(job.appliedAt)) {
        fail('failed-precondition', 'Dữ liệu đã thay đổi sau migration; dừng rollback để tránh ghi đè.');
      }
    });

    backups.forEach((backup) => {
      if (backup.data.existed === true && backup.data.data && typeof backup.data.data === 'object') {
        transaction.set(backup.ref, backup.data.data as DocumentData);
      } else {
        transaction.delete(backup.ref);
      }
    });
    const now = FieldValue.serverTimestamp();
    transaction.update(jobRef, { status: 'rolled_back', rolledBackAt: now, rolledBackBy: caller.uid });
    transaction.create(auditRef, {
      type: 'migration_rolled_back',
      actorUid: caller.uid,
      actorEmail: caller.email,
      targetId: input.migrationId,
      createdAt: now,
    });
    return { rolledBack: true, idempotent: false };
  });

  return { ok: true, migrationId: input.migrationId, ...result };
});
