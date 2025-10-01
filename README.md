# BedrockProxy

BedrockProxy は、Bedrock 互換サーバーと双方向通信を行う高度な WebSocket プロキシおよびデスクトップ UI アプリケーションです。サーバー管理、リアルタイム統計監視、強力なプラグインシステムを提供します。

## 機能

- **WebSocket プロキシ**: Bedrock 互換サーバーとの高性能双方向通信
- **ネットワーク統計**: リアルタイム帯域幅監視、接続統計、送信/受信用量の追跡
- **プラグインシステム**: JavaScript ベースの拡張機能システム（フォルダベース、npm パッケージ対応）
- **デスクトップアプリ**: React + Vite + Tauri を使用したクロスプラットフォーム UI
- **メッセージルーティング**: イベント駆動処理とサブスクリプションによる柔軟なメッセージ処理
- **HTTP API**: Webhook エンドポイント、REST API、ヘルスチェック機能
- **リアルタイム監視**: プレイヤー統計、サーバーステータス、コンソール出力の監視

## リポジトリ構成

- **backend/** - Bun ベースのサーバ実装（TypeScript）
  - `backend/index.ts` — エントリポイント（環境変数 PORT、デフォルト 8080）
  - `backend/server.ts` — WebSocket サーバロジック、イベント処理、ヘルスチェック
  - `backend/services/` — ネットワーク統計、プラグインローダー、メッセージルーティング
  - `backend/types/` — TypeScript型定義（NetworkStats, PluginMetadataなど）
- **app/** - React + Vite フロントエンドと Tauri 設定
  - `app/package.json` — 開発・ビルド用スクリプト（dev, build, preview, tauri）
  - `app/src/` — React ソースコード（コンポーネント、タブシステム、API連携）
  - `app/src-tauri/` — Tauri デスクトップアプリケーション設定
- **plugindocs/** - プラグイン開発者向けドキュメントとサンプル
  - `plugindocs/README.md` — 詳細なプラグイン開発ガイド
  - `plugindocs/types/` — TypeScript型定義ファイル（自動補完対応）
  - `plugindocs/examples/` — サンプルプラグイン集
  - `plugindocs/CHANGES.md` — プラグインシステム変更履歴
- **tests/** - バックエンドテストと統合テスト

## 開発向けクイックスタート

### 前提条件

- **Bun**（バックエンド実行用） — https://bun.sh
- **Node.js + npm**（フロントエンド／Tauri 用） — https://nodejs.org
- **Rust + Tauri CLI**（デスクトップアプリビルドの場合） — https://tauri.app

### バックエンドを起動（開発）

```bash
# リポジトリルートから実行
PORT=8080 bun ./backend/index.ts
```

**検証方法:**
- ブラウザで http://localhost:8080/health にアクセス
- WebSocket エンドポイント: ws://localhost:8080

### フロントエンドを起動（開発）

```bash
cd app
npm install
npm run dev
```

**アクセス:** http://localhost:5173

### Tauri デスクトップアプリを起動（オプション）

```bash
cd app
npm install
npm run tauri dev
```

## API とエンドポイント

### HTTP エンドポイント

- `GET /health` — サーバーステータスと接続統計を返します
- `POST /debug/broadcast` — テスト用ブロードキャストを送信します
- `POST /webhook/:id` — プラグインが作成した Webhook エンドポイント

### WebSocket メッセージ

**制御メッセージ:**
- `ping/pong` — 接続維持
- `subscribe/unsubscribe` — イベント購読管理

**メイン API:**
- サーバー管理（起動/停止/コマンド送信）
- プレイヤー管理（kick/メッセージ送信/統計取得）
- プラグイン管理（load/enable/disable）
- ネットワーク統計

## プラグインシステム

BedrockProxy には強力なプラグイン拡張機能が搭載されています：

### 主要特徴
- **フォルダベース**: 各プラグインは独立したディレクトリ
- **npm パッケージ対応**: Node.js エコシステムを活用可能
- **TypeScript 型定義**: 完全な IDE 自動補完と型チェック
- **ホットリロード**: 再起動不要でプラグインの更新・再読み込み
- **サンドボックス化**: 安全なプラグイン実行環境

### 利用開始
プラグイン開発者向けガイドを参照: `plugindocs/README.md`

**サンプルプラグイン:**
- Welcom Bot — プレイヤー参加時メッセージ
- Stats Tracker — プレイヤー統計監視
- Auto Backup — 定期自動バックアップ
- Discord Bridge — Discord 連携

### プラグインディレクトリ
```
C:\Users\{User}\Documents\PEXData\BedrockProxy\
├── plugins\                    # プラグインフォルダ
│   ├── welcom-bot\
│   │   ├── package.json      # メタデータ
│   │   ├── index.js         # メインファイル
│   │   └── node_modules\     # npm依存関係
│   └── my-custom-plugin\
└── servers.json              # サーバー設定
```

## ネットワーク監視

### リアルタイム統計
- **帯域幅監視**: アップロード・ダウンロード速度のリアルタイム表示
- **接続統計**: アクティブ接続数と詳細情報
- **データ総量**: 総送信・受信バイト数の追跡
- **クライアント別**: 各接続の詳細統計

### UI 機能
- ネットワークタブでの表示
- 統計データの生データアクセス
- WebSocket 経由のリアルタイム更新
- フォーマット済みの速度・データ量表示

## 設定

### 環境変数
- `PORT` — バックエンドリスニングポート（デフォルト: 8080）

### グループ設定
- プラグイン設定: `plugins` ディレクトリ内の各プラグイン設定ファイル
- アプリケーション設定: `servers.json`, `config.json`
- Tauri 設定: `app/src-tauri/tauri.conf.json`

## 開発メモ

### アーキテクチャ概要
- **バックエンド**: Bun.serve を使用した高速 WebSocket サーバ
- **フロントエンド**: Vite + React を使用したモダンSPA
- **デスクトップ**: Tauri による軽量クロスプラットフォームパッケージング
- **プラグイン**: Node.js 互換のセキュア実行環境
- **メッセージング**: イベント駆動アーキテクチャ

### 技術スタック
- **ランタイム**: Bun (バックエンド), Node.js (フロントエンド)
- **言語**: TypeScript (主要), JavaScript (プラグイン)
- **UI フレームワーク**: React + Tauri
- **ビルドツール**: Vite (フロントエンド), 標準 Makefile (バックエンド)
- **通信**: WebSocket (リアルタイム), HTTP (REST API)

## 貢献

貢献を歓迎します！機能提案、バグ報告、プルリクエストをお待ちしています。

**開発参加の流れ:**
1. GitHub Issues で機能提案 or バグ報告
2. ブランチ作成: `git checkout -b feature/your-feature-name`
3. 変更実装 + テスト
4. プルリクエスト作成

## ドキュメント

詳細な技術文書:
- `plugindocs/README.md` — プラグイン開発ガイド
- `plugindocs/CHANGES.md` — 変更履歴とリリースノート
- `NETWORK_TAB_IMPLEMENTATION.md` — ネットワーク機能実装ガイド
- `PLUGIN_INTEGRATION_DEBUG.md` — プラグイン統合デバッグガイド

## ライセンス

このプロジェクトは現在ライセンスが指定されていません。将来的に適切なオープンソースライセンスを適用する予定です。

---

Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>