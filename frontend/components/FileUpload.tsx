"use client";

import { useRef, useState } from "react";

type FileUploadProps = {
  onUpload: (file: File) => Promise<void>;
  loading: boolean;
};

export default function FileUpload({ onUpload, loading }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file || loading) return;
    await onUpload(file);
  }

  return (
    <div
      className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
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
        void handleFile(event.dataTransfer.files?.[0]);
      }}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl">
        📊
      </div>
      <h2 className="text-lg font-semibold text-slate-900">上传数据文件</h2>
      <p className="mt-2 text-sm text-slate-500">
        支持 CSV、Excel（.xlsx / .xls），拖拽到此处或点击选择
      </p>

      <button
        type="button"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
        className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        {loading ? "正在分析，AI 生成报告中..." : "选择文件"}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </div>
  );
}
