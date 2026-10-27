import { randomUUID } from 'node:crypto'
import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'
import { isUniqueViolation, requirePermission, versionConflict } from '@/lib/auth/require'
import { db, withTransaction, type Queryable } from '@/lib/db'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { nextSequenceValue } from '@/lib/sequences'
import { computeTotals } from '@/modules/finance/client'
import { postSourcedEntryWithin, publishFinanceEvents, type FinanceEvent } from '@/modules/finance'
import { findItemWithin, publishInventoryEvents, receivePurchaseWithin, type InventoryEvent } from '@/modules/inventory'
import { canCancel, canReceive, isEditable, orderNeedsApproval, planReceipt, statusAfterReceipt } from '@/modules/procurement/domain/order'
import { buildReceiptLines } from '@/modules/procurement/domain/posting'
import { valueOfLines } from '@/modules/procurement/domain/settlement'
import type {
  GoodsReceipt,
  GoodsReceiptDetail,
  ProcurementSettings,
  PurchaseOrder,
  PurchaseOrderDetail,
  Supplier,
} from '@/modules/procurement/domain/types'
import { publishProcurementEvents, type ProcurementEvent } from '@/modules/procurement/events'
import * as invoiceRepository from '@/modules/procurement/repositories/invoice-repository'
import * as repository from '@/modules/procurement/repositories/procurement-repository'
import type {
  ApproveOrderInput,
  CancelOrderInput,
  CreateOrderInput,
  CreateReceiptInput,
  CreateSupplierInput,
  ListOrdersQuery,
  ListReceiptsQuery,
  ListSuppliersQuery,
  OrderLineInput,
  SubmitOrderInput,
  UpdateOrderInput,
  UpdateSettingsInput,
  UpdateSupplierInput,
} from '@/modules/procurement/schemas/procurement'

export type SupplierBody = { data: Supplier }
export type OrderBody = { data: PurchaseOrderDetail }
export type ReceiptBody = { data: GoodsReceiptDetail & { order: PurchaseOrderDetail } }
export type SettingsBody = { data: ProcurementSettings }

const CREATE_ORDER_SCOPE = 'procurement.order.create'
const RECEIPT_SCOPE = 'procurement.receipt.create'

export function eventBase(auth: AuthContext) {
  return { version: 1 as const, occurredAt: new Date().toISOString(), tenantId: auth.tenantId }
}

const supplierNotFound = () => new AppError(404, 'supplier_not_found', 'The supplier was not found.')
export const orderNotFound = () => new AppError(404, 'order_not_found', 'The purchase order was not found.')
const receiptNotFound = () => new AppError(404, 'receipt_not_found', 'The goods receipt was not found.')

export type AuditEntity =
  | 'supplier'
  | 'purchase_order'
  | 'goods_receipt'
  | 'procurement_settings'
  | 'purchase_request'
  | 'supplier_invoice'
  | 'procurement_accounting'
  | 'purchase_return'
  | 'supplier_credit_note'
  | 'supplier_payment'

export async function audit(tx: Queryable, auth: AuthContext, entity: AuditEntity, id: string, action: 'create' | 'update', before: unknown, after: unknown) {
  await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity, entityId: id, action, before, after })
}

export function orderRef(order: PurchaseOrder) {
  return { orderId: order.id, number: order.number, supplierId: order.supplierId, totalMinor: order.totalMinor, currency: order.currency }
}

// ---- suppliers ----

export async function createSupplier(auth: AuthContext, input: CreateSupplierInput): Promise<SupplierBody> {
  requirePermission(auth, permissions.procurementSupplierManage)
  const events: ProcurementEvent[] = []
  const supplier = await withTransaction(async (tx) => {
    let created: Supplier
    try {
      created = await repository.insertSupplier(tx, auth.tenantId, auth.userId, input)
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(409, 'supplier_code_exists', `A supplier with code ${input.code} already exists.`)
      throw error
    }
    await audit(tx, auth, 'supplier', created.id, 'create', null, created)
    events.push({ ...eventBase(auth), name: 'procurement.supplier.created', payload: { supplierId: created.id, code: created.code, createdBy: auth.userId } })
    return created
  })
  await publishProcurementEvents(events)
  return { data: supplier }
}

