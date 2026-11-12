import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesContent = fs.readFileSync('./firestore.rules', 'utf8');
const blueprint = JSON.parse(fs.readFileSync('./firebase-blueprint.json', 'utf8'));

test('Firestore rules enforce rules_version 2 and default-deny catch-all', () => {
  assert.ok(rulesContent.includes("rules_version = '2';"));
  assert.ok(rulesContent.includes('match /{document=**}'));
  assert.ok(rulesContent.includes('allow read, write: if false;'));
});

test('Firestore rules cover every collection in firebase-blueprint.json', () => {
  const paths = Object.keys(blueprint.firestore || {});
  assert.ok(paths.length >= 4);
  for (const path of paths) {
    assert.ok(rulesContent.includes(`match ${path}`), `Missing match block for ${path}`);
  }
});

test('Dirty Dozen payload defenses exist in firestore.rules', () => {
  // 1. Shadow field guard via hasOnly
  assert.ok(rulesContent.includes('.keys().hasOnly('));
  // 2. Self-assigned owner role guard
  assert.ok(rulesContent.includes("isBootstrapAdmin() && request.auth.uid == userId && incoming().role == 'owner'"));
  assert.ok(rulesContent.includes('isAuthorizedUser()'));
  assert.ok(rulesContent.includes("data.actorUid == request.auth.uid"));
  // 3. Identity spoofing guard
  assert.ok(rulesContent.includes('data.ownerId == request.auth.uid'));
  // 4. Verified email check
  assert.ok(rulesContent.includes('request.auth.token.email_verified == true'));
  // 5. Server timestamp enforcement
  assert.ok(rulesContent.includes('incoming().createdAt == request.time'));
  assert.ok(rulesContent.includes('incoming().updatedAt == request.time'));
  // 6. State transition locking for active vs cancelled transactions
  assert.ok(rulesContent.includes("existing().status == 'active'"));
  assert.ok(rulesContent.includes("existing().status == 'cancelled'"));
  // 7. ID poisoning regex guard
  assert.ok(rulesContent.includes("id.matches('^[a-zA-Z0-9_\\\\-]+$')"));
  // 8. Validation helper wraps update block
  assert.ok(rulesContent.includes('isValidCashTransaction(incoming())'));
  // 9. Query enforcer on list
  assert.ok(rulesContent.includes('allow list: if isAuthorizedUser() && resource.data.ownerId == request.auth.uid;'));
  // 10. Activity logs are append-only and never deletable by employees
  assert.ok(rulesContent.includes('match /activity_logs/{logId}'));
  assert.ok(rulesContent.includes('isValidActivityLog(incoming())'));
  assert.ok(rulesContent.includes('allow delete: if false;'));
});

test('Production account allowlist and security alerts fail closed', () => {
  assert.ok(rulesContent.includes('"nguyenvandu1990mc@gmail.com"'));
  assert.ok(rulesContent.includes('"tayninhdoimoi@gmail.com"'));
  assert.equal(rulesContent.includes('"ngonpham8x@gmail.com"'), false);
  assert.ok(rulesContent.includes('match /security_events/{eventId}'));
  assert.ok(rulesContent.includes("incoming().type == 'unknown_account'"));
  assert.ok(rulesContent.includes('!isAuthorizedUser()'));
  assert.ok(rulesContent.includes('eventId == request.auth.uid'));
  assert.ok(rulesContent.includes(".data.accessStatus == 'active'"));
  assert.ok(rulesContent.includes('.data.email == request.auth.token.email'));
  assert.ok(rulesContent.includes('incoming().accessStatus == existing().accessStatus'));
  assert.ok(rulesContent.includes('allow delete: if false;'));
});

test('Firestore rules validate plastic scrap weigh ticket & shredding batch fields and plastic module names', () => {
  assert.ok(rulesContent.includes("'delivererName'"));
  assert.ok(rulesContent.includes("'vehiclePlate'"));
  assert.ok(rulesContent.includes("'outputKg'"));
  assert.ok(rulesContent.includes("'scrapKg'"));
  assert.ok(rulesContent.includes("'recoveryRatePercent'"));
  assert.ok(rulesContent.includes("'Cân nhựa'"));
  assert.ok(rulesContent.includes("'Phân loại & Băm nhựa'"));
  assert.ok(rulesContent.includes("'Kho nhựa'"));
});


