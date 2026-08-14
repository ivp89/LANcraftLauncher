# LANCRAFT Launcher

Кастомный лаунчер для LANCommander на базе Tauri v2 + React + TypeScript.

## Требования

- **Node.js** (LTS) и npm
- **Rust** — через [rustup](https://win.rustup.rs) (Windows) или [rustup.rs](https://rustup.rs) (macOS/Linux)
- **Windows:** Microsoft C++ Build Tools — [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) с workload **"Desktop development with C++"**, плюс [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (обычно уже установлен на Win10/11)
- **macOS/Linux:** см. [требования Tauri](https://tauri.app/start/prerequisites/)

После установки Rust перезапусти терминал, чтобы `cargo`/`rustc` попали в PATH.

## Установка и запуск

```bash
npm install
npm run tauri dev
```

На macOS/Linux, если `cargo` не подхватился в текущей сессии:

```bash
. "$HOME/.cargo/env" && npm run tauri dev
```

## Команды

| Задача | Команда |
|---|---|
| Dev-режим (Tauri + Vite) | `npm run tauri dev` |
| Только фронтенд (Vite) | `npm run dev` |
| Проверка типов | `npx tsc --noEmit` |
| Линт | `npx eslint .` |
| Проверка Rust-кода | `cd src-tauri && cargo check` |
| Продакшн-сборка | `npm run tauri build` |
