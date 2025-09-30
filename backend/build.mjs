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

// 2) 生成ファイルの簡易最適化案: UPX で圧縮 (UPX がインストールされている必要あり)
//    Windows で upx を使うには upx.exe をインストールして PATH に置くか、bundled upx を使ってください。
//    注意: UPX による圧縮はアンチウイルスの誤検知が増える可能性があります。

function tryUpxCompress(exePath) {
  try {
    const upx = spawnSync('upx', ['--best', '--ultra-brute', exePath], { stdio: 'inherit' });
    if (upx.error) {
      console.warn('UPX not available or failed:', upx.error.message);
      return false;
    }
    if (upx.status !== 0) {
      console.warn('UPX failed with exit code', upx.status);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('UPX compress error', e?.message ?? e);
    return false;
  }
}

const exePath = path.resolve(outfile);
if (fs.existsSync(exePath)) {
  console.log('Attempting UPX compression (if upx is installed)...');
  const ok = tryUpxCompress(exePath);
  if (ok) console.log('UPX compression done — file size reduced.');
  else console.log('UPX compression skipped or failed.');
} else {
  console.error('Expected output not found:', exePath);
  process.exit(1);
}

console.log('\nDone.');
