# BedrockProxy Plugin System

BedrockProxy supports custom plugins that extend server functionality using JavaScript.

## Requirements

- Node.js must be installed on the system
- Plugin support must be enabled in server settings
- Plugins must be placed in the `PEXData/plugins/` folder

## Quick Start

### 1. Enable Plugin Support

1. Open Server Details in BedrockProxy
2. Navigate to the "Plugins" tab
3. Toggle "Enable Plugins" to ON
4. Click "Refresh" to load plugins

### 2. Create Your First Plugin

Create a file `PEXData/plugins/my-plugin.js`:

```javascript
registerPlugin(() => ({
  metadata: {
    name: 'MyPlugin',
    version: '1.0.0',
    description: 'My first plugin',
    author: 'Your Name'
  },
  
  onEnable: async (context) => {
    context.api.log('info', 'MyPlugin enabled!');
    
    // Listen for player joins
    context.api.on('playerJoin', (player) => {
      context.api.log('info', `Welcome ${player.name}!`);
      context.api.sendCommand(`say Welcome ${player.name}!`);
    });
  },
  
  onDisable: async (context) => {
    context.api.log('info', 'MyPlugin disabled');
  }
}));
```

### 3. Load the Plugin

1. Click "Refresh" button in the Plugins tab
2. Your plugin will appear in the list
3. Toggle it to "Enabled"

## Plugin API

### Metadata

```typescript
{
  name: string;        // Plugin name (required)
  version: string;     // Plugin version (required)
  description?: string; // Plugin description
  author?: string;     // Plugin author
  docs?: string;       // Documentation
}
```

### Lifecycle Hooks

- `onLoad(context)` - Called when plugin is first loaded
- `onEnable(context)` - Called when plugin is enabled
- `onDisable(context)` - Called when plugin is disabled
- `onUnload(context)` - Called when plugin is unloaded

### API Methods

#### Logging

```javascript
context.api.log('info', 'Information message');
context.api.log('warn', 'Warning message');
context.api.log('error', 'Error message');
context.api.log('debug', 'Debug message');
```

#### Server Information

```javascript
const server = await context.api.getServerInfo();
console.log(server.name, server.status, server.playersOnline);
```

#### Player Management

```javascript
const players = await context.api.getPlayers();
players.forEach(player => {
  console.log(player.name, player.id);
});
```

#### Commands

```javascript
await context.api.sendCommand('say Hello World');
await context.api.sendCommand('list');
```

#### Events

```javascript
// Player join
context.api.on('playerJoin', (player) => {
  console.log(`${player.name} joined`);
});

// Player leave
context.api.on('playerLeave', (player) => {
  console.log(`${player.name} left`);
});

// Server start
context.api.on('serverStart', (server) => {
  console.log('Server started');
});

// Server stop
context.api.on('serverStop', (server) => {
  console.log('Server stopped');
});

// Console output
context.api.on('consoleOutput', (line) => {
  console.log('Console:', line);
});
```

#### Data Persistence

```javascript
// Store data
await context.api.setData('playerCount', 100);

// Retrieve data
const count = await context.api.getData('playerCount');
```

#### Scheduled Tasks

```javascript
// Run every 60 seconds
const taskId = context.api.setInterval(60000, () => {
  console.log('Task running');
});

// Cancel task
context.api.clearInterval(taskId);
```

## Examples

### Auto-Broadcast Plugin

```javascript
registerPlugin(() => ({
  metadata: {
    name: 'AutoBroadcast',
    version: '1.0.0',
    description: 'Automatically broadcasts messages',
  },
  
  onEnable: (context) => {
    const messages = [
      'Welcome to our server!',
      'Remember to follow the rules!',
      'Have fun playing!'
    ];
    
    let index = 0;
    context.taskId = context.api.setInterval(300000, () => { // Every 5 minutes
      context.api.sendCommand(`say ${messages[index]}`);
      index = (index + 1) % messages.length;
    });
  },
  
  onDisable: (context) => {
    if (context.taskId) {
      context.api.clearInterval(context.taskId);
    }
  }
}));
```

### Player Statistics Plugin

```javascript
registerPlugin(() => ({
  metadata: {
    name: 'PlayerStats',
    version: '1.0.0',
    description: 'Tracks player statistics',
  },
  
  onEnable: async (context) => {
    // Load saved stats
    const stats = await context.api.getData('stats') || {};
    
    // Track joins
    context.api.on('playerJoin', async (player) => {
      stats[player.name] = stats[player.name] || { joins: 0 };
      stats[player.name].joins++;
      stats[player.name].lastJoin = new Date();
      
      await context.api.setData('stats', stats);
      context.api.log('info', `${player.name} has joined ${stats[player.name].joins} times`);
    });
  }
}));
```

## Best Practices

1. **Error Handling**: Wrap async code in try-catch blocks
2. **Cleanup**: Always clean up resources in `onDisable`
3. **Performance**: Avoid heavy computations in event handlers
4. **Logging**: Use appropriate log levels
5. **Testing**: Test plugins thoroughly before production use

## Auto-Reload

Plugins automatically reload when their files are modified (if auto-reload is enabled in settings).

## Troubleshooting

### Plugin not loading
- Check that Node.js is installed
- Verify plugin syntax is correct
- Check console for error messages
- Ensure plugin support is enabled

### Plugin not receiving events
- Verify event names are correct
- Check that plugin is enabled
- Review plugin logs for errors

## Type Definitions

TypeScript definitions are available in `plugindocs/index.d.ts` for IDE autocomplete support.

Add to your `jsconfig.json` or `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["./plugindocs/index.d.ts"]
  }
}
```

## Support

For help with plugin development, please refer to:
- Plugin API documentation in `plugindocs/`
- Example plugins in `PEXData/plugins/examples/`
- BedrockProxy GitHub repository
