"use client";

import { useEffect, useMemo, useState } from "react";

import {
  MAX_CONTENT_LENGTH,
  MAX_PREFERENCES,
  MAX_TITLE_LENGTH,
  createPreference,
  filterPreferencesByTitle,
  loadPreferences,
  savePreferences,
  type PreferenceItem,
} from "@/lib/preferences";

type PreferenceLibraryProps = {
  open: boolean;
  onClose: () => void;
  onChange?: (items: PreferenceItem[]) => void;
};

type Draft = {
  title: string;
  content: string;
  enabled: boolean;
};

const emptyDraft: Draft = { title: "", content: "", enabled: true };

export default function PreferenceLibrary({
  open,
  onClose,
  onChange,
}: PreferenceLibraryProps) {
  const [items, setItems] = useState<PreferenceItem[]>([]);
  const [titleQuery, setTitleQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);

  const filteredItems = useMemo(
    () => filterPreferencesByTitle(items, titleQuery),
    [items, titleQuery],
  );

  useEffect(() => {
    if (!open) return;
    setItems(loadPreferences());
    setTitleQuery("");
    setEditingId(null);
    setDraft(emptyDraft);
    setError(null);
  }, [open]);

  function persist(next: PreferenceItem[]) {
    savePreferences(next);
    setItems(next);
    onChange?.(next);
  }

  function startCreate() {
    if (items.length >= MAX_PREFERENCES) {
      setError(`最多保存 ${MAX_PREFERENCES} 条偏好`);
      return;
    }
    setEditingId("new");
    setDraft(emptyDraft);
    setError(null);
  }

  function startEdit(item: PreferenceItem) {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      content: item.content,
      enabled: item.enabled,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft);
    setError(null);
  }

  function saveDraft() {
    const title = draft.title.trim();
    const content = draft.content.trim();
    if (!content) {
      setError("请填写偏好内容");
      return;
    }

    if (editingId === "new") {
      const created = createPreference(title, content, draft.enabled);
      persist([created, ...items]);
    } else if (editingId) {
      persist(
        items.map((item) =>
          item.id === editingId
            ? {
                ...item,
                title: title.slice(0, MAX_TITLE_LENGTH) || "未命名偏好",
                content: content.slice(0, MAX_CONTENT_LENGTH),
                enabled: draft.enabled,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
    }

    cancelEdit();
  }

  function removeItem(id: string) {
    persist(items.filter((item) => item.id !== id));
    if (editingId === id) cancelEdit();
  }

  function toggleEnabled(id: string) {
    persist(
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              enabled: !item.enabled,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <button
        type="button"
        className="h-full flex-1 cursor-default"
        aria-label="关闭偏好库"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">偏好库</h2>
            <p className="mt-1 text-sm text-slate-500">
              保存在本浏览器本地。启用后可作为个人分析视角注入 AI。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            关闭
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {items.length > 0 && (
            <div>
              <input
                value={titleQuery}
                onChange={(event) => setTitleQuery(event.target.value)}
                placeholder="按标题搜索偏好…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {titleQuery.trim()
                  ? `找到 ${filteredItems.length} / ${items.length} 条`
                  : `共 ${items.length} 条偏好`}
              </p>
            </div>
          )}

          {editingId ? (
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <input
                value={draft.title}
                maxLength={MAX_TITLE_LENGTH}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="标题，如：区域销售视角"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <textarea
                value={draft.content}
                maxLength={MAX_CONTENT_LENGTH}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, content: event.target.value }))
                }
                placeholder="自由文本：希望 AI 从什么角度分析、关注什么、避免什么…"
                rows={5}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      enabled: event.target.checked,
                    }))
                  }
                />
                默认参与勾选
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveDraft}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={startCreate}
              className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700"
            >
              + 新增偏好
            </button>
          )}

          {items.length === 0 && !editingId && (
            <p className="text-sm text-slate-500">
              还没有偏好。添加后，可在分析与追问时选择是否启用。
            </p>
          )}

          {items.length > 0 && filteredItems.length === 0 && (
            <p className="text-sm text-slate-500">
              没有标题匹配「{titleQuery.trim()}」的偏好。
            </p>
          )}

          <ul className="space-y-3">
            {filteredItems.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                      {item.content}
                    </p>
                  </div>
                  <label className="shrink-0 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      className="mr-1"
                      checked={item.enabled}
                      onChange={() => toggleEnabled(item.id)}
                    />
                    默认启用
                  </label>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
