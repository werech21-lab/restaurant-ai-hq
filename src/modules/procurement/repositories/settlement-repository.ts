import type { Page } from '@/lib/api/cursor'
import { keysetClauses, toPage } from '@/lib/api/keyset'
import type { Queryable } from '@/lib/db'
import type { PlannedCreditLine, PlannedReturnLine } from '@/modules/procurement/domain/settlement'
import type { ReconciliationFigures } from '@/modules/procurement/domain/reconcile'
import type {
  PaymentAllocation,
  PaymentMethod,
  PurchaseReturn,
  PurchaseReturnDetail,
  PurchaseReturnLine,
  SupplierCreditNote,
  SupplierCreditNoteDetail,
  SupplierCreditNoteLine,
  SupplierPayment,
  SupplierPaymentDetail,
} from '@/modules/procurement/domain/types'
import type { ListCreditNotesQuery, ListPaymentsQuery, ListReturnsQuery } from '@/modules/procurement/schemas/settlement'

const iso = (value: Date | null): string | null => (value === null ? null : value.toISOString())

// ---- purchase returns ----

const RETURN_COLUMNS = `r.id, r.number, r.supplier_id as "supplierId", s.name as "supplierName", r.order_id as "orderId", o.number as "orderNumber",
  r.warehouse_id as "warehouseId", to_char(r.return_date, 'YYYY-MM-DD') as "returnDate", r.reason,
  (select count(*)::int from purchase_return_lines l where l.tenant_id = r.tenant_id and l.return_id = r.id) as "lineCount",
  (select coalesce(sum(l.quantity), 0)::int from purchase_return_lines l where l.tenant_id = r.tenant_id and l.return_id = r.id) as "totalQuantity",
  r.value_minor::text as value, r.journal_entry_id as "journalEntryId", r.created_at as "createdAt", r.created_by as "createdBy"`

const RETURN_FROM = `purchase_returns r
  join purchase_orders o on o.tenant_id = r.tenant_id and o.id = r.order_id
  join suppliers s on s.tenant_id = r.tenant_id and s.id = r.supplier_id`

type ReturnRow = Omit<PurchaseReturn, 'valueMinor' | 'createdAt'> & { value: string; createdAt: Date }

function returnFromRow(row: ReturnRow): PurchaseReturn {
  const { value, ...rest } = row
  return { ...rest, valueMinor: Number(value), createdAt: row.createdAt.toISOString() }
}

export type NewReturn = {
  id: string
  number: number
  supplierId: string
  orderId: string
  warehouseId: string
  returnDate: string
  reason: string
  valueMinor: number
  journalEntryId: string | null
}

export async function insertReturn(tx: Queryable, tenantId: string, userId: string, entry: NewReturn): Promise<void> {
  await tx.query(
    `insert into purchase_returns (id, tenant_id, number, supplier_id, order_id, warehouse_id, return_date, reason, value_minor, journal_entry_id, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [entry.id, tenantId, entry.number, entry.supplierId, entry.orderId, entry.warehouseId, entry.returnDate, entry.reason, entry.valueMinor, entry.journalEntryId, userId]
  )
}

export async function insertReturnLines(
  tx: Queryable,
  tenantId: string,
  userId: string,
  returnId: string,
  orderId: string,
  lines: readonly PlannedReturnLine[]
): Promise<void> {
  for (const [index, line] of lines.entries()) {
    await tx.query(
      `insert into purchase_return_lines (tenant_id, return_id, order_id, order_line_id, item_id, line_no, quantity, unit_cost_minor, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [tenantId, returnId, orderId, line.orderLineId, line.itemId, index + 1, line.quantity, line.unitCostMinor, userId]
    )
  }
}