export async function updateSupplier(auth: AuthContext, id: string, input: UpdateSupplierInput): Promise<SupplierBody> {
  requirePermission(auth, permissions.procurementSupplierManage)
  const events: ProcurementEvent[] = []
  const supplier = await withTransaction(async (tx) => {
    const before = await repository.findSupplier(tx, auth.tenantId, id, { lock: true })
    if (!before) throw supplierNotFound()
    if (before.version !== input.version) throw versionConflict('supplier')
    if (!(await repository.updateSupplier(tx, auth.tenantId, id, input))) throw versionConflict('supplier')
    const after = await repository.findSupplier(tx, auth.tenantId, id)
    if (!after) throw supplierNotFound()
    await audit(tx, auth, 'supplier', id, 'update', before, after)
    events.push({
      ...eventBase(auth),
      name: 'procurement.supplier.updated',
      payload: { supplierId: id, code: after.code, status: after.status, updatedBy: auth.userId },
    })
    return after
  })
  await publishProcurementEvents(events)
  return { data: supplier }
}

export async function listSuppliers(auth: AuthContext, query: ListSuppliersQuery): Promise<Page<Supplier>> {
  requirePermission(auth, permissions.procurementSupplierRead)
  return repository.listSuppliers(db, auth.tenantId, query)
}

export async function getSupplier(auth: AuthContext, id: string): Promise<SupplierBody> {
  requirePermission(auth, permissions.procurementSupplierRead)
  const supplier = await repository.findSupplier(db, auth.tenantId, id)
  if (!supplier) throw supplierNotFound()
  return { data: supplier }
}

// ---- settings ----

export async function getSettings(auth: AuthContext): Promise<SettingsBody> {
  requirePermission(auth, permissions.procurementOrderRead)
  return { data: await repository.findSettings(db, auth.tenantId) }
}

export async function updateSettings(auth: AuthContext, input: UpdateSettingsInput): Promise<SettingsBody> {
  requirePermission(auth, permissions.procurementSettingsManage)
  const settings = await withTransaction(async (tx) => {
    const before = await repository.findSettings(tx, auth.tenantId, { lock: true })
    if (before.version !== input.version) throw versionConflict('settings')
    if (before.version === 0) {
      try {
        await repository.insertSettings(tx, auth.tenantId, auth.userId, input.approvalThresholdMinor)
      } catch (error) {
        if (isUniqueViolation(error)) throw versionConflict('settings')
        throw error
      }
    } else if (!(await repository.updateSettings(tx, auth.tenantId, input.version, input.approvalThresholdMinor))) {
      throw versionConflict('settings')
    }
    const after = await repository.findSettings(tx, auth.tenantId)
    await audit(tx, auth, 'procurement_settings', auth.tenantId, before.version === 0 ? 'create' : 'update', before, after)
    return after
  })
  return { data: settings }
}

// ---- purchase orders ----

/** Every line must name an active item. Items are read through the inventory module and checked in id order. */
export async function requireOrderableItems(tx: Queryable, tenantId: string, lines: readonly OrderLineInput[]): Promise<void> {
  for (const itemId of [...new Set(lines.map((line) => line.itemId))].sort()) {
    const item = await findItemWithin(tx, tenantId, itemId, false)
    if (!item) throw new AppError(422, 'item_not_found', 'A line points at an item that does not exist.')
    if (!item.isActive) throw new AppError(422, 'item_inactive', `Item ${item.sku} is inactive and cannot be ordered.`)
  }
}

async function requireActiveSupplier(tx: Queryable, tenantId: string, id: string): Promise<Supplier> {
  const supplier = await repository.findSupplier(tx, tenantId, id)
  if (!supplier) throw new AppError(422, 'supplier_not_found', 'The supplier was not found.')
  if (supplier.status !== 'active') throw new AppError(409, 'supplier_blocked', 'The supplier is blocked and cannot be ordered from.')
  return supplier
}

export async function lockOrder(tx: Queryable, tenantId: string, id: string, version: number): Promise<PurchaseOrder> {
  const current = await repository.findOrder(tx, tenantId, id, { lock: true })
  if (!current) throw orderNotFound()
  if (current.version !== version) throw versionConflict('purchase order')
  return current
}

