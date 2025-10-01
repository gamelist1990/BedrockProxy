# BedrockProxy Plugin System

BedrockProxy supports a powerful plugin system that allows you to extend server functionality with JavaScript.

## 🌟 Features

- **📁 Folder-Based Plugins**: Each plugin is a folder with `index.js` and optional `package.json`
- **📦 Node Modules Support**: Install and use npm packages in your plugins
- **🔌 Rich API**: Access server info, players, events, storage, HTTP, and file system
- **🎯 Type-Safe**: Full TypeScript definitions for IDE autocomplete
- **🔄 Hot Reload**: Reload plugins without restarting the server
- **💾 Persistent Storage**: Save plugin data that persists across restarts
- **🌐 HTTP Client**: Make web requests and webhooks
- **📂 File System**: Read and write files (sandboxed to plugin directory)
- **🔗 Inter-Plugin Communication**: Plugins can call each other's functions

## Requirements

- Node.js must be installed on the system
- Plugin support must be enabled in server settings
- Plugins must be placed in `C:\Users\PC_User\Documents\PEXData\BedrockProxy\plugins\`

## Quick Start

### 1. Enable Plugin Support

1. Open Server Details in BedrockProxy
2. Navigate to the "Plugins" tab
3. Toggle "Enable Plugins" to ON
4. Click "Open Folder" to access the plugins directory
5. Click "Refresh" to load plugins

### 2. Create Your First Plugin

Create a folder structure:

```
C:\Users\PC_User\Documents\PEXData\BedrockProxy\plugins\
└── my-first-plugin\
    ├── package.json
    └── index.js
```

**package.json**:
```json
{
  "name": "my-first-plugin",
  "version": "1.0.0",
  "description": "My first BedrockProxy plugin",
  "main": "index.js",
  "author": "Your Name"
}
```

**index.js**:
```javascript
registerPlugin(() => ({
  metadata: {
    name: 'My First Plugin',
    version: '1.0.0',
    description: 'My first plugin',
    author: 'Your Name'
  },
  
  async onEnable(context) {
    const { api } = context;
    
    api.info('Plugin enabled!');
    
    // Welcome message for joining players
    api.on('playerJoin', async (event) => {
      const { player } = event;
      await api.broadcast(`Welcome ${player.name}!`);
    });
  },
  
  async onDisable(context) {
    context.api.info('Plugin disabled');
  }
}));
```

### 3. Load the Plugin

1. Click "Refresh" button in the Plugins tab
2. Your plugin will appear in the list
3. Toggle it to "Enabled"

## Plugin Structure

### Recommended Structure

```
my-plugin/
├── package.json          # Plugin metadata and dependencies
├── index.js             # Main plugin file (required)
├── config.json          # Plugin configuration
├── README.md            # Plugin documentation
├── node_modules/        # npm dependencies (auto-installed)
└── data/               # Plugin data directory (created automatically)
    ├── storage.json    # Persistent storage
    └── logs/          # Plugin logs
```

### Using npm Packages

You can use any npm package in your plugins:

1. Navigate to your plugin folder
2. Run `npm install <package-name>`
3. Import and use in your plugin

**Example with axios**:

```bash
cd C:\Users\PC_User\Documents\PEXData\BedrockProxy\plugins\my-plugin
npm install axios
```

```javascript
// index.js
const axios = require('axios');

registerPlugin(() => ({
  metadata: {
    name: 'HTTP Example',
    version: '1.0.0'
  },
  
  async onEnable(context) {
    // Or use built-in HTTP API
    const response = await context.api.http.get('https://api.example.com/data');
    context.api.info('Response:', response.data);
  }
}));
```

## Plugin API

### Type Definitions

For IDE autocomplete and type checking, reference the type definitions:

```javascript
/// <reference path="../../../plugindocs/types/index.d.ts" />

registerPlugin(() => ({
  // Your plugin code with full autocomplete
}));
```

### Metadata

```typescript
{
  name: string;           // Plugin name (required)
  version: string;        // Plugin version (required)
  description?: string;   // Plugin description
  author?: string;        // Plugin author
  homepage?: string;      // Plugin homepage/repo URL
  license?: string;       // Plugin license
  dependencies?: Record<string, string>; // Plugin dependencies
  keywords?: string[];    // Search keywords
  minBedrockProxyVersion?: string; // Min BedrockProxy version
}
```

### Lifecycle Hooks

```javascript
{
  // Called when plugin is loaded (before enable)
  onLoad: async (context) => { },
  
  // Called when plugin is enabled
  onEnable: async (context) => { },
  
  // Called when plugin is disabled
  onDisable: async (context) => { },
  
  // Called when plugin is unloaded (after disable)
  onUnload: async (context) => { },
  
  // Called when configuration is reloaded
  onReload: async (context) => { }
}
```

### API Methods

#### Logging

```javascript
api.debug('Debug message', { data });
api.info('Info message');
api.warn('Warning message');
api.error('Error message');
api.log('info', 'Custom log', { extra: 'data' });
```

#### Server Information

```javascript
// Get server info
const server = await api.getServerInfo();
console.log(server.name, server.status, server.playersOnline);

// Get server statistics
const stats = await api.getServerStats();
console.log(stats.uptime, stats.totalJoins, stats.peakPlayers);

// Send command to server
await api.sendCommand('say Hello World');

// Get console output
const lines = await api.getConsoleOutput(100);
```

#### Player Management

```javascript
// Get all online players
const players = await api.getPlayers();

// Get specific player
const player = await api.getPlayer('player-id');
const playerByName = await api.getPlayerByName('Steve');

// Get player statistics
const stats = await api.getPlayerStats('player-id');
console.log(stats.joinCount, stats.totalPlayTime);

// Player actions
await api.kickPlayer('player-id', 'Kicked by plugin');
await api.tellPlayer('player-id', 'Private message');
await api.broadcast('Message to all players');
```

#### Events

```javascript
// Listen to events
api.on('playerJoin', async (event) => {
  const { player, currentPlayerCount } = event;
  api.info(`${player.name} joined! Total: ${currentPlayerCount}`);
});

api.on('playerLeave', async (event) => {
  const { player, reason } = event;
  api.info(`${player.name} left: ${reason}`);
});

api.on('serverStart', async (event) => {
  api.info('Server started!');
});

api.on('serverStop', async (event) => {
  api.info('Server stopped!');
});

api.on('consoleOutput', async (event) => {
  const { line, type } = event;
  if (line.includes('ERROR')) {
    api.error('Server error detected:', line);
  }
});

// One-time listener
api.once('playerJoin', (event) => {
  api.info('First player joined!');
});

// Remove listener
const handler = (event) => { };
api.on('playerJoin', handler);
api.off('playerJoin', handler);

// Emit custom events
api.emit('customEvent', { data: 'value' });
```

#### Timing

```javascript
// Recurring task (every 5 minutes)
const intervalId = api.setInterval(5 * 60 * 1000, async () => {
  await api.broadcast('Periodic announcement');
});

// One-time delayed task
const timeoutId = api.setTimeout(10 * 1000, async () => {
  api.info('10 seconds passed');
});

// Cancel timer
api.clearTimer(intervalId);
api.clearTimer(timeoutId);
```

#### Storage

```javascript
// Get/set data
await api.storage.set('key', { some: 'data' });
const data = await api.storage.get('key', defaultValue);

// Check existence
const exists = await api.storage.has('key');

// Delete
await api.storage.delete('key');

// Get all keys/values/entries
const keys = await api.storage.keys();
const values = await api.storage.values();
const entries = await api.storage.entries();

// Clear all storage
await api.storage.clear();

// Namespaced storage
const playerStorage = api.storage.namespace('players');
await playerStorage.set('player1', { coins: 100 });

// Storage with options
await api.storage.set('temp-data', value, {
  ttl: 60000,      // Expires after 1 minute
  compress: true,   // Compress data
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
