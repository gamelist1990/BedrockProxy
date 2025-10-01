# プラグインシステム統合とデバッグログ実装

## ✅ 実装完了

### 1. **Tauri Dialog API でフォルダを開く**

#### 変更内容:
- ❌ 削除: `@tauri-apps/plugin-shell` の `Command.create('explorer')`
- ✅ 追加: `@tauri-apps/plugin-dialog` の `open()` API

#### コード:
```typescript
// app/src/ServerDetails.tsx
const { open } = await import('@tauri-apps/plugin-dialog');
await open({
  directory: true,
  multiple: false,
  defaultPath: systemInfo.pluginsDirectory,
  title: 'プラグインフォルダ'
});
```

#### メリット:
- ✅ クロスプラットフォーム対応（Windows, macOS, Linux）
- ✅ Tauri標準API使用
- ✅ ユーザーがフォルダを選択できる
- ✅ エラーハンドリングが簡単

---

### 2. **プラグインローダーの統合**

#### ServerManager への統合:
```typescript
// backend/services/serverManager.ts
private pluginLoaders = new Map<string, PluginLoader>();

// プラグイン管理メソッド
- loadPlugins(serverId: string)
- getPlugins(serverId: string)
- enablePlugin(serverId: string, pluginId: string)
- disablePlugin(serverId: string, pluginId: string)
- triggerPluginEvent(serverId: string, eventName: string, data: any)
```

#### PluginLoader 初期化:
- サーバーIDごとに独立した PluginLoader インスタンス
- プラグインディレクトリ: `C:\Users\PC_User\Documents\PEXData\BedrockProxy\plugins`
- ストレージディレクトリ: `C:\Users\PC_User\Documents\PEXData\BedrockProxy`

---

### 3. **プラグイン API ハンドラー追加**

#### messageRouter に追加:
```typescript
// backend/handlers/messageRouter.ts
case "plugins.load":
  data = await this.handleLoadPlugins(message.data);
  break;

case "plugins.getAll":
  data = this.handleGetPlugins(message.data);
  break;

case "plugins.enable":
  data = await this.handleEnablePlugin(message.data);
  break;

case "plugins.disable":
  data = await this.handleDisablePlugin(message.data);
  break;
```

#### リクエスト/レスポンス:
| API | リクエスト | レスポンス |
|-----|----------|----------|
| `plugins.load` | `{ serverId }` | `{ plugins[] }` |
| `plugins.getAll` | `{ serverId }` | `{ plugins[] }` |
| `plugins.enable` | `{ serverId, pluginId }` | `{ plugin }` |
| `plugins.disable` | `{ serverId, pluginId }` | `{ plugin }` |

---

### 4. **フロントエンド プラグイン API**

#### BedrockProxyAPI に追加:
```typescript
// app/src/API/index.ts
public async loadPlugins(serverId: string): Promise<any[]>
public async getPlugins(serverId: string): Promise<any[]>
public async enablePlugin(serverId: string, pluginId: string): Promise<any>
public async disablePlugin(serverId: string, pluginId: string): Promise<any>
```

#### ServerDetails での実装:
```typescript
// プラグイン更新ボタン
const plugins = await bedrockProxyAPI.loadPlugins(server.id);
console.log('[Plugin Refresh] Loaded plugins:', plugins);
```

---

### 5. **デバッグログ実装**

#### バックエンドログ:
```typescript
console.log(`🔌 [Plugin] Loading plugins for server ${serverId}`);
console.log(`  - Plugin Directory: ${pluginDir}`);
console.log(`  - Storage Directory: ${storageDir}`);
console.log(`✅ [Plugin] Loaded ${plugins.length} plugins:`, plugins);
console.log(`🔌 [Plugin] Enabling plugin ${pluginId} for server ${serverId}`);
console.error(`❌ [Plugin] Failed to load plugins:`, error);
```

#### フロントエンドログ（ブラウザコンソール）:
```typescript
console.log('[Plugin Folder] Opening:', systemInfo.pluginsDirectory);
console.log('[Plugin Refresh] Starting plugin reload...');
console.log('[Plugin Refresh] Plugin directory:', systemInfo.pluginsDirectory);
console.log('[Plugin Refresh] Loading plugins for server:', server.id);
console.log('[Plugin Refresh] Loaded plugins:', plugins);
console.error('[Plugin Refresh] Failed to load plugins:', error);
```

#### API レイヤーログ:
```typescript
console.log(`[API] Loading plugins for server ${serverId}`);
console.log(`[API] Loaded plugins:`, response.plugins);
console.log(`[API] Enabling plugin ${pluginId} for server ${serverId}`);
console.log(`[API] Plugin enabled:`, response.plugin);
```

---

### 6. **ログの階層構造**

```
[Plugin Refresh] (UI)
  └─> [API] (Frontend API Layer)
      └─> 🔌 [Plugin] (Backend ServerManager)
          └─> 📦 [PluginLoader] (Plugin Loader)
              └─> [Plugin Code Execution]
```

---

## 🐛 デバッグ方法

