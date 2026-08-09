"use client";

import { useEffect, useRef, useState } from "react";

import {
  chatAboutAnalysis,
  type AnalyzeResponse,
  type ChatMessage,
} from "@/lib/api";
import type { PreferenceItem } from "@/lib/preferences";
import { toPreferencePayloads } from "@/lib/preferences";

type ChatPanelProps = {
  result: AnalyzeResponse;
  preferences: PreferenceItem[];
  selectedIds: string[];
  initialUsePreferences: boolean;
};

export default function ChatPanel({
  result,
  preferences,
  selectedIds,
  initialUsePreferences,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usePreferences, setUsePreferences] = useState(initialUsePreferences);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
    setUsePreferences(initialUsePreferences);
  }, [result.analysis_id, initialUsePreferences]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    if (!result.analysis_id) {
      setError("缺少原始数据会话，请重新上传文件后再追问。");
      return;
    }

    const selectedPrefs = preferences.filter((item) =>
      selectedIds.includes(item.id),
    );
    if (usePreferences && selectedPrefs.length === 0) {
      setError("已启用偏好，但未选中任何条目。请先勾选偏好或关闭开关。");
      return;
    }

    const history = messages.slice(-16);
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: question },
    ];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const reply = await chatAboutAnalysis({
        message: question,
        analysisId: result.analysis_id,
        context: {
          overview: result.overview,
          metrics: result.metrics,
          charts: result.charts,
          preview: result.preview,
          analysis_content: result.analysis.content,
        },
        history,
        usePreferences,
        preferences: toPreferencePayloads(selectedPrefs),
      });

      if (reply.status !== "success" || !reply.content) {
        setError(reply.message || "追问失败");
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply.content as string },
      ]);
    } catch (chatError) {
      const message =
        chatError instanceof Error ? chatError.message : "追问失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">继续追问</h2>
          <p className="mt-1 text-sm text-slate-500">
            基于本次上传的原始表格查询后再回答（非仅看报告摘要）；启用偏好时会按你的视角解读。
            会话约 1 小时有效，超时需重新上传。
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={usePreferences}
            onChange={(event) => setUsePreferences(event.target.checked)}
          />
          使用偏好库
        </label>
      </div>

      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">
            例如：哪个月销售额最高？有哪些异常值得关注？
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-xl px-3 py-2 text-sm leading-6 ${
              message.role === "user"
                ? "ml-8 bg-blue-600 text-white"
                : "mr-8 bg-white text-slate-700 shadow-sm"
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}
        {loading && (
          <p className="text-sm text-slate-500">正在思考…</p>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
          disabled={loading}
          placeholder="输入你的问题…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={loading || !input.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          发送
        </button>
      </div>
    </section>
  );
}
