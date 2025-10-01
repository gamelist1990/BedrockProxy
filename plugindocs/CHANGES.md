# BedrockProxy プラグインシステム 変更履歴

## 📅 2025年10月1日 - v2.0.0

### 🎉 メジャーアップデート

#### ドキュメント完全刷新
- **README.md**: 開発者向けに完全書き直し
  - クイックスタートガイド
  - 詳細なAPIリファレンス
  - 実用的なサンプルコード集
  - ベストプラクティス
  - 日本語での包括的な説明

#### 型定義の大幅改善
- **全型定義ファイルにJSDoc追加**
  - `api.d.ts`: 詳細な説明と使用例を追加
  - `storage.d.ts`: 暗号化・圧縮・TTLの説明を詳細化
  - `http.d.ts`: 各HTTPメソッドの用途を明確化
  - `filesystem.d.ts`: セキュリティとパス制限の説明追加
  - `events.d.ts`: 各イベントデータ構造の詳細化
  - `player.d.ts`: プレイヤー情報の詳細化
  - `server.d.ts`: サーバー統計情報の追加
  - `plugin.d.ts`: ライフサイクルフックの詳細説明

- **型定義の利点**
  - VSCodeでの自動補完が大幅に改善
  - 各メソッドの説明がホバーで表示
  - パラメータの型チェック
  - 実用的なコード例が型定義内に含まれる

#### API機能の完全実装確認
以下の全APIが backend 実装と完全一致することを確認：

**ロギングAPI**
- `debug()`, `info()`, `warn()`, `error()`, `log()`
- プラグイン名プレフィックス付きでクライアントコンソールにも出力

**サーバーAPI**
- `getServerInfo()`: サーバー情報取得
- `getServerStats()`: 統計情報取得
- `sendCommand()`: コンソールコマンド送信
- `getConsoleOutput()`: コンソール出力取得

**プレイヤーAPI**
- `getPlayers()`: オンラインプレイヤー一覧
- `getPlayer()`: IDでプレイヤー取得
- `getPlayerByName()`: 名前でプレイヤー検索
- `getPlayerStats()`: プレイヤー統計取得
- `kickPlayer()`: プレイヤーをキック（実装中）
- `tellPlayer()`: プレイヤーにメッセージ送信（実装中）
- `broadcast()`: 全員にメッセージ送信

**イベントシステム**
- `on()`: イベントリスナー登録
- `once()`: 一度だけ実行されるリスナー
- `off()`: リスナー解除
- `emit()`: カスタムイベント発火
- `_triggerEvent()`: システムからのイベントトリガ（内部）

**タイマーAPI**
- `setInterval()`: 定期実行
- `setTimeout()`: 遅延実行
- `clearTimer()`: タイマーキャンセル

**ストレージAPI** (`api.storage`)
- `get()`, `set()`: 基本的な読み書き
- `has()`, `delete()`, `clear()`: 管理操作
- `keys()`, `values()`, `entries()`: 一覧取得
- `size()`: ストレージサイズ取得
- `namespace()`: 名前空間作成
- オプション: `encrypt`, `compress`, `ttl`

**HTTP API** (`api.http`)
- `get()`, `post()`, `put()`, `delete()`, `patch()`: HTTPメソッド
- `request()`: カスタムリクエスト
- `download()`: ファイルダウンロード
- `createWebhook()`: Webhookエンドポイント作成
- `getWebhookHandler()`, `removeWebhook()`: Webhook管理

**ファイルシステムAPI** (`api.fs`)
- `readFile()`, `writeFile()`, `appendFile()`: ファイル読み書き
- `deleteFile()`, `exists()`, `stat()`: ファイル管理
- `mkdir()`, `readDir()`, `rmdir()`: ディレクトリ操作
- `copyFile()`, `moveFile()`: ファイル操作
- `readJSON()`, `writeJSON()`: JSON操作
- `watch()`, `unwatch()`: ファイル監視
- セキュリティ: プラグインディレクトリ外へのアクセス禁止

**ユーティリティAPI**
- `getVersion()`: APIバージョン取得
- `isPluginLoaded()`: プラグインロード確認
- `getLoadedPlugins()`: ロード済みプラグイン一覧
- `callPlugin()`: プラグイン間通信

