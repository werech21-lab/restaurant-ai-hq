import type { Currency } from '@/lib/money'

export const invoiceStatuses = ['draft', 'pending_approval', 'issued', 'partially_paid', 'paid', 'void'] as const
export type InvoiceStatus = (typeof invoiceStatuses)[number]

export const paymentMethods = ['cash', 'card', 'knet', 'bank_transfer'] as const
export type PaymentMethod = (typeof paymentMethods)[number]

export type InvoiceLine = {
  id: string
  position: number
  description: string
  quantity: number
  unitPriceMinor: number
  taxRateBps: number
  lineNetMinor: number
  /** Stock item sold on this line, or null for a service or free-text line. */
  itemId: string | null
  /** Warehouse the stock leaves from. Set exactly when `itemId` is set. */
  warehouseId: string | null
}

export type Payment = {
  id: string
  invoiceId: string
  amountMinor: number
  currency: Currency
  method: PaymentMethod
  paidAt: string
  reference: string | null
  createdAt: string
  createdBy: string
}

export type Invoice = {
  id: string
  number: string
  customerId: string
  customerName: string
  status: InvoiceStatus
  currency: Currency
  issueDate: string
  dueDate: string
  notes: string | null
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
  paidMinor: number
  requiresApproval: boolean
  submittedAt: string | null
  approvedAt: string | null
  approvedBy: string | null
  voidedAt: string | null
  voidReason: string | null
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type InvoiceDetail = Invoice & {
  lines: InvoiceLine[]
  payments: Payment[]
}

export type FinanceSettings = {
  currency: Currency
  invoicePrefix: string
  approvalThresholdMinor: number
}

/** A customer's money position, built from finance records only. */
export type CustomerFinancials = {
  /** Total of issued, partially paid and paid invoices. */
  totalInvoicedMinor: number
  /** Unpaid balance of issued and partially paid invoices. */
  openBalanceMinor: number
  overdueMinor: number
  invoiceCount: number
  recentInvoices: Invoice[]
  recentPayments: Array<{
    id: string
    invoiceId: string
    invoiceNumber: string
    amountMinor: number
    paidAt: string
  }>
}

export type InvoiceSummary = {
  approvalThresholdMinor: number
  countsByStatus: Record<InvoiceStatus, number>
  outstandingMinor: number
  overdueMinor: number
  overdueCount: number
  months: Array<{ month: string; invoicedMinor: number; collectedMinor: number }>
}

/** One overdue invoice, as the AI engine reads it. */
export type OverdueInvoiceRef = {
  id: string
  number: string
  dueDate: string
  balanceMinor: number
  daysOverdue: number
}

/** Everything one customer is overdue on: issued and partially paid invoices whose due date is before today (UTC). */
export type ReceivableSignal = {
  customerId: string
  customerName: string
  overdueMinor: number
  overdueInvoiceCount: number
  oldestDaysOverdue: number
  /** The largest overdue invoices first, at most three. */
  invoices: OverdueInvoiceRef[]
}

/** What one invoice owes right now. */
export type InvoiceBalance = { id: string; status: InvoiceStatus; balanceMinor: number }
