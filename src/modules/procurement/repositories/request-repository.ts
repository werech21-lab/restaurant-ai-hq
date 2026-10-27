import type { Page } from '@/lib/api/cursor'
import { keysetClauses, toPage } from '@/lib/api/keyset'
import type { Queryable } from '@/lib/db'
import type { PurchaseRequest, PurchaseRequestDetail, RequestLine } from '@/modules/procurement/domain/types'
import type { ListRequestsQuery, RequestLineInput } from '@/modules/procurement/schemas/request'

type RequestRow = Omit<PurchaseRequest, 'submittedAt' | 'decidedAt' | 'convertedAt' | 'cancelledAt' | 'createdAt' | 'updatedAt'> & {
  submittedAt: Date | null
  decidedAt: Date | null
  convertedAt: Date | null
  cancelledAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const iso = (value: Date | null): string | null => (value === null ? null : value.toISOString())

function requestFromRow(row: RequestRow): PurchaseRequest {
  return {
    ...row,
    submittedAt: iso(row.submittedAt),
    decidedAt: iso(row.decidedAt),
    convertedAt: iso(row.convertedAt),
    cancelledAt: iso(row.cancelledAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const REQUEST_COLUMNS = `r.id, r.number, r.requested_by as "requestedBy", r.status, to_char(r.needed_by, 'YYYY-MM-DD') as "neededBy", r.reason,
  r.submitted_at as "submittedAt", r.submitted_by as "submittedBy", r.decided_at as "decidedAt", r.decided_by as "decidedBy",
  r.decision_note as "decisionNote", r.purchase_order_id as "purchaseOrderId", o.number as "purchaseOrderNumber",
  r.converted_at as "convertedAt", r.cancelled_at as "cancelledAt", r.cancelled_reason as "cancelledReason",
  (select count(*)::int from purchase_request_lines l where l.tenant_id = r.tenant_id and l.request_id = r.id) as "lineCount",
  r.version, r.created_at as "createdAt", r.updated_at as "updatedAt", r.created_by as "createdBy"`

const REQUEST_FROM = `purchase_requests r left join purchase_orders o on o.tenant_id = r.tenant_id and o.id = r.purchase_order_id`

export async function insertRequest(
  tx: Queryable,
  tenantId: string,
  userId: string,
  number: number,
  header: { neededBy: string | null; reason: string | null }
): Promise<string> {
  const inserted = await tx.query<{ id: string }>(
    `insert into purchase_requests (tenant_id, number, requested_by, needed_by, reason, created_by)
     values ($1, $2, $3, $4, $5, $3) returning id`,
    [tenantId, number, userId, header.neededBy, header.reason]
  )
  return inserted.rows[0].id
}

export async function insertRequestLines(tx: Queryable, tenantId: string, userId: string, requestId: string, lines: readonly RequestLineInput[]): Promise<void> {
  for (const [index, line] of lines.entries()) {
    await tx.query(
      `insert into purchase_request_lines (tenant_id, request_id, line_no, item_id, description, quantity, created_by)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, requestId, index + 1, line.itemId, line.description, line.quantity, userId]
    )
  }
}

export async function deleteRequestLines(tx: Queryable, tenantId: string, requestId: string): Promise<void> {
  await tx.query('delete from purchase_request_lines where tenant_id = $1 and request_id = $2', [tenantId, requestId])
}

export async function updateDraftRequest(
  tx: Queryable,
  tenantId: string,
  id: string,
  version: number,
  header: { neededBy: string | null; reason: string | null }
): Promise<boolean> {
  const result = await tx.query(
    `update purchase_requests set needed_by = $4, reason = $5, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'draft'`,
    [tenantId, id, version, header.neededBy, header.reason]
  )
  return (result.rowCount ?? 0) > 0
}

export async function submitRequest(tx: Queryable, tenantId: string, id: string, userId: string, version: number): Promise<boolean> {
  const result = await tx.query(
    `update purchase_requests set status = 'submitted', submitted_at = now(), submitted_by = $4, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'draft'`,
    [tenantId, id, version, userId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function decideRequest(
  tx: Queryable,
  tenantId: string,
  id: string,
  userId: string,
  version: number,
  decision: { status: 'approved' | 'rejected'; note: string | null }
): Promise<boolean> {
  const result = await tx.query(
    `update purchase_requests set status = $4, decided_at = now(), decided_by = $5, decision_note = $6, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'submitted'`,
    [tenantId, id, version, decision.status, userId, decision.note]
  )
  return (result.rowCount ?? 0) > 0
}

export async function convertRequest(tx: Queryable, tenantId: string, id: string, userId: string, version: number, orderId: string): Promise<boolean> {
  const result = await tx.query(
    `update purchase_requests set status = 'converted', purchase_order_id = $4, converted_at = now(), converted_by = $5, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'approved'`,
    [tenantId, id, version, orderId, userId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function cancelRequest(tx: Queryable, tenantId: string, id: string, userId: string, version: number, reason: string): Promise<boolean> {
  const result = await tx.query(
    `update purchase_requests set status = 'cancelled', cancelled_at = now(), cancelled_by = $4, cancelled_reason = $5, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status in ('draft', 'submitted', 'approved')`,
    [tenantId, id, version, userId, reason]
  )
  return (result.rowCount ?? 0) > 0
}

export async function findRequest(tx: Queryable, tenantId: string, id: string, options: { lock: boolean } = { lock: false }): Promise<PurchaseRequest | null> {
  if (options.lock) await tx.query('select 1 from purchase_requests where tenant_id = $1 and id = $2 for update', [tenantId, id])
  const result = await tx.query<RequestRow>(`select ${REQUEST_COLUMNS} from ${REQUEST_FROM} where r.tenant_id = $1 and r.id = $2`, [tenantId, id])
  return result.rows[0] ? requestFromRow(result.rows[0]) : null
}

export async function findRequestLines(tx: Queryable, tenantId: string, requestId: string): Promise<RequestLine[]> {
  const result = await tx.query<RequestLine>(
    `select id, line_no as "lineNo", item_id as "itemId", description, quantity
     from purchase_request_lines where tenant_id = $1 and request_id = $2 order by line_no`,
    [tenantId, requestId]
  )
  return result.rows
}

export async function findRequestDetail(tx: Queryable, tenantId: string, id: string): Promise<PurchaseRequestDetail | null> {
  const request = await findRequest(tx, tenantId, id)
  if (!request) return null
  return { ...request, lines: await findRequestLines(tx, tenantId, id) }
}

export async function listRequests(tx: Queryable, tenantId: string, query: ListRequestsQuery): Promise<Page<PurchaseRequest>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status !== 'all') {
    params.push(query.status)
    filters += ` and r.status = $${params.length}`
  }
  const keyset = keysetClauses({ sortKey: 'number', column: { sql: 'number', cast: 'bigint' }, direction: 'desc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<RequestRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (select ${REQUEST_COLUMNS} from ${REQUEST_FROM} where r.tenant_id = $1${filters}) x
     where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'number', 'desc')
  return { data: page.data.map((row) => requestFromRow(row as RequestRow)), nextCursor: page.nextCursor }
}