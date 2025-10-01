/**
 * Sample BedrockProxy Plugin
 * 
 * This is an example plugin that demonstrates the BedrockProxy Plugin API.
 * It shows how to:
 * - Define plugin metadata
 * - Handle lifecycle hooks (onEnable, onDisable)
 * - Listen to server events
 * - Send commands to the server
 * - Use scheduled tasks
 * - Store and retrieve data
 * 
 * To use this plugin:
 * 1. Create a folder in PEXData/plugins/ (e.g., PEXData/plugins/sample-plugin/)
 * 2. Copy this file as index.js in that folder
 * 3. Enable plugins in the server settings
 * 4. Click refresh in the plugins tab
 * 5. Toggle the plugin to enabled
 */

registerPlugin(() => ({
  metadata: {
    name: 'Sample Plugin',
    version: '1.0.0',
    description: 'A sample plugin demonstrating the BedrockProxy Plugin API',
    author: 'BedrockProxy Team',
    docs: 'https://github.com/gamelist1990/BedrockProxy'
  },

  /**
   * Called when the plugin is first loaded
   */
  onLoad: async (context) => {
    context.api.log('info', `${context.metadata.name} v${context.metadata.version} loaded`);
  },

  /**
   * Called when the plugin is enabled
   */
  onEnable: async (context) => {
    context.api.log('info', `${context.metadata.name} enabled!`);

    // Example 1: Welcome message for joining players
    context.api.on('playerJoin', (player) => {
      context.api.log('info', `Player ${player.name} joined the server`);
      context.api.sendCommand(`say Welcome to the server, ${player.name}!`);
    });

    // Example 2: Goodbye message for leaving players
    context.api.on('playerLeave', (player) => {
      context.api.log('info', `Player ${player.name} left the server`);
      context.api.sendCommand(`say ${player.name} left the server. See you next time!`);
    });

    // Example 3: Log when server starts
    context.api.on('serverStart', (server) => {
      context.api.log('info', `Server ${server.name} started`);
    });

    // Example 4: Log when server stops
    context.api.on('serverStop', (server) => {
      context.api.log('info', `Server ${server.name} stopped`);
    });

    // Example 5: Monitor console output
    context.api.on('consoleOutput', (line) => {
      // You can parse console output and react to it
      if (line.includes('ERROR')) {
        context.api.log('warn', `Server error detected: ${line}`);
      }
    });

    // Example 6: Periodic announcements (every 5 minutes)
    const announcements = [
      'Remember to follow the server rules!',
      'Join our Discord server for updates!',
      'Report any bugs to the administrators.',
      'Have fun and play fair!'
    ];

    let announcementIndex = 0;
    context.announcementInterval = context.api.setInterval(300000, () => {
      const message = announcements[announcementIndex];
      context.api.sendCommand(`say [Server] ${message}`);
      announcementIndex = (announcementIndex + 1) % announcements.length;
    });

    // Example 7: Track player join count
    let joinCount = await context.api.getData('joinCount') || 0;
    
    context.api.on('playerJoin', async (player) => {
      joinCount++;
      await context.api.setData('joinCount', joinCount);
      
      if (joinCount % 100 === 0) {
        context.api.sendCommand(`say Congratulations! This is the ${joinCount}th player to join!`);
      }
    });

    // Example 8: Server info on player join
    context.api.on('playerJoin', async (player) => {
      const serverInfo = await context.api.getServerInfo();
      const players = await context.api.getPlayers();
      
      context.api.log('info', 
        `Server: ${serverInfo.name}, Status: ${serverInfo.status}, ` +
        `Players: ${serverInfo.playersOnline}/${serverInfo.maxPlayers}`
      );
    });

    context.api.log('info', 'Sample plugin is now active and monitoring server events');
  },

  /**
   * Called when the plugin is disabled
   */
  onDisable: async (context) => {
    // Clean up scheduled tasks
    if (context.announcementInterval) {
      context.api.clearInterval(context.announcementInterval);
    }

    // Save any final data
    context.api.log('info', `${context.metadata.name} disabled. Cleaning up...`);
  },

  /**
   * Called when the plugin is unloaded
   */
  onUnload: async (context) => {
    context.api.log('info', `${context.metadata.name} unloaded`);
  }
}));
