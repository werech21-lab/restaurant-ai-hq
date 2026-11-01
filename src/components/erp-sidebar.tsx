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
  const idle =
    tone === "dark"
      ? "text-mist-300 hover:bg-ink-800 hover:text-mist-100"
      : "border border-gold-300/20 bg-ink-900 text-mist-100";
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
              active
                ? "bg-gradient-to-l from-[#8cc63f] to-[#00a99d] text-ink-950"
                : idle
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
      <aside className="app-sidebar fixed inset-y-0 right-0 z-30 hidden w-64 flex-col border-l border-gold-300/10 bg-ink-950 text-mist-100 md:flex">
        <div className="border-b border-gold-300/15 px-4 py-5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/venture-foods-logo-dark.svg" alt="Venture Foods" className="h-12 w-auto object-contain" />
          </div>
          <p className="mt-3 text-[11px] font-semibold leading-4 text-mist-400">
            شركة فنتشر فودز لإدارة المطاعم ذ.م.م.
          </p>
          <p className="mt-1 text-[10px] text-[#8cc63f]">AetherBI · 6 Brands · 10 Branches</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <NavLinks user={user} pathname={pathname} tone="dark" enabledKeys={enabledKeys} />
          <a
            href="/download"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
              pathname === "/download"
                ? "bg-gradient-to-l from-[#8cc63f] to-[#00a99d] text-ink-950"
                : "text-mist-300 hover:bg-ink-800"
            }`}
          >
            <Download size={18} />
            مركز التحميل
          </a>
          {can(user, "reports", "view") ? (
            <a
              href="/bi-analytics"
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                pathname.startsWith("/bi-analytics")
                  ? "bg-gradient-to-l from-[#8cc63f] to-[#00a99d] text-ink-950"
                  : "text-mist-300 hover:bg-ink-800"
              }`}
            >
              <LineChart size={18} />
              ذكاء الأعمال
            </a>
          ) : null}
        </nav>
        <div className="border-t border-gold-300/15 p-4">
          <p className="font-semibold text-mist-100">{user.name}</p>
          <p className="text-xs text-mist-400">{user.role.name}</p>
          <p className="text-xs text-mist-500" dir="ltr">
            {user.email}
          </p>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm font-semibold text-mist-100 hover:border-gold-300/40"
            >
              <LogOut size={16} />
              تسجيل الخروج
            </button>
          </form>
        </div>
      </aside>
      <div className="app-mobile-nav sticky top-0 z-20 border-b border-gold-300/15 bg-ink-950 md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/venture-foods-logo-dark.svg" alt="Venture Foods" className="h-9 w-auto" />
          </div>
          <form action={logout}>
            <button type="submit" className="text-sm font-semibold text-[#8cc63f]">
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
