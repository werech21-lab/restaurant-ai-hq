import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'
import { db, withTransaction, type Queryable } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { nextSequenceValue } from '@/lib/sequences'
import {
  assertCanAccept,
  assertCanExpire,
  assertCanSend,
  assertEditable,
  assertTransition,
  assertValidUntil,
  formatQuoteNumber,
  utcDate,
} from '@/modules/crm/domain/quotation'
import type { Quotation, QuotationDetail, QuotationStatus } from '@/modules/crm/domain/types'
import { crmEventBase, publishCrmEvents, type CrmEvent } from '@/modules/crm/events'
import * as customers from '@/modules/crm/repositories/customer-repository'
import * as leads from '@/modules/crm/repositories/lead-repository'
import * as repository from '@/modules/crm/repositories/quotation-repository'
import type { VersionBody } from '@/modules/crm/schemas/common'
import type {
  CreateQuotationInput,
  ListQuotationsQuery,
  QuotationLineInput,
  UpdateQuotationInput,
} from '@/modules/crm/schemas/quotation'
import { computeTotals } from '@/modules/finance/client'
import { findStockShortages, validateStockLines } from '@/modules/inventory'

export type QuotationBody = { data: QuotationDetail }

const CREATE_SCOPE = 'crm.quotation.create'
const SEQUENCE_NAME = 'crm.quotation'

export function versionConflict(): AppError {
  return new AppError(409, 'version_conflict', 'The quotation was changed by someone else. Reload it and try again.')
}

export function quotationNotFound(): AppError {
  return new AppError(404, 'not_found', 'The quotation was not found.')
}

export function today(): string {
  return utcDate(new Date())
}

export async function auditQuotation(
  tx: Queryable,
  auth: AuthContext,
  id: string,
  action: 'create' | 'update',
  before: unknown,
  after: unknown
): Promise<void> {
  await writeAudit(tx, {
    tenantId: auth.tenantId,
    actorId: auth.userId,
    entity: 'quotation',
    entityId: id,
    action,
    before,
    after,
  })
}

/** A quotation that can still be accepted or converted should show whether the stock covers it. */
const SHORTAGE_STATUSES: readonly QuotationStatus[] = ['draft', 'sent', 'accepted']

/**
 * The quotation with its lines. Stock shortages are read live and only for callers allowed to read stock, and only
 * while the quotation is still open, because a converted or closed quotation no longer depends on stock.
 */
export async function loadQuotationDetail(
  tx: Queryable,
  auth: AuthContext,
  quotation: Quotation
): Promise<QuotationDetail> {
  const lines = await repository.listLines(tx, auth.tenantId, quotation.id)
  const readsStock = auth.permissions.has(permissions.inventoryStockRead)
  const stockShortages =
    readsStock && SHORTAGE_STATUSES.includes(quotation.status)
      ? await findStockShortages(tx, auth.tenantId, lines)
      : []
  return { ...quotation, lines, stockShortages }
}

/**
 * Everything a draft needs to be valid before it is saved: an unblocked customer, an open lead of that customer,
 * sellable stock lines and a valid-until date that is not in the past.
 */
async function validateDraft(
  tx: Queryable,
  tenantId: string,
  input: { customerId: string; leadId: string | null; validUntil: string; lines: readonly QuotationLineInput[] }
): Promise<{ customerName: string }> {
  assertValidUntil(input.validUntil, today())
  const customer = await customers.findCustomerRef(tx, tenantId, input.customerId)
  if (!customer) throw new DomainError('customer_not_found', 'The customer does not exist.')
  if (customer.status === 'blocked') throw new DomainError('customer_blocked', 'The customer is blocked.')
  if (input.leadId) {
    const lead = await leads.findLead(tx, tenantId, input.leadId)
    if (!lead) throw new DomainError('lead_not_found', 'The lead does not exist.')
    if (lead.customerId !== input.customerId) {
      throw new DomainError('lead_customer_mismatch', 'The lead belongs to a different customer.')
    }
    if (lead.stage === 'won' || lead.stage === 'lost') {
      throw new DomainError('lead_closed', 'The lead is already closed, so a new quotation cannot be linked to it.')
    }
  }
  await validateStockLines(tx, tenantId, input.lines)
  return { customerName: customer.name }
}

export function listQuotations(auth: AuthContext, query: ListQuotationsQuery): Promise<Page<Quotation>> {
  return repository.listQuotations(db, auth.tenantId, query)
}

export async function getQuotation(auth: AuthContext, id: string): Promise<QuotationBody> {
  const quotation = await repository.findQuotation(db, auth.tenantId, id)
  if (!quotation) throw quotationNotFound()
  return { data: await loadQuotationDetail(db, auth, quotation) }
}

