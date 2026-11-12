import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BREAK_GLASS_ADMIN_EMAIL,
  MAX_SIGN_IN_ATTEMPTS,
  PRIMARY_OWNER_EMAIL,
  SIGN_IN_ATTEMPT_WINDOW_MS,
  evaluateAccountAccess,
  evaluateSignInThrottle,
  isBootstrapAdminEmail,
} from './accountSecurity';

test('bootstrap administrators are normalized and always receive owner access', () => {
  assert.equal(isBootstrapAdminEmail(`  ${PRIMARY_OWNER_EMAIL.toUpperCase()} `), true);
  assert.equal(isBootstrapAdminEmail(BREAK_GLASS_ADMIN_EMAIL), true);
  assert.deepEqual(evaluateAccountAccess(PRIMARY_OWNER_EMAIL, false), {
    allowed: true,
    forceOwnerRole: true,
    accountType: 'primary_owner',
  });
});

test('unknown accounts fail closed while provisioned users remain allowed', () => {
  assert.equal(evaluateAccountAccess('la@example.com', false).allowed, false);
  assert.equal(evaluateAccountAccess('nhanvien@example.com', true).accountType, 'provisioned_user');
});

test('sign-in throttling blocks the sixth attempt inside ten minutes', () => {
  const now = 1_000_000;
  const attempts = Array.from({ length: MAX_SIGN_IN_ATTEMPTS }, (_, index) => now - index * 1_000);
  const blocked = evaluateSignInThrottle(attempts, now);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);

  const afterWindow = evaluateSignInThrottle(attempts, now + SIGN_IN_ATTEMPT_WINDOW_MS + 1);
  assert.equal(afterWindow.allowed, true);
});
