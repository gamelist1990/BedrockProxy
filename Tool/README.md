# Automate Build Script

このスクリプトは、`backend` ディレクトリで `bun build.mjs` を実行し、生成された `backend.exe` を Tauri プロジェクトの `src-tauri/binaries` ディレクトリへ移動した後、`app` ディレクトリで `bun run tauri build` を実行して Tauri アプリをビルドします。

## 使い方
```powershell
# プロジェクトルートで実行
bun run Tool/automateBuild.ts
```

## 前提条件
- **Bun** がインストールされていること
- `backend/build.mjs` が正しく設定されていること
- Tauri のビルド環境が整っていること（Rust、cargo など）

## スクリプトの流れ
1. `backend` ディレクトリで `bun build.mjs` を実行し、`backend.exe` を生成
2. 生成されたバイナリを `app/src-tauri/binaries/backend-x86_64-pc-windows-gnu.exe` に移動
3. `app` ディレクトリで `bun run tauri build` を実行して Tauri アプリをビルド

エラーが発生した場合は、コンソールに出力されるコマンドとエラーメッセージを確認してください。