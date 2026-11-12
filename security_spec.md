# Security Specification – VĂN DƯ Factory Management System

## 1. Data Invariants

1. **Global Deny by Default**: Any path not explicitly matched (`/{document=**}`) is strictly denied (`allow read, write: if false;`).
2. **Verified Identity**: All writes and reads require `isSignedIn()` and `request.auth.token.email_verified == true`.
3. **Strict Path ID Guard (`isValidId`)**: Every single-document operation (`get`, `create`, `update`, `delete`) validates the document ID against `^[a-zA-Z0-9_\-]+$` with max length 128.
4. **Ownership Invariant**:
   - `/users/{userId}` can only be read/written by `request.auth.uid == userId` (or an authorized admin). Owner bootstrap is limited to the verified primary and emergency administrator emails declared in `firestore.rules`; every other account must have a pre-provisioned active profile.
   - `/cash_transactions/{txId}`, `/attendance_events/{eventId}`, and `/weigh_tickets/{ticketId}` require `incoming().ownerId == request.auth.uid` on creation and `resource.data.ownerId == request.auth.uid` on read/list/update.
5. **Immutable & Server-Timestamp Fields**:
   - `createdAt` must equal `request.time` on creation and remain immutable (`incoming().createdAt == existing().createdAt`) on update.
   - `updatedAt` must equal `request.time` on creation and update.
   - `ownerId` and `uid` are strictly immutable across all updates.
6. **Terminal State Locking**:
   - Once a `CashTransaction` reaches `status == 'cancelled'`, no further updates are permitted (unless performed by `isAdmin()`).

## 2. The "Dirty Dozen" Payloads

1. **Shadow Field Injection (`CashTransaction`)**: Adding `"isVerified": true` to a create/update payload -> Rejected by `data.keys().hasOnly(...)`.
2. **Self-Assigned Owner Role (`UserProfile`)**: Non-admin user creating `/users/{uid}` with `role: "owner"` -> Rejected by role check.
3. **Identity Spoofing (`CashTransaction`)**: Creating a transaction with `ownerId: "victim-uid"` -> Rejected by `data.ownerId == request.auth.uid`.
4. **Unverified Email Admin Spoof**: A token using either bootstrap administrator email with `email_verified == false` -> Rejected by `isVerifiedUser()`.
5. **Client Timestamp Forgery**: Passing a past/future timestamp for `createdAt` or `updatedAt` -> Rejected by `== request.time`.
6. **Terminal State Re-opening**: Updating a `cancelled` transaction back to `active` -> Rejected by `existing().status != 'cancelled'`.
7. **ID Poisoning Attack**: Creating a document with a 500-char ID or special characters -> Rejected by `isValidId()`.
8. **Value Poisoning on Update**: Updating `status` on `CashTransaction` with an integer `123` or a 1MB string for `cancelReason` -> Rejected by `isValidCashTransaction(incoming())` wrapping the `allow update` block.
9. **Blanket List Scraping**: Listing `/cash_transactions` without `where('ownerId', '==', uid)` -> Rejected by `allow list: if isVerifiedUser() && resource.data.ownerId == request.auth.uid`.
10. **Immutable Field Mutation**: Changing `createdAt` or `code` or `amount` during a transaction cancellation update -> Rejected by `affectedKeys().hasOnly(['status', 'cancelReason', 'updatedAt'])` and immutable checks.
11. **Negative / NaN Monetary Amount**: Creating a transaction with `amount <= 0` or `amount > 100000000000` -> Rejected by numeric range bounds.
12. **Oversized String Denial-of-Wallet**: Sending a 10,000-character `description` -> Rejected by `data.description.size() <= 300`.

## 3. Test Runner Specification (`firestore.rules.test.ts`)

All 12 payloads are validated against the ruleset constraints and ESLint security rules plugin (`@firebase/eslint-plugin-security-rules`) to verify zero vulnerabilities.
