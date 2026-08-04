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
};

export type AnalyzeResponse = {
  overview: AnalyzeOverview;
  preview: Record<string, unknown>[];
  metrics: MetricItem[];
  charts: ChartItem[];
  analysis: AnalysisResult;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function analyzeFile(file: File): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "分析请求失败";
    try {
      const errorBody = (await response.json()) as { detail?: string };
      message = errorBody.detail ?? message;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }

  return response.json() as Promise<AnalyzeResponse>;
}
