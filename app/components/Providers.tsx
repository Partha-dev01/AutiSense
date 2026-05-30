"use client";

import { AuthProvider } from "../contexts/AuthContext";
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ServiceWorkerRegistrar />
      {children}
    </AuthProvider>
  );
}