export async function loadDetail(tx: Queryable, tenantId: string, id: string): Promise<PurchaseOrderDetail> {
  const detail = await repository.findOrderDetail(tx, tenantId, id)
  if (!detail) throw orderNotFound()
  return detail
}

/**
 * Creates a draft purchase order inside the caller's transaction. Used by the create endpoint and by converting an approved
 * purchase request. The caller checks permissions and publishes `events` after its own commit.
 */
export async function createDraftOrderWithin(tx: Queryable, auth: AuthContext, input: CreateOrderInput, events: ProcurementEvent[]): Promise<PurchaseOrderDetail> {
  const supplier = await requireActiveSupplier(tx, auth.tenantId, input.supplierId)
  await requireOrderableItems(tx, auth.tenantId, input.lines)
  const totals = computeTotals(input.lines.map((line) => ({ quantity: line.quantity, unitPriceMinor: line.unitCostMinor, taxRateBps: line.taxRateBps })))
  const number = await nextSequenceValue(tx, auth.tenantId, 'purchase_order')
  const id = await repository.insertOrder(tx, auth.tenantId, auth.userId, number, {
    supplierId: supplier.id,
    supplierName: supplier.name,
    orderDate: input.orderDate,
    expectedDate: input.expectedDate,
    notes: input.notes,
    ...totals,
  })
  await repository.insertOrderLines(tx, auth.tenantId, auth.userId, id, input.lines)
  const detail = await loadDetail(tx, auth.tenantId, id)
  await audit(tx, auth, 'purchase_order', id, 'create', null, detail)
  events.push({ ...eventBase(auth), name: 'procurement.order.created', payload: { ...orderRef(detail), createdBy: auth.userId } })
  return detail
}

export async function createOrder(auth: AuthContext, idempotencyKey: string, input: CreateOrderInput): Promise<IdempotentResult<OrderBody>> {
  requirePermission(auth, permissions.procurementOrderCreate)
  const events: ProcurementEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<OrderBody>(
      tx,
      { tenantId: auth.tenantId, scope: CREATE_ORDER_SCOPE, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => ({ status: 201, body: { data: await createDraftOrderWithin(tx, auth, input, events) } })
    )
  )
  if (!outcome.replayed) await publishProcurementEvents(events)
  return outcome
}

export async function updateOrder(auth: AuthContext, id: string, input: UpdateOrderInput): Promise<OrderBody> {
  requirePermission(auth, permissions.procurementOrderUpdate)
  return withTransaction(async (tx) => {
    const current = await lockOrder(tx, auth.tenantId, id, input.version)
    if (!isEditable(current.status)) throw new AppError(409, 'order_not_draft', 'Only a draft purchase order can be edited.')
    const before = await loadDetail(tx, auth.tenantId, id)
    await requireOrderableItems(tx, auth.tenantId, input.lines)
    const totals = computeTotals(input.lines.map((line) => ({ quantity: line.quantity, unitPriceMinor: line.unitCostMinor, taxRateBps: line.taxRateBps })))
    await repository.deleteOrderLines(tx, auth.tenantId, id)
    await repository.insertOrderLines(tx, auth.tenantId, auth.userId, id, input.lines)
    const updated = await repository.updateDraftOrder(tx, auth.tenantId, id, input.version, {
      orderDate: input.orderDate,
      expectedDate: input.expectedDate,
      notes: input.notes,
      ...totals,
    })
    if (!updated) throw versionConflict('purchase order')
    const after = await loadDetail(tx, auth.tenantId, id)
    await audit(tx, auth, 'purchase_order', id, 'update', before, after)
    return { data: after }
  })
}

