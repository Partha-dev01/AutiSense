/**
 * modelCache — utilities for caching ONNX model files using the
 * browser Cache API, so they persist across page reloads and avoid
 * repeated network downloads.
 *
 * Usage:
 *   const url = "/models/yolo26n-pose-int8.onnx";
 *   if (!(await isCached(url))) {
 *     await cacheModel(url);
 *   }
 *   const blob = await getCachedModel(url);
 */

/** Name of the cache store used for ONNX models. */
const CACHE_NAME = "asd-posenet-models-v1";

/**
 * Check whether a model URL is already in the cache.
 *
 * @param url  Relative or absolute URL of the model file.
 * @returns    `true` if a cached response exists.
 */
export async function isCached(url: string): Promise<boolean> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(url);
    return response !== undefined;
  } catch {
    // Cache API not available (e.g. in insecure context).
    return false;
  }
}

/**
 * Fetch a model from the network and store it in the Cache API.
 * If the model is already cached, this is a no-op.
 *
 * @param url  Relative or absolute URL of the model file.
 */
export async function cacheModel(url: string): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const existing = await cache.match(url);
    if (existing) return; // already cached

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
    }
    await cache.put(url, response);
  } catch (err) {
    console.warn("[modelCache] Could not cache model:", err);
  }
}

/**
 * Retrieve a cached model as an ArrayBuffer.
 * Falls back to a regular fetch if the cache misses.
 *
 * @param url  Relative or absolute URL of the model file.
 * @returns    The model bytes as an ArrayBuffer.
 */
export async function getCachedModel(url: string): Promise<ArrayBuffer> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      return await cachedResponse.arrayBuffer();
    }
  } catch {
    // Cache API unavailable — fall through to fetch.
  }

  // Cache miss: fetch from the network, then try to cache for next time.
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
  }

  // Clone the response before consuming, so we can cache it.
  const clone = response.clone();
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(url, clone);
  } catch {
    // Caching failed — not critical.
  }

  return await response.arrayBuffer();
}
