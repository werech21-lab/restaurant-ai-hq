import { connection } from "next/server";
import { requireUser } from "@/lib/erp-auth";
import { AssistantWidget } from "@/components/assistant-widget";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import { NotificationBell } from "@/components/notification-bell";
import { Sidebar } from "@/components/erp-sidebar";
import { prisma } from "@/lib/db";
import { formatQty } from "@/lib/format";
import { getCompany } from "@/lib/company";
import { LOCKED_MODULES } from "@/lib/modules";
import { enabledModuleKeys } from "@/lib/modules-db";
import { countLowStock, listLowStock } from "@/lib/stock";

export async function Shell({ children }: { children: React.ReactNode }) {
  await connection();
  const user = await requireUser();
  const [count, lowItems, notices, enabledKeys, company] = await Promise.all([
    countLowStock(),
    listLowStock(8),
    prisma.systemNotification.findMany({ where: { isRead: false }, orderBy: { createdAt: "desc" }, take: 8 }),
    enabledModuleKeys(),
    getCompany(),
  ]);
  const locked = new Set<string>(LOCKED_MODULES);
  const planKeys = new Set(company.enabledModules);
  const visibleKeys = (enabledKeys ?? company.enabledModules).filter((key) => planKeys.has(key) || locked.has(key));

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar user={user} enabledKeys={visibleKeys} />
      <div className="app-content min-h-screen md:mr-64">
        <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-8">
            <NotificationBell
              count={count + notices.length}
              items={lowItems.map((item) => ({
                id: item.id,
                name: item.name,
                code: item.code,
                stockLabel: formatQty(item.currentStock),
                reorderLabel: formatQty(item.reorderLevel),
              }))}
              notices={notices.map((notice) => ({
                id: notice.id,
                title: notice.title,
                body: notice.body,
                href: notice.href ?? "/automations",
              }))}
            />
            <p className="text-sm font-bold text-slate-900">{company.name}</p>
          </div>
        </header>
        <InstallAppBanner />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">{children}</main>
      </div>
      <AssistantWidget />
    </div>
  );
}
