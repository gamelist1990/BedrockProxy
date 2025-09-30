# BedrockProxy

BedrockProxy は、Bedrock 互換サーバーと対話するための軽量な WebSocket プロキシとデスクトップ UI です。本プロジェクトは Bun ベースのバックエンド（WebSocket サーバ）と、React + Vite + Tauri を用いたフロントエンド（デスクトップアプリ）を含みます。

## 機能

- Bun ベースの WebSocket バックエンド（ヘルスチェックとブロードキャスト用エンドポイントを含む）
- 接続管理とサブスクリプションによるイベント駆動メッセージ処理
- React + Vite を用いたフロントエンド、Tauri によるデスクトップパッケージ化のサポート
- ローカルテスト用の簡易デバッグ用ブロードキャスト HTTP エンドポイント

## リポジトリ構成

- backend/ - Bun ベースのサーバ実装（TypeScript）
  - backend/index.ts — エントリポイント（環境変数 PORT、デフォルト 8080）
  - backend/server.ts — WebSocket サーバロジックとヘルスエンドポイント
- app/ - React + Vite フロントエンドと Tauri 設定
  - app/package.json — 開発・ビルド用スクリプト（dev, build, preview, tauri）
  - app/src — React ソースコード

## 開発向けクイックスタート

前提条件

- Bun（バックエンド実行用） — https://bun.sh
- Node.js + npm（フロントエンド／Tauri 用） — https://nodejs.org
- Rust + Tauri のビルド要件（デスクトップアプリをビルドする場合） — https://tauri.app

バックエンドを起動（開発）

1. リポジトリルートから Bun でバックエンドを起動します:

```bash
# リポジトリルートで実行
PORT=8080 bun ./backend/index.ts
```

2. ヘルスチェック

ブラウザで以下へアクセスします:

http://localhost:8080/health

WebSocket エンドポイント: ws://localhost:8080

フロントエンドを起動（開発）

```bash
cd app
npm install
npm run dev
```

Tauri デスクトップアプリを起動（任意）

```bash
cd app
npm install
npm run tauri dev
```

## API とデバッグ用エンドポイント

- GET /health — サーバステータスと接続統計を返します（backend/server.ts の該当箇所を参照）
- POST /debug/broadcast — サブスクライバーへデバッグ用ブロードキャストを送信します（backend/server.ts の該当箇所を参照）

WebSocket メッセージ

- サポートされる制御メッセージ: ping, pong, subscribe, unsubscribe
- ジェネリックなリクエスト/レスポンスは MessageRouter を通してルーティングされます

## 設定

- PORT — バックエンドがリッスンするポート（デフォルト 8080）
- その他の設定は backend と app のソースや環境変数を確認してください

## 開発メモ

- バックエンドは Bun で実行され、Bun.serve を利用した WebSocket ハンドリングを行います（backend/server.ts を参照）
- フロントエンドは Vite + React を使用し、Tauri によるデスクトップパッケージング設定が app/src-tauri にあります

## 貢献

貢献は歓迎します。問題やプルリクエストを作成してください。

## ライセンス

リポジトリに LICENSE ファイルが見つかりません。プロジェクトのライセンスを明確にするために LICENSE ファイルの追加を検討してください。

---

Generated with [Claude Code](https://claude.ai/code)
