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
const STEP_IDX = 6;

const INSTRUCTIONS = [
  { text: "Touch your nose", emoji: "👃", action: "nose" },
  { text: "Clap your hands", emoji: "👏", action: "clap" },
  { text: "Wave hello", emoji: "👋", action: "wave" },
  { text: "Point to the sky", emoji: "☝️", action: "point" },
  { text: "Stomp your feet", emoji: "🦶", action: "stomp" },
];

export default function PreparationPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [started, setStarted] = useState(false);
  const [taskComplete, setTaskComplete] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState<"speaking" | "waiting" | "done">("speaking");
  const [results, setResults] = useState<("completed" | "skipped")[]>([]);
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleResponseRef = useRef<((result: "completed" | "skipped") => void) | null>(null);

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const speakInstruction = useCallback((text: string) => {
    setPhase("speaking");
    // Use browser SpeechSynthesis (Amazon Polly will replace this in production)
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85;
      utterance.pitch = 1.1;
      utterance.onend = () => {
        setPhase("waiting");
        // Give 8 seconds for child to respond
        waitTimerRef.current = setTimeout(() => {
          handleResponseRef.current?.("skipped");
        }, 8000);
      };
      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback: just show text and wait
      setTimeout(() => {
        setPhase("waiting");
        waitTimerRef.current = setTimeout(() => handleResponseRef.current?.("skipped"), 8000);
      }, 2000);
    }
  }, []);

  const handleResponse = useCallback((result: "completed" | "skipped") => {
    if (waitTimerRef.current) {
      clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
    setResults((prev) => [...prev, result]);
    if (currentIdx >= INSTRUCTIONS.length - 1) {
      setTaskComplete(true);
    } else {
      setCurrentIdx((i) => i + 1);
      setPhase("speaking");
    }
  }, [currentIdx]);
  handleResponseRef.current = handleResponse;

  // Speak instruction when index changes
  useEffect(() => {
    if (started && !taskComplete && currentIdx < INSTRUCTIONS.length) {
      speakInstruction(INSTRUCTIONS[currentIdx].text);
    }
    return () => {
      if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
    };
  }, [currentIdx, started, taskComplete, speakInstruction]);

  const startTask = () => setStarted(true);

  const instruction = INSTRUCTIONS[currentIdx];
  const completedCount = results.filter((r) => r === "completed").length;

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
            <div className="breathe-inner">🎯</div>
          </div>
        </div>

        <div className="chip fade fade-1">Step 7 — Follow Instructions</div>
        <h1 className="page-title fade fade-2">
          Can they <em>follow along?</em>
        </h1>
        <p className="subtitle fade fade-2">
          We&apos;ll say simple instructions out loud. Watch if your child follows
          them, then tap &quot;Did it!&quot; or &quot;Skip&quot; for each one.
        </p>

        {!started ? (
          <div className="fade fade-3" style={{ textAlign: "center" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 20 }}>
              Make sure your device volume is on so your child can hear the instructions.
            </p>
            <button className="btn btn-primary" onClick={startTask} style={{ minHeight: 52, padding: "12px 36px" }}>
              🔊 Start Instructions
            </button>
          </div>
        ) : !taskComplete ? (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 20, fontWeight: 600 }}>
              Instruction {currentIdx + 1} of {INSTRUCTIONS.length}
            </p>

            <div style={{ fontSize: "3.5rem", marginBottom: 16 }}>{instruction.emoji}</div>
            <h2 style={{
              fontFamily: "'Fredoka',sans-serif", fontWeight: 600,
              fontSize: "1.5rem", marginBottom: 8, color: "var(--text-primary)",
            }}>
              &quot;{instruction.text}&quot;
            </h2>

            {phase === "speaking" && (
              <p style={{ color: "var(--sage-500)", fontWeight: 700, fontSize: "0.9rem", marginBottom: 20 }}>
                🔊 Speaking...
              </p>
            )}

            {phase === "waiting" && (
              <div style={{ marginTop: 20 }}>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 16 }}>
                  Did your child do it?
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <button className="btn btn-primary"
                    style={{ minHeight: 48, padding: "10px 28px" }}
                    onClick={() => handleResponse("completed")}>
                    ✓ Did it!
                  </button>
                  <button className="btn btn-outline"
                    style={{ minHeight: 48, padding: "10px 28px" }}
                    onClick={() => handleResponse("skipped")}>
                    Skip →
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center", background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>✅</div>
            <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 14 }}>
              Instructions complete!
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Your child followed {completedCount} of {INSTRUCTIONS.length} instructions.
            </p>
          </div>
        )}

        <div className="fade fade-4" style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <Link href="/intake/behavioral-observation" className="btn btn-outline" style={{ minWidth: 100 }}>
            ← Back
          </Link>
          <button className="btn btn-primary btn-full" disabled={!taskComplete}
            onClick={async () => {
              const sid = getCurrentSessionId();
              if (sid) {
                await addBiomarker(sid, "preparation_interactive", {
                  gazeScore: 0.5,
                  motorScore: 0.5,
                  vocalizationScore: Math.min(1, completedCount / INSTRUCTIONS.length),
                }).catch(() => {});
              }
              router.push("/intake/motor");
            }}>
            Continue →
          </button>
        </div>
      </main>
    </div>
  );
}