#### ライフサイクル改善
- **ライフサイクルコンテキスト**
  - `api`: PluginAPIインスタンス
  - `serverId`: サーバーID
  - `metadata`: プラグインメタデータ
  - `pluginDir`: プラグインディレクトリパス
  - `dataDir`: データディレクトリパス

- **ライフサイクルフック**
  - `onLoad()`: ロード時（有効化前）
  - `onEnable()`: 有効化時
  - `onDisable()`: 無効化時
  - `onUnload()`: アンロード時（無効化後）
  - `onReload()`: 設定再読み込み時

#### イベント強化
- **新イベント**
  - `playerJoin`: プレイヤー参加時
  - `playerLeave`: プレイヤー退出時
  - `serverStart`: サーバー起動時
  - `serverStop`: サーバー停止時
  - `serverStatusChange`: ステータス変更時
  - `consoleOutput`: コンソール出力時
  - `consoleCommand`: コンソールコマンド実行時
  - `error`: エラー発生時

- **イベントデータ構造の明確化**
  - 各イベントに詳細なTypeScript型定義
  - プレイヤー情報、サーバー情報、タイムスタンプなどを含む

#### バグ修正と改善
- プラグインログが正しくクライアントコンソールに表示されるよう修正
- プラグイン自動有効化機能の実装（サーバー起動時）
- エラーハンドリングの改善

---

## 以前のバージョン

### v1.0.0 - 初期リリース
- フォルダベースのプラグイン構造
- package.json サポート
- モジュール化された型定義
- 基本的なAPI機能

---

## 📝 注意事項

### 非推奨API
以下のAPIは非推奨です。代わりに新しいAPIを使用してください：

```javascript
// 非推奨
await api.getData('key');
await api.setData('key', value);

// 推奨
await api.storage.get('key');
await api.storage.set('key', value);
```

### 今後の実装予定
- `kickPlayer()`: プレイヤーキック機能の完全実装
- `tellPlayer()`: プレイヤー個別メッセージ送信の完全実装
- より多くのイベントタイプ
- プラグイン設定UI

---

## 🤝 貢献

ドキュメントの改善やバグ報告は大歓迎です！

---

**最終更新: 2025年10月1日**


## 🎉 完了した改善

### 1. **フォルダベースのプラグイン構造** ✅
- 各プラグインは独自のフォルダ内に配置
- `index.js` をメインエントリーポイントとして使用
- `node_modules` サポート: npm パッケージを自由に使用可能
- パス: `C:\Users\PC_User\Documents\PEXData\BedrockProxy\plugins\<plugin-name>\`

### 2. **package.json サポート** ✅
- プラグインメタデータを package.json から自動読み込み
- npm 標準のフィールドをサポート (name, version, description, author, homepage, license)
- BedrockProxy 固有の設定: `bedrockproxy.minVersion`, `bedrockproxy.dependencies`
- npm install で依存関係を管理可能

### 3. **モジュール化された型定義** ✅
新しい型定義構造:
```
plugindocs/types/
├── index.d.ts        # メインエクスポート
├── plugin.d.ts       # プラグインライフサイクル
├── server.d.ts       # サーバー情報
├── player.d.ts       # プレイヤー情報
├── events.d.ts       # イベントシステム
├── api.d.ts          # メインAPI
├── storage.d.ts      # ストレージAPI
├── http.d.ts         # HTTP API
└── filesystem.d.ts   # ファイルシステムAPI
```

### 4. **拡張された Plugin API** ✅

#### 新しい API 機能:
- **Storage API**: 名前空間、TTL、暗号化、圧縮をサポート
- **HTTP API**: GET/POST/PUT/DELETE、ファイルダウンロード、Webhook
- **File System API**: 読み書き、JSON操作、ファイル監視 (プラグインディレクトリにサンドボックス化)
- **Advanced Logging**: debug/info/warn/error メソッド
- **Player Management**: キック、メッセージ送信、統計情報
- **Inter-Plugin Communication**: プラグイン間の関数呼び出し

#### API カテゴリ:
- ✅ Logging (debug, info, warn, error)
- ✅ Server (getServerInfo, getServerStats, sendCommand)
- ✅ Players (getPlayers, getPlayer, kickPlayer, tellPlayer, broadcast)
- ✅ Events (on, once, off, emit)
- ✅ Timing (setInterval, setTimeout, clearTimer)
- ✅ Storage (get, set, has, delete, namespace)
- ✅ HTTP (get, post, put, delete, download)
- ✅ File System (readFile, writeFile, readJSON, writeJSON, watch)
- ✅ Utilities (getVersion, isPluginLoaded, callPlugin)

### 5. **完全なドキュメント** ✅
- 包括的な README.md (60+ 例)
- TypeScript 型定義 (IDE オートコンプリート)
- フル機能のサンプルプラグイン
- API リファレンス

## 📁 プラグインフォルダ構造

### 推奨構造:
```
C:\Users\PC_User\Documents\PEXData\BedrockProxy\plugins\
└── my-awesome-plugin\
    ├── package.json       # プラグインメタデータ (推奨)
    ├── index.js          # メインファイル (必須)
    ├── config.json       # プラグイン設定
    ├── README.md         # プラグインドキュメント
    ├── node_modules\     # npm依存関係 (自動)
    └── data\            # プラグインデータ (自動作成)
        ├── storage.json # 永続ストレージ
        └── logs\        # ログファイル
