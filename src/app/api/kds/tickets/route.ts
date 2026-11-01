import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/erp-auth'
import { can } from '@/lib/permissions'
import { getActiveScope } from '@/lib/scope'
import { listKitchenTickets, prepStats } from '@/services/kds.service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireUser()
    if (!can(user, 'kds', 'view') && !can(user, 'pos', 'view')) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'ممنوع' } }, { status: 403 })
    }
    const scope = await getActiveScope()
    const filter = {
      brandCode: scope.brandId,
      branchCode: scope.branchId,
      warehouseIds: scope.warehouseIds,
    }
    const [tickets, stats] = await Promise.all([listKitchenTickets(filter), prepStats(filter)])
    return NextResponse.json({
      data: {
        tickets: tickets.map((ticket) => ({
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          brandCode: ticket.brandCode,
          branchCode: ticket.branchCode,
          orderType: ticket.orderType,
          tableNo: ticket.tableNo,
          status: ticket.status,
          notes: ticket.notes,
          createdAt: ticket.createdAt.toISOString(),
          startedAt: ticket.startedAt?.toISOString() ?? null,
          readyAt: ticket.readyAt?.toISOString() ?? null,
          items: ticket.items.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            note: item.note,
            isDone: item.isDone,
          })),
        })),
        stats,
        scopeLabelAr: scope.labelAr,
        scopeLabelEn: scope.labelEn,
      },
    })
  } catch {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'مطلوب تسجيل الدخول' } }, { status: 401 })
  }
}