export async function findReturn(tx: Queryable, tenantId: string, id: string): Promise<PurchaseReturnDetail | null> {
  const result = await tx.query<ReturnRow>(`select ${RETURN_COLUMNS} from ${RETURN_FROM} where r.tenant_id = $1 and r.id = $2`, [tenantId, id])
  const row = result.rows[0]
  if (!row) return null
  const lines = await tx.query<Omit<PurchaseReturnLine, 'unitCostMinor'> & { unitCost: string }>(
    `select id, line_no as "lineNo", order_line_id as "orderLineId", item_id as "itemId", quantity, unit_cost_minor::text as "unitCost"
     from purchase_return_lines where tenant_id = $1 and return_id = $2 order by line_no`,
    [tenantId, id]
  )
  return { ...returnFromRow(row), lines: lines.rows.map(({ unitCost, ...line }) => ({ ...line, unitCostMinor: Number(unitCost) })) }
}

export async function listReturns(tx: Queryable, tenantId: string, query: ListReturnsQuery): Promise<Page<PurchaseReturn>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.orderId) {
    params.push(query.orderId)
    filters += ` and r.order_id = $${params.length}`
  }
  const keyset = keysetClauses({ sortKey: 'number', column: { sql: 'number', cast: 'bigint' }, direction: 'desc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<ReturnRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (select ${RETURN_COLUMNS} from ${RETURN_FROM} where r.tenant_id = $1${filters}) x
     where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'number', 'desc')
  return { data: page.data.map((row) => returnFromRow(row as ReturnRow)), nextCursor: page.nextCursor }
}

// ---- supplier credit notes ----

const CREDIT_COLUMNS = `c.id, c.number, c.supplier_id as "supplierId", c.supplier_name as "supplierName",
  c.supplier_credit_note_number as "supplierCreditNoteNumber", c.invoice_id as "invoiceId", i.number as "invoiceNumber",
  i.supplier_invoice_number as "supplierInvoiceNumber", c.order_id as "orderId", c.status,
  to_char(c.credit_date, 'YYYY-MM-DD') as "creditDate", c.currency,
  c.subtotal_minor::text as subtotal, c.tax_minor::text as tax, c.total_minor::text as total, c.reason,
  c.journal_entry_id as "journalEntryId", c.void_reason as "voidReason", c.voided_at as "voidedAt", c.voided_by as "voidedBy",
  c.void_entry_id as "voidEntryId",
  (select count(*)::int from supplier_credit_note_lines l where l.tenant_id = c.tenant_id and l.credit_note_id = c.id) as "lineCount",
  c.version, c.created_at as "createdAt", c.updated_at as "updatedAt", c.created_by as "createdBy"`

const CREDIT_FROM = `supplier_credit_notes c join supplier_invoices i on i.tenant_id = c.tenant_id and i.id = c.invoice_id`

