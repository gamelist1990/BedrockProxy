// build.mjs
// Bun を使って Windows 向けの単体 exe をできるだけ小さく作るためのビルドスクリプト例。
// 実行: bun run build.mjs

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// --- CLI parsing ---
const argv = process.argv.slice(2);
// helper to read --key=val or --key val
function getArg(key) {
  const pref = `--${key}=`;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith(pref)) return a.slice(pref.length);
    if (a === `--${key}` && i + 1 < argv.length) return argv[i + 1];
  }
  return undefined;
}

const cliTarget = getArg('target');
const cliEntry = getArg('entry');
const cliArch = getArg('arch');
// boolean platform flags
const flagLinux = argv.includes('--linux');
const flagWindows = argv.includes('--windows');
const flagMac = argv.includes('--mac') || argv.includes('--darwin');
// positional first arg can be entry file if provided
const posEntry = argv.find(a => !a.startsWith('--'));

const entry = cliEntry || posEntry || './index.ts'; // default entry

// determine default bun target from host if user didn't pass --target
const hostPlatform = process.platform; // 'win32' | 'linux' | 'darwin'
const hostArch = process.arch; // 'x64' | 'arm64' | ...
const forcedArch = cliArch || undefined;

function defaultBunTarget(platform, arch) {
  if (platform === 'win32' && arch === 'x64') return 'bun-windows-x64';
  if (platform === 'linux' && arch === 'x64') return 'bun-linux-x64';
  if (platform === 'linux' && arch === 'arm64') return 'bun-linux-arm64';
  if (platform === 'darwin' && arch === 'arm64') return 'bun-darwin-arm64';
  if (platform === 'darwin' && arch === 'x64') return 'bun-darwin-x64';
  // fallback to host platform x64 variant
  if (platform === 'win32') return 'bun-windows-x64';
  if (platform === 'linux') return 'bun-linux-x64';
  if (platform === 'darwin') return 'bun-darwin-x64';
  return 'bun-linux-x64';
}

// If explicit platform flags are provided, prefer them
function platformFromFlags() {
  if (flagWindows) return 'win32';
  if (flagLinux) return 'linux';
  if (flagMac) return 'darwin';
  return undefined;
}

const forcedPlatform = platformFromFlags();

const useArch = forcedArch || hostArch;

const bunTarget = cliTarget || (forcedPlatform ? defaultBunTarget(forcedPlatform, useArch) : defaultBunTarget(hostPlatform, hostArch));

// platform-aware output filename (based on target, not host)
const isWinTarget = bunTarget.startsWith('bun-windows');
const outfile = isWinTarget ? 'backend.exe' : 'backend';

// 1) bun build (compile) を実行して exe を生成
console.log('Running bun build --compile ...');
console.log('Entry:', entry, 'Target:', bunTarget, 'Outfile:', outfile);
{
  const args = [
    'build',
    '--compile',
    '--production',
    `--target=${bunTarget}`,
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
// choose target filename based on bunTarget
let targetFilename;
switch (bunTarget) {
  case 'bun-windows-x64':
    targetFilename = 'backend-x86_64-pc-windows-gnu.exe';
    break;
  case 'bun-linux-x64':
    targetFilename = 'backend-x86_64-unknown-linux-gnu';
    break;
  case 'bun-linux-arm64':
    targetFilename = 'backend-aarch64-unknown-linux-gnu';
    break;
  case 'bun-darwin-arm64':
    targetFilename = 'backend-aarch64-apple-darwin';
    break;
  case 'bun-darwin-x64':
    targetFilename = 'backend-x86_64-apple-darwin';
    break;
  default:
    // fallback: use outfile name
    targetFilename = outfile + (bunTarget.includes('windows') ? '.exe' : '');
}

const targetPath = path.join(targetDir, targetFilename);

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// bun writes the outfile in current working dir; construct source path
const exePath = path.resolve(outfile);
if (!fs.existsSync(exePath)) {
  console.error('Expected build output not found at', exePath);
  process.exit(1);
}

try {
  // If the destination already exists, remove it so rename can succeed on Windows
  if (fs.existsSync(targetPath)) {
    try {
      fs.unlinkSync(targetPath);
      console.log('Removed existing target file to allow overwrite:', targetPath);
    } catch (rmErr) {
      console.warn('Failed to remove existing target file, will attempt rename/copy anyway:', rmErr);
    }
  }

  fs.renameSync(exePath, targetPath);
  console.log('Moved to:', targetPath);
  // On Unix-like targets, ensure it's executable
  if (!isWinTarget) {
    fs.chmodSync(targetPath, 0o755);
    console.log('Set executable permission on', targetPath);
  }
} catch (err) {
  console.warn('Rename failed, attempting copy fallback:', err);
  try {
    // Fallback to copy then remove source
    fs.copyFileSync(exePath, targetPath);
    console.log('Copied to:', targetPath);
    try {
      fs.unlinkSync(exePath);
    } catch (unlinkErr) {
      // Not fatal; source can be left behind in some environments
      console.warn('Failed to remove temporary build file after copy:', unlinkErr);
    }
    if (!isWinTarget) {
      try {
        fs.chmodSync(targetPath, 0o755);
        console.log('Set executable permission on', targetPath);
      } catch (chmodErr) {
        console.warn('Failed to set executable permission on', targetPath, chmodErr);
      }
    }
  } catch (err2) {
    console.error('Failed to move or copy built file:', err2);
    process.exit(1);
  }
}

console.log('\nDone.');
