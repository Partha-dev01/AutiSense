"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { getDifficulty, saveDifficulty } from "../../lib/games/difficultyEngine";

type Screen = "start" | "play" | "result";

interface SortItem {
  name: string;
  emoji: string;
  category: "animals" | "vehicles";
}

const ALL_ITEMS: SortItem[] = [
  { name: "Dog", emoji: "🐕", category: "animals" },
  { name: "Cat", emoji: "🐱", category: "animals" },
  { name: "Rabbit", emoji: "🐰", category: "animals" },
  { name: "Bird", emoji: "🐦", category: "animals" },
  { name: "Fish", emoji: "🐟", category: "animals" },
  { name: "Bear", emoji: "🐻", category: "animals" },
  { name: "Car", emoji: "🚗", category: "vehicles" },
  { name: "Bus", emoji: "🚌", category: "vehicles" },
  { name: "Train", emoji: "🚂", category: "vehicles" },
  { name: "Plane", emoji: "✈️", category: "vehicles" },
  { name: "Boat", emoji: "⛵", category: "vehicles" },
  { name: "Bike", emoji: "🚲", category: "vehicles" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SortingGamePage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [items, setItems] = useState<SortItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const saved =
      (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const startGame = useCallback(() => {
    const config = getDifficulty("sorting", "default");
    const count = Math.min(config.itemCount * 2, ALL_ITEMS.length);
    const shuffled = shuffle(ALL_ITEMS).slice(0, count);
    setItems(shuffled);
    setCurrentIndex(0);
    setCorrect(0);
    setTotal(count);
    setFeedback(null);
    setStartTime(Date.now());
    setScreen("play");
  }, []);

  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(iv);
  }, [screen, startTime]);

  const handleSort = (category: "animals" | "vehicles") => {
    if (currentIndex >= items.length) return;

    const isCorrect = items[currentIndex].category === category;
    setFeedback(isCorrect ? "correct" : "wrong");
    if (isCorrect) setCorrect((c) => c + 1);

    setTimeout(() => {
      setFeedback(null);
      const nextIndex = currentIndex + 1;
      if (nextIndex >= items.length) {
        const score = Math.round(((correct + (isCorrect ? 1 : 0)) / total) * 100);
        saveDifficulty("sorting", "default", score);
        setScreen("result");
      } else {
        setCurrentIndex(nextIndex);
      }
    }, 600);
  };

  const score =
    total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="logo">
          Auti<em>Sense</em>
        </Link>
        <button
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          className="btn btn-outline"
          style={{ minHeight: 40, padding: "8px 16px", fontSize: "0.9rem" }}
          aria-label="Toggle theme"
        >
          {theme === "light" ? "Dark" : "Light"}
        </button>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 600, padding: "40px 28px 80px" }}>
        <Link
          href="/games"
          className="btn btn-outline"
          style={{
            minHeight: 40,
            padding: "8px 18px",
            fontSize: "0.88rem",
            marginBottom: 28,
            display: "inline-flex",
          }}
        >
          Back to Games
        </Link>

        {screen === "start" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>🗂️</div>
            <h1 className="page-title">
              Category <em>Sorting</em>
            </h1>
            <p className="subtitle">
              Sort each item into the correct category: Animals or Vehicles!
            </p>
            <button onClick={startGame} className="btn btn-primary btn-full" style={{ maxWidth: 340 }}>
              Start Game
            </button>
          </div>
        )}

        {screen === "play" && items[currentIndex] && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 24,
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              <span>
                {currentIndex + 1} / {total}
              </span>
              <span>Correct: {correct}</span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            {/* Current Item */}
            <div
              className="card"
              style={{
                padding: "40px 24px",
                marginBottom: 32,
                textAlign: "center",
                borderColor: feedback === "correct"
                  ? "var(--sage-400)"
                  : feedback === "wrong"
                    ? "var(--peach-300)"
                    : "var(--border)",
                background: feedback === "correct"
                  ? "var(--sage-50)"
                  : feedback === "wrong"
                    ? "var(--peach-100)"
                    : "var(--card)",
                transition: "all 300ms var(--ease)",
              }}
            >
              <div style={{ fontSize: "4rem", marginBottom: 12 }}>
                {items[currentIndex].emoji}
              </div>
              <div
                style={{
                  fontFamily: "'Fredoka',sans-serif",
                  fontWeight: 600,
                  fontSize: "1.3rem",
                  color: "var(--text-primary)",
                }}
              >
                {items[currentIndex].name}
              </div>
              {feedback && (
                <div
                  style={{
                    marginTop: 12,
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: feedback === "correct" ? "var(--sage-500)" : "var(--peach-300)",
                  }}
                >
                  {feedback === "correct" ? "Correct!" : "Try again next time!"}
                </div>
              )}
            </div>

            {/* Sort Buttons */}
            <div style={{ display: "flex", gap: 16 }}>
              <button
                onClick={() => handleSort("animals")}
                className="btn btn-outline btn-full"
                style={{
                  fontSize: "1.05rem",
                  borderColor: "var(--sage-300)",
                  minHeight: 64,
                }}
                disabled={feedback !== null}
              >
                🐾 Animals
              </button>
              <button
                onClick={() => handleSort("vehicles")}
                className="btn btn-outline btn-full"
                style={{
                  fontSize: "1.05rem",
                  borderColor: "var(--sky-300)",
                  minHeight: 64,
                }}
                disabled={feedback !== null}
              >
                🚗 Vehicles
              </button>
            </div>
          </div>
        )}

        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>🏆</div>
            <h1 className="page-title">
              Well <em>Done!</em>
            </h1>
            <div
              style={{
                display: "flex",
                gap: 16,
                justifyContent: "center",
                flexWrap: "wrap",
                marginBottom: 32,
              }}
            >
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    color: "var(--sage-500)",
                  }}
                >
                  {score}%
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Score
                </div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    color: "var(--sage-500)",
                  }}
                >
                  {correct}/{total}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Correct
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={startGame} className="btn btn-primary" style={{ minWidth: 160 }}>
                Play Again
              </button>
              <Link href="/games" className="btn btn-outline" style={{ minWidth: 160 }}>
                All Games
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
