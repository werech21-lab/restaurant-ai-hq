import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ENTERPRISE_API_SECURITY_HEADERS, requireExecApiSession } from '@/lib/auth/api-guard'
import { decisionFromFinding, validateDecisionInput } from '@/lib/council/decisions'
import { kuwaitDayOf } from '@/lib/council/helpers'
import { errorFields, logger } from '@/lib/logger'
import { latestCouncilSnapshot } from '@/server/council/service'
import { listDecisions, saveDecision } from '@/server/council/store'

export const dynamic = 'force-dynamic'

/** Executives who may decide on a council proposal (auditors and other roles read only). */
const DECISION_ROLES = ['admin', 'gm', 'dgm'] as const

/** Decision log with measured outcomes (newest first). */
export async function GET(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: true })
  if (!authGuard.ok) return authGuard.response
  const decisions = await listDecisions()
  return NextResponse.json(
    { ok: true, decisions, canDecide: (DECISION_ROLES as readonly string[]).includes(authGuard.session.role) },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

/** Accept / test / reject one finding of the latest council snapshot. */
export async function POST(req: NextRequest) {
  const authGuard = await requireExecApiSession(req)
  if (!authGuard.ok) return authGuard.response
  if (!(DECISION_ROLES as readonly string[]).includes(authGuard.session.role)) {
    return NextResponse.json(
      { ok: false, error: 'FORBIDDEN_ROLE', errorAr: 'اتخاذ القرار متاح للمدير العام ونائبه ومسؤول النظام فقط.' },
      { status: 403, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS })
  }
  const input = validateDecisionInput(body)
  if (!input) return NextResponse.json({ ok: false, error: 'INVALID_DECISION' }, { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS })
  const snapshot = await latestCouncilSnapshot().catch(() => null)
  const finding = snapshot?.reports.flatMap((r) => r.findings).find((f) => f.fingerprint === input.fingerprint) ?? null
  if (!finding) return NextResponse.json({ ok: false, error: 'UNKNOWN_FINDING' }, { status: 404, headers: ENTERPRISE_API_SECURITY_HEADERS })
  const now = new Date().toISOString()
  const record = decisionFromFinding(finding, input, { id: randomUUID(), decidedBy: authGuard.session.sub, decidedAt: now, decidedDay: kuwaitDayOf(now)! })
  try {
    await saveDecision(record)
    logger.info('council decision saved', { fingerprint: record.fingerprint, status: record.status, role: authGuard.session.role })
    return NextResponse.json({ ok: true, decision: record }, { headers: ENTERPRISE_API_SECURITY_HEADERS })
  } catch (error) {
    logger.error('council decision save failed', errorFields(error))
    return NextResponse.json({ ok: false, error: 'SAVE_FAILED' }, { status: 500, headers: ENTERPRISE_API_SECURITY_HEADERS })
  }
}
