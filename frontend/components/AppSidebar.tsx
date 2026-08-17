"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/AuthProvider";

const NAV_ITEMS = [
  {
    href: "/",
    label: "表报生成",
    description: "上传表格生成报告",
  },
  {
    href: "/nl2sql",
    label: "语义取数",
    description: "自然语言查询导出",
  },
  {
    href: "/preferences",
    label: "偏好库",
    description: "管理分析视角与约束",
  },
  {
    href: "/history",
    label: "历史任务",
    description: "查看已保存报告",
  },
] as const;

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type AppSidebarProps = {
  mobileOpen: boolean;
  onNavigate?: () => void;
};

export default function AppSidebar({ mobileOpen, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="关闭菜单"
          className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
          onClick={onNavigate}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-4 pb-4 pt-5">
          <Link href="/" onClick={onNavigate} className="block">
            <p className="text-lg font-semibold tracking-tight text-slate-900">
              数航助手
            </p>
            <p className="mt-1 text-xs text-slate-500">DataPilot · 表报 · 取数</p>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            功能
          </p>
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`block rounded-xl px-3 py-2.5 transition ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="block text-sm font-medium">{item.label}</span>
                <span
                  className={`mt-0.5 block text-xs ${
                    active ? "text-slate-300" : "text-slate-500"
                  }`}
                >
                  {item.description}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 px-4 py-4">
          <p className="truncate text-sm font-medium text-slate-800">
            {user?.username}
          </p>
          <button
            type="button"
            onClick={logout}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            退出登录
          </button>
        </div>
      </aside>
    </>
  );
}
