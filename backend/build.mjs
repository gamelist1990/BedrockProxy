// build.mjs
// Bun を使って Windows 向けの単体 exe をできるだけ小さく作るためのビルドスクリプト例。
// 実行: bun run build.mjs

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const entry = './index.ts'; // 必要に応じてエントリファイルを変更してください
const outfile = 'backend.exe';

// 1) bun build (compile) を実行して exe を生成
console.log('Running bun build --compile ...');
{
  const args = [
    'build',
    '--compile',
    '--production',
    '--outfile', outfile,
    '--minify',
    entry,
  ];

  const r = spawnSync('bun', args, { stdio: 'inherit' });
  if (r.error) {
    console.error('bun build failed', r.error);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error('bun build failed with exit code', r.status);
    process.exit(r.status);
  }
}

console.log('\nBuild finished. Generated:', outfile);

// 2) 生成ファイルを指定場所に移動
const targetDir = path.resolve('../app/src-tauri/binaries');
const targetPath = path.join(targetDir, 'backend-x86_64-pc-windows-msvc.exe');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

fs.renameSync(exePath, targetPath);
console.log('Moved to:', targetPath);

console.log('\nDone.');
