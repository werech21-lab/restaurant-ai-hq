import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'
import { db, withTransaction, type Queryable } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { assertCanDecide, isRestockStale, missingPermissions } from '@/modules/ai/domain/approval'
import { formatBps, formatCount, formatKwd, leadFollowupText, paymentReminderText, scenarioExecutedText, toDraftMessage, unitLabelAr } from '@/modules/ai/domain/messages'
import { evaluateCostScenarios } from '@/modules/ai/domain/scenarios'
import type { ScenarioOptionKey } from '@/modules/ai/domain/types'
import type { Approval, ExecutionResult } from '@/modules/ai/domain/types'
import { aiEventBase, publishAiEvents, type AiEvent } from '@/modules/ai/events'
import * as repository from '@/modules/ai/repositories/ai-repository'
import type { DecideApprovalBody, ListApprovalsQuery } from '@/modules/ai/schemas/ai'
import { gatherCostScenario } from '@/modules/ai/services/cost-signals'
import {
  autoReorderPayloadSchema,
  customerOverduePayloadSchema,
  discountPayloadSchema,
  leadFollowupPayloadSchema,
  priceAdjustmentPayloadSchema,
  scenarioPayloadSchema,
} from '@/modules/ai/schemas/payloads'
import {
  applyDraftDiscountWithin,
  findCustomerContact,
  findLeadWithin,
  holdCustomerWithin,
  publishCrmEvents,
  type CrmEvent,
} from '@/modules/crm'
import { getCustomerFinancials, getInvoiceBalances } from '@/modules/finance'
import {
  findItemWithin,
  publishInventoryEvents,
  receiveRestockWithin,
  setSellingPriceWithin,
  type InventoryEvent,
} from '@/modules/inventory'

export type ApprovalBody = { data: Approval }

const APPROVE_SCOPE = 'ai.approval.approve'

/** Everything an execution can emit. Each module's events are published by that module, after the transaction commits. */
type EventSink = { ai: AiEvent[]; inventory: InventoryEvent[]; crm: CrmEvent[] }

/** The route checks this too. The service repeats it so no other caller (a job, another module) can decide a request without it. */
function requireApprover(auth: AuthContext): void {
  if (!auth.permissions.has(permissions.aiActionApprove)) {
    throw new AppError(403, 'forbidden', 'You do not have permission to decide AI requests.')
  }
}

function notFound(): AppError {
  return new AppError(404, 'not_found', 'The request was not found.')
}

function versionConflict(): AppError {
  return new AppError(409, 'version_conflict', 'The request was changed by someone else. Reload it and try again.')
}

function stale(message: string): DomainError {
  return new DomainError('proposal_stale', message)
}

async function publishAll(sink: EventSink): Promise<void> {
  await publishInventoryEvents(sink.inventory)
  await publishCrmEvents(sink.crm)
  await publishAiEvents(sink.ai)
}

// ---- executors ----
// Each executor re-reads the live state, refuses with 409 `proposal_stale` when the request no longer fits it, and otherwise
// runs the real domain operation on the caller's transaction. A failure anywhere rolls the whole approval back.

async function executeReorder(tx: Queryable, auth: AuthContext, approval: Approval, sink: EventSink): Promise<ExecutionResult> {
  const payload = autoReorderPayloadSchema.parse(approval.payloadJson)
  const item = await findItemWithin(tx, auth.tenantId, payload.itemId, true)
  if (item === null) throw stale('The item no longer exists.')
  if (isRestockStale(item.currentStock, payload.targetStock)) {
    throw stale('The stock already reached the level this restock aimed for.')
  }
  if (item.unitCostMinor !== payload.unitCostMinor) {
    throw stale('The unit cost changed after this request was made. Run a new scan.')
  }
  const movement = await receiveRestockWithin(
    tx,
    auth,
    {
      itemId: payload.itemId,
      warehouseId: payload.warehouseId,
      quantity: payload.quantity,
      referenceId: approval.id,
      note: 'توريد معتمد من الذكاء الاصطناعي',
    },
    sink.inventory
  )
  const unit = unitLabelAr(item.unit)
  return {
    summaryAr:
      `سُجّل استلام ${formatCount(payload.quantity)} ${unit} من ${item.name} في المستودع ${payload.warehouseCode} ` +
      `بتكلفة ${formatKwd(payload.totalCostMinor)}. رصيد الصنف صار ${formatCount(item.currentStock + payload.quantity)} ${unit}.`,
    refs: [
      { type: 'stock_movement', id: movement.id },
      { type: 'item', id: item.id },
    ],
    message: null,
  }
}

