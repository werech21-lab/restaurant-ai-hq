import type { Currency } from '@/lib/money'
import type { CustomerFinancials, InvoiceDetail } from '@/modules/finance/client'
import type { StockShortage } from '@/modules/inventory/client'

// ---- customers ----

/** lead and prospect are not yet customers you invoice. Only `active` can be invoiced. `blocked` can do nothing new. */
export const customerStatuses = ['lead', 'prospect', 'active', 'blocked'] as const
export type CustomerStatus = (typeof customerStatuses)[number]

export const customerTypes = ['company', 'individual'] as const
export type CustomerType = (typeof customerTypes)[number]

export type Customer = {
  id: string
  name: string
  customerType: CustomerType
  email: string | null
  phone: string | null
  taxId: string | null
  address: string | null
  /** Largest open balance allowed when converting a quotation. Null means no limit, 0 means no credit. */
  creditLimitMinor: number | null
  status: CustomerStatus
  notes: string | null
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

/** What other modules may know about a customer. */
export type CustomerRef = Pick<Customer, 'id' | 'name' | 'status'>

// ---- leads pipeline ----

export const leadStages = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as const
export type LeadStage = (typeof leadStages)[number]

/** Stages a lead can be created in and can move between freely. `won` and `lost` are final. */
export const openLeadStages = ['new', 'contacted', 'qualified', 'proposal'] as const
export type OpenLeadStage = (typeof openLeadStages)[number]

export type Lead = {
  id: string
  customerId: string
  customerName: string
  title: string
  stage: LeadStage
  expectedRevenueMinor: number
  currency: Currency
  /** Whole percent, 0 to 100. A won lead is always 100 and a lost lead is always 0. */
  probability: number
  assignedTo: string | null
  expectedCloseDate: string | null
  notes: string | null
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type StageSummary = { stage: LeadStage; count: number; expectedRevenueMinor: number }

export type TeamMember = { userId: string; displayName: string; role: string }

// ---- quotations ----

export const quotationStatuses = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'] as const
export type QuotationStatus = (typeof quotationStatuses)[number]

export type QuotationLine = {
  id: string
  position: number
  itemId: string | null
  warehouseId: string | null
  description: string
  quantity: number
  unitPriceMinor: number
  taxRateBps: number
  /** quantity x unit price. Tax is not rounded per line. */
  lineNetMinor: number
}

export type Quotation = {
  id: string
  quoteNumber: string
  customerId: string
  customerName: string
  leadId: string | null
  status: QuotationStatus
  currency: Currency
  validUntil: string
  notes: string | null
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
  invoiceId: string | null
  sentAt: string | null
  acceptedAt: string | null
  convertedAt: string | null
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type QuotationDetail = Quotation & {
  lines: QuotationLine[]
  /** Lines the stock on hand cannot cover right now. Empty once the quotation is closed or when the caller cannot read stock. */
  stockShortages: StockShortage[]
}

/** Result of the one-click quote-to-cash action. */
export type ConversionResult = {
  quotation: QuotationDetail
  invoice: InvoiceDetail
  lead: Lead | null
  /** True when the invoice was issued and its stock deducted. False when it waits for approval, which deducts stock. */
  stockDeducted: boolean
}

// ---- customer 360 ----

export type ActivityKind = 'quotation' | 'lead' | 'invoice' | 'payment'

export type ActivityEntry = {
  kind: ActivityKind
  /** created, sent, accepted, rejected, expired, converted, moved, won, issued, recorded and so on. */
  action: string
  at: string
  reference: string
  amountMinor: number | null
}

export type CustomerProfile = {
  customer: Customer
  /** Null when the caller cannot read finance. */
  financials: CustomerFinancials | null
  quotations: Quotation[]
  leads: Lead[]
  activity: ActivityEntry[]
}

// ---- AI integration ----

/** A customer's contact details for a message the AI engine drafts. Nothing is sent from here. */
export type CustomerContact = { id: string; name: string; phone: string | null; status: CustomerStatus; version: number }

/** An open lead that has been quiet for a while, with the draft quotation that could carry a discount. */
export type StalledLead = {
  leadId: string
  title: string
  stage: OpenLeadStage
  probability: number
  expectedRevenueMinor: number
  /** Whole days since the lead last changed. */
  daysStalled: number
  customerId: string
  customerName: string
  customerStatus: CustomerStatus
  customerPhone: string | null
  /** The latest draft quotation of this lead. Null when there is none. */
  draftQuotation: { id: string; quoteNumber: string; version: number; subtotalMinor: number; totalMinor: number } | null
}
