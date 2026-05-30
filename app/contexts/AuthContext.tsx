"use client";

import { createContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { IS_FOSS_BUILD } from "../lib/foss";
import { makeGuestUser, clearGuestId } from "../lib/auth/guestSession";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAuthenticated: false,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    // FOSS build: no server session — synthesize a local guest user from a
    // persisted localStorage id and skip the /api/auth/session fetch (that
    // route does not exist in the static-export build).
    if (IS_FOSS_BUILD) {
      setUser(makeGuestUser());
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/auth/session", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const logout = useCallback(async () => {
    // FOSS build: no server session to clear — drop the local guest id and
    // return home (a fresh guest is created on next load).
    if (IS_FOSS_BUILD) {
      clearGuestId();
      setUser(null);
      window.location.href = "/";
      return;
    }
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        redirect: "manual",
      });
    } catch {
      // Ignore network errors — still clear local state
    }
    setUser(null);
    window.location.href = "/";
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        refresh: fetchSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
