/**
 * Shared auth guard for API routes.
 *
 * Usage:
 *   const user = await requireApiAuth(req);
 *   if (user instanceof NextResponse) return user; // 401
 *   // user is SessionUser
 */
import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "./config";
import { getAuthSession, getUserById } from "./dynamodb";

export interface ApiUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Validates session cookie and returns user, or a 401 NextResponse.
 * Caller must check: `if (result instanceof NextResponse) return result;`
 */
export async function requireApiAuth(
  req: NextRequest,
): Promise<ApiUser | NextResponse> {
  const token = req.cookies.get(AUTH_CONFIG.sessionCookieName)?.value;
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const session = await getAuthSession(token);
    if (!session) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    return { id: user.id, email: user.email, name: user.name };
  } catch {
    return NextResponse.json({ error: "Auth check failed" }, { status: 401 });
  }
}

/**
 * Optional auth — returns user or null (no 401).
 * Use for routes that work for both authenticated and anonymous users.
 */
export async function optionalApiAuth(
  req: NextRequest,
): Promise<ApiUser | null> {
  const result = await requireApiAuth(req);
  if (result instanceof NextResponse) return null;
  return result;
}
