# BedrockProxy Enhanced Plugin System - Summary

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
