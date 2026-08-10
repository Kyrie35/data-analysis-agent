"use client";

import { useRef, useState } from "react";

import { inspectFile } from "@/lib/api";

export type AnalysisMode = "single" | "compare";

type SlotState = {
  file: File | null;
  sheets: string[];
  sheetName: string;
  isExcel: boolean;
  inspecting: boolean;
  error: string | null;
};

type DataSourcePanelProps = {
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
  loading: boolean;
  onAnalyze: (file: File, sheetName: string | null) => Promise<void>;
  onCompare: (
    fileA: File,
    sheetA: string | null,
    fileB: File,
    sheetB: string | null,
  ) => Promise<void>;
};

const emptySlot = (): SlotState => ({
  file: null,
  sheets: [],
  sheetName: "",
  isExcel: false,
  inspecting: false,
  error: null,
});

export default function DataSourcePanel({
  mode,
  onModeChange,
  loading,
  onAnalyze,
  onCompare,
}: DataSourcePanelProps) {
  const [slotA, setSlotA] = useState<SlotState>(emptySlot);
  const [slotB, setSlotB] = useState<SlotState>(emptySlot);
  const inputARef = useRef<HTMLInputElement>(null);
  const inputBRef = useRef<HTMLInputElement>(null);

  async function assignFile(
    which: "a" | "b",
    file: File | undefined,
  ) {
    if (!file || loading) return;
    const setter = which === "a" ? setSlotA : setSlotB;
    setter({
      ...emptySlot(),
      file,
      inspecting: true,
    });
    try {
      const inspected = await inspectFile(file);
      const defaultSheet =
        inspected.is_excel && inspected.sheets.length > 0
          ? inspected.sheets[0]
          : "";
      setter({
        file,
        sheets: inspected.sheets,
        sheetName: defaultSheet,
        isExcel: inspected.is_excel,
        inspecting: false,
        error: null,
      });
    } catch (err) {
      setter({
        ...emptySlot(),
        error: err instanceof Error ? err.message : "文件检查失败",
      });
    }
  }

  function sheetValue(slot: SlotState): string | null {
    if (!slot.isExcel) return null;
    return slot.sheetName || null;
  }

  async function handleRun() {
    if (loading) return;
    if (mode === "single") {
      if (!slotA.file) return;
      await onAnalyze(slotA.file, sheetValue(slotA));
      return;
    }
    if (!slotA.file || !slotB.file) return;
    await onCompare(
      slotA.file,
      sheetValue(slotA),
      slotB.file,
      sheetValue(slotB),
    );
  }

  const canRun =
    mode === "single"
      ? Boolean(slotA.file) && !slotA.inspecting && !slotA.error
      : Boolean(slotA.file && slotB.file) &&
        !slotA.inspecting &&
        !slotB.inspecting &&
        !slotA.error &&
        !slotB.error;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <ModeButton
          active={mode === "single"}
          onClick={() => onModeChange("single")}
          label="单文件分析"
        />
        <ModeButton
          active={mode === "compare"}
          onClick={() => onModeChange("compare")}
          label="双文件对比"
        />
      </div>

      <div
        className={`grid gap-4 ${mode === "compare" ? "lg:grid-cols-2" : ""}`}
      >
        <FileSlot
          title={mode === "compare" ? "文件 A（本期）" : "数据文件"}
          slot={slotA}
          inputRef={inputARef}
          disabled={loading}
          onPick={() => inputARef.current?.click()}
          onFile={(file) => void assignFile("a", file)}
          onSheetChange={(value) =>
            setSlotA((prev) => ({ ...prev, sheetName: value }))
          }
        />
        {mode === "compare" && (
          <FileSlot
            title="文件 B（对比期）"
            slot={slotB}
            inputRef={inputBRef}
            disabled={loading}
            onPick={() => inputBRef.current?.click()}
            onFile={(file) => void assignFile("b", file)}
            onSheetChange={(value) =>
              setSlotB((prev) => ({ ...prev, sheetName: value }))
            }
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canRun || loading}
          onClick={() => void handleRun()}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {loading
            ? mode === "compare"
              ? "正在对比并生成差异报告…"
              : "正在读取偏好约束并生成分析报告与可视化…"
            : mode === "compare"
              ? "开始对比"
              : "开始分析"}
        </button>
        <p className="text-sm text-slate-500">
          {mode === "compare"
            ? "两份表按相同偏好口径计算指标后对比；Excel 可分别选 Sheet。"
            : "Excel 多 Sheet 时可先选工作表再分析。"}
        </p>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function FileSlot({
  title,
  slot,
  inputRef,
  disabled,
  onPick,
  onFile,
  onSheetChange,
}: {
  title: string;
  slot: SlotState;
  inputRef: React.RefObject<HTMLInputElement | null>;
  disabled: boolean;
  onPick: () => void;
  onFile: (file: File | undefined) => void;
  onSheetChange: (value: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`rounded-2xl border-2 border-dashed p-6 transition-colors ${
        dragOver
          ? "border-blue-500 bg-blue-50"
          : "border-slate-300 bg-white hover:border-slate-400"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        onFile(event.dataTransfer.files?.[0]);
      }}
    >
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">
        支持 CSV、Excel（.xlsx / .xls）
      </p>

      <button
        type="button"
        disabled={disabled || slot.inspecting}
        onClick={onPick}
        className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {slot.inspecting ? "检查中…" : slot.file ? "更换文件" : "选择文件"}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {slot.file && (
        <p className="mt-3 truncate text-sm text-slate-700">
          已选：{slot.file.name}
        </p>
      )}

      {slot.isExcel && slot.sheets.length > 0 && (
        <label className="mt-3 block text-sm text-slate-700">
          <span className="mb-1 block font-medium">工作表</span>
          <select
            value={slot.sheetName}
            disabled={disabled}
            onChange={(event) => onSheetChange(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {slot.sheets.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}

      {slot.error && (
        <p className="mt-3 text-sm text-red-600">{slot.error}</p>
      )}
    </div>
  );
}
