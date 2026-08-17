import type { ChartTypeOption } from "@/lib/chartTypes";
import { authHeaders } from "@/lib/auth";
import type { PreferencePayload } from "@/lib/preferences";

export type AnalyzeOverview = {
  filename: string;
  rows: number;
  columns: number;
  column_names: string[];
  column_types: Record<string, string>;
  sheet_name?: string | null;
};

export type MetricItem = {
  label: string;
  value: string;
  description?: string;
};

export type ChartItem = {
  type: "line" | "bar" | "pie" | "histogram";
  title: string;
  x_key: string;
  y_key: string;
  data: Record<string, string | number | null>[];
};

export type AnalysisResult = {
  status: "success" | "error" | "skipped";
  content: string | null;
  message?: string | null;
  model?: string;
  used_preferences?: boolean;
};

export type AppliedTransform = {
  column: string;
  op: string;
  factor: number;
  reason?: string;
  label: string;
};

export type PipelineInfo = {
  mode: "ai_plan" | "rules_fallback";
  plan_status: "success" | "error" | "skipped";
  message?: string | null;
  scenario?: string | null;
  focus?: string[];
  applied_transforms?: AppliedTransform[];
  preferences_applied?: boolean;
  chart_types?: string[];
};

export type AnalyzeResponse = {
  analysis_id: string;
  overview: AnalyzeOverview;
  preview: Record<string, unknown>[];
  metrics: MetricItem[];
  charts: ChartItem[];
  analysis: AnalysisResult;
  pipeline?: PipelineInfo;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatContext = {
  overview: AnalyzeOverview;
  metrics: MetricItem[];
  charts: ChartItem[];
  preview: Record<string, unknown>[];
  analysis_content?: string | null;
};

export type ChatResponse = {
  status: "success" | "error" | "skipped";
  content: string | null;
  message?: string | null;
  model?: string | null;
  used_preferences?: boolean;
  used_raw_data?: boolean;
};

export type AnalyzeOptions = {
  usePreferences?: boolean;
  preferences?: PreferencePayload[];
  chartTypes?: ChartTypeOption[];
  sheetName?: string | null;
};

export type InspectResponse = {
  overview: AnalyzeOverview;
  preview: Record<string, unknown>[];
  sheets: string[];
  is_excel: boolean;
};

export type MetricDelta = {
  label: string;
  left: string;
  right: string;
  delta: string | null;
  delta_pct: string | null;
  comparable: boolean;
};

export type CompareSide = {
  analysis_id: string;
  overview: AnalyzeOverview;
  preview: Record<string, unknown>[];
  metrics: MetricItem[];
  charts: ChartItem[];
};

export type CompareResponse = {
  mode: "compare";
  analysis_id: string;
  alignment: {
    common_columns: string[];
    only_left: string[];
    only_right: string[];
    aligned: boolean;
  };
  transforms: AppliedTransform[];
  left: CompareSide;
  right: CompareSide;
  metric_deltas: MetricDelta[];
  analysis: AnalysisResult;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function parseErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const errorBody = (await response.json()) as { detail?: string };
    return errorBody.detail ?? fallback;
  } catch {
    return fallback;
  }
}

export async function analyzeFile(
  file: File,
  options: AnalyzeOptions = {},
): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append(
    "use_preferences",
    options.usePreferences ? "true" : "false",
  );
  if (options.usePreferences && options.preferences?.length) {
    formData.append("preferences", JSON.stringify(options.preferences));
  }
  if (options.chartTypes?.length) {
    formData.append("chart_types", JSON.stringify(options.chartTypes));
  }
  if (options.sheetName) {
    formData.append("sheet_name", options.sheetName);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      `无法连接后端（${API_BASE_URL}）。请确认 Railway 后端已部署，且 Vercel 已配置 NEXT_PUBLIC_API_BASE_URL 并重新 Deploy。`,
    );
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "分析请求失败"));
  }

  return response.json() as Promise<AnalyzeResponse>;
}

