# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick commands

- Install deps (root):

```bash
# from repo root
bun install
```

- Run backend (Bun):

```bash
# from repo root
bun run index.ts
```

- Frontend (app/) common commands:

```bash
# from repo root
cd app
bun install
bun run dev     # start Vite dev server
bun run build   # build (runs `tsc && vite build`)
bun run preview # preview built site
```

- Type check the frontend TypeScript:

```bash
cd app
npx tsc --noEmit
```

- Tests / lints:

There are no lint or test scripts configured in the repository currently. If you add a test runner, a typical single-test command is:

```bash
# example (replace with the project's chosen runner)
cd app
npx vitest path/to/testfile
# or
npx jest path/to/testfile
```

## High-level architecture

- Monorepo-like layout:
  - Root contains Bun entrypoint for the backend and a small package.json: [package.json](package.json)
  - Backend code lives under backend/ — a Bun-based WebSocket server implemented in TypeScript.
  - Frontend (desktop/web UI) lives under app/ — React + Vite + MUI and optional Tauri integration.

- Backend responsibilities:
  - Entrypoint: [backend/index.ts:3](backend/index.ts#L3) — reads PORT and starts the WebSocket server.
  - Server implementation: [backend/server.ts:37](backend/server.ts#L37) — creates Bun.serve with websocket handlers and HTTP fetch handler (health, CORS, upgrade).
  - Message handling and subscriptions: see [backend/server.ts:123](backend/server.ts#L123) (message parsing, subscribe/unsubscribe handling) and broadcast APIs [backend/server.ts:224](backend/server.ts#L224).
  - Types and protocol: [backend/types/index.ts:50](backend/types/index.ts#L50) defines WebSocketMessage, RequestMessage, ResponseMessage, EventMessage and domain APIs.

- Key modules to inspect when changing behavior:
  - Connection lifecycle and heartbeat logic: services/connectionManager.* (referenced from [backend/server.ts:17](backend/server.ts#L17)).
  - Message routing: handlers/messageRouter.* (used at [backend/server.ts:14](backend/server.ts#L14) and invoked at [backend/server.ts:194](backend/server.ts#L194)).

- Protocol notes
  - WebSocket messages are JSON objects with a `type` field. Ping/pong are handled specially ([backend/server.ts:135](backend/server.ts#L135)).
  - Clients can `subscribe`/`unsubscribe` to event types; broadcasts are sent only to subscribers.
  - A simple HTTP health endpoint exists at /health ([backend/server.ts:78](backend/server.ts#L78)).

## Repo-specific facts to preserve

- Project was initialized with Bun (README): installation and run instructions use `bun` ([README.md:5](README.md#L5) and [README.md:11](README.md#L11)).
- Frontend uses TypeScript and Vite (see app/package.json scripts: [app/package.json:6](app/package.json#L6)).

## When modifying or adding code

- Prefer editing existing files under backend/ or app/ rather than creating new top-level packages unless necessary.
- If you change the backend protocol, update types in [backend/types/index.ts:50](backend/types/index.ts#L50) and the router/connection manager modules.



