import type { Page } from '@/lib/api/cursor'
import { keysetClauses, toPage, type SortColumn } from '@/lib/api/keyset'
import type { Queryable } from '@/lib/db'
import type { Quotation, QuotationLine, QuotationStatus } from '@/modules/crm/domain/types'
import type { ListQuotationsQuery, QuotationLineInput, QuotationSortKey } from '@/modules/crm/schemas/quotation'

type QuotationRow = Omit<Quotation, 'sentAt' | 'acceptedAt' | 'convertedAt' | 'createdAt' | 'updatedAt'> & {
  sentAt: Date | null
  acceptedAt: Date | null
  convertedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const COLUMNS = `id, quote_number as "quoteNumber", customer_id as "customerId", customer_name as "customerName",
  lead_id as "leadId", status, currency, valid_until as "validUntil", notes,
  subtotal_minor as "subtotalMinor", tax_minor as "taxMinor", total_minor as "totalMinor", invoice_id as "invoiceId",
  sent_at as "sentAt", accepted_at as "acceptedAt", converted_at as "convertedAt", version,
  created_at as "createdAt", updated_at as "updatedAt", created_by as "createdBy"`

const LINE_COLUMNS = `id, position, inventory_item_id as "itemId", warehouse_id as "warehouseId", description, quantity,
  unit_price_minor as "unitPriceMinor", tax_rate_bps as "taxRateBps", line_net_minor as "lineNetMinor"`

const sortColumns: Record<QuotationSortKey, SortColumn> = {
  createdAt: { sql: 'created_at', cast: 'timestamptz' },
  validUntil: { sql: 'valid_until', cast: 'date' },
  totalMinor: { sql: 'total_minor', cast: 'bigint' },
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null
}

function toQuotation(row: QuotationRow): Quotation {
  return {
    ...row,
    sentAt: iso(row.sentAt),
    acceptedAt: iso(row.acceptedAt),
    convertedAt: iso(row.convertedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export type NewQuotation = {
  quoteNumber: string
  customerId: string
  customerName: string
  leadId: string | null
  validUntil: string
  notes: string | null
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
}

export async function findQuotation(
  tx: Queryable,
  tenantId: string,
  id: string,
  options: { lock: boolean } = { lock: false }
): Promise<Quotation | null> {
  const result = await tx.query<QuotationRow>(
    `select ${COLUMNS} from sales_quotations where tenant_id = $1 and id = $2${options.lock ? ' for update' : ''}`,
    [tenantId, id]
  )
  return result.rows[0] ? toQuotation(result.rows[0]) : null
}

export async function listLines(tx: Queryable, tenantId: string, quotationId: string): Promise<QuotationLine[]> {
  const result = await tx.query<QuotationLine>(
    `select ${LINE_COLUMNS} from sales_quotation_lines where tenant_id = $1 and quotation_id = $2 order by position`,
    [tenantId, quotationId]
  )
  return result.rows
}

export async function insertQuotation(
  tx: Queryable,
  tenantId: string,
  userId: string,
  input: NewQuotation
): Promise<Quotation> {
  // The totals check is deferred to commit, so the header goes in first and the lines follow in the same transaction.
  const result = await tx.query<QuotationRow>(
    `insert into sales_quotations
       (tenant_id, quote_number, customer_id, customer_name, lead_id, valid_until, notes,
        subtotal_minor, tax_minor, total_minor, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning ${COLUMNS}`,
    [
      tenantId,
      input.quoteNumber,
      input.customerId,
      input.customerName,
      input.leadId,
      input.validUntil,
      input.notes,
      input.subtotalMinor,
      input.taxMinor,
      input.totalMinor,
      userId,
    ]
  )
  return toQuotation(result.rows[0])
}

export async function insertLines(
  tx: Queryable,
  tenantId: string,
  userId: string,
  quotationId: string,
  lines: readonly QuotationLineInput[]
): Promise<void> {
  for (const [index, line] of lines.entries()) {
    await tx.query(
      `insert into sales_quotation_lines
         (tenant_id, quotation_id, position, inventory_item_id, warehouse_id, description, quantity, unit_price_minor,
          tax_rate_bps, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        tenantId,
        quotationId,
        index + 1,
        line.itemId,
        line.warehouseId,
        line.description,
        line.quantity,
        line.unitPriceMinor,
        line.taxRateBps,
        userId,
      ]
    )
  }
}

/** Only a draft quotation's lines may be replaced. The database trigger refuses it otherwise. */
export async function deleteLines(tx: Queryable, tenantId: string, quotationId: string): Promise<void> {
  await tx.query('delete from sales_quotation_lines where tenant_id = $1 and quotation_id = $2', [tenantId, quotationId])
}

/** Returns null when the version no longer matches. */
export async function updateDraftHeader(
  tx: Queryable,
  tenantId: string,
  id: string,
  version: number,
  input: NewQuotation
): Promise<Quotation | null> {
  const result = await tx.query<QuotationRow>(
    `update sales_quotations
     set customer_id = $4, customer_name = $5, lead_id = $6, valid_until = $7, notes = $8,
         subtotal_minor = $9, tax_minor = $10, total_minor = $11, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'draft'
     returning ${COLUMNS}`,
    [
      tenantId,
      id,
      version,
      input.customerId,
      input.customerName,
      input.leadId,
      input.validUntil,
      input.notes,
      input.subtotalMinor,
      input.taxMinor,
      input.totalMinor,
    ]
  )
  return result.rows[0] ? toQuotation(result.rows[0]) : null
}

export type StatusChange =
  | { status: 'sent' }
  | { status: 'accepted' }
  | { status: 'rejected' }
  | { status: 'expired' }
  | { status: 'converted'; invoiceId: string }

/** Moves the status and stamps the matching timestamp. Returns null when the version no longer matches. */
export async function applyStatusChange(
  tx: Queryable,
  tenantId: string,
  id: string,
  version: number,
  change: StatusChange
): Promise<Quotation | null> {
  const invoiceId = change.status === 'converted' ? change.invoiceId : null
  const result = await tx.query<QuotationRow>(
    `update sales_quotations
     set status = $4::text,
         sent_at = case when $4::text = 'sent' then now() else sent_at end,
         accepted_at = case when $4::text = 'accepted' then now() else accepted_at end,
         converted_at = case when $4::text = 'converted' then now() else converted_at end,
         invoice_id = case when $4::text = 'converted' then $5::uuid else invoice_id end,
         version = version + 1
     where tenant_id = $1 and id = $2 and version = $3
     returning ${COLUMNS}`,
    [tenantId, id, version, change.status satisfies QuotationStatus, invoiceId]
  )
  return result.rows[0] ? toQuotation(result.rows[0]) : null
}

export async function listQuotations(tx: Queryable, tenantId: string, query: ListQuotationsQuery): Promise<Page<Quotation>> {
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
  if (query.leadId) {
    params.push(query.leadId)
    filters += ` and lead_id = $${params.length}`
  }
  if (query.q) {
    params.push(`%${query.q.replace(/[\\%_]/g, (character) => `\\${character}`)}%`)
    filters += ` and (quote_number ilike $${params.length} or customer_name ilike $${params.length})`
  }
  const keyset = keysetClauses({
    sortKey: query.sort,
    column: sortColumns[query.sort],
    direction: query.direction,
    cursor: query.cursor,
    params,
  })
  params.push(query.limit + 1)
  const result = await tx.query<QuotationRow & { sortValue: string }>(
    `select ${COLUMNS}, ${keyset.selectValue}
     from sales_quotations
     where tenant_id = $1${filters}${keyset.where}
     order by ${keyset.orderBy}
     limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, query.sort, query.direction)
  return { data: page.data.map(toQuotation), nextCursor: page.nextCursor }
}

export async function listQuotationsForCustomer(
  tx: Queryable,
  tenantId: string,
  customerId: string,
  limit: number
): Promise<Quotation[]> {
  const result = await tx.query<QuotationRow>(
    `select ${COLUMNS} from sales_quotations where tenant_id = $1 and customer_id = $2
     order by created_at desc, id desc limit $3`,
    [tenantId, customerId, limit]
  )
  return result.rows.map(toQuotation)
}
