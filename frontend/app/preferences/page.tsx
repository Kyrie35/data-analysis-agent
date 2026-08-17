"use client";

import { useState } from "react";

import PreferenceLibrary from "@/components/PreferenceLibrary";
import {
  PREFERENCE_SCOPE_META,
  type PreferenceScope,
} from "@/lib/preferences";

const TABS: PreferenceScope[] = ["report", "query"];

export default function PreferencesPage() {
  const [scope, setScope] = useState<PreferenceScope>("report");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">偏好库</h1>
        <p className="mt-2 text-sm text-slate-500">
          表报偏好与取数偏好相互独立：分别用于「表报生成」与「语义取数」。
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((item) => {
          const meta = PREFERENCE_SCOPE_META[item];
          const active = scope === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setScope(item)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      <PreferenceLibrary
        key={scope}
        variant="page"
        scope={scope}
        showPageHeader={false}
      />
    </div>
  );
}
