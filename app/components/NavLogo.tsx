"use client";

import Link from "next/link";
import { useAuth } from "../hooks/useAuth";

export default function NavLogo() {
  const { isAuthenticated } = useAuth();

  return (
    <Link href={isAuthenticated ? "/kid-dashboard" : "/"} className="logo">
      <img src="/logo.jpeg" alt="" className="logo-icon logo-light" />
      <img src="/logo-dark.jpeg" alt="" className="logo-icon logo-dark" />
      <span>Auti<em>Sense</em></span>
    </Link>
  );
}
