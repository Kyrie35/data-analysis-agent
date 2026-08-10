import type { ChartTypeOption } from "@/lib/chartTypes";
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
