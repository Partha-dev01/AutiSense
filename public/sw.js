/*
 * AutiSense service worker (hand-rolled, bundler-agnostic).
 *
 * Next 16 builds with Turbopack, which doesn't run Workbox/Serwist's webpack
 * SW step — so this is a plain, dependency-free SW served as a static file.
 * It makes the app installable + offline-capable without touching the build.
 *
 * Strategy:
 *  - Navigations: network-first, fall back to cached shell when offline. Using
 *    network-first (not cache-first) means the server's per-request nonce CSP +
 *    COOP/COEP headers are always reapplied online (required for ORT WASM
 *    threads / crossOriginIsolated).
 *  - ONNX models (/models/*.onnx): cache-first + ignore search (so the ~47 MB
 *    download is reused offline after first run).
 *  - Next static assets (/_next/static, fonts): cache-first (content-hashed).
 *  - Everything else (APIs, cross-origin CDN, etc.): pass through to network.
 */
const VERSION = "v1";
const SHELL_CACHE = `autisense-shell-${VERSION}`;
const STATIC_CACHE = `autisense-static-${VERSION}`;
const MODEL_CACHE = `autisense-models-${VERSION}`;
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch (_) {
        /* offline at install — shell caches on first online navigation */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, STATIC_CACHE, MODEL_CACHE]);
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("autisense-") && !keep.has(k)).map((k) => caches.delete(k)),
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // 1) Navigations → network-first (keeps fresh CSP/COOP/COEP), offline → shell
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;
          return await fetch(req);
        } catch (_) {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
    return;
  }

  if (!sameOrigin) return; // CDN (jsdelivr wasm), Google OAuth, OSM, etc. → network

  // 2) ONNX models → cache-first (large, immutable per filename)
  if (url.pathname.startsWith("/models/") && url.pathname.endsWith(".onnx")) {
    event.respondWith(cacheFirst(req, MODEL_CACHE, { ignoreSearch: true }));
    return;
  }

  // 3) Next build assets + self-hosted fonts → cache-first (content-hashed)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // 4) Everything else same-origin (incl. /api/*) → straight to network
});

async function cacheFirst(req, cacheName, matchOpts) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, matchOpts);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok && (res.status === 200 || res.type === "opaque")) {
    cache.put(req, res.clone());
  }
  return res;
}
