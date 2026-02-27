/**
 
 * ⚠️NOT YET IMPLEMENTED
 *
 * This worker will:
 *   1. Load an ONNX model via onnxruntime-web (fetched from /api/models?model=pose_estimator)
 *   2. Receive raw camera frames from the main thread via postMessage
 *   3. Run inference to extract 17 pose keypoints per frame
 *   4. Sample microphone amplitude via Web Audio API
 *   5. Emit a biomarker object every ~500ms:
 *        { gazeScore, motorScore, vocalizationScore, responseLatencyMs, timestamp }
 *   6. Zero out all typed arrays after each inference pass (privacy contract)
 *
 * Biomarker scores are currently mocked in the task screen components.
 *
 * When implementing:
 *   npm install onnxruntime-web
 *   Reference: https://onnxruntime.ai/docs/get-started/with-javascript/web.html
 */

// Minimal scaffolding so TypeScript doesn't complain

self.onmessage = (event: MessageEvent) => {
  const { type } = event.data as { type: string };

  switch (type) {
    case "START":
      // TODO : initialise ONNX session, start camera + mic capture
      console.warn("[InferenceWorker] Not yet implemented — using mock scores");
      emitMockBiomarker();
      break;

    case "STOP":
      // TODO : stop all streams, zero typed arrays, close ONNX session
      break;

    default:
      console.warn("[InferenceWorker] Unknown message type:", type);
  }
};
function emitMockBiomarker() {
  const mock = {
    type: "BIOMARKER",
    payload: {
      gazeScore: Math.random() * 0.5 + 0.3, // 0.3–0.8
      motorScore: Math.random() * 0.5 + 0.3,
      vocalizationScore: Math.random() * 0.5 + 0.2,
      responseLatencyMs: Math.floor(Math.random() * 2000) + 500,
      timestamp: Date.now(),
    },
  };
  self.postMessage(mock);
}

export {};
