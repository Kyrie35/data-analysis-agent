"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartItem } from "@/lib/api";

const PIE_COLORS = [
  "#2563eb",
  "#0d9488",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#65a30d",
  "#db2777",
];

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
          ) : chart.type === "pie" ? (
            <PieChart>
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  borderColor: "#e2e8f0",
                }}
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`${entry.name}-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
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
              <Bar
                dataKey="value"
                fill={chart.type === "histogram" ? "#0d9488" : "#2563eb"}
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </article>
  );
}
