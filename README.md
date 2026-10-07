# Floating Stopwatch

A small floating stopwatch widget for the desktop, built with [Tauri v2](https://v2.tauri.app/) (Rust shell, TypeScript + Vite frontend). Runs on Windows and Linux Mint, built separately on each OS.

## Features

- `HH:MM:SS` stopwatch, counting up from `00:00:00`
- Start / Pause / Resume and Reset buttons. The main button is tinted green when it will start and amber when it will pause, and a status dot pulses green while running
- Frameless, transparent, always on top and draggable (drag by the digits or any empty area)
- Time is measured with `performance.now()`, so time the computer spends asleep is not counted
- Keyboard: **Enter** toggles pause/resume when the widget is focused, **Esc** doesn't close it.
- A small **×** appears on hover to close the app
- Running indicator outside the window:
  - **Windows:** green badge on the taskbar icon while running
  - **Linux:** tray icon (gray stopwatch, green while running) with a "Running" / "Paused" line in its menu. For active state, `TRAY_STYLE` in `src/main.ts` switches between a fully green stopwatch (`"green"`) and a stopwatch with a green dot (`"dot"`)

## Prerequisites

### Windows

Run in PowerShell. Skip anything that is already installed (check with the commands at the end).

```powershell
# C++ Build Tools (large download)
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

# WebView2 (usually already present on Windows 10/11)
winget install Microsoft.EdgeWebView2Runtime

# Rust
winget install --id Rustlang.Rustup
rustup default stable-msvc

# Node.js
winget install OpenJS.NodeJS.LTS
```

Close and reopen the terminal after installing, then check:

```powershell
rustc --version; cargo --version; node --version; npm --version
```

Rust must be recent (Tauri v2 will not build with old toolchains). If `rustc` reports an old version, run `rustup self update` and `rustup update stable`.

### Linux Mint

Requires Mint 21 or newer, on an **X11** session (`echo $XDG_SESSION_TYPE` should print `x11`). Developed and tested on Mint 22.3.

```bash
# System libraries
sudo apt update
sudo apt install -y git libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Rust (close and reopen the terminal afterwards)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js 22 (Mint's own apt package is too old)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Check:

```bash
rustc --version; cargo --version; node --version; npm --version
```

## Run in development

```bash
git clone <repo-url>
cd floating-timer-tauri
npm install
npm run tauri dev
```

The first run compiles all Rust dependencies and takes several minutes. Later runs are fast.

Use `npm run tauri dev`, not `npm run dev`. The latter only starts the Vite frontend in a browser, without the native window.

## Build

| Command               | Output                                |
| --------------------- | ------------------------------------- |
| `npm run build:win`   | NSIS installer, plus the plain `.exe` |
| `npm run build:linux` | `.deb` package, plus the plain binary |

These are shortcuts for `tauri build --bundles nsis` and `tauri build --bundles deb`. Use `tauri build --no-bundle` to build only the executable.

Output locations (the terminal prints the exact paths at the end of the build):

- **Windows:** `src-tauri\target\release\floating-timer-tauri.exe` and `src-tauri\target\release\bundle\nsis\floating-timer-tauri_0.1.0_x64-setup.exe`
- **Linux:** `src-tauri/target/release/bundle/deb/floating-timer-tauri_0.1.0_amd64.deb`

Install and remove on Linux:

```bash
sudo apt install ./src-tauri/target/release/bundle/deb/floating-timer-tauri_0.1.0_amd64.deb
sudo apt remove floating-timer-tauri
```

The plain `.exe` runs on its own on any Windows machine that has WebView2. The installer is only needed for a Start Menu entry, an uninstaller, or machines without WebView2. Windows SmartScreen may warn about the unsigned installer; this only matters when sharing it.

## Project layout

```
assets/app-icon.png          source image for the app icon
index.html                   widget markup
src/main.ts                  stopwatch logic, badge, tray icon
src/styles.css               widget styling
src-tauri/tauri.conf.json    window and bundle config (Windows values)
src-tauri/tauri.linux.conf.json  Linux window override
src-tauri/capabilities/      permissions granted to the frontend
src-tauri/icons/             generated icons
```

## Configuration notes

### Window size

The window size is in `src-tauri/tauri.conf.json` (`width`, `height`, in logical pixels). Changes need a restart of `npm run tauri dev`.

On Linux, `src-tauri/tauri.linux.conf.json` overrides the window entry. A Linux window with `resizable: false` came out as a square regardless of the configured size, so the Linux file uses `resizable: true` and locks the size by setting `minWidth` / `maxWidth` / `minHeight` / `maxHeight` equal to `width` / `height`. When changing the Linux size, change all six values together.

The Linux file repeats the whole window entry on purpose: platform config files are merged as a JSON Merge Patch, which replaces arrays instead of merging them.

If the digits get clipped, increase the width or lower `.time { font-size }` in `src/styles.css`. Mint's fallback font is wider than Windows' Consolas.

### Changing the app icon

1. Replace `assets/app-icon.png` with a square PNG, ideally 1024x1024 with a transparent background.
2. Generate all sizes and formats:
   ```bash
   npm run tauri icon assets/app-icon.png
   ```
3. Delete the mobile icon folders it creates, since this is a desktop-only app:
   `src-tauri/icons/android` and `src-tauri/icons/ios`.
4. Force a rebuild so the new icon is embedded:
   ```bash
   cd src-tauri
   cargo clean -p floating-timer-tauri
   cd ..
   npm run tauri dev
   ```

If Windows still shows the old icon, it is cached. Unpin the old taskbar shortcut and restart Explorer:

```powershell
taskkill /f /im explorer.exe; start explorer.exe
```

## Cleaning up disk space

Debug builds are large (around 4-5 GB, mostly `src-tauri/target/debug/deps`). It is all rebuilt by the next `npm run tauri dev`, so clean up when the project is idle.

| Command             | Removes                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| `npm run clean`     | `src-tauri/target` (all Rust build output)                                     |
| `npm run clean:all` | `src-tauri/target` and `node_modules` (run `npm install` before working again) |

Close the app and stop `tauri dev` first. On Windows a running `.exe` is locked and the clean will fail.

Top-level folder sizes (PowerShell, from the project root; run it inside `src-tauri` or `src-tauri/target/debug` to go deeper):

```powershell
Get-ChildItem -Directory -Force | ForEach-Object {
  $s = (Get-ChildItem $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  "{0,8:N0} MB  {1}" -f ($s/1MB), $_.Name
}
```

On Linux: `du -h --max-depth=1 | sort -h`

## Troubleshooting

- **Linux: always-on-top does nothing.** You are probably on Wayland. Use an X11 session.
- **Linux: blank or white window (mostly NVIDIA).** WebKitGTK and the graphics driver can disagree. Try starting with `WEBKIT_DISABLE_DMABUF_RENDERER=1`.
- **Linux: no transparency.** A compositor is required. Cinnamon has one on by default.
- **Linux: `apt update` fails and the Node installer stops.** A third-party apt repository (for example one with an expired signing key) makes `apt update` return an error, and the NodeSource script treats that as fatal. Fix or disable that repository, then run the installer again.
- **Linux: duplicate tray icons while developing.** Reloading the page can leave old icons. Stop the app (`pkill -f floating-timer-tauri`) and restart. If ghost icons remain, restart Cinnamon with Ctrl+Alt+Esc.
- **Window opens at the wrong size on Linux.** Check that `src-tauri/tauri.linux.conf.json` exists and still repeats the full window entry.
- **Windows: installer warning.** SmartScreen flags unsigned installers. On your own machine choose "More info", then "Run anyway".
