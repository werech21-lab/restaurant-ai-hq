import { connection } from 'next/server'
import { requireUser } from '@/lib/erp-auth'
import { NotificationBell } from '@/components/notification-bell'
import { PanelHeaderBar } from '@/components/panel-chrome'
import { ScopeProvider } from '@/components/ScopeProvider'
import { BiFilterProvider } from '@/components/aether/BiFilterContext'
import { ExecutiveCommandPalette } from '@/components/aether/ExecutiveCommandPalette'
import { GlobalFilterBar } from '@/components/aether/GlobalFilterBar'
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
      <BiFilterProvider>
        {/* Aether BI V2 oceanic glass shell: ambient gradient → glass rail → floating topbar → frosted canvas */}
        <div id="ae-root">
          <div className="ae-ambient" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <Sidebar user={user} enabledKeys={visibleKeys} />
          {/*
            Fixed w-64 sidebar uses logical `start-0`. Clear it with padding-inline-start (ps-64)
            plus explicit LTR/RTL physical fallbacks so content never slides under the rail.
          */}
          <div className="ae-content-col w-full min-w-0 md:ps-64 ltr:md:pl-64 rtl:md:pl-0 rtl:md:pr-64">
            <div className="px-3 pt-3 sm:px-4 md:px-5">
              <header id="ae-topbar" className="no-print sticky top-3 z-40 overflow-visible">
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
            </div>
            <main className="w-full max-w-none px-3 pb-24 pt-4 sm:px-4 md:px-5 md:pb-6">
              <div id="ae-canvas" className="app-content w-full p-4 sm:p-6 lg:p-8">
                {/* One unified workspace geometry on every route: 1520px max, centred */}
                <div className="ae-page mx-auto w-full min-w-0 max-w-[1520px] space-y-6">
                  <GlobalFilterBar />
                  {children}
                </div>
              </div>
            </main>
          </div>
          <ExecutiveCommandPalette />
        </div>
      </BiFilterProvider>
    </ScopeProvider>
  )
}
