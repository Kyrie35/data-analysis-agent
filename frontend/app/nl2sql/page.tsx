"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AuthBar from "@/components/AuthBar";
import {
  downloadNl2sqlCsv,
  generateNl2sql,
  getNl2sqlSchema,
  getNl2sqlStatus,
  runNl2sqlQuery,
  type Nl2sqlGenerateResult,
  type Nl2sqlQueryResult,
  type Nl2sqlSchemaCatalog,
  type Nl2sqlStatus,
} from "@/lib/api";

const SAMPLE_QUESTION = "华东有多少客户？";

type FlowStep = 1 | 2 | 3 | 4;

function classifyGenerateMessage(generation: Nl2sqlGenerateResult): string | null {
  if (generation.status === "ok") return null;
  if (generation.status === "clarify") {
    return (
      generation.clarifying_question ||
      "问题不够明确，请补充条件后再生成。"
    );
  }
  if (generation.status === "refuse") {
    return generation.explanation || "当前问题无法用样例库回答。";
  }
  if (generation.status === "invalid_sql") {
    return `生成的 SQL 未通过安全校验：${generation.validation_error || "请修改后重试"}`;
  }
  return generation.explanation || "SQL 生成失败，请稍后重试。";
}

function Stepper({ current }: { current: FlowStep }) {
  const steps = [
    { id: 1 as const, label: "提问" },
    { id: 2 as const, label: "生成 SQL" },
    { id: 3 as const, label: "预览确认" },
    { id: 4 as const, label: "导出 CSV" },
  ];

  return (
    <ol className="mb-6 flex flex-wrap gap-2 text-sm">
      {steps.map((step) => {
        const active = current === step.id;
        const done = current > step.id;
        return (
          <li
            key={step.id}
            className={`rounded-full px-3 py-1 ${
              active
                ? "bg-slate-900 text-white"
                : done
                  ? "bg-slate-200 text-slate-700"
                  : "bg-slate-100 text-slate-400"
            }`}
          >
            {step.id}. {step.label}
          </li>
        );
      })}
    </ol>
  );
}

