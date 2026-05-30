/**
 * Detects the best available ONNX Runtime backend for the current browser.
 *
 * Prefers WebGPU when available (significantly faster on modern GPUs),
 * falls back to WASM (universally supported).
 *
 * The result is cached so that multiple engine init() calls don't each
 * trigger a separate GPU adapter request.
 */

import * as ort from "onnxruntime-web";

// ── WASM configuration ─────────────────────────────────────────────────
// Self-host ONNX Runtime's WASM binary + loader from public/ort-wasm/
// instead of a CDN. ORT treats this string as a directory prefix and
// resolves BOTH ort-wasm-simd-threaded.jsep.mjs (the pthread loader) and
// ort-wasm-simd-threaded.jsep.wasm from it; the spawned thread workers
// inherit the same path. Serving same-origin is friendlier to COEP
// credentialless than a cross-origin CDN, removes a third-party runtime
// dependency (offline/FOSS + tighter CSP), and still side-steps the old
// Next/Turbopack worker-bundling issue (the files are served verbatim from
// public/, untouched by the bundler). Vendored from
// node_modules/onnxruntime-web@1.24.2/dist — keep in sync on any upgrade.
ort.env.wasm.wasmPaths = "/ort-wasm/";

// Only enable multi-threading when SharedArrayBuffer is available
// (requires crossOriginIsolated context via COOP/COEP headers).
if (typeof crossOriginIsolated !== "undefined" && crossOriginIsolated) {
  // Multi-threading safe — numThreads set per-backend in getSessionOptions()
} else {
  ort.env.wasm.numThreads = 1;
}

let cachedBackend: "webgpu" | "wasm" | null = null;

/** Detect if running on a mobile device */
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

export async function detectBestBackend(): Promise<"webgpu" | "wasm"> {
  if (cachedBackend) return cachedBackend;

  // Skip WebGPU on mobile — unreliable and wastes startup time
  if (!isMobileDevice()) {
    try {
      if (typeof navigator !== "undefined" && "gpu" in navigator) {
        const gpu = (navigator as any).gpu;
        if (gpu) {
          const adapter = await gpu.requestAdapter({
            powerPreference: "high-performance",
          });
          if (adapter) {
            cachedBackend = "webgpu";
            return "webgpu";
          }
        }
      }
    } catch {
      // WebGPU not available or errored — fall through to WASM.
    }
  }

  cachedBackend = "wasm";
  return "wasm";
}

/**
 * Returns backend-appropriate ONNX session options.
 *
 * - WASM: full graph optimization + memory patterns + multi-threading
 * - WebGPU: basic optimization only (avoids excessive shader compilation)
 */
export function getSessionOptions(
  backend: "webgpu" | "wasm",
): ort.InferenceSession.SessionOptions {
  const opts: ort.InferenceSession.SessionOptions = {
    executionProviders: [backend],
  };

  if (backend === "wasm") {
    opts.graphOptimizationLevel = "all";
    opts.enableMemPattern = true;
    opts.enableCpuMemArena = true;
    if (typeof crossOriginIsolated !== "undefined" && crossOriginIsolated) {
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
    } else {
      ort.env.wasm.numThreads = 1;
    }
  } else {
    // WebGPU: "basic" avoids excessive shader compilation overhead;
    // enableMemPattern / enableCpuMemArena are WASM-only — omitted here.
    opts.graphOptimizationLevel = "basic";
  }

  return opts;
}
