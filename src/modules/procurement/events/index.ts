import { emit } from '@/lib/events/bus'

type EventBase<N extends string, P> = {
  name: N
  version: 1
  occurredAt: string
  tenantId: string
  payload: P
}

type OrderRef = { orderId: string; number: number; supplierId: string; totalMinor: number; currency: 'KWD' }

export type SupplierCreatedEvent = EventBase<'procurement.supplier.created', { supplierId: string; code: string; createdBy: string }>
export type SupplierUpdatedEvent = EventBase<'procurement.supplier.updated', { supplierId: string; code: string; status: string; updatedBy: string }>
export type OrderCreatedEvent = EventBase<'procurement.order.created', OrderRef & { createdBy: string }>
export type OrderSubmittedEvent = EventBase<'procurement.order.submitted', OrderRef & { requiresApproval: boolean; submittedBy: string }>
/** `approvedBy` is null when the order needed no approval and was approved on submission. */
export type OrderApprovedEvent = EventBase<'procurement.order.approved', OrderRef & { approvedBy: string | null }>
export type OrderCancelledEvent = EventBase<'procurement.order.cancelled', OrderRef & { cancelledBy: string; reason: string }>
export type ReceiptPostedEvent = EventBase<
  'procurement.receipt.posted',
  {
    receiptId: string
    number: number
    orderId: string
    orderNumber: number
    warehouseId: string
    lineCount: number
    totalQuantity: number
    orderStatus: 'partially_received' | 'received'
    /** Quantity x order price. */
    valueMinor: number
    /** The entry that booked the receipt (receipt basis), or null. */
    journalEntryId: string | null
    receivedBy: string
  }
>

type RequestRef = { requestId: string; number: number }

export type RequestCreatedEvent = EventBase<'procurement.request.created', RequestRef & { lineCount: number; requestedBy: string }>
export type RequestSubmittedEvent = EventBase<'procurement.request.submitted', RequestRef & { submittedBy: string }>
export type RequestApprovedEvent = EventBase<'procurement.request.approved', RequestRef & { approvedBy: string }>
export type RequestRejectedEvent = EventBase<'procurement.request.rejected', RequestRef & { rejectedBy: string; note: string }>
export type RequestCancelledEvent = EventBase<'procurement.request.cancelled', RequestRef & { cancelledBy: string; reason: string }>
export type RequestConvertedEvent = EventBase<
  'procurement.request.converted',
  RequestRef & { orderId: string; orderNumber: number; convertedBy: string }
>

export type SupplierInvoicePostedEvent = EventBase<
  'procurement.invoice.posted',
  {
    invoiceId: string
    number: number
    supplierInvoiceNumber: string
    supplierId: string
    orderId: string
    orderNumber: number
    totalMinor: number
    currency: 'KWD'
    journalEntryId: string
    /** Billed net minus the net at the order's prices. */
    priceVarianceMinor: number
    taxVarianceMinor: number
    postedBy: string
  }
>
export type SupplierInvoiceVoidedEvent = EventBase<
  'procurement.invoice.voided',
  {
    invoiceId: string
    number: number
    supplierId: string
    orderId: string
    totalMinor: number
    currency: 'KWD'
    reversalEntryId: string
    reason: string
    voidedBy: string
  }
>

export type PurchaseReturnPostedEvent = EventBase<
  'procurement.return.posted',
  {
    returnId: string
    number: number
    orderId: string
    orderNumber: number
    supplierId: string
    warehouseId: string
    lineCount: number
    totalQuantity: number
    valueMinor: number
    journalEntryId: string | null
    returnedBy: string
  }
>

export type SupplierCreditNotePostedEvent = EventBase<
  'procurement.creditnote.posted',
  {
    creditNoteId: string
    number: number
    supplierCreditNoteNumber: string
    supplierId: string
    invoiceId: string
    totalMinor: number
    currency: 'KWD'
    journalEntryId: string
    postedBy: string
  }
>
export type SupplierCreditNoteVoidedEvent = EventBase<
  'procurement.creditnote.voided',
  {
    creditNoteId: string
    number: number
    supplierId: string
    invoiceId: string
    totalMinor: number
    currency: 'KWD'
    reversalEntryId: string
    reason: string
    voidedBy: string
  }
>

export type SupplierPaymentPostedEvent = EventBase<
  'procurement.payment.posted',
  {
    paymentId: string
    number: number
    supplierId: string
    amountMinor: number
    currency: 'KWD'
    method: string
    invoiceIds: string[]
    journalEntryId: string
    postedBy: string
  }
>
export type SupplierPaymentVoidedEvent = EventBase<
  'procurement.payment.voided',
  {
    paymentId: string
    number: number
    supplierId: string
    amountMinor: number
    currency: 'KWD'
    invoiceIds: string[]
    reversalEntryId: string
    reason: string
    voidedBy: string
  }
>

export type ProcurementEvent =
  | PurchaseReturnPostedEvent
  | SupplierCreditNotePostedEvent
  | SupplierCreditNoteVoidedEvent
  | SupplierPaymentPostedEvent
  | SupplierPaymentVoidedEvent
  | RequestCreatedEvent
  | RequestSubmittedEvent
  | RequestApprovedEvent
  | RequestRejectedEvent
  | RequestCancelledEvent
  | RequestConvertedEvent
  | SupplierInvoicePostedEvent
  | SupplierInvoiceVoidedEvent
  | SupplierCreatedEvent
  | SupplierUpdatedEvent
  | OrderCreatedEvent
  | OrderSubmittedEvent
  | OrderApprovedEvent
  | OrderCancelledEvent
  | ReceiptPostedEvent

/** Call only after the transaction that wrote the data has committed. Handler failures never reach the caller. */
export async function publishProcurementEvents(events: readonly ProcurementEvent[]): Promise<void> {
  for (const event of events) {
    await emit(event)
  }
}