/*
 * Minimal preload. The renderer is the live web app loaded over HTTPS and needs
 * no privileged APIs, so we expose only a small read-only flag the web app can
 * use to detect it's running inside the desktop shell (e.g. to adjust UI later).
 * Kept sandbox-safe: contextBridge only, no Node exposure.
 */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("autisenseDesktop", {
  isDesktop: true,
  platform: process.platform,
});