async function executeCreditHold(tx: Queryable, auth: AuthContext, approval: Approval, sink: EventSink): Promise<ExecutionResult> {
  const payload = customerOverduePayloadSchema.parse(approval.payloadJson)
  const financials = await getCustomerFinancials(tx, auth.tenantId, payload.customerId)
  if (financials.overdueMinor <= 0) throw stale('The customer has no overdue balance any more.')
  const customer = await holdCustomerWithin(tx, auth, payload.customerId, sink.crm)
  return {
    summaryAr: `حُظر العميل ${customer.name}. المتأخر الحالي ${formatKwd(financials.overdueMinor)}. يُرفع الحظر يدويًا من إدارة العملاء.`,
    refs: [{ type: 'customer', id: customer.id }],
    message: null,
  }
}

async function executePriceAdjustment(tx: Queryable, auth: AuthContext, approval: Approval, sink: EventSink): Promise<ExecutionResult> {
  const payload = priceAdjustmentPayloadSchema.parse(approval.payloadJson)
  const item = await findItemWithin(tx, auth.tenantId, payload.itemId, true)
  if (item === null) throw stale('The item no longer exists.')
  if (item.unitCostMinor !== payload.unitCostMinor) {
    throw stale('The unit cost changed after this request was made. Run a new scan.')
  }
  const updated = await setSellingPriceWithin(
    tx,
    auth,
    { itemId: payload.itemId, expectedPriceMinor: payload.currentPriceMinor, newPriceMinor: payload.newPriceMinor },
    sink.inventory
  )
  return {
    summaryAr:
      `رُفع سعر بيع ${updated.name} من ${formatKwd(payload.currentPriceMinor)} إلى ${formatKwd(payload.newPriceMinor)} ` +
      `ليبلغ الهامش ${formatBps(payload.newMarginBps)}%.`,
    refs: [{ type: 'item', id: updated.id }],
    message: null,
  }
}

async function executeDiscount(tx: Queryable, auth: AuthContext, approval: Approval, sink: EventSink): Promise<ExecutionResult> {
  const payload = discountPayloadSchema.parse(approval.payloadJson)
  const body = await applyDraftDiscountWithin(
    tx,
    auth,
    { quotationId: payload.quotationId, discountBps: payload.discountBps, expectedVersion: payload.quotationVersion },
    sink.crm
  )
  return {
    summaryAr:
      `خُفّضت أسعار بنود ${body.data.quoteNumber} بنسبة ${formatBps(payload.discountBps)}%. ` +
      `الإجمالي الجديد ${formatKwd(body.data.totalMinor)} بعد أن كان ${formatKwd(payload.subtotalMinor)} قبل الضريبة.`,
    refs: [{ type: 'quotation', id: body.data.id }],
    message: null,
  }
}

/** The customer's phone, only when the approver may read customers. Without it the message has no WhatsApp link. */
async function phoneOf(tx: Queryable, auth: AuthContext, customerId: string): Promise<{ name: string | null; phone: string | null }> {
  if (!auth.permissions.has(permissions.crmCustomerRead)) return { name: null, phone: null }
  const contact = await findCustomerContact(tx, auth.tenantId, customerId)
  return contact === null ? { name: null, phone: null } : { name: contact.name, phone: contact.phone }
}

