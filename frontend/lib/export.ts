import type { AnalyzeResponse } from "@/lib/api";
import { CHART_TYPE_LABELS, type ChartTypeOption } from "@/lib/chartTypes";

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function baseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "") || "analysis";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildMarkdown(result: AnalyzeResponse): string {
  const lines: string[] = [];
  const pipeline = result.pipeline;
  const transforms = pipeline?.applied_transforms ?? [];

  lines.push(`# 表报分析报告`);
  lines.push("");
  lines.push(`- 文件：${result.overview.filename}`);
  lines.push(`- 行数：${result.overview.rows}`);
  lines.push(`- 列数：${result.overview.columns}`);
  lines.push(
    `- 分析模式：${pipeline?.mode === "ai_plan" ? "AI 计划" : "规则回退"}`,
  );
  if (pipeline?.scenario) {
    lines.push(`- 场景：${pipeline.scenario}`);
  }
  if (pipeline?.focus?.length) {
    lines.push(`- 关注：${pipeline.focus.join("、")}`);
  }
  if (pipeline?.chart_types?.length) {
    lines.push(
      `- 勾选图型：${pipeline.chart_types
        .map((type) => CHART_TYPE_LABELS[type as ChartTypeOption] ?? type)
        .join("、")}`,
    );
  }
  lines.push(`- 导出时间：${new Date().toLocaleString("zh-CN")}`);
  lines.push("");

  lines.push(`## 偏好约束 / 数据变换`);
  lines.push("");
  if (transforms.length === 0) {
    lines.push("本次未应用数值变换。");
  } else {
    for (const item of transforms) {
      lines.push(
        `- ${item.label}${item.reason ? `（${item.reason}）` : ""}`,
      );
    }
  }
  if (pipeline?.message) {
    lines.push("");
    lines.push(`说明：${pipeline.message}`);
  }
  lines.push("");

  lines.push(`## 关键指标`);
  lines.push("");
  if (result.metrics.length === 0) {
    lines.push("无指标。");
  } else {
    for (const metric of result.metrics) {
      lines.push(
        `- **${metric.label}**：${metric.value}${
          metric.description ? ` — ${metric.description}` : ""
        }`,
      );
    }
  }
  lines.push("");

  lines.push(`## AI 分析报告`);
  lines.push("");
  if (result.analysis.status === "success" && result.analysis.content) {
    lines.push(result.analysis.content);
  } else {
    lines.push(result.analysis.message || "无报告内容。");
  }
  lines.push("");

  lines.push(`## 图表数据`);
  lines.push("");
  if (result.charts.length === 0) {
    lines.push("无图表。");
  } else {
    for (const chart of result.charts) {
      lines.push(`### ${chart.title}（${chart.type}）`);
      lines.push("");
      lines.push(`| ${chart.x_key} | ${chart.y_key} |`);
      lines.push(`| --- | --- |`);
      for (const row of chart.data.slice(0, 30)) {
        lines.push(
          `| ${String(row[chart.x_key] ?? "")} | ${String(row[chart.y_key] ?? "")} |`,
        );
      }
      lines.push("");
    }
  }

  lines.push(`## 数据预览（前 5 行）`);
  lines.push("");
  if (result.preview.length === 0) {
    lines.push("无预览。");
  } else {
    const columns = result.overview.column_names;
    lines.push(`| ${columns.join(" | ")} |`);
    lines.push(`| ${columns.map(() => "---").join(" | ")} |`);
    for (const row of result.preview) {
      lines.push(
        `| ${columns.map((col) => String(row[col] ?? "")).join(" | ")} |`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

export function exportMarkdown(result: AnalyzeResponse): void {
  const content = buildMarkdown(result);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  downloadBlob(
    blob,
    `分析_${baseName(result.overview.filename)}_${stamp()}.md`,
  );
}

export async function exportExcel(result: AnalyzeResponse): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const pipeline = result.pipeline;
  const transforms = pipeline?.applied_transforms ?? [];

  const summaryRows = [
    ["字段", "值"],
    ["文件名", result.overview.filename],
    ["行数", result.overview.rows],
    ["列数", result.overview.columns],
    ["分析模式", pipeline?.mode === "ai_plan" ? "AI 计划" : "规则回退"],
    ["场景", pipeline?.scenario ?? ""],
    ["关注", (pipeline?.focus ?? []).join("、")],
    [
      "勾选图型",
      (pipeline?.chart_types ?? [])
        .map((type) => CHART_TYPE_LABELS[type as ChartTypeOption] ?? type)
        .join("、"),
    ],
    ["说明", pipeline?.message ?? ""],
    ["导出时间", new Date().toLocaleString("zh-CN")],
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(summaryRows),
    "概览",
  );

  const transformRows = [
    ["变换", "列", "操作", "系数", "原因"],
    ...transforms.map((item) => [
      item.label,
      item.column,
      item.op,
      item.factor,
      item.reason ?? "",
    ]),
  ];
  if (transforms.length === 0) {
    transformRows.push(["（无）", "", "", "", ""]);
  }
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(transformRows),
    "偏好变换",
  );

  const metricRows = [
    ["指标", "数值", "说明"],
    ...result.metrics.map((metric) => [
      metric.label,
      metric.value,
      metric.description ?? "",
    ]),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(metricRows),
    "指标",
  );

  const reportText =
    result.analysis.status === "success" && result.analysis.content
      ? result.analysis.content
      : result.analysis.message || "无报告内容";
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["AI 分析报告"], [reportText]]),
    "报告",
  );

  const columns = result.overview.column_names;
  const previewRows = [
    columns,
    ...result.preview.map((row) => columns.map((col) => row[col] ?? "")),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(previewRows),
    "预览",
  );

  result.charts.forEach((chart, index) => {
    const sheetName = `图${index + 1}`.slice(0, 31);
    const rows = [
      [chart.title, chart.type],
      [chart.x_key, chart.y_key],
      ...chart.data.map((row) => [
        row[chart.x_key] ?? "",
        row[chart.y_key] ?? "",
      ]),
    ];
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(rows),
      sheetName,
    );
  });

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(
    blob,
    `分析_${baseName(result.overview.filename)}_${stamp()}.xlsx`,
  );
}
