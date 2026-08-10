"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "@/components/AuthProvider";
import RequireAuth from "@/components/RequireAuth";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RequireAuth>{children}</RequireAuth>
    </AuthProvider>
  );
}
