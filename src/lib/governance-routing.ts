import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { DomainError } from '@/lib/domain-error'
import { requireIdempotencyKey } from '@/lib/idempotency'
import { createOrder, listPartners } from '@/modules/delivery'
import { archiveSchema, markArchive, stageArchive } from '@/modules/governance'
import type { ArchiveDocument } from '@/modules/governance/client'
import { createExpense, listEmployees } from '@/modules/hr'
import { createContract } from '@/modules/operations'

function plusDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function dispatch(auth: RouteArgs['auth'], key: string, document: ArchiveDocument): Promise<{ status: ArchiveDocument['status']; recordId: string | null }> {
  const today = new Date().toISOString().slice(0, 10)
  if (document.routedToModule === '/erp/hr') {
    if (document.amountMinor < 1) return { status: 'held', recordId: null }
    const employees = await listEmployees(auth)
    const employee = employees.find((item) => item.status === 'active')
    if (!employee) return { status: 'held', recordId: null }
    const expense = await createExpense(auth, key, {
      employeeId: employee.id,
      category: document.documentCategory === 'traffic_fine' ? 'مخالفة مرورية' : 'فاتورة وقود',
      amountMinor: document.amountMinor,
      cash: true,
    })
    return { status: 'routed', recordId: expense.body.data.id }
  }
  if (document.routedToModule === '/erp/contracts') {
    const contract = await createContract(auth, key, {
      title: document.fileName.slice(0, 200),
      counterparty: document.extracted.counterparty.slice(0, 200),
      startDate: today,
      endDate: plusDays(today, 365),
      valueMinor: document.amountMinor,
      renewalAlertDays: 30,
      status: 'active',
    })
    return { status: 'routed', recordId: contract.body.data.id }
  }
  if (document.routedToModule === '/erp/delivery') {
    const partners = await listPartners(auth)
    const partner = partners[0]
    if (!partner) return { status: 'held', recordId: null }
    const order = await createOrder(auth, key, {
      partnerId: partner.id,
      orderedOn: today,
      grossMinor: document.amountMinor,
      commissionMinor: 0,
    })
    return { status: 'routed', recordId: order.body.data.id }
  }
  return { status: 'archived', recordId: null }
}

export async function routeArchive({ request, auth }: RouteArgs): Promise<NextResponse> {
  const key = requireIdempotencyKey(request)
  const input = await parseBody(request, archiveSchema)
  const staged = await stageArchive(auth, key, input)
  const document = staged.body.data
  if (staged.replayed && document.status !== 'pending') {
    return NextResponse.json(staged.body, { status: 200, headers: { 'Idempotent-Replayed': 'true' } })
  }
  try {
    const sent = await dispatch(auth, key, document)
    const updated = await markArchive(auth, document.id, sent.status, sent.recordId)
    return NextResponse.json({ data: updated }, { status: staged.replayed ? 200 : 201 })
  } catch (error) {
    if (error instanceof DomainError && error.code === 'compliance_blocked') {
      await markArchive(auth, document.id, 'blocked', null)
    }
    throw error
  }
}
