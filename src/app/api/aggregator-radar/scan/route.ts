import { NextResponse } from 'next/server'
import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { runForensicScan } from '@/modules/governance/services/forensic-radar-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = protectedRoute(permissions.govAggregatorManage, async ({ request, auth }) => {
  let body: { brandId?: string; branchId?: string; platform?: string; alert?: boolean } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }
  const board = await runForensicScan(auth, {
    brandId: body.brandId ?? null,
    branchId: body.branchId ?? null,
    platform: body.platform ?? null,
    alert: body.alert !== false,
  })
  return NextResponse.json(
    {
      data: {
        recorded: board.recorded,
        alerted: board.alerted,
        bucket: board.snapshot.bucket,
        scannedAt: board.snapshot.scannedAt,
        kpis: board.kpis,
        rows: board.rows,
        report: board.report,
        historyCount: board.historyCount,
        nextScanInSec: board.nextScanInSec,
        autoScanIntervalSec: board.autoScanIntervalSec,
      },
    },
    { status: 201 },
  )
})
