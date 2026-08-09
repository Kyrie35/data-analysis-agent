"use client";

import { useMemo, useState } from "react";

import type { PreferenceItem } from "@/lib/preferences";
import {
  MAX_PREFERENCES_PER_REQUEST,
  filterPreferencesByTitle,
} from "@/lib/preferences";

type PreferenceSelectorProps = {
  preferences: PreferenceItem[];
  usePreferences: boolean;
  selectedIds: string[];
  onUsePreferencesChange: (value: boolean) => void;
  onSelectedIdsChange: (ids: string[]) => void;
  onOpenLibrary: () => void;
  hint?: string | null;
};

export default function PreferenceSelector({
  preferences,
  usePreferences,
  selectedIds,
  onUsePreferencesChange,
  onSelectedIdsChange,
  onOpenLibrary,
  hint,
}: PreferenceSelectorProps) {
  const [titleQuery, setTitleQuery] = useState("");

  const filteredPreferences = useMemo(
    () => filterPreferencesByTitle(preferences, titleQuery),
    [preferences, titleQuery],
  );

  function toggleId(id: string) {
    if (selectedIds.includes(id)) {
      onSelectedIdsChange(selectedIds.filter((item) => item !== id));
      return;
    }
    if (selectedIds.length >= MAX_PREFERENCES_PER_REQUEST) return;
    onSelectedIdsChange([...selectedIds, id]);
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
          从偏好库视角分析
        </label>
        <button
          type="button"
          onClick={onOpenLibrary}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          管理偏好库
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        偏好保存在本机浏览器。启用后会先作为硬约束改写分析口径（例如「订单数按
        80%」「销售额按 120%」），再生成报告与指标/图。
      </p>

      {hint && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {hint}
        </p>
      )}

      {usePreferences && (
        <div className="mt-4 space-y-2">
          {preferences.length === 0 ? (
            <p className="text-sm text-slate-500">
              偏好库为空，请先添加偏好后再启用。
            </p>
          ) : (
            <>
              <input
                value={titleQuery}
                onChange={(event) => setTitleQuery(event.target.value)}
                placeholder="按标题搜索偏好…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-500">
                单次最多选择 {MAX_PREFERENCES_PER_REQUEST} 条（已选{" "}
                {selectedIds.length}）
                {titleQuery.trim()
                  ? ` · 显示 ${filteredPreferences.length} / ${preferences.length}`
                  : ""}
              </p>
              {filteredPreferences.length === 0 ? (
                <p className="text-sm text-slate-500">
                  没有标题匹配「{titleQuery.trim()}」的偏好。
                </p>
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
                            <span className="font-medium text-slate-800">
                              {item.title}
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
