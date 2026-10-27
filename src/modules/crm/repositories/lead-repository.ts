import type { Page } from '@/lib/api/cursor'
import { keysetClauses, toPage, type SortColumn } from '@/lib/api/keyset'
import type { Queryable } from '@/lib/db'
import {
  leadStages,
  type CustomerStatus,
  type Lead,
  type LeadStage,
  type OpenLeadStage,
  type StageSummary,
  type StalledLead,
  type TeamMember,
} from '@/modules/crm/domain/types'
import type { CreateLeadInput, LeadSortKey, ListLeadsQuery, UpdateLeadInput } from '@/modules/crm/schemas/lead'

type LeadRow = Omit<Lead, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date }

// Leads carry the customer's name for display. It is read from the customers table in the same module.
const COLUMNS = `l.id, l.customer_id as "customerId", c.name as "customerName", l.title, l.stage,
  l.expected_revenue_minor as "expectedRevenueMinor", l.currency, l.probability, l.assigned_to as "assignedTo",
  l.expected_close_date as "expectedCloseDate", l.notes, l.version,
  l.created_at as "createdAt", l.updated_at as "updatedAt", l.created_by as "createdBy"`

const FROM = `from crm_leads_pipeline l join customers c on c.tenant_id = l.tenant_id and c.id = l.customer_id`

const sortColumns: Record<LeadSortKey, SortColumn> = {
  createdAt: { sql: '"createdAt"', cast: 'timestamptz' },
  expectedRevenueMinor: { sql: '"expectedRevenueMinor"', cast: 'bigint' },
  title: { sql: 'title', cast: 'text' },
}

function toLead(row: LeadRow): Lead {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }
}

export async function findLead(
  tx: Queryable,
  tenantId: string,
  id: string,
  options: { lock: boolean } = { lock: false }
): Promise<Lead | null> {
  // `for update of l` locks only the lead row, not the customer it joins to.
  const result = await tx.query<LeadRow>(
    `select ${COLUMNS} ${FROM} where l.tenant_id = $1 and l.id = $2${options.lock ? ' for update of l' : ''}`,
    [tenantId, id]
  )
  return result.rows[0] ? toLead(result.rows[0]) : null
}

export async function insertLead(tx: Queryable, tenantId: string, userId: string, input: CreateLeadInput): Promise<Lead> {
  const inserted = await tx.query<{ id: string }>(
    `insert into crm_leads_pipeline
       (tenant_id, customer_id, title, stage, expected_revenue_minor, probability, assigned_to, expected_close_date, notes, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning id`,
    [
      tenantId,
      input.customerId,
      input.title,
      input.stage,
      input.expectedRevenueMinor,
      input.probability,
      input.assignedTo,
      input.expectedCloseDate,
      input.notes,
      userId,
    ]
  )
  const lead = await findLead(tx, tenantId, inserted.rows[0].id)
  if (!lead) throw new Error('The lead that was just inserted could not be read back.')
  return lead
}

/** Returns null when the version no longer matches. */
export async function updateLead(tx: Queryable, tenantId: string, id: string, input: UpdateLeadInput): Promise<Lead | null> {
  const updated = await tx.query<{ id: string }>(
    `update crm_leads_pipeline
     set title = $3, expected_revenue_minor = $4, probability = $5, assigned_to = $6, expected_close_date = $7,
         notes = $8, version = version + 1
     where tenant_id = $1 and id = $2 and version = $9
     returning id`,
    [
      tenantId,
      id,
      input.title,
      input.expectedRevenueMinor,
      input.probability,
      input.assignedTo,
      input.expectedCloseDate,
      input.notes,
      input.version,
    ]
  )
  return updated.rows[0] ? findLead(tx, tenantId, id) : null
}

/** Returns null when the version no longer matches. */
export async function moveLead(
  tx: Queryable,
  tenantId: string,
  id: string,
  version: number,
  stage: LeadStage,
  probability: number
): Promise<Lead | null> {
  const updated = await tx.query<{ id: string }>(
    `update crm_leads_pipeline
     set stage = $3, probability = $4, version = version + 1
     where tenant_id = $1 and id = $2 and version = $5
     returning id`,
    [tenantId, id, stage, probability, version]
  )
  return updated.rows[0] ? findLead(tx, tenantId, id) : null
}

export async function listLeads(tx: Queryable, tenantId: string, query: ListLeadsQuery): Promise<Page<Lead>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.stage) {
    params.push(query.stage)
    filters += ` and l.stage = $${params.length}`
  }
  if (query.customerId) {
    params.push(query.customerId)
    filters += ` and l.customer_id = $${params.length}`
  }
  if (query.assignedTo) {
    params.push(query.assignedTo)
    filters += ` and l.assigned_to = $${params.length}`
  }
  if (query.q) {
    params.push(`%${query.q.replace(/[\\%_]/g, (character) => `\\${character}`)}%`)
    filters += ` and (l.title ilike $${params.length} or c.name ilike $${params.length})`
  }
  // Keyset conditions run on the wrapped alias columns, so the filters stay inside the inner query.
  const keyset = keysetClauses({
    sortKey: query.sort,
    column: sortColumns[query.sort],
    direction: query.direction,
    cursor: query.cursor,
    params,
  })
  params.push(query.limit + 1)
  const result = await tx.query<LeadRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue}
     from (
       select ${COLUMNS}
       ${FROM}
       where l.tenant_id = $1${filters}
     ) x
     where true${keyset.where}
     order by ${keyset.orderBy}
     limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, query.sort, query.direction)
  return { data: page.data.map(toLead), nextCursor: page.nextCursor }
}

