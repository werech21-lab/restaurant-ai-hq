import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  buildLiveDecisionSnapshotFromSummary,
  type LiveDecisionGeneratorResult,
} from '@/lib/aether/live-decision-generator'
import { ENTERPRISE_API_SECURITY_HEADERS, requireExecApiSession } from '@/lib/auth/api-guard'
import {
  decisionFromFinding,
  measureDecisionOutcome,
  validateDecisionInput,
  type DecisionRecord,
} from '@/lib/council/decisions'
import { kuwaitDayOf } from '@/lib/council/helpers'
import { completedDailyByBranch } from '@/lib/council/series'
import type { AdvisorId, CouncilFinding } from '@/lib/council/types'
import { fetchExecutiveContextPackFromOdoo } from '@/lib/feryal/executive-advisor'
import { errorFields, logger } from '@/lib/logger'
import { fetchLiveOdooSnapshot } from '@/lib/odoo-live-connector'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import * as aiPersist from '@/server/ai/persist'
import { latestCouncilSnapshot } from '@/server/council/service'
import { listDecisions, saveDecision } from '@/server/council/store'

export const dynamic = 'force-dynamic'

/** Executives who may decide on a council proposal (auditors and other roles read only). */
const DECISION_ROLES = ['admin', 'gm', 'dgm'] as const
const DECISION_HASH_PREFIX = 'decision-room:'

const VALID_ADVISOR_IDS: ReadonlySet<AdvisorId> = new Set<AdvisorId>([
  'cfo',
  'delivery',
  'hr',
  'inventory',
  'seasons',
  'drivers',
  'menu',
  'benchmark',
  'forecast',
])

const g = globalThis as unknown as {
  __aetherDecisionRecordsFallback?: Map<string, DecisionRecord>
  __aetherLiveDecisionRoomCache?: {
    at: number
    result: LiveDecisionGeneratorResult
    liveSummary: OdooLiveSummary | null
  }
}

function fallbackMap(): Map<string, DecisionRecord> {
  if (!g.__aetherDecisionRecordsFallback) {
    g.__aetherDecisionRecordsFallback = new Map<string, DecisionRecord>()
  }
  return g.__aetherDecisionRecordsFallback
}

async function readPrismaMirrorDecisions(): Promise<DecisionRecord[]> {
  try {
    const rows = await aiPersist.listCouncilDecisionMirrorBriefs(200)
    const out: DecisionRecord[] = []
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.reply) as DecisionRecord
        if (parsed && typeof parsed.fingerprint === 'string' && typeof parsed.status === 'string') {
          out.push(parsed)
        }
      } catch {
        // Ignore malformed legacy payload.
      }
    }
    return out
  } catch {
    return []
  }
}

async function writePrismaMirrorDecision(record: DecisionRecord): Promise<boolean> {
  try {
    const hash = `${DECISION_HASH_PREFIX}${record.fingerprint}`
    return await aiPersist.upsertCouncilDecisionMirrorBrief({
      questionHash: hash,
      status: record.status,
      reply: JSON.stringify(record),
    })
  } catch {
    return false
  }
}

async function loadMergedDecisions(): Promise<DecisionRecord[]> {
  const [primary, mirrored] = await Promise.all([
    listDecisions().catch(() => []),
    readPrismaMirrorDecisions(),
  ])
  const byFingerprint = new Map<string, DecisionRecord>()
  const consider = (d: DecisionRecord) => {
    const cur = byFingerprint.get(d.fingerprint)
    if (!cur || d.decidedAt >= cur.decidedAt) {
      byFingerprint.set(d.fingerprint, d)
    }
  }
  for (const d of primary) consider(d)
  for (const d of mirrored) consider(d)
  for (const d of fallbackMap().values()) consider(d)
  return Array.from(byFingerprint.values()).sort((a, b) =>
    b.decidedAt.localeCompare(a.decidedAt),
  )
}

function parseClientFindingMeta(
  rawBody: unknown,
  fingerprint: string,
): CouncilFinding | null {
  if (!rawBody || typeof rawBody !== 'object') return null
  const meta = (rawBody as Record<string, unknown>).findingMeta
  if (!meta || typeof meta !== 'object') return null
  const m = meta as Record<string, unknown>
  const advisorRaw = typeof m.advisorId === 'string' ? (m.advisorId as AdvisorId) : null
  const titleAr = typeof m.titleAr === 'string' ? m.titleAr.trim().slice(0, 240) : ''
  const titleEn = typeof m.titleEn === 'string' ? m.titleEn.trim().slice(0, 240) : ''
  const kind = typeof m.kind === 'string' ? m.kind.trim().slice(0, 80) : 'live-decision'
  const branchId =
    typeof m.branchId === 'string' && m.branchId.trim().length > 0
      ? m.branchId.trim().slice(0, 60)
      : undefined
  const expectedWeeklyKwd =
    typeof m.expectedWeeklyKwd === 'number' && Number.isFinite(m.expectedWeeklyKwd)
      ? Math.round(m.expectedWeeklyKwd * 1000) / 1000
      : null

  if (!advisorRaw || !VALID_ADVISOR_IDS.has(advisorRaw) || !titleAr || !titleEn) return null
  if (isExcludedOdooEntity(titleAr) || isExcludedOdooEntity(titleEn)) return null

  return {
    fingerprint,
    advisorId: advisorRaw,
    kind,
    entities: branchId ? { branchId } : {},
    titleAr,
    titleEn,
    evidence: [],
    rootCause: { ar: '', en: '' },
    severity: 'medium',
    novelty: 0.8,
    weeklyImpact:
      expectedWeeklyKwd !== null
        ? {
            label: 'Estimate',
            value: expectedWeeklyKwd,
            unit: 'KWD',
            formula: 'Odoo verified estimate',
            inputs: {},
          }
        : null,
    proposals: [],
  }
}

