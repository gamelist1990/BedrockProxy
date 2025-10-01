/**
 * Sample BedrockProxy Plugin
 * 
 * This demonstrates the enhanced BedrockProxy Plugin API with:
 * - Folder-based plugin structure with node_modules support
 * - Extended API features (HTTP, File System, Storage)
 * - Type-safe development with TypeScript definitions
 * - Inter-plugin communication
 * - Advanced event handling
 * 
 * Installation:
 * 1. Create folder: C:\Users\PC_User\Documents\PEXData\BedrockProxy\plugins\sample-plugin
 * 2. Copy this file as index.js
 * 3. Copy package.json
 * 4. Run: npm install (if you need dependencies)
 * 5. Enable plugin in BedrockProxy UI
 */

registerPlugin(() => ({
  metadata: {
    name: 'Sample Plugin',
    version: '1.0.0',
    description: 'A comprehensive sample plugin',
    author: 'BedrockProxy Team',
    homepage: 'https://github.com/gamelist1990/BedrockProxy',
    license: 'MIT'
  },

  // Plugin lifecycle: onLoad -> onEnable -> onDisable -> onUnload

  async onLoad(context) {
    context.api.info('Sample Plugin loading...', {
      version: context.metadata.version,
      dataDir: context.dataDir,
      pluginDir: context.pluginDir
    });
    
    // Validate environment
    const serverInfo = await context.api.getServerInfo();
    context.api.info(`Attached to server: ${serverInfo.name}`);
  },

  async onEnable(context) {
    const { api } = context;
    
    api.info('Sample Plugin enabled!');

    // ==================== Example 1: Player Events ====================
    
    // Welcome message with player stats
    api.on('playerJoin', async (event) => {
      const { player } = event;
      api.info(`Player ${player.name} joined`);
      
      // Get player stats
      const stats = await api.getPlayerStats(player.id);
      const joinCount = stats ? stats.joinCount : 1;
      
      // Send welcome message
      await api.broadcast(`Welcome ${player.name}! (Join #${joinCount})`);
      
      // Track total joins in storage
      const totalJoins = await api.storage.get('totalJoins', 0);
      await api.storage.set('totalJoins', totalJoins + 1);
    });

    // Goodbye message
    api.on('playerLeave', async (event) => {
      const { player } = event;
      api.info(`Player ${player.name} left`);
      await api.broadcast(`${player.name} left the game`);
    });

    // ==================== Example 2: Scheduled Tasks ====================
    
    // Announce server info every 5 minutes
    api.setInterval(5 * 60 * 1000, async () => {
      const server = await api.getServerInfo();
      const players = await api.getPlayers();
      
      await api.broadcast(
        `[Server] ${players.length}/${server.maxPlayers} players online`
      );
    });

    // Auto-save statistics every 10 minutes
    api.setInterval(10 * 60 * 1000, async () => {
      const stats = await api.getServerStats();
      await api.fs.writeJSON('stats.json', {
        timestamp: new Date(),
        uptime: stats.uptime,
        totalJoins: stats.totalJoins,
        peakPlayers: stats.peakPlayers
      }, true);
      
      api.info('Statistics saved');
    });

    // ==================== Example 3: HTTP Integration ====================
    
    // Fetch and announce MOTD from API
    try {
      const response = await api.http.get('https://api.example.com/motd');
      const motd = response.data.message;
      await api.storage.set('motd', motd);
      api.info('MOTD fetched from API', { motd });
    } catch (error) {
      api.warn('Failed to fetch MOTD from API', error);
    }

    // ==================== Example 4: File System ====================
    
    // Load plugin configuration from JSON file
    let config = { announcements: [], autoSave: true };
    
    if (await api.fs.exists('config.json')) {
      config = await api.fs.readJSON('config.json');
      api.info('Configuration loaded', config);
    } else {
      // Create default config
      await api.fs.writeJSON('config.json', config, true);
      api.info('Default configuration created');
    }

    // Watch config file for changes
    api.fs.watch('config.json', async (event, filename) => {
      if (event === 'change') {
        const newConfig = await api.fs.readJSON('config.json');
        api.info('Configuration reloaded', newConfig);
        config = newConfig;
      }
    });

    // ==================== Example 5: Advanced Storage ====================
    
    // Namespaced storage for different features
    const playerStorage = api.storage.namespace('players');
    const statsStorage = api.storage.namespace('stats');
    
    api.on('playerJoin', async (event) => {
      const { player } = event;
      
      // Store player data
      await playerStorage.set(player.id, {
        name: player.name,
        lastJoin: new Date(),
        joinCount: (await playerStorage.get(player.id))?.joinCount + 1 || 1
      });
    });

    // ==================== Example 6: Console Monitoring ====================
    
    // Monitor console for errors and warnings
    api.on('consoleOutput', async (event) => {
      const { line, type } = event;
      
      if (line.includes('ERROR') || line.includes('WARN')) {
        // Log to file
        await api.fs.appendFile('errors.log', 
          `[${new Date().toISOString()}] ${line}\n`
        );
        
        // Send to admin via HTTP webhook (example)
        try {
          await api.http.post('https://discord.com/api/webhooks/...', {
            content: `🚨 Server Alert: ${line}`
          });
        } catch (error) {
          api.warn('Failed to send webhook', error);
        }
      }
    });

    // ==================== Example 7: Custom Commands ====================
    
    // Simple command parser
    api.on('consoleOutput', async (event) => {
      const { line } = event;
      
      // Match player commands like "[Player] !stats"
      const cmdMatch = line.match(/\[([^\]]+)\] !(\w+)(.*)/);
      if (cmdMatch) {
        const [, playerName, command, args] = cmdMatch;
        
        switch (command) {
          case 'stats':
            const player = await api.getPlayerByName(playerName);
            if (player) {
              const stats = await api.getPlayerStats(player.id);
              await api.tellPlayer(player.id, 
                `Your stats: ${stats.joinCount} joins, ` +
                `${Math.round(stats.totalPlayTime / 60000)} minutes played`
              );
            }
            break;
            
          case 'info':
            const server = await api.getServerInfo();
            await api.broadcast(
              `Server: ${server.name} | Players: ${server.playersOnline}/${server.maxPlayers}`
            );
            break;
        }
      }
    });

    // ==================== Example 8: Inter-Plugin Communication ====================
    
    // Check if another plugin is loaded
    if (api.isPluginLoaded('economy-plugin')) {
      api.info('Economy plugin detected, enabling integration');
      
      // Call economy plugin function
      try {
        const balance = await api.callPlugin('economy-plugin', 'getBalance', 'player123');
        api.info('Player balance:', balance);
      } catch (error) {
        api.warn('Failed to call economy plugin', error);
      }
    }

    // ==================== Example 9: Data Export ====================
    
    // Export daily report
    api.setInterval(24 * 60 * 60 * 1000, async () => {
      const stats = await api.getServerStats();
      const players = await api.getPlayers();
      
      const report = {
        date: new Date().toISOString(),
        serverStats: stats,
        currentPlayers: players.length,
        totalJoins: await api.storage.get('totalJoins', 0)
      };
      
      // Save to file
      const filename = `report-${new Date().toISOString().split('T')[0]}.json`;
      await api.fs.writeJSON(`reports/${filename}`, report, true);
      
      // Upload to external service (example)
      try {
        await api.http.post('https://api.example.com/reports', report);
        api.info('Daily report exported');
      } catch (error) {
        api.warn('Failed to upload report', error);
      }
    });

    api.info('Sample Plugin fully initialized!');
  },

  async onDisable(context) {
    context.api.info('Sample Plugin disabled - cleaning up...');
    
    // Clean up is handled automatically:
    // - All event listeners are removed
    // - All timers are cleared
    // - Storage is persisted
  },

  async onUnload(context) {
    context.api.info('Sample Plugin unloaded');
  },

  async onReload(context) {
    context.api.info('Sample Plugin configuration reloaded');
    // Reload configuration without full restart
  }
}));
