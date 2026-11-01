import { writeActivity } from '@/lib/activity'
import { checkPermission } from '@/lib/erp-auth'
import { prisma } from '@/lib/db'
import { isModuleEnabled } from '@/lib/modules-db'
import { runTx, txError } from '@/lib/tx'
import { fail, ok } from '@/lib/types'

export type KitchenTicketStatus = 'NEW' | 'PREPARING' | 'READY' | 'BUMPED'

export async function listKitchenTickets(scope?: {
  brandCode?: string | null
  branchCode?: string | null
  warehouseIds?: string[]
}) {
  const openStatuses = ['NEW', 'PREPARING', 'READY']
  return prisma.kitchenTicket.findMany({
    where: {
      status: { in: openStatuses },
      ...(scope?.brandCode ? { brandCode: scope.brandCode } : {}),
      ...(scope?.branchCode ? { branchCode: scope.branchCode } : {}),
      ...(scope?.warehouseIds?.length ? { warehouseId: { in: scope.warehouseIds } } : {}),
    },
    include: { items: { orderBy: { name: 'asc' } } },
    orderBy: { createdAt: 'asc' },
    take: 80,
  })
}

export async function createKitchenTicket(input: {
  invoiceId?: string
  brandCode?: string
  branchCode?: string
  warehouseId?: string
  orderType?: string
  tableNo?: string
  notes?: string
  items: Array<{ productId?: string; name: string; quantity: number; note?: string }>
}) {
  const kdsGate = await checkPermission('kds', 'create')
  const posGate = kdsGate.allowed ? kdsGate : await checkPermission('pos', 'create')
  if (!posGate.allowed || !posGate.user) return fail(posGate.message || 'ممنوع')
  if (!(await isModuleEnabled('kds')) && !(await isModuleEnabled('pos'))) return fail('شاشة المطبخ معطلة')
  if (!input.items.length) return fail('لا أصناف لإرسالها للمطبخ')

  const user = posGate.user
  let ticketId = ''
  const result = await runTx(async (tx) => {
    const count = await tx.kitchenTicket.count()
    const ticketNumber = `KDS-${String(count + 1).padStart(5, '0')}`
    const ticket = await tx.kitchenTicket.create({
      data: {
        ticketNumber,
        invoiceId: input.invoiceId || null,
        brandCode: input.brandCode || null,
        branchCode: input.branchCode || null,
        warehouseId: input.warehouseId || null,
        orderType: input.orderType || 'dine_in',
        tableNo: input.tableNo || '',
        notes: input.notes || '',
        status: 'NEW',
        createdById: user.id,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId || null,
            name: item.name,
            quantity: item.quantity,
            note: item.note || '',
          })),
        },
      },
    })
    ticketId = ticket.id
    await writeActivity(tx, {
      userId: user.id,
      action: 'CREATE',
      module: 'kds',
      details: `تذكرة مطبخ ${ticketNumber}`,
    })
  })
  if (!result.ok) return result
  return { ok: true as const, id: ticketId, message: 'تم إرسال الطلب للمطبخ' }
}

async function kdsWriteGate() {
  const kds = await checkPermission('kds', 'edit')
  if (kds.allowed && kds.user) return kds
  return checkPermission('pos', 'edit')
}

export async function startPrep(ticketId: string) {
  const gate = await kdsWriteGate()
  if (!gate.allowed || !gate.user) return fail(gate.message || 'ممنوع')
  const result = await runTx(async (tx) => {
    const ticket = await tx.kitchenTicket.findUnique({ where: { id: ticketId } })
    if (!ticket) txError('التذكرة غير موجودة')
    if (ticket.status === 'BUMPED') txError('التذكرة مغلقة')
    await tx.kitchenTicket.update({
      where: { id: ticketId },
      data: { status: 'PREPARING', startedAt: ticket.startedAt ?? new Date() },
    })
  })
  return result.ok ? ok('بدء التحضير') : result
}

export async function toggleItemDone(itemId: string, isDone: boolean) {
  const gate = await kdsWriteGate()
  if (!gate.allowed || !gate.user) return fail(gate.message || 'ممنوع')
  await prisma.kitchenTicketItem.update({ where: { id: itemId }, data: { isDone } })
  return ok('تم')
}

export async function markReady(ticketId: string) {
  const gate = await kdsWriteGate()
  if (!gate.allowed || !gate.user) return fail(gate.message || 'ممنوع')
  const result = await runTx(async (tx) => {
    const ticket = await tx.kitchenTicket.findUnique({ where: { id: ticketId }, include: { items: true } })
    if (!ticket) txError('التذكرة غير موجودة')
    await tx.kitchenTicketItem.updateMany({ where: { ticketId }, data: { isDone: true } })
    await tx.kitchenTicket.update({
      where: { id: ticketId },
      data: { status: 'READY', readyAt: new Date(), startedAt: ticket.startedAt ?? new Date() },
    })
  })
  return result.ok ? ok('جاهز') : result
}

export async function bumpTicket(ticketId: string) {
  const gate = await kdsWriteGate()
  if (!gate.allowed || !gate.user) return fail(gate.message || 'ممنوع')
  const result = await runTx(async (tx) => {
    const ticket = await tx.kitchenTicket.findUnique({ where: { id: ticketId } })
    if (!ticket) txError('التذكرة غير موجودة')
    await tx.kitchenTicket.update({
      where: { id: ticketId },
      data: { status: 'BUMPED', readyAt: ticket.readyAt ?? new Date() },
    })
  })
  return result.ok ? ok('تمت الإزالة') : result
}

export async function prepStats(scope?: { brandCode?: string | null; branchCode?: string | null }) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const rows = await prisma.kitchenTicket.findMany({
    where: {
      status: 'BUMPED',
      readyAt: { gte: since },
      startedAt: { not: null },
      ...(scope?.brandCode ? { brandCode: scope.brandCode } : {}),
      ...(scope?.branchCode ? { branchCode: scope.branchCode } : {}),
    },
    select: { createdAt: true, startedAt: true, readyAt: true },
    take: 200,
  })
  if (!rows.length) return { avgPrepMinutes: 0, completed24h: 0 }
  const minutes = rows.map((row) => {
    const start = (row.startedAt ?? row.createdAt).getTime()
    const end = (row.readyAt ?? row.createdAt).getTime()
    return Math.max(0, (end - start) / 60000)
  })
  const avg = minutes.reduce((a, b) => a + b, 0) / minutes.length
  return { avgPrepMinutes: Math.round(avg * 10) / 10, completed24h: rows.length }
}
