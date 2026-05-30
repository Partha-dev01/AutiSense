/**
 * Local guest identity for the FOSS build (no accounts, no server session).
 *
 * A random id is persisted in localStorage so a device keeps a stable identity
 * across reloads; clearing it (logout / "delete my data") yields a fresh guest
 * on the next load. Only used when {@link IS_FOSS_BUILD} is true — the default
 * build continues to use the signed server session via /api/auth/session.
 */

const GUEST_ID_KEY = "autisense-guest-id";

/** Matches AuthContext's AuthUser shape (id, email, name, picture). */
export interface GuestUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

/** Returns the persisted guest id, creating + storing one on first call. */
export function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "guest-ssr";
  try {
    let id = window.localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      const rand =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      id = "guest-" + rand;
      window.localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private mode / blocked) → non-persistent id.
    return "guest-ephemeral";
  }
}

/** Removes the persisted guest id (a new one is created on next load). */
export function clearGuestId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GUEST_ID_KEY);
  } catch {
    // ignore
  }
}

/** Builds a guest User object compatible with AuthContext's User shape. */
export function makeGuestUser(): GuestUser {
  return {
    id: getOrCreateGuestId(),
    email: "",
    name: "Guest",
    picture: "",
  };
}
