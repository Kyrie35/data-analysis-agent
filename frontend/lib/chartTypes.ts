export type ChartTypeOption = "line" | "bar" | "pie" | "histogram";

export const ALL_CHART_TYPES: ChartTypeOption[] = [
  "line",
  "bar",
  "pie",
  "histogram",
];

export const CHART_TYPE_LABELS: Record<ChartTypeOption, string> = {
  line: "折线图",
  bar: "柱状图",
  pie: "饼图",
  histogram: "直方图",
};

export function normalizeSelectedChartTypes(
  types: ChartTypeOption[],
): ChartTypeOption[] {
  const unique = ALL_CHART_TYPES.filter((type) => types.includes(type));
  return unique.length > 0 ? unique : [...ALL_CHART_TYPES];
}
