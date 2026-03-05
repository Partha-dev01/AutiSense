"use client";

import { Sun, Moon } from "lucide-react";

interface Props {
  theme: "light" | "dark";
  onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      className="btn btn-outline"
      style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.9rem", display: "inline-flex", alignItems: "center", gap: 6 }}
      aria-label="Toggle theme"
    >
      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
