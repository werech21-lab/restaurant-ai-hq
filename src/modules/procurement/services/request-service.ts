import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import type { AuthContext } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'
import { requirePermission, versionConflict } from '@/lib/auth/require'
import { db, withTransaction, type Queryable } from '@/lib/db'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { nextSequenceValue } from '@/lib/sequences'
import { canCancelRequest, isRequestEditable, planConversion } from '@/modules/procurement/domain/request'
import type { PurchaseOrderDetail, PurchaseRequest, PurchaseRequestDetail } from '@/modules/procurement/domain/types'
import { publishProcurementEvents, type ProcurementEvent } from '@/modules/procurement/events'
import * as repository from '@/modules/procurement/repositories/request-repository'
import type {
  ApproveRequestInput,
  CancelRequestInput,
  ConvertRequestInput,
  CreateRequestInput,
  ListRequestsQuery,
  RejectRequestInput,
  SubmitRequestInput,
  UpdateRequestInput,
} from '@/modules/procurement/schemas/request'
import { audit, createDraftOrderWithin, eventBase, requireOrderableItems } from '@/modules/procurement/services/procurement-service'

export type RequestBody = { data: PurchaseRequestDetail }
export type ConvertedRequestBody = { data: PurchaseRequestDetail & { order: PurchaseOrderDetail } }

const CREATE_SCOPE = 'procurement.request.create'
const CONVERT_SCOPE = 'procurement.request.convert'

const requestNotFound = () => new AppError(404, 'request_not_found', 'The purchase request was not found.')

function requestRef(request: PurchaseRequest) {
  return { requestId: request.id, number: request.number }
}

async function lockRequest(tx: Queryable, tenantId: string, id: string, version: number): Promise<PurchaseRequest> {
  const current = await repository.findRequest(tx, tenantId, id, { lock: true })
  if (!current) throw requestNotFound()
  if (current.version !== version) throw versionConflict('purchase request')
  return current
}

async function loadDetail(tx: Queryable, tenantId: string, id: string): Promise<PurchaseRequestDetail> {
  const detail = await repository.findRequestDetail(tx, tenantId, id)
  if (!detail) throw requestNotFound()
  return detail
}

export async function createRequest(auth: AuthContext, idempotencyKey: string, input: CreateRequestInput): Promise<IdempotentResult<RequestBody>> {
  requirePermission(auth, permissions.procurementRequestCreate)
  const events: ProcurementEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<RequestBody>(
      tx,
      { tenantId: auth.tenantId, scope: CREATE_SCOPE, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        await requireOrderableItems(tx, auth.tenantId, input.lines.map((line) => ({ ...line, unitCostMinor: 0, taxRateBps: 0 })))
        const number = await nextSequenceValue(tx, auth.tenantId, 'purchase_request')
        const id = await repository.insertRequest(tx, auth.tenantId, auth.userId, number, input)
        await repository.insertRequestLines(tx, auth.tenantId, auth.userId, id, input.lines)
        const detail = await loadDetail(tx, auth.tenantId, id)
        await audit(tx, auth, 'purchase_request', id, 'create', null, detail)
        events.push({
          ...eventBase(auth),
          name: 'procurement.request.created',
          payload: { ...requestRef(detail), lineCount: detail.lineCount, requestedBy: auth.userId },
        })
        return { status: 201, body: { data: detail } }
      }
    )
  )
  if (!outcome.replayed) await publishProcurementEvents(events)
  return outcome
}

export async function updateRequest(auth: AuthContext, id: string, input: UpdateRequestInput): Promise<RequestBody> {
  requirePermission(auth, permissions.procurementRequestCreate)
  return withTransaction(async (tx) => {
    const current = await lockRequest(tx, auth.tenantId, id, input.version)
    if (!isRequestEditable(current.status)) throw new AppError(409, 'request_not_draft', 'Only a draft purchase request can be edited.')
    const before = await loadDetail(tx, auth.tenantId, id)
    await requireOrderableItems(tx, auth.tenantId, input.lines.map((line) => ({ ...line, unitCostMinor: 0, taxRateBps: 0 })))
    await repository.deleteRequestLines(tx, auth.tenantId, id)
    await repository.insertRequestLines(tx, auth.tenantId, auth.userId, id, input.lines)
    if (!(await repository.updateDraftRequest(tx, auth.tenantId, id, input.version, input))) throw versionConflict('purchase request')
    const after = await loadDetail(tx, auth.tenantId, id)
    await audit(tx, auth, 'purchase_request', id, 'update', before, after)
    return { data: after }
  })
}

export async function submitRequest(auth: AuthContext, id: string, input: SubmitRequestInput): Promise<RequestBody> {
  requirePermission(auth, permissions.procurementRequestSubmit)
  const events: ProcurementEvent[] = []
  const detail = await withTransaction(async (tx) => {
    const current = await lockRequest(tx, auth.tenantId, id, input.version)
    if (current.status !== 'draft') throw new AppError(409, 'request_not_draft', 'Only a draft purchase request can be submitted.')
    const before = await loadDetail(tx, auth.tenantId, id)
    await requireOrderableItems(tx, auth.tenantId, before.lines.map((line) => ({ ...line, unitCostMinor: 0, taxRateBps: 0 })))
    if (!(await repository.submitRequest(tx, auth.tenantId, id, auth.userId, input.version))) throw versionConflict('purchase request')
    const after = await loadDetail(tx, auth.tenantId, id)
    await audit(tx, auth, 'purchase_request', id, 'update', before, after)
    events.push({ ...eventBase(auth), name: 'procurement.request.submitted', payload: { ...requestRef(after), submittedBy: auth.userId } })
    return after
  })
  await publishProcurementEvents(events)
  return { data: detail }
}

