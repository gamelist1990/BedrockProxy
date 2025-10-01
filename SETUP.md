# BedrockProxy - Setup and Development Guide

This guide will help you set up the BedrockProxy project for development and building.

## Prerequisites

Before you begin, make sure you have the following installed:

### Required Tools

1. **Bun** (for backend)
   - Install from: https://bun.sh
   - Version: Latest stable version
   - Used for: Backend TypeScript execution and building

2. **Node.js and npm** (for frontend/Tauri)
   - Install from: https://nodejs.org
   - Version: Node 18+ recommended
   - Used for: Frontend React app and Tauri build tools

3. **Rust and Cargo** (for Tauri desktop app)
   - Install from: https://www.rust-lang.org/tools/install
   - Tauri prerequisites: https://tauri.app/v2/guides/prerequisites/
   - Used for: Building the Tauri desktop application

## Project Structure

```
BedrockProxy/
├── backend/           # Bun-based WebSocket backend
│   ├── index.ts      # Entry point
│   ├── build.mjs     # Build script
│   ├── types/        # TypeScript type definitions
│   ├── services/     # Backend services
│   └── handlers/     # WebSocket message handlers
│
├── app/              # React + Vite + Tauri frontend
│   ├── src/          # React source code
│   ├── src-tauri/    # Tauri Rust configuration
│   ├── public/       # Static assets including translations
│   └── package.json  # Frontend dependencies and scripts
│
└── package.json      # Root package configuration
```

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/gamelist1990/BedrockProxy.git
cd BedrockProxy
```

### 2. Backend Setup

The backend is a Bun-based WebSocket server.

#### Running Backend in Development

From the repository root:

```bash
# Set the port (optional, defaults to 8080)
PORT=8080 bun ./backend/index.ts
```

The backend will start on `ws://localhost:8080` with a health endpoint at `http://localhost:8080/health`.

#### Building Backend Executable

The `backend/build.mjs` script builds a standalone executable:

```bash
cd backend
bun run build.mjs
```

This will:
1. Compile the backend using `bun build --compile`
2. Create a platform-specific executable (backend.exe on Windows, backend on Unix)
3. Move it to `app/src-tauri/binaries/` with the correct naming for Tauri

**Build Options:**

```bash
# Build for specific platform
bun run build.mjs --windows
bun run build.mjs --linux
bun run build.mjs --mac

# Specify architecture
bun run build.mjs --arch=x64
bun run build.mjs --arch=arm64

# Custom entry point
bun run build.mjs --entry=./custom-entry.ts
```

The built executable will be automatically placed in:
- `app/src-tauri/binaries/backend-x86_64-pc-windows-msvc.exe` (Windows)
- `app/src-tauri/binaries/backend-x86_64-unknown-linux-gnu` (Linux)
- `app/src-tauri/binaries/backend-aarch64-apple-darwin` (macOS ARM)
- etc.

### 3. Frontend Setup

The frontend is a React application with Vite and Tauri.

#### Install Dependencies

```bash
cd app
npm install
# or if you prefer bun:
bun install
```

#### Running Frontend in Development (Web Only)

To run just the web interface:

```bash
cd app
npm run dev
# or
bun run dev
```

This starts the Vite dev server on `http://localhost:1420`.

#### Running Full Tauri Desktop App in Development

To run the complete desktop application:

```bash
cd app
npm run tauri dev
# or
bun tauri dev
```

This will:
1. Start the Vite dev server
2. Build the Rust/Tauri wrapper
3. Launch the desktop application window
4. Enable hot-reload for frontend changes

**Note:** Make sure the backend is running separately or will be auto-started by the Tauri app.

## Building for Production

### Full Build Process

1. **Build the Backend:**
   ```bash
   cd backend
   bun run build.mjs
   ```
   This creates the backend executable in `app/src-tauri/binaries/`

2. **Build the Frontend + Tauri App:**
   ```bash
   cd app
   npm run tauri build
   # or
   bun tauri build
   ```

This creates platform-specific installers in `app/src-tauri/target/release/bundle/`:
- Windows: `.msi` and `.exe` installers
- macOS: `.dmg` and `.app` bundle
- Linux: `.deb`, `.AppImage`, etc.

