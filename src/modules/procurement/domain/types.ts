export const supplierStatuses = ['active', 'blocked'] as const
export type SupplierStatus = (typeof supplierStatuses)[number]

export const orderStatuses = ['draft', 'pending_approval', 'approved', 'partially_received', 'received', 'cancelled'] as const
export type OrderStatus = (typeof orderStatuses)[number]

export type Supplier = {
  id: string
  code: string
  name: string
  status: SupplierStatus
  paymentTermsDays: number
  notes: string | null
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type OrderLine = {
  id: string
  lineNo: number
  itemId: string
  description: string
  quantity: number
  unitCostMinor: number
  taxRateBps: number
  receivedQuantity: number
  /** Quantity already billed on posted supplier invoices (voided ones excluded). */
  invoicedQuantity: number
  /** Quantity sent back to the supplier. It never passes the received quantity. */
  returnedQuantity: number
  /** Quantity credited back on posted supplier credit notes. It never passes the invoiced quantity. */
  creditedQuantity: number
}

export type PurchaseOrder = {
  id: string
  number: number
  supplierId: string
  supplierName: string
  status: OrderStatus
  orderDate: string
  expectedDate: string | null
  currency: 'KWD'
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
  notes: string | null
  approvalRequired: boolean | null
  submittedAt: string | null
  submittedBy: string | null
  approvedAt: string | null
  approvedBy: string | null
  cancelledAt: string | null
  cancelledBy: string | null
  cancelledReason: string | null
  lineCount: number
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type PurchaseOrderDetail = PurchaseOrder & { lines: OrderLine[] }

export type ReceiptLine = {
  id: string
  lineNo: number
  orderLineId: string
  itemId: string
  quantity: number
}

export type GoodsReceipt = {
  id: string
  number: number
  orderId: string
  orderNumber: number
  warehouseId: string
  receiptDate: string
  notes: string | null
  lineCount: number
  totalQuantity: number
  /** Quantity x order price over the lines, in fils. */
  valueMinor: number
  /** The ledger entry that booked this receipt (Dr inventory, Cr GRNI). Null on the invoice basis, or when the value is zero. */
  journalEntryId: string | null
  createdAt: string
  createdBy: string
}

export type GoodsReceiptDetail = GoodsReceipt & { lines: ReceiptLine[] }

export type ProcurementSettings = {
  /** Orders above this total need approval. Null means no order needs approval (nobody has set a limit). */
  approvalThresholdMinor: number | null
  /** 0 until the settings are first saved. */
  version: number
}

// ---- purchase requests ----

export const requestStatuses = ['draft', 'submitted', 'approved', 'rejected', 'converted', 'cancelled'] as const
export type RequestStatus = (typeof requestStatuses)[number]

export type RequestLine = {
  id: string
  lineNo: number
  itemId: string
  description: string
  quantity: number
}

export type PurchaseRequest = {
  id: string
  number: number
  requestedBy: string
  status: RequestStatus
  neededBy: string | null
  reason: string | null
  submittedAt: string | null
  submittedBy: string | null
  decidedAt: string | null
  decidedBy: string | null
  decisionNote: string | null
  purchaseOrderId: string | null
  purchaseOrderNumber: number | null
  convertedAt: string | null
  cancelledAt: string | null
  cancelledReason: string | null
  lineCount: number
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type PurchaseRequestDetail = PurchaseRequest & { lines: RequestLine[] }

// ---- accounting ----

export const accountingBases = ['invoice_basis', 'receipt_basis'] as const
/** `order_price` keeps the catalogue cost. `moving_weighted_average` is the experimental default when a company first saves settings. */
export const costingMethods = ['order_price', 'moving_weighted_average'] as const
export type CostingMethod = (typeof costingMethods)[number]
/**
 * `invoice_basis`: stock reaches the ledger when the supplier invoice is booked. `receipt_basis` (perpetual): it reaches the
 * ledger when it is received, against the GRNI account, and the invoice clears GRNI.
 */
export type AccountingBasis = (typeof accountingBases)[number]

/** The accounts and match tolerances the procurement documents use. Every id is null until the company chooses them, and nothing is posted before that. */
export type ProcurementAccounting = {
  inventoryAccountId: string | null
  payableAccountId: string | null
  inputTaxAccountId: string | null
  /** Goods received not invoiced: a liability account, used on the receipt basis only. */
  grniAccountId: string | null
  /** Purchase price variance: an expense account, used on the receipt basis only. */
  ppvAccountId: string | null
  /** Experimental. `moving_weighted_average` is offered when settings have never been saved; the engine stays on order price until a row is saved. */
  costingMethod: CostingMethod
  cogsAccountId: string | null
  accountingBasis: AccountingBasis
  /** The billed price may differ from the order price by this many basis points of the order price. */
  priceToleranceBps: number
  /** The tax of an invoice may differ from the tax at the order's rates by this many fils. */
  taxToleranceMinor: number
  /** 0 until the accounts are first saved. */
  version: number
}

// ---- supplier invoices ----

export const invoiceStatuses = ['posted', 'void'] as const
export type SupplierInvoiceStatus = (typeof invoiceStatuses)[number]

export type SupplierInvoiceLine = {
  id: string
  lineNo: number
  orderLineId: string
  itemId: string
  description: string
  quantity: number
  /** The price on the supplier's invoice. */
  unitCostMinor: number
  taxRateBps: number
  /** The order's price and rate for this line, copied by the database when the line was written. */
  poUnitCostMinor: number
  poTaxRateBps: number
  /** Quantity of this line already credited on posted credit notes. */
  creditedQuantity: number
}

export const paymentStatuses = ['unpaid', 'partially_paid', 'paid', 'credited'] as const
/** Derived from the open balance: `credited` is a balance of zero reached by credit notes alone. */
export type SupplierPaymentStatus = (typeof paymentStatuses)[number]

export type SupplierInvoice = {
  id: string
  number: number
  supplierId: string
  supplierName: string
  /** The number printed on the supplier's own invoice. */
  supplierInvoiceNumber: string
  orderId: string
  orderNumber: number
  status: SupplierInvoiceStatus
  invoiceDate: string
  dueDate: string
  currency: 'KWD'
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
  accountingBasis: AccountingBasis
  /** Billed net minus the net at the order's prices. Positive: the supplier billed more than ordered. */
  priceVarianceMinor: number
  /** Billed tax minus the tax at the order's rates on the billed prices. */
  taxVarianceMinor: number
  /** Paid on posted payments. */
  paidMinor: number
  /** Credited on posted credit notes. */
  creditedMinor: number
  /** total - paid - credited. Never negative. */
  balanceMinor: number
  paymentStatus: SupplierPaymentStatus
  notes: string | null
  journalEntryId: string
  voidReason: string | null
  voidedAt: string | null
  voidedBy: string | null
  voidEntryId: string | null
  lineCount: number
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type SupplierInvoiceDetail = SupplierInvoice & { lines: SupplierInvoiceLine[] }

// ---- purchase returns ----

export type PurchaseReturnLine = {
  id: string
  lineNo: number
  orderLineId: string
  itemId: string
  quantity: number
  /** The order price the goods were received at. */
  unitCostMinor: number
}

export type PurchaseReturn = {
  id: string
  number: number
  supplierId: string
  supplierName: string
  orderId: string
  orderNumber: number
  warehouseId: string
  returnDate: string
  reason: string
  lineCount: number
  totalQuantity: number
  valueMinor: number
  /** Dr GRNI, Cr inventory. Null on the invoice basis, where a return is accounted for by the credit note. */
  journalEntryId: string | null
  createdAt: string
  createdBy: string
}

export type PurchaseReturnDetail = PurchaseReturn & { lines: PurchaseReturnLine[] }

// ---- supplier credit notes ----

export const creditNoteStatuses = ['posted', 'void'] as const
export type SupplierCreditNoteStatus = (typeof creditNoteStatuses)[number]

export type SupplierCreditNoteLine = {
  id: string
  lineNo: number
  invoiceLineId: string
  orderLineId: string
  itemId: string
  quantity: number
  unitCostMinor: number
  taxRateBps: number
}

export type SupplierCreditNote = {
  id: string
  number: number
  supplierId: string
  supplierName: string
  /** The number printed on the supplier's own credit note. */
  supplierCreditNoteNumber: string
  invoiceId: string
  invoiceNumber: number
  supplierInvoiceNumber: string
  orderId: string
  status: SupplierCreditNoteStatus
  creditDate: string
  currency: 'KWD'
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
  reason: string
  journalEntryId: string
  voidReason: string | null
  voidedAt: string | null
  voidedBy: string | null
  voidEntryId: string | null
  lineCount: number
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type SupplierCreditNoteDetail = SupplierCreditNote & { lines: SupplierCreditNoteLine[] }

// ---- supplier payments ----

export const paymentStates = ['posted', 'void'] as const
export type SupplierPaymentState = (typeof paymentStates)[number]

export const paymentMethods = ['cash', 'bank_transfer', 'cheque'] as const
export type PaymentMethod = (typeof paymentMethods)[number]

export type PaymentAllocation = {
  id: string
  invoiceId: string
  invoiceNumber: number
  supplierInvoiceNumber: string
  amountMinor: number
}

export type SupplierPayment = {
  id: string
  number: number
  supplierId: string
  supplierName: string
  status: SupplierPaymentState
  paymentDate: string
  amountMinor: number
  currency: 'KWD'
  method: PaymentMethod
  /** The bank or cheque reference. The same one cannot be booked twice for a supplier. */
  reference: string | null
  paidFromAccountId: string
  notes: string | null
  journalEntryId: string
  voidReason: string | null
  voidedAt: string | null
  voidedBy: string | null
  voidEntryId: string | null
  allocationCount: number
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type SupplierPaymentDetail = SupplierPayment & { allocations: PaymentAllocation[] }

// ---- three-way match ----

export const matchStatuses = ['matched', 'within_tolerance', 'blocked'] as const
export type MatchStatus = (typeof matchStatuses)[number]

export const matchIssueCodes = [
  'over_invoice',
  'price_variance_exceeded',
  'tax_variance_exceeded',
  'order_line_not_found',
  'duplicate_invoice_line',
  'invalid_quantity',
  'invalid_price',
] as const
export type MatchIssueCode = (typeof matchIssueCodes)[number]

export type MatchIssue = { code: MatchIssueCode; orderLineId: string | null; message: string }

export type MatchLine = {
  orderLineId: string
  lineNo: number
  /** What can still be billed: received - returned - (invoiced - credited). */
  openQuantity: number
  quantity: number
  poUnitCostMinor: number
  billedUnitCostMinor: number
  poTaxRateBps: number
  billedTaxRateBps: number
  /** quantity x (billed - order price). */
  priceVarianceMinor: number
  status: MatchStatus
}

/** The result of matching an invoice against the order and what was received. It is computed, never stored. */
export type MatchResult = {
  status: MatchStatus
  lines: MatchLine[]
  poNetMinor: number
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
  priceVarianceMinor: number
  /** Billed tax minus the tax at the order's rates on the billed prices. */
  taxVarianceMinor: number
  priceToleranceBps: number
  taxToleranceMinor: number
  issues: MatchIssue[]
}

// ---- reconciliation ----

export type ReconciliationCheck = {
  key: 'inventory' | 'grni' | 'payable'
  /** What the ledger holds for the account, in the direction the account normally carries. */
  actualMinor: number
  /** What the documents say it must be. */
  expectedMinor: number
  differenceMinor: number
  ok: boolean
}

export type ReconciliationReport = {
  basis: AccountingBasis
  currency: 'KWD'
  checks: ReconciliationCheck[]
  ok: boolean
}
