import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { chromium, devices, expect } from '@playwright/test';

const projectId = 'demo-du-nhua-stock-ui';
const workshopId = 'xuong_thu';
const origin = 'http://127.0.0.1:3011';
const callablePath = `/${projectId}/asia-southeast1/postStockMovement`;

assert.equal(process.env.GCLOUD_PROJECT, projectId, 'Chạy qua npm run test:stock:ui.');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');

const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const { getApp } = requireFunctions('firebase-admin/app');
const { getAuth } = requireFunctions('firebase-admin/auth');
const { getFirestore } = requireFunctions('firebase-admin/firestore');
const { postStockMovement } = await import('../functions/lib/index.js');
const auth = getAuth();
const db = getFirestore();
const legacy = getFirestore(getApp(), 'legacy');
const workshop = db.doc(`workshops/${workshopId}`);
const item = workshop.collection('inventory_items').doc('PET_01');
const password = 'Stock-local-test!';

const legacyRules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const rulesResponse = await fetch(`http://127.0.0.1:8085/emulator/v1/projects/${projectId}:securityRules`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ database: `projects/${projectId}/databases/legacy`, rules: { files: [{ name: 'firestore.rules', content: legacyRules }] } }),
});
assert.equal(rulesResponse.ok, true, `Không thể tải Rules cũ vào Firestore giả lập: ${await rulesResponse.text()}`);

async function seedAccount(uid, role) {
  const email = `${role}@example.test`;
  await auth.createUser({ uid, email, password, emailVerified: true });
  const access = { uid, email, workshopId, status: 'active' };
  await Promise.all([
    legacy.doc(`users/${uid}`).set({ uid, email, role, displayName: role, accessStatus: 'active' }),
    db.doc(`user_workshops/${uid}`).set(access),
    workshop.collection('members').doc(uid).set({ ...access, role }),
  ]);
  return email;
}

// Local adapter for invoking the existing callable handler with emulator authentication.
// Cloud App Check and IAM are exercised separately in hosted staging.
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.url !== callablePath || req.headers.origin !== origin) {
    res.writeHead(404).end();
    return;
  }
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  if (req.method !== 'POST') { res.writeHead(405).end(); return; }

  try {
    const token = await auth.verifyIdToken(String(req.headers.authorization || '').replace(/^Bearer /, ''));
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 16_384) { res.writeHead(413).end(); return; }
    }
    const { data } = JSON.parse(body);
    const result = await postStockMovement.run({ data, auth: { uid: token.uid, token }, app: undefined, rawRequest: req, acceptsStreaming: false });
    res.end(JSON.stringify({ data: result }));
  } catch (error) {
    if (error.httpErrorCode) {
      res.writeHead(error.httpErrorCode.status).end(JSON.stringify({ error: { status: error.httpErrorCode.canonicalName, message: error.message } }));
    } else {
      res.writeHead(401).end(JSON.stringify({ error: { status: 'UNAUTHENTICATED', message: 'Phiên thử nghiệm không hợp lệ.' } }));
    }
  }
});

let vite;
let browser;

