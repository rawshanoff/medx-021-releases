const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function rmIfExists(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {}
}

function main() {
  // This script runs from desktop/electron
  const electronDir = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(electronDir, '..', '..');

  const src = path.join(repoRoot, 'frontend', 'dist');
  const dst = path.join(electronDir, 'frontend', 'dist');

  if (!fs.existsSync(src)) {
    // eslint-disable-next-line no-console
    console.error(`Frontend build not found: ${src}`);
    process.exitCode = 2;
    return;
  }

  rmIfExists(dst);
  ensureDir(path.dirname(dst));

  fs.cpSync(src, dst, { recursive: true, force: true, dereference: true });
  // eslint-disable-next-line no-console
  console.log(`Copied frontend: ${src} -> ${dst}`);
}

main();