type CreditRow = Omit<SupplierCreditNote, 'subtotalMinor' | 'taxMinor' | 'totalMinor' | 'voidedAt' | 'createdAt' | 'updatedAt'> & {
  subtotal: string
  tax: string
  total: string
  voidedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function creditFromRow(row: CreditRow): SupplierCreditNote {
  const { subtotal, tax, total, ...rest } = row
  return {
    ...rest,
    subtotalMinor: Number(subtotal),
    taxMinor: Number(tax),
    totalMinor: Number(total),
    voidedAt: iso(row.voidedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export type NewCreditNote = {
  id: string
  number: number
  supplierId: string
  supplierName: string
  supplierCreditNoteNumber: string
  invoiceId: string
  orderId: string
  creditDate: string
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
  reason: string
  journalEntryId: string
}

export async function insertCreditNote(tx: Queryable, tenantId: string, userId: string, note: NewCreditNote): Promise<void> {
  await tx.query(
    `insert into supplier_credit_notes (id, tenant_id, number, supplier_id, supplier_name, supplier_credit_note_number, invoice_id, order_id,
        credit_date, subtotal_minor, tax_minor, total_minor, reason, journal_entry_id, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      note.id,
      tenantId,
      note.number,
      note.supplierId,
      note.supplierName,
      note.supplierCreditNoteNumber,
      note.invoiceId,
      note.orderId,
      note.creditDate,
      note.subtotalMinor,
      note.taxMinor,
      note.totalMinor,
      note.reason,
      note.journalEntryId,
      userId,
    ]
  )
}

export async function insertCreditNoteLines(
  tx: Queryable,
  tenantId: string,
  userId: string,
  creditNoteId: string,
  invoiceId: string,
  lines: readonly PlannedCreditLine[]
): Promise<void> {
  for (const [index, line] of lines.entries()) {
    await tx.query(
      `insert into supplier_credit_note_lines (tenant_id, credit_note_id, invoice_id, order_id, order_line_id, invoice_line_id, item_id, line_no,
          quantity, unit_cost_minor, tax_rate_bps, created_by)
       values ($1, $2, $3, null, null, $4, null, $5, $6, $7, $8, $9)`,
      [tenantId, creditNoteId, invoiceId, line.invoiceLineId, index + 1, line.quantity, line.unitCostMinor, line.taxRateBps, userId]
    )
  }
}

export async function existsActiveCreditNumber(tx: Queryable, tenantId: string, supplierId: string, number: string): Promise<boolean> {
  const result = await tx.query(
    `select 1 from supplier_credit_notes
     where tenant_id = $1 and supplier_id = $2 and lower(supplier_credit_note_number) = lower($3) and status <> 'void'`,
    [tenantId, supplierId, number]
  )
  return result.rows.length > 0
}

export async function voidCreditNote(
  tx: Queryable,
  tenantId: string,
  id: string,
  userId: string,
  version: number,
  outcome: { reason: string; voidEntryId: string }
): Promise<boolean> {
  const result = await tx.query(
    `update supplier_credit_notes set status = 'void', void_reason = $4, voided_at = now(), voided_by = $5, void_entry_id = $6, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'posted'`,
    [tenantId, id, version, outcome.reason, userId, outcome.voidEntryId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function findCreditNote(tx: Queryable, tenantId: string, id: string, options: { lock: boolean } = { lock: false }): Promise<SupplierCreditNote | null> {
  if (options.lock) await tx.query('select 1 from supplier_credit_notes where tenant_id = $1 and id = $2 for update', [tenantId, id])
  const result = await tx.query<CreditRow>(`select ${CREDIT_COLUMNS} from ${CREDIT_FROM} where c.tenant_id = $1 and c.id = $2`, [tenantId, id])
  return result.rows[0] ? creditFromRow(result.rows[0]) : null
}

export async function findCreditNoteDetail(tx: Queryable, tenantId: string, id: string): Promise<SupplierCreditNoteDetail | null> {
  const note = await findCreditNote(tx, tenantId, id)
  if (!note) return null
  const lines = await tx.query<Omit<SupplierCreditNoteLine, 'unitCostMinor'> & { unitCost: string }>(
    `select id, line_no as "lineNo", invoice_line_id as "invoiceLineId", order_line_id as "orderLineId", item_id as "itemId", quantity,
            unit_cost_minor::text as "unitCost", tax_rate_bps as "taxRateBps"
     from supplier_credit_note_lines where tenant_id = $1 and credit_note_id = $2 order by line_no`,
    [tenantId, id]
  )
  return { ...note, lines: lines.rows.map(({ unitCost, ...line }) => ({ ...line, unitCostMinor: Number(unitCost) })) }
}

export async function listCreditNotes(tx: Queryable, tenantId: string, query: ListCreditNotesQuery): Promise<Page<SupplierCreditNote>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status !== 'all') {
    params.push(query.status)
    filters += ` and c.status = $${params.length}`
  }
  if (query.invoiceId) {
    params.push(query.invoiceId)
    filters += ` and c.invoice_id = $${params.length}`
  }
  if (query.supplierId) {
    params.push(query.supplierId)
    filters += ` and c.supplier_id = $${params.length}`
  }
  const keyset = keysetClauses({ sortKey: 'number', column: { sql: 'number', cast: 'bigint' }, direction: 'desc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<CreditRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (select ${CREDIT_COLUMNS} from ${CREDIT_FROM} where c.tenant_id = $1${filters}) x
     where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'number', 'desc')
  return { data: page.data.map((row) => creditFromRow(row as CreditRow)), nextCursor: page.nextCursor }
}

// ---- supplier payments ----

const PAYMENT_COLUMNS = `p.id, p.number, p.supplier_id as "supplierId", p.supplier_name as "supplierName", p.status,
  to_char(p.payment_date, 'YYYY-MM-DD') as "paymentDate", p.amount_minor::text as amount, p.currency, p.method, p.reference,
  p.paid_from_account_id as "paidFromAccountId", p.notes, p.journal_entry_id as "journalEntryId", p.void_reason as "voidReason",
  p.voided_at as "voidedAt", p.voided_by as "voidedBy", p.void_entry_id as "voidEntryId",
  (select count(*)::int from supplier_payment_allocations a where a.tenant_id = p.tenant_id and a.payment_id = p.id) as "allocationCount",
  p.version, p.created_at as "createdAt", p.updated_at as "updatedAt", p.created_by as "createdBy"`

type PaymentRow = Omit<SupplierPayment, 'amountMinor' | 'voidedAt' | 'createdAt' | 'updatedAt'> & {
  amount: string
  voidedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function paymentFromRow(row: PaymentRow): SupplierPayment {
  const { amount, ...rest } = row
  return { ...rest, amountMinor: Number(amount), voidedAt: iso(row.voidedAt), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }
}

export type NewPayment = {
  id: string
  number: number
  supplierId: string
  supplierName: string
  paymentDate: string
  amountMinor: number
  method: PaymentMethod
  reference: string | null
  paidFromAccountId: string
  notes: string | null
  journalEntryId: string
}

export async function insertPayment(tx: Queryable, tenantId: string, userId: string, payment: NewPayment): Promise<void> {
  await tx.query(
    `insert into supplier_payments (id, tenant_id, number, supplier_id, supplier_name, payment_date, amount_minor, method, reference,
        paid_from_account_id, notes, journal_entry_id, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      payment.id,
      tenantId,
      payment.number,
      payment.supplierId,
      payment.supplierName,
      payment.paymentDate,
      payment.amountMinor,
      payment.method,
      payment.reference,
      payment.paidFromAccountId,
      payment.notes,
      payment.journalEntryId,
      userId,
    ]
  )
}

export async function insertAllocations(
  tx: Queryable,
  tenantId: string,
  userId: string,
  paymentId: string,
  supplierId: string,
  allocations: ReadonlyArray<{ invoiceId: string; amountMinor: number }>
): Promise<void> {
  for (const allocation of allocations) {
    await tx.query(
      `insert into supplier_payment_allocations (tenant_id, payment_id, supplier_id, invoice_id, amount_minor, created_by)
       values ($1, $2, $3, $4, $5, $6)`,
      [tenantId, paymentId, supplierId, allocation.invoiceId, allocation.amountMinor, userId]
    )
  }
}

export async function existsActiveReference(tx: Queryable, tenantId: string, supplierId: string, reference: string): Promise<boolean> {
  const result = await tx.query(
    `select 1 from supplier_payments where tenant_id = $1 and supplier_id = $2 and lower(reference) = lower($3) and status <> 'void'`,
    [tenantId, supplierId, reference]
  )
  return result.rows.length > 0
}

export async function voidPayment(
  tx: Queryable,
  tenantId: string,
  id: string,
  userId: string,
  version: number,
  outcome: { reason: string; voidEntryId: string }
): Promise<boolean> {
  const result = await tx.query(
    `update supplier_payments set status = 'void', void_reason = $4, voided_at = now(), voided_by = $5, void_entry_id = $6, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'posted'`,
    [tenantId, id, version, outcome.reason, userId, outcome.voidEntryId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function findPayment(tx: Queryable, tenantId: string, id: string, options: { lock: boolean } = { lock: false }): Promise<SupplierPayment | null> {
  if (options.lock) await tx.query('select 1 from supplier_payments where tenant_id = $1 and id = $2 for update', [tenantId, id])
  const result = await tx.query<PaymentRow>(`select ${PAYMENT_COLUMNS} from supplier_payments p where p.tenant_id = $1 and p.id = $2`, [tenantId, id])
  return result.rows[0] ? paymentFromRow(result.rows[0]) : null
}

export async function findPaymentDetail(tx: Queryable, tenantId: string, id: string): Promise<SupplierPaymentDetail | null> {
  const payment = await findPayment(tx, tenantId, id)
  if (!payment) return null
  const allocations = await tx.query<Omit<PaymentAllocation, 'amountMinor'> & { amount: string }>(
    `select a.id, a.invoice_id as "invoiceId", i.number as "invoiceNumber", i.supplier_invoice_number as "supplierInvoiceNumber",
            a.amount_minor::text as amount
     from supplier_payment_allocations a
     join supplier_invoices i on i.tenant_id = a.tenant_id and i.id = a.invoice_id
     where a.tenant_id = $1 and a.payment_id = $2 order by i.number`,
    [tenantId, id]
  )
  return { ...payment, allocations: allocations.rows.map(({ amount, ...allocation }) => ({ ...allocation, amountMinor: Number(amount) })) }
}

export async function listPayments(tx: Queryable, tenantId: string, query: ListPaymentsQuery): Promise<Page<SupplierPayment>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status !== 'all') {
    params.push(query.status)
    filters += ` and p.status = $${params.length}`
  }
  if (query.supplierId) {
    params.push(query.supplierId)
    filters += ` and p.supplier_id = $${params.length}`
  }
  const keyset = keysetClauses({ sortKey: 'number', column: { sql: 'number', cast: 'bigint' }, direction: 'desc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<PaymentRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (select ${PAYMENT_COLUMNS} from supplier_payments p where p.tenant_id = $1${filters}) x
     where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'number', 'desc')
  return { data: page.data.map((row) => paymentFromRow(row as PaymentRow)), nextCursor: page.nextCursor }
}

// ---- reconciliation ----

function safe(value: string): number {
  const parsed = BigInt(value)
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER) || parsed < -BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('A reconciliation figure is outside the safe integer range')
  return Number(parsed)
}

/** What the procurement documents say the ledger must hold. Sums are text, converted as BigInt. */
export async function reconciliationFigures(tx: Queryable, tenantId: string): Promise<ReconciliationFigures> {
  const lines = await tx.query<{ held: string; unbilled: string }>(
    `select coalesce(sum(x.cost * (x.received - x.returned)), 0)::text as held,
            coalesce(sum(x.cost * ((x.received - x.returned) - (x.invoiced - x.credited))), 0)::text as unbilled
       from (
         select l.unit_cost_minor::numeric as cost, l.received_quantity as received, l.returned_quantity as returned,
                coalesce((select sum(il.quantity) from supplier_invoice_lines il
                           join supplier_invoices si on si.tenant_id = il.tenant_id and si.id = il.invoice_id
                          where il.tenant_id = l.tenant_id and il.order_line_id = l.id and si.status <> 'void'), 0) as invoiced,
                coalesce((select sum(cl.quantity) from supplier_credit_note_lines cl
                           join supplier_credit_notes c on c.tenant_id = cl.tenant_id and c.id = cl.credit_note_id
                          where cl.tenant_id = l.tenant_id and cl.order_line_id = l.id and c.status <> 'void'), 0) as credited
           from purchase_order_lines l where l.tenant_id = $1
       ) x`,
    [tenantId]
  )
  const money = await tx.query<{ billed: string; open: string }>(
    `select (coalesce((select sum(subtotal_minor) from supplier_invoices where tenant_id = $1 and status = 'posted'), 0)
          - coalesce((select sum(subtotal_minor) from supplier_credit_notes where tenant_id = $1 and status = 'posted'), 0))::text as billed,
            (coalesce((select sum(i.total_minor - supplier_invoice_paid(i.tenant_id, i.id) - supplier_invoice_credited(i.tenant_id, i.id))
                        from supplier_invoices i where i.tenant_id = $1 and i.status = 'posted'), 0))::text as open`,
    [tenantId]
  )
  const row = lines.rows[0]
  const total = money.rows[0]
  return {
    heldValueMinor: safe(row.held),
    unbilledValueMinor: safe(row.unbilled),
    billedNetMinor: safe(String(total.billed)),
    openPayableMinor: safe(String(total.open)),
  }
}
