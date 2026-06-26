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
    const ip = stripPort(cfViewer.trim());
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

/**
 * Strip a trailing ":port" from a CloudFront-Viewer-Address value without
 * mangling IPv6. Handles bracketed IPv6 ("[2001:db8::1]:443" -> "2001:db8::1")
 * and only removes a trailing colon-group when it is a numeric port, so an
 * IPv4 "ip:port" and CloudFront's "ipv6:port" both collapse to the address.
 */
function stripPort(value: string): string {
  if (value.startsWith("[")) {
    const close = value.indexOf("]");
    if (close > 0) return value.slice(1, close);
    return value;
  }
  const lastColon = value.lastIndexOf(":");
  if (lastColon <= 0) return value;
  const suffix = value.slice(lastColon + 1);
  // Only treat the final segment as a port if it is purely numeric. CloudFront
  // always appends a port, so the trailing ":<digits>" is the port for both
  // IPv4 and IPv6; a value with no numeric tail is returned untouched.
  if (/^\d+$/.test(suffix)) return value.slice(0, lastColon);
  return value;
}