async function executeReminder(tx: Queryable, auth: AuthContext, approval: Approval): Promise<ExecutionResult> {
  const payload = customerOverduePayloadSchema.parse(approval.payloadJson)
  const balances = await getInvoiceBalances(
    tx,
    auth.tenantId,
    payload.invoices.map((invoice) => invoice.id)
  )
  const byId = new Map(balances.map((balance) => [balance.id, balance]))
  for (const invoice of payload.invoices) {
    const current = byId.get(invoice.id)
    const open = current !== undefined && (current.status === 'issued' || current.status === 'partially_paid')
    if (!open || current.balanceMinor <= 0) throw stale(`Invoice ${invoice.number} is no longer open.`)
    if (current.balanceMinor !== invoice.balanceMinor) {
      throw stale(`Invoice ${invoice.number} changed after this request was made. Run a new scan.`)
    }
  }
  const contact = await phoneOf(tx, auth, payload.customerId)
  const text = paymentReminderText({
    customerName: contact.name ?? payload.customerName,
    overdueMinor: payload.overdueMinor,
    invoices: payload.invoices.map((invoice) => ({
      number: invoice.number,
      balanceMinor: invoice.balanceMinor,
      daysOverdue: invoice.daysOverdue,
    })),
    overdueInvoiceCount: payload.overdueInvoiceCount,
  })
  const message = toDraftMessage(text, contact.phone)
  return {
    summaryAr: message.whatsappUrl
      ? 'الرسالة جاهزة. لم يُرسل شيء تلقائيًا: انسخها أو افتح واتساب لإرسالها.'
      : 'الرسالة جاهزة للنسخ. لا يوجد رقم هاتف صالح للعميل، ولم يُرسل شيء تلقائيًا.',
    refs: [{ type: 'customer', id: payload.customerId }],
    message,
  }
}

async function executeFollowup(tx: Queryable, auth: AuthContext, approval: Approval): Promise<ExecutionResult> {
  const payload = leadFollowupPayloadSchema.parse(approval.payloadJson)
  const lead = await findLeadWithin(tx, auth.tenantId, payload.leadId)
  if (lead === null) throw stale('The lead no longer exists.')
  if (lead.stage === 'won' || lead.stage === 'lost') throw stale('The lead is already closed.')
  const contact = await phoneOf(tx, auth, payload.customerId)
  const text = leadFollowupText({ customerName: contact.name ?? payload.customerName, leadTitle: payload.leadTitle })
  const message = toDraftMessage(text, contact.phone)
  return {
    summaryAr: message.whatsappUrl
      ? 'رسالة المتابعة جاهزة. لم يُرسل شيء تلقائيًا: انسخها أو افتح واتساب لإرسالها.'
      : 'رسالة المتابعة جاهزة للنسخ. لا يوجد رقم هاتف صالح للعميل، ولم يُرسل شيء تلقائيًا.',
    refs: [
      { type: 'lead', id: payload.leadId },
      { type: 'customer', id: payload.customerId },
    ],
    message,
  }
}

async function executeScenario(tx: Queryable, auth: AuthContext, approval: Approval, optionKey: ScenarioOptionKey | undefined): Promise<ExecutionResult> {
  if (!optionKey) throw new AppError(422, 'validation_failed', 'Choose one of the three options before approving.')
  const payload = scenarioPayloadSchema.parse(approval.payloadJson)
  const chosen = payload.options.find((option) => option.key === optionKey)
  if (!chosen) throw stale('That option is no longer on this request.')
  const fresh = evaluateCostScenarios(await gatherCostScenario(tx, auth.tenantId), 1)
  const live = fresh[0]?.proposal?.payload
  const parsed = live ? scenarioPayloadSchema.safeParse(live) : null
  const current = parsed?.success ? parsed.data.options.find((option) => option.key === optionKey) : undefined
  if (!current || current.impactMinor !== chosen.impactMinor) throw stale('The amounts on this scenario have changed. Scan again before deciding.')
  return {
    summaryAr: scenarioExecutedText(chosen.titleAr, chosen.impactMinor),
    refs: [],
    message: null,
  }
}

