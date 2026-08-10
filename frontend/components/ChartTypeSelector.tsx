"use client";

import {
  ALL_CHART_TYPES,
  CHART_TYPE_LABELS,
  type ChartTypeOption,
  normalizeSelectedChartTypes,
} from "@/lib/chartTypes";

type ChartTypeSelectorProps = {
  selected: ChartTypeOption[];
  onChange: (types: ChartTypeOption[]) => void;
};

export default function ChartTypeSelector({
  selected,
  onChange,
}: ChartTypeSelectorProps) {
  function toggle(type: ChartTypeOption) {
    if (selected.includes(type)) {
      if (selected.length === 1) return;
      onChange(selected.filter((item) => item !== type));
      return;
    }
    onChange(normalizeSelectedChartTypes([...selected, type]));
  }

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-800">生成图表类型</h2>
        <button
          type="button"
          onClick={() => onChange([...ALL_CHART_TYPES])}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          全选
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        分析前勾选需要的图型；最多生成 3 张，按折线 → 柱状 → 饼图 → 直方图优先。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ALL_CHART_TYPES.map((type) => {
          const checked = selected.includes(type);
          return (
            <label
              key={type}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                checked
                  ? "border-blue-300 bg-blue-50 text-blue-800"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(type)}
              />
              {CHART_TYPE_LABELS[type]}
            </label>
          );
        })}
      </div>
    </section>
  );
}
