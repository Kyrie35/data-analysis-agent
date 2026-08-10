"use client";

import { useState } from "react";

import type { AnalyzeResponse } from "@/lib/api";
import { exportExcel, exportMarkdown } from "@/lib/export";

type ExportButtonsProps = {
  result: AnalyzeResponse;
};

export default function ExportButtons({ result }: ExportButtonsProps) {
  const [busy, setBusy] = useState<"md" | "xlsx" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExcel() {
    setBusy("xlsx");
    setError(null);
    try {
      await exportExcel(result);
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : "导出 Excel 失败",
      );
    } finally {
      setBusy(null);
    }
  }

  function handleMarkdown() {
    setBusy("md");
    setError(null);
    try {
      exportMarkdown(result);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "导出 Markdown 失败",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">导出分析结果</h2>
          <p className="mt-1 text-xs text-slate-500">
            导出内容与当前页面一致，含偏好变换说明、指标、报告与图表数据。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={handleMarkdown}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "md" ? "导出中…" : "导出 Markdown"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void handleExcel()}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {busy === "xlsx" ? "导出中…" : "导出 Excel"}
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
