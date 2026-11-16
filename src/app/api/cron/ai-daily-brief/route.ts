import { NextRequest, NextResponse } from 'next/server'
import { constantTimeHexEqual, ENTERPRISE_API_SECURITY_HEADERS } from '@/lib/auth/api-guard'
import { logger, errorFields } from '@/lib/logger'
import { runBackgroundAnalysis } from '@/server/ai/brief'
import { isBackgroundAnalysisEnabled } from '@/server/ai/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim() ?? ''
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  return constantTimeHexEqual(header, `Bearer ${secret}`)
}

function publicBody(result: Awaited<ReturnType<typeof runBackgroundAnalysis>>) {
  return {
    ok: true,
    status: result.status,
    missingKeys: result.report.missingKeys,
    models: result.report.models.map((model) => ({
      provider: model.provider,
      modelId: model.modelId,
      status: model.status,
      errorCode: model.errorCode,
    })),
  }
}

export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
  if (!isBackgroundAnalysisEnabled()) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: 'AI_DAILY_BRIEF_ENABLED' },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
  try {
    const result = await runBackgroundAnalysis({
      trigger: 'schedule',
      userId: 'system:daily-brief',
    })
    return NextResponse.json(publicBody(result), { headers: ENTERPRISE_API_SECURITY_HEADERS })
  } catch (error) {
    logger.error('daily brief failed', errorFields(error))
    return NextResponse.json(
      { ok: false, error: 'DAILY_BRIEF_FAILED' },
      { status: 500, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
}