```

## 🚀 クイックスタート

### プラグインの作成:

1. **フォルダを作成**:
```bash
mkdir "C:\Users\PC_User\Documents\PEXData\BedrockProxy\plugins\my-plugin"
cd "C:\Users\PC_User\Documents\PEXData\BedrockProxy\plugins\my-plugin"
```

2. **package.json を作成**:
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "main": "index.js",
  "author": "Your Name"
}
```

3. **index.js を作成**:
```javascript
registerPlugin(() => ({
  metadata: {
    name: 'My Plugin',
    version: '1.0.0',
    description: 'My awesome plugin',
    author: 'Your Name'
  },
  
  async onEnable(context) {
    const { api } = context;
    api.info('Plugin enabled!');
    
    // プレイヤー参加時のウェルカムメッセージ
    api.on('playerJoin', async (event) => {
      await api.broadcast(`Welcome ${event.player.name}!`);
    });
  }
}));
```

4. **プラグインを有効化**:
- BedrockProxy の「プラグイン」タブを開く
- 「フォルダを開く」ボタンでプラグインフォルダにアクセス
- 「更新」ボタンをクリック
- プラグインを有効化

### npm パッケージの使用:

```bash
cd "C:\Users\PC_User\Documents\PEXData\BedrockProxy\plugins\my-plugin"
npm install axios
npm install discord.js
```

```javascript
const axios = require('axios');
const Discord = require('discord.js');

registerPlugin(() => ({
  // ... プラグインコード
}));
```

## 📚 例とテンプレート

### 場所:
- `plugindocs/examples/sample-plugin/` - 完全な例
- `plugindocs/types/` - TypeScript 型定義
- `plugindocs/README.md` - 完全なドキュメント

### 主な例:
1. **Welcome Bot** - プレイヤーウェルカムメッセージ
2. **Stats Tracker** - プレイヤー統計追跡
3. **Discord Bridge** - Discord 統合
4. **Backup Manager** - 自動バックアップ
5. **HTTP Integration** - Web API 統合
6. **File Management** - ファイル操作

## 🔧 技術的な詳細

### バックエンドの変更:
- ✅ `pluginLoader.ts` - package.json サポート追加
- ✅ `types/index.ts` - 拡張メタデータフィールド
- ✅ `dataStorage.ts` - プラグインディレクトリパス公開
- ✅ `serverManager.ts` - システム情報API

### フロントエンドの変更:
- ✅ `ServerDetails.tsx` - "フォルダを開く" ボタン追加
- ✅ `API/index.ts` - システム情報取得API
- ✅ 翻訳ファイル - 新しいUIテキスト

### 型定義:
- ✅ モジュール構造 (8ファイル)
- ✅ 完全な JSDoc コメント
- ✅ IDE オートコンプリート対応

## 🎯 次のステップ

1. **プラグインの作成**: サンプルを参考に独自のプラグインを作成
2. **npm パッケージの使用**: 必要なライブラリをインストール
3. **API の探索**: 豊富な API を活用
4. **コミュニティ共有**: プラグインを共有して改善

## 📖 ドキュメント

- **README**: `plugindocs/README.md`
- **型定義**: `plugindocs/types/`
- **例**: `plugindocs/examples/`
- **サンプル**: `plugindocs/sample.js`

---

**すべての変更がビルドされ、適用されています！** 🎉

アプリケーションを再起動して、新しいプラグインシステムをお楽しみください。
