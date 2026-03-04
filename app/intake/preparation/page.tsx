"use client";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addBiomarker } from "../../lib/db/biomarker.repository";
import { getCurrentSessionId } from "../../lib/session/currentSession";
import { getSession } from "../../lib/db/session.repository";
import { useActionCamera } from "../../hooks/useActionCamera";
import { ACTION_META, type ActionId } from "../../lib/actions/actionDetector";

const STEPS = [
  "Welcome", "Profile", "Device", "Communicate", "Visual", "Behavior",
  "Prepare", "Motor", "Audio", "Video", "Summary", "Report",
];
const STEP_IDX = 6;
const MAX_TURNS = 8;
const LISTEN_TIMEOUT_MS = 10_000;
const VERIFY_TIMEOUT_MS = 15_000;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ConversationMessage {
  role: "assistant" | "user";
  content: string;
}

interface TurnMetadata {
  turnType: string;
  expectsResponse: boolean;
  responseRelevance: number;
  shouldEnd: boolean;
  domain: string;
  action?: string;
}

interface TurnBiomarker {
  turnNumber: number;
  domain: string;
  responseLatencyMs: number | null;
  didRespond: boolean;
  responseRelevance: number;
}

type Phase =
  | "pre_start"
  | "loading"
  | "speaking"
  | "verifying"
  | "listening"
  | "processing"
  | "complete"
  | "error";

