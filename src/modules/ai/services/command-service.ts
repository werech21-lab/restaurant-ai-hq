import { AppError } from '@/lib/api/errors'
import type { AuthContext } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'
import { db } from '@/lib/db'
import { parseCommand } from '@/modules/ai/domain/command'
import { formatCount, formatKwd } from '@/modules/ai/domain/messages'
import type { CommandOutcome, CommandResult, Insight } from '@/modules/ai/domain/types'
import * as repository from '@/modules/ai/repositories/ai-repository'
import type { CommandBody } from '@/modules/ai/schemas/ai'
import { runScan } from '@/modules/ai/services/scan-service'
import { listCustomers } from '@/modules/crm'
import { listCustomersQuerySchema } from '@/modules/crm/client'
import { listInvoices } from '@/modules/finance'
import { listInvoicesQuerySchema } from '@/modules/finance/client'
import { listItems } from '@/modules/inventory'
import { listItemsQuerySchema } from '@/modules/inventory/client'

const RESULT_LIMIT = 5
const INSIGHT_LIMIT = 10

export const customerHref = (id: string): string => `/erp/crm?customer=${encodeURIComponent(id)}`
export const itemHref = (id: string): string => `/erp/inventory?item=${encodeURIComponent(id)}`
export const invoiceHref = (id: string): string => `/erp/finance?invoice=${encodeURIComponent(id)}`

async function searchRecords(auth: AuthContext, text: string): Promise<CommandResult[]> {
  const can = (permission: string): boolean => auth.permissions.has(permission)
  const [customers, items, invoices] = await Promise.all([
    can(permissions.crmCustomerRead)
      ? listCustomers(auth, listCustomersQuerySchema.parse({ q: text, limit: RESULT_LIMIT }))
      : Promise.resolve(null),
    can(permissions.inventoryItemRead)
      ? listItems(auth, listItemsQuerySchema.parse({ q: text, limit: RESULT_LIMIT, status: 'all' }))
      : Promise.resolve(null),
    can(permissions.financeInvoiceRead)
      ? listInvoices(auth, listInvoicesQuerySchema.parse({ q: text, limit: RESULT_LIMIT }))
      : Promise.resolve(null),
  ])
  const results: CommandResult[] = []
  for (const invoice of invoices?.data ?? []) {
    results.push({
      kind: 'invoice',
      id: invoice.id,
      label: invoice.number,
      detail: `${invoice.customerName} · ${formatKwd(invoice.totalMinor)}`,
      href: invoiceHref(invoice.id),
    })
  }
  for (const item of items?.data ?? []) {
    results.push({
      kind: 'item',
      id: item.id,
      label: item.name,
      detail: `${item.sku} · ${formatCount(item.currentStock)}`,
      href: itemHref(item.id),
    })
  }
  for (const customer of customers?.data ?? []) {
    results.push({
      kind: 'customer',
      id: customer.id,
      label: customer.name,
      detail: customer.phone ?? customer.email ?? '',
      href: customerHref(customer.id),
    })
  }
  return results
}

async function matchingInsights(auth: AuthContext, parsed: ReturnType<typeof parseCommand>): Promise<Insight[]> {
  if (!auth.permissions.has(permissions.aiInsightRead)) return []
  const page = await repository.listInsights(db, auth.tenantId, {
    status: parsed.status ?? 'live',
    severity: parsed.severity ?? undefined,
    category: parsed.category ?? undefined,
    q: parsed.text === '' ? undefined : parsed.text,
    sort: 'detectedAt',
    direction: 'desc',
    limit: INSIGHT_LIMIT,
  })
  return page.data
}

/**
 * The Copilot bar. Reads the text with fixed keyword lists (no language model): a scan word runs the full scan, status,
 * severity and category words filter insights, and any other words search invoices, items and customers the caller may read.
 */
export async function runCommand(auth: AuthContext, input: CommandBody): Promise<CommandOutcome> {
  const parsed = parseCommand(input.text)
  if (parsed.scan) {
    if (!auth.permissions.has(permissions.aiScanRun)) {
      throw new AppError(403, 'forbidden', 'You do not have permission to run a scan.')
    }
    const scan = await runScan(auth, { trigger: null, itemIds: null })
    const insights = auth.permissions.has(permissions.aiInsightRead)
      ? await repository.topInsights(db, auth.tenantId, INSIGHT_LIMIT)
      : []
    return { intent: 'scan', insights, results: [], scan }
  }
  const [insights, results] = await Promise.all([
    matchingInsights(auth, parsed),
    parsed.text === '' ? Promise.resolve([]) : searchRecords(auth, parsed.text),
  ])
  return { intent: parsed.text === '' ? 'filter' : 'search', insights, results, scan: null }
}
