/**
 * POST /api/auth/logout
 *
 * Logs the user out:
 *  1. Reads session cookie
 *  2. Deletes session from DynamoDB
 *  3. Clears session cookie
 *  4. Redirects to /
 */
import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/app/lib/auth/config";
import { deleteAuthSession } from "@/app/lib/auth/dynamodb";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_CONFIG.sessionCookieName)?.value;

  if (token) {
    try {
      await deleteAuthSession(token);
    } catch (err) {
      console.error("[auth/logout] Error deleting session:", err);
      // Continue with logout even if DynamoDB delete fails
    }
  }

  const response = NextResponse.redirect(`${AUTH_CONFIG.appUrl}/`, {
    status: 303, // See Other — proper redirect after POST
  });

  // Clear the session cookie
  response.cookies.set(AUTH_CONFIG.sessionCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
