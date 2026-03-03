export interface GameConfig {
  level: number; // 1-5
  speed: number; // multiplier
  itemCount: number; // items per round
  timeLimit: number; // seconds
}

const STORAGE_PREFIX = "autisense-game-difficulty";

function getKey(gameId: string, childId: string): string {
  return `${STORAGE_PREFIX}-${gameId}-${childId}`;
}

interface StoredDifficulty {
  level: number;
  scores: number[];
}

/**
 * Reads past scores from localStorage and returns an appropriate difficulty config.
 * Starts at level 1. Increases when average score > 80%, decreases when < 40%.
 */
export function getDifficulty(gameId: string, childId: string): GameConfig {
  if (typeof window === "undefined") {
    return buildConfig(1);
  }

  const key = getKey(gameId, childId);
  const raw = localStorage.getItem(key);

  if (!raw) {
    return buildConfig(1);
  }

  try {
    const stored: StoredDifficulty = JSON.parse(raw);
    return buildConfig(stored.level);
  } catch {
    return buildConfig(1);
  }
}

/**
 * Saves a score and adjusts the stored difficulty level.
 * Score should be 0-100.
 */
export function saveDifficulty(
  gameId: string,
  childId: string,
  score: number,
): void {
  if (typeof window === "undefined") return;

  const key = getKey(gameId, childId);
  const raw = localStorage.getItem(key);

  let stored: StoredDifficulty = { level: 1, scores: [] };

  if (raw) {
    try {
      stored = JSON.parse(raw);
    } catch {
      // Reset if corrupted
    }
  }

  stored.scores.push(score);

  // Only consider last 5 scores for adjustment
  const recent = stored.scores.slice(-5);
  const avg = recent.reduce((sum, s) => sum + s, 0) / recent.length;

  if (avg > 80 && stored.level < 5) {
    stored.level += 1;
  } else if (avg < 40 && stored.level > 1) {
    stored.level -= 1;
  }

  localStorage.setItem(key, JSON.stringify(stored));
}

function buildConfig(level: number): GameConfig {
  const clamped = Math.max(1, Math.min(5, level));

  return {
    level: clamped,
    speed: 0.8 + clamped * 0.15, // 0.95 to 1.55
    itemCount: 2 + clamped, // 3 to 7
    timeLimit: Math.max(10, 35 - clamped * 5), // 30 down to 10
  };
}
