import { connection } from 'next/server'
import { requireUser } from '@/lib/erp-auth'
import { AssistantWidget } from '@/components/assistant-widget'
import { InstallAppBanner } from '@/components/InstallAppBanner'
import { NotificationBell } from '@/components/notification-bell'
import { PanelHeaderBar } from '@/components/panel-chrome'
import { ScopeProvider } from '@/components/ScopeProvider'
import { Sidebar } from '@/components/erp-sidebar'
import { prisma } from '@/lib/db'
import { formatQty } from '@/lib/format'
import { getCompany } from '@/lib/company'
import { LOCKED_MODULES } from '@/lib/modules'
import { enabledModuleKeys } from '@/lib/modules-db'
import { getActiveScope } from '@/lib/scope'
import { countLowStock, listLowStock } from '@/lib/stock'

export async function Shell({ children }: { children: React.ReactNode }) {
  await connection()
  const user = await requireUser()
  const scope = await getActiveScope()
  const [count, lowItems, notices, enabledKeys, company] = await Promise.all([
    countLowStock(scope.warehouseIds),
    listLowStock(8, scope.warehouseIds),
    prisma.systemNotification.findMany({ where: { isRead: false }, orderBy: { createdAt: 'desc' }, take: 8 }),
    enabledModuleKeys(),
    getCompany(),
  ])
  const locked = new Set<string>(LOCKED_MODULES)
  const planKeys = new Set(company.enabledModules)
  const visibleKeys = (enabledKeys ?? company.enabledModules).filter((key) => planKeys.has(key) || locked.has(key))

  return (
    <ScopeProvider
      initial={{
        brandId: scope.brandId,
        branchId: scope.branchId,
        labelAr: scope.labelAr,
        labelEn: scope.labelEn,
      }}
    >
      <div className="min-h-screen bg-ink-950 text-mist-100">
        <Sidebar user={user} enabledKeys={visibleKeys} />
        <div className="app-content min-h-screen md:ms-64">
          <header className="no-print sticky top-0 z-20 border-b border-gold-300/15 bg-ink-950/90 backdrop-blur">
            <PanelHeaderBar
              companyNameAr={company.name}
              notifications={
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
                    href: notice.href ?? '/automations',
                  }))}
                />
              }
            />
          </header>
          <InstallAppBanner />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 text-mist-100 md:px-8">{children}</main>
        </div>
        <AssistantWidget />
      </div>
    </ScopeProvider>
  )
}
