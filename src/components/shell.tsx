import { connection } from 'next/server'
import { requireUser } from '@/lib/erp-auth'
import {
  normalizeExecSessionRole,
  resolveExecRoleProfile,
} from '@/lib/auth/exec-role-meta'
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

/**
 * Shared Fluid Application Shell (`src/components/shell.tsx`)
 * Compatible across ERP and non-ERP panel routes with V35 atmospheric glass canvas,
 * full-width fluid viewport (`w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-7 xl:px-10`),
 * and crisp 14px–15px base text.
 */
export async function Shell({ children }: { children: React.ReactNode }) {
  await connection()
  const user = await requireUser()
  const sessionRole = normalizeExecSessionRole(user.sessionRole) ?? 'admin'
  const roleBadge = resolveExecRoleProfile(sessionRole)
  const isAuditor = roleBadge.isAuditor
  const scope = await getActiveScope()
  const [enabledKeys, company] = await Promise.all([enabledModuleKeys(), getCompany()])
  const locked = new Set<string>(LOCKED_MODULES)
  const planKeys = new Set(company.enabledModules)
  const visibleKeys = (enabledKeys ?? company.enabledModules).filter(
    (key) => planKeys.has(key) || locked.has(key),
  )

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
        <GlobalFilterProvider isAuditor={isAuditor} sessionRole={roleBadge.role}>
          <GovernanceProvider isAuditor={isAuditor} sessionRole={roleBadge.role}>
            <div
              id="ae-root"
              className="relative z-0 min-h-dvh bg-[var(--v35-bg-canvas)] text-[14.5px] leading-relaxed text-[var(--v35-text-primary)]"
              data-erp-shell="persistent"
              data-rail-choreography="252px-76px-clip-flip"
              data-auditor={isAuditor ? 'true' : 'false'}
              data-session-role={roleBadge.role}
              data-role-title-ar={roleBadge.titleAr}
              data-role-title-en={roleBadge.titleEn}
            >
              <div
                className="ae-ambient pointer-events-none fixed inset-0 -z-10 overflow-hidden"
                aria-hidden
              >
                <span
                  style={{
                    background:
                      'radial-gradient(circle, var(--v35-ambient-1), transparent 68%)',
                  }}
                />
                <span
                  style={{
                    background:
                      'radial-gradient(circle, var(--v35-ambient-2), transparent 68%)',
                  }}
                />
                <span
                  style={{
                    background:
                      'radial-gradient(circle, var(--v35-ambient-3), transparent 68%)',
                  }}
                />
              </div>
              <Sidebar
                user={user}
                enabledKeys={visibleKeys}
                isAuditor={isAuditor}
                sessionRole={roleBadge.role}
              />
              <div className="ae-content-col w-full flex-1 min-w-0 transition-[max-width,transform] duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none">
                <div className="ae-page w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-7 xl:px-10 pt-0 lg:pt-[var(--v35-rail-inset)] pb-28 sm:pb-12 lg:pb-10 min-w-0 space-y-3 lg:space-y-4 text-[14.5px] leading-relaxed">
                  <TopFilterBar
                    companyNameAr={company.name}
                    notifications={<GovernanceBellTrigger />}
                    isAuditor={isAuditor}
                    sessionRole={roleBadge.role}
                    userEmail={user.email}
                  />
                  <main className="w-full max-w-none min-w-0 bg-transparent">
                    <div
                      id="ae-canvas"
                      className="app-content w-full min-w-0 space-y-3 lg:space-y-4 bg-transparent text-[14.5px] text-[var(--v35-text-primary)]"
                    >
                      <GlobalFilterBar />
                      {children}
                    </div>
                  </main>
                </div>
              </div>
              <ExecutiveCommandPalette />
            </div>
          </GovernanceProvider>
        </GlobalFilterProvider>
      </BiFilterProvider>
    </ScopeProvider>
  )
}
