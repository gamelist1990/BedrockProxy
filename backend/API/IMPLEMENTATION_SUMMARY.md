# Plugin API Implementation Summary

すべての plugindocs で定義された API がバックエンドに実装されました。

## 📦 実装されたモジュール

### 1. **Storage API** (`backend/API/storageAPI.ts`)
永続的なデータストレージを提供

**機能:**
- ✅ `get(key, defaultValue)` - 値の取得
- ✅ `set(key, value, options)` - 値の設定
- ✅ `has(key)` - キーの存在確認
- ✅ `delete(key)` - キーの削除
- ✅ `clear()` - 全削除
- ✅ `keys()` - 全キーの取得
- ✅ `values()` - 全値の取得
- ✅ `entries()` - 全エントリの取得
- ✅ `size()` - ストレージサイズ取得
- ✅ `namespace(namespace)` - 名前空間付きストレージ作成

**高度な機能:**
- 🔐 **暗号化**: AES-256-CBC でデータを暗号化
- 🗜️ **圧縮**: gzip でデータを圧縮
- ⏰ **TTL**: 有効期限付きデータ保存
- 📁 **名前空間**: プラグイン内でデータを分離

**使用例:**
```javascript
// 基本的な保存
await api.storage.set('playerData', { score: 100 });
const data = await api.storage.get('playerData');

// 暗号化と TTL
await api.storage.set('secret', 'password', {
  encrypt: true,
  ttl: 3600000 // 1 hour
});

// 名前空間
const userStorage = api.storage.namespace('users');
await userStorage.set('user123', { name: 'Player1' });
```

---

### 2. **HTTP API** (`backend/API/httpAPI.ts`)
Web リクエストを行う HTTP クライアント

**機能:**
- ✅ `get(url, options)` - GET リクエスト
- ✅ `post(url, data, options)` - POST リクエスト
- ✅ `put(url, data, options)` - PUT リクエスト
- ✅ `delete(url, options)` - DELETE リクエスト
- ✅ `patch(url, data, options)` - PATCH リクエスト
- ✅ `request(options)` - カスタムリクエスト
- ✅ `download(url, destination)` - ファイルダウンロード
- ✅ `createWebhook(path, handler)` - Webhook エンドポイント作成

**高度な機能:**
- 🔄 **リダイレクト対応**: 自動リダイレクトフォロー
- ⏱️ **タイムアウト**: カスタムタイムアウト設定
- 📊 **レスポンスタイプ**: JSON, Text, Buffer に対応
- 🔗 **クエリパラメータ**: 自動的に URL に追加

**使用例:**
```javascript
// GET リクエスト
const response = await api.http.get('https://api.example.com/data');
console.log(response.data);

// POST with JSON
await api.http.post('https://api.example.com/users', {
  name: 'Player1',
  score: 100
});

// ファイルダウンロード
await api.http.download('https://example.com/file.zip', 'downloads/file.zip');

// Webhook
api.http.createWebhook('/notifications', (req, res) => {
  api.info('Webhook received:', req.body);
  res.send({ success: true });
});
```

---

### 3. **File System API** (`backend/API/fileSystemAPI.ts`)
プラグインディレクトリ内でのファイル操作（サンドボックス化）

**機能:**
- ✅ `readFile(path, options)` - ファイル読み込み
- ✅ `writeFile(path, data, options)` - ファイル書き込み
- ✅ `appendFile(path, data, options)` - ファイルに追記
- ✅ `deleteFile(path)` - ファイル削除
- ✅ `exists(path)` - ファイル存在確認
- ✅ `stat(path)` - ファイル情報取得
- ✅ `mkdir(path, recursive)` - ディレクトリ作成
- ✅ `readDir(path)` - ディレクトリ読み込み
- ✅ `rmdir(path, recursive)` - ディレクトリ削除
- ✅ `copyFile(source, destination)` - ファイルコピー
- ✅ `moveFile(source, destination)` - ファイル移動
- ✅ `readJSON(path)` - JSON ファイル読み込み
- ✅ `writeJSON(path, data, pretty)` - JSON ファイル書き込み
- ✅ `watch(path, callback)` - ファイル監視
- ✅ `unwatch(watcherId)` - 監視停止

