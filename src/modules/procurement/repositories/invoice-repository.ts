import type { Page } from '@/lib/api/cursor'
import { keysetClauses, toPage } from '@/lib/api/keyset'
import type { Queryable } from '@/lib/db'
import type { PlannedInvoiceLine } from '@/modules/procurement/domain/match'
import { derivePaymentStatus, invoiceBalanceMinor } from '@/modules/procurement/domain/settlement'
import type {
  AccountingBasis,
  ProcurementAccounting,
  SupplierInvoice,
  SupplierInvoiceDetail,
  SupplierInvoiceLine,
} from '@/modules/procurement/domain/types'
import type { ListSupplierInvoicesQuery } from '@/modules/procurement/schemas/invoice'

type InvoiceRow = Omit<
  SupplierInvoice,
  | 'subtotalMinor'
  | 'taxMinor'
  | 'totalMinor'
  | 'priceVarianceMinor'
  | 'taxVarianceMinor'
  | 'paidMinor'
  | 'creditedMinor'
  | 'balanceMinor'
  | 'paymentStatus'
  | 'voidedAt'
  | 'createdAt'
  | 'updatedAt'
> & {
  subtotal: string
  tax: string
  total: string
  priceVariance: string
  taxVariance: string
  paid: string
  credited: string
  voidedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function invoiceFromRow(row: InvoiceRow): SupplierInvoice {
  const { subtotal, tax, total, priceVariance, taxVariance, paid, credited, ...rest } = row
  const totalMinor = Number(total)
  const paidMinor = Number(paid)
  const creditedMinor = Number(credited)
  return {
    ...rest,
    subtotalMinor: Number(subtotal),
    taxMinor: Number(tax),
    totalMinor,
    priceVarianceMinor: Number(priceVariance),
    taxVarianceMinor: Number(taxVariance),
    paidMinor,
    creditedMinor,
    balanceMinor: invoiceBalanceMinor(totalMinor, paidMinor, creditedMinor),
    paymentStatus: derivePaymentStatus(totalMinor, paidMinor, creditedMinor),
    voidedAt: row.voidedAt === null ? null : row.voidedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const INVOICE_COLUMNS = `i.id, i.number, i.supplier_id as "supplierId", i.supplier_name as "supplierName",
  i.supplier_invoice_number as "supplierInvoiceNumber", i.order_id as "orderId", o.number as "orderNumber", i.status,
  to_char(i.invoice_date, 'YYYY-MM-DD') as "invoiceDate", to_char(i.due_date, 'YYYY-MM-DD') as "dueDate", i.currency,
  i.subtotal_minor::text as subtotal, i.tax_minor::text as tax, i.total_minor::text as total, i.notes,
  i.accounting_basis as "accountingBasis", i.price_variance_minor::text as "priceVariance", i.tax_variance_minor::text as "taxVariance",
  supplier_invoice_paid(i.tenant_id, i.id)::text as paid, supplier_invoice_credited(i.tenant_id, i.id)::text as credited,
  i.journal_entry_id as "journalEntryId", i.void_reason as "voidReason",
  i.voided_at as "voidedAt", i.voided_by as "voidedBy", i.void_entry_id as "voidEntryId",
  (select count(*)::int from supplier_invoice_lines l where l.tenant_id = i.tenant_id and l.invoice_id = i.id) as "lineCount",
  i.version, i.created_at as "createdAt", i.updated_at as "updatedAt", i.created_by as "createdBy"`

const INVOICE_FROM = `supplier_invoices i join purchase_orders o on o.tenant_id = i.tenant_id and o.id = i.order_id`

export type NewInvoice = {
  id: string
  number: number
  supplierId: string
  supplierName: string
  supplierInvoiceNumber: string
  orderId: string
  invoiceDate: string
  dueDate: string
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
  accountingBasis: AccountingBasis
  priceVarianceMinor: number
  taxVarianceMinor: number
  notes: string | null
  journalEntryId: string
}

export async function insertInvoice(tx: Queryable, tenantId: string, userId: string, invoice: NewInvoice): Promise<void> {
  await tx.query(
    `insert into supplier_invoices (id, tenant_id, number, supplier_id, supplier_name, supplier_invoice_number, order_id,
        invoice_date, due_date, subtotal_minor, tax_minor, total_minor, accounting_basis, price_variance_minor,
        tax_variance_minor, notes, journal_entry_id, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [
      invoice.id,
      tenantId,
      invoice.number,
      invoice.supplierId,
      invoice.supplierName,
      invoice.supplierInvoiceNumber,
      invoice.orderId,
      invoice.invoiceDate,
      invoice.dueDate,
      invoice.subtotalMinor,
      invoice.taxMinor,
      invoice.totalMinor,
      invoice.accountingBasis,
      invoice.priceVarianceMinor,
      invoice.taxVarianceMinor,
      invoice.notes,
      invoice.journalEntryId,
      userId,
    ]
  )
}

export async function insertInvoiceLines(
  tx: Queryable,
  tenantId: string,
  userId: string,
  invoiceId: string,
  orderId: string,
  lines: readonly PlannedInvoiceLine[]
): Promise<void> {
  for (const [index, line] of lines.entries()) {
    await tx.query(
      `insert into supplier_invoice_lines (tenant_id, invoice_id, order_id, order_line_id, item_id, line_no, description, quantity,
          unit_cost_minor, tax_rate_bps, po_unit_cost_minor, po_tax_rate_bps, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        tenantId,
        invoiceId,
        orderId,
        line.orderLineId,
        line.itemId,
        index + 1,
        line.description,
        line.quantity,
        line.unitCostMinor,
        line.taxRateBps,
        line.poUnitCostMinor,
        line.poTaxRateBps,
        userId,
      ]
    )
  }
}

export async function existsActiveSupplierNumber(tx: Queryable, tenantId: string, supplierId: string, supplierInvoiceNumber: string): Promise<boolean> {
  const result = await tx.query(
    `select 1 from supplier_invoices
     where tenant_id = $1 and supplier_id = $2 and lower(supplier_invoice_number) = lower($3) and status <> 'void'`,
    [tenantId, supplierId, supplierInvoiceNumber]
  )
  return result.rows.length > 0
}

export async function voidInvoice(
  tx: Queryable,
  tenantId: string,
  id: string,
  userId: string,
  version: number,
  outcome: { reason: string; voidEntryId: string }
): Promise<boolean> {
  const result = await tx.query(
    `update supplier_invoices set status = 'void', void_reason = $4, voided_at = now(), voided_by = $5, void_entry_id = $6, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'posted'`,
    [tenantId, id, version, outcome.reason, userId, outcome.voidEntryId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function findInvoice(tx: Queryable, tenantId: string, id: string, options: { lock: boolean } = { lock: false }): Promise<SupplierInvoice | null> {
  if (options.lock) await tx.query('select 1 from supplier_invoices where tenant_id = $1 and id = $2 for update', [tenantId, id])
  const result = await tx.query<InvoiceRow>(`select ${INVOICE_COLUMNS} from ${INVOICE_FROM} where i.tenant_id = $1 and i.id = $2`, [tenantId, id])
  return result.rows[0] ? invoiceFromRow(result.rows[0]) : null
}

/** The invoices a payment may name, locked in id order so two payments over the same invoices queue instead of crossing. */
export async function findInvoicesLocked(tx: Queryable, tenantId: string, ids: readonly string[]): Promise<SupplierInvoice[]> {
  const sorted = [...ids].sort()
  if (sorted.length === 0) return []
  await tx.query('select 1 from supplier_invoices where tenant_id = $1 and id = any($2::uuid[]) order by id for update', [tenantId, sorted])
  const result = await tx.query<InvoiceRow>(
    `select ${INVOICE_COLUMNS} from ${INVOICE_FROM} where i.tenant_id = $1 and i.id = any($2::uuid[]) order by i.id`,
    [tenantId, sorted]
  )
  return result.rows.map(invoiceFromRow)
}

export async function findInvoiceLines(tx: Queryable, tenantId: string, invoiceId: string): Promise<SupplierInvoiceLine[]> {
  const result = await tx.query<Omit<SupplierInvoiceLine, 'unitCostMinor' | 'poUnitCostMinor'> & { unitCost: string; poUnitCost: string }>(
    `select l.id, l.line_no as "lineNo", l.order_line_id as "orderLineId", l.item_id as "itemId", l.description, l.quantity,
            l.unit_cost_minor::text as "unitCost", l.tax_rate_bps as "taxRateBps",
            coalesce(l.po_unit_cost_minor, l.unit_cost_minor)::text as "poUnitCost", coalesce(l.po_tax_rate_bps, l.tax_rate_bps) as "poTaxRateBps",
            (select coalesce(sum(cl.quantity), 0)::int from supplier_credit_note_lines cl
               join supplier_credit_notes c on c.tenant_id = cl.tenant_id and c.id = cl.credit_note_id
              where cl.tenant_id = l.tenant_id and cl.invoice_line_id = l.id and c.status <> 'void') as "creditedQuantity"
     from supplier_invoice_lines l where l.tenant_id = $1 and l.invoice_id = $2 order by l.line_no`,
    [tenantId, invoiceId]
  )
  return result.rows.map(({ unitCost, poUnitCost, ...row }) => ({ ...row, unitCostMinor: Number(unitCost), poUnitCostMinor: Number(poUnitCost) }))
}

export async function findInvoiceDetail(tx: Queryable, tenantId: string, id: string): Promise<SupplierInvoiceDetail | null> {
  const invoice = await findInvoice(tx, tenantId, id)
  if (!invoice) return null
  return { ...invoice, lines: await findInvoiceLines(tx, tenantId, id) }
}

export async function listInvoices(tx: Queryable, tenantId: string, query: ListSupplierInvoicesQuery): Promise<Page<SupplierInvoice>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status !== 'all') {
    params.push(query.status)
    filters += ` and i.status = $${params.length}`
  }
  if (query.supplierId) {
    params.push(query.supplierId)
    filters += ` and i.supplier_id = $${params.length}`
  }
  if (query.orderId) {
    params.push(query.orderId)
    filters += ` and i.order_id = $${params.length}`
  }
  if (query.settlement === 'open') {
    filters += ` and i.status = 'posted' and i.total_minor > supplier_invoice_paid(i.tenant_id, i.id) + supplier_invoice_credited(i.tenant_id, i.id)`
  }
  const keyset = keysetClauses({ sortKey: 'number', column: { sql: 'number', cast: 'bigint' }, direction: 'desc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<InvoiceRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (select ${INVOICE_COLUMNS} from ${INVOICE_FROM} where i.tenant_id = $1${filters}) x
     where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'number', 'desc')
  return { data: page.data.map((row) => invoiceFromRow(row as InvoiceRow)), nextCursor: page.nextCursor }
}

// ---- accounting settings ----

type AccountingRow = Omit<ProcurementAccounting, 'taxToleranceMinor'> & { taxTolerance: string }

const NO_ACCOUNTING: ProcurementAccounting = {
  inventoryAccountId: null,
  payableAccountId: null,
  inputTaxAccountId: null,
  grniAccountId: null,
  ppvAccountId: null,
  accountingBasis: 'invoice_basis',
  priceToleranceBps: 0,
  taxToleranceMinor: 0,
  version: 0,
}

export async function findAccounting(tx: Queryable, tenantId: string, options: { lock: boolean } = { lock: false }): Promise<ProcurementAccounting> {
  const result = await tx.query<AccountingRow>(
    `select inventory_account_id as "inventoryAccountId", payable_account_id as "payableAccountId",
            input_tax_account_id as "inputTaxAccountId", grni_account_id as "grniAccountId", ppv_account_id as "ppvAccountId",
            accounting_basis as "accountingBasis", price_tolerance_bps as "priceToleranceBps",
            tax_tolerance_minor::text as "taxTolerance", version
     from procurement_accounting where tenant_id = $1${options.lock ? ' for update' : ''}`,
    [tenantId]
  )
  const row = result.rows[0]
  if (!row) return NO_ACCOUNTING
  const { taxTolerance, ...rest } = row
  return { ...rest, taxToleranceMinor: Number(taxTolerance) }
}

export type AccountingValues = {
  inventoryAccountId: string
  payableAccountId: string
  inputTaxAccountId: string | null
  grniAccountId: string | null
  ppvAccountId: string | null
  accountingBasis: AccountingBasis
  priceToleranceBps: number
  taxToleranceMinor: number
}

export async function insertAccounting(tx: Queryable, tenantId: string, userId: string, accounts: AccountingValues): Promise<void> {
  await tx.query(
    `insert into procurement_accounting (tenant_id, inventory_account_id, payable_account_id, input_tax_account_id, grni_account_id,
                                         ppv_account_id, accounting_basis, price_tolerance_bps, tax_tolerance_minor, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      tenantId,
      accounts.inventoryAccountId,
      accounts.payableAccountId,
      accounts.inputTaxAccountId,
      accounts.grniAccountId,
      accounts.ppvAccountId,
      accounts.accountingBasis,
      accounts.priceToleranceBps,
      accounts.taxToleranceMinor,
      userId,
    ]
  )
}

export async function updateAccounting(tx: Queryable, tenantId: string, version: number, accounts: AccountingValues): Promise<boolean> {
  const result = await tx.query(
    `update procurement_accounting
        set inventory_account_id = $3, payable_account_id = $4, input_tax_account_id = $5, grni_account_id = $6, ppv_account_id = $7,
            accounting_basis = $8, price_tolerance_bps = $9, tax_tolerance_minor = $10, version = version + 1
      where tenant_id = $1 and version = $2`,
    [
      tenantId,
      version,
      accounts.inventoryAccountId,
      accounts.payableAccountId,
      accounts.inputTaxAccountId,
      accounts.grniAccountId,
      accounts.ppvAccountId,
      accounts.accountingBasis,
      accounts.priceToleranceBps,
      accounts.taxToleranceMinor,
    ]
  )
  return (result.rowCount ?? 0) > 0
}
