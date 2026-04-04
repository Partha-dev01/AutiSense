import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CANONICAL_HOST = "autisense.imaginaerium.in";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  // Redirect amplifyapp.com → custom domain
  if (host.includes("amplifyapp.com")) {
    const url = new URL(request.url);
    url.host = CANONICAL_HOST;
    url.protocol = "https";
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|icon.svg|models/|logo.jpeg).*)",
};
