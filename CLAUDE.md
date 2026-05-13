# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Rust must be in PATH before running Tauri commands:
```bash
. "$HOME/.cargo/env"
```

| Task | Command |
|------|---------|
| Dev mode (Tauri + Vite) | `npm run tauri dev` |
| Frontend only (Vite) | `npm run dev` |
| TypeScript check | `npx tsc --noEmit` |
| Lint | `npx eslint .` |
| Rust check | `cd src-tauri && cargo check` |
| Production build | `npm run tauri build` |

Path alias: `@/` maps to `src/` (configured in both `tsconfig.json` and `vite.config.ts`).

## Architecture

This is a **Tauri v2** desktop app: a Rust backend (`src-tauri/`) communicates with a React frontend (`src/`) via Tauri's IPC (`invoke`/`emit`).

### Rust backend (`src-tauri/src/`)

Modules registered as Tauri commands in `lib.rs`:

- **`discovery.rs`** — UDP broadcast to port 35891, collects `BeaconMessage` JSON responses (`{ Address, Name, Version }`) from LANCommander servers on the LAN
- **`install.rs`** — streams a game ZIP from `/api/Games/{id}/Download`, emits `download-progress` and `extract-progress` events to the frontend, then extracts to `{installDir}/{gameId}/`; supports cancellation via `DownloadCancellations` shared state
- **`launcher.rs`** — spawns the game process via `tokio::process::Command`, calls `/api/Games/{id}/Started` before launch and `/api/Games/{id}/Stopped` after exit; tracks PIDs in `RunningGames` shared state; expands `{InstallDir}`, `{VarName}`, and `%ENV_VAR%` in action arguments
- **`saves.rs`** — ZIPs save directories and uploads/downloads via multipart form to `/api/Saves`
- **`scripts.rs`** — fetches and executes PowerShell scripts from the server (Windows-only)

**Shared Tauri state** (managed via `.manage()`, accessed as `State<'_, T>` in commands):
- `DownloadCancellations(Mutex<HashMap<String, Arc<AtomicBool>>>>)` — per-game cancellation flags
- `RunningGames(Arc<Mutex<HashMap<String, u32>>>)` — game_id → PID

All Rust commands return `Result<T, String>` — errors serialize as strings over the Tauri bridge.

### Frontend (`src/`)

**Data flow:** `pages/` → `hooks/` (TanStack Query) → `api/` → LANCommander REST API

**State (Zustand + tauri-plugin-store):**
- `authStore.ts` — JWT token (`accessToken`, `refreshToken`, `expiration`), persisted to `auth.json`; call `loadFromStore()` on app mount
- `settingsStore.ts` — server URL, install directory, map of installed games `{ [gameId]: { installed, installPath } }`, persisted to `settings.json`; default install dir is `C:\Games` (Windows) or `~/Games`

**API layer (`src/api/`):**
- `client.ts` — base `apiFetch<T>()` that auto-injects `Authorization: Bearer {token}` and `X-API-Version: 1.0.0`; also exports `thumbnailUrl()` / `mediaUrl()` helpers
- `auth.ts` — standalone auth functions (don't use `apiFetch` — no token needed for login)
- `games.ts` — library and game CRUD via `/api/Library` and `/api/Games`
- `profile.ts` — profile fetch and alias change
- `types.ts` — all TypeScript interfaces matching LANCommander API models (`Game`, `Media`, `GameAction`, `SavePath`, etc.); `MediaType` and `GameType` are numeric enums

**Routing:** `App.tsx` wraps protected routes; unauthenticated users are redirected to `/login`.

### LANCommander API contract

All authenticated requests require:
```
Authorization: Bearer {accessToken}
X-API-Version: 1.0.0
```

Key endpoints used:
- `POST /api/Auth/Login` → `{ accessToken, refreshToken, expiration }`
- `GET /api/Library` → `EntityReference[]`
- `GET /api/Games` / `GET /api/Games/{id}`
- `GET /api/Games/{id}/Download` → binary ZIP stream
- `GET /api/Games/{id}/Actions` → `GameAction[]`
- `GET /api/Games/{id}/Started` / `Stopped`
- `POST /api/Saves` / `GET /api/Saves/{id}/Download`
- `GET /api/Archives/Contents/{gameId}/{version}` → archive manifest for validation
- `GET /api/Media/{id}/Thumbnail` (no auth required)
- `GET /api/Profile` / `PUT /api/Profile/ChangeAlias`
