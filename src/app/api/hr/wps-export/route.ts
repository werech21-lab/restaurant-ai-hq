import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/erp-auth'
import { can } from '@/lib/permissions'
import { toErrorResponse } from '@/lib/api/route'
import { buildNbkWpsExport, postPayrollJournal } from '@/services/hr-wps-export.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !can(user, 'hr', 'view')) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'HR access required' } }, { status: 403 })
    }
    const month = Number(request.nextUrl.searchParams.get('month')) || new Date().getMonth() + 1
    const year = Number(request.nextUrl.searchParams.get('year')) || new Date().getFullYear()
    const pack = await buildNbkWpsExport(month, year)
    if (request.nextUrl.searchParams.get('download') === '1') {
      return new NextResponse(pack.csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${pack.fileName}"`,
        },
      })
    }
    return NextResponse.json({ data: pack })
  } catch (error) {
    return toErrorResponse(error, request)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || (!can(user, 'hr', 'edit') && !can(user, 'accounting', 'create') && !user.role.isAdmin)) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'HR/Accounting permission required' } }, { status: 403 })
    }
    const body = (await request.json()) as { month?: number; year?: number; action?: string }
    const month = Number(body.month) || new Date().getMonth() + 1
    const year = Number(body.year) || new Date().getFullYear()
    if (body.action === 'post') {
      const result = await postPayrollJournal({ month, year, actorId: user.id })
      return NextResponse.json({ data: result })
    }
    const pack = await buildNbkWpsExport(month, year)
    return NextResponse.json({ data: pack })
  } catch (error) {
    return toErrorResponse(error, request)
  }
}
