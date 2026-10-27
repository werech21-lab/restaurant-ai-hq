import type { Page } from '@/lib/api/cursor'
import { keysetClauses, toPage } from '@/lib/api/keyset'
import type { Queryable } from '@/lib/db'
import type {
  GoodsReceipt,
  GoodsReceiptDetail,
  OrderLine,
  OrderStatus,
  ProcurementSettings,
  PurchaseOrder,
  PurchaseOrderDetail,
  ReceiptLine,
  Supplier,
} from '@/modules/procurement/domain/types'
import type {
  CreateSupplierInput,
  ListOrdersQuery,
  ListReceiptsQuery,
  ListSuppliersQuery,
  OrderLineInput,
  UpdateSupplierInput,
} from '@/modules/procurement/schemas/procurement'

type Stamped<T> = Omit<T, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date }

function stamp<T extends { createdAt: Date; updatedAt: Date }>(row: T): Omit<T, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string } {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }
}

function iso(value: Date | null): string | null {
  return value === null ? null : value.toISOString()
}

// ---- suppliers ----

const SUPPLIER_COLUMNS = `s.id, s.code, s.name, s.status, s.payment_terms_days as "paymentTermsDays", s.notes, s.version,
  s.created_at as "createdAt", s.updated_at as "updatedAt", s.created_by as "createdBy"`

export async function insertSupplier(tx: Queryable, tenantId: string, userId: string, input: CreateSupplierInput): Promise<Supplier> {
  const inserted = await tx.query<{ id: string }>(
    'insert into suppliers (tenant_id, code, name, payment_terms_days, notes, created_by) values ($1, $2, $3, $4, $5, $6) returning id',
    [tenantId, input.code, input.name, input.paymentTermsDays, input.notes, userId]
  )
  const created = await findSupplier(tx, tenantId, inserted.rows[0].id)
  if (!created) throw new Error('Inserted supplier could not be read back')
  return created
}

export async function findSupplier(tx: Queryable, tenantId: string, id: string, options: { lock: boolean } = { lock: false }): Promise<Supplier | null> {
  if (options.lock) await tx.query('select 1 from suppliers where tenant_id = $1 and id = $2 for update', [tenantId, id])
  const result = await tx.query<Stamped<Supplier>>(`select ${SUPPLIER_COLUMNS} from suppliers s where s.tenant_id = $1 and s.id = $2`, [tenantId, id])
  return result.rows[0] ? (stamp(result.rows[0]) as Supplier) : null
}

export async function updateSupplier(tx: Queryable, tenantId: string, id: string, input: UpdateSupplierInput): Promise<boolean> {
  const result = await tx.query(
    `update suppliers set name = $4, status = $5, payment_terms_days = $6, notes = $7, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3`,
    [tenantId, id, input.version, input.name, input.status, input.paymentTermsDays, input.notes]
  )
  return (result.rowCount ?? 0) > 0
}

export async function listSuppliers(tx: Queryable, tenantId: string, query: ListSuppliersQuery): Promise<Page<Supplier>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status !== 'all') {
    params.push(query.status)
    filters += ` and s.status = $${params.length}`
  }
  const keyset = keysetClauses({ sortKey: 'name', column: { sql: 'name', cast: 'text' }, direction: 'asc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<Stamped<Supplier> & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (select ${SUPPLIER_COLUMNS} from suppliers s where s.tenant_id = $1${filters}) x
     where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'name', 'asc')
  return { data: page.data.map((row) => stamp(row) as Supplier), nextCursor: page.nextCursor }
}

// ---- settings ----

export async function findSettings(tx: Queryable, tenantId: string, options: { lock: boolean } = { lock: false }): Promise<ProcurementSettings> {
  const result = await tx.query<{ threshold: string | null; version: number }>(
    `select approval_threshold_minor::text as threshold, version from procurement_settings where tenant_id = $1${options.lock ? ' for update' : ''}`,
    [tenantId]
  )
  const row = result.rows[0]
  return row ? { approvalThresholdMinor: row.threshold === null ? null : Number(row.threshold), version: row.version } : { approvalThresholdMinor: null, version: 0 }
}

export async function insertSettings(tx: Queryable, tenantId: string, userId: string, thresholdMinor: number | null): Promise<void> {
  await tx.query('insert into procurement_settings (tenant_id, approval_threshold_minor, created_by) values ($1, $2, $3)', [tenantId, thresholdMinor, userId])
}

