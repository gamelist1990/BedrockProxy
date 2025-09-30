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
  wsServer.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down server...");
  wsServer.stop();
  process.exit(0);
});