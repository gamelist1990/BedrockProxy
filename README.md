# BedrockProxy

BedrockProxy is a lightweight WebSocket proxy and desktop UI for interacting with Bedrock-compatible servers. It includes a Bun-based backend (WebSocket server) and a React + Tauri frontend (desktop app using Vite + Tauri).

## Features

- Bun-based WebSocket backend with health check and broadcast endpoints
- Connection and subscription management for event-based messaging
- React + Vite frontend with optional Tauri desktop packaging
- Simple debug broadcast HTTP endpoint for local testing

## Repository layout

- backend/ - Bun-based server implementation (TypeScript)
  - backend/index.ts — entrypoint that starts the WebSocket server (PORT env var, default 8080)
  - backend/server.ts — WebSocket server logic and health endpoint
- app/ - React + Vite frontend and Tauri configuration
  - app/package.json — dev/build scripts (dev, build, preview, tauri)
  - app/src - React source

## Quickstart (development)

Prerequisites

- Bun (for running the backend) — https://bun.sh
- Node.js + npm (for frontend and Tauri) — https://nodejs.org
- Rust + Tauri prerequisites if you want to build the desktop app — https://tauri.app

Start backend (development)

1. From repository root run the backend with Bun:

```bash
# run from repo root
PORT=8080 bun ./backend/index.ts
```

2. Health check

Open: http://localhost:8080/health

WebSocket endpoint: ws://localhost:8080

Start frontend (development)

```bash
cd app
npm install
npm run dev
```

Start Tauri desktop app (optional)

```bash
cd app
npm install
npm run tauri dev
```

## API & Debug endpoints

- GET /health — returns server status and connection statistics (backend/server.ts:101-112)
- POST /debug/broadcast — send a debug broadcast to subscribers (backend/server.ts:114-135)

WebSocket messages

- Supported control messages: ping, pong, subscribe, unsubscribe
- Generic request/response messages are routed via MessageRouter

## Configuration

- PORT — backend listens on this port (default 8080)
- No other config files detected; check backend and app source for environment-specific values

## Development notes

- Backend is designed to run on Bun and uses Bun.serve for WebSocket handling (backend/server.ts:37-50)
- Frontend uses Vite + React and includes Tauri configuration for desktop packaging (app/src-tauri)

## Contributing

Contributions welcome. Please open issues or PRs describing changes.

## License

No LICENSE file detected in the repository. Please add a LICENSE file to clarify the project license.

---

Generated with [Claude Code](https://claude.ai/code)
