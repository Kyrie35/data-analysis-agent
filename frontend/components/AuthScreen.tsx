"use client";

import { FormEvent, useState } from "react";

import { useAuth } from "@/components/AuthProvider";

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "操作失败",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-sm font-medium text-blue-600">数航助手 DataPilot</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          {mode === "login" ? "登录后继续" : "创建账号"}
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          登录后可使用表报生成、语义取数，保存历史任务，并同步偏好库。
        </p>
      </div>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              mode === "login"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              mode === "register"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            注册
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">用户名</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="请输入用户名"
            />
          </label>
          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="至少 6 位"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !username.trim() || password.length < 6}
            className="w-full rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {busy
              ? "处理中…"
              : mode === "login"
                ? "登录"
                : "注册并进入"}
          </button>
        </div>
      </form>
    </main>
  );
}