### Build Outputs

After building, you'll find:
- Backend executable: `app/src-tauri/binaries/backend-*`
- Tauri app bundles: `app/src-tauri/target/release/bundle/`
- Web build: `app/dist/`

## Development Workflow

### Typical Development Session

1. **Terminal 1 - Backend:**
   ```bash
   cd backend
   PORT=8080 bun ./index.ts
   ```

2. **Terminal 2 - Frontend:**
   ```bash
   cd app
   bun tauri dev
   ```

### Making Changes

- **Frontend changes:** Edit files in `app/src/`, changes hot-reload automatically
- **Backend changes:** Restart the backend server (Ctrl+C and re-run)
- **Tauri config changes:** Edit `app/src-tauri/tauri.conf.json`, restart `tauri dev`
- **Rust changes:** Edit files in `app/src-tauri/src/`, Tauri will rebuild automatically

### Testing Changes

- **Web UI:** Use browser devtools on `localhost:1420`
- **Desktop App:** Use Tauri devtools (right-click → Inspect Element)
- **Backend:** Check logs in terminal, use `/health` endpoint for diagnostics

## Common Issues and Solutions

### Backend Build Fails

**Problem:** `bun build --compile` fails
- **Solution:** Make sure you have the latest Bun version: `bun upgrade`
- Check that all dependencies are listed in `package.json`

### Tauri Build Fails

**Problem:** Rust compilation errors
- **Solution:** 
  - Update Rust: `rustup update`
  - Clean build: `cd app/src-tauri && cargo clean`
  - Check Tauri prerequisites: https://tauri.app/v2/guides/prerequisites/

### WebSocket Connection Issues

**Problem:** Frontend can't connect to backend
- **Solution:**
  - Ensure backend is running on the expected port (default 8080)
  - Check firewall settings
  - Verify `ws://localhost:8080` is accessible

### Hot Reload Not Working

**Problem:** Changes don't appear in development
- **Solution:**
  - For frontend: Hard refresh browser (Ctrl+Shift+R)
  - For Tauri: Restart `tauri dev`
  - Check Vite dev server is running

## Port Configuration

Default ports:
- Backend WebSocket: `8080` (configurable via `PORT` env variable)
- Frontend Dev Server: `1420` (configured in `app/vite.config.ts`)
- HMR (Hot Module Replacement): `1421`

To change ports:

```bash
# Backend
PORT=3000 bun ./backend/index.ts

# Frontend (edit app/vite.config.ts)
server: {
  port: 5173,  // Change this
  strictPort: true,
}
```

## Architecture Notes

### Backend Architecture

- **WebSocket Server:** Handles real-time communication with frontend
- **Services:**
  - `serverManager.ts`: Manages Minecraft server instances
  - `udpProxy.ts`: UDP proxy for Bedrock protocol
  - `processManager.ts`: Server process lifecycle management
  - `dataStorage.ts`: Persistent storage for server configurations
- **Message Router:** Routes WebSocket messages to appropriate handlers

### Frontend Architecture

- **React 19** with **TypeScript**
- **Material-UI (MUI)** for components
- **React Router** for navigation
- **Vite** for fast development and building
- **Tauri 2.0** for desktop app packaging

### Communication Flow

```
User Interface (React)
    ↕ WebSocket
Backend API (Bun)
    ↕ UDP
Bedrock Server
```

## Debugging

### Backend Debugging

Add debug logs:
```typescript
console.debug('Debug message');
console.log('Info message');
console.error('Error message');
```

### Frontend Debugging

Use React DevTools and browser console:
```typescript
console.log('Component state:', state);
```

### Tauri Debugging

Check Rust logs:
```bash
cd app
RUST_LOG=debug npm run tauri dev
```

## Contributing

When contributing:
1. Make minimal, focused changes
2. Test both web and desktop versions
3. Update documentation if adding features
4. Follow existing code style
5. Ensure builds work on target platforms

## Additional Resources

- Bun Documentation: https://bun.sh/docs
- Tauri Documentation: https://tauri.app/v2/
- React Documentation: https://react.dev
- Material-UI: https://mui.com

## License

See the LICENSE file in the repository root.
