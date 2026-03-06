"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Gamepad2, MessageCircle, BarChart3, MapPin } from "lucide-react";

const tabs = [
  { href: "/kid-dashboard", label: "Home", Icon: Home },
  { href: "/kid-dashboard/games", label: "Games", Icon: Gamepad2 },
  { href: "/kid-dashboard/chat", label: "Chat", Icon: MessageCircle },
  { href: "/kid-dashboard/progress", label: "Progress", Icon: BarChart3 },
  { href: "/kid-dashboard/nearby-help", label: "Help", Icon: MapPin },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        background: "var(--card)",
        borderTop: "1px solid var(--border)",
        borderRadius: "20px 20px 0 0",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        minHeight: 64,
        width: "100%",
        maxWidth: 600,
        paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
      }}
    >
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/kid-dashboard"
            ? pathname === "/kid-dashboard"
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              textDecoration: "none",
              color: isActive ? "var(--sage-600)" : "var(--text-muted)",
              minWidth: 56,
              minHeight: 56,
              justifyContent: "center",
              borderRadius: "var(--r-md)",
              transition: "color 200ms var(--ease)",
            }}
          >
            <tab.Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: isActive ? 700 : 500,
                fontFamily: "'Fredoka',sans-serif",
                letterSpacing: "0.02em",
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
