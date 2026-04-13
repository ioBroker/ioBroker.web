# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ioBroker.web is a web server adapter for ioBroker (home automation platform). It provides an Express 5 HTTP server that serves static files, handles authentication via Passport.js, exposes a REST API for state read/write, and supports real-time WebSocket communication. Other ioBroker adapters can extend it via the web extensions system.

## Commands

### Build
```bash
npm run build              # Full build: TypeScript backend + all React frontends
npm run build-backend      # Backend only: TypeScript compile + copy i18n files
```

Individual frontend build steps (via tasks.js):
```bash
npm run 0-clean            # Clean admin build artifacts
npm run 1-npm              # Install src-admin dependencies
npm run 2-build            # Build admin React app (Vite)
npm run 3-copy             # Copy admin build to admin/
npm run 4-login            # Build login page (src-login -> www/login/)
npm run www                # Build welcome page (src-www -> www/)
```

### Test
```bash
npm test                   # Integration tests (Mocha + Axios, HTTP-level)
npm run test:integration   # Same as above
npm run test:package       # Validate io-package.json structure
```

Tests use `@iobroker/legacy-testing` to spin up a real ioBroker instance. The first test in the suite has a 29-second startup delay. No unit test framework is used.

### Lint
```bash
npm run lint               # ESLint across all 4 projects (src, src-admin, src-login, src-www)
```

ESLint uses `@iobroker/eslint-config` (flat config). Each sub-project has its own `eslint.config.mjs`.

### Install all dependencies
```bash
npm run npm                # Runs npm install in root + all 3 frontend sub-projects
```

## Architecture

### Backend (`src/` -> `build/`)

- **`src/main.ts`** - Single-file adapter (~2800 lines). Exports `WebAdapter` class extending `Adapter` from `@iobroker/adapter-core`. Contains all server logic: Express setup, authentication, routing, WebSocket distribution, extension loading.
- **`src/lib/utils.ts`** - Link replacement utilities for adapter instance URLs.
- **`src/types.d.ts`** - TypeScript interfaces (ExtAPI, WebAdapterConfig, etc.).
- **`src/i18n/`** - Backend translation files (copied to `build/i18n/` during build).

TypeScript compiles with `tsconfig.build.json` (extends `tsconfig.json` but enables emit). Target: ES2022, module: Node16, strict mode.

### Frontend Sub-Projects

Three independent Vite + React apps, each with their own `package.json` and `node_modules`:

| Source | Build Output | Purpose |
|--------|-------------|---------|
| `src-admin/` | `admin/` | Adapter settings UI (Material UI) |
| `src-login/` | `www/login/` | Login page |
| `src-www/` | `www/` | Welcome/intro page with adapter list |

### Web Server Stack

- **Express 5** with compression, body-parser, cookie-parser middleware
- **Passport.js** with LocalStrategy for authentication
- **express-session** with custom ioBroker Store
- **WebSocket** via `iobroker.socketio` or `iobroker.ws` (configurable)
- **`@iobroker/webserver`** handles SSL, Let's Encrypt, OAuth2

### Key Routes

- `GET /state/:stateId` - Read state value (returns plain value or JSON)
- `POST /state/:stateId` - Write state value (accepts text/plain or JSON body)
- `GET /adapter/:name/*` - Serve other adapter's admin files
- `GET /` - Welcome page (index.html with injected settings)
- `GET /config.json` - Web adapter settings for frontend consumption

### Extensions System

Other adapters register as web extensions via `webExtension` in their `io-package.json`. The `WebAdapter` loads them in `getExtensionsAndSettings()`, passing the Express app instance so they can add custom routes and middleware.

### Build Pipeline (`tasks.js`)

Uses `@iobroker/build-tools` for React builds with Vite, HTML patching, and file copying. The `prepublishOnly` script runs `node tasks` (full build) before npm publish.

## Configuration

- **Default port:** 8082
- **Adapter metadata:** `io-package.json` (adapter type, dependencies, default settings)
- **Node.js requirement:** >= 20
