import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { parseStockStagingConfig } from './stock-staging-config.mjs';

const root = resolve(import.meta.dirname, '..');
const cli = resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
const vite = resolve(root, 'node_modules/vite/bin/vite.js');
const tsc = resolve(root, 'functions/node_modules/typescript/bin/tsc');
const config = 'firebase.stock-staging.json';
const functions = ['bootstrapWorkshop', 'provisionWorkshopMember', 'initializeStockItem', 'postStockMovement'];

function run(args, { capture = false, cwd = root } = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error || result.status !== 0) {
    if (capture && result.stderr) console.error(result.stderr.trim());
    throw new Error(result.error?.message || `Lệnh dừng với mã ${result.status ?? 'không xác định'}.`);
  }
  return result.stdout;
}

function readResult(args) {
  const output = JSON.parse(run([cli, ...args, '--non-interactive', '--json'], { capture: true }));
  if (output.status !== 'success' || !output.result) throw new Error('Firebase CLI không trả về thông tin dự kiến.');
  return output.result;
}

try {
  const [projectId, option, ...extra] = process.argv.slice(2);
  if (!projectId || extra.length || (option !== undefined && option !== '--deploy')) {
    throw new Error('Cách dùng: npm run stock:staging -- <mã-dự-án-staging> [--deploy]');
  }
  const current = JSON.parse(readFileSync(resolve(root, 'firebase-applet-config.json'), 'utf8'));
  const env = loadEnv('staging', root);
  const staging = parseStockStagingConfig(env.VITE_STAGING_FIREBASE_CONFIG, env.VITE_STAGING_FIREBASE_APPCHECK_SITE_KEY, current.projectId);
  if (projectId !== staging.projectId) throw new Error('Mã dự án trong lệnh phải khớp cấu hình Firebase staging đã chọn.');

  const registeredProjectNumber = staging.appId.split(':')[1];
  const projects = readResult(['projects:list']);
  const project = projects.find((entry) => entry.projectId === projectId);
  if (!project) throw new Error('Tài khoản Firebase CLI không có quyền truy cập dự án staging này.');
  if (String(project.projectNumber) !== registeredProjectNumber) throw new Error('appId không thuộc số dự án Firebase staging.');
  const { sdkConfig } = readResult(['apps:sdkconfig', 'WEB', staging.appId, '--project', projectId]);
  if (sdkConfig?.projectId !== projectId || sdkConfig.appId !== staging.appId || sdkConfig.apiKey !== staging.apiKey) {
    throw new Error('Cấu hình web không khớp ứng dụng đã đăng ký trên Firebase staging.');
  }
  const listing = readResult(['firestore:databases:list', '--project', projectId]);
  const databases = Array.isArray(listing) ? listing : listing.databases;
  if (!Array.isArray(databases)) throw new Error('Không đọc được danh sách cơ sở Firestore.');
  for (const id of ['(default)', 'legacy']) {
    const db = databases.find((entry) => entry.name === `projects/${projectId}/databases/${id}`);
    if (!db || db.type !== 'FIRESTORE_NATIVE') throw new Error(`Dự án cần Firestore Native có tên ${id}.`);
  }

  run([tsc], { cwd: resolve(root, 'functions') });
  run([vite, 'build', '--mode', 'staging']);
  console.log(`Đã kiểm tra Firebase và build dist-staging cho ${projectId}.`);
  if (option !== '--deploy') {
    console.log('Dùng --deploy để triển khai Rules, chỉ mục kho và Cloud Functions vào dự án staging đã chọn.');
  } else {
    run([cli, 'deploy', '--project', projectId, '--config', config, '--non-interactive', '--only',
      ['firestore:rules', 'firestore:indexes', ...functions.map((name) => `functions:${name}`)].join(',')]);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
