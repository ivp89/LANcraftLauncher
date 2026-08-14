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
| Build tsnet sidecar binaries | `npm run sidecar:build` |
| Production build | `npm run tauri build` |

The tsnet sidecar binaries must exist in `src-tauri/binaries/` before `tauri dev` / `tauri build` (declared in `externalBin` in `tauri.conf.json`). `npm run sidecar:build` is a PowerShell script that cross-compiles the Go sidecar for windows/amd64 and linux/amd64 with `CGO_ENABLED=0`; rerun it after changing `src-tauri/sidecar/`.

Path alias: `@/` maps to `src/` (configured in both `tsconfig.json` and `vite.config.ts`).

## Architecture

This is a **Tauri v2** desktop app: a Rust backend (`src-tauri/`) communicates with a React frontend (`src/`) via Tauri's IPC (`invoke`/`emit`). A Go sidecar (`src-tauri/sidecar/`) optionally joins the machine to a Headscale tailnet so LAN games can be played across networks.

### Rust backend (`src-tauri/src/`)

Modules registered as Tauri commands in `lib.rs`:

- **`discovery.rs`** — UDP broadcast to port 35891, collects `BeaconMessage` JSON responses (`{ Address, Name, Version }`) from LANCommander servers on the LAN
- **`install.rs`** — streams a game ZIP from `/api/Games/{id}/Download`, emits `download-progress` and `extract-progress` events to the frontend, then extracts to `{installDir}/{gameId}/`; supports cancellation via `DownloadCancellations` shared state
- **`launcher.rs`** — spawns the game process via `tokio::process::Command`, calls `/api/Games/{id}/Started` before launch and `/api/Games/{id}/Stopped` after exit; tracks PIDs in `RunningGames` shared state; expands `{InstallDir}`, `{VarName}`, and `%ENV_VAR%` in action arguments
- **`saves.rs`** — ZIPs save directories and uploads/downloads via multipart form to `/api/Saves`
- **`media_cache.rs`** — `get_cached_media` downloads media (thumbnails / full images) to `$APPCACHE/media/{mediaId}-{crc32}.ext` and returns the local path. The crc32 key means a server-side media update busts the cache (stale copies are evicted); if a fresh download fails (offline), any older cached file for that media id is served as fallback
- **`tsnet.rs`** — manages the `tsnet-sidecar` Go process: `tsnet_connect` spawns it with config via env vars only (`TSNET_CONTROL_URL`, `TSNET_AUTH_KEY`, `TSNET_HOSTNAME`, `TSNET_STATE_DIR` — never CLI args, so secrets stay out of process listings), reads the `PORT=<n>` handshake from stdout, then polls the sidecar's `GET /status` every 1.5s and re-emits changes to the frontend as `tsnet-status-changed` events. Also `tsnet_disconnect`, `tsnet_status`, and `tsnet_forward` / `tsnet_unforward` / `tsnet_list_forwards` (proxied to the sidecar's `/forward` and `/forwards` endpoints). A `generation` counter invalidates stale background tasks after reconnects

**Shared Tauri state** (managed via `.manage()`, accessed as `State<'_, T>` in commands):
- `DownloadCancellations(Mutex<HashMap<String, Arc<AtomicBool>>>)` — per-game cancellation flags
- `RunningGames(Arc<Mutex<HashMap<String, u32>>>)` — game_id → PID
- `TsnetState(Arc<Mutex<TsnetProcess>>)` — sidecar child handle, control port, generation counter

All Rust commands return `Result<T, String>` — errors serialize as strings over the Tauri bridge.

### Go sidecar (`src-tauri/sidecar/`)

`tsnet-sidecar` connects to a Headscale control server using `tailscale.com/tsnet` and exposes a loopback HTTP control API. It prints `PORT=<n>` as its first stdout line so the Rust parent can find it before the (slow) tailnet connection completes. Endpoints: `GET /status` (state / tailscale_ip / hostname / error / peers — mirrored 1:1 by `TsnetStatus` in Rust, which layers synthetic "disconnected"/"stopped" states on top), `POST /forward`, `DELETE /forward`, `GET /forwards`.

### Frontend (`src/`)

**Data flow:** `pages/` → `hooks/` (TanStack Query) → `api/` → LANCommander REST API

