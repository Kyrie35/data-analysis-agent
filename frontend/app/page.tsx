"use client";

import { useEffect, useMemo, useState } from "react";

import AnalysisReport from "@/components/AnalysisReport";
import ChartPanel from "@/components/ChartPanel";
import ChatPanel from "@/components/ChatPanel";
import FileUpload from "@/components/FileUpload";
import MetricsCards from "@/components/MetricsCards";
import PreferenceLibrary from "@/components/PreferenceLibrary";
import PreferenceSelector from "@/components/PreferenceSelector";
import { analyzeFile, type AnalyzeResponse } from "@/lib/api";
import {
  loadPreferences,
  toPreferencePayloads,
  type PreferenceItem,
} from "@/lib/preferences";

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
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [usePreferences, setUsePreferences] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [prefHint, setPrefHint] = useState<string | null>(null);
  const [lastUsedPreferences, setLastUsedPreferences] = useState(false);

  useEffect(() => {
    const loaded = loadPreferences();
    setPreferences(loaded);
    setSelectedIds(loaded.filter((item) => item.enabled).map((item) => item.id));
  }, []);

  const selectedPreferences = useMemo(
    () => preferences.filter((item) => selectedIds.includes(item.id)),
    [preferences, selectedIds],
  );

  function handlePreferencesChange(items: PreferenceItem[]) {
    setPreferences(items);
    setSelectedIds((prev) => {
      const enabledDefaults = items
        .filter((item) => item.enabled)
        .map((item) => item.id);
      const stillExisting = prev.filter((id) =>
        items.some((item) => item.id === id),
      );
      if (stillExisting.length > 0) return stillExisting;
      return enabledDefaults;
    });
  }

  function handleUsePreferencesChange(value: boolean) {
    setUsePreferences(value);
    setPrefHint(null);
    if (value && preferences.length === 0) {
      setPrefHint("偏好库为空，请先添加偏好后再启用。");
    }
  }

  async function handleUpload(file: File) {
    if (usePreferences) {
      if (preferences.length === 0 || selectedPreferences.length === 0) {
        setPrefHint("已启用偏好，但未选中任何条目。请先添加并勾选偏好，或关闭开关。");
        return;
      }
    }

    setLoading(true);
    setError(null);
    setPrefHint(null);

    try {
      const data = await analyzeFile(file, {
        usePreferences,
        preferences: toPreferencePayloads(selectedPreferences),
      });
      setResult(data);
      setLastUsedPreferences(Boolean(data.analysis.used_preferences));
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "未知错误";
      setError(message);
      setResult(null);
      setLastUsedPreferences(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-600">阶段 3 · AI 智能分析</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            数据分析 Agent
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            上传 CSV 或 Excel：先读取偏好约束并改写分析口径，再生成报告与指标/图表。
            如「订单数按 80%」「销售额按 120%」会真实作用于可视化数字。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          偏好库
        </button>
      </header>

      <FileUpload onUpload={handleUpload} loading={loading} />

      <PreferenceSelector
        preferences={preferences}
        usePreferences={usePreferences}
        selectedIds={selectedIds}
        onUsePreferencesChange={handleUsePreferencesChange}
        onSelectedIdsChange={(ids) => {
          setSelectedIds(ids);
          setPrefHint(null);
        }}
        onOpenLibrary={() => setLibraryOpen(true)}
        hint={prefHint}
      />

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

          {result.pipeline && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                result.pipeline.mode === "ai_plan"
                  ? "border-blue-200 bg-blue-50 text-blue-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <p className="font-medium">
                {result.pipeline.mode === "ai_plan"
                  ? "报告与可视化基于偏好约束后的分析口径"
                  : "已回退规则可视化"}
              </p>
              {result.pipeline.message && (
                <p className="mt-1 opacity-90">{result.pipeline.message}</p>
              )}
              {result.pipeline.applied_transforms &&
                result.pipeline.applied_transforms.length > 0 && (
                  <p className="mt-1 opacity-90">
                    已应用变换：
                    {result.pipeline.applied_transforms
                      .map((item) => item.label)
                      .join("、")}
                  </p>
                )}
              {result.pipeline.mode === "ai_plan" &&
                result.pipeline.scenario && (
                  <p className="mt-1 opacity-90">
                    场景：{result.pipeline.scenario}
                    {result.pipeline.focus && result.pipeline.focus.length > 0
                      ? ` · 关注：${result.pipeline.focus.join("、")}`
                      : ""}
                  </p>
                )}
            </div>
          )}

          <AnalysisReport analysis={result.analysis} />

          <MetricsCards metrics={result.metrics} />

          {result.charts.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">
                可视化图表
                {result.pipeline?.applied_transforms &&
                result.pipeline.applied_transforms.length > 0
                  ? "（偏好口径）"
                  : ""}
              </h2>
              <div className="grid gap-6 lg:grid-cols-2">
                {result.charts.map((chart) => (
                  <ChartPanel key={chart.title} chart={chart} />
                ))}
              </div>
            </section>
          )}

          <ChatPanel
            result={result}
            preferences={preferences}
            selectedIds={selectedIds}
            initialUsePreferences={lastUsedPreferences}
          />

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

      <PreferenceLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onChange={handlePreferencesChange}
      />
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
