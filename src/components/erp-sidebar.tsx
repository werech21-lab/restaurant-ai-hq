"use client";

import {
  BarChart3,
  Blocks,
  ClipboardList,
  Building2,
  CreditCard,
  Contact,
  IdCard,
  Landmark,
  Download,
  LineChart,
  LayoutDashboard,
  LogOut,
  Monitor,
  Package,
  Receipt,
  Shield,
  ShoppingCart,
  UserRound,
  Users,
  Warehouse,
  Zap,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { LOCKED_MODULES, MODULES, type ModuleKey } from "@/lib/modules";
import { can, type AccessUser } from "@/lib/permissions";

const icons: Record<ModuleKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  users: Users,
  roles: Shield,
  inventory: Package,
  warehouses: Warehouse,
  purchases: ShoppingCart,
  sales: Receipt,
  crm: Contact,
  pos: Monitor,
  hr: IdCard,
  accounting: Landmark,
  automations: Zap,
  "app-builder": Blocks,
  reports: BarChart3,
  audit: ClipboardList,
  saas: Building2,
  payments: CreditCard,
};

function NavLinks({
  user,
  pathname,
  tone,
  enabledKeys,
}: {
  user: AccessUser;
  pathname: string;
  tone: "dark" | "light";
  enabledKeys: string[] | null;
}) {
  const locked = new Set<string>(LOCKED_MODULES);
  const items = MODULES.filter((item) => {
    if (!can(user, item.key, "view")) return false;
    if (!enabledKeys || locked.has(item.key)) return true;
    return enabledKeys.includes(item.key);
  });
  const idle = tone === "dark" ? "text-slate-200 hover:bg-slate-800" : "border border-slate-200 bg-white text-slate-800";
  const links = [
    ...items.map((item) => ({ ...item, icon: icons[item.key] })),
    { key: "profile", label: "الملف الشخصي", href: "/profile", icon: UserRound },
  ];
  return (
    <>
      {links.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== "/profile" && pathname.startsWith(`${item.href}/`));
        return (
          <a
            key={item.key}
            href={item.href}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap ${
              active ? "bg-blue-600 text-white" : idle
            }`}
          >
            <Icon size={18} />
            {item.label}
          </a>
        );
      })}
    </>
  );
}

export function Sidebar({ user, enabledKeys }: { user: AccessUser; enabledKeys: string[] | null }) {
  const pathname = usePathname();
  return (
    <>
      <aside className="app-sidebar fixed inset-y-0 right-0 z-30 hidden w-64 flex-col bg-slate-900 text-white md:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xs font-bold">
              BI
            </div>
            <div>
              <p className="text-base font-bold">AetherBI</p>
              <p className="text-xs text-slate-300">Enterprise ERP</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <NavLinks user={user} pathname={pathname} tone="dark" enabledKeys={enabledKeys} />
          <a href="/download" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${pathname === "/download" ? "bg-blue-600 text-white" : "text-slate-200 hover:bg-slate-800"}`}>
            <Download size={18} />
            مركز التحميل
          </a>
          {can(user, "reports", "view") ? (
            <a href="/bi-analytics" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${pathname.startsWith("/bi-analytics") ? "bg-blue-600 text-white" : "text-slate-200 hover:bg-slate-800"}`}>
              <LineChart size={18} />
              ذكاء الأعمال
            </a>
          ) : null}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="font-semibold">{user.name}</p>
          <p className="text-xs text-slate-300">{user.role.name}</p>
          <p className="text-xs text-slate-400" dir="ltr">
            {user.email}
          </p>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold"
            >
              <LogOut size={16} />
              تسجيل الخروج
            </button>
          </form>
        </div>
      </aside>
      <div className="app-mobile-nav sticky top-0 z-20 border-b border-slate-200 bg-white md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="font-bold text-slate-900">AetherBI ERP</p>
          <form action={logout}>
            <button type="submit" className="text-sm font-semibold text-blue-700">
              خروج
            </button>
          </form>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
          <NavLinks user={user} pathname={pathname} tone="light" enabledKeys={enabledKeys} />
        </nav>
      </div>
    </>
  );
}