**State (Zustand + tauri-plugin-store):**
- `authStore.ts` — JWT auth (`token`, `refreshToken`, `expiration`), persisted to `auth.json`; call `loadFromStore()` on app mount
- `settingsStore.ts` — server URL, install directory, map of installed games `{ [gameId]: { installed, installPath, version? } }`, local alias, Headscale URL + auth key; persisted to `settings.json`; default install dir is `C:\Games` (Windows) or `~/Games`. On load, installed games whose folder no longer exists are dropped (`path_exists` check)
- `connectivityStore.ts` — `isOnline` flag, refreshed by calling `/api/Auth/Validate` with the current token
- `gameCacheStore.ts` — persistent offline cache (`game-cache.json`) of games list, depot, per-game details and actions
- `gameStateStore.ts` — ephemeral (non-persisted) sets of currently downloading / running game ids

**Hooks:**
- `useGames.ts` — TanStack Query wrappers; every query is gated on `!!token && isOnline` and feeds successful results into `gameCacheStore`, using the cache as `placeholderData` so the UI keeps working offline
- `useConnectivity.ts` — runs `checkConnectivity()` on mount and every 30s
- `useCachedMedia.ts` — resolves a `Media` item to a disk-cached image via the `get_cached_media` command + `convertFileSrc`; falls back to the direct server URL if caching fails

**API layer (`src/api/`):**
- `client.ts` — base `apiFetch<T>()` that auto-injects `Authorization: Bearer {token}` and `X-API-Version: 1.0.0`; auto-refreshes the JWT on 401 (one retry) and clears auth if refresh fails; also exports `thumbnailUrl()` / `mediaUrl()` helpers
- `auth.ts` — standalone auth functions using bare `fetch` (no token needed for login/register): Login, Register, Validate, Refresh, Logout
- `games.ts` — library and game CRUD via `/api/Library` and `/api/Games`, plus `/api/Depot`
- `profile.ts` — profile fetch and alias change
- `types.ts` — all TypeScript interfaces matching LANCommander API models (`Game`, `Media`, `GameAction`, `SavePath`, `DepotResult`, etc.); `MediaType` and `GameType` are numeric enums

**Routing:** `App.tsx` wraps protected routes; unauthenticated users are redirected to `/login`. `OfflineBanner` shows when `isOnline` is false.

### Offline mode

Connectivity is probed every 30s via `/api/Auth/Validate`. When offline: all TanStack Query hooks are disabled (`enabled: ... && isOnline`), pages render from `gameCacheStore` placeholder data, media comes from the Rust disk cache (stale-but-usable fallback), and installed games stay launchable. Anything mutating server state (install, saves upload, alias change) requires being online.

### LANCommander API contract

All authenticated requests require:
```
Authorization: Bearer {accessToken}
X-API-Version: 1.0.0
```

Key endpoints used:
- `POST /api/Auth/Login` / `Register` / `Refresh` / `Logout`, `GET /api/Auth/Validate` → `{ accessToken, refreshToken, expiration }`
- `GET /api/Library` → `EntityReference[]`; `POST /api/Library/AddToLibrary/{gameId}` / `RemoveFromLibrary/{gameId}`
- `GET /api/Games` / `GET /api/Games/{id}` / `GET /api/Games/{id}/CheckForUpdate?version=`
- `GET /api/Games/{id}/Download` → binary ZIP stream
- `GET /api/Games/{id}/Actions` → `GameAction[]`
- `GET /api/Games/{id}/Started` / `Stopped`
- `POST /api/Saves` / `GET /api/Saves/{id}/Download`
- `GET /api/Archives/Contents/{gameId}/{version}` → archive manifest for validation
- `GET /api/Depot`
- `GET /api/Media/{id}/Thumbnail` / `GET /api/Media/{id}/Download?fileId=` (no auth required)
- `GET /api/Profile` / `PUT /api/Profile/ChangeAlias`

## CI/Release

`.github/workflows/release.yml` runs on `v*` tags: builds Windows + Ubuntu (no macOS) via `tauri-apps/tauri-action` and publishes a draft GitHub release. **Known gap:** the workflow never builds the Go sidecar, and `src-tauri/binaries/` is gitignored — so release builds fail at bundling `externalBin` unless the workflow gains a Go setup + sidecar build step (or the binaries get committed). Locally, run `npm run sidecar:build` before any `tauri dev` / `tauri build`.
