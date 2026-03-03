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

let cachedBackend: "webgpu" | "wasm" | null = null;

export async function detectBestBackend(): Promise<"webgpu" | "wasm"> {
  if (cachedBackend) return cachedBackend;

  try {
    if (typeof navigator !== "undefined" && "gpu" in navigator) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
  } else {
    // WebGPU: "basic" avoids excessive shader compilation overhead;
    // enableMemPattern / enableCpuMemArena are WASM-only — omitted here.
    opts.graphOptimizationLevel = "basic";
  }

  return opts;
}
