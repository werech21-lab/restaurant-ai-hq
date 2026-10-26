import type { Page } from '@/lib/api/cursor'
import { keysetClauses, toPage, type SortColumn } from '@/lib/api/keyset'
import type { Queryable } from '@/lib/db'
import type { Currency } from '@/lib/money'
import type {
  CustomerFinancials,
  FinanceSettings,
  Invoice,
  InvoiceLine,
  InvoiceStatus,
  InvoiceSummary,
  Payment,
  PaymentMethod,
} from '@/modules/finance/domain/types'
import { invoiceStatuses } from '@/modules/finance/domain/types'
import type { InvoiceLineInput, InvoiceSortKey, ListInvoicesQuery } from '@/modules/finance/schemas/invoice'

type InvoiceRow = Omit<Invoice, 'submittedAt' | 'approvedAt' | 'voidedAt' | 'createdAt' | 'updatedAt'> & {
  submittedAt: Date | null
  approvedAt: Date | null
  voidedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type PaymentRow = Omit<Payment, 'paidAt' | 'createdAt'> & { paidAt: Date; createdAt: Date }

const INVOICE_COLUMNS = `id, number, customer_id as "customerId", customer_name as "customerName", status, currency,
  issue_date as "issueDate", due_date as "dueDate", notes,
  subtotal_minor as "subtotalMinor", tax_minor as "taxMinor", total_minor as "totalMinor", paid_minor as "paidMinor",
  requires_approval as "requiresApproval", submitted_at as "submittedAt", approved_at as "approvedAt",
  approved_by as "approvedBy", voided_at as "voidedAt", void_reason as "voidReason", version,
  created_at as "createdAt", updated_at as "updatedAt", created_by as "createdBy"`

const LINE_COLUMNS = `id, position, description, quantity, unit_price_minor as "unitPriceMinor",
  tax_rate_bps as "taxRateBps", line_net_minor as "lineNetMinor", item_id as "itemId", warehouse_id as "warehouseId"`

const PAYMENT_COLUMNS = `id, invoice_id as "invoiceId", amount_minor as "amountMinor", currency, method,
  paid_at as "paidAt", reference, created_at as "createdAt", created_by as "createdBy"`

const sortColumns: Record<InvoiceSortKey, SortColumn> = {
  createdAt: { sql: 'created_at', cast: 'timestamptz' },
  dueDate: { sql: 'due_date', cast: 'date' },
  totalMinor: { sql: 'total_minor', cast: 'bigint' },
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null
}

function toInvoice(row: InvoiceRow): Invoice {
  return {
    ...row,
    submittedAt: iso(row.submittedAt),
    approvedAt: iso(row.approvedAt),
    voidedAt: iso(row.voidedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toPayment(row: PaymentRow): Payment {
  return { ...row, paidAt: row.paidAt.toISOString(), createdAt: row.createdAt.toISOString() }
}

export async function getSettings(tx: Queryable, tenantId: string): Promise<FinanceSettings | null> {
  const result = await tx.query<{ currency: Currency; invoicePrefix: string; approvalThresholdMinor: number }>(
    `select currency, invoice_prefix as "invoicePrefix", approval_threshold_minor as "approvalThresholdMinor"
     from finance_settings where tenant_id = $1`,
    [tenantId]
  )
  return result.rows[0] ?? null
}

export async function findInvoice(
  tx: Queryable,
  tenantId: string,
  id: string,
  options: { lock: boolean } = { lock: false }
): Promise<Invoice | null> {
  const result = await tx.query<InvoiceRow>(
    `select ${INVOICE_COLUMNS} from invoices where tenant_id = $1 and id = $2${options.lock ? ' for update' : ''}`,
    [tenantId, id]
  )
  return result.rows[0] ? toInvoice(result.rows[0]) : null
}

export async function listLines(tx: Queryable, tenantId: string, invoiceId: string): Promise<InvoiceLine[]> {
  const result = await tx.query<InvoiceLine>(
    `select ${LINE_COLUMNS} from invoice_lines where tenant_id = $1 and invoice_id = $2 order by position`,
    [tenantId, invoiceId]
  )
  return result.rows
}

export async function listPayments(tx: Queryable, tenantId: string, invoiceId: string): Promise<Payment[]> {
  const result = await tx.query<PaymentRow>(
    `select ${PAYMENT_COLUMNS} from payments where tenant_id = $1 and invoice_id = $2 order by paid_at desc, id desc`,
    [tenantId, invoiceId]
  )
  return result.rows.map(toPayment)
}

export type NewInvoice = {
  number: string
  customerId: string
  customerName: string
  issueDate: string
  dueDate: string
  notes: string | null
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
}

export async function insertInvoice(tx: Queryable, tenantId: string, userId: string, invoice: NewInvoice): Promise<Invoice> {
  const result = await tx.query<InvoiceRow>(
    `insert into invoices
       (tenant_id, number, customer_id, customer_name, issue_date, due_date, notes,
        subtotal_minor, tax_minor, total_minor, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning ${INVOICE_COLUMNS}`,
    [
      tenantId,
      invoice.number,
      invoice.customerId,
      invoice.customerName,
      invoice.issueDate,
      invoice.dueDate,
      invoice.notes,
      invoice.subtotalMinor,
      invoice.taxMinor,
      invoice.totalMinor,
      userId,
    ]
  )
  return toInvoice(result.rows[0])
}

export async function insertLines(
  tx: Queryable,
  tenantId: string,
  userId: string,
  invoiceId: string,
  lines: readonly InvoiceLineInput[]
): Promise<void> {
  const params: unknown[] = []
  const tuples = lines.map((line, index) => {
    params.push(
      tenantId,
      invoiceId,
      index + 1,
      line.description,
      line.quantity,
      line.unitPriceMinor,
      line.taxRateBps,
      userId,
      line.itemId,
      line.warehouseId
    )
    const base = index * 10
    const placeholders = Array.from({ length: 10 }, (_, offset) => `$${base + offset + 1}`)
    return `(${placeholders.join(', ')})`
  })
  await tx.query(
    `insert into invoice_lines
       (tenant_id, invoice_id, position, description, quantity, unit_price_minor, tax_rate_bps, created_by, item_id, warehouse_id)
     values ${tuples.join(', ')}`,
    params
  )
}

/** Draft lines are replaced as a set. The database refuses this once the invoice has left draft. */
export async function deleteLines(tx: Queryable, tenantId: string, invoiceId: string): Promise<void> {
  await tx.query('delete from invoice_lines where tenant_id = $1 and invoice_id = $2', [tenantId, invoiceId])
}

export async function updateDraftHeader(
  tx: Queryable,
  tenantId: string,
  id: string,
  expectedVersion: number,
  fields: Omit<NewInvoice, 'number'>
): Promise<Invoice | null> {
  const result = await tx.query<InvoiceRow>(
    `update invoices set
       customer_id = $4, customer_name = $5, issue_date = $6, due_date = $7, notes = $8,
       subtotal_minor = $9, tax_minor = $10, total_minor = $11, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'draft'
     returning ${INVOICE_COLUMNS}`,
    [
      tenantId,
      id,
      expectedVersion,
      fields.customerId,
      fields.customerName,
      fields.issueDate,
      fields.dueDate,
      fields.notes,
      fields.subtotalMinor,
      fields.taxMinor,
      fields.totalMinor,
    ]
  )
  return result.rows[0] ? toInvoice(result.rows[0]) : null
}

export type StatusChange = {
  status: InvoiceStatus
  requiresApproval?: boolean
  submittedAt?: 'now'
  approvedBy?: string
  voidReason?: string
  paidMinor?: number
}

/** Applies a status change with an optimistic version check. Returns null when the version no longer matches. */
export async function applyStatusChange(
  tx: Queryable,
  tenantId: string,
  id: string,
  expectedVersion: number,
  change: StatusChange
): Promise<Invoice | null> {
  const result = await tx.query<InvoiceRow>(
    `update invoices set
       status = $4,
       requires_approval = coalesce($5::boolean, requires_approval),
       submitted_at = case when $6::boolean then now() else submitted_at end,
       approved_at = case when $7::uuid is not null then now() else approved_at end,
       approved_by = coalesce($7::uuid, approved_by),
       voided_at = case when $8::text is not null then now() else voided_at end,
       void_reason = coalesce($8::text, void_reason),
       paid_minor = coalesce($9::bigint, paid_minor),
       version = version + 1
     where tenant_id = $1 and id = $2 and version = $3
     returning ${INVOICE_COLUMNS}`,
    [
      tenantId,
      id,
      expectedVersion,
      change.status,
      change.requiresApproval ?? null,
      change.submittedAt === 'now',
      change.approvedBy ?? null,
      change.voidReason ?? null,
      change.paidMinor ?? null,
    ]
  )
  return result.rows[0] ? toInvoice(result.rows[0]) : null
}

export async function insertPayment(
  tx: Queryable,
  tenantId: string,
  userId: string,
  payment: { invoiceId: string; amountMinor: number; method: PaymentMethod; paidAt: string; reference: string | null }
): Promise<Payment> {
  const result = await tx.query<PaymentRow>(
    `insert into payments (tenant_id, invoice_id, amount_minor, method, paid_at, reference, created_by)
     values ($1, $2, $3, $4, $5::timestamptz, $6, $7)
     returning ${PAYMENT_COLUMNS}`,
    [tenantId, payment.invoiceId, payment.amountMinor, payment.method, payment.paidAt, payment.reference, userId]
  )
  return toPayment(result.rows[0])
}

export async function listInvoices(tx: Queryable, tenantId: string, query: ListInvoicesQuery): Promise<Page<Invoice>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status) {
    params.push(query.status)
    filters += ` and status = $${params.length}`
  }
  if (query.customerId) {
    params.push(query.customerId)
    filters += ` and customer_id = $${params.length}`
  }
  if (query.q) {
    params.push(`%${query.q.replace(/[\\%_]/g, (character) => `\\${character}`)}%`)
    filters += ` and (number ilike $${params.length} or customer_name ilike $${params.length})`
  }
  const keyset = keysetClauses({
    sortKey: query.sort,
    column: sortColumns[query.sort],
    direction: query.direction,
    cursor: query.cursor,
    params,
  })
  params.push(query.limit + 1)
  const result = await tx.query<InvoiceRow & { sortValue: string }>(
    `select ${INVOICE_COLUMNS}, ${keyset.selectValue}
     from invoices
     where tenant_id = $1${filters}${keyset.where}
     order by ${keyset.orderBy}
     limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, query.sort, query.direction)
  return { data: page.data.map(toInvoice), nextCursor: page.nextCursor }
}

export async function customerFinancials(tx: Queryable, tenantId: string, customerId: string): Promise<CustomerFinancials> {
  const totals = await tx.query<{ totalInvoiced: number; openBalance: number; overdue: number; invoiceCount: number }>(
    `select
       coalesce(sum(total_minor) filter (where status in ('issued', 'partially_paid', 'paid')), 0)::bigint as "totalInvoiced",
       coalesce(sum(total_minor - paid_minor) filter (where status in ('issued', 'partially_paid')), 0)::bigint as "openBalance",
       coalesce(sum(total_minor - paid_minor) filter (
         where status in ('issued', 'partially_paid') and due_date < (now() at time zone 'utc')::date
       ), 0)::bigint as overdue,
       (count(*) filter (where status in ('issued', 'partially_paid', 'paid')))::bigint as "invoiceCount"
     from invoices
     where tenant_id = $1 and customer_id = $2`,
    [tenantId, customerId]
  )
  const recent = await tx.query<InvoiceRow>(
    `select ${INVOICE_COLUMNS} from invoices
     where tenant_id = $1 and customer_id = $2
     order by created_at desc, id desc
     limit 10`,
    [tenantId, customerId]
  )
  const payments = await tx.query<{ id: string; invoiceId: string; invoiceNumber: string; amountMinor: number; paidAt: Date }>(
    `select p.id, p.invoice_id as "invoiceId", i.number as "invoiceNumber", p.amount_minor as "amountMinor", p.paid_at as "paidAt"
     from payments p
     join invoices i on i.tenant_id = p.tenant_id and i.id = p.invoice_id
     where p.tenant_id = $1 and i.customer_id = $2
     order by p.paid_at desc, p.id desc
     limit 10`,
    [tenantId, customerId]
  )
  const row = totals.rows[0]
  return {
    totalInvoicedMinor: row.totalInvoiced,
    openBalanceMinor: row.openBalance,
    overdueMinor: row.overdue,
    invoiceCount: Number(row.invoiceCount),
    recentInvoices: recent.rows.map(toInvoice),
    recentPayments: payments.rows.map((payment) => ({ ...payment, paidAt: payment.paidAt.toISOString() })),
  }
}

export async function summarize(tx: Queryable, tenantId: string, approvalThresholdMinor: number): Promise<InvoiceSummary> {
  const counts = await tx.query<{ status: InvoiceStatus; count: number }>(
    'select status, count(*)::bigint as count from invoices where tenant_id = $1 group by status',
    [tenantId]
  )
  const open = await tx.query<{ outstanding: number; overdue: number; overdueCount: number }>(
    `select
       coalesce(sum(total_minor - paid_minor), 0)::bigint as outstanding,
       coalesce(sum(total_minor - paid_minor) filter (where due_date < (now() at time zone 'utc')::date), 0)::bigint as overdue,
       (count(*) filter (where due_date < (now() at time zone 'utc')::date))::bigint as "overdueCount"
     from invoices
     where tenant_id = $1 and status in ('issued', 'partially_paid')`,
    [tenantId]
  )
  const months = await tx.query<{ month: string; invoicedMinor: number; collectedMinor: number }>(
    `with series as (
       select generate_series(
         date_trunc('month', now() at time zone 'utc') - interval '5 months',
         date_trunc('month', now() at time zone 'utc'),
         interval '1 month'
       ) as month_start
     )
     select to_char(s.month_start, 'YYYY-MM') as month,
            coalesce((select sum(i.total_minor) from invoices i
                      where i.tenant_id = $1 and i.status in ('issued', 'partially_paid', 'paid')
                        and i.issue_date >= s.month_start::date
                        and i.issue_date < (s.month_start + interval '1 month')::date), 0)::bigint as "invoicedMinor",
            coalesce((select sum(p.amount_minor) from payments p
                      where p.tenant_id = $1
                        and (p.paid_at at time zone 'utc') >= s.month_start
                        and (p.paid_at at time zone 'utc') < s.month_start + interval '1 month'), 0)::bigint as "collectedMinor"
     from series s
     order by s.month_start`,
    [tenantId]
  )

  const countsByStatus = Object.fromEntries(invoiceStatuses.map((status) => [status, 0])) as Record<InvoiceStatus, number>
  counts.rows.forEach((row) => {
    countsByStatus[row.status] = Number(row.count)
  })
  const row = open.rows[0]
  return {
    approvalThresholdMinor,
    countsByStatus,
    outstandingMinor: row.outstanding,
    overdueMinor: row.overdue,
    overdueCount: Number(row.overdueCount),
    months: months.rows,
  }
}
