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
        recorded: board.recorded ?? 0,
        alerted: Boolean(board.alerted),
        bucket: board.snapshot?.bucket ?? new Date().toISOString(),
        scannedAt: board.snapshot?.scannedAt ?? new Date().toISOString(),
        snapshot: {
          bucket: board.snapshot?.bucket ?? new Date().toISOString(),
          scannedAt: board.snapshot?.scannedAt ?? new Date().toISOString(),
        },
        kpis: board.kpis,
        rows: Array.isArray(board.rows) ? board.rows : [],
        report: board.report,
        historyCount: Number(board.historyCount) || 0,
        nextScanInSec: Number(board.nextScanInSec) || 300,
        autoScanIntervalSec: Number(board.autoScanIntervalSec) || 300,
      },
    },
    { status: 201 },
  )
})
