import { NextRequest, NextResponse } from 'next/server'
import { ENTERPRISE_API_SECURITY_HEADERS, requireAdminOnlyApiSession } from '@/lib/auth/api-guard'
import { logger, errorFields } from '@/lib/logger'
import { runBackgroundAnalysis } from '@/server/ai/brief'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const guard = await requireAdminOnlyApiSession(request)
  if (!guard.ok) return guard.response
  try {
    const result = await runBackgroundAnalysis({
      trigger: 'manual',
      userId: guard.session.sub,
    })
    return NextResponse.json(
      {
        ok: true,
        status: result.status,
        missingKeys: result.report.missingKeys,
        models: result.report.models.map((model) => ({
          provider: model.provider,
          modelId: model.modelId,
          status: model.status,
          errorCode: model.errorCode,
        })),
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  } catch (error) {
    logger.error('manual brief failed', errorFields(error))
    return NextResponse.json(
      { ok: false, error: 'DAILY_BRIEF_FAILED' },
      { status: 500, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
}
