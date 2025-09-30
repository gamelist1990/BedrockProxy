// シンプルなテストサーバー
const server = Bun.serve({
  port: 8081,
  fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        message: "Simple test server is running",
        timestamp: new Date().toISOString()
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    
    return new Response("Hello from Simple Test Server!", {
      headers: { "Content-Type": "text/plain" },
    });
  },
});

console.log(`🚀 Simple test server running on http://localhost:8081`);
console.log(`🩺 Health check: http://localhost:8081/health`);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down simple test server...");
  server.stop();
  process.exit(0);
});