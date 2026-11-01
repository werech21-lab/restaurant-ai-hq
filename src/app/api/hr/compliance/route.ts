import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/erp-auth'
import { can } from '@/lib/permissions'
import { toErrorResponse } from '@/lib/api/route'
import { buildComplianceRadar, ensureComplianceBaselines } from '@/services/hr-compliance.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !can(user, 'hr', 'view')) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'HR access required' } }, { status: 403 })
    }
    if (request.nextUrl.searchParams.get('seed') === '1') {
      await ensureComplianceBaselines()
    }
    return NextResponse.json({ data: await buildComplianceRadar() })
  } catch (error) {
    return toErrorResponse(error, request)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || (!can(user, 'hr', 'edit') && !user.role.isAdmin)) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'HR edit required' } }, { status: 403 })
    }
    const body = (await request.json().catch(() => ({}))) as { action?: string }
    if (body.action === 'seed') {
      return NextResponse.json({ data: await ensureComplianceBaselines() })
    }
    return NextResponse.json({ data: await buildComplianceRadar() })
  } catch (error) {
    return toErrorResponse(error, request)
  }
}
