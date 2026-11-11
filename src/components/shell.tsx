import { connection } from 'next/server'
import { requireUser } from '@/lib/erp-auth'
import { NotificationBell } from '@/components/notification-bell'
import { PanelHeaderBar } from '@/components/panel-chrome'
import { ScopeProvider } from '@/components/ScopeProvider'
import { BiFilterProvider } from '@/components/aether/BiFilterContext'
import { GlobalFilterProvider } from '@/components/aether/GlobalFilterContext'
import { ExecutiveCommandPalette } from '@/components/aether/ExecutiveCommandPalette'
import { GlobalFilterBar } from '@/components/aether/GlobalFilterBar'
import { TopFilterBar } from '@/components/aether/TopFilterBar'
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
        <GlobalFilterProvider>
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
              <div className="px-4 pt-2 lg:px-6">
                <header id="ae-topbar" className="no-print sticky top-2 z-40 mx-auto w-full max-w-[1440px] overflow-visible">
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
                          href: notice.href ?? '/erp',
                        }))}
                      />
                    }
                  />
                </header>
              </div>
              <main className="w-full max-w-none pb-20 md:pb-8">
                <div id="ae-canvas" className="app-content w-full">
                  {/* Wide Executive Studio Container: max-w-[1440px] w-full mx-auto px-4 lg:px-6 with tight above-the-fold rhythm */}
                  <div className="ae-page max-w-[1440px] w-full mx-auto min-w-0 space-y-3 px-4 py-2.5 lg:px-6">
                    <TopFilterBar />
                    <GlobalFilterBar />
                    {children}
                  </div>
                </div>
              </main>
            </div>
            <ExecutiveCommandPalette />
          </div>
        </GlobalFilterProvider>
      </BiFilterProvider>
    </ScopeProvider>
  )
}
