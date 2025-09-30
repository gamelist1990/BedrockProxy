import { WebSocketServer } from "./server.js";

// 環境変数からポート番号を取得、デフォルトは8080
const PORT = parseInt(process.env.PORT || "8080");

console.log("🚀 Starting Bedrock Proxy Backend...");

// WebSocketサーバーを作成して開始
const wsServer = new WebSocketServer(PORT);

try {
  wsServer.start();
  
  console.log(`✅ Bedrock Proxy Backend is running on port ${PORT}`);
  console.log(`🌐 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/health`);
  
} catch (error) {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down server...");
  try {
    // stop may perform async work; call and wait briefly
    wsServer.stop();
    // give background tasks a short moment to finish
    setTimeout(() => process.exit(0), 1500);
  } catch (e) {
    console.error('Error during shutdown:', e);
    process.exit(1);
  }
});

  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down...');
    try {
      await wsServer.stop();
      console.log('Shutdown complete, exiting.');
      process.exit(0);
    } catch (e) {
      console.error('Error during shutdown:', e);
      process.exit(1);
    }
  });

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down...');
    try {
      await wsServer.stop();
      console.log('Shutdown complete, exiting.');
      process.exit(0);
    } catch (e) {
      console.error('Error during shutdown:', e);
      process.exit(1);
    }
  });