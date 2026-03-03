/**
 * useAuth — Client-side authentication hook.
 *
 * Fetches /api/auth/session on mount and returns the current user state.
 * Use in Client Components that need to know if the user is logged in.
 *
 * @example
 *   const { user, loading, isAuthenticated } = useAuth();
 */
"use client";

import { useState, useEffect, useCallback } from "react";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  /** Re-fetch session data (e.g. after profile update) */
  refresh: () => Promise<void>;
  /** Log the user out — calls POST /api/auth/logout, then redirects */
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
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
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore network errors — we still clear local state
    }
    setUser(null);
    window.location.href = "/";
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    refresh: fetchSession,
    logout,
  };
}
