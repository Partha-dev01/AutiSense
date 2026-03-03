/**
 * Manages the current active session ID in localStorage.
 * Used to propagate sessionId across intake flow pages without URL params.
 */
const KEY = "autisense-current-session-id";

export function setCurrentSessionId(id: string): void {
  if (typeof window !== "undefined") localStorage.setItem(KEY, id);
}

export function getCurrentSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function clearCurrentSessionId(): void {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}
