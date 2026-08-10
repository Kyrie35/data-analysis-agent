"use client";

import { useEffect, useMemo, useState } from "react";

import AnalysisReport from "@/components/AnalysisReport";
import AuthBar from "@/components/AuthBar";
import ChartPanel from "@/components/ChartPanel";
import ChartTypeSelector from "@/components/ChartTypeSelector";
import ChatPanel from "@/components/ChatPanel";
import CompareResultView from "@/components/CompareResultView";
import DataSourcePanel, {
  type AnalysisMode,
} from "@/components/DataSourcePanel";
import ExportButtons from "@/components/ExportButtons";
import MetricsCards from "@/components/MetricsCards";
import PreferenceLibrary from "@/components/PreferenceLibrary";
import PreferenceSelector from "@/components/PreferenceSelector";
import {
  analyzeFile,
  compareFiles,
  type AnalyzeResponse,
  type CompareResponse,
} from "@/lib/api";
import { getAuth, pushCloudPreferences, saveHistory } from "@/lib/auth";
import {
  ALL_CHART_TYPES,
  CHART_TYPE_LABELS,
  type ChartTypeOption,
  normalizeSelectedChartTypes,
} from "@/lib/chartTypes";
import { takeHistoryResult } from "@/lib/historyStorage";
import {
  loadGroups,
  loadPreferences,
  toPreferencePayloads,
  type PreferenceGroup,
  type PreferenceItem,
} from "@/lib/preferences";

const TYPE_LABELS: Record<string, string> = {
  date: "日期",
  number: "数值",
  boolean: "布尔",
  text: "文本",
};