export async function inspectFile(file: File): Promise<InspectResponse> {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/inspect`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      `无法连接后端（${API_BASE_URL}）。请确认后端服务可用。`,
    );
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "文件检查失败"));
  }

  return response.json() as Promise<InspectResponse>;
}

export type CompareOptions = AnalyzeOptions & {
  sheetA?: string | null;
  sheetB?: string | null;
};

export async function compareFiles(
  fileA: File,
  fileB: File,
  options: CompareOptions = {},
): Promise<CompareResponse> {
  const formData = new FormData();
  formData.append("file_a", fileA);
  formData.append("file_b", fileB);
  formData.append(
    "use_preferences",
    options.usePreferences ? "true" : "false",
  );
  if (options.usePreferences && options.preferences?.length) {
    formData.append("preferences", JSON.stringify(options.preferences));
  }
  if (options.chartTypes?.length) {
    formData.append("chart_types", JSON.stringify(options.chartTypes));
  }
  if (options.sheetA) {
    formData.append("sheet_a", options.sheetA);
  }
  if (options.sheetB) {
    formData.append("sheet_b", options.sheetB);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/compare`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      `无法连接后端（${API_BASE_URL}）。请确认后端服务可用。`,
    );
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "对比分析失败"));
  }

  return response.json() as Promise<CompareResponse>;
}

export async function chatAboutAnalysis(input: {
  message: string;
  analysisId: string;
  context: ChatContext;
  history: ChatMessage[];
  usePreferences?: boolean;
  preferences?: PreferencePayload[];
}): Promise<ChatResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.message,
        analysis_id: input.analysisId,
        context: input.context,
        history: input.history,
        use_preferences: Boolean(input.usePreferences),
        preferences: input.preferences ?? [],
      }),
    });
  } catch {
    throw new Error(
      `无法连接后端（${API_BASE_URL}）。请确认后端服务可用。`,
    );
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "追问请求失败"));
  }

  return response.json() as Promise<ChatResponse>;
}

export type Nl2sqlStatus = {
  module: string;
  phase: string;
  ready_for_query: boolean;
  message: string;
  analytics_db_configured: boolean;
  analytics_db_connected?: boolean;
  analytics_db_error?: string | null;
  table_whitelist: string[];
  max_rows: number;
  preview_rows?: number;
  query_timeout_seconds: number;
};

export type Nl2sqlColumn = {
  name: string;
  type: string;
  nullable: boolean;
  key: string;
  comment: string;
};

export type Nl2sqlTable = {
  name: string;
  comment: string;
  columns: Nl2sqlColumn[];
};

export type Nl2sqlSchemaCatalog = {
  database: string;
  tables: Nl2sqlTable[];
  missing_tables: string[];
  whitelist: string[];
};

export type Nl2sqlQueryResult = {
  columns: string[];
  rows: Record<string, string | number | boolean | null>[];
  row_count: number;
  truncated: boolean;
  limit: number;
  executed_sql: string;
};

export type Nl2sqlGenerateResult = {
  status: "ok" | "clarify" | "refuse" | "invalid_sql" | "error";
  sql: string | null;
  explanation: string;
  assumptions: string[];
  clarifying_question: string;
  model?: string | null;
  validation_error?: string | null;
  raw_content?: string;
};

export async function getNl2sqlStatus(): Promise<Nl2sqlStatus> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/nl2sql/status`);
  } catch {
    throw new Error(
      `无法连接后端（${API_BASE_URL}）。请确认后端服务可用。`,
    );
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "获取取数模块状态失败"));
  }

  return response.json() as Promise<Nl2sqlStatus>;
}

export async function getNl2sqlSchema(): Promise<Nl2sqlSchemaCatalog> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/nl2sql/schema`);
  } catch {
    throw new Error(
      `无法连接后端（${API_BASE_URL}）。请确认后端服务可用。`,
    );
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "获取业务库 schema 失败"));
  }

  return response.json() as Promise<Nl2sqlSchemaCatalog>;
}

