import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStockStagingConfig } from './stock-staging-config.mjs';

const productionId = 'current-stock-project';
const key = '1111111111111111111111111111111111111111';
const staging = {
  projectId: 'staging-stock-project',
  appId: '1:123456789:web:abcdef123',
  apiKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  authDomain: 'staging-stock-project.firebaseapp.com',
  firestoreDatabaseId: 'legacy',
};

test('staging nhận cấu hình riêng và chỉ đưa thông tin web cần thiết vào bản build', () => {
  const raw = JSON.stringify({ ...staging, extra: 'unused' });
  assert.deepEqual(parseStockStagingConfig(raw, key, productionId), staging);
});

test('staging từ chối nếu thiếu cấu hình, cấu hình lỗi hoặc trùng dự án vận hành', () => {
  assert.throws(() => parseStockStagingConfig(undefined, key, productionId), /Thiếu VITE_STAGING/);
  assert.throws(() => parseStockStagingConfig('{', key, productionId), /JSON hợp lệ/);
  assert.throws(() => parseStockStagingConfig(JSON.stringify({ ...staging, projectId: productionId }), key, productionId), /khác dự án/);
});

test('staging yêu cầu miền đăng nhập, Firestore legacy và App Check hợp lệ', () => {
  assert.throws(() => parseStockStagingConfig(JSON.stringify({ ...staging, authDomain: 'other.firebaseapp.com' }), key, productionId), /authDomain/);
  assert.throws(() => parseStockStagingConfig(JSON.stringify({ ...staging, firestoreDatabaseId: '(default)' }), key, productionId), /legacy/);
  assert.throws(() => parseStockStagingConfig(JSON.stringify(staging), 'MY_RECAPTCHA_ENTERPRISE_SITE_KEY', productionId), /APPCHECK/);
});