export default function HomePage() {
  const [mode, setMode] = useState<AnalysisMode>("single");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(
    null,
  );
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [groups, setGroups] = useState<PreferenceGroup[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [usePreferences, setUsePreferences] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [prefHint, setPrefHint] = useState<string | null>(null);
  const [lastUsedPreferences, setLastUsedPreferences] = useState(false);
  const [selectedChartTypes, setSelectedChartTypes] = useState<ChartTypeOption[]>([
    ...ALL_CHART_TYPES,
  ]);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadPreferences();
    setPreferences(loaded);
    setGroups(loadGroups());
    setSelectedIds(loaded.filter((item) => item.enabled).map((item) => item.id));

    const restored = takeHistoryResult<AnalyzeResponse | CompareResponse>();
    if (restored && "mode" in restored && restored.mode === "compare") {
      setMode("compare");
      setCompareResult(restored);
      setResult(null);
      setLastUsedPreferences(Boolean(restored.analysis.used_preferences));
      setHistoryNotice("已从历史恢复对比结果。");
    } else if (
      restored &&
      "overview" in restored &&
      restored.overview &&
      restored.analysis
    ) {
      setMode("single");
      setResult(restored as AnalyzeResponse);
      setCompareResult(null);
      setLastUsedPreferences(Boolean(restored.analysis.used_preferences));
      setHistoryNotice(
        "已从历史恢复结果。若要继续追问，请重新上传同一文件以建立数据会话。",
      );
    }
  }, []);

  const selectedPreferences = useMemo(
    () => preferences.filter((item) => selectedIds.includes(item.id)),
    [preferences, selectedIds],
  );

  async function syncPrefsIfLoggedIn(
    items: PreferenceItem[],
    nextGroups: PreferenceGroup[],
  ) {
    if (!getAuth()?.token) return;
    try {
      await pushCloudPreferences({ preferences: items, groups: nextGroups });
    } catch {
      // ignore sync errors for local editing
    }
  }

  function handleLibraryChange(
    items: PreferenceItem[],
    nextGroups: PreferenceGroup[],
  ) {
    setPreferences(items);
    setGroups(nextGroups);
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
    void syncPrefsIfLoggedIn(items, nextGroups);
  }

  function handleUsePreferencesChange(value: boolean) {
    setUsePreferences(value);
    setPrefHint(null);
    if (value && preferences.length === 0) {
      setPrefHint("偏好库为空，请先添加偏好后再启用。");
    }
  }

  function validatePreferences(): boolean {
    if (!usePreferences) return true;
    if (preferences.length === 0 || selectedPreferences.length === 0) {
      setPrefHint("已启用偏好，但未选中任何条目。请先添加并勾选偏好，或关闭开关。");
      return false;
    }
    return true;
  }

  function handleModeChange(next: AnalysisMode) {
    setMode(next);
    setError(null);
    setResult(null);
    setCompareResult(null);
    setHistoryNotice(null);
  }

  async function handleAnalyze(file: File, sheetName: string | null) {
    if (!validatePreferences()) return;

    const chartTypes = normalizeSelectedChartTypes(selectedChartTypes);

    setLoading(true);
    setError(null);
    setPrefHint(null);
    setHistoryNotice(null);
    setCompareResult(null);

    try {
      const data = await analyzeFile(file, {
        usePreferences,
        preferences: toPreferencePayloads(selectedPreferences),
        chartTypes,
        sheetName,
      });
      setResult(data);
      setLastUsedPreferences(Boolean(data.analysis.used_preferences));
      if (getAuth()?.token) {
        try {
          await saveHistory(data);
          setHistoryNotice("已保存到分析历史");
        } catch {
          setHistoryNotice("分析完成，但保存历史失败（可稍后重试登录状态）");
        }
      }
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

  async function handleCompare(
    fileA: File,
    sheetA: string | null,
    fileB: File,
    sheetB: string | null,
  ) {
    if (!validatePreferences()) return;

    const chartTypes = normalizeSelectedChartTypes(selectedChartTypes);

    setLoading(true);
    setError(null);
    setPrefHint(null);
    setHistoryNotice(null);
    setResult(null);

    try {
      const data = await compareFiles(fileA, fileB, {
        usePreferences,
        preferences: toPreferencePayloads(selectedPreferences),
        chartTypes,
        sheetA,
        sheetB,
      });
      setCompareResult(data);
      setLastUsedPreferences(Boolean(data.analysis.used_preferences));
      if (getAuth()?.token) {
        try {
          await saveHistory(data, `对比 ${fileA.name} vs ${fileB.name}`);
          setHistoryNotice("对比结果已保存到分析历史");
        } catch {
          setHistoryNotice("对比完成，但保存历史失败（可稍后重试登录状态）");
        }
      }
    } catch (compareError) {
      const message =
        compareError instanceof Error ? compareError.message : "未知错误";
      setError(message);
      setCompareResult(null);
      setLastUsedPreferences(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-600">阶段 4 · 多文件场景</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            数据分析 Agent
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            支持 Excel 多 Sheet 选择，以及双文件对比。分析完成后可导出并自动保存历史。
            偏好库会同步到云端。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            偏好库
          </button>
          <AuthBar />
        </div>
      </header>

      <DataSourcePanel
        mode={mode}
        onModeChange={handleModeChange}
        loading={loading}
        onAnalyze={handleAnalyze}
        onCompare={handleCompare}
      />

      <ChartTypeSelector
        selected={selectedChartTypes}
        onChange={setSelectedChartTypes}
      />

      <PreferenceSelector
        preferences={preferences}
        groups={groups}
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

      {historyNotice && (
        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {historyNotice}
        </div>
      )}

      {result && (
        <section className="mt-8 space-y-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="文件名" value={result.overview.filename} />
            <StatCard label="行数" value={String(result.overview.rows)} />
            <StatCard
              label={result.overview.sheet_name ? "工作表 / 列数" : "列数"}
              value={
                result.overview.sheet_name
                  ? `${result.overview.sheet_name} · ${result.overview.columns}`
                  : String(result.overview.columns)
              }
            />
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
              {result.pipeline.chart_types &&
                result.pipeline.chart_types.length > 0 && (
                  <p className="mt-1 opacity-90">
                    勾选图型：
                    {result.pipeline.chart_types
                      .map(
                        (type) =>
                          CHART_TYPE_LABELS[type as ChartTypeOption] ?? type,
                      )
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

          <ExportButtons result={result} />

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
                  <ChartPanel key={`${chart.type}-${chart.title}`} chart={chart} />
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

      {compareResult && <CompareResultView result={compareResult} />}

      <PreferenceLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onChange={handleLibraryChange}
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