export async function runNl2sqlQuery(
  sql: string,
  previewLimit?: number,
): Promise<Nl2sqlQueryResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/nl2sql/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sql,
        preview_limit: previewLimit,
      }),
    });
  } catch {
    throw new Error(
      `无法连接后端（${API_BASE_URL}）。请确认后端服务可用。`,
    );
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "查询执行失败"));
  }

  return response.json() as Promise<Nl2sqlQueryResult>;
}

export async function generateNl2sql(
  question: string,
  options?: {
    usePreferences?: boolean;
    preferences?: PreferencePayload[];
  },
): Promise<Nl2sqlGenerateResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/nl2sql/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        use_preferences: Boolean(options?.usePreferences),
        preferences: options?.preferences ?? [],
      }),
    });
  } catch {
    throw new Error(
      `无法连接后端（${API_BASE_URL}）。请确认后端服务可用。`,
    );
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "SQL 生成失败"));
  }

  return response.json() as Promise<Nl2sqlGenerateResult>;
}

export async function downloadNl2sqlCsv(sql: string): Promise<{
  rowCount: number;
  truncated: boolean;
}> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/nl2sql/export.csv`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
    });
  } catch {
    throw new Error(
      `无法连接后端（${API_BASE_URL}）。请确认后端服务可用。`,
    );
  }

  if (!response.ok) {
    const detail = await parseErrorMessage(response, "CSV 导出失败");
    if (detail.includes("超时") || detail.toLowerCase().includes("timeout")) {
      throw new Error(`导出超时：${detail}`);
    }
    if (response.status === 400) {
      throw new Error(`SQL 未通过校验，无法导出：${detail}`);
    }
    throw new Error(detail);
  }

  const rowCount = Number(response.headers.get("X-NL2SQL-Row-Count") ?? "0");
  const truncated = response.headers.get("X-NL2SQL-Truncated") === "1";

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const matched = /filename="([^"]+)"/.exec(disposition);
  const filename = matched?.[1] ?? `nl2sql_export_${Date.now()}.csv`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return { rowCount, truncated };
}

export type Nl2sqlHistoryListItem = {
  id: number;
  question: string;
  summary: string;
  row_count: number;
  truncated: boolean;
  exported: boolean;
  created_at: string;
};

export type Nl2sqlHistoryDetail = Nl2sqlHistoryListItem & {
  sql: string;
  explanation: string;
};

export async function listNl2sqlHistory(): Promise<Nl2sqlHistoryListItem[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/nl2sql/history`, {
      headers: { ...authHeaders() },
    });
  } catch {
    throw new Error(
      `无法连接后端（${API_BASE_URL}）。请确认后端服务可用。`,
    );
  }
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "加载查询记录失败"));
  }
  return response.json() as Promise<Nl2sqlHistoryListItem[]>;
}

export async function getNl2sqlHistory(
  id: number,
): Promise<Nl2sqlHistoryDetail> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/nl2sql/history/${id}`, {
      headers: { ...authHeaders() },
    });
  } catch {
    throw new Error(
      `无法连接后端（${API_BASE_URL}）。请确认后端服务可用。`,
    );
  }
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "加载查询记录详情失败"));
  }
  return response.json() as Promise<Nl2sqlHistoryDetail>;
}

export async function saveNl2sqlHistory(input: {
  question: string;
  sql: string;
  explanation?: string;
  row_count?: number;
  truncated?: boolean;
  exported?: boolean;
}): Promise<Nl2sqlHistoryListItem> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/nl2sql/history`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        question: input.question,
        sql: input.sql,
        explanation: input.explanation ?? "",
        row_count: input.row_count ?? 0,
        truncated: Boolean(input.truncated),
        exported: Boolean(input.exported),
      }),
    });
  } catch {
    throw new Error(
      `无法连接后端（${API_BASE_URL}）。请确认后端服务可用。`,
    );
  }
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "保存查询记录失败"));
  }
  return response.json() as Promise<Nl2sqlHistoryListItem>;
}

export async function deleteNl2sqlHistory(id: number): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/nl2sql/history/${id}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
    });
  } catch {
    throw new Error(
      `无法连接后端（${API_BASE_URL}）。请确认后端服务可用。`,
    );
  }
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "删除查询记录失败"));
  }
}
