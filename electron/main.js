/*
 * AutiSense desktop wrapper (thin client).
 *
 * Loads the LIVE site (https://autisense.imaginaerium.in) in a single
 * BrowserWindow. Bundles no app code and no model — everything (incl. model
 * swaps) comes from the live deploy. Chromium gives us camera + threaded WASM
 * (ORT) + crossOriginIsolated for free, because the live site already sends
 * COOP/COEP. This file only adds the desktop-shell concerns:
 *   - grant camera/mic/geolocation for the app origin only
 *   - keep app navigations in-window, send external links to the system browser
 *   - work around Google's `disallowed_useragent` block: OAuth opens in the
 *     SYSTEM browser, returns via the `autisense://` deep link, and a one-time
 *     PKCE-protected code is exchanged for a session inside Electron's own jar
 *   - self-update from GitHub Releases (electron-updater)
 */
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const crypto = require("crypto");
const { autoUpdater } = require("electron-updater");

const APP_ORIGIN = "https://autisense.imaginaerium.in";
const APP_HOST = "autisense.imaginaerium.in";
const PROTOCOL = "autisense";

let mainWindow = null;
// Hand-off PKCE verifier, held in main-process memory between the OAuth start
// and the deep-link return. Never written to disk; single-use.
let handoffVerifier = null;

function base64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function focusMain() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

/** Open the desktop OAuth start URL in the system browser (avoids the in-window
 *  embedded-webview block). Sends a hand-off PKCE challenge; keeps the verifier. */
function startDesktopOAuth() {
  handoffVerifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(handoffVerifier).digest());
  const url = `${APP_ORIGIN}/api/auth/desktop/start?ch=${encodeURIComponent(challenge)}`;
  shell.openExternal(url);
}

/** Handle `autisense://auth?code=...` — exchange the one-time code (+ our PKCE
 *  verifier) for a session cookie, inside Electron's own BrowserWindow/jar. */
function handleDeepLink(link) {
  try {
    const u = new URL(link);
    const isAuth = u.host === "auth" || u.pathname.replace(/\//g, "") === "auth";
    if (!isAuth) return;
    const code = u.searchParams.get("code");
    if (!code || !handoffVerifier || !mainWindow) return;
    const exchangeUrl =
      `${APP_ORIGIN}/api/auth/desktop/exchange` +
      `?code=${encodeURIComponent(code)}&v=${encodeURIComponent(handoffVerifier)}`;
    handoffVerifier = null; // single use
    mainWindow.loadURL(exchangeUrl); // request comes from Electron's jar → __Host- cookie sets here
    focusMain();
  } catch (_) {
    /* malformed deep link — ignore */
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const ses = mainWindow.webContents.session;

  // Camera / mic / geolocation — granted ONLY for the app origin.
  const ALLOWED_PERMS = ["media", "geolocation"];
  ses.setPermissionRequestHandler((wc, permission, callback) => {
    const fromApp = (wc.getURL() || "").startsWith(APP_ORIGIN);
    callback(ALLOWED_PERMS.includes(permission) && fromApp);
  });
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    return ALLOWED_PERMS.includes(permission) && requestingOrigin === APP_ORIGIN;
  });

  // window.open / target=_blank → external links go to the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_ORIGIN + "/") || url === APP_ORIGIN) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Top-level navigations: intercept Google OAuth + push off-origin links out.
  const interceptNav = (event, url) => {
    if (/\/api\/auth\/google(?:$|[/?])/.test(url) || url.startsWith("https://accounts.google.com")) {
      event.preventDefault();
      startDesktopOAuth();
      return;
    }
    try {
      if (new URL(url).host !== APP_HOST) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch (_) {
      /* ignore */
    }
  };
  mainWindow.webContents.on("will-navigate", interceptNav);
  mainWindow.webContents.on("will-redirect", interceptNav);

  mainWindow.on("closed", () => { mainWindow = null; });
  mainWindow.loadURL(APP_ORIGIN);
}

// ─── Single instance (required for deep-link delivery on Windows/Linux) ───
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const link = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (link) handleDeepLink(link);
    else focusMain();
  });

  // macOS deep-link delivery
  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  app.whenReady().then(() => {
    // Register the custom protocol (dev needs the script path).
    if (process.defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }

    createWindow();
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
