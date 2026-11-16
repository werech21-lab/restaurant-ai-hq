import { NextRequest, NextResponse } from 'next/server'
import { ENTERPRISE_API_SECURITY_HEADERS, requireExecApiSession } from '@/lib/auth/api-guard'
import { canTriggerManualOdooSync } from '@/lib/auth/role-access-policy'
import { logger, errorFields } from '@/lib/logger'
import { runBackgroundAnalysis } from '@/server/ai/brief'
import { parseStoredBrief } from '@/server/ai/consensus'
import { latestManualAtMs, manualRetryAt } from '@/server/ai/manual-run'
import { releaseManualRunLock, safeListDailyBriefs, tryAcquireManualRunLock } from '@/server/ai/persist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const guard = await requireExecApiSession(request, { allowAuditor: false })
  if (!guard.ok) return guard.response
  if (!canTriggerManualOdooSync(guard.session.role)) {
    return NextResponse.json(
      { ok: false, error: 'forbidden', errorAr: 'التشغيل اليدوي للمديرين التنفيذيين فقط.' },
      { status: 403, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
  const listed = await safeListDailyBriefs(14)
  if (listed.error) {
    return NextResponse.json(
      { ok: false, error: 'RATE_LIMIT_UNAVAILABLE' },
      { status: 503, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
  const retryAt = manualRetryAt(
    latestManualAtMs(
      listed.briefs.map((brief) => ({
        createdAtMs: brief.createdAt.getTime(),
        trigger: parseStoredBrief(brief.reply)?.trigger ?? null,
      })),
    ),
    Date.now(),
  )
  if (retryAt) {
    const retryAfterSeconds = Math.max(1, Math.ceil((Date.parse(retryAt) - Date.now()) / 1000))
    return NextResponse.json(
      { ok: false, error: 'RATE_LIMIT', retryAt },
      { status: 429, headers: { ...ENTERPRISE_API_SECURITY_HEADERS, 'Retry-After': String(retryAfterSeconds) } },
    )
  }
  const holder = `${guard.session.sub}:${crypto.randomUUID()}`
  const lock = await tryAcquireManualRunLock(holder)
  if (lock === 'unavailable') {
    return NextResponse.json(
      { ok: false, error: 'RUN_LOCK_UNAVAILABLE' },
      { status: 503, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
  if (lock === 'busy') {
    return NextResponse.json(
      { ok: false, error: 'RUN_IN_PROGRESS' },
      { status: 429, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
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
  } finally {
    await releaseManualRunLock(holder)
  }
}
