import { connection } from 'next/server'
import { requireUser } from '@/lib/erp-auth'
import { PanelHeaderBar } from '@/components/panel-chrome'
import { ScopeProvider } from '@/components/ScopeProvider'
import { BiFilterProvider } from '@/components/aether/BiFilterContext'
import { GlobalFilterProvider } from '@/components/aether/GlobalFilterContext'
import { ExecutiveCommandPalette } from '@/components/aether/ExecutiveCommandPalette'
import { GlobalFilterBar } from '@/components/aether/GlobalFilterBar'
import { TopFilterBar } from '@/components/aether/TopFilterBar'
import { Sidebar } from '@/components/erp-sidebar'
import { GovernanceBellTrigger, GovernanceProvider } from '@/components/erp/GovernanceBellDrawer'
import { getCompany } from '@/lib/company'
import { LOCKED_MODULES } from '@/lib/modules'
import { enabledModuleKeys } from '@/lib/modules-db'
import { getActiveScope } from '@/lib/scope'

export async function Shell({ children }: { children: React.ReactNode }) {
  await connection()
  const user = await requireUser()
  const scope = await getActiveScope()
  const [enabledKeys, company] = await Promise.all([
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
          <GovernanceProvider>
            {/* Aether BI V12 studio shell: persistent live canvas underneath z-50 frosted overlays */}
            <div id="ae-root" className="relative z-0" data-erp-shell="persistent">
              <div className="ae-ambient" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <Sidebar user={user} enabledKeys={visibleKeys} />
              <div className="ae-content-col w-full flex-1 min-w-0">
                <div className="px-4 pt-1.5 sm:px-6 lg:px-8">
                  <header id="ae-topbar" className="no-print sticky top-2 z-40 mx-auto w-full max-w-[1520px] overflow-visible">
                    <PanelHeaderBar
                      companyNameAr={company.name}
                      notifications={<GovernanceBellTrigger />}
                    />
                  </header>
                </div>
                <main className="w-full max-w-none pb-20 md:pb-8">
                  <div id="ae-canvas" className="app-content w-full">
                    {/* Full-Width Executive Studio Container: max-w-[1520px] w-full mx-auto px-4 sm:px-6 lg:px-8 */}
                    <div className="ae-page max-w-[1520px] w-full mx-auto min-w-0 space-y-2.5 px-4 py-2 sm:px-6 lg:px-8">
                      <TopFilterBar />
                      <GlobalFilterBar />
                      {children}
                    </div>
                  </div>
                </main>
              </div>
              <ExecutiveCommandPalette />
            </div>
          </GovernanceProvider>
        </GlobalFilterProvider>
      </BiFilterProvider>
    </ScopeProvider>
  )
}
