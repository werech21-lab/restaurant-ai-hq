import type { AuthContext } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import type { Approval, DashboardKpis, Insight } from '@/modules/ai/domain/types'
import * as repository from '@/modules/ai/repositories/ai-repository'
import { getStageSummary } from '@/modules/crm'
import type { StageSummary } from '@/modules/crm/client'
import { getInvoiceSummary } from '@/modules/finance'
import type { InvoiceSummary } from '@/modules/finance/client'
import { getSummary } from '@/modules/inventory'

const INSIGHT_LIMIT = 6
const APPROVAL_LIMIT = 20
const SUMMARY_DAYS = 30
const ACTIVE_STAGES: ReadonlySet<string> = new Set(['new', 'contacted', 'qualified', 'proposal'])

export type Dashboard = {
  kpis: DashboardKpis
  /** Open insights, the most urgent first. Empty when the caller may not read insights. */
  insights: Insight[]
  /** Pending requests, the largest impact first. Empty when the caller may not read requests. */
  approvals: Approval[]
}

/** Month totals from the finance summary. `months` ends at the current UTC month, so the previous one is just before it. */
export function monthlyRevenue(summary: InvoiceSummary, now: Date): { monthMinor: number; previousMonthMinor: number } {
  const key = now.toISOString().slice(0, 7)
  const index = summary.months.findIndex((month) => month.month === key)
  const current = index >= 0 ? summary.months[index].invoicedMinor : 0
  const previous = index > 0 ? summary.months[index - 1].invoicedMinor : 0
  return { monthMinor: current, previousMonthMinor: previous }
}

/** Open pipeline: the expected revenue of leads that are still being worked (new through proposal). */
export function activePipeline(stages: readonly StageSummary[]): { activeValueMinor: number; activeCount: number } {
  let activeValueMinor = 0
  let activeCount = 0
  for (const stage of stages) {
    if (!ACTIVE_STAGES.has(stage.stage)) continue
    activeValueMinor += stage.expectedRevenueMinor
    activeCount += stage.count
  }
  return { activeValueMinor, activeCount }
}

/**
 * The numbers on the command center, read live from finance, inventory, CRM and the AI tables. A block the caller has no
 * permission to read is null, and the screen shows it as unavailable instead of a misleading zero.
 */
export async function getDashboard(auth: AuthContext): Promise<Dashboard> {
  const can = (permission: string): boolean => auth.permissions.has(permission)
  const now = new Date()
  const [invoiceSummary, inventorySummary, stages, pendingCount, openCounts, insights, approvals] = await Promise.all([
    can(permissions.financeInvoiceRead) ? getInvoiceSummary(auth) : Promise.resolve(null),
    can(permissions.inventoryStockRead) ? getSummary(auth, { days: SUMMARY_DAYS }) : Promise.resolve(null),
    can(permissions.crmLeadRead) ? getStageSummary(auth) : Promise.resolve(null),
    can(permissions.aiActionRead) ? repository.countPendingApprovals(db, auth.tenantId) : Promise.resolve(null),
    can(permissions.aiInsightRead) ? repository.countOpenInsights(db, auth.tenantId) : Promise.resolve(null),
    can(permissions.aiInsightRead) ? repository.topInsights(db, auth.tenantId, INSIGHT_LIMIT) : Promise.resolve([]),
    can(permissions.aiActionRead)
      ? repository.listApprovals(db, auth.tenantId, {
          status: 'pending',
          sort: 'impact',
          direction: 'desc',
          limit: APPROVAL_LIMIT,
        })
      : Promise.resolve(null),
  ])

  const kpis: DashboardKpis = {
    currency: 'KWD',
    revenue: invoiceSummary === null ? null : monthlyRevenue(invoiceSummary.data, now),
    receivables:
      invoiceSummary === null
        ? null
        : {
            outstandingMinor: invoiceSummary.data.outstandingMinor,
            overdueMinor: invoiceSummary.data.overdueMinor,
            overdueCount: invoiceSummary.data.overdueCount,
          },
    inventory:
      inventorySummary === null
        ? null
        : {
            valuationMinor: inventorySummary.data.valuationMinor,
            lowStockCount: inventorySummary.data.lowStockCount,
            outOfStockCount: inventorySummary.data.outOfStockCount,
          },
    pipeline: stages === null ? null : activePipeline(stages.data),
    pendingApprovals: pendingCount,
    openInsights:
      openCounts === null
        ? null
        : { ...openCounts, total: openCounts.critical + openCounts.warning + openCounts.opportunity },
  }
  return { kpis, insights, approvals: approvals === null ? [] : approvals.data }
}