async function resolveTargetFinding(
  fingerprint: string,
  rawBody: unknown,
): Promise<{ finding: CouncilFinding | null; liveSummary: OdooLiveSummary | null }> {
  const cached = g.__aetherLiveDecisionRoomCache
  if (cached) {
    const cachedHit = cached.result.reports
      .flatMap((r) => r.findings)
      .find((f) => f.fingerprint === fingerprint)
    if (cachedHit) return { finding: cachedHit, liveSummary: cached.liveSummary }
  }

  const snapshot = await latestCouncilSnapshot().catch(() => null)
  const storedHit =
    snapshot?.reports.flatMap((r) => r.findings).find((f) => f.fingerprint === fingerprint) ?? null
  if (storedHit) return { finding: storedHit, liveSummary: cached?.liveSummary ?? null }

  const envelope = await fetchLiveOdooSnapshot({ period: 'month', readOnly: true }).catch(
    () => null,
  )
  const liveSummary: OdooLiveSummary | null =
    envelope?.summary ?? (envelope?.connected ? envelope : null)

  if (liveSummary?.connected) {
    const baseGenerated = buildLiveDecisionSnapshotFromSummary(liveSummary, null, snapshot)
    const liveHit =
      baseGenerated.reports.flatMap((r) => r.findings).find((f) => f.fingerprint === fingerprint) ??
      null
    if (liveHit) return { finding: liveHit, liveSummary }

    if (fingerprint.startsWith('menu:')) {
      const fromIso =
        liveSummary.buckets?.month?.from ?? liveSummary.period?.from ?? ''
      const toIso =
        liveSummary.buckets?.month?.to ?? liveSummary.period?.to ?? ''
      if (fromIso && toIso) {
        const pack = await fetchExecutiveContextPackFromOdoo({
          fromIso,
          toIso,
          periodKey: 'month',
          includeLiveSnapshot: false,
          liveSummary,
        }).catch(() => null)
        const withMenu = buildLiveDecisionSnapshotFromSummary(liveSummary, pack, snapshot)
        const menuHit =
          withMenu.reports.flatMap((r) => r.findings).find((f) => f.fingerprint === fingerprint) ??
          null
        if (menuHit) return { finding: menuHit, liveSummary }
      }
    }
  }

  return {
    finding: parseClientFindingMeta(rawBody, fingerprint),
    liveSummary,
  }
}

/** Decision log with measured outcomes (newest first). */
export async function GET(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: true })
  if (!authGuard.ok) return authGuard.response
  const decisions = await loadMergedDecisions()
  return NextResponse.json(
    {
      ok: true,
      decisions,
      canDecide: (DECISION_ROLES as readonly string[]).includes(authGuard.session.role),
    },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

/** Approve (`accepted`) / Test (`testing`) / Dismiss (`rejected`) one executive decision card. */
export async function POST(req: NextRequest) {
  const authGuard = await requireExecApiSession(req)
  if (!authGuard.ok) return authGuard.response
  if (!(DECISION_ROLES as readonly string[]).includes(authGuard.session.role)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'FORBIDDEN_ROLE',
        errorAr: 'اتخاذ القرار متاح للمدير العام ونائبه ومسؤول النظام فقط.',
      },
      { status: 403, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
  const input = validateDecisionInput(body)
  if (!input) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_DECISION' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const { finding, liveSummary } = await resolveTargetFinding(input.fingerprint, body)
  if (!finding) {
    return NextResponse.json(
      { ok: false, error: 'UNKNOWN_FINDING' },
      { status: 404, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const now = new Date().toISOString()
  const baseRecord = decisionFromFinding(finding, input, {
    id: randomUUID(),
    decidedBy: authGuard.session.sub,
    decidedAt: now,
    decidedDay: kuwaitDayOf(now)!,
  })

  const daily = completedDailyByBranch(liveSummary)
  const record: DecisionRecord =
    baseRecord.status !== 'rejected' && daily
      ? {
          ...baseRecord,
          outcome: measureDecisionOutcome(baseRecord, daily),
          outcomeAt: now,
        }
      : baseRecord

  fallbackMap().set(record.fingerprint, record)

  let persistedPrimary = false
  try {
    await saveDecision(record)
    persistedPrimary = true
  } catch (error) {
    logger.warn('council primary store unavailable, using ai_daily_briefs mirror fallback', errorFields(error))
  }

  const persistedMirror = await writePrismaMirrorDecision(record)
  logger.info('council decision saved', {
    fingerprint: record.fingerprint,
    status: record.status,
    role: authGuard.session.role,
    persistedPrimary,
    persistedMirror,
  })

  return NextResponse.json(
    { ok: true, decision: record },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}
