import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CANONICAL_HOST = "autisense.imaginaerium.in";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  // Redirect amplifyapp.com → custom domain
  if (host.includes("amplifyapp.com")) {
    const url = new URL(request.url);
    url.host = CANONICAL_HOST;
    url.protocol = "https";
    return NextResponse.redirect(url, 301);
  }

  // ── Per-request CSP nonce ────────────────────────────────────────────
  // script-src uses a fresh nonce + 'strict-dynamic' (no 'unsafe-inline'):
  // only our nonced bootstrap and the scripts it loads may execute, which is
  // the real XSS-mitigation win. style-src deliberately KEEPS 'unsafe-inline'
  // because the app uses React inline style={{}} pervasively (a strict
  // style-src would block every inline style). 'wasm-unsafe-eval' is required
  // by onnxruntime-web. All other sources are preserved verbatim from the
  // former next.config.ts CSP. Reading the nonce in app/layout.tsx forces
  // dynamic rendering (a documented consequence of nonce-based CSP).
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.tile.openstreetmap.org https://unpkg.com https://img.youtube.com`,
    `connect-src 'self' https://overpass-api.de https://accounts.google.com https://oauth2.googleapis.com https://cdn.jsdelivr.net`,
    `font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com`,
    `media-src 'self' blob:`,
    `worker-src 'self' blob:`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self' https://accounts.google.com`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next.js reads the nonce from the request CSP header to auto-apply it to its
  // framework/runtime/page scripts during SSR.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Apply CSP to documents only — skip API, static assets, model files, and
      // next/link prefetches (which render no HTML and need no nonce).
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest|models/|logo.jpeg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
