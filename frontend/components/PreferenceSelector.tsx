"use client";

import { useMemo, useState } from "react";

import type { PreferenceGroup, PreferenceItem } from "@/lib/preferences";
import {
  MAX_PREFERENCES_PER_REQUEST,
  filterPreferencesByGroup,
  filterPreferencesByTitle,
  getGroupName,
} from "@/lib/preferences";

type PreferenceSelectorProps = {
  preferences: PreferenceItem[];
  groups: PreferenceGroup[];
  usePreferences: boolean;
  selectedIds: string[];
  onUsePreferencesChange: (value: boolean) => void;
  onSelectedIdsChange: (ids: string[]) => void;
  onOpenLibrary: () => void;
  hint?: string | null;
  /** 启用开关文案 */
  enableLabel?: string;
  /** 管理入口文案 */
  manageLabel?: string;
  /** 说明文案 */
  helpText?: string;
  emptyText?: string;
};

export default function PreferenceSelector({
  preferences,
  groups,
  usePreferences,
  selectedIds,
  onUsePreferencesChange,
  onSelectedIdsChange,
  onOpenLibrary,
  hint,
  enableLabel = "启用表报偏好",
  manageLabel = "管理表报偏好",
  helpText = "偏好保存在本机浏览器，并可同步云端。启用后会作为分析口径约束注入报告生成。",
  emptyText = "表报偏好为空，请先添加后再启用。",
}: PreferenceSelectorProps) {
  const [titleQuery, setTitleQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | "all" | "ungrouped">(
    "all",
  );

  const filteredPreferences = useMemo(() => {
    const byGroup = filterPreferencesByGroup(preferences, groupFilter);
    return filterPreferencesByTitle(byGroup, titleQuery);
  }, [preferences, groupFilter, titleQuery]);

  function toggleId(id: string) {
    if (selectedIds.includes(id)) {
      onSelectedIdsChange(selectedIds.filter((item) => item !== id));
      return;
    }
    if (selectedIds.length >= MAX_PREFERENCES_PER_REQUEST) return;
    onSelectedIdsChange([...selectedIds, id]);
  }

  function selectVisibleGroup() {
    const visibleIds = filteredPreferences.map((item) => item.id);
    const merged = [...selectedIds];
    for (const id of visibleIds) {
      if (merged.includes(id)) continue;
      if (merged.length >= MAX_PREFERENCES_PER_REQUEST) break;
      merged.push(id);
    }
    onSelectedIdsChange(merged);
  }

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={usePreferences}
            onChange={(event) => onUsePreferencesChange(event.target.checked)}
          />
          {enableLabel}
        </label>
        <button
          type="button"
          onClick={onOpenLibrary}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {manageLabel}
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-500">{helpText}</p>

      {hint && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {hint}
        </p>
      )}

      {usePreferences && (
        <div className="mt-4 space-y-2">
          {preferences.length === 0 ? (
            <p className="text-sm text-slate-500">{emptyText}</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
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
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  单次最多选择 {MAX_PREFERENCES_PER_REQUEST} 条（已选{" "}
                  {selectedIds.length}）· 显示 {filteredPreferences.length} /{" "}
                  {preferences.length}
                </p>
                <button
                  type="button"
                  onClick={selectVisibleGroup}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  全选当前筛选（至上限）
                </button>
              </div>
              {filteredPreferences.length === 0 ? (
                <p className="text-sm text-slate-500">当前筛选下没有偏好。</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {filteredPreferences.map((item) => {
                    const checked = selectedIds.includes(item.id);
                    const disabled =
                      !checked &&
                      selectedIds.length >= MAX_PREFERENCES_PER_REQUEST;
                    return (
                      <li key={item.id}>
                        <label
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                            checked
                              ? "border-blue-300 bg-blue-50"
                              : "border-slate-200 bg-slate-50"
                          } ${disabled ? "opacity-50" : ""}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleId(item.id)}
                          />
                          <span>
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-800">
                                {item.title}
                              </span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                                {getGroupName(groups, item.groupId)}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-500 line-clamp-2">
                              {item.content}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
