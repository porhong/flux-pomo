# Flux Pomo

A focused Pomodoro desktop timer built with **Electron**, **React**, and **TypeScript** (via [electron-vite](https://electron-vite.org/)).

Flux Pomo keeps deep work simple: a clean timer, an always-on-top floating chip, optional focus music from a local folder, session history, and global shortcuts — all stored locally on your machine.

---

## Features

### Timer

- Focus / short break / long break cycles
- Start, pause, reset, and skip
- Configurable durations and sessions-until-long-break
- Optional auto-start for focus and breaks
- Sound cues for start, pause, and rest

### Floating mini timer

- Compact always-on-top chip (minimize from the title bar)
- Hover to expand controls and status
- Native-feel drag without DPI drift
- Click-through transparent overlay when collapsed
- Global shortcut to toggle full app ↔ floating mode

### Focus music

- Enable a playlist from a **local folder** (flat scan)
- Supported formats: `mp3`, `m4a`, `aac`, `wav`, `ogg`, `flac`
- Auto-play during **running focus**; pause on timer pause and breaks
- Smooth fade-in after the start SFX; fade-out before pause/rest SFX
- Compact controller under Reset / Skip (prev, play/pause, next, volume)
- Music continues while navigating Timer / History / Settings

### History

- Day / week / month views
- Session list, summary strip, and charts
- Persisted with `electron-store`

### Settings & system

- Durations, auto-start, focus music, and shortcuts
- Global shortcuts (when enabled):
  - **Ctrl/⌘ + Shift + Space** — start / pause timer
  - **Ctrl/⌘ + Shift + X** — show full app / minimize to floating timer
- Custom in-app quit confirmation
- Fixed window size (non-resizable)
- System tray with show / compact / quit
- Update checks against GitHub Releases (portable download)

---

## Tech stack

| Layer         | Choice                                       |
| ------------- | -------------------------------------------- |
| Desktop shell | Electron 44                                  |
| Build tooling | electron-vite + Vite 7                       |
| UI            | React 19 + React Router 7                    |
| State         | Zustand                                      |
| Persistence   | electron-store                               |
| Styling       | CSS variables + app stylesheet               |
| Packaging     | electron-builder (portable / zip / AppImage) |
| Updates       | GitHub Releases API (portable download)      |
| CI            | GitHub Actions release workflow              |

**Requirements:** Node.js **≥ 22.12** and npm. (Python 3 + Pillow only if you regenerate icons from the WebP logo.)

---

## Project structure

```
flux-pomo/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # App lifecycle, IPC registration
│   │   ├── windows.ts        # Main + mini windows, tray, quit
│   │   ├── music.ts          # Folder pick, track list, flux-music://
│   │   ├── shortcuts.ts      # Global accelerators
│   │   ├── store.ts          # Settings + session persistence
│   │   ├── pomodoro-ipc.ts   # Settings / sessions IPC
│   │   ├── paths.ts          # User data path
│   │   └── updater.ts        # Auto-update
│   ├── preload/              # contextBridge API (typed, no raw ipc)
│   ├── renderer/             # React UI
│   │   └── src/
│   │       ├── pages/        # Timer, History, Settings, Mini
│   │       ├── components/   # Timer, history, layout, updater
│   │       ├── stores/       # Zustand (timer, settings, music)
│   │       ├── hooks/        # Timer bridge, focus music, quit prompt
│   │       └── lib/          # Sounds, music player, time helpers
│   └── shared/               # Types + IPC channel contracts
├── resources/                # Logo, sounds, assets
├── build/                    # electron-builder icon (generated)
├── scripts/generate-icon.mjs # Optional: refresh PNG/ICO from logo
├── scripts/check-icons.mjs   # Verify committed icons before build
├── electron-builder.yml
└── electron.vite.config.ts
```

---

## Architecture notes

### Process model

- **Main** owns windows, tray, native dialogs, file access, and global shortcuts.
- **Preload** exposes a narrow `window.api` surface via `contextBridge` (sandbox + context isolation on).
- **Renderer** owns the timer ticker, UI, and audio playback.
- Shared contracts live in `src/shared/` so channel names and types stay in sync.

### Timer sync

- The **main window** owns the countdown.
- State is published to the **mini window** over IPC (`timer:state`).
- Mini countdown uses `endsAt` locally to avoid per-tick chatter.

### Focus music security

- Tracks are served through a privileged `flux-music://` protocol.
- Only files under the user-selected music folder are allowed (path traversal rejected).

### Persistence

- Settings and sessions are stored under the app user-data directory (e.g. `%APPDATA%\FluxPomo` on Windows).
- Settings are clamped/normalized on read/write.

---

## Getting started

```bash
# Clone
git clone https://github.com/porhong/flux-pomo.git
cd flux-pomo

# Install
npm install

# Develop (hot reload)
npm run dev
```

Open the app, set durations in **Settings**, optionally pick a music folder, enable shortcuts, and **Save**.

---

## Scripts

| Command                  | Purpose                                 |
| ------------------------ | --------------------------------------- |
| `npm run dev`            | Development with HMR                    |
| `npm run start`          | Preview built output in Electron        |
| `npm run typecheck`      | Typecheck main + renderer               |
| `npm run lint`           | ESLint                                  |
| `npm run format`         | Prettier                                |
| `npm run icons:check` | Verify committed `build/icon.*` files exist |
| `npm run icons:generate` | Regenerate PNG/ICO from the logo (optional) |
| `npm run icons:apply-win` | Embed `build/icon.ico` into Windows `.exe` after package |
| `npm run build`          | Icons + typecheck + production bundle   |
| `npm run build:win`      | Windows portable `.exe` → `dist/`       |
| `npm run build:mac`      | macOS `.zip`                            |
| `npm run build:linux`    | Linux AppImage                          |
| `npm run build:unpack`   | Unpackaged dir build (debug packaging)  |

### Icons (pre-rendered)

Packaging uses **committed** icons under `build/` — release CI does **not** regenerate them.

| File | Purpose |
|------|---------|
| `build/icon.ico` | Windows portable / Explorer (multi-size) |
| `build/icon.png` | Linux / general packaging |
| `resources/icon.png` | Runtime window icon |

`npm run build` only checks that these files exist (`icons:check`).

To refresh icons after changing the logo (optional; needs Python 3 + Pillow):

```bash
pip install pillow
npm run icons:generate
git add build/icon.ico build/icon.png resources/icon.png
```

After a Windows portable build, `icons:apply-win` embeds the committed `.ico` into the `.exe` files (does not re-render the icon).

---

## Portable builds

```bash
npm run build:win    # Windows portable .exe
npm run build:mac    # macOS zip
npm run build:linux  # Linux AppImage
```

Artifacts land in `dist/`. On Windows, run `flux-pomo-*-portable.exe` directly — no installer.

---

## GitHub Releases (CI)

Pushing a version tag builds the Windows portable app and attaches it to a GitHub Release.

1. Bump `version` in `package.json` (e.g. `0.2.0`)
2. Commit the bump
3. Create and push a matching tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

4. GitHub Actions (`.github/workflows/release.yml`) runs on `windows-latest`, builds `flux-pomo-0.2.0-portable.exe`, and publishes the Release

You can also run the workflow manually (`workflow_dispatch`) and pass the same `vX.Y.Z` tag. The tag version **must** match `package.json`.

Users download the portable `.exe` from the [Releases](https://github.com/porhong/flux-pomo/releases) page.

### In-app updates (portable)

Packaged builds check GitHub Releases on launch and from **Settings → Updates**.

When a newer version exists, **Download update** opens the portable `.exe` (or release page). Close Flux Pomo, replace the old executable with the new file, and relaunch. Silent self-replace is not supported for portable apps.

---

## Usage guide

### Everyday flow

1. Start a focus session from the timer (or global shortcut).
2. Minimize to the floating chip when you want the timer out of the way.
3. Hover the chip for controls; drag to reposition.
4. Press **Ctrl/⌘ + Shift + X** to jump back to the full app (and again to compact).

### Focus music

1. **Settings → Focus music → Enable**
2. Browse to a folder of audio files
3. Adjust volume and **Save**
4. Music starts with running focus (after the start sound cue)

### Quit

- Title-bar close and tray **Quit** open a themed confirmation dialog before exiting.

---

## Configuration defaults

| Setting                   | Default                        |
| ------------------------- | ------------------------------ |
| Focus                     | 25 min                         |
| Short break               | 5 min                          |
| Long break                | 15 min                         |
| Sessions until long break | 4                              |
| Auto-start breaks / focus | off                            |
| Global shortcuts          | off                            |
| Timer toggle              | `CommandOrControl+Shift+Space` |
| Window toggle             | `CommandOrControl+Shift+X`     |
| Focus music               | off                            |
| Music volume              | 50%                            |

---

## Development best practices

### Security

- Keep `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
- Never expose raw `ipcRenderer` to the renderer — extend `src/preload/index.ts` and `src/shared/ipc.ts` together.
- Validate / clamp all settings in the main store before persisting.
- Prefer scoped custom protocols for local media over disabling `webSecurity`.

### Code organization

- Put cross-process types and channel names in `src/shared/`.
- Prefer small Zustand stores over prop drilling for timer / settings / music.
- Keep one-shot SFX (`sounds.ts`) separate from looping BGM (`musicPlayer.ts`).
- Prefer high-level CSS tokens in `tokens.css` for color and type.

### Quality gates

- Run `npm run typecheck` before commits that touch IPC or stores.
- Run `npm run lint` / `npm run format` for consistency.
- Packaging always regenerates icons and typechecks (`npm run build`).

### UX guidelines for this app

- Fixed window size — design for ~480×720, not fluid dashboards.
- Prefer compact vertical rhythm on the timer page (tight groups, not large empty stretch).
- Matcha for focus accents; amber for breaks.
- Brand mark belongs in the title bar / packaging; avoid repeating large logos in the timer hero.

---

## Troubleshooting

| Issue                          | What to try                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Global shortcuts do nothing    | Enable them in Settings, Save, and restart if the OS held the binding                         |
| Shortcut already in use        | Choose another key combo; two shortcuts cannot share the same accelerator                     |
| Music won’t start              | Pick a folder with supported audio, enable music, click Start once (autoplay needs a gesture) |
| Floating chip missing          | Use title-bar Minimize (not OS minimize); or press the window toggle shortcut                 |
| Icon missing in packaged build | Ensure `build/icon.ico` is committed; run `npm run icons:generate` only if regenerating from the logo |

---

## License

MIT © [porhong](https://github.com/porhong)

---

## Links

- Repository: [github.com/porhong/flux-pomo](https://github.com/porhong/flux-pomo)
- Releases: [github.com/porhong/flux-pomo/releases](https://github.com/porhong/flux-pomo/releases)
