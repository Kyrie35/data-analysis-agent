"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartItem } from "@/lib/api";

type ChartPanelProps = {
  chart: ChartItem;
};

export default function ChartPanel({ chart }: ChartPanelProps) {
  const data = chart.data.map((point) => ({
    name: String(point[chart.x_key] ?? ""),
    value: Number(point[chart.y_key] ?? 0),
  }));

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{chart.title}</h3>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "line" ? (
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickLine={false}
              />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  borderColor: "#e2e8f0",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 4, fill: "#2563eb" }}
              />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickLine={false}
              />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  borderColor: "#e2e8f0",
                }}
              />
              <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </article>
  );
}