/** Submitting sends the order for approval only when its total is strictly above the limit. With no limit it is approved at once. */
export async function submitOrder(auth: AuthContext, id: string, input: SubmitOrderInput): Promise<OrderBody> {
  requirePermission(auth, permissions.procurementOrderSubmit)
  const events: ProcurementEvent[] = []
  const detail = await withTransaction(async (tx) => {
    const current = await lockOrder(tx, auth.tenantId, id, input.version)
    if (current.status !== 'draft') throw new AppError(409, 'order_not_draft', 'Only a draft purchase order can be submitted.')
    await requireActiveSupplier(tx, auth.tenantId, current.supplierId)
    const before = await loadDetail(tx, auth.tenantId, id)
    await requireOrderableItems(tx, auth.tenantId, before.lines)
    const settings = await repository.findSettings(tx, auth.tenantId)
    const approvalRequired = orderNeedsApproval(current.totalMinor, settings.approvalThresholdMinor)
    const status = approvalRequired ? 'pending_approval' : 'approved'
    if (!(await repository.submitOrder(tx, auth.tenantId, id, auth.userId, input.version, { status, approvalRequired }))) {
      throw versionConflict('purchase order')
    }
    const after = await loadDetail(tx, auth.tenantId, id)
    await audit(tx, auth, 'purchase_order', id, 'update', before, after)
    events.push({
      ...eventBase(auth),
      name: 'procurement.order.submitted',
      payload: { ...orderRef(after), requiresApproval: approvalRequired, submittedBy: auth.userId },
    })
    if (!approvalRequired) events.push({ ...eventBase(auth), name: 'procurement.order.approved', payload: { ...orderRef(after), approvedBy: null } })
    return after
  })
  await publishProcurementEvents(events)
  return { data: detail }
}

export async function approveOrder(auth: AuthContext, id: string, input: ApproveOrderInput): Promise<OrderBody> {
  requirePermission(auth, permissions.procurementOrderApprove)
  const events: ProcurementEvent[] = []
  const detail = await withTransaction(async (tx) => {
    const current = await lockOrder(tx, auth.tenantId, id, input.version)
    if (current.status !== 'pending_approval') throw new AppError(409, 'order_not_pending', 'The purchase order is not waiting for approval.')
    const before = await loadDetail(tx, auth.tenantId, id)
    if (!(await repository.approveOrder(tx, auth.tenantId, id, auth.userId, input.version))) throw versionConflict('purchase order')
    const after = await loadDetail(tx, auth.tenantId, id)
    await audit(tx, auth, 'purchase_order', id, 'update', before, after)
    events.push({ ...eventBase(auth), name: 'procurement.order.approved', payload: { ...orderRef(after), approvedBy: auth.userId } })
    return after
  })
  await publishProcurementEvents(events)
  return { data: detail }
}

export async function cancelOrder(auth: AuthContext, id: string, input: CancelOrderInput): Promise<OrderBody> {
  requirePermission(auth, permissions.procurementOrderCancel)
  const events: ProcurementEvent[] = []
  const detail = await withTransaction(async (tx) => {
    const current = await lockOrder(tx, auth.tenantId, id, input.version)
    if (!canCancel(current.status)) throw new AppError(409, 'order_not_cancellable', 'This purchase order can no longer be cancelled.')
    const before = await loadDetail(tx, auth.tenantId, id)
    if (!(await repository.cancelOrder(tx, auth.tenantId, id, auth.userId, input.version, input.reason))) throw versionConflict('purchase order')
    const after = await loadDetail(tx, auth.tenantId, id)
    await audit(tx, auth, 'purchase_order', id, 'update', before, after)
    events.push({ ...eventBase(auth), name: 'procurement.order.cancelled', payload: { ...orderRef(after), cancelledBy: auth.userId, reason: input.reason } })
    return after
  })
  await publishProcurementEvents(events)
  return { data: detail }
}

export async function listOrders(auth: AuthContext, query: ListOrdersQuery): Promise<Page<PurchaseOrder>> {
  requirePermission(auth, permissions.procurementOrderRead)
  return repository.listOrders(db, auth.tenantId, query)
}

export async function getOrder(auth: AuthContext, id: string): Promise<OrderBody> {
  requirePermission(auth, permissions.procurementOrderRead)
  const detail = await repository.findOrderDetail(db, auth.tenantId, id)
  if (!detail) throw orderNotFound()
  return { data: detail }
}

// ---- goods receipts ----

/**
 * Receives goods against an approved order. One transaction: it locks the order, checks every line against what is still
 * open, writes the append-only receipt (the database raises the received quantities and moves the order along), and books
 * an IN movement per line through the inventory module. Inventory events go out after the commit.
 */