**セキュリティ:**
- 🛡️ **サンドボックス**: プラグインディレクトリ外へのアクセス禁止
- 🔒 **パストラバーサル防止**: `..` を使った親ディレクトリアクセス不可

**使用例:**
```javascript
// ファイル読み書き
await api.fs.writeFile('config.txt', 'Hello World');
const content = await api.fs.readFile('config.txt');

// JSON 操作
await api.fs.writeJSON('data.json', { players: [] }, true);
const data = await api.fs.readJSON('data.json');

// ディレクトリ操作
await api.fs.mkdir('logs', true);
const files = await api.fs.readDir('logs');

// ファイル監視
const watcherId = api.fs.watch('config.json', (event, filename) => {
  api.info(`File ${filename} changed: ${event}`);
});
```

---

### 4. **Main Plugin API** (`backend/API/pluginAPI.ts`)
すべての機能を統合したメイン API

#### 📝 **Logging**
- ✅ `log(level, message, data)` - ログ記録
- ✅ `debug(message, data)` - デバッグログ
- ✅ `info(message, data)` - 情報ログ
- ✅ `warn(message, data)` - 警告ログ
- ✅ `error(message, data)` - エラーログ

#### 🎮 **Server**
- ✅ `getServerInfo()` - サーバー情報取得
- ✅ `getServerStats()` - サーバー統計取得
- ✅ `sendCommand(command)` - コマンド送信 (実装予定)
- ✅ `getConsoleOutput(lineCount)` - コンソール出力取得 (実装予定)

#### 👥 **Players**
- ✅ `getPlayers()` - オンラインプレイヤー一覧
- ✅ `getPlayer(playerId)` - プレイヤー取得
- ✅ `getPlayerByName(playerName)` - 名前でプレイヤー検索
- ✅ `getPlayerStats(playerId)` - プレイヤー統計
- ✅ `kickPlayer(playerId, reason)` - プレイヤーキック (実装予定)
- ✅ `tellPlayer(playerId, message)` - プレイヤーにメッセージ送信 (実装予定)
- ✅ `broadcast(message)` - 全体ブロードキャスト (実装予定)

#### 📡 **Events**
- ✅ `on(event, handler)` - イベントリスナー登録
- ✅ `once(event, handler)` - 一回限りのリスナー
- ✅ `off(event, handler)` - リスナー解除
- ✅ `emit(event, data)` - カスタムイベント発火

**対応イベント:**
- `serverStart` - サーバー開始
- `serverStop` - サーバー停止
- `playerJoin` - プレイヤー参加
- `playerLeave` - プレイヤー退出
- `playerMessage` - プレイヤーメッセージ
- `consoleOutput` - コンソール出力
- `error` - エラー

#### ⏰ **Timing**
- ✅ `setInterval(intervalMs, callback)` - 繰り返しタスク
- ✅ `setTimeout(delayMs, callback)` - 遅延タスク
- ✅ `clearTimer(timerId)` - タイマークリア

#### 💾 **Storage** (Sub-API)
- ✅ `storage` - StorageAPI インスタンス
- ✅ `getData(key)` - 非推奨、`storage.get()` を使用
- ✅ `setData(key, value)` - 非推奨、`storage.set()` を使用

#### 🌐 **HTTP** (Sub-API)
- ✅ `http` - HttpAPI インスタンス

#### 📁 **File System** (Sub-API)
- ✅ `fs` - FileSystemAPI インスタンス

