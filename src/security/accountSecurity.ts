export const PRIMARY_OWNER_EMAIL = 'nguyenvandu1990mc@gmail.com';
export const BREAK_GLASS_ADMIN_EMAIL = 'tayninhdoimoi@gmail.com';

export const BOOTSTRAP_ADMIN_EMAILS = [
  PRIMARY_OWNER_EMAIL,
  BREAK_GLASS_ADMIN_EMAIL,
] as const;

export const SIGN_IN_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
export const MAX_SIGN_IN_ATTEMPTS = 5;

export function normalizeAccountEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

export function isBootstrapAdminEmail(email?: string | null): boolean {
  const normalized = normalizeAccountEmail(email);
  return BOOTSTRAP_ADMIN_EMAILS.some((allowed) => allowed === normalized);
}

export function evaluateAccountAccess(
  email: string | null | undefined,
  hasProvisionedProfile: boolean,
): {
  allowed: boolean;
  forceOwnerRole: boolean;
  accountType: 'primary_owner' | 'break_glass_admin' | 'provisioned_user' | 'unknown';
} {
  const normalized = normalizeAccountEmail(email);
  if (normalized === PRIMARY_OWNER_EMAIL) {
    return { allowed: true, forceOwnerRole: true, accountType: 'primary_owner' };
  }
  if (normalized === BREAK_GLASS_ADMIN_EMAIL) {
    return { allowed: true, forceOwnerRole: true, accountType: 'break_glass_admin' };
  }
  if (hasProvisionedProfile) {
    return { allowed: true, forceOwnerRole: false, accountType: 'provisioned_user' };
  }
  return { allowed: false, forceOwnerRole: false, accountType: 'unknown' };
}

export function evaluateSignInThrottle(
  previousAttempts: number[],
  now = Date.now(),
): { allowed: boolean; attempts: number[]; retryAfterMs: number } {
  const recent = previousAttempts
    .filter((timestamp) => Number.isFinite(timestamp) && now - timestamp < SIGN_IN_ATTEMPT_WINDOW_MS)
    .sort((a, b) => a - b);

  if (recent.length >= MAX_SIGN_IN_ATTEMPTS) {
    return {
      allowed: false,
      attempts: recent,
      retryAfterMs: Math.max(0, SIGN_IN_ATTEMPT_WINDOW_MS - (now - recent[0])),
    };
  }

  return { allowed: true, attempts: [...recent, now], retryAfterMs: 0 };
}
