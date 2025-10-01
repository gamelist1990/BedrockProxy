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
const shutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  try {
    await wsServer.stop();
    console.log('✅ Shutdown complete, exiting.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error during shutdown:', e);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));