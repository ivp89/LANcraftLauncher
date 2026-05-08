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
| Rust check | `cd src-tauri && cargo check` |
| Production build | `npm run tauri build` |

## Architecture

This is a **Tauri v2** desktop app: a Rust backend (`src-tauri/`) communicates with a React frontend (`src/`) via Tauri's IPC (`invoke`/`emit`).

### Rust backend (`src-tauri/src/`)

Three Tauri command modules registered in `lib.rs`:

- **`discovery.rs`** — UDP broadcast to port 35891, collects `BeaconMessage` JSON responses (`{ Address, Name, Version }`) from LANCommander servers on the LAN
- **`install.rs`** — streams a game ZIP from `/api/Games/{id}/Download`, emits `download-progress` events to the frontend, then extracts to `{installDir}/{gameId}/`
- **`launcher.rs`** — spawns the game process via `tokio::process::Command`, calls `/api/Games/{id}/Started` before launch and `/api/Games/{id}/Stopped` after exit

### Frontend (`src/`)

**Data flow:** `pages/` → `hooks/` (TanStack Query) → `api/` → LANCommander REST API

**State (Zustand + tauri-plugin-store):**
- `authStore.ts` — JWT token (`accessToken`, `refreshToken`, `expiration`), persisted to `auth.json`
- `settingsStore.ts` — server URL, install directory, map of installed games `{ [gameId]: { installed, installPath } }`, persisted to `settings.json`

**API layer (`src/api/`):**
- `client.ts` — base `apiFetch<T>()` that auto-injects `Authorization: Bearer {token}` and `X-API-Version: 1.0.0`; also exports `thumbnailUrl()` / `mediaUrl()` helpers
- `auth.ts` — standalone auth functions (don't use `apiFetch` — no token needed for login)
- `games.ts` — library and game CRUD via `/api/Library` and `/api/Games`
- `types.ts` — all TypeScript interfaces matching LANCommander API models (`Game`, `Media`, `GameAction`, etc.)

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
- `GET /api/Media/{id}/Thumbnail` (no auth required)
