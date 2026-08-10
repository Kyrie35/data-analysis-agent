"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/components/AuthProvider";
import AuthScreen from "@/components/AuthScreen";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-slate-500">加载中…</p>
      </main>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <>{children}</>;
}