export default function Nl2sqlPage() {
  const [status, setStatus] = useState<Nl2sqlStatus | null>(null);
  const [schema, setSchema] = useState<Nl2sqlSchemaCatalog | null>(null);
  const [question, setQuestion] = useState(SAMPLE_QUESTION);
  const [generation, setGeneration] = useState<Nl2sqlGenerateResult | null>(null);
  const [sql, setSql] = useState("");
  const [previewedSql, setPreviewedSql] = useState<string | null>(null);
  const [result, setResult] = useState<Nl2sqlQueryResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const nextStatus = await getNl2sqlStatus();
        setStatus(nextStatus);
        if (nextStatus.analytics_db_connected) {
          setSchema(await getNl2sqlSchema());
        }
      } catch (loadError) {
        setBootError(loadError instanceof Error ? loadError.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sqlMatchesPreview = previewedSql !== null && sql.trim() === previewedSql.trim();
  const canConfirm = Boolean(result && sqlMatchesPreview);
  const canExport = Boolean(
    confirmed && canConfirm && sql.trim() && status?.ready_for_query,
  );

  let flowStep: FlowStep = 1;
  if (confirmed && canConfirm) flowStep = 4;
  else if (result && sqlMatchesPreview) flowStep = 3;
  else if (sql.trim()) flowStep = 2;
  function resetDownstreamFromSqlEdit(nextSql: string) {
    setSql(nextSql);
    setConfirmed(false);
    setExportNotice(null);
    setExportError(null);
    if (previewedSql !== null && nextSql.trim() !== previewedSql.trim()) {
      setResult(null);
      setPreviewedSql(null);
      setPreviewError(null);
    }
  }

  async function runPreview(nextSql: string) {
    setQuerying(true);
    setPreviewError(null);
    setExportError(null);
    setExportNotice(null);
    setConfirmed(false);
    try {
      const preview = await runNl2sqlQuery(nextSql);
      setResult(preview);
      setPreviewedSql(nextSql.trim());
      if (preview.row_count === 0) {
        setPreviewError(
          "查询成功，但结果为空。可调整筛选条件或时间范围后重新预览；空结果也可导出（将得到仅表头的 CSV）。",
        );
      }
    } catch (queryError) {
      setResult(null);
      setPreviewedSql(null);
      const message =
        queryError instanceof Error ? queryError.message : "预览失败";
      if (message.includes("未通过") || message.includes("仅允许") || message.includes("未授权")) {
        setPreviewError(`SQL 校验失败：${message}`);
      } else if (message.includes("超时")) {
        setPreviewError(message);
      } else {
        setPreviewError(`预览失败：${message}`);
      }
    } finally {
      setQuerying(false);
    }
  }

  async function handleGenerateAndPreview() {
    setGenerating(true);
    setGenerateError(null);
    setPreviewError(null);
    setExportError(null);
    setExportNotice(null);
    setConfirmed(false);
    setResult(null);
    setPreviewedSql(null);

    try {
      const next = await generateNl2sql(question);
      setGeneration(next);

      const genMessage = classifyGenerateMessage(next);
      if (genMessage) {
        setGenerateError(genMessage);
        if (next.sql) {
          setSql(next.sql);
        }
        return;
      }

      if (!next.sql) {
        setGenerateError("模型未返回 SQL，请换一种问法重试。");
        return;
      }

      setSql(next.sql);
      await runPreview(next.sql);
    } catch (generateErrorValue) {
      setGeneration(null);
      setGenerateError(
        generateErrorValue instanceof Error
          ? `生成失败：${generateErrorValue.message}`
          : "生成失败",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handlePreviewOnly() {
    if (!sql.trim()) {
      setPreviewError("请先生成或填写 SQL。");
      return;
    }
    await runPreview(sql);
  }

  async function handleExport() {
    if (!canExport) {
      setExportError("请先完成预览，并勾选确认后再导出。");
      return;
    }

    setExporting(true);
    setExportError(null);
    setExportNotice(null);
    try {
      const meta = await downloadNl2sqlCsv(sql);
      setExportNotice(
        `已下载 CSV：${meta.rowCount} 行${meta.truncated ? "（已按上限截断）" : ""}。`,
      );
    } catch (exportErrorValue) {
      setExportError(
        exportErrorValue instanceof Error
          ? exportErrorValue.message
          : "导出失败",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">智能取数</h1>
          <p className="mt-2 text-sm text-slate-500">
            提问生成 SQL → 预览核对 → 确认后导出 CSV。当前为主路径阶段（P4）。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            返回分析
          </Link>
          <AuthBar />
        </div>
      </div>

      <Stepper current={flowStep} />

      {loading && <p className="text-sm text-slate-500">加载模块状态…</p>}
      {bootError && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {bootError}
        </p>
      )}

      {status && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">模块状态</h2>
          <p className="mt-2 text-sm text-slate-600">
            {status.phase} · {status.message}
          </p>
        </section>
      )}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">1. 自然语言提问</h2>
          <button
            type="button"
            onClick={() => setQuestion(SAMPLE_QUESTION)}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            填入示例问题
          </button>
        </div>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-slate-400 focus:ring-2"
          placeholder="例如：2025 年一季度各地区销售额是多少？"
        />
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void handleGenerateAndPreview()}
            disabled={generating || querying || !status?.analytics_db_connected}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating || querying ? "处理中…" : "生成 SQL 并预览"}
          </button>
        </div>
        {generateError && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {generateError}
          </p>
        )}
        {generation?.status === "ok" && generation.explanation && (
          <div className="mt-3 space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
            <p>
              <span className="text-slate-400">说明：</span>
              {generation.explanation}
            </p>
            {generation.assumptions.length > 0 && (
              <ul className="list-disc pl-5 text-slate-600">
                {generation.assumptions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">2. SQL（可编辑）</h2>
        <p className="mt-1 text-xs text-slate-500">
          修改 SQL 后需重新预览；未确认前不能导出。
        </p>
        <textarea
          value={sql}
          onChange={(event) => resetDownstreamFromSqlEdit(event.target.value)}
          rows={8}
          spellCheck={false}
          className="mt-3 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800 outline-none ring-slate-400 focus:ring-2"
          placeholder="生成成功后会填入 SQL"
        />
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void handlePreviewOnly()}
            disabled={querying || !sql.trim() || !status?.ready_for_query}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {querying ? "预览中…" : "重新预览"}
          </button>
        </div>
        {previewError && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {previewError}
          </p>
        )}
      </section>

      {result && sqlMatchesPreview && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">3. 预览结果</h2>
            <p className="text-xs text-slate-500">
              {result.row_count} 行
              {result.truncated ? "（已截断）" : ""} · limit {result.limit}
            </p>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            {result.executed_sql}
          </pre>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  {result.columns.map((column) => (
                    <th key={column} className="px-2 py-2 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    {result.columns.map((column) => (
                      <td key={column} className="px-2 py-2 text-slate-800">
                        {row[column] == null ? "" : String(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {result.rows.length === 0 && (
              <p className="mt-3 text-sm text-slate-500">无数据行。</p>
            )}
          </div>

          <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              disabled={!canConfirm}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              我已核对 SQL 与预览结果，确认导出 CSV
              {result.truncated ? "（注意：全量导出仍可能按上限截断）" : ""}
            </span>
          </label>
        </section>
      )}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">4. 导出 CSV</h2>
        <p className="mt-1 text-xs text-slate-500">
          仅在预览成功且勾选确认后可导出，避免未核对就全量跑库。
        </p>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting || !canExport}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? "导出中…" : "确认并下载 CSV"}
          </button>
        </div>
        {exportError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {exportError}
          </p>
        )}
        {exportNotice && (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {exportNotice}
          </p>
        )}
      </section>

      {schema && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">
            可查询表结构（{schema.database}）
          </h2>
          <div className="mt-4 space-y-4">
            {schema.tables.map((table) => (
              <div
                key={table.name}
                className="rounded-lg border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="font-medium text-slate-900">{table.name}</h3>
                  {table.comment && (
                    <span className="text-xs text-slate-500">{table.comment}</span>
                  )}
                </div>
                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  {table.columns.map((column) => (
                    <li key={column.name} className="flex flex-wrap gap-x-2">
                      <span className="font-mono text-slate-800">{column.name}</span>
                      <span className="text-slate-400">{column.type}</span>
                      {column.comment && (
                        <span className="text-slate-500">— {column.comment}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