export async function approveRequest(auth: AuthContext, id: string, input: ApproveRequestInput): Promise<RequestBody> {
  requirePermission(auth, permissions.procurementRequestApprove)
  const events: ProcurementEvent[] = []
  const detail = await withTransaction(async (tx) => {
    const current = await lockRequest(tx, auth.tenantId, id, input.version)
    if (current.status !== 'submitted') throw new AppError(409, 'request_not_submitted', 'The purchase request is not waiting for a decision.')
    const before = await loadDetail(tx, auth.tenantId, id)
    if (!(await repository.decideRequest(tx, auth.tenantId, id, auth.userId, input.version, { status: 'approved', note: null }))) {
      throw versionConflict('purchase request')
    }
    const after = await loadDetail(tx, auth.tenantId, id)
    await audit(tx, auth, 'purchase_request', id, 'update', before, after)
    events.push({ ...eventBase(auth), name: 'procurement.request.approved', payload: { ...requestRef(after), approvedBy: auth.userId } })
    return after
  })
  await publishProcurementEvents(events)
  return { data: detail }
}

export async function rejectRequest(auth: AuthContext, id: string, input: RejectRequestInput): Promise<RequestBody> {
  requirePermission(auth, permissions.procurementRequestApprove)
  const events: ProcurementEvent[] = []
  const detail = await withTransaction(async (tx) => {
    const current = await lockRequest(tx, auth.tenantId, id, input.version)
    if (current.status !== 'submitted') throw new AppError(409, 'request_not_submitted', 'The purchase request is not waiting for a decision.')
    const before = await loadDetail(tx, auth.tenantId, id)
    if (!(await repository.decideRequest(tx, auth.tenantId, id, auth.userId, input.version, { status: 'rejected', note: input.note }))) {
      throw versionConflict('purchase request')
    }
    const after = await loadDetail(tx, auth.tenantId, id)
    await audit(tx, auth, 'purchase_request', id, 'update', before, after)
    events.push({
      ...eventBase(auth),
      name: 'procurement.request.rejected',
      payload: { ...requestRef(after), rejectedBy: auth.userId, note: input.note },
    })
    return after
  })
  await publishProcurementEvents(events)
  return { data: detail }
}

export async function cancelRequest(auth: AuthContext, id: string, input: CancelRequestInput): Promise<RequestBody> {
  requirePermission(auth, permissions.procurementRequestCancel)
  const events: ProcurementEvent[] = []
  const detail = await withTransaction(async (tx) => {
    const current = await lockRequest(tx, auth.tenantId, id, input.version)
    if (!canCancelRequest(current.status)) throw new AppError(409, 'request_not_cancellable', 'This purchase request can no longer be cancelled.')
    const before = await loadDetail(tx, auth.tenantId, id)
    if (!(await repository.cancelRequest(tx, auth.tenantId, id, auth.userId, input.version, input.reason))) throw versionConflict('purchase request')
    const after = await loadDetail(tx, auth.tenantId, id)
    await audit(tx, auth, 'purchase_request', id, 'update', before, after)
    events.push({
      ...eventBase(auth),
      name: 'procurement.request.cancelled',
      payload: { ...requestRef(after), cancelledBy: auth.userId, reason: input.reason },
    })
    return after
  })
  await publishProcurementEvents(events)
  return { data: detail }
}

/**
 * Turns an approved request into a draft purchase order in one transaction: the order, the link back to the request and the
 * audit rows commit together or not at all. The order then follows the normal submit and approval rules.
 */
export async function convertRequest(
  auth: AuthContext,
  id: string,
  idempotencyKey: string,
  input: ConvertRequestInput
): Promise<IdempotentResult<ConvertedRequestBody>> {
  requirePermission(auth, permissions.procurementRequestConvert)
  requirePermission(auth, permissions.procurementOrderCreate)
  const events: ProcurementEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<ConvertedRequestBody>(
      tx,
      { tenantId: auth.tenantId, scope: `${CONVERT_SCOPE}:${id}`, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        const current = await lockRequest(tx, auth.tenantId, id, input.version)
        if (current.status !== 'approved') throw new AppError(409, 'request_not_approved', 'Only an approved purchase request can become an order.')
        const before = await loadDetail(tx, auth.tenantId, id)
        const lines = planConversion(before.lines, input.lines)
        const order = await createDraftOrderWithin(
          tx,
          auth,
          { supplierId: input.supplierId, orderDate: input.orderDate, expectedDate: input.expectedDate, notes: input.notes, lines },
          events
        )
        if (!(await repository.convertRequest(tx, auth.tenantId, id, auth.userId, input.version, order.id))) throw versionConflict('purchase request')
        const after = await loadDetail(tx, auth.tenantId, id)
        await audit(tx, auth, 'purchase_request', id, 'update', before, after)
        events.push({
          ...eventBase(auth),
          name: 'procurement.request.converted',
          payload: { ...requestRef(after), orderId: order.id, orderNumber: order.number, convertedBy: auth.userId },
        })
        return { status: 201, body: { data: { ...after, order } } }
      }
    )
  )
  if (!outcome.replayed) await publishProcurementEvents(events)
  return outcome
}

export async function listRequests(auth: AuthContext, query: ListRequestsQuery): Promise<Page<PurchaseRequest>> {
  requirePermission(auth, permissions.procurementRequestRead)
  return repository.listRequests(db, auth.tenantId, query)
}

export async function getRequest(auth: AuthContext, id: string): Promise<RequestBody> {
  requirePermission(auth, permissions.procurementRequestRead)
  const detail = await repository.findRequestDetail(db, auth.tenantId, id)
  if (!detail) throw requestNotFound()
  return { data: detail }
}