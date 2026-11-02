import { NextResponse } from 'next/server'
import { listExclusiveRadarRecipients } from '@/lib/alerts'
import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { forensicBoard } from '@/modules/governance/services/forensic-radar-service'
import type { ForensicReportPeriod } from '@/modules/governance/domain/forensic-radar'
import { getSmtpPublicStatus } from '@/lib/email/server-mail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.govAggregatorRead, async ({ request }) => {
  const url = request.nextUrl
  const period = (url.searchParams.get('period') as ForensicReportPeriod | null) ?? 'daily'
  const board = forensicBoard({
    brandId: url.searchParams.get('brandId'),
    branchId: url.searchParams.get('branchId'),
    platform: url.searchParams.get('platform'),
    period: period === 'weekly' || period === 'monthly' ? period : 'daily',
  })
  const smtp = await getSmtpPublicStatus()
  return NextResponse.json({
    data: {
      ...board,
      exclusiveAlertRecipients: listExclusiveRadarRecipients(),
      smtp,
    },
  })
})
