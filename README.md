# Flux Pomo

Electron + React + TypeScript desktop app (electron-vite).

```bash
npm install
npm run dev
```

```bash
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

### Auto-updates

Uses `electron-updater` with GitHub Releases (`publish.provider: github`).

1. Bump `version` in `package.json`
2. Build and publish a release (`electron-builder --publish always` or GitHub Actions)
3. Packaged apps check GitHub for newer releases on launch and via **Check for updates**
