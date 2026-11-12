import { existsSync, readdirSync, statSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(import.meta.dirname, '..');
const env = { ...process.env };
const integrationScript = process.argv[2] || 'test:rules:integration';
const demoProjectId = process.argv[3] || 'demo-du-nhua-phase4';

function findFile(root, filename) {
  if (!existsSync(root)) return undefined;
  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry);
    if (statSync(fullPath).isDirectory()) {
      const match = findFile(fullPath, filename);
      if (match) return match;
    } else if (entry.toLowerCase() === filename.toLowerCase()) {
      return fullPath;
    }
  }
  return undefined;
}

if (!env.JAVA_HOME) {
  const portableJava = findFile(join(projectRoot, '.tools', 'java21'), process.platform === 'win32' ? 'java.exe' : 'java');
  if (portableJava) {
    const javaBin = dirname(portableJava);
    const currentPath = env.PATH || env.Path || '';
    env.JAVA_HOME = dirname(javaBin);
    env.PATH = `${javaBin}${delimiter}${currentPath}`;
    env.Path = env.PATH;
  }
}

const firebaseCli = join(projectRoot, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');

const result = spawnSync(
  process.execPath,
  [
    firebaseCli,
    'emulators:exec',
    '--only',
    'firestore',
    '--project',
    demoProjectId,
    `npm run ${integrationScript}`,
  ],
  { cwd: projectRoot, env, stdio: 'inherit', shell: false },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
