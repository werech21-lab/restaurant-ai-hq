import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { db, withTransaction, type Queryable } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { assertLeadEditable, assertStageMove, probabilityAfterMove } from '@/modules/crm/domain/lead'
import type { Lead, StageSummary, TeamMember } from '@/modules/crm/domain/types'
import { crmEventBase, publishCrmEvents, type CrmEvent } from '@/modules/crm/events'
import * as customers from '@/modules/crm/repositories/customer-repository'
import * as repository from '@/modules/crm/repositories/lead-repository'
import type { CreateLeadInput, ListLeadsQuery, MoveLeadInput, UpdateLeadInput } from '@/modules/crm/schemas/lead'

const CREATE_SCOPE = 'crm.lead.create'

type LeadBody = { data: Lead }

function versionConflict(): AppError {
  return new AppError(409, 'version_conflict', 'The lead was changed by someone else. Reload it and try again.')
}

function notFound(): AppError {
  return new AppError(404, 'not_found', 'The lead was not found.')
}

async function audit(
  tx: Queryable,
  auth: AuthContext,
  id: string,
  action: 'create' | 'update',
  before: unknown,
  after: unknown
): Promise<void> {
  await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'lead', entityId: id, action, before, after })
}

export function listLeads(auth: AuthContext, query: ListLeadsQuery): Promise<Page<Lead>> {
  return repository.listLeads(db, auth.tenantId, query)
}

export async function getLead(auth: AuthContext, id: string): Promise<LeadBody> {
  const lead = await repository.findLead(db, auth.tenantId, id)
  if (!lead) throw notFound()
  return { data: lead }
}

export async function getStageSummary(auth: AuthContext): Promise<{ data: StageSummary[] }> {
  return { data: await repository.stageSummary(db, auth.tenantId) }
}

export async function listTeam(auth: AuthContext): Promise<{ data: TeamMember[] }> {
  return { data: await repository.listTeam(db, auth.tenantId) }
}

/** A lead can only be opened for a customer that exists and is not blocked. */
async function requireLeadCustomer(tx: Queryable, tenantId: string, customerId: string): Promise<void> {
  const customer = await customers.findCustomerRef(tx, tenantId, customerId)
  if (!customer) throw new DomainError('customer_not_found', 'The customer does not exist.')
  if (customer.status === 'blocked') throw new DomainError('customer_blocked', 'The customer is blocked.')
}

export async function createLead(
  auth: AuthContext,
  idempotencyKey: string,
  input: CreateLeadInput
): Promise<IdempotentResult<LeadBody>> {
  const events: CrmEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<LeadBody>(
      tx,
      { tenantId: auth.tenantId, scope: CREATE_SCOPE, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        await requireLeadCustomer(tx, auth.tenantId, input.customerId)
        const lead = await repository.insertLead(tx, auth.tenantId, auth.userId, input)
        await audit(tx, auth, lead.id, 'create', null, lead)
        events.push({
          ...crmEventBase(auth.tenantId),
          name: 'crm.lead.created',
          payload: {
            leadId: lead.id,
            customerId: lead.customerId,
            stage: lead.stage,
            expectedRevenueMinor: lead.expectedRevenueMinor,
            createdBy: auth.userId,
          },
        })
        return { status: 201, body: { data: lead } }
      }
    )
  )
  if (!outcome.replayed) await publishCrmEvents(events)
  return outcome
}

export async function updateLead(auth: AuthContext, id: string, input: UpdateLeadInput): Promise<LeadBody> {
  const events: CrmEvent[] = []
  const body = await withTransaction(async (tx): Promise<LeadBody> => {
    const before = await repository.findLead(tx, auth.tenantId, id, { lock: true })
    if (!before) throw notFound()
    if (before.version !== input.version) throw versionConflict()
    assertLeadEditable(before.stage)
    const after = await repository.updateLead(tx, auth.tenantId, id, input)
    if (!after) throw versionConflict()
    await audit(tx, auth, id, 'update', before, after)
    events.push({
      ...crmEventBase(auth.tenantId),
      name: 'crm.lead.updated',
      payload: { leadId: id, customerId: after.customerId, updatedBy: auth.userId },
    })
    return { data: after }
  })
  await publishCrmEvents(events)
  return body
}

/**
 * Moves a lead to another stage. Open stages move freely, won and lost are final. The probability follows: 100 when
 * won, 0 when lost, unchanged between open stages.
 */
export async function moveLead(auth: AuthContext, id: string, input: MoveLeadInput): Promise<LeadBody> {
  const events: CrmEvent[] = []
  const body = await withTransaction(async (tx): Promise<LeadBody> => {
    const before = await repository.findLead(tx, auth.tenantId, id, { lock: true })
    if (!before) throw notFound()
    if (before.version !== input.version) throw versionConflict()
    assertStageMove(before.stage, input.stage)
    const after = await repository.moveLead(
      tx,
      auth.tenantId,
      id,
      input.version,
      input.stage,
      probabilityAfterMove(input.stage, before.probability)
    )
    if (!after) throw versionConflict()
    await audit(tx, auth, id, 'update', before, after)
    events.push({
      ...crmEventBase(auth.tenantId),
      name: 'crm.lead.moved',
      payload: {
        leadId: id,
        customerId: after.customerId,
        fromStage: before.stage,
        toStage: after.stage,
        movedBy: auth.userId,
      },
    })
    if (after.stage === 'won') {
      events.push({
        ...crmEventBase(auth.tenantId),
        name: 'crm.lead.won',
        payload: {
          leadId: id,
          customerId: after.customerId,
          expectedRevenueMinor: after.expectedRevenueMinor,
          quotationId: null,
          wonBy: auth.userId,
        },
      })
    }
    if (after.stage === 'lost') {
      events.push({
        ...crmEventBase(auth.tenantId),
        name: 'crm.lead.lost',
        payload: { leadId: id, customerId: after.customerId, lostBy: auth.userId },
      })
    }
    return { data: after }
  })
  await publishCrmEvents(events)
  return body
}

/**
 * Marks an open lead won as part of a quotation conversion, inside the caller's transaction. A lead that is already
 * won or lost is left alone and null is returned. The caller publishes the events after commit.
 */
export async function winLeadWithin(
  tx: Queryable,
  auth: AuthContext,
  leadId: string,
  quotationId: string,
  events: CrmEvent[]
): Promise<Lead | null> {
  const before = await repository.findLead(tx, auth.tenantId, leadId, { lock: true })
  if (!before) throw notFound()
  if (before.stage === 'won' || before.stage === 'lost') return null
  const after = await repository.moveLead(tx, auth.tenantId, leadId, before.version, 'won', 100)
  if (!after) throw versionConflict()
  await audit(tx, auth, leadId, 'update', before, after)
  events.push(
    {
      ...crmEventBase(auth.tenantId),
      name: 'crm.lead.moved',
      payload: {
        leadId,
        customerId: after.customerId,
        fromStage: before.stage,
        toStage: 'won',
        movedBy: auth.userId,
      },
    },
    {
      ...crmEventBase(auth.tenantId),
      name: 'crm.lead.won',
      payload: {
        leadId,
        customerId: after.customerId,
        expectedRevenueMinor: after.expectedRevenueMinor,
        quotationId,
        wonBy: auth.userId,
      },
    }
  )
  return after
}
