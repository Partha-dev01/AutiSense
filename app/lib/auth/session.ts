/**
 * Server-side session helpers.
 *
 * These run in Server Components and Route Handlers (App Router only).
 * They read the session cookie, validate against DynamoDB, and return
 * the authenticated user or redirect to the login page.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_CONFIG } from "./config";
import { getAuthSession, getUserById } from "./dynamodb";
import { logger } from "../logger";

const log = logger("auth/session");

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

/**
 * Read and validate the current session.
 * Returns the user if authenticated, null otherwise.
 * Safe to call from any Server Component or Route Handler.
 */
export async function getServerSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIG.sessionCookieName)?.value;

  if (!token) return null;

  try {
    const session = await getAuthSession(token);
    if (!session) return null;

    const user = await getUserById(session.userId);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    };
  } catch (err) {
    log.error("getServerSession error", { error: err });
    return null;
  }
}

/**
 * Require authentication — redirects to /auth/login if no valid session.
 * Use in Server Components that need a logged-in user.
 *
 * @example
 *   export default async function DashboardPage() {
 *     const user = await requireAuth();
 *     return <h1>Welcome, {user.name}</h1>;
 *   }
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getServerSession();
  if (!user) {
    redirect("/auth/login");
  }
  return user;
}
