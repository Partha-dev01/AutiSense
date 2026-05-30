"use client";

import { useEffect } from "react";

// Registers the hand-rolled /sw.js (see public/sw.js) so AutiSense is an
// installable, offline-capable PWA. Renders nothing. Registration is skipped in
// dev to avoid caching churn during local work.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* registration failure is non-fatal — app works without the SW */
      });
    };
    // Register after load so the SW install doesn't compete with first paint.
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