### ステップ1: ブラウザコンソールを開く
1. アプリを起動: `bun run tauri dev`
2. ブラウザの開発者ツールを開く (F12)
3. Console タブを確認

### ステップ2: プラグインフォルダを開く
1. サーバー詳細ページの「プラグイン」タブ
2. 「フォルダを開く」ボタンをクリック
3. コンソールに以下が表示されるか確認:
   ```
   [Plugin Folder] Opening: C:\Users\PC_User\Documents\PEXData\BedrockProxy\plugins
   ```

### ステップ3: プラグインを読み込む
1. 「更新」ボタンをクリック
2. コンソールで以下を確認:
   ```
   [Plugin Refresh] Starting plugin reload...
   [Plugin Refresh] Plugin directory: C:\Users\...
   [Plugin Refresh] Loading plugins for server: <server-id>
   [API] Loading plugins for server <server-id>
   🔌 [Plugin] Loading plugins for server <server-id>
   📦 Loaded X plugins from persistent storage
   ✅ [Plugin] Loaded X plugins: [...]
   [API] Loaded plugins: [...]
   [Plugin Refresh] Loaded plugins: [...]
   ```

### ステップ4: エラー確認
もしプラグインが読み込めない場合:
```
❌ [Plugin] Failed to load plugins: <error>
[Plugin Refresh] Failed to load plugins: <error>
```

---

## 📁 プラグインディレクトリ構造

```
C:\Users\PC_User\Documents\PEXData\BedrockProxy\
├── plugins\                    # プラグインフォルダ
│   ├── sample-plugin\          # 例: サンプルプラグイン
│   │   ├── index.js           # メインファイル
│   │   ├── package.json       # メタデータ
│   │   └── node_modules\      # 依存関係
│   └── another-plugin\
│       └── index.js
├── servers.json               # サーバー設定
└── config.json                # アプリ設定
```

---

## 🔧 トラブルシューティング

### 問題1: フォルダが開かない
**症状**: 「フォルダを開く」ボタンが動作しない

**確認事項**:
1. Tauri dialog プラグインがインストールされているか
   ```toml
   # Cargo.toml
   tauri-plugin-dialog = "2.0"
   ```
2. コンソールエラーを確認
3. プラグインディレクトリが存在するか確認

### 問題2: プラグインが読み込めない
**症状**: 「更新」ボタンをクリックしてもプラグインが表示されない

**デバッグ手順**:
1. ブラウザコンソールで `[Plugin Refresh]` ログを確認
2. バックエンドコンソールで `🔌 [Plugin]` ログを確認
3. プラグインディレクトリにファイルが存在するか確認
4. `index.js` の構文エラーを確認
5. `package.json` の形式を確認

### 問題3: プラグインが有効化できない
**症状**: プラグインを有効化しようとするとエラー

**確認事項**:
1. `onEnable()` 関数が正しく実装されているか
2. API 呼び出しにエラーがないか
3. プラグインの依存関係が解決されているか

---

## 📊 期待されるログ出力

### 正常なプラグイン読み込み:
```
[Plugin Refresh] Starting plugin reload...
[Plugin Refresh] Plugin directory: C:\Users\PC_User\Documents\PEXData\BedrockProxy\plugins
[Plugin Refresh] Loading plugins for server: abc-123
[API] Loading plugins for server abc-123
🔌 [API] Loading plugins for server abc-123
🔌 [Plugin] Loading plugins for server abc-123
  - Plugin Directory: C:\Users\PC_User\Documents\PEXData\BedrockProxy\plugins
  - Storage Directory: C:\Users\PC_User\Documents\PEXData\BedrockProxy
📦 Loaded plugin metadata from package.json: sample-plugin@1.0.0
✅ Loaded plugin: sample-plugin@1.0.0 (with node_modules)
✅ [Plugin] Loaded 1 plugins: [{
  id: "sample-plugin",
  name: "Sample Plugin",
  version: "1.0.0",
  loaded: true,
  enabled: false,
  error: undefined
}]
✅ [API] Loaded 1 plugins for server abc-123
[API] Loaded plugins: [...]
[Plugin Refresh] Loaded plugins: [...]
```

### プラグイン有効化:
```
[API] Enabling plugin sample-plugin for server abc-123
🔌 [API] Enabling plugin sample-plugin for server abc-123
🔌 [Plugin] Enabling plugin sample-plugin for server abc-123
🔌 Creating PluginAPI for server abc-123
✅ Plugin sample-plugin enabled
✅ [API] Enabled plugin sample-plugin
[API] Plugin enabled: {...}
```

---

## ✅ 完了チェックリスト

- ✅ Tauri Dialog API 実装
- ✅ プラグインローダー統合
- ✅ プラグイン API ハンドラー追加
- ✅ フロントエンド API 実装
- ✅ デバッグログ実装（フロントエンド）
- ✅ デバッグログ実装（バックエンド）
- ✅ ビルド成功
- ✅ ドキュメント作成

---

**次のステップ**: アプリを起動してブラウザコンソールでプラグインの読み込み状況を確認してください！
