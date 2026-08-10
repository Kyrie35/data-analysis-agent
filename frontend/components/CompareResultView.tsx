"use client";

import AnalysisReport from "@/components/AnalysisReport";
import ChartPanel from "@/components/ChartPanel";
import MetricsCards from "@/components/MetricsCards";
import type { CompareResponse } from "@/lib/api";

type CompareResultViewProps = {
  result: CompareResponse;
};

export default function CompareResultView({ result }: CompareResultViewProps) {
  const leftName = result.left.overview.filename;
  const rightName = result.right.overview.filename;
  const leftSheet = result.left.overview.sheet_name;
  const rightSheet = result.right.overview.sheet_name;

  return (
    <section className="mt-8 space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <SideCard
          label="文件 A（本期）"
          filename={leftName}
          sheet={leftSheet}
          rows={result.left.overview.rows}
          columns={result.left.overview.columns}
        />
        <SideCard
          label="文件 B（对比期）"
          filename={rightName}
          sheet={rightSheet}
          rows={result.right.overview.rows}
          columns={result.right.overview.columns}
        />
      </div>

      {!result.alignment.aligned && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          两份表没有共同列名，指标对比可能有限。请确认表头口径一致。
        </div>
      )}

      {(result.alignment.only_left.length > 0 ||
        result.alignment.only_right.length > 0) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {result.alignment.only_left.length > 0 && (
            <p>仅 A 有：{result.alignment.only_left.join("、")}</p>
          )}
          {result.alignment.only_right.length > 0 && (
            <p className="mt-1">仅 B 有：{result.alignment.only_right.join("、")}</p>
          )}
        </div>
      )}

      {result.transforms.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          已应用变换：
          {result.transforms.map((item) => item.label).join("、")}
        </div>
      )}

      <AnalysisReport analysis={result.analysis} />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">指标差异</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">指标</th>
                <th className="px-3 py-2 font-medium">A（本期）</th>
                <th className="px-3 py-2 font-medium">B（对比期）</th>
                <th className="px-3 py-2 font-medium">差值</th>
                <th className="px-3 py-2 font-medium">变化率</th>
              </tr>
            </thead>
            <tbody>
              {result.metric_deltas.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-4 text-slate-500"
                  >
                    无可对比的同名指标
                  </td>
                </tr>
              ) : (
                result.metric_deltas.map((row) => (
                  <tr key={row.label} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {row.label}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.left}</td>
                    <td className="px-3 py-2 text-slate-700">{row.right}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {row.comparable ? row.delta ?? "-" : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {row.comparable ? row.delta_pct ?? "-" : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            A · 指标与图表
          </h2>
          <MetricsCards metrics={result.left.metrics} />
          {result.left.charts.length > 0 && (
            <div className="grid gap-6">
              {result.left.charts.map((chart) => (
                <ChartPanel
                  key={`left-${chart.type}-${chart.title}`}
                  chart={chart}
                />
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            B · 指标与图表
          </h2>
          <MetricsCards metrics={result.right.metrics} />
          {result.right.charts.length > 0 && (
            <div className="grid gap-6">
              {result.right.charts.map((chart) => (
                <ChartPanel
                  key={`right-${chart.type}-${chart.title}`}
                  chart={chart}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SideCard({
  label,
  filename,
  sheet,
  rows,
  columns,
}: {
  label: string;
  filename: string;
  sheet?: string | null;
  rows: number;
  columns: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold text-slate-900">
        {filename}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        {sheet ? `Sheet：${sheet} · ` : ""}
        {rows} 行 · {columns} 列
      </p>
    </div>
  );
}