export async function updateSettings(tx: Queryable, tenantId: string, version: number, thresholdMinor: number | null): Promise<boolean> {
  const result = await tx.query(
    'update procurement_settings set approval_threshold_minor = $3, version = version + 1 where tenant_id = $1 and version = $2',
    [tenantId, version, thresholdMinor]
  )
  return (result.rowCount ?? 0) > 0
}

// ---- purchase orders ----

const ORDER_COLUMNS = `o.id, o.number, o.supplier_id as "supplierId", o.supplier_name as "supplierName", o.status,
  to_char(o.order_date, 'YYYY-MM-DD') as "orderDate", to_char(o.expected_date, 'YYYY-MM-DD') as "expectedDate", o.currency,
  o.subtotal_minor::text as "subtotal", o.tax_minor::text as "tax", o.total_minor::text as "total", o.notes,
  o.approval_required as "approvalRequired", o.submitted_at as "submittedAt", o.submitted_by as "submittedBy",
  o.approved_at as "approvedAt", o.approved_by as "approvedBy", o.cancelled_at as "cancelledAt", o.cancelled_by as "cancelledBy",
  o.cancelled_reason as "cancelledReason",
  (select count(*)::int from purchase_order_lines l where l.tenant_id = o.tenant_id and l.order_id = o.id) as "lineCount",
  o.version, o.created_at as "createdAt", o.updated_at as "updatedAt", o.created_by as "createdBy"`

type OrderRow = Stamped<
  Omit<PurchaseOrder, 'subtotalMinor' | 'taxMinor' | 'totalMinor' | 'submittedAt' | 'approvedAt' | 'cancelledAt'> & { subtotal: string; tax: string; total: string }
> & { submittedAt: Date | null; approvedAt: Date | null; cancelledAt: Date | null }

function orderFromRow(row: OrderRow): PurchaseOrder {
  const { subtotal, tax, total, ...rest } = row
  return {
    ...stamp(rest),
    subtotalMinor: Number(subtotal),
    taxMinor: Number(tax),
    totalMinor: Number(total),
    submittedAt: iso(row.submittedAt),
    approvedAt: iso(row.approvedAt),
    cancelledAt: iso(row.cancelledAt),
  } as PurchaseOrder
}

export type OrderHeader = {
  supplierId: string
  supplierName: string
  orderDate: string
  expectedDate: string | null
  notes: string | null
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
}

export async function insertOrder(tx: Queryable, tenantId: string, userId: string, number: number, header: OrderHeader): Promise<string> {
  const inserted = await tx.query<{ id: string }>(
    `insert into purchase_orders (tenant_id, number, supplier_id, supplier_name, order_date, expected_date, notes,
                                  subtotal_minor, tax_minor, total_minor, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
    [tenantId, number, header.supplierId, header.supplierName, header.orderDate, header.expectedDate, header.notes, header.subtotalMinor, header.taxMinor, header.totalMinor, userId]
  )
  return inserted.rows[0].id
}

export async function insertOrderLines(tx: Queryable, tenantId: string, userId: string, orderId: string, lines: readonly OrderLineInput[]): Promise<void> {
  for (const [index, line] of lines.entries()) {
    await tx.query(
      `insert into purchase_order_lines (tenant_id, order_id, line_no, item_id, description, quantity, unit_cost_minor, tax_rate_bps, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [tenantId, orderId, index + 1, line.itemId, line.description, line.quantity, line.unitCostMinor, line.taxRateBps, userId]
    )
  }
}

export async function deleteOrderLines(tx: Queryable, tenantId: string, orderId: string): Promise<void> {
  await tx.query('delete from purchase_order_lines where tenant_id = $1 and order_id = $2', [tenantId, orderId])
}

export async function updateDraftOrder(
  tx: Queryable,
  tenantId: string,
  id: string,
  version: number,
  header: Pick<OrderHeader, 'orderDate' | 'expectedDate' | 'notes' | 'subtotalMinor' | 'taxMinor' | 'totalMinor'>
): Promise<boolean> {
  const result = await tx.query(
    `update purchase_orders set order_date = $4, expected_date = $5, notes = $6, subtotal_minor = $7, tax_minor = $8, total_minor = $9, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'draft'`,
    [tenantId, id, version, header.orderDate, header.expectedDate, header.notes, header.subtotalMinor, header.taxMinor, header.totalMinor]
  )
  return (result.rowCount ?? 0) > 0
}