/** Count and expected revenue per stage, over every lead (not just one page). */
export async function stageSummary(tx: Queryable, tenantId: string): Promise<StageSummary[]> {
  const result = await tx.query<{ stage: LeadStage; count: number; expectedRevenueMinor: number }>(
    `select stage, count(*)::bigint as count, coalesce(sum(expected_revenue_minor), 0)::bigint as "expectedRevenueMinor"
     from crm_leads_pipeline where tenant_id = $1 group by stage`,
    [tenantId]
  )
  const byStage = new Map(result.rows.map((row) => [row.stage, row]))
  return leadStages.map((stage) => {
    const row = byStage.get(stage)
    return { stage, count: row ? Number(row.count) : 0, expectedRevenueMinor: row ? row.expectedRevenueMinor : 0 }
  })
}

export async function listLeadsForCustomer(tx: Queryable, tenantId: string, customerId: string, limit: number): Promise<Lead[]> {
  const result = await tx.query<LeadRow>(
    `select ${COLUMNS} ${FROM} where l.tenant_id = $1 and l.customer_id = $2 order by l.created_at desc, l.id desc limit $3`,
    [tenantId, customerId, limit]
  )
  return result.rows.map(toLead)
}

export async function listTeam(tx: Queryable, tenantId: string): Promise<TeamMember[]> {
  const result = await tx.query<TeamMember>(
    `select m.user_id as "userId", coalesce(p.display_name, '') as "displayName", r.name as role
     from tenant_members m
     join roles r on r.tenant_id = m.tenant_id and r.id = m.role_id
     left join profiles p on p.id = m.user_id
     where m.tenant_id = $1
     order by lower(coalesce(nullif(p.display_name, ''), m.user_id::text)), m.user_id`,
    [tenantId]
  )
  return result.rows
}

type StalledLeadRow = {
  leadId: string
  title: string
  stage: OpenLeadStage
  probability: number
  expectedRevenueMinor: number
  daysStalled: number
  customerId: string
  customerName: string
  customerStatus: CustomerStatus
  customerPhone: string | null
  quotationId: string | null
  quoteNumber: string | null
  quotationVersion: number | null
  subtotalMinor: number | null
  totalMinor: number | null
}

const STALLED_LEAD_LIMIT = 500

/** Open leads at or above a probability that have not changed for at least `staleDays`, largest expected revenue first. */
export async function listStalledLeads(
  tx: Queryable,
  tenantId: string,
  criteria: { minProbability: number; staleDays: number }
): Promise<StalledLead[]> {
  const result = await tx.query<StalledLeadRow>(
    `select l.id as "leadId", l.title, l.stage, l.probability, l.expected_revenue_minor as "expectedRevenueMinor",
            floor(extract(epoch from (now() - l.updated_at)) / 86400)::int as "daysStalled",
            l.customer_id as "customerId", c.name as "customerName", c.status as "customerStatus", c.phone as "customerPhone",
            q.id as "quotationId", q.quote_number as "quoteNumber", q.version as "quotationVersion",
            q.subtotal_minor as "subtotalMinor", q.total_minor as "totalMinor"
     from crm_leads_pipeline l
     join customers c on c.tenant_id = l.tenant_id and c.id = l.customer_id
     left join lateral (
       select sq.id, sq.quote_number, sq.version, sq.subtotal_minor, sq.total_minor
       from sales_quotations sq
       where sq.tenant_id = l.tenant_id and sq.lead_id = l.id and sq.status = 'draft'
       order by sq.created_at desc, sq.id desc
       limit 1
     ) q on true
     where l.tenant_id = $1 and l.stage in ('new', 'contacted', 'qualified', 'proposal')
       and l.probability >= $2 and l.updated_at < now() - ($3::int * interval '1 day')
     order by l.expected_revenue_minor desc, l.id
     limit $4`,
    [tenantId, criteria.minProbability, criteria.staleDays, STALLED_LEAD_LIMIT]
  )
  return result.rows.map((row) => ({
    leadId: row.leadId,
    title: row.title,
    stage: row.stage,
    probability: row.probability,
    expectedRevenueMinor: row.expectedRevenueMinor,
    daysStalled: row.daysStalled,
    customerId: row.customerId,
    customerName: row.customerName,
    customerStatus: row.customerStatus,
    customerPhone: row.customerPhone,
    draftQuotation:
      row.quotationId !== null &&
      row.quoteNumber !== null &&
      row.quotationVersion !== null &&
      row.subtotalMinor !== null &&
      row.totalMinor !== null
        ? {
            id: row.quotationId,
            quoteNumber: row.quoteNumber,
            version: row.quotationVersion,
            subtotalMinor: row.subtotalMinor,
            totalMinor: row.totalMinor,
          }
        : null,
  }))
}
