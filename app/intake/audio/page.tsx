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
const STEP_IDX = 8;

const WORDS = [
  { word: "Cat", emoji: "🐱" },
  { word: "Dog", emoji: "🐶" },
  { word: "Ball", emoji: "⚽" },
  { word: "Star", emoji: "⭐" },
  { word: "Sun", emoji: "☀️" },
];

type WordState = "idle" | "playing" | "listening" | "matched" | "missed";

export default function AudioAssessmentPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [started, setStarted] = useState(false);
  const [taskComplete, setTaskComplete] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [wordState, setWordState] = useState<WordState>("idle");
  const [transcript, setTranscript] = useState("");
  const [results, setResults] = useState<("matched" | "missed")[]>([]);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const advance = useCallback((result: "matched" | "missed") => {
    setResults((prev) => [...prev, result]);
    if (currentIdx >= WORDS.length - 1) {
      setTaskComplete(true);
    } else {
      setCurrentIdx((i) => i + 1);
      setWordState("idle");
      setTranscript("");
    }
  }, [currentIdx]);

  const playWord = useCallback(() => {
    const word = WORDS[currentIdx].word;
    setWordState("playing");

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.rate = 0.8;
      utterance.pitch = 1.1;
      utterance.onend = () => {
        // Start listening for echo
        setWordState("listening");
        startListening(word);
      };
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => {
        setWordState("listening");
        startListening(word);
      }, 1500);
    }
  }, [currentIdx]);

  const startListening = useCallback((expectedWord: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTimeout(() => advance("missed"), 2000);
      return;
    }

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
        stopRecognition();
        const match = result.toLowerCase().includes(expectedWord.toLowerCase());
        setWordState(match ? "matched" : "missed");
        setTimeout(() => advance(match ? "matched" : "missed"), 1200);
      }
    };

    recognition.onerror = () => {
      stopRecognition();
      setWordState("missed");
      setTimeout(() => advance("missed"), 1000);
    };

    recognition.start();

    timerRef.current = setTimeout(() => {
      stopRecognition();
      setWordState("missed");
      setTimeout(() => advance("missed"), 800);
    }, 10000);
  }, [advance, stopRecognition]);

  useEffect(() => {
    return () => stopRecognition();
  }, [stopRecognition]);

  const word = WORDS[currentIdx];
  const matchedCount = results.filter((r) => r === "matched").length;

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
            <div className="breathe-inner">🔊</div>
          </div>
        </div>

        <div className="chip fade fade-1">Step 9 — Audio Echo</div>
        <h1 className="page-title fade fade-2">
          Say it <em>back!</em>
        </h1>
        <p className="subtitle fade fade-2">
          We'll say a word out loud. Encourage your child to repeat it back.
          This tests audio processing and speech production.
        </p>

        {!started ? (
          <div className="fade fade-3" style={{ textAlign: "center" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 20 }}>
              Make sure your volume is up! We'll play words and listen for echoes.
            </p>
            <button className="btn btn-primary" onClick={() => { setStarted(true); playWord(); }}
              style={{ minHeight: 52, padding: "12px 36px" }}>
              🔊 Start Audio Test
            </button>
          </div>
        ) : !taskComplete ? (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 20, fontWeight: 600 }}>
              Word {currentIdx + 1} of {WORDS.length}
            </p>

            <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>{word.emoji}</div>

            {wordState === "idle" && (
              <button className="btn btn-primary" onClick={playWord} style={{ minHeight: 48, padding: "10px 28px" }}>
                🔊 Play Word
              </button>
            )}

            {wordState === "playing" && (
              <div>
                <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "2rem", color: "var(--sage-600)", marginBottom: 8 }}>
                  "{word.word}"
                </h2>
                <p style={{ color: "var(--sage-500)", fontWeight: 700, fontSize: "0.9rem" }}>
                  🔊 Playing...
                </p>
              </div>
            )}

            {wordState === "listening" && (
              <div>
                <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.5rem", color: "var(--text-primary)", marginBottom: 12 }}>
                  Now say: "{word.word}"
                </h2>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 24px", borderRadius: "var(--r-full)",
                  background: "var(--sage-50)", border: "2px solid var(--sage-300)",
                }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: "50%", background: "var(--sage-500)",
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

            {wordState === "matched" && (
              <div>
                <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--sage-600)" }}>
                  ✓ Great match!
                </p>
              </div>
            )}

            {wordState === "missed" && (
              <div>
                <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-muted)" }}>
                  No match detected — that's okay!
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center", background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>🎵</div>
            <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 14 }}>
              Audio test complete!
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {matchedCount} of {WORDS.length} words echoed successfully.
            </p>
          </div>
        )}

        <div className="fade fade-4" style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <Link href="/intake/motor" className="btn btn-outline" style={{ minWidth: 100 }}>
            ← Back
          </Link>
          <button className="btn btn-primary btn-full" disabled={!taskComplete}
            onClick={async () => {
              const sid = getCurrentSessionId();
              if (sid) {
                await addBiomarker(sid, "audio_assessment", {
                  gazeScore: 0.5,
                  motorScore: 0.5,
                  vocalizationScore: Math.min(1, matchedCount / WORDS.length),
                }).catch(() => {});
              }
              router.push("/intake/video-capture");
            }}>
            Continue →
          </button>
        </div>
      </main>
    </div>
  );
}
