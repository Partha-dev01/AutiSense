import type { NextRequest } from "next/server";

/**
 * Best-effort real client IP for rate-limiting keys.
 *
 * The left-most `X-Forwarded-For` entry is supplied by the client and is
 * trivially spoofable — keying a rate limiter on it lets an attacker mint
 * unlimited buckets. Behind Amplify/CloudFront the trusted edge APPENDS the
 * viewer's address, so the right-most XFF entry (or the dedicated
 * `CloudFront-Viewer-Address` header) is the value we can actually trust.
 */
export function getClientIp(request: NextRequest): string {
  // CloudFront (Amplify hosting) sets this to "ip:port" — strip the port.
  const cfViewer = request.headers.get("cloudfront-viewer-address");
  if (cfViewer) {
    const lastColon = cfViewer.lastIndexOf(":");
    const ip = (lastColon > 0 ? cfViewer.slice(0, lastColon) : cfViewer).trim();
    if (ip) return ip;
  }

  // Right-most XFF hop = appended by the trusted proxy, not the client.
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