async function execute(tx: Queryable, auth: AuthContext, approval: Approval, sink: EventSink, optionKey: ScenarioOptionKey | undefined): Promise<ExecutionResult> {
  switch (approval.actionType) {
    case 'auto_reorder':
      return executeReorder(tx, auth, approval, sink)
    case 'credit_hold':
      return executeCreditHold(tx, auth, approval, sink)
    case 'price_adjustment':
      return executePriceAdjustment(tx, auth, approval, sink)
    case 'discount_approval':
      return executeDiscount(tx, auth, approval, sink)
    case 'payment_reminder':
      return executeReminder(tx, auth, approval)
    case 'lead_followup':
      return executeFollowup(tx, auth, approval)
    case 'scenario_choice':
      return executeScenario(tx, auth, approval, optionKey)
  }
}

// ---- use cases ----

/**
 * "اعتماد وتنفيذ". Locks the request, checks its version and that it is still pending, checks the approver also holds the
 * permission of the underlying action, runs the domain operation, and marks the request executed, all in one transaction
 * with audit rows. The Idempotency-Key makes a retry return the stored result instead of acting twice.
 */
export async function approveApproval(
  auth: AuthContext,
  id: string,
  idempotencyKey: string,
  input: DecideApprovalBody
): Promise<IdempotentResult<ApprovalBody>> {
  requireApprover(auth)
  const sink: EventSink = { ai: [], inventory: [], crm: [] }
  const outcome = await withTransaction((tx) =>
    runIdempotent<ApprovalBody>(
      tx,
      { tenantId: auth.tenantId, scope: APPROVE_SCOPE, key: idempotencyKey, requestHash: hashRequest({ id, ...input }) },
      async () => {
        const approval = await repository.findApproval(tx, auth.tenantId, id, { lock: true })
        if (approval === null) throw notFound()
        if (approval.version !== input.version) throw versionConflict()
        assertCanDecide(approval.status)
        const missing = missingPermissions(approval.actionType, auth.permissions)
        if (missing.length > 0) {
          throw new AppError(403, 'forbidden', `This action also needs: ${missing.join(', ')}.`)
        }
        const result = await execute(tx, auth, approval, sink, input.optionKey)
        const updated = await repository.markExecuted(tx, auth.tenantId, id, input.version, auth.userId, input.note, result)
        if (updated === null) throw versionConflict()
        await writeAudit(tx, {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          entity: 'ai_action_approval',
          entityId: id,
          action: 'update',
          before: approval,
          after: updated,
        })
        sink.ai.push({
          ...aiEventBase(auth.tenantId),
          name: 'ai.approval.executed',
          payload: { approvalId: id, actionType: approval.actionType, executedBy: auth.userId },
        })
        return { status: 200, body: { data: updated } }
      }
    )
  )
  if (!outcome.replayed) await publishAll(sink)
  return outcome
}

/** "رفض". Records the executive's refusal. Nothing else changes. */
export async function rejectApproval(auth: AuthContext, id: string, input: DecideApprovalBody): Promise<ApprovalBody> {
  requireApprover(auth)
  const events: AiEvent[] = []
  const body = await withTransaction(async (tx): Promise<ApprovalBody> => {
    const approval = await repository.findApproval(tx, auth.tenantId, id, { lock: true })
    if (approval === null) throw notFound()
    if (approval.version !== input.version) throw versionConflict()
    assertCanDecide(approval.status)
    const updated = await repository.markRejected(tx, auth.tenantId, id, input.version, auth.userId, input.note)
    if (updated === null) throw versionConflict()
    await writeAudit(tx, {
      tenantId: auth.tenantId,
      actorId: auth.userId,
      entity: 'ai_action_approval',
      entityId: id,
      action: 'update',
      before: approval,
      after: updated,
    })
    events.push({
      ...aiEventBase(auth.tenantId),
      name: 'ai.approval.rejected',
      payload: { approvalId: id, actionType: approval.actionType, rejectedBy: auth.userId },
    })
    return { data: updated }
  })
  await publishAiEvents(events)
  return body
}

export function listApprovals(auth: AuthContext, query: ListApprovalsQuery): Promise<Page<Approval>> {
  return repository.listApprovals(db, auth.tenantId, query)
}

export async function getApproval(auth: AuthContext, id: string): Promise<ApprovalBody> {
  const approval = await repository.findApproval(db, auth.tenantId, id)
  if (approval === null) throw notFound()
  return { data: approval }
}
