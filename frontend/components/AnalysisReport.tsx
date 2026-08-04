import type { AnalysisResult } from "@/lib/api";

type AnalysisReportProps = {
  analysis: AnalysisResult;
};

export default function AnalysisReport({ analysis }: AnalysisReportProps) {
  if (analysis.status === "skipped" || analysis.status === "error") {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-xl">🤖</span>
          <div>
            <h2 className="text-lg font-semibold text-amber-900">AI 分析报告</h2>
            <p className="mt-2 text-sm text-amber-800">{analysis.message}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-lg">
            🤖
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">AI 分析报告</h2>
            <p className="text-sm text-slate-500">
              由 DeepSeek 基于数据指标与图表自动生成
            </p>
          </div>
        </div>
        {analysis.model && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
            {analysis.model}
          </span>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {(analysis.content ?? "").split("\n").map((line, index) => (
          <MarkdownLine key={`${index}-${line}`} line={line} />
        ))}
      </div>
    </section>
  );
}

function MarkdownLine({ line }: { line: string }) {
  if (!line.trim()) {
    return <div className="h-2" />;
  }

  if (line.startsWith("## ")) {
    return (
      <h3 className="pt-2 text-base font-semibold text-slate-900">
        {line.slice(3)}
      </h3>
    );
  }

  if (line.startsWith("### ")) {
    return (
      <h4 className="pt-1 text-sm font-semibold text-slate-800">
        {line.slice(4)}
      </h4>
    );
  }

  if (line.startsWith("- ")) {
    return (
      <li className="ml-5 list-disc text-sm leading-7 text-slate-700">
        {formatInline(line.slice(2))}
      </li>
    );
  }

  return <p className="text-sm leading-7 text-slate-700">{formatInline(line)}</p>;
}

function formatInline(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "$1");
}
