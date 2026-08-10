"use client";

import Link from "next/link";

import { useAuth } from "@/components/AuthProvider";

export default function AuthBar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/history"
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        历史
      </Link>
      <span className="text-sm text-slate-600">{user.username}</span>
      <button
        type="button"
        onClick={logout}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        退出
      </button>
    </div>
  );
}