export async function submitOrder(
  tx: Queryable,
  tenantId: string,
  id: string,
  userId: string,
  version: number,
  outcome: { status: OrderStatus; approvalRequired: boolean }
): Promise<boolean> {
  const autoApproved = outcome.status === 'approved'
  const result = await tx.query(
    `update purchase_orders
        set status = $4, approval_required = $5, submitted_at = now(), submitted_by = $6,
            approved_at = case when $7 then now() else null end, version = version + 1
      where tenant_id = $1 and id = $2 and version = $3 and status = 'draft'`,
    [tenantId, id, version, outcome.status, outcome.approvalRequired, userId, autoApproved]
  )
  return (result.rowCount ?? 0) > 0
}

export async function approveOrder(tx: Queryable, tenantId: string, id: string, userId: string, version: number): Promise<boolean> {
  const result = await tx.query(
    `update purchase_orders set status = 'approved', approved_at = now(), approved_by = $4, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'pending_approval'`,
    [tenantId, id, version, userId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function cancelOrder(tx: Queryable, tenantId: string, id: string, userId: string, version: number, reason: string): Promise<boolean> {
  const result = await tx.query(
    `update purchase_orders set status = 'cancelled', cancelled_at = now(), cancelled_by = $4, cancelled_reason = $5, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status in ('draft', 'pending_approval', 'approved')`,
    [tenantId, id, version, userId, reason]
  )
  return (result.rowCount ?? 0) > 0
}

export async function bumpOrderVersion(tx: Queryable, tenantId: string, id: string): Promise<void> {
  await tx.query('update purchase_orders set version = version + 1 where tenant_id = $1 and id = $2', [tenantId, id])
}

export async function findOrder(tx: Queryable, tenantId: string, id: string, options: { lock: boolean } = { lock: false }): Promise<PurchaseOrder | null> {
  if (options.lock) await tx.query('select 1 from purchase_orders where tenant_id = $1 and id = $2 for update', [tenantId, id])
  const result = await tx.query<OrderRow>(`select ${ORDER_COLUMNS} from purchase_orders o where o.tenant_id = $1 and o.id = $2`, [tenantId, id])
  return result.rows[0] ? orderFromRow(result.rows[0]) : null
}

export async function findOrderLines(tx: Queryable, tenantId: string, orderId: string): Promise<OrderLine[]> {
  const result = await tx.query<{
    id: string
    lineNo: number
    itemId: string
    description: string
    quantity: number
    unitCost: string
    taxRateBps: number
    receivedQuantity: number
    invoicedQuantity: number
    returnedQuantity: number
    creditedQuantity: number
  }>(
    `select l.id, l.line_no as "lineNo", l.item_id as "itemId", l.description, l.quantity, l.unit_cost_minor::text as "unitCost",
            l.tax_rate_bps as "taxRateBps", l.received_quantity as "receivedQuantity", l.returned_quantity as "returnedQuantity",
            (select coalesce(sum(il.quantity), 0)::int
               from supplier_invoice_lines il
               join supplier_invoices si on si.tenant_id = il.tenant_id and si.id = il.invoice_id
              where il.tenant_id = l.tenant_id and il.order_line_id = l.id and si.status <> 'void') as "invoicedQuantity",
            (select coalesce(sum(cl.quantity), 0)::int
               from supplier_credit_note_lines cl
               join supplier_credit_notes c on c.tenant_id = cl.tenant_id and c.id = cl.credit_note_id
              where cl.tenant_id = l.tenant_id and cl.order_line_id = l.id and c.status <> 'void') as "creditedQuantity"
     from purchase_order_lines l where l.tenant_id = $1 and l.order_id = $2 order by l.line_no`,
    [tenantId, orderId]
  )
  return result.rows.map(({ unitCost, ...row }) => ({ ...row, unitCostMinor: Number(unitCost) }))
}

export async function findOrderDetail(tx: Queryable, tenantId: string, id: string): Promise<PurchaseOrderDetail | null> {
  const order = await findOrder(tx, tenantId, id)
  if (!order) return null
  return { ...order, lines: await findOrderLines(tx, tenantId, id) }
}

export async function listOrders(tx: Queryable, tenantId: string, query: ListOrdersQuery): Promise<Page<PurchaseOrder>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status !== 'all') {
    params.push(query.status)
    filters += ` and o.status = $${params.length}`
  }
  if (query.supplierId) {
    params.push(query.supplierId)
    filters += ` and o.supplier_id = $${params.length}`
  }
  const keyset = keysetClauses({ sortKey: 'number', column: { sql: 'number', cast: 'bigint' }, direction: 'desc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<OrderRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (select ${ORDER_COLUMNS} from purchase_orders o where o.tenant_id = $1${filters}) x
     where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'number', 'desc')
  return { data: page.data.map((row) => orderFromRow(row as OrderRow)), nextCursor: page.nextCursor }
}

// ---- goods receipts ----

const RECEIPT_COLUMNS = `r.id, r.number, r.order_id as "orderId", o.number as "orderNumber", r.warehouse_id as "warehouseId",
  to_char(r.receipt_date, 'YYYY-MM-DD') as "receiptDate", r.notes,
  (select count(*)::int from goods_receipt_lines l where l.tenant_id = r.tenant_id and l.receipt_id = r.id) as "lineCount",
  (select coalesce(sum(l.quantity), 0)::int from goods_receipt_lines l where l.tenant_id = r.tenant_id and l.receipt_id = r.id) as "totalQuantity",
  r.value_minor::text as "value", r.journal_entry_id as "journalEntryId",
  r.created_at as "createdAt", r.created_by as "createdBy"`

const RECEIPT_FROM = 'goods_receipts r join purchase_orders o on o.tenant_id = r.tenant_id and o.id = r.order_id'

type ReceiptRow = Omit<GoodsReceipt, 'createdAt' | 'valueMinor'> & { createdAt: Date; value: string }

function receiptFromRow(row: ReceiptRow): GoodsReceipt {
  const { value, ...rest } = row
  return { ...rest, valueMinor: Number(value), createdAt: row.createdAt.toISOString() }
}

export async function insertReceipt(
  tx: Queryable,
  tenantId: string,
  userId: string,
  receipt: {
    id: string
    number: number
    orderId: string
    warehouseId: string
    receiptDate: string
    notes: string | null
    valueMinor: number
    journalEntryId: string | null
  }
): Promise<string> {
  const inserted = await tx.query<{ id: string }>(
    `insert into goods_receipts (id, tenant_id, number, order_id, warehouse_id, receipt_date, notes, value_minor, journal_entry_id, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
    [receipt.id, tenantId, receipt.number, receipt.orderId, receipt.warehouseId, receipt.receiptDate, receipt.notes, receipt.valueMinor, receipt.journalEntryId, userId]
  )
  return inserted.rows[0].id
}

export async function insertReceiptLines(
  tx: Queryable,
  tenantId: string,
  userId: string,
  receiptId: string,
  orderId: string,
  lines: ReadonlyArray<{ orderLineId: string; itemId: string; quantity: number }>
): Promise<void> {
  for (const [index, line] of lines.entries()) {
    await tx.query(
      `insert into goods_receipt_lines (tenant_id, receipt_id, order_id, order_line_id, item_id, line_no, quantity, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId, receiptId, orderId, line.orderLineId, line.itemId, index + 1, line.quantity, userId]
    )
  }
}

export async function findReceipt(tx: Queryable, tenantId: string, id: string): Promise<GoodsReceiptDetail | null> {
  const result = await tx.query<ReceiptRow>(`select ${RECEIPT_COLUMNS} from ${RECEIPT_FROM} where r.tenant_id = $1 and r.id = $2`, [tenantId, id])
  const row = result.rows[0]
  if (!row) return null
  const lines = await tx.query<ReceiptLine>(
    `select id, line_no as "lineNo", order_line_id as "orderLineId", item_id as "itemId", quantity
     from goods_receipt_lines where tenant_id = $1 and receipt_id = $2 order by line_no`,
    [tenantId, id]
  )
  return { ...receiptFromRow(row), lines: lines.rows }
}

export async function listReceipts(tx: Queryable, tenantId: string, query: ListReceiptsQuery): Promise<Page<GoodsReceipt>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.orderId) {
    params.push(query.orderId)
    filters += ` and r.order_id = $${params.length}`
  }
  const keyset = keysetClauses({ sortKey: 'number', column: { sql: 'number', cast: 'bigint' }, direction: 'desc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<ReceiptRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (select ${RECEIPT_COLUMNS} from ${RECEIPT_FROM} where r.tenant_id = $1${filters}) x
     where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'number', 'desc')
  return { data: page.data.map((row) => receiptFromRow(row as ReceiptRow)), nextCursor: page.nextCursor }
}