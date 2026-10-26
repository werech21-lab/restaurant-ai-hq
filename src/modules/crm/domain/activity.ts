import type { CustomerFinancials } from '@/modules/finance/client'
import type { ActivityEntry, Lead, Quotation } from '@/modules/crm/domain/types'

export const ACTIVITY_LIMIT = 30

/**
 * One merged, newest-first history from what the profile already loaded. There is no separate activity table, so only
 * events with a timestamp on the record appear: creation, the sent / accepted / converted stamps, a rejection or expiry
 * (stamped with the last update), won or lost leads, invoices, voids and payments.
 */
export function buildActivity(args: {
  quotations: readonly Quotation[]
  leads: readonly Lead[]
  financials: CustomerFinancials | null
}): ActivityEntry[] {
  const entries: ActivityEntry[] = []

  for (const quotation of args.quotations) {
    const base = { kind: 'quotation' as const, reference: quotation.quoteNumber, amountMinor: quotation.totalMinor }
    entries.push({ ...base, action: 'created', at: quotation.createdAt })
    if (quotation.sentAt) entries.push({ ...base, action: 'sent', at: quotation.sentAt })
    if (quotation.acceptedAt) entries.push({ ...base, action: 'accepted', at: quotation.acceptedAt })
    if (quotation.convertedAt) entries.push({ ...base, action: 'converted', at: quotation.convertedAt })
    if (quotation.status === 'rejected' || quotation.status === 'expired') {
      entries.push({ ...base, action: quotation.status, at: quotation.updatedAt })
    }
  }

  for (const lead of args.leads) {
    const base = { kind: 'lead' as const, reference: lead.title, amountMinor: lead.expectedRevenueMinor }
    entries.push({ ...base, action: 'created', at: lead.createdAt })
    if (lead.stage === 'won' || lead.stage === 'lost') entries.push({ ...base, action: lead.stage, at: lead.updatedAt })
  }

  if (args.financials) {
    for (const invoice of args.financials.recentInvoices) {
      const base = { kind: 'invoice' as const, reference: invoice.number, amountMinor: invoice.totalMinor }
      entries.push({ ...base, action: 'created', at: invoice.createdAt })
      if (invoice.voidedAt) entries.push({ ...base, action: 'voided', at: invoice.voidedAt })
    }
    for (const payment of args.financials.recentPayments) {
      entries.push({
        kind: 'payment',
        action: 'recorded',
        at: payment.paidAt,
        reference: payment.invoiceNumber,
        amountMinor: payment.amountMinor,
      })
    }
  }

  return entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, ACTIVITY_LIMIT)
}