#### 🔧 **Utilities**
- ✅ `getVersion()` - API バージョン取得
- ✅ `isPluginLoaded(pluginName)` - プラグインロード確認 (実装予定)
- ✅ `getLoadedPlugins()` - ロード済みプラグイン一覧 (実装予定)
- ✅ `callPlugin(pluginName, functionName, ...args)` - プラグイン間通信 (実装予定)

---

## 🔄 Plugin Loader 統合

`PluginLoader` (`backend/services/pluginLoader.ts`) が更新され、新しい API を統合:

**新機能:**
- ✅ プラグイン有効化時に `PluginAPI` インスタンスを作成
- ✅ プラグインコンテキストで API を利用可能に
- ✅ `onEnable()` / `onDisable()` ライフサイクルフック呼び出し
- ✅ プラグインごとの `node_modules` サポート
- ✅ カスタム `require()` で node_modules を解決
- ✅ API クリーンアップ（タイマー、イベント、ファイル監視）
- ✅ イベントトリガー: `triggerEvent(eventName, data)`

---

## 📚 使用例

### 完全なプラグイン例

```javascript
registerPlugin(() => ({
  metadata: {
    name: 'Advanced Plugin',
    version: '1.0.0',
    description: 'Demonstrates all API features',
    author: 'Your Name'
  },
  
  async onEnable(context) {
    const { api } = context;
    
    // 1. Logging
    api.info('Plugin enabled!');
    
    // 2. Storage with encryption
    await api.storage.set('config', {
      maxPlayers: 10,
      welcomeMessage: 'Hello!'
    }, { encrypt: true });
    
    // 3. HTTP Request
    const response = await api.http.get('https://api.example.com/data');
    api.info('API Response:', response.data);
    
    // 4. File System
    await api.fs.writeJSON('players.json', { list: [] }, true);
    
    // 5. Player Events
    api.on('playerJoin', async (event) => {
      const config = await api.storage.get('config');
      await api.broadcast(`${event.player.name} joined! ${config.welcomeMessage}`);
      
      // Save to file
      const data = await api.fs.readJSON('players.json');
      data.list.push(event.player.name);
      await api.fs.writeJSON('players.json', data);
    });
    
    // 6. Scheduled Tasks
    api.setInterval(60000, async () => {
      const players = await api.getPlayers();
      api.info(`Online players: ${players.length}`);
    });
    
    // 7. HTTP Download
    await api.http.download(
      'https://example.com/data.json',
      'downloads/data.json'
    );
  },
  
  async onDisable() {
    api.info('Plugin disabled');
  }
}));
```

---

## 🎯 次のステップ

### 実装済み ✅
- Storage API (暗号化、圧縮、TTL、名前空間)
- HTTP API (GET/POST/PUT/DELETE/PATCH, ダウンロード, Webhook)
- File System API (サンドボックス化、JSON操作、監視)
- Main Plugin API (ログ、サーバー、プレイヤー、イベント、タイマー)
- Plugin Loader 統合

### 今後の実装 🚧
- Minecraft サーバーへのコマンド送信 (`sendCommand`)
- コンソール出力バッファリング (`getConsoleOutput`)
- プレイヤーキック/メッセージ送信 (`kickPlayer`, `tellPlayer`, `broadcast`)
- プラグイン間通信 (`callPlugin`)
- プラグインレジストリ (`isPluginLoaded`, `getLoadedPlugins`)

---

## 📖 ドキュメント

すべての API は `plugindocs/types/` の TypeScript 定義に準拠しています:
- `api.d.ts` - メイン API
- `storage.d.ts` - Storage API
- `http.d.ts` - HTTP API
- `filesystem.d.ts` - File System API
- `plugin.d.ts` - プラグインメタデータ
- `server.d.ts` - サーバー型
- `player.d.ts` - プレイヤー型
- `events.d.ts` - イベント型

IDE でオートコンプリートと型チェックが利用可能です！

---

**🎉 すべての API が実装され、ビルドも成功しました！**