export async function createReceipt(
  auth: AuthContext,
  orderId: string,
  idempotencyKey: string,
  input: CreateReceiptInput
): Promise<IdempotentResult<ReceiptBody>> {
  requirePermission(auth, permissions.procurementReceiptCreate)
  const events: ProcurementEvent[] = []
  const inventoryEvents: InventoryEvent[] = []
  const financeEvents: FinanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<ReceiptBody>(
      tx,
      { tenantId: auth.tenantId, scope: `${RECEIPT_SCOPE}:${orderId}`, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        const current = await lockOrder(tx, auth.tenantId, orderId, input.version)
        if (!canReceive(current.status)) throw new AppError(409, 'order_not_receivable', 'Goods can only be received against an approved purchase order.')
        const before = await loadDetail(tx, auth.tenantId, orderId)
        const planned = planReceipt(before.lines, input.lines)
        const number = await nextSequenceValue(tx, auth.tenantId, 'goods_receipt')
        const receiptId = randomUUID()
        // Stock is valued at the order price. On the receipt basis the value is booked now (Dr inventory, Cr GRNI); on the
        // invoice basis nothing is booked until the supplier invoice.
        const valueMinor = valueOfLines(
          planned.map((line) => ({ quantity: line.quantity, unitCostMinor: before.lines.find((orderLine) => orderLine.id === line.orderLineId)?.unitCostMinor ?? 0 }))
        )
        const accounting = await invoiceRepository.findAccounting(tx, auth.tenantId)
        let journalEntryId: string | null = null
        if (accounting.accountingBasis === 'receipt_basis' && valueMinor > 0) {
          const entry = await postSourcedEntryWithin(
            tx,
            auth,
            {
              entryDate: input.receiptDate,
              memo: `Goods receipt ${number} - purchase order ${current.number}`,
              sourceType: 'goods_receipt',
              sourceId: receiptId,
              lines: buildReceiptLines(valueMinor, accounting, `Goods receipt ${number}`),
            },
            financeEvents
          )
          journalEntryId = entry.id
        }
        await repository.insertReceipt(tx, auth.tenantId, auth.userId, {
          id: receiptId,
          number,
          orderId,
          warehouseId: input.warehouseId,
          receiptDate: input.receiptDate,
          notes: input.notes,
          valueMinor,
          journalEntryId,
        })
        await repository.insertReceiptLines(tx, auth.tenantId, auth.userId, receiptId, orderId, planned)
        await receivePurchaseWithin(
          tx,
          auth,
          {
            warehouseId: input.warehouseId,
            receiptId,
            lines: planned.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
            note: `Receipt ${number} for purchase order ${current.number}`,
          },
          inventoryEvents
        )
        await repository.bumpOrderVersion(tx, auth.tenantId, orderId)
        const after = await loadDetail(tx, auth.tenantId, orderId)
        const receipt = await repository.findReceipt(tx, auth.tenantId, receiptId)
        if (!receipt) throw receiptNotFound()
        await audit(tx, auth, 'goods_receipt', receiptId, 'create', null, receipt)
        await audit(tx, auth, 'purchase_order', orderId, 'update', before, after)
        events.push({
          ...eventBase(auth),
          name: 'procurement.receipt.posted',
          payload: {
            receiptId,
            number,
            orderId,
            orderNumber: current.number,
            warehouseId: input.warehouseId,
            lineCount: receipt.lineCount,
            totalQuantity: receipt.totalQuantity,
            orderStatus: statusAfterReceipt(after.lines),
            valueMinor,
            journalEntryId,
            receivedBy: auth.userId,
          },
        })
        // The deferred checks (value, stock moved, ledger entry) run at commit. Running them now keeps a failure inside this transaction's own handling.
        await tx.query('set constraints all immediate')
        return { status: 201, body: { data: { ...receipt, order: after } } }
      }
    )
  )
  if (!outcome.replayed) {
    await publishProcurementEvents(events)
    await publishInventoryEvents(inventoryEvents)
    await publishFinanceEvents(financeEvents)
  }
  return outcome
}

export async function listReceipts(auth: AuthContext, query: ListReceiptsQuery): Promise<Page<GoodsReceipt>> {
  requirePermission(auth, permissions.procurementReceiptRead)
  return repository.listReceipts(db, auth.tenantId, query)
}

export async function getReceipt(auth: AuthContext, id: string): Promise<{ data: GoodsReceiptDetail }> {
  requirePermission(auth, permissions.procurementReceiptRead)
  const receipt = await repository.findReceipt(db, auth.tenantId, id)
  if (!receipt) throw receiptNotFound()
  return { data: receipt }
}
