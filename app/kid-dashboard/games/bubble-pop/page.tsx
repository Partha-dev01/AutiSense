"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { getDifficulty, saveDifficulty } from "../../../lib/games/difficultyEngine";
import { addGameActivity } from "../../../lib/db/gameActivity.repository";
import { updateStreak } from "../../../lib/db/streak.repository";
import NavLogo from "../../../components/NavLogo";
import ThemeToggle from "../../../components/ThemeToggle";

type Screen = "start" | "play" | "result";

interface Bubble {
  id: number;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  popped: boolean;
  shaking: boolean;
}

const POOL = [..."ABCDEFGHIJ", ..."0123456789"];

const BUBBLE_COLORS = [
  "var(--sage-200)", "var(--sage-300)", "var(--sky-200)", "var(--sky-300)",
  "var(--peach-100)", "var(--peach-200)", "#d1c4e9", "#c5e1a5", "#ffe0b2", "#b3e5fc",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const statStyle = {
  fontSize: "1.8rem", fontFamily: "'Fredoka',sans-serif", fontWeight: 700 as const,
  color: "var(--sage-500)",
};
const statLabel = {
  fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 as const,
};

export default function BubblePopPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [target, setTarget] = useState("");
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [totalPops, setTotalPops] = useState(0);
  const [poppedCount, setPoppedCount] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const nextIdRef = useRef(0);
  const [speedMult, setSpeedMult] = useState(1);
  const [maxBubbles, setMaxBubbles] = useState(4);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(s as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const pickNewTarget = useCallback(() => {
    const t = pickRandom(POOL);
    setTarget(t);
    return t;
  }, []);

  const spawnBubble = useCallback(
    (currentTarget: string, idStart: number, count: number, existing: Bubble[] = []): Bubble[] => {
      const result: Bubble[] = [];
      const targetIdx = Math.floor(Math.random() * count);
      // Collect occupied positions (existing active + newly spawned)
      const occupied = existing.filter((b) => !b.popped).map((b) => ({ x: b.x, y: b.y, size: b.size }));

      for (let i = 0; i < count; i++) {
        const isTarget = i === targetIdx;
        let label = isTarget ? currentTarget : pickRandom(POOL);
        while (!isTarget && label === currentTarget) label = pickRandom(POOL);

        const size = 56 + Math.floor(Math.random() * 20);
        // Find a non-overlapping position (try up to 20 times)
        let x = 0, y = 0;
        for (let attempt = 0; attempt < 20; attempt++) {
          x = 5 + Math.random() * 78; // % from left (leave room for bubble width)
          y = 5 + Math.random() * 78; // % from top
          const tooClose = occupied.some((o) => {
            const dx = x - o.x;
            const dy = y - o.y;
            return Math.sqrt(dx * dx + dy * dy) < 16; // min ~16% apart
          });
          if (!tooClose) break;
        }
        occupied.push({ x, y, size });

        result.push({
          id: idStart + i,
          label,
          x, y, size,
          color: pickRandom(BUBBLE_COLORS),
          popped: false,
          shaking: false,
        });
      }
      return result;
    },
    [],
  );

  const startGame = useCallback(() => {
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const config = getDifficulty("bubble-pop", childId);
    const neededPops = config.itemCount * 3;

    setSpeedMult(config.speed);
    setMaxBubbles(Math.min(2 + config.level, 6));
    setTotalPops(neededPops);
    setPoppedCount(0);
    setScore(0);
    setAttempts(0);
    setStartTime(Date.now());
    setElapsed(0);
    setSaved(false);

    const t = pickRandom(POOL);
    setTarget(t);

    const initialCount = Math.min(3 + config.level, 6);
    nextIdRef.current = 0;
    const initial = spawnBubble(t, 0, initialCount, []);
    if (!initial.some((b) => b.label === t)) initial[0].label = t;
    setBubbles(initial);
    nextIdRef.current = initialCount;
    setScreen("play");
  }, [spawnBubble]);

  // Elapsed timer
  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(iv);
  }, [screen, startTime]);

  // Spawn new bubbles periodically — ensure at least 1 is always visible
  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => {
      setBubbles((prev) => {
        const active = prev.filter((b) => !b.popped);
        if (active.length >= maxBubbles) return prev;
        const count = active.length === 0
          ? Math.min(3, maxBubbles)
          : Math.min(2, maxBubbles - active.length);
        const id = nextIdRef.current;
        const spawned = spawnBubble(target, id, count, active);
        nextIdRef.current = id + count;
        return [...active, ...spawned];
      });
    }, 2000);
    return () => clearInterval(iv);
  }, [screen, target, maxBubbles, spawnBubble]);

  // Clean up popped bubbles after pop animation finishes
  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => {
      setBubbles((prev) => prev.filter((b) => !b.popped));
    }, 600);
    return () => clearInterval(iv);
  }, [screen]);

  // Save results on result screen
  useEffect(() => {
    if (screen !== "result" || saved) return;
    setSaved(true);
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const fs = attempts > 0 ? Math.round((score / attempts) * 100) : 0;
    const config = getDifficulty("bubble-pop", childId);
    saveDifficulty("bubble-pop", childId, fs);
    addGameActivity(childId, "bubble-pop", fs, Math.floor(elapsed / 1000), config.level);
    updateStreak(childId);
  }, [screen, saved, score, attempts, elapsed]);

  const handleBubbleTap = (bubble: Bubble) => {
    if (bubble.popped) return;

    if (bubble.label === target) {
      setBubbles((prev) => prev.map((b) => (b.id === bubble.id ? { ...b, popped: true } : b)));
      const newPopped = poppedCount + 1;
      setPoppedCount(newPopped);
      setScore((s) => s + 1);
      setAttempts((a) => a + 1);

      if (newPopped >= totalPops) {
        setScreen("result");
      } else if (newPopped % 3 === 0) {
        pickNewTarget();
      }
    } else {
      setAttempts((a) => a + 1);
      setBubbles((prev) => prev.map((b) => (b.id === bubble.id ? { ...b, shaking: true } : b)));
      setTimeout(() => {
        setBubbles((prev) => prev.map((b) => (b.id === bubble.id ? { ...b, shaking: false } : b)));
      }, 500);
    }
  };

  const finalScore = attempts > 0 ? Math.round((score / attempts) * 100) : 0;

  return (
    <div className="page">
      <style>{`
        @keyframes bubbleIdle {
          0%, 100% { transform: translateY(0) scale(1); }
          33% { transform: translateY(-6px) scale(1.03); }
          66% { transform: translateY(4px) scale(0.97); }
        }
        @keyframes bubbleAppear {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes popAnim {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.4; }
          100% { transform: scale(0); opacity: 0; }
        }
        @keyframes gentleShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-3px); }
        }
        @keyframes targetPulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--sage-200); }
          50% { box-shadow: 0 0 0 8px transparent; }
        }
      `}</style>

      <nav className="nav">
        <NavLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
          <Link href="/kid-dashboard/games" className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}>
            ← Games
          </Link>
        </div>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 540, padding: "40px 28px 80px" }}>
        <Link
          href="/kid-dashboard/games"
          className="btn btn-outline"
          style={{ minHeight: 40, padding: "8px 18px", fontSize: "0.88rem", marginBottom: 28, display: "inline-flex" }}
        >
          Back to Games
        </Link>

        {screen === "start" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>{"\uD83E\uDEE7"}</div>
            <h1 className="page-title">
              Bubble <em>Pop</em>
            </h1>
            <p className="subtitle">
              Pop the bubbles with the right letter or number. Be quick but stay calm!
            </p>
            <button onClick={startGame} className="btn btn-primary btn-full" style={{ maxWidth: 340 }}>
              Start Game
            </button>
          </div>
        )}

        {screen === "play" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{
              display: "flex", justifyContent: "space-between", marginBottom: 12,
              fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600,
            }}>
              <span>{poppedCount} / {totalPops}</span>
              <span>Score: {score}</span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            <div style={{
              fontFamily: "'Fredoka',sans-serif", fontSize: "1.5rem", fontWeight: 600,
              color: "var(--text-primary)", marginBottom: 16, padding: "14px 24px",
              background: "var(--sage-50)", borderRadius: "var(--r-lg)", border: "3px solid var(--sage-300)",
              animation: "targetPulse 2s ease-in-out infinite",
            }}>
              Pop the <span style={{ color: "var(--sage-500)", fontSize: "2.8rem", fontWeight: 700, lineHeight: 1 }}>{target}</span>!
            </div>

            <div style={{
              position: "relative", width: "100%", height: 440,
              borderRadius: "var(--r-lg)", border: "2px solid var(--border)",
              background: "var(--card)", overflow: "hidden",
            }}>
              {bubbles.filter((b) => !b.popped).map((bubble) => (
                <button
                  key={bubble.id}
                  onClick={() => handleBubbleTap(bubble)}
                  aria-label={`Bubble ${bubble.label}`}
                  style={{
                    position: "absolute",
                    left: `${bubble.x}%`, top: `${bubble.y}%`,
                    width: bubble.size, height: bubble.size, borderRadius: "50%",
                    border: "3px solid rgba(255,255,255,0.5)", background: bubble.color,
                    boxShadow: "0 4px 15px rgba(0,0,0,0.1), inset 0 -4px 8px rgba(0,0,0,0.06), inset 0 4px 8px rgba(255,255,255,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: "1.3rem",
                    color: "var(--text-primary)", cursor: "pointer", padding: 0,
                    animation: bubble.shaking
                      ? "gentleShake 0.5s ease"
                      : `bubbleAppear 0.35s ease-out, bubbleIdle ${2.5 + (bubble.id % 3) * 0.5}s ${0.35}s ease-in-out infinite`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  {bubble.label}
                </button>
              ))}
              {bubbles.filter((b) => b.popped).slice(-5).map((bubble) => (
                <div
                  key={`pop-${bubble.id}`}
                  style={{
                    position: "absolute",
                    left: `${bubble.x}%`, top: `${bubble.y}%`,
                    width: bubble.size, height: bubble.size, borderRadius: "50%",
                    background: "var(--sage-300)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: "1.3rem",
                    color: "var(--text-primary)",
                    animation: "popAnim 0.35s ease-out forwards",
                    pointerEvents: "none",
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  {bubble.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>
              {finalScore >= 70 ? "\uD83C\uDFC6" : "\uD83C\uDF1F"}
            </div>
            <h1 className="page-title">
              {finalScore >= 70 ? (<>Great <em>Popping!</em></>) : (<>Nice <em>Try!</em></>)}
            </h1>
            <div style={{
              display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 32,
            }}>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{finalScore}%</div>
                <div style={statLabel}>Accuracy</div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{score}/{totalPops}</div>
                <div style={statLabel}>Popped</div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{Math.floor(elapsed / 1000)}s</div>
                <div style={statLabel}>Time</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={startGame} className="btn btn-primary" style={{ minWidth: 160 }}>
                Play Again
              </button>
              <Link href="/kid-dashboard/games" className="btn btn-outline" style={{ minWidth: 160 }}>
                All Games
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