const DOMAIN_EMOJI: Record<string, string> = {
  social: "🤝",
  cognitive: "🧠",
  language: "🗣️",
  motor: "💪",
  general: "🌟",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PreparationPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [phase, setPhase] = useState<Phase>("pre_start");
  const [_conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [turnData, setTurnData] = useState<TurnBiomarker[]>([]);
  const [currentAgentText, setCurrentAgentText] = useState("");
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [currentDomain, setCurrentDomain] = useState("general");
  const [currentAction, setCurrentAction] = useState<ActionId | null>(null);
  const [turnNumber, setTurnNumber] = useState(0);
  const [childName, setChildName] = useState("friend");
  const [ageMonths, setAgeMonths] = useState(36);
  const [error, setError] = useState<string | null>(null);
  const [hasSpeechApi, setHasSpeechApi] = useState(true);
  const [cameraAvailable, setCameraAvailable] = useState(true);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef(false);
  const ttsEndTimeRef = useRef<number>(0);

  // Camera + YOLO action detection hook
  const {
    videoRef, overlayRef, isModelLoaded, isActive: cameraActive,
    cameraError, startCamera, stopCamera,
    startDetecting, stopDetecting, actionResult, actionDetected,
  } = useActionCamera();

  // Load theme
  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  // Load session data on mount
  useEffect(() => {
    const sid = getCurrentSessionId();
    if (sid) {
      getSession(sid).then((session) => {
        if (session) {
          setChildName(session.childName || "friend");
          setAgeMonths(session.ageMonths || 36);
        }
      });
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setHasSpeechApi(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      stopCamera();
    };
  }, [stopCamera]);

  /* ---------------------------------------------------------------- */
  /*  TTS — Polly with browser fallback                                */
  /* ---------------------------------------------------------------- */

  const speakWithPolly = useCallback(async (text: string): Promise<void> => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: "Joanna" }),
      });
      if (!res.ok) throw new Error("TTS response not ok");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      return new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          ttsEndTimeRef.current = Date.now();
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          ttsEndTimeRef.current = Date.now();
          resolve();
        };
        audio.play().catch(() => {
          URL.revokeObjectURL(url);
          ttsEndTimeRef.current = Date.now();
          resolve();
        });
      });
    } catch {
      return new Promise<void>((resolve) => {
        if (!("speechSynthesis" in window)) {
          ttsEndTimeRef.current = Date.now();
          resolve();
          return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        utterance.pitch = 1.1;
        utterance.onend = () => { ttsEndTimeRef.current = Date.now(); resolve(); };
        utterance.onerror = () => { ttsEndTimeRef.current = Date.now(); resolve(); };
        window.speechSynthesis.speak(utterance);
      });
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  STT — Web Speech API                                             */
  /* ---------------------------------------------------------------- */

  const listenForResponse = useCallback((): Promise<{ transcript: string; latencyMs: number | null }> => {
    return new Promise((resolve) => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        resolve({ transcript: "", latencyMs: null });
        return;
      }

      const startTime = Date.now();
      let firstSpeechTime: number | null = null;
      let finalTranscript = "";
      let resolved = false;

      const done = () => {
        if (resolved) return;
        resolved = true;
        try { recognition.stop(); } catch { /* ignore */ }
        recognitionRef.current = null;
        clearTimeout(timer);
        resolve({
          transcript: finalTranscript,
          latencyMs: firstSpeechTime ? firstSpeechTime - startTime : null,
        });
      };

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognitionRef.current = recognition;

      const timer = setTimeout(done, LISTEN_TIMEOUT_MS);

      recognition.onresult = (event: any) => {
        if (!firstSpeechTime) firstSpeechTime = Date.now();
        finalTranscript = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join("");
        setCurrentTranscript(finalTranscript);
        if (event.results[0]?.isFinal) done();
      };

      recognition.onerror = () => done();
      recognition.onend = () => done();

      recognition.start();
    });
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Camera action verification                                       */
  /* ---------------------------------------------------------------- */

  const verifyAction = useCallback((action: ActionId): Promise<{ detected: boolean; latencyMs: number | null }> => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      startDetecting(action);

      const timer = setTimeout(() => {
        stopDetecting();
        resolve({ detected: false, latencyMs: null });
      }, VERIFY_TIMEOUT_MS);

      // Poll for detection (checked via actionDetected state)
      const check = setInterval(() => {
        // We rely on the actionDetected state being set by the hook
      }, 100);

      // Store resolve for external use
      verifyResolveRef.current = (detected: boolean) => {
        clearTimeout(timer);
        clearInterval(check);
        stopDetecting();
        resolve({
          detected,
          latencyMs: detected ? Date.now() - startTime : null,
        });
      };
    });
  }, [startDetecting, stopDetecting]);

  const verifyResolveRef = useRef<((detected: boolean) => void) | null>(null);

  // Watch for actionDetected changes during verify phase
  useEffect(() => {
    if (actionDetected && verifyResolveRef.current) {
      verifyResolveRef.current(true);
      verifyResolveRef.current = null;
    }
  }, [actionDetected]);

  /* ---------------------------------------------------------------- */
  /*  Conversation API call                                            */
  /* ---------------------------------------------------------------- */

  const fetchNextTurn = useCallback(async (
    history: ConversationMessage[],
    turn: number,
  ): Promise<{ text: string; metadata: TurnMetadata; fallback: boolean }> => {
    try {
      const res = await fetch("/api/chat/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          childName,
          ageMonths,
          turnNumber: turn,
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      return await res.json();
    } catch {
      return {
        text: turn === 0
          ? `Hi ${childName}! I'm so happy to talk with you today!`
          : `You're doing great, ${childName}! Thank you for talking with me!`,
        metadata: {
          turnType: turn === 0 ? "greeting" : "farewell",
          expectsResponse: turn === 0,
          responseRelevance: 0.5,
          shouldEnd: turn > 0,
          domain: "general",
        },
        fallback: true,
      };
    }
  }, [childName, ageMonths]);

  /* ---------------------------------------------------------------- */
  /*  Main conversation loop                                           */
  /* ---------------------------------------------------------------- */

  const runConversation = useCallback(async () => {
    abortRef.current = false;
    let history: ConversationMessage[] = [];
    let turns: TurnBiomarker[] = [];
    let turn = 0;

    // Start camera for motor action detection
    if (cameraAvailable) {
      await startCamera().catch(() => setCameraAvailable(false));
    }

    while (turn < MAX_TURNS && !abortRef.current) {
      // 1. Fetch next agent response
      setPhase("loading");
      const agentResponse = await fetchNextTurn(history, turn);
      if (abortRef.current) break;

      // 2. Show + speak agent text
      setCurrentAgentText(agentResponse.text);
      setCurrentTranscript("");
      setCurrentDomain(agentResponse.metadata.domain);
      const action = agentResponse.metadata.action as ActionId | undefined;
      setCurrentAction(action && ACTION_META[action] ? action : null);
      setPhase("speaking");

      history = [...history, { role: "assistant", content: agentResponse.text }];
      setConversationHistory([...history]);

      await speakWithPolly(agentResponse.text);
      if (abortRef.current) break;

      // 3. Check if conversation should end
      if (agentResponse.metadata.shouldEnd || !agentResponse.metadata.expectsResponse) {
        turns = [...turns, {
          turnNumber: turn,
          domain: agentResponse.metadata.domain,
          responseLatencyMs: null,
          didRespond: false,
          responseRelevance: agentResponse.metadata.responseRelevance,
        }];
        setTurnData([...turns]);
        break;
      }

      // 4. Motor turn → camera verification, Non-motor → speech recognition
      const isMotorAction = agentResponse.metadata.domain === "motor" && action && ACTION_META[action as ActionId];

      let didRespond = false;
      let latencyMs: number | null = null;

      if (isMotorAction && cameraAvailable && cameraActive) {
        setPhase("verifying");
        const result = await verifyAction(action as ActionId);
        if (abortRef.current) break;
        didRespond = result.detected;
        latencyMs = result.latencyMs;

        const childMessage = didRespond ? `[action: ${action} detected]` : "[no response]";
        history = [...history, { role: "user", content: childMessage }];
      } else {
        setPhase("listening");
        let transcript = "";

        if (hasSpeechApi) {
          const result = await listenForResponse();
          if (abortRef.current) break;
          transcript = result.transcript;
          latencyMs = result.latencyMs;
        }

        didRespond = transcript.trim().length > 0;
        const childMessage = transcript || "[no response]";
        history = [...history, { role: "user", content: childMessage }];
      }

      setConversationHistory([...history]);

      // 5. Record turn data
      turns = [...turns, {
        turnNumber: turn,
        domain: agentResponse.metadata.domain,
        responseLatencyMs: latencyMs,
        didRespond,
        responseRelevance: didRespond
          ? (isMotorAction ? 1.0 : agentResponse.metadata.responseRelevance)
          : 0,
      }];
      setTurnData([...turns]);

      setPhase("processing");
      await new Promise((r) => setTimeout(r, didRespond ? 1200 : 500));

      turn++;
      setTurnNumber(turn);
    }

    if (!abortRef.current) {
      setPhase("complete");
      stopCamera();
    }
  }, [fetchNextTurn, speakWithPolly, listenForResponse, hasSpeechApi, cameraAvailable, cameraActive, startCamera, stopCamera, verifyAction]);

  /* ---------------------------------------------------------------- */
  /*  Manual response buttons (fallback when no speech API)            */
  /* ---------------------------------------------------------------- */

  const handleManualResponse = useCallback((responded: boolean) => {
    setCurrentTranscript(responded ? "(parent confirmed response)" : "[no response]");
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
  }, []);

  const handleManualVerify = useCallback((detected: boolean) => {
    if (verifyResolveRef.current) {
      verifyResolveRef.current(detected);
      verifyResolveRef.current = null;
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Early stop                                                       */
  /* ---------------------------------------------------------------- */

  const stopEarly = useCallback(() => {
    abortRef.current = true;
    stopDetecting();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (verifyResolveRef.current) {
      verifyResolveRef.current(false);
      verifyResolveRef.current = null;
    }
    stopCamera();
    setPhase("complete");
  }, [stopDetecting, stopCamera]);

  /* ---------------------------------------------------------------- */
  /*  Computed metrics                                                 */
  /* ---------------------------------------------------------------- */

  const respondedTurns = turnData.filter((t) => t.didRespond);
  const motorTurns = turnData.filter((t) => t.domain === "motor");
  const motorResponded = motorTurns.filter((t) => t.didRespond);
  const nonMotorTurns = turnData.filter((t) => t.domain !== "motor");
  const nonMotorResponded = nonMotorTurns.filter((t) => t.didRespond);
  const responseRate = turnData.length > 0 ? respondedTurns.length / turnData.length : 0;
  const avgLatency = respondedTurns.length > 0
    ? Math.round(respondedTurns.reduce((s, t) => s + (t.responseLatencyMs ?? 0), 0) / respondedTurns.length)
    : null;
  const avgRelevance = nonMotorResponded.length > 0
    ? nonMotorResponded.reduce((s, t) => s + t.responseRelevance, 0) / nonMotorResponded.length
    : 0;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

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

      {/* Hidden video + capture elements for camera */}
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />

      <main className="main">
        {/* Pre-start */}
        {phase === "pre_start" && (
          <>
            <div className="fade fade-1" style={{ textAlign: "center", marginBottom: 28 }}>
              <div className="breathe-orb" style={{ margin: "0 auto" }}>
                <div className="breathe-inner">🎙️</div>
              </div>
            </div>

            <div className="chip fade fade-1">Step 7 — Voice Conversation</div>
            <h1 className="page-title fade fade-2">
              Let&apos;s have a <em>chat</em>
            </h1>
            <p className="subtitle fade fade-2">
              Our friendly voice assistant will have a short conversation with your child.
              It will ask simple, fun questions and fun actions to try.
              <strong> Nothing is recorded or stored — only scores are saved.</strong>
            </p>

            <div className="card fade fade-3" style={{ padding: "20px 24px", marginBottom: 24, background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--sage-600)", fontWeight: 600, lineHeight: 1.7 }}>
                🔊 Make sure your volume is up so your child can hear the voice.<br />
                📷 We&apos;ll use the camera to watch for fun actions (wave, touch nose, etc.).<br />
                The conversation will last about 1-2 minutes.
              </p>
            </div>

            {!hasSpeechApi && (
              <div className="card fade fade-3" style={{ padding: "16px 20px", marginBottom: 16, background: "var(--peach-100)", borderColor: "var(--peach-300)" }}>
                <p style={{ fontSize: "0.85rem", color: "var(--peach-300)", fontWeight: 600 }}>
                  Speech recognition is not available in this browser. You can still proceed
                   — you&apos;ll tap buttons to indicate if your child responded.
                </p>
              </div>
            )}

            <div className="fade fade-4" style={{ display: "flex", gap: 12 }}>
              <Link href="/intake/behavioral-observation" className="btn btn-outline" style={{ minWidth: 100 }}>
                ← Back
              </Link>
              <button className="btn btn-primary btn-full" onClick={() => {
                setPhase("loading");
                runConversation().catch((err) => {
                  console.error("[Conversation]", err);
                  setError("Something went wrong. Please try again.");
                  setPhase("error");
                });
              }} style={{ minHeight: 52, padding: "12px 36px" }}>
                🎙️ Start Conversation
              </button>
            </div>
          </>
        )}

        {/* Loading */}
        {phase === "loading" && (
          <div className="fade fade-1" style={{ textAlign: "center" }}>
            <div className="breathe-orb" style={{ margin: "0 auto", marginBottom: 20 }}>
              <div className="breathe-inner">💭</div>
            </div>
            <p style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.9rem" }}>
              Thinking...
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 8 }}>
              Turn {turnNumber + 1}
            </p>
          </div>
        )}

        {/* Speaking — enhanced with domain visual and prominent text */}
        {phase === "speaking" && (
          <div className="card fade fade-1" style={{ padding: "32px 28px", textAlign: "center" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 12, fontWeight: 600 }}>
              Turn {turnNumber + 1} — {currentDomain.charAt(0).toUpperCase() + currentDomain.slice(1)}
            </p>

            {/* Domain emoji */}
            <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>
              {currentAction && ACTION_META[currentAction]
                ? ACTION_META[currentAction].emoji
                : DOMAIN_EMOJI[currentDomain] || "🌟"}
            </div>

            {/* Speaking indicator */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "12px 24px", borderRadius: "var(--r-full)",
              background: "var(--sky-100)", border: "2px solid var(--sky-300)",
              marginBottom: 20,
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: "50%",
                background: "var(--sky-400)",
                animation: "breathe-core 1s ease-in-out infinite",
              }} />
              <span style={{ fontWeight: 700, color: "var(--sky-400)", fontSize: "0.9rem" }}>
                Speaking...
              </span>
            </div>

            {/* Agent text — large and prominent */}
            <p style={{
              fontSize: "1.3rem", fontWeight: 600, lineHeight: 1.6,
              color: "var(--text-primary)", fontFamily: "'Fredoka',sans-serif",
              padding: "0 8px",
            }}>
              &ldquo;{currentAgentText}&rdquo;
            </p>

            {currentAction && ACTION_META[currentAction] && (
              <p style={{ fontSize: "0.85rem", color: "var(--sage-500)", marginTop: 12, fontWeight: 600 }}>
                {ACTION_META[currentAction].emoji} Action coming up — camera will verify!
              </p>
            )}
          </div>
        )}

        {/* Verifying — Camera feed with skeleton overlay and action detection */}
        {phase === "verifying" && currentAction && (
          <div className="card fade fade-1" style={{
            padding: "24px 20px", textAlign: "center",
            borderColor: actionDetected ? "var(--sage-400)" : "var(--sky-300)",
            transition: "border-color 0.3s",
          }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 12, fontWeight: 600 }}>
              Turn {turnNumber + 1} — Motor Action
            </p>

            {/* Agent text reminder */}
            <p style={{
              fontSize: "1rem", fontWeight: 600, color: "var(--text-secondary)",
              fontFamily: "'Fredoka',sans-serif", marginBottom: 16, fontStyle: "italic",
            }}>
              &ldquo;{currentAgentText}&rdquo;
            </p>

            {/* Action target badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "10px 24px", borderRadius: "var(--r-full)",
              background: actionDetected ? "var(--sage-50)" : "var(--sky-100)",
              border: `2px solid ${actionDetected ? "var(--sage-400)" : "var(--sky-300)"}`,
              marginBottom: 16, transition: "all 0.3s",
            }}>
              <span style={{ fontSize: "1.5rem" }}>{ACTION_META[currentAction].emoji}</span>
              <span style={{ fontWeight: 700, color: actionDetected ? "var(--sage-600)" : "var(--sky-400)", fontSize: "0.9rem" }}>
                {actionDetected ? "Action detected!" : `Looking for: ${ACTION_META[currentAction].label}`}
              </span>
            </div>

            {/* Camera feed with skeleton overlay */}
            {cameraActive && !cameraError ? (
              <div style={{
                position: "relative", width: 320, height: 240,
                margin: "0 auto", borderRadius: 16, overflow: "hidden",
                border: `3px solid ${actionDetected ? "var(--sage-400)" : "var(--border-card)"}`,
                transition: "border-color 0.3s",
              }}>
                <video
                  ref={videoRef}
                  style={{
                    width: 320, height: 240, objectFit: "cover",
                    transform: "scaleX(-1)", display: "block",
                  }}
                  playsInline muted autoPlay
                />
                <canvas
                  ref={overlayRef}
                  width={320} height={240}
                  style={{
                    position: "absolute", top: 0, left: 0,
                    width: 320, height: 240,
                    transform: "scaleX(-1)", pointerEvents: "none",
                  }}
                />

                {/* Success overlay */}
                {actionDetected && (
                  <div style={{
                    position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                    background: "rgba(104, 159, 56, 0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    animation: "fadeIn 0.3s ease-out",
                  }}>
                    <div style={{
                      background: "white", borderRadius: "50%",
                      width: 80, height: 80, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: "2.5rem", boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                    }}>
                      ✅
                    </div>
                  </div>
                )}

                {/* Loading model indicator */}
                {!isModelLoaded && (
                  <div style={{
                    position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                    background: "rgba(0,0,0,0.5)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: "white", fontWeight: 600, fontSize: "0.9rem",
                  }}>
                    Loading pose model...
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                width: 320, height: 120, margin: "0 auto", borderRadius: 16,
                background: "var(--bg-card)", border: "2px dashed var(--border-card)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 8,
              }}>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
                  📷 Camera not available
                </p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Parent: Did they do the action?
                </p>
              </div>
            )}

            {/* Confidence bar */}
            {actionResult && !actionDetected && cameraActive && (
              <div style={{ maxWidth: 280, margin: "12px auto 0" }}>
                <div style={{
                  height: 6, borderRadius: 3, background: "var(--bg-elevated)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    background: "var(--sage-400)",
                    width: `${Math.round(actionResult.confidence * 100)}%`,
                    transition: "width 0.15s ease-out",
                  }} />
                </div>
              </div>
            )}

            {actionDetected && (
              <p style={{
                color: "var(--sage-600)", fontWeight: 700, fontSize: "1.1rem",
                marginTop: 16, fontFamily: "'Fredoka',sans-serif",
              }}>
                Great job! 🎉
              </p>
            )}

            {/* Manual fallback + skip buttons */}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
              {(!cameraActive || cameraError) && (
                <>
                  <button className="btn btn-primary" style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.85rem" }}
                    onClick={() => handleManualVerify(true)}>
                    ✓ They did it!
                  </button>
                  <button className="btn btn-outline" style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.85rem" }}
                    onClick={() => handleManualVerify(false)}>
                    Skip action
                  </button>
                </>
              )}
              {cameraActive && !actionDetected && (
                <button className="btn btn-outline" style={{ minHeight: 40, padding: "6px 16px", fontSize: "0.8rem" }}
                  onClick={() => handleManualVerify(false)}>
                  Skip →
                </button>
              )}
              <button className="btn btn-outline" style={{ minHeight: 40, padding: "6px 16px", fontSize: "0.8rem", color: "var(--text-muted)" }}
                onClick={stopEarly}>
                End Early
              </button>
            </div>
          </div>
        )}

        {/* Listening — non-motor turns */}
        {phase === "listening" && (
          <div className="card fade fade-1" style={{ padding: "32px 28px", textAlign: "center" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 12, fontWeight: 600 }}>
              Turn {turnNumber + 1} — {currentDomain.charAt(0).toUpperCase() + currentDomain.slice(1)}
            </p>

            {/* Domain emoji */}
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>
              {DOMAIN_EMOJI[currentDomain] || "🌟"}
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                padding: "12px 24px", borderRadius: "var(--r-full)",
                background: "var(--sage-50)", border: "2px solid var(--sage-300)",
              }}>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%",
                  background: "var(--sage-500)",
                  animation: "breathe-core 1.5s ease-in-out infinite",
                }} />
                <span style={{ fontWeight: 700, color: "var(--sage-600)", fontSize: "0.9rem" }}>
                  Listening...
                </span>
              </div>
            </div>

            {/* Agent text shown prominently */}
            <p style={{
              fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)",
              fontFamily: "'Fredoka',sans-serif", marginBottom: 16,
            }}>
              &ldquo;{currentAgentText}&rdquo;
            </p>

            {currentTranscript && (
              <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--sage-500)", marginBottom: 16 }}>
                Child: &ldquo;{currentTranscript}&rdquo;
              </p>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
              {!hasSpeechApi && (
                <>
                  <button className="btn btn-primary" style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.85rem" }}
                    onClick={() => handleManualResponse(true)}>
                    ✓ They responded
                  </button>
                  <button className="btn btn-outline" style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.85rem" }}
                    onClick={() => handleManualResponse(false)}>
                    No response
                  </button>
                </>
              )}
              <button className="btn btn-outline" style={{ minHeight: 40, padding: "6px 16px", fontSize: "0.8rem", color: "var(--text-muted)" }}
                onClick={stopEarly}>
                End Early
              </button>
            </div>
          </div>
        )}

        {/* Processing */}
        {phase === "processing" && (
          <div className="fade fade-1" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>✓</div>
            <p style={{ color: "var(--sage-500)", fontWeight: 600, fontSize: "0.9rem" }}>
              Got it!
            </p>
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="card fade fade-1" style={{ padding: "32px 28px", textAlign: "center", background: "var(--peach-100)", borderColor: "var(--peach-300)" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>⚠️</div>
            <p style={{ color: "var(--peach-300)", fontWeight: 600, marginBottom: 20 }}>
              {error || "Something went wrong."}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={() => {
                setError(null);
                setPhase("loading");
                setConversationHistory([]);
                setTurnData([]);
                setTurnNumber(0);
                runConversation().catch(() => {
                  setError("Still having trouble. You can skip this step.");
                  setPhase("error");
                });
              }}>
                Try Again
              </button>
              <button className="btn btn-outline" onClick={() => setPhase("complete")}>
                Skip Step
              </button>
            </div>
          </div>
        )}

        {/* Complete */}
        {phase === "complete" && (
          <>
            <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center", background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>✅</div>
              <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 14 }}>
                Conversation complete!
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 20, lineHeight: 1.7 }}>
                {turnData.length > 0 ? (
                  <>
                    Your child completed {turnData.length} conversation turns.
                    {respondedTurns.length > 0 && (
                      <> They responded to {respondedTurns.length} of {turnData.length} prompts.</>
                    )}
                    {motorTurns.length > 0 && (
                      <> Motor actions detected: {motorResponded.length} of {motorTurns.length}.</>
                    )}
                  </>
                ) : (
                  "The conversation ended early. Scores will be adjusted accordingly."
                )}
              </p>

              {turnData.length > 0 && (
                <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "var(--sage-600)" }}>
                      {Math.round(responseRate * 100)}%
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Response Rate</div>
                  </div>
                  {motorTurns.length > 0 && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "var(--sage-500)" }}>
                        {motorResponded.length}/{motorTurns.length}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Actions Verified</div>
                    </div>
                  )}
                  {avgLatency !== null && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "var(--sky-300)" }}>
                        {avgLatency < 1000 ? `${avgLatency}ms` : `${(avgLatency / 1000).toFixed(1)}s`}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Avg Response Time</div>
                    </div>
                  )}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "var(--sage-500)" }}>
                      {turnData.length}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Turns</div>
                  </div>
                </div>
              )}
            </div>

            <div className="fade fade-4" style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <Link href="/intake/behavioral-observation" className="btn btn-outline" style={{ minWidth: 100 }}>
                ← Back
              </Link>
              <button className="btn btn-primary btn-full"
                onClick={async () => {
                  const sid = getCurrentSessionId();
                  if (sid && turnData.length > 0) {
                    const motorScore = motorTurns.length > 0
                      ? motorResponded.length / motorTurns.length
                      : 0.5;
                    const vocalRate = nonMotorTurns.length > 0
                      ? nonMotorResponded.length / nonMotorTurns.length
                      : responseRate;

                    await addBiomarker(sid, "preparation_interactive", {
                      gazeScore: Math.max(0, Math.min(1, avgRelevance)),
                      motorScore: Math.max(0, Math.min(1, motorScore)),
                      vocalizationScore: Math.max(0, Math.min(1, vocalRate)),
                      responseLatencyMs: avgLatency,
                    }).catch(() => {});
                  }
                  router.push("/intake/motor");
                }}>
                Continue →
              </button>
            </div>
          </>
        )}

        {/* End early button for active phases */}
        {(phase === "loading" || phase === "speaking" || phase === "processing") && (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button className="btn btn-outline" onClick={stopEarly}
              style={{ minHeight: 40, padding: "8px 20px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              End Conversation Early
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
