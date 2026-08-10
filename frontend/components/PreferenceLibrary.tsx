"use client";

import { useEffect, useMemo, useState } from "react";

import {
  MAX_CONTENT_LENGTH,
  MAX_GROUP_NAME_LENGTH,
  MAX_GROUPS,
  MAX_PREFERENCES,
  MAX_TITLE_LENGTH,
  createGroup,
  createPreference,
  filterPreferencesByGroup,
  filterPreferencesByTitle,
  getGroupName,
  loadGroups,
  loadPreferences,
  saveGroups,
  savePreferences,
  type PreferenceGroup,
  type PreferenceItem,
} from "@/lib/preferences";

type PreferenceLibraryProps = {
  open: boolean;
  onClose: () => void;
  onChange?: (items: PreferenceItem[], groups: PreferenceGroup[]) => void;
};

type Draft = {
  title: string;
  content: string;
  enabled: boolean;
  groupId: string | null;
};

const emptyDraft: Draft = {
  title: "",
  content: "",
  enabled: true,
  groupId: null,
};

export default function PreferenceLibrary({
  open,
  onClose,
  onChange,
}: PreferenceLibraryProps) {
  const [items, setItems] = useState<PreferenceItem[]>([]);
  const [groups, setGroups] = useState<PreferenceGroup[]>([]);
  const [titleQuery, setTitleQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | "all" | "ungrouped">(
    "all",
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [newGroupName, setNewGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const byGroup = filterPreferencesByGroup(items, groupFilter);
    return filterPreferencesByTitle(byGroup, titleQuery);
  }, [items, groupFilter, titleQuery]);

  useEffect(() => {
    if (!open) return;
    setItems(loadPreferences());
    setGroups(loadGroups());
    setTitleQuery("");
    setGroupFilter("all");
    setEditingId(null);
    setDraft(emptyDraft);
    setNewGroupName("");
    setError(null);
  }, [open]);

  function persistItems(next: PreferenceItem[]) {
    savePreferences(next);
    setItems(next);
    onChange?.(next, groups);
  }

  function persistGroups(next: PreferenceGroup[]) {
    saveGroups(next);
    setGroups(next);
    onChange?.(items, next);
  }

  function startCreate() {
    if (items.length >= MAX_PREFERENCES) {
      setError(`最多保存 ${MAX_PREFERENCES} 条偏好`);
      return;
    }
    setEditingId("new");
    setDraft({
      ...emptyDraft,
      groupId: groupFilter !== "all" && groupFilter !== "ungrouped" ? groupFilter : null,
    });
    setError(null);
  }

  function startEdit(item: PreferenceItem) {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      content: item.content,
      enabled: item.enabled,
      groupId: item.groupId,
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
      const created = createPreference(
        title,
        content,
        draft.enabled,
        draft.groupId,
      );
      persistItems([created, ...items]);
    } else if (editingId) {
      persistItems(
        items.map((item) =>
          item.id === editingId
            ? {
                ...item,
                title: title.slice(0, MAX_TITLE_LENGTH) || "未命名偏好",
                content: content.slice(0, MAX_CONTENT_LENGTH),
                enabled: draft.enabled,
                groupId: draft.groupId,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
    }

    cancelEdit();
  }

  function removeItem(id: string) {
    persistItems(items.filter((item) => item.id !== id));
    if (editingId === id) cancelEdit();
  }

  function toggleEnabled(id: string) {
    persistItems(
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

  function addGroup() {
    const name = newGroupName.trim();
    if (!name) {
      setError("请输入分组名称");
      return;
    }
    if (groups.length >= MAX_GROUPS) {
      setError(`最多 ${MAX_GROUPS} 个分组`);
      return;
    }
    const created = createGroup(name);
    persistGroups([created, ...groups]);
    setNewGroupName("");
    setError(null);
  }

  function renameGroup(id: string) {
    const current = groups.find((group) => group.id === id);
    if (!current) return;
    const name = window.prompt("重命名分组", current.name)?.trim();
    if (!name) return;
    persistGroups(
      groups.map((group) =>
        group.id === id
          ? {
              ...group,
              name: name.slice(0, MAX_GROUP_NAME_LENGTH),
              updatedAt: new Date().toISOString(),
            }
          : group,
      ),
    );
  }

  function deleteGroup(id: string) {
    if (!window.confirm("删除分组后，组内偏好将变为「未分组」，确定吗？")) {
      return;
    }
    const nextGroups = groups.filter((group) => group.id !== id);
    const nextItems = items.map((item) =>
      item.groupId === id
        ? { ...item, groupId: null, updatedAt: new Date().toISOString() }
        : item,
    );
    saveGroups(nextGroups);
    savePreferences(nextItems);
    setGroups(nextGroups);
    setItems(nextItems);
    onChange?.(nextItems, nextGroups);
    if (groupFilter === id) setGroupFilter("all");
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
              支持分组管理。启用后可作为分析口径约束注入 AI。
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

          <section className="space-y-2 rounded-xl border border-slate-200 p-3">
            <h3 className="text-sm font-medium text-slate-800">分组</h3>
            <div className="flex gap-2">
              <input
                value={newGroupName}
                maxLength={MAX_GROUP_NAME_LENGTH}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="新分组名称"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={addGroup}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
              >
                添加
              </button>
            </div>
            <ul className="space-y-1">
              {groups.map((group) => (
                <li
                  key={group.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-sm"
                >
                  <span className="truncate text-slate-700">{group.name}</span>
                  <span className="shrink-0 space-x-2">
                    <button
                      type="button"
                      onClick={() => renameGroup(group.id)}
                      className="text-xs text-blue-600"
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteGroup(group.id)}
                      className="text-xs text-red-600"
                    >
                      删除
                    </button>
                  </span>
                </li>
              ))}
              {groups.length === 0 && (
                <li className="text-xs text-slate-500">暂无分组</li>
              )}
            </ul>
          </section>

          {items.length > 0 && (
            <div className="space-y-2">
              <input
                value={titleQuery}
                onChange={(event) => setTitleQuery(event.target.value)}
                placeholder="按标题搜索偏好…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <select
                value={groupFilter}
                onChange={(event) =>
                  setGroupFilter(
                    event.target.value as string | "all" | "ungrouped",
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="all">全部分组</option>
                <option value="ungrouped">未分组</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                显示 {filteredItems.length} / {items.length} 条
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
              <select
                value={draft.groupId ?? ""}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    groupId: event.target.value || null,
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">未分组</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
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
            <p className="text-sm text-slate-500">当前筛选下没有匹配的偏好。</p>
          )}

          <ul className="space-y-3">
            {filteredItems.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-medium text-slate-900">
                        {item.title}
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {getGroupName(groups, item.groupId)}
                      </span>
                    </div>
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
