import type { Queryable } from '@/lib/db'
import type { Contract, EnterpriseDocument, QualityTicket } from '@/modules/operations/domain/types'
import type { CreateContractInput, CreateDocumentInput, CreateTicketInput, UpdateContractInput, UpdateTicketInput } from '@/modules/operations/schemas/operations'

const CONTRACT = `id, title, counterparty, start_date::text as "startDate", end_date::text as "endDate",
  value_minor::bigint as "valueMinor", renewal_alert_days as "renewalAlertDays", status,
  (status = 'active' and end_date - renewal_alert_days <= current_date) as "renewalDue", version`

function contract(row: Contract): Contract {
  return { ...row, valueMinor: Number(row.valueMinor), renewalAlertDays: Number(row.renewalAlertDays) }
}

export async function listContracts(tx: Queryable, tenantId: string): Promise<Contract[]> {
  const result = await tx.query<Contract>(`select ${CONTRACT} from enterprise_contracts where tenant_id = $1 order by end_date limit 100`, [tenantId])
  return result.rows.map(contract)
}

export async function insertContract(tx: Queryable, tenantId: string, actorId: string, input: CreateContractInput): Promise<Contract> {
  const result = await tx.query<Contract>(
    `insert into enterprise_contracts (tenant_id, title, counterparty, start_date, end_date, value_minor, renewal_alert_days, status, created_by)
     values ($1, $2, $3, $4::date, $5::date, $6, $7, $8, $9) returning ${CONTRACT}`,
    [tenantId, input.title, input.counterparty, input.startDate, input.endDate, input.valueMinor, input.renewalAlertDays, input.status, actorId],
  )
  return contract(result.rows[0])
}

export async function updateContract(tx: Queryable, tenantId: string, id: string, input: UpdateContractInput): Promise<Contract | null> {
  const result = await tx.query<Contract>(
    `update enterprise_contracts set title = $3, counterparty = $4, start_date = $5::date, end_date = $6::date,
       value_minor = $7, renewal_alert_days = $8, status = $9, version = version + 1
     where tenant_id = $1 and id = $2 and version = $10 returning ${CONTRACT}`,
    [tenantId, id, input.title, input.counterparty, input.startDate, input.endDate, input.valueMinor, input.renewalAlertDays, input.status, input.version],
  )
  return result.rows[0] ? contract(result.rows[0]) : null
}

export async function listDocuments(tx: Queryable, tenantId: string): Promise<EnterpriseDocument[]> {
  const result = await tx.query<EnterpriseDocument>(
    `select id, contract_id as "contractId", title, category, issued_on::text as "issuedOn"
     from enterprise_documents where tenant_id = $1 order by issued_on desc limit 100`,
    [tenantId],
  )
  return result.rows
}

export async function insertDocument(tx: Queryable, tenantId: string, actorId: string, input: CreateDocumentInput): Promise<EnterpriseDocument> {
  const result = await tx.query<EnterpriseDocument>(
    `insert into enterprise_documents (tenant_id, contract_id, title, category, issued_on, created_by)
     values ($1, $2, $3, $4, $5::date, $6)
     returning id, contract_id as "contractId", title, category, issued_on::text as "issuedOn"`,
    [tenantId, input.contractId, input.title, input.category, input.issuedOn, actorId],
  )
  return result.rows[0]
}

export async function listTickets(tx: Queryable, tenantId: string): Promise<QualityTicket[]> {
  const result = await tx.query<QualityTicket>(
    `select id, type, branch_id as "branchId", asset_name as "assetName", severity, cost_minor::bigint as "costMinor", status, version
     from quality_maintenance_tickets where tenant_id = $1 order by created_at desc limit 100`,
    [tenantId],
  )
  return result.rows.map((row) => ({ ...row, costMinor: Number(row.costMinor) }))
}

export async function insertTicket(tx: Queryable, tenantId: string, actorId: string, input: CreateTicketInput): Promise<QualityTicket> {
  const result = await tx.query<QualityTicket>(
    `insert into quality_maintenance_tickets (tenant_id, type, branch_id, asset_name, severity, cost_minor, status, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, type, branch_id as "branchId", asset_name as "assetName", severity, cost_minor::bigint as "costMinor", status, version`,
    [tenantId, input.type, input.branchId, input.assetName, input.severity, input.costMinor, input.status, actorId],
  )
  return { ...result.rows[0], costMinor: Number(result.rows[0].costMinor) }
}

export async function updateTicket(tx: Queryable, tenantId: string, id: string, input: UpdateTicketInput): Promise<QualityTicket | null> {
  const result = await tx.query<QualityTicket>(
    `update quality_maintenance_tickets set severity = $3, cost_minor = $4, status = $5, version = version + 1
     where tenant_id = $1 and id = $2 and version = $6
     returning id, type, branch_id as "branchId", asset_name as "assetName", severity, cost_minor::bigint as "costMinor", status, version`,
    [tenantId, id, input.severity, input.costMinor, input.status, input.version],
  )
  return result.rows[0] ? { ...result.rows[0], costMinor: Number(result.rows[0].costMinor) } : null
}
