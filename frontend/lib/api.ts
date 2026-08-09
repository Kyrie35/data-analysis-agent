import type { PreferencePayload } from "@/lib/preferences";

export type AnalyzeOverview = {
  filename: string;
  rows: number;
  columns: number;
  column_names: string[];
  column_types: Record<string, string>;
};

export type MetricItem = {
  label: string;
  value: string;
  description?: string;
};

export type ChartItem = {
  type: "line" | "bar";
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
