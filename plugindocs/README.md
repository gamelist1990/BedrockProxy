# BedrockProxy プラグイン開発ガイド# BedrockProxy Plugin System



BedrockProxyの強力なプラグインシステムへようこそ！JavaScriptを使ってサーバー機能を拡張できます。BedrockProxy supports a powerful plugin system that allows you to extend server functionality with JavaScript.



## 📚 目次## 🌟 Features



- [クイックスタート](#クイックスタート)- **📁 Folder-Based Plugins**: Each plugin is a folder with `index.js` and optional `package.json`

- [プラグイン構造](#プラグイン構造)- **📦 Node Modules Support**: Install and use npm packages in your plugins

- [API リファレンス](#apiリファレンス)- **🔌 Rich API**: Access server info, players, events, storage, HTTP, and file system

- [イベントシステム](#イベントシステム)- **🎯 Type-Safe**: Full TypeScript definitions for IDE autocomplete

- [ベストプラクティス](#ベストプラクティス)- **🔄 Hot Reload**: Reload plugins without restarting the server

- [サンプル集](#サンプル集)- **💾 Persistent Storage**: Save plugin data that persists across restarts

- **🌐 HTTP Client**: Make web requests and webhooks

---- **📂 File System**: Read and write files (sandboxed to plugin directory)

- **🔗 Inter-Plugin Communication**: Plugins can call each other's functions

## 🚀 クイックスタート

## Requirements

### 1. プラグインフォルダを作成

- Node.js must be installed on the system

```bash- Plugin support must be enabled in server settings

# プラグインディレクトリに移動- Plugins must be placed in `C:\Users\User\Documents\PEXData\BedrockProxy\plugins\`

cd "C:\Users\User\Documents\PEXData\BedrockProxy\plugins"

## Quick Start

# 新しいプラグインフォルダを作成

mkdir my-first-plugin### 1. Enable Plugin Support

cd my-first-plugin

```1. Open Server Details in BedrockProxy

2. Navigate to the "Plugins" tab

### 2. package.json を作成3. Toggle "Enable Plugins" to ON

4. Click "Open Folder" to access the plugins directory

```json5. Click "Refresh" to load plugins

{

  "name": "my-first-plugin",### 2. Create Your First Plugin

  "version": "1.0.0",

  "description": "私の最初のプラグイン",Create a folder structure:

  "main": "index.js",

  "author": "あなたの名前",```

  "bedrockproxy": {C:\Users\User\Documents\PEXData\BedrockProxy\plugins\

    "minVersion": "1.0.0"└── my-first-plugin\

  }    ├── package.json

}    └── index.js

``````



### 3. index.js を作成**package.json**:

```json

```javascript{

/// <reference path="../../plugindocs/types/index.d.ts" />  "name": "my-first-plugin",

  "version": "1.0.0",

registerPlugin(() => ({  "description": "My first BedrockProxy plugin",

  metadata: {  "main": "index.js",

    name: 'My First Plugin',  "author": "Your Name"

    version: '1.0.0',}

    description: '私の最初のプラグイン',```

    author: 'あなたの名前'

  },**index.js**:

  ```javascript

  async onLoad(context) {registerPlugin(() => ({

    const { api } = context;  metadata: {

    api.info('プラグインがロードされました');    name: 'My First Plugin',

  },    version: '1.0.0',

      description: 'My first plugin',

  async onEnable(context) {    author: 'Your Name'

    const { api } = context;  },

    api.info('プラグインが有効化されました！');  

      async onEnable(context) {

    // プレイヤー参加イベントをリスン    const { api } = context;

    api.on('playerJoin', async (event) => {    

      const { player } = event;    api.info('Plugin enabled!');

      await api.broadcast(`ようこそ ${player.name}！`);    

      api.info(`${player.name} がサーバーに参加しました`);    // Welcome message for joining players

    });    api.on('playerJoin', async (event) => {

  },      const { player } = event;

        await api.broadcast(`Welcome ${player.name}!`);

  async onDisable(context) {    });

    const { api } = context;  },

    api.info('プラグインが無効化されました');  

  }  async onDisable(context) {

}));    context.api.info('Plugin disabled');

```  }

}));

### 4. プラグインを有効化```



1. BedrockProxyの「プラグイン」タブを開く### 3. Load the Plugin

2. 「更新」ボタンをクリック

3. プラグインを「有効化」1. Click "Refresh" button in the Plugins tab

2. Your plugin will appear in the list

---3. Toggle it to "Enabled"



## 📁 プラグイン構造## Plugin Structure



### 推奨フォルダ構造### Recommended Structure



``````

my-plugin/my-plugin/

├── package.json          # プラグインメタデータ（推奨）├── package.json          # Plugin metadata and dependencies

├── index.js             # メインファイル（必須）├── index.js             # Main plugin file (required)

├── config.json          # プラグイン設定├── config.json          # Plugin configuration

├── README.md            # プラグインドキュメント├── README.md            # Plugin documentation

├── node_modules/        # npm依存関係（自動）├── node_modules/        # npm dependencies (auto-installed)

└── data/               # プラグインデータ（自動作成）└── data/               # Plugin data directory (created automatically)

    ├── storage/        # 永続ストレージ    ├── storage.json    # Persistent storage

    └── logs/          # ログファイル    └── logs/          # Plugin logs

``````



### ライフサイクルフック### Using npm Packages



```javascriptYou can use any npm package in your plugins:

registerPlugin(() => ({

  metadata: { /* ... */ },1. Navigate to your plugin folder

  2. Run `npm install <package-name>`

  // プラグインロード時（有効化前）3. Import and use in your plugin

  async onLoad(context) {

    // 初期化、依存関係チェック**Example with axios**:

  },

  ```bash

  // プラグイン有効化時cd C:\Users\User\Documents\PEXData\BedrockProxy\plugins\my-plugin

  async onEnable(context) {npm install axios

    // イベントリスナー登録、タイマー開始```

  },

  ```javascript

  // プラグイン無効化時// index.js

  async onDisable(context) {const axios = require('axios');

    // クリーンアップ、リスナー解除

  }registerPlugin(() => ({

}));  metadata: {

```    name: 'HTTP Example',

    version: '1.0.0'

---  },

  

## 🔌 API リファレンス  async onEnable(context) {

    // Or use built-in HTTP API

### ロギング    const response = await context.api.http.get('https://api.example.com/data');

    context.api.info('Response:', response.data);

```javascript  }

api.info('プラグインが起動しました');}));

api.warn('設定ファイルが見つかりません');```

api.error('エラーが発生しました', error);

api.debug('デバッグ情報', { data: value });## Plugin API

```

### Type Definitions

### サーバー操作

For IDE autocomplete and type checking, reference the type definitions:

```javascript

// サーバー情報取得```javascript

const info = await api.getServerInfo();/// <reference path="../../../plugindocs/types/index.d.ts" />

api.info(`プレイヤー: ${info.playersOnline}/${info.maxPlayers}`);

registerPlugin(() => ({

// コンソールコマンド送信  // Your plugin code with full autocomplete

await api.sendCommand('time set day');}));

```

// 全員にメッセージ送信

await api.broadcast('メンテナンスのお知らせ');### Metadata

```

```typescript

### プレイヤー管理{

  name: string;           // Plugin name (required)

```javascript  version: string;        // Plugin version (required)

// オンラインプレイヤー一覧  description?: string;   // Plugin description

const players = await api.getPlayers();  author?: string;        // Plugin author

  homepage?: string;      // Plugin homepage/repo URL

// 特定プレイヤー取得  license?: string;       // Plugin license

const player = await api.getPlayerByName('Steve');  dependencies?: Record<string, string>; // Plugin dependencies

```  keywords?: string[];    // Search keywords

  minBedrockProxyVersion?: string; // Min BedrockProxy version

### ストレージ API}

```

```javascript

// データ保存### Lifecycle Hooks

await api.storage.set('config', { enabled: true });

```javascript

// データ取得{

const config = await api.storage.get('config');  // Called when plugin is loaded (before enable)

  onLoad: async (context) => { },

// 暗号化して保存  

await api.storage.set('secret', 'password', { encrypt: true });  // Called when plugin is enabled

  onEnable: async (context) => { },

// TTL付きで保存（1時間後に自動削除）  

await api.storage.set('temp', data, { ttl: 3600000 });  // Called when plugin is disabled

```  onDisable: async (context) => { },

  

### HTTP API  // Called when plugin is unloaded (after disable)

  onUnload: async (context) => { },

```javascript  

// GETリクエスト  // Called when configuration is reloaded

const response = await api.http.get('https://api.example.com/data');  onReload: async (context) => { }

}

// POSTリクエスト```

await api.http.post('https://api.example.com/users', {

  name: 'Steve'### API Methods

});

#### Logging

// ファイルダウンロード

await api.http.download('https://example.com/file.zip', 'downloads/file.zip');```javascript

```api.debug('Debug message', { data });

api.info('Info message');

### ファイルシステム APIapi.warn('Warning message');

api.error('Error message');

```javascriptapi.log('info', 'Custom log', { extra: 'data' });

// ファイル読み書き```

await api.fs.writeFile('config.txt', 'Hello World');

const content = await api.fs.readFile('config.txt');#### Server Information



// JSON操作```javascript

await api.fs.writeJSON('data.json', { users: [] }, true);// Get server info

const data = await api.fs.readJSON('data.json');const server = await api.getServerInfo();

console.log(server.name, server.status, server.playersOnline);

// ディレクトリ操作

await api.fs.mkdir('logs', true);// Get server statistics

const files = await api.fs.readDir('logs');const stats = await api.getServerStats();

```console.log(stats.uptime, stats.totalJoins, stats.peakPlayers);



---// Send command to server

await api.sendCommand('say Hello World');

## 🎯 イベントシステム

// Get console output

```javascriptconst lines = await api.getConsoleOutput(100);

async onEnable(context) {```

  const { api } = context;

  #### Player Management

  // プレイヤー参加

  api.on('playerJoin', (event) => {```javascript

    api.info(`${event.player.name} が参加`);// Get all online players

  });const players = await api.getPlayers();

  

  // プレイヤー退出// Get specific player

  api.on('playerLeave', (event) => {const player = await api.getPlayer('player-id');

    api.info(`${event.player.name} が退出`);const playerByName = await api.getPlayerByName('Steve');

  });

  // Get player statistics

  // サーバー起動const stats = await api.getPlayerStats('player-id');

  api.on('serverStart', (event) => {console.log(stats.joinCount, stats.totalPlayTime);

    api.info('サーバーが起動しました');

  });// Player actions

}await api.kickPlayer('player-id', 'Kicked by plugin');

```await api.tellPlayer('player-id', 'Private message');

await api.broadcast('Message to all players');

---```



## 💡 ベストプラクティス#### Events



### エラーハンドリング```javascript

// Listen to events

```javascriptapi.on('playerJoin', async (event) => {

try {  const { player, currentPlayerCount } = event;

  const config = await api.fs.readJSON('config.json');  api.info(`${player.name} joined! Total: ${currentPlayerCount}`);

} catch (error) {});

  api.warn('設定ファイルが見つかりません。デフォルト設定を使用します');

  await api.fs.writeJSON('config.json', { enabled: true }, true);api.on('playerLeave', async (event) => {

}  const { player, reason } = event;

```  api.info(`${player.name} left: ${reason}`);

});

### リソースのクリーンアップ

api.on('serverStart', async (event) => {

```javascript  api.info('Server started!');

let timerId = null;});



async onEnable(context) {api.on('serverStop', async (event) => {

  timerId = context.api.setInterval(60000, () => {  api.info('Server stopped!');

    context.api.info('1分経過');});

  });

}api.on('consoleOutput', async (event) => {

  const { line, type } = event;

async onDisable(context) {  if (line.includes('ERROR')) {

  if (timerId) {    api.error('Server error detected:', line);

    context.api.clearTimer(timerId);  }

  }});

}

```// One-time listener

api.once('playerJoin', (event) => {

---  api.info('First player joined!');

});

## 📖 サンプル集

// Remove listener

### Welcome Botconst handler = (event) => { };

api.on('playerJoin', handler);

```javascriptapi.off('playerJoin', handler);

registerPlugin(() => ({

  metadata: {// Emit custom events

    name: 'Welcome Bot',api.emit('customEvent', { data: 'value' });

    version: '1.0.0'```

  },

  #### Timing

  async onEnable(context) {

    context.api.on('playerJoin', async (event) => {```javascript

      await context.api.broadcast(`ようこそ ${event.player.name}！`);// Recurring task (every 5 minutes)

    });const intervalId = api.setInterval(5 * 60 * 1000, async () => {

  }  await api.broadcast('Periodic announcement');

}));});

```

// One-time delayed task

### Auto Backupconst timeoutId = api.setTimeout(10 * 1000, async () => {

  api.info('10 seconds passed');

```javascript});

registerPlugin(() => ({

  metadata: {// Cancel timer

    name: 'Auto Backup',api.clearTimer(intervalId);

    version: '1.0.0'api.clearTimer(timeoutId);

  },```

  

  timerId: null,#### Storage

  

  async onEnable(context) {```javascript

    // 1時間ごとにバックアップ// Get/set data

    this.timerId = context.api.setInterval(3600000, async () => {await api.storage.set('key', { some: 'data' });

      const info = await context.api.getServerInfo();const data = await api.storage.get('key', defaultValue);

      const timestamp = new Date().toISOString();

      await context.api.fs.writeJSON(`backups/backup-${timestamp}.json`, info, true);// Check existence

      context.api.info('バックアップ作成');const exists = await api.storage.has('key');

    });

  },// Delete

  await api.storage.delete('key');

  async onDisable(context) {

    if (this.timerId) {// Get all keys/values/entries

      context.api.clearTimer(this.timerId);const keys = await api.storage.keys();

    }const values = await api.storage.values();

  }const entries = await api.storage.entries();

}));

```// Clear all storage

await api.storage.clear();

---

// Namespaced storage

## 📚 さらに詳しくconst playerStorage = api.storage.namespace('players');

await playerStorage.set('player1', { coins: 100 });

- **型定義**: `plugindocs/types/` フォルダ内の `.d.ts` ファイル

- **サンプル**: `plugindocs/examples/sample-plugin/`// Storage with options

- **変更履歴**: `plugindocs/CHANGES.md`await api.storage.set('temp-data', value, {

  ttl: 60000,      // Expires after 1 minute

プラグイン開発を楽しんでください！ 🎉  compress: true,   // Compress data

  encrypt: true     // Encrypt data
});
```

#### HTTP Client

```javascript
// GET request
const response = await api.http.get('https://api.example.com/data');
console.log(response.data, response.status, response.headers);

// POST request
await api.http.post('https://api.example.com/webhook', {
  message: 'Player joined'
});

// Other methods
await api.http.put(url, data);
await api.http.delete(url);
await api.http.patch(url, data);

// Custom request
const response = await api.http.request({
  url: 'https://api.example.com',
  method: 'POST',
  headers: { 'Authorization': 'Bearer token' },
  params: { query: 'value' },
  timeout: 5000
});

// Download file
await api.http.download(
  'https://example.com/file.zip',
  'downloads/file.zip'
);
```

#### File System

All paths are relative to your plugin's directory.

```javascript
// Read/write files
const content = await api.fs.readFile('config.txt', { encoding: 'utf8' });
await api.fs.writeFile('output.txt', 'Hello World');
await api.fs.appendFile('log.txt', 'New line\n');

// JSON files
const config = await api.fs.readJSON('config.json');
await api.fs.writeJSON('data.json', { key: 'value' }, true); // pretty print

// File operations
const exists = await api.fs.exists('file.txt');
const stats = await api.fs.stat('file.txt');
await api.fs.deleteFile('old-file.txt');
await api.fs.copyFile('source.txt', 'backup.txt');
await api.fs.moveFile('old.txt', 'new.txt');

// Directory operations
await api.fs.mkdir('subfolder', true); // recursive
const entries = await api.fs.readDir('.');
await api.fs.rmdir('old-folder', true);

// Watch for changes
const watcherId = api.fs.watch('config.json', (event, filename) => {
  if (event === 'change') {
    api.info('Config file changed, reloading...');
  }
});

// Stop watching
api.fs.unwatch(watcherId);
```

#### Utilities

```javascript
// Get plugin version
const version = api.getVersion(); // Returns BedrockProxy version

// Check if plugin is loaded
if (api.isPluginLoaded('economy-plugin')) {
  api.info('Economy plugin is available');
}

// Get all loaded plugins
const plugins = api.getLoadedPlugins();
api.info('Loaded plugins:', plugins);

// Call another plugin's function
const result = await api.callPlugin(
  'economy-plugin',
  'getBalance',
  'player-id'
);
```

## Advanced Examples

See the `/examples` folder for comprehensive examples:

- `examples/sample-plugin/` - Full-featured example demonstrating all APIs
- `examples/welcome-bot/` - Simple welcome message bot
- `examples/stats-tracker/` - Player statistics tracking
- `examples/backup-manager/` - Automated backup system
- `examples/discord-bridge/` - Discord integration

## Troubleshooting

### Plugin Not Loading

1. Check plugin folder structure is correct
2. Ensure `index.js` exists and exports with `registerPlugin()`
3. Check console for error messages
4. Verify Node.js is installed

### npm Dependencies Not Working

1. Make sure you ran `npm install` in the plugin folder
2. Check `node_modules` folder exists
3. Try deleting `node_modules` and `package-lock.json`, then reinstall

### Storage Not Persisting

1. Check plugin has write permissions to data directory
2. Verify storage calls are using `await`
3. Check for error messages in console

### Type Definitions Not Working

1. Add reference comment at top of file:
   ```javascript
   /// <reference path="../../../plugindocs/types/index.d.ts" />
   ```
2. Ensure your IDE supports TypeScript definitions
3. For VSCode, install JavaScript/TypeScript extensions

## API Reference

For complete API documentation, see:
- `/types/` - TypeScript type definitions
- `/examples/` - Example plugins
- [GitHub Wiki](https://github.com/gamelist1990/BedrockProxy/wiki) - Online documentation

## Contributing

We welcome plugin contributions! Share your plugins on:
- GitHub Discussions
- Discord Server
- Plugin Repository (coming soon)

## License

Plugin API is licensed under MIT License.
