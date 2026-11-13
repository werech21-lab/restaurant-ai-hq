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

function decodeBase64UrlPayload(segment: string): Record<string, unknown> | null {
  try {
    if (!segment || !/^[A-Za-z0-9\-_]+$/.test(segment)) return null
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padLength = (4 - (base64.length % 4)) % 4
    const padded = base64 + '='.repeat(padLength)
    const decoded = Buffer.from(padded, 'base64').toString('utf8')
    const parsed = JSON.parse(decoded)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

async function resolveAuditorSessionFlag(user: {
  email?: string
  role?: { name?: string }
  sessionRole?: string
  isAuditor?: boolean
}): Promise<boolean> {
  if (user.isAuditor === true || user.sessionRole === 'auditor') return true
  if (
    user.role?.name === 'Read-Only Auditor' ||
    (typeof user.email === 'string' && user.email.toLowerCase().includes('auditor'))
  ) {
    return true
  }
  try {
    const cookieStore = await cookies()
    const rawToken = cookieStore.get('aether_exec_session')?.value
    if (rawToken && rawToken.includes('.')) {
      const payload = decodeBase64UrlPayload(rawToken.split('.')[0] ?? '')
      if (payload?.role === 'auditor') return true
      if (typeof payload?.sub === 'string' && payload.sub.toLowerCase().includes('auditor')) {
        return true
      }
    }
  } catch {
    // safe fallback when cookies are unavailable
  }
  return false
}

/**
 * First-Class Fluid ERP Studio Shell (`src/components/erp/shell.tsx`)
 * Full-width fluid viewport (`w-full max-w-[1920px] mx-auto px-5 sm:px-7 xl:px-10`),
 * single sleek global header bar, 4-section executive sidebar, and crisp 14px–15px base typography.
 */
export async function ErpShell({ children }: { children: React.ReactNode }) {
  await connection()
  const user = await requireUser()
  const isAuditor = await resolveAuditorSessionFlag(
    user as {
      email?: string
      role?: { name?: string }
      sessionRole?: string
      isAuditor?: boolean
    },
  )
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
          <GovernanceProvider isAuditor={isAuditor}>
            <div
              id="ae-root"
              className="relative z-0 text-[14.5px] leading-relaxed"
              data-erp-shell="persistent"
              data-auditor={isAuditor ? 'true' : 'false'}
              data-session-role={isAuditor ? 'auditor' : 'executive'}
            >
              <div className="ae-ambient" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <Sidebar user={user} enabledKeys={visibleKeys} isAuditor={isAuditor} />
              <div className="ae-content-col w-full flex-1 min-w-0">
                <div className="ae-page w-full max-w-[1920px] mx-auto px-4 sm:px-6 xl:px-10 pt-0 lg:pt-2 pb-24 lg:pb-8 min-w-0 space-y-3 text-[14.5px] leading-relaxed">
                  <TopFilterBar
                    companyNameAr={company.name}
                    isAuditor={isAuditor}
                    userEmail={user.email}
                  />
                  <main className="w-full max-w-none min-w-0">
                    <div id="ae-canvas" className="app-content w-full min-w-0 space-y-3 text-[14.5px]">
                      <GlobalFilterBar />
                      {children}
                    </div>
                  </main>
                  <ExecutiveFooter />
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
