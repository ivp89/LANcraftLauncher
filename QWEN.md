# QWEN.md

Qwen Code context file for this repository.

**The single source of truth about the project is `CLAUDE.md`.** Read it before any non-trivial task: build commands, the Rust backend, Go sidecar, frontend architecture, and the LANCommander API contract are documented there. Keep it up to date whenever the architecture changes.

## Additional conventions

- Communicate with the user in Russian.
- Checks before finishing a task:
  - changes in `src/` → `npx tsc --noEmit` and `npx eslint .`
  - changes in `src-tauri/src/` → `cargo check` (inside `src-tauri`)
  - changes in `src-tauri/sidecar/` → `npm run sidecar:build` (rebuild the binaries)
- The **LANCommander backend server is an external project** — it does not live in this repo; the API contract defines the client side only.
- `src-tauri/binaries/` contains the built Go sidecar binaries (gitignored) — do not delete them; `tauri dev` / `tauri build` won't work without them.
