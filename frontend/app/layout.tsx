import type { Metadata } from "next";

import AppShell from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "数据分析 Agent",
  description: "上传 CSV / Excel，自动解析数据结构与预览",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
