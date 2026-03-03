"use client";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addBiomarker } from "../../lib/db/biomarker.repository";
import { getCurrentSessionId } from "../../lib/session/currentSession";

const STEPS = [
  "Welcome", "Profile", "Device", "Communicate", "Visual", "Behavior",
  "Prepare", "Motor", "Audio", "Video", "Summary", "Report",
];
const STEP_IDX = 3;

const PROMPTS = [
  { text: "Can you say hello?", emoji: "👋", expected: "hello" },
  { text: "What is your name?", emoji: "🗣️", expected: null },
  { text: "Can you say banana?", emoji: "🍌", expected: "banana" },
  { text: "How old are you?", emoji: "🎂", expected: null },
];

type PromptState = "waiting" | "listening" | "heard" | "timeout";

export default function CommunicationPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [promptState, setPromptState] = useState<PromptState>("waiting");
  const [transcript, setTranscript] = useState("");
  const [responses, setResponses] = useState<string[]>([]);
  const [taskComplete, setTaskComplete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const advancePrompt = useCallback((response: string) => {
    setResponses((prev) => [...prev, response]);
    if (currentPrompt >= PROMPTS.length - 1) {
      setTaskComplete(true);
    } else {
      setCurrentPrompt((p) => p + 1);
      setPromptState("waiting");
      setTranscript("");
    }
  }, [currentPrompt]);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setPromptState("heard");
      setTranscript("(Speech recognition not supported)");
      setTimeout(() => advancePrompt("unsupported"), 1500);
      return;
    }

    setPromptState("listening");
    setTranscript("");

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      const result = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      setTranscript(result);
      if (event.results[0]?.isFinal) {
        setPromptState("heard");
        stopRecognition();
        setTimeout(() => advancePrompt(result), 1200);
      }
    };

    recognition.onerror = () => {
      setPromptState("timeout");
      stopRecognition();
    };

    recognition.onend = () => {
      if (promptState === "listening") {
        setPromptState("timeout");
      }
    };

    recognition.start();

    timerRef.current = setTimeout(() => {
      stopRecognition();
      setPromptState("timeout");
    }, 12000);
  }, [advancePrompt, stopRecognition, promptState]);

  useEffect(() => {
    return () => stopRecognition();
  }, [stopRecognition]);

  const prompt = PROMPTS[currentPrompt];

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

      <main className="main">
        <div className="fade fade-1" style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="breathe-orb" style={{ margin: "0 auto" }}>
            <div className="breathe-inner">🗣️</div>
          </div>
        </div>

        <div className="chip fade fade-1">Step 4 — Communication</div>
        <h1 className="page-title fade fade-2">
          Let's hear <em>their voice</em>
        </h1>
        <p className="subtitle fade fade-2">
          We'll show some simple prompts. Encourage your child to respond aloud.
          The microphone listens — nothing is recorded or saved.
        </p>

        {!taskComplete ? (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center" }}>
            {/* Progress */}
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 20, fontWeight: 600 }}>
              Prompt {currentPrompt + 1} of {PROMPTS.length}
            </p>

            {/* Prompt display */}
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>{prompt.emoji}</div>
            <h2 style={{
              fontFamily: "'Fredoka',sans-serif", fontWeight: 600,
              fontSize: "1.4rem", marginBottom: 24, color: "var(--text-primary)",
            }}>
              {prompt.text}
            </h2>

            {/* Listening indicator */}
            {promptState === "listening" && (
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 24px", borderRadius: "var(--r-full)",
                  background: "var(--sage-50)", border: "2px solid var(--sage-300)",
                }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: "50%",
                    background: "var(--sage-500)",
                    animation: "breathe-core 1.5s ease-in-out infinite",
                  }} />
                  <span style={{ fontWeight: 700, color: "var(--sage-600)", fontSize: "0.9rem" }}>
                    Listening...
                  </span>
                </div>
                {transcript && (
                  <p style={{ marginTop: 12, fontSize: "1.1rem", fontWeight: 600, color: "var(--sage-500)" }}>
                    "{transcript}"
                  </p>
                )}
              </div>
            )}

            {promptState === "heard" && (
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 24px", borderRadius: "var(--r-full)",
                  background: "var(--sage-50)", border: "2px solid var(--sage-400)",
                }}>
                  <span style={{ fontWeight: 700, color: "var(--sage-600)" }}>✓ Heard: "{transcript}"</span>
                </div>
              </div>
            )}

            {promptState === "timeout" && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: 12 }}>
                  No response detected. That's okay!
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <button className="btn btn-primary" style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.9rem" }}
                    onClick={() => { setPromptState("waiting"); setTranscript(""); }}>
                    Try Again
                  </button>
                  <button className="btn btn-secondary" style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.9rem" }}
                    onClick={() => advancePrompt("no_response")}>
                    Skip to next →
                  </button>
                </div>
              </div>
            )}

            {promptState === "waiting" && (
              <button className="btn btn-primary" onClick={startListening}
                style={{ minHeight: 52, padding: "12px 36px" }}>
                🎙️ Start Listening
              </button>
            )}
          </div>
        ) : (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center", background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>✅</div>
            <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 10 }}>
              Communication task complete!
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {responses.filter((r) => r !== "no_response" && r !== "unsupported").length} of {PROMPTS.length} prompts received a response.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="fade fade-4" style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <Link href="/intake/device-check" className="btn btn-outline" style={{ minWidth: 100 }}>
            ← Back
          </Link>
          <button className="btn btn-primary btn-full"
            disabled={!taskComplete}
            onClick={async () => {
              const sid = getCurrentSessionId();
              if (sid) {
                const heard = responses.filter((r) => r !== "no_response" && r !== "unsupported").length;
                await addBiomarker(sid, "communication_responsiveness", {
                  gazeScore: 0.5,
                  motorScore: 0.5,
                  vocalizationScore: Math.min(1, heard / PROMPTS.length),
                }).catch(() => {});
              }
              router.push("/intake/visual-engagement");
            }}>
            Continue →
          </button>
        </div>
      </main>
    </div>
  );
}
