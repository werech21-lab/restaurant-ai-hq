import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { requireUser } from '@/lib/erp-auth'
import { ScopeProvider } from '@/components/ScopeProvider'
import { BiFilterProvider } from '@/components/aether/BiFilterContext'
import { GlobalFilterProvider } from '@/components/aether/GlobalFilterContext'
import { ExecutiveCommandPalette } from '@/components/aether/ExecutiveCommandPalette'
import { GlobalFilterBar } from '@/components/aether/GlobalFilterBar'
import { TopFilterBar } from '@/components/aether/TopFilterBar'
import {
  Sidebar,
  SIDEBAR_ITEMS,
  SIDEBAR_SECTIONS,
  RAIL_TOGGLE_EVENT,
  type NavItem,
  type SidebarSection,
  type SidebarSectionId,
} from '@/components/erp-sidebar'
import { GovernanceProvider } from '@/components/erp/GovernanceBellDrawer'
import { ExecutiveFooter } from '@/components/erp/ExecutiveFooter'
import {
  normalizeExecSessionRole,
  type ExecSessionRole,
} from '@/lib/auth/exec-role-meta'
import {
  EXEC_SESSION_COOKIE,
  verifyExecSessionToken,
} from '@/lib/auth/exec-session'
import { getCompany } from '@/lib/company'
import { LOCKED_MODULES } from '@/lib/modules'
import { enabledModuleKeys } from '@/lib/modules-db'
import { getActiveScope } from '@/lib/scope'

export {
  Sidebar,
  SIDEBAR_ITEMS,
  SIDEBAR_SECTIONS,
  RAIL_TOGGLE_EVENT,
  type NavItem,
  type SidebarSection,
  type SidebarSectionId,
}

async function resolveActiveSessionRole(user: {
  email?: string
  role?: { name?: string }
  sessionRole?: string
  isAuditor?: boolean
}): Promise<ExecSessionRole> {
  if (
    user.isAuditor === true ||
    user.sessionRole === 'auditor' ||
    user.role?.name === 'Read-Only Auditor' ||
    (typeof user.email === 'string' && user.email.toLowerCase().includes('auditor'))
  ) {
    return 'auditor'
  }
  const fromUser = normalizeExecSessionRole(user.sessionRole)
  try {
    const cookieStore = await cookies()
    const rawToken =
      cookieStore.get(EXEC_SESSION_COOKIE)?.value ??
      cookieStore.get('aether_exec_session')?.value
    const verified = await verifyExecSessionToken(rawToken)
    if (verified) {
      return verified.role
    }
  } catch {
    // safe fallback when cookies are unavailable
  }
  return fromUser ?? 'admin'
}

/**
 * First-Class Fluid ERP Studio Shell (`src/components/erp/shell.tsx`)
 * Full-width fluid viewport (`w-full max-w-[1920px] mx-auto px-5 sm:px-7 xl:px-10`),
 * single sleek global header bar, 4-section executive sidebar, and crisp 14px–15px base typography.
 */
export async function ErpShell({ children }: { children: React.ReactNode }) {
  await connection()
  const user = await requireUser()
  const sessionRole = await resolveActiveSessionRole(
    user as {
      email?: string
      role?: { name?: string }
      sessionRole?: string
      isAuditor?: boolean
    },
  )
  const isAuditor = sessionRole === 'auditor'
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
        <GlobalFilterProvider>
          <GovernanceProvider isAuditor={isAuditor} sessionRole={sessionRole}>
            <div
              id="ae-root"
              className="relative z-0 text-[14.5px] leading-relaxed"
              data-erp-shell="persistent"
              data-auditor={isAuditor ? 'true' : 'false'}
              data-session-role={sessionRole}
            >
              <div className="ae-ambient" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <Sidebar
                user={user}
                enabledKeys={visibleKeys}
                isAuditor={isAuditor}
                sessionRole={sessionRole}
              />
              <div className="ae-content-col w-full flex-1 min-w-0">
                <div className="ae-page w-full max-w-[1920px] mx-auto px-4 sm:px-6 xl:px-10 pt-0 lg:pt-2 pb-24 lg:pb-8 min-w-0 space-y-3 text-[14.5px] leading-relaxed">
                  <TopFilterBar
                    companyNameAr={company.name}
                    isAuditor={isAuditor}
                    sessionRole={sessionRole}
                    userEmail={user.email}
                  />
                  <main className="w-full max-w-none min-w-0">
                    <div id="ae-canvas" className="app-content w-full min-w-0 space-y-3 text-[14.5px]">
                      <GlobalFilterBar />
                      {children}
                    </div>
                  </main>
                  <ExecutiveFooter sessionRole={sessionRole} />
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

export const Shell = ErpShell
