/**
 * Unified TTS helper: tries Amazon Polly via /api/tts first,
 * falls back to browser speechSynthesis API.
 */

let currentAudio: HTMLAudioElement | null = null;

/**
 * Speak text aloud. Tries Polly first, falls back to browser TTS.
 * Returns a promise that resolves when speech ends.
 */
export async function speakText(text: string): Promise<void> {
  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    if (currentAudio.src) URL.revokeObjectURL(currentAudio.src);
    currentAudio = null;
  }

  // Cancel any ongoing browser speech
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // Try Polly first
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      return new Promise<void>((resolve) => {
        const audio = new Audio(url);
        currentAudio = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          currentAudio = null;
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          currentAudio = null;
          resolve();
        };
        audio.play().catch(() => {
          URL.revokeObjectURL(url);
          currentAudio = null;
          // Polly audio failed to play, try browser TTS
          browserSpeak(text).then(resolve);
        });
      });
    }
  } catch {
    // Polly unavailable, fall through to browser TTS
  }

  return browserSpeak(text);
}

/**
 * Browser speechSynthesis fallback.
 */
function browserSpeak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85; // slightly slower for kids
    utterance.pitch = 1.1; // slightly higher pitch for friendliness
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    speechSynthesis.speak(utterance);
  });
}

/**
 * Request microphone permission and check speech recognition support.
 * Returns { supported, permitted, error? }
 */
export async function checkMicSupport(): Promise<{
  supported: boolean;
  permitted: boolean;
  error?: string;
}> {
  const SR =
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

  if (!SR) {
    return {
      supported: false,
      permitted: false,
      error: "Speech recognition is not supported in this browser. Try Chrome.",
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop the stream immediately — we just needed the permission
    stream.getTracks().forEach((t) => t.stop());
    return { supported: true, permitted: true };
  } catch {
    return {
      supported: true,
      permitted: false,
      error: "Microphone access denied. Please allow microphone in your browser settings.",
    };
  }
}
