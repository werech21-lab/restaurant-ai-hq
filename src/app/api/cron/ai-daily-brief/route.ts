import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { constantTimeHexEqual, ENTERPRISE_API_SECURITY_HEADERS } from '@/lib/auth/api-guard'
import { logger, errorFields } from '@/lib/logger'
import { isAiDailyBriefEnabled } from '@/server/ai/env'
import { DAILY_BRIEF_QUESTION, runFeryalCouncil } from '@/server/ai/council'
import { persistDailyBrief } from '@/server/ai/persist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim() ?? ''
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  return constantTimeHexEqual(header, `Bearer ${secret}`)
}

export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
  if (!isAiDailyBriefEnabled()) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: 'AI_DAILY_BRIEF_ENABLED' },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
  try {
    const result = await runFeryalCouncil({
      question: DAILY_BRIEF_QUESTION,
      userId: 'system:daily-brief',
      userRole: 'admin',
    })
    await persistDailyBrief({
      id: randomUUID(),
      questionHash: result.questionHash,
      status: result.status,
      reply: result.reply,
      agreedModels: JSON.stringify(result.agreed),
    })
    return NextResponse.json(
      {
        ok: result.status !== 'council_failed',
        status: result.status,
        agreed: result.agreed,
        participants: result.participants.map((item) => ({
          provider: item.provider,
          modelId: item.modelId,
          status: item.status,
          errorCode: item.errorCode,
        })),
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  } catch (error) {
    logger.error('daily brief failed', errorFields(error))
    return NextResponse.json(
      { ok: false, error: 'DAILY_BRIEF_FAILED' },
      { status: 500, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
}