async function openInventory(options, email) {
  const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
  await context.route('**/*', (route) => {
    const { hostname } = new URL(route.request().url());
    return hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('page-home')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(async ({ email, password }) => {
    const { auth } = await import('/src/lib/firebase.ts');
    const { signInWithEmailAndPassword } = await import('/node_modules/.vite/deps/firebase_auth.js');
    await signInWithEmailAndPassword(auth, email, password);
  }, { email, password });
  await page.getByTestId('env-btn-production').click();
  const menu = page.getByTestId('mobile-hamburger-btn');
  if (await menu.isVisible()) await menu.click();
  await page.getByTestId('sidebar-item-inventory').click();
  const inventory = page.getByTestId('page-inventory-production');
  await expect(inventory.getByText('Mã xưởng: xuong_thu')).toBeVisible({ timeout: 20_000 });
  return { page, inventory };
}

async function fillMovement(inventory, action, quantity) {
  await inventory.getByRole('button', { name: action, exact: true }).click();
  const form = inventory.getByRole('form', { name: action });
  await form.getByLabel('Mặt hàng').selectOption('PET_01');
  await form.getByLabel('Số lượng (kg)').fill(quantity);
  return form.getByRole('button', { name: `Xác nhận ${action.toLowerCase()}` });
}

try {
  const [manager, accountant] = await Promise.all([
    seedAccount('stock_manager', 'manager'),
    seedAccount('stock_accountant', 'accountant'),
    workshop.set({ id: workshopId, status: 'active', name: 'Xưởng thử kho' }),
    item.set({ id: 'PET_01', workshopId, code: 'PET-01', name: 'Nhựa PET', unit: 'kg', status: 'active', stockGrams: 100_000, inGrams: 0, outGrams: 0 }),
  ]);
  const listening = once(server, 'listening');
  server.listen(5019, '127.0.0.1');
  await listening;
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '3011', '--strictPort'], {
    env: { ...process.env, VITE_STOCK_EMULATOR: 'true', VITE_WORKSHOP_STOCK_ENABLED: 'true' },
    stdio: 'inherit',
  });
  await expect.poll(async () => {
    if (vite.exitCode !== null) throw new Error(`Vite exited with code ${vite.exitCode}`);
    return (await fetch(origin).catch(() => null))?.ok ?? false;
  }, { timeout: 20_000 }).toBe(true);

  browser = await chromium.launch();
  const { page, inventory } = await openInventory({}, manager);
  await expect(inventory.getByRole('row').filter({ hasText: 'PET-01' })).toContainText('100 kg');
  const managerToken = await page.evaluate(async () => (await import('/src/lib/firebase.ts')).auth.currentUser.getIdToken());
  const directWrite = await fetch(`http://127.0.0.1:8085/v1/projects/${projectId}/databases/(default)/documents/${item.path}?updateMask.fieldPaths=stockGrams`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { stockGrams: { integerValue: '123' } } }),
  });
  assert.equal(directWrite.status, 403, 'Firestore phải từ chối ghi kho trực tiếp dù tài khoản có quyền lập phiếu.');
  const submitIn = await fillMovement(inventory, 'Nhập kho', '1,250');
  await page.route(`http://127.0.0.1:5019${callablePath}`, async (route) => {
    const result = await route.fetch();
    assert.equal(result.ok(), true);
    await route.abort('failed');
  }, { times: 1 });
  await submitIn.click();
  const waiting = inventory.getByText(/Phiếu chờ đối chiếu: KHO_/);
  await expect(inventory.getByRole('alert')).toContainText('Gửi lại cùng mã', { ignoreCase: true });
  const code = (await waiting.textContent()).split(': ')[1];
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('env-btn-production').click();
  await expect(waiting).toContainText(code);
  await inventory.getByRole('button', { name: 'Gửi lại cùng mã phiếu' }).click();
  await expect(inventory.getByText(`Đã ghi nhận nhập kho 1,25 kg. Mã phiếu: ${code}`)).toBeVisible();
  assert.equal((await workshop.collection('stock_movements').get()).size, 1);

  const submitOut = await fillMovement(inventory, 'Xuất kho', '102');
  await submitOut.click();
  await expect(inventory.getByRole('alert')).toContainText('vượt tồn');
  await inventory.getByLabel('Số lượng (kg)').fill('0,750');
  await submitOut.click();
  await expect(inventory.getByText(/Đã ghi nhận xuất kho 0,75 kg/)).toBeVisible();
  const balance = (await item.get()).data();
  assert.equal(balance.stockGrams, 100_500);
  assert.equal(balance.inGrams, 1250);
  assert.equal(balance.outGrams, 750);
  assert.equal((await workshop.collection('audit_logs').get()).size, 2);

  const mobile = await openInventory(devices['Pixel 5'], accountant);
  await expect(mobile.inventory.getByText('Tài khoản có quyền xem kho.')).toBeVisible();
  await expect(mobile.inventory.getByRole('row').filter({ hasText: 'PET-01' }).first()).toContainText('100,5 kg');
  await expect(mobile.inventory.getByRole('button', { name: /^(Nhập|Xuất) kho$/ })).toHaveCount(0);
  console.log('Kho thử nghiệm đạt: nhập, mất phản hồi, gửi lại không trùng, xuất vượt tồn bị chặn, tồn cuối 100,5 kg, kế toán chỉ xem.');
} finally {
  await browser?.close();
  vite?.kill();
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  await Promise.all([db.terminate(), legacy.terminate()]);
}
