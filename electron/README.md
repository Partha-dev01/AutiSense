# AutiSense desktop wrapper (thin Electron)

A thin Electron shell that loads the **live** site
(`https://autisense.imaginaerium.in`). It bundles **no app code and no model** —
the web app, models, and any model swap come from the live deploy, so the
installers below never need rebuilding when the app changes.

## Why Electron (and why thin)
The app needs **camera** + **threaded WASM (ONNX Runtime)** + **crossOriginIsolated**.
Electron is Chromium, the engine the PWA already runs on, so all three work as-is
(the live site sends COOP/COEP). Loading the live URL keeps the shell tiny and
makes model swaps a server-only change.

## What this shell adds
- Grants camera/mic/geolocation **only** for the app origin.
- Keeps app navigations in-window; sends external links to the system browser.
- **Google OAuth hand-off**: Google blocks sign-in inside embedded webviews
  (`disallowed_useragent`). So clicking "Sign in with Google" opens the system
  browser at `/api/auth/desktop/start`; after consent the browser returns via the
  `autisense://auth?code=...` deep link; Electron exchanges the one-time,
  PKCE-protected code at `/api/auth/desktop/exchange` to set the session cookie in
  its own jar. (Those two server routes live in the Next app and must be deployed
  for desktop sign-in to work; without them, "Continue without an account" still works.)
- Self-updates from GitHub Releases (`electron-updater`).

## Local dev
```sh
cd electron
npm install
npm start          # opens the window against the live site
```

## Build installers
```sh
npm run dist:win     # .exe (NSIS)        — run on Windows
npm run dist:linux   # .deb + AppImage    — run on Linux
npm run dist:mac     # .dmg               — run on macOS (signing+notarization for clean install)
```
`npm run publish` builds + uploads to the GitHub Release (used by CI). Each OS
target must build on its own OS — CI uses a windows/ubuntu/macos matrix.

## Known limitations
- **Unsigned installers** — no code-signing certificates yet (Windows
  Authenticode; Apple Developer ID + notarization), so first run triggers
  SmartScreen / Gatekeeper warnings. One-time workaround steps are in
  [`../docs/INSTALL.md`](../docs/INSTALL.md).
