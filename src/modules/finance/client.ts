// Browser-safe public API of the Finance module: types, Zod schemas and pure domain rules. Never import server code here.
export { invoiceStatuses, paymentMethods } from '@/modules/finance/domain/types'
export type {
  CustomerFinancials,
  FinanceSettings,
  Invoice,
  InvoiceDetail,
  InvoiceLine,
  InvoiceStatus,
  InvoiceSummary,
  OverdueInvoiceRef,
  Payment,
  PaymentMethod,
  ReceivableSignal,
} from '@/modules/finance/domain/types'
export { computeTotals, lineNetMinor, MAX_INVOICE_MINOR } from '@/modules/finance/domain/totals'
export type { InvoiceTotals } from '@/modules/finance/domain/totals'
export { requiresApproval } from '@/modules/finance/domain/invoice'
export {
  createInvoiceSchema,
  invoiceLineSchema,
  invoiceSortKeys,
  listInvoicesQuerySchema,
  recordPaymentSchema,
  updateInvoiceSchema,
  voidInvoiceSchema,
} from '@/modules/finance/schemas/invoice'
export type {
  CreateInvoiceInput,
  InvoiceLineInput,
  InvoiceSortKey,
  ListInvoicesQuery,
  RecordPaymentInput,
  UpdateInvoiceInput,
  VoidInvoiceInput,
} from '@/modules/finance/schemas/invoice'
