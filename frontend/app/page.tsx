"use client";

import { useState } from "react";

import AnalysisReport from "@/components/AnalysisReport";
import ChartPanel from "@/components/ChartPanel";
import FileUpload from "@/components/FileUpload";
import MetricsCards from "@/components/MetricsCards";
import { analyzeFile, type AnalyzeResponse } from "@/lib/api";

const TYPE_LABELS: Record<string, string> = {
  date: "日期",
  number: "数值",
  boolean: "布尔",
  text: "文本",
};

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  async function handleUpload(file: File) {
    setLoading(true);
    setError(null);

    try {
      const data = await analyzeFile(file);
      setResult(data);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "未知错误";
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-sm font-medium text-blue-600">阶段 3 · AI 智能分析</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          数据分析 Agent
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          上传 CSV 或 Excel，自动计算指标、生成图表，并由 DeepSeek 输出分析总结与建议。
        </p>
      </header>

      <FileUpload onUpload={handleUpload} loading={loading} />

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <section className="mt-8 space-y-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="文件名" value={result.overview.filename} />
            <StatCard label="行数" value={String(result.overview.rows)} />
            <StatCard label="列数" value={String(result.overview.columns)} />
          </div>

          <MetricsCards metrics={result.metrics} />

          <AnalysisReport analysis={result.analysis} />

          {result.charts.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">可视化图表</h2>
              <div className="grid gap-6 lg:grid-cols-2">
                {result.charts.map((chart) => (
                  <ChartPanel key={chart.title} chart={chart} />
                ))}
              </div>
            </section>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">列信息</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">列名</th>
                    <th className="px-3 py-2 font-medium">类型</th>
                  </tr>
                </thead>
                <tbody>
                  {result.overview.column_names.map((name) => (
                    <tr key={name} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {name}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {TYPE_LABELS[result.overview.column_types[name]] ??
                          result.overview.column_types[name]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">前 5 行预览</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    {result.overview.column_names.map((name) => (
                      <th key={name} className="px-3 py-2 font-medium">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.preview.map((row, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      {result.overview.column_names.map((name) => (
                        <td key={name} className="px-3 py-2 text-slate-700">
                          {formatCell(row[name])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 truncate text-xl font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
