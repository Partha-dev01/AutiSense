"use client";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import DetectorVideoCanvas from "../../components/DetectorVideoCanvas";
import DetectorResultsPanel from "../../components/DetectorResultsPanel";
import { useDetectorInference } from "../../hooks/useDetectorInference";
import { addBiomarker } from "../../lib/db/biomarker.repository";
import { getCurrentSessionId } from "../../lib/session/currentSession";

const STEPS = [
  "Welcome", "Profile", "Device", "Communicate", "Visual", "Behavior",
  "Prepare", "Motor", "Audio", "Video", "Summary", "Report",
];
const STEP_IDX = 9;
const ASSESSMENT_SECONDS = 120; // 2 minutes

export default function VideoCapturePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [started, setStarted] = useState(false);
  const [taskComplete, setTaskComplete] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ASSESSMENT_SECONDS);
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { result, isModelLoaded, error, modelError, backend, modality, setModality } =
    useDetectorInference(videoRef, canvasRef, camReady && started);

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
        setCamReady(true);
      }
    } catch (err) {
      setCamError(err instanceof DOMException && err.name === "NotAllowedError"
        ? "Camera access denied. Please allow camera permissions."
        : `Camera error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startAssessment = useCallback(async () => {
    await startCamera();
    setStarted(true);
    setTimeLeft(ASSESSMENT_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setTaskComplete(true);
          // Stop camera
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((tr) => tr.stop());
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [startCamera]);

  const stopEarly = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTaskComplete(true);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  }, []);

  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="logo">Auti<em>Sense</em></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={toggleTheme} className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.88rem" }}>
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <span style={{ fontSize: "0.88rem", color: "var(--text-muted)", fontWeight: 600 }}>
            Step {STEP_IDX + 1} of 12
          </span>
        </div>
      </nav>

      <div className="progress-wrap">
        <div className="progress-steps">
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
              <div className={`step-dot ${i < STEP_IDX ? "done" : i === STEP_IDX ? "active" : "upcoming"}`} title={s}>
                {i < STEP_IDX ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`step-line ${i < STEP_IDX ? "done" : ""}`} />}
            </div>
          ))}
        </div>
      </div>

      <main className="main-wide">
        {!started ? (
          <div style={{ maxWidth: 620, margin: "0 auto" }}>
            <div className="fade fade-1" style={{ textAlign: "center", marginBottom: 28 }}>
              <div className="breathe-orb" style={{ margin: "0 auto" }}>
                <div className="breathe-inner">📹</div>
              </div>
            </div>

            <div className="chip fade fade-1">Step 10 — Video Analysis</div>
            <h1 className="page-title fade fade-2">
              AI <em>behavioral screening</em>
            </h1>
            <p className="subtitle fade fade-2">
              The camera will observe your child&apos;s movements and expressions for 2 minutes.
              Our AI analyzes body pose, facial expressions, and behavioral patterns — all
              processed on your device. <strong>No video is recorded, stored, or uploaded.</strong>
            </p>

            <div className="card fade fade-3" style={{ padding: "20px 24px", marginBottom: 24, background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--sage-600)", fontWeight: 600, lineHeight: 1.7 }}>
                🔒 Privacy: The camera feed is processed entirely on your device using AI models.
                No video or images ever leave your phone. Only numerical scores are saved.
              </p>
            </div>

            <div className="fade fade-4" style={{ display: "flex", gap: 12 }}>
              <Link href="/intake/audio" className="btn btn-outline" style={{ minWidth: 100 }}>
                ← Back
              </Link>
              <button className="btn btn-primary btn-full" onClick={startAssessment}>
                📹 Start Video Analysis
              </button>
            </div>
          </div>
        ) : !taskComplete ? (
          <div className="fade fade-3">
            {/* Two-column layout: video + results */}
            <div className="video-capture-grid">
              {/* Left: Video feed */}
              <div>
                <DetectorVideoCanvas
                  videoRef={videoRef}
                  canvasRef={canvasRef}
                  result={result}
                  isCamReady={camReady}
                  isModelLoaded={isModelLoaded}
                />

                {/* Modality toggle */}
                <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center" }}>
                  {(["body", "face", "both"] as const).map((m) => (
                    <button key={m} onClick={() => setModality(m)}
                      className={modality === m ? "btn btn-primary" : "btn btn-outline"}
                      style={{ minHeight: 36, padding: "6px 16px", fontSize: "0.8rem" }}>
                      {m === "body" ? "🦴 Body" : m === "face" ? "😊 Face" : "🔄 Both"}
                    </button>
                  ))}
                </div>

                {/* Errors */}
                {(camError || modelError || error) && (
                  <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: "var(--r-md)", background: "var(--peach-100)", border: "2px solid var(--peach-300)" }}>
                    <p style={{ fontSize: "0.85rem", color: "var(--peach-300)", fontWeight: 600 }}>
                      {camError || modelError || error}
                    </p>
                  </div>
                )}

                {/* Stop early button */}
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button className="btn btn-outline" onClick={stopEarly}
                    style={{ minHeight: 40, padding: "8px 20px", fontSize: "0.85rem" }}>
                    Stop Early
                  </button>
                </div>
              </div>

              {/* Right: Results panel */}
              <DetectorResultsPanel
                result={result}
                isModelLoaded={isModelLoaded}
                backend={backend}
                timeLeft={timeLeft}
                totalTime={ASSESSMENT_SECONDS}
              />
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 620, margin: "0 auto" }}>
            <div className="card fade fade-3" style={{ padding: "36px 28px", textAlign: "center", background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
              <div style={{ fontSize: "3rem", marginBottom: 16 }}>✅</div>
              <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.4rem", marginBottom: 14, color: "var(--text-primary)" }}>
                Video analysis complete!
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: 20 }}>
                The AI has finished analyzing behavioral patterns. Your camera has been turned off
                and no video was stored. Proceed to see your screening summary.
              </p>

              {result?.multimodal && (
                <div style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 20 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.8rem", fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "var(--sage-600)" }}>
                      {Math.round(result.multimodal.asdRisk * 100)}%
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>ASD Risk</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.8rem", fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "var(--sky-300)" }}>
                      {Math.round(result.multimodal.confidence * 100)}%
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Confidence</div>
                  </div>
                </div>
              )}
            </div>

            <div className="fade fade-4" style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <Link href="/intake/audio" className="btn btn-outline" style={{ minWidth: 100 }}>
                ← Back
              </Link>
              <button className="btn btn-primary btn-full"
                onClick={async () => {
                  const sid = getCurrentSessionId();
                  if (sid && result?.multimodal) {
                    await addBiomarker(sid, "behavioral_video", {
                      gazeScore: result.face ? (1 - result.face.gazeDeviation) : 0.5,
                      motorScore: 1 - (result.multimodal.bodyRisk || 0),
                      vocalizationScore: 0.5,
                      responseLatencyMs: result.latencyMs,
                    }).catch(() => {});
                  }
                  const sessionId = sid ? `?sessionId=${sid}` : "";
                  router.push(`/intake/summary${sessionId}`);
                }}>
                View Summary →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
