"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  deleteHistory,
  getHistory,
  listHistory,
  type HistoryListItem,
} from "@/lib/auth";
import { stashHistoryResult } from "@/lib/historyStorage";

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setItems(await listHistory());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleOpen(id: number) {
    try {
      const detail = await getHistory(id);
      stashHistoryResult(detail.result);
      router.push("/");
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "打开失败");
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("确定删除这条历史吗？")) return;
    try {
      await deleteHistory(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">分析历史</h1>
          <p className="mt-2 text-sm text-slate-500">
            打开历史会恢复报告与图表；追问需重新上传文件（会话不持久）。
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          返回分析
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-500">加载中…</p>}
      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && items.length === 0 && (
        <p className="text-sm text-slate-500">暂无历史。完成一次分析会自动保存。</p>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {item.filename} ·{" "}
                  {new Date(item.created_at).toLocaleString("zh-CN")}
                </p>
                {item.summary && (
                  <p className="mt-2 text-sm text-slate-600">{item.summary}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleOpen(item.id)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  打开
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(item.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  删除
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