export async function createQuotation(
  auth: AuthContext,
  idempotencyKey: string,
  input: CreateQuotationInput
): Promise<IdempotentResult<QuotationBody>> {
  const events: CrmEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<QuotationBody>(
      tx,
      { tenantId: auth.tenantId, scope: CREATE_SCOPE, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        const { customerName } = await validateDraft(tx, auth.tenantId, input)
        const totals = computeTotals(input.lines)
        const sequence = await nextSequenceValue(tx, auth.tenantId, SEQUENCE_NAME)
        const quotation = await repository.insertQuotation(tx, auth.tenantId, auth.userId, {
          quoteNumber: formatQuoteNumber(sequence),
          customerId: input.customerId,
          customerName,
          leadId: input.leadId,
          validUntil: input.validUntil,
          notes: input.notes,
          ...totals,
        })
        await repository.insertLines(tx, auth.tenantId, auth.userId, quotation.id, input.lines)
        const detail = await loadQuotationDetail(tx, auth, quotation)
        await auditQuotation(tx, auth, quotation.id, 'create', null, detail)
        events.push({
          ...crmEventBase(auth.tenantId),
          name: 'crm.quotation.created',
          payload: {
            quotationId: quotation.id,
            quoteNumber: quotation.quoteNumber,
            customerId: quotation.customerId,
            totalMinor: quotation.totalMinor,
            createdBy: auth.userId,
          },
        })
        return { status: 201, body: { data: detail } }
      }
    )
  )
  if (!outcome.replayed) await publishCrmEvents(events)
  return outcome
}

/** Replaces a draft's header and lines in one transaction. Only a draft can be edited. */
export async function updateQuotation(auth: AuthContext, id: string, input: UpdateQuotationInput): Promise<QuotationBody> {
  const events: CrmEvent[] = []
  const body = await withTransaction(async (tx): Promise<QuotationBody> => {
    const current = await repository.findQuotation(tx, auth.tenantId, id, { lock: true })
    if (!current) throw quotationNotFound()
    if (current.version !== input.version) throw versionConflict()
    assertEditable(current)
    const before = await loadQuotationDetail(tx, auth, current)
    const { customerName } = await validateDraft(tx, auth.tenantId, input)
    const totals = computeTotals(input.lines)
    const updated = await repository.updateDraftHeader(tx, auth.tenantId, id, input.version, {
      quoteNumber: current.quoteNumber,
      customerId: input.customerId,
      customerName,
      leadId: input.leadId,
      validUntil: input.validUntil,
      notes: input.notes,
      ...totals,
    })
    if (!updated) throw versionConflict()
    await repository.deleteLines(tx, auth.tenantId, id)
    await repository.insertLines(tx, auth.tenantId, auth.userId, id, input.lines)
    const after = await loadQuotationDetail(tx, auth, updated)
    await auditQuotation(tx, auth, id, 'update', before, after)
    events.push({
      ...crmEventBase(auth.tenantId),
      name: 'crm.quotation.updated',
      payload: { quotationId: id, quoteNumber: updated.quoteNumber, updatedBy: auth.userId },
    })
    return { data: after }
  })
  await publishCrmEvents(events)
  return body
}

type Decision = {
  to: Exclude<QuotationStatus, 'draft' | 'converted'>
  /** The domain rule for this move, run on the locked quotation before anything changes. */
  check: (quotation: Quotation, today: string) => void
}

async function changeStatus(auth: AuthContext, id: string, input: VersionBody, decision: Decision): Promise<QuotationBody> {
  const events: CrmEvent[] = []
  const body = await withTransaction(async (tx): Promise<QuotationBody> => {
    const current = await repository.findQuotation(tx, auth.tenantId, id, { lock: true })
    if (!current) throw quotationNotFound()
    if (current.version !== input.version) throw versionConflict()
    decision.check(current, today())
    const updated = await repository.applyStatusChange(tx, auth.tenantId, id, input.version, { status: decision.to })
    if (!updated) throw versionConflict()
    const detail = await loadQuotationDetail(tx, auth, updated)
    await auditQuotation(tx, auth, id, 'update', current, updated)
    events.push({
      ...crmEventBase(auth.tenantId),
      name: 'crm.quotation.status_changed',
      payload: {
        quotationId: id,
        quoteNumber: updated.quoteNumber,
        from: current.status,
        to: updated.status,
        changedBy: auth.userId,
      },
    })
    return { data: detail }
  })
  await publishCrmEvents(events)
  return body
}

/** draft to sent. A quotation already past its valid-until date cannot be sent. */
export function sendQuotation(auth: AuthContext, id: string, input: VersionBody): Promise<QuotationBody> {
  return changeStatus(auth, id, input, { to: 'sent', check: assertCanSend })
}

/** sent to accepted: records the customer's decision. It does not create an invoice. */
export function acceptQuotation(auth: AuthContext, id: string, input: VersionBody): Promise<QuotationBody> {
  return changeStatus(auth, id, input, { to: 'accepted', check: assertCanAccept })
}

export function rejectQuotation(auth: AuthContext, id: string, input: VersionBody): Promise<QuotationBody> {
  return changeStatus(auth, id, input, { to: 'rejected', check: (quotation) => assertTransition(quotation.status, 'rejected') })
}

/** sent to expired, only when the valid-until date has really passed. */
export function expireQuotation(auth: AuthContext, id: string, input: VersionBody): Promise<QuotationBody> {
  return changeStatus(auth, id, input, { to: 'expired', check: assertCanExpire })
}
