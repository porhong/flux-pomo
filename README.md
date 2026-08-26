# Flux Pomo

Electron + React + TypeScript Pomodoro desktop app (electron-vite).

```bash
npm install
npm run dev
```

### Features

- Timer with focus / short break / long break cycles
- Settings dashboard (durations, auto-start)
- History with day / week / month views and summaries
- Local persistence via `electron-store`
- Auto-updates via GitHub Releases

### Portable builds (no install)

```bash
npm run build:win    # Windows portable .exe → dist/
npm run build:mac    # macOS .zip
npm run build:linux  # Linux AppImage
```

On Windows, run the generated `flux-pomo-*-portable.exe` directly — no installer.
