import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { versionConflict } from '@/lib/auth/require'
import { withTransaction } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { recordMovementWithin } from '@/modules/admin'
import type { Contract, EnterpriseDocument, QualityTicket } from '@/modules/operations/domain/types'
import * as repository from '@/modules/operations/repositories/operations-repository'
import type { CreateContractInput, CreateDocumentInput, CreateTicketInput, UpdateContractInput, UpdateTicketInput } from '@/modules/operations/schemas/operations'

function dates(start: string, end: string): void {
  if (end < start) throw new DomainError('invalid_date', 'The end date cannot be earlier than the start date.')
}

export function listContracts(auth: AuthContext): Promise<Contract[]> {
  return withTransaction((tx) => repository.listContracts(tx, auth.tenantId))
}

export async function createContract(auth: AuthContext, key: string, input: CreateContractInput): Promise<IdempotentResult<{ data: Contract }>> {
  dates(input.startDate, input.endDate)
  return withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'ops.contract.create', key, requestHash: hashRequest(input) }, async () => {
      const contract = await repository.insertContract(tx, auth.tenantId, auth.userId, input)
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'enterprise_contract', entityId: contract.id, action: 'create', before: null, after: contract })
      await recordMovementWithin(tx, auth, { module: 'operations', actionType: 'create', entityType: 'enterprise_contract', entityId: contract.id, descriptionAr: `إضافة عقد ${contract.title}`, amountMinor: contract.valueMinor })
      return { status: 201 as const, body: { data: contract } }
    }),
  )
}

export async function updateContract(auth: AuthContext, id: string, input: UpdateContractInput): Promise<{ data: Contract }> {
  dates(input.startDate, input.endDate)
  return withTransaction(async (tx) => {
    const contract = await repository.updateContract(tx, auth.tenantId, id, input)
    if (!contract) throw versionConflict('contract')
    await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'enterprise_contract', entityId: id, action: 'update', before: null, after: contract })
    await recordMovementWithin(tx, auth, { module: 'operations', actionType: 'update', entityType: 'enterprise_contract', entityId: id, descriptionAr: `تحديث عقد ${contract.title}`, amountMinor: contract.valueMinor })
    return { data: contract }
  })
}

export function listDocuments(auth: AuthContext): Promise<EnterpriseDocument[]> {
  return withTransaction((tx) => repository.listDocuments(tx, auth.tenantId))
}

export async function createDocument(auth: AuthContext, key: string, input: CreateDocumentInput): Promise<IdempotentResult<{ data: EnterpriseDocument }>> {
  return withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'ops.document.create', key, requestHash: hashRequest(input) }, async () => {
      let document: EnterpriseDocument
      try {
        document = await repository.insertDocument(tx, auth.tenantId, auth.userId, input)
      } catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : null
        if (code === '23503') throw new AppError(422, 'contract_not_found', 'The document must belong to a contract of this company.')
        throw error
      }
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'enterprise_document', entityId: document.id, action: 'create', before: null, after: document })
      await recordMovementWithin(tx, auth, { module: 'operations', actionType: 'create', entityType: 'enterprise_document', entityId: document.id, descriptionAr: `إضافة مستند ${document.title}` })
      return { status: 201 as const, body: { data: document } }
    }),
  )
}

export function listTickets(auth: AuthContext): Promise<QualityTicket[]> {
  return withTransaction((tx) => repository.listTickets(tx, auth.tenantId))
}

export async function createTicket(auth: AuthContext, key: string, input: CreateTicketInput): Promise<IdempotentResult<{ data: QualityTicket }>> {
  return withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'ops.ticket.create', key, requestHash: hashRequest(input) }, async () => {
      const ticket = await repository.insertTicket(tx, auth.tenantId, auth.userId, input)
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'quality_ticket', entityId: ticket.id, action: 'create', before: null, after: ticket })
      await recordMovementWithin(tx, auth, { module: 'operations', actionType: 'create', entityType: 'quality_ticket', entityId: ticket.id, descriptionAr: `تذكرة ${ticket.assetName}`, amountMinor: ticket.costMinor })
      return { status: 201 as const, body: { data: ticket } }
    }),
  )
}

export async function updateTicket(auth: AuthContext, id: string, input: UpdateTicketInput): Promise<{ data: QualityTicket }> {
  return withTransaction(async (tx) => {
    const ticket = await repository.updateTicket(tx, auth.tenantId, id, input)
    if (!ticket) throw versionConflict('ticket')
    await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'quality_ticket', entityId: id, action: 'update', before: null, after: ticket })
    await recordMovementWithin(tx, auth, { module: 'operations', actionType: 'update', entityType: 'quality_ticket', entityId: id, descriptionAr: `تحديث تذكرة ${ticket.assetName}`, amountMinor: ticket.costMinor })
    return { data: ticket }
  })
}
