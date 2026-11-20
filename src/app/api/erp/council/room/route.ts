import { NextRequest, NextResponse } from 'next/server'
import {
  generateLiveOdooDecisionSnapshot,
  type LiveDecisionGeneratorResult,
} from '@/lib/aether/live-decision-generator'
import { ENTERPRISE_API_SECURITY_HEADERS, requireExecApiSession } from '@/lib/auth/api-guard'
import { templateSummary } from '@/lib/council/executive-summary'
import { fetchExecutiveContextPackFromOdoo } from '@/lib/feryal/executive-advisor'
import { errorFields, logger } from '@/lib/logger'
import { fetchLiveOdooSnapshot } from '@/lib/odoo-live-connector'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { readCouncilKeys } from '@/server/ai/env'
import { resolveCouncilModels } from '@/server/ai/models'
import { callProvider, type ProviderId } from '@/server/ai/providers'
import { executiveSummaryFor } from '@/server/council/executive-summary'
import { latestCouncilSnapshot } from '@/server/council/service'

export const dynamic = 'force-dynamic'

const DECISION_ROLES = ['admin', 'gm', 'dgm']
const ROOM_CACHE_TTL_MS = 120_000
const ITEM_PACK_TIMEOUT_MS = 4_500

interface CachedDecisionRoomPayload {
  at: number
  result: LiveDecisionGeneratorResult
  liveSummary: OdooLiveSummary | null
}

const g = globalThis as unknown as {
  __aetherLiveDecisionRoomCache?: CachedDecisionRoomPayload
}

async function withTimeoutNull<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms)
      }),
    ])
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function callCouncilProviderFast(input: {
  system: string
  user: string
  timeoutMs: number
}): Promise<string | null> {
  const keys = readCouncilKeys()
  const models = resolveCouncilModels()
  const candidates: Array<{ provider: ProviderId; apiKey: string; model: string }> = [
    { provider: 'google', apiKey: keys.google, model: models.google },
    { provider: 'anthropic', apiKey: keys.anthropic, model: models.anthropic },
    { provider: 'xai', apiKey: keys.xai, model: models.xai },
  ]
  const picked = candidates.find((c) => c.apiKey.length >= 20)
  if (!picked) return null

  const res = await callProvider({
    provider: picked.provider,
    apiKey: picked.apiKey,
    model: picked.model,
    system: input.system,
    user: input.user,
    timeoutMs: input.timeoutMs,
    maxTokens: 900,
  })
  return res.status === 'ok' && res.text.trim().length > 0 ? res.text : null
}

/** Decision Room: live read-only Odoo + AI executive decisions merged with latest council snapshot. */
export async function GET(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: true })
  if (!authGuard.ok) return authGuard.response
  const canDecide = DECISION_ROLES.includes(authGuard.session.role)
  const isAuditor = authGuard.session.role === 'auditor'
  const force = req.nextUrl.searchParams.get('force') === '1'

  try {
    const now = Date.now()
    const cached = g.__aetherLiveDecisionRoomCache
    if (!force && cached && now - cached.at < ROOM_CACHE_TTL_MS && cached.result.available) {
      const summary = isAuditor
        ? templateSummary({
            generatedAt: cached.result.generatedAt,
            reports: cached.result.reports,
            discoveries: cached.result.discoveries,
          })
        : cached.result.summary
      return NextResponse.json(
        {
          ok: true,
          available: true,
          generatedAt: cached.result.generatedAt,
          reports: cached.result.reports,
          discoveries: cached.result.discoveries,
          summary,
          liveSummary: cached.liveSummary,
          aiEnriched: cached.result.aiEnriched,
          canDecide,
        },
        { headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }

    const [storedSnapshot, envelope] = await Promise.all([
      latestCouncilSnapshot().catch(() => null),
      fetchLiveOdooSnapshot({ period: 'month', readOnly: true, forceRefresh: force }).catch(
        () => null,
      ),
    ])

    const liveSummary: OdooLiveSummary | null =
      envelope?.summary ?? (envelope?.connected ? envelope : null)

    const monthFrom =
      liveSummary?.buckets?.month?.from ??
      liveSummary?.period?.from ??
      liveSummary?.dateRange?.from ??
      ''
    const monthTo =
      liveSummary?.buckets?.month?.to ??
      liveSummary?.period?.to ??
      liveSummary?.dateRange?.to ??
      ''

    const contextPack =
      liveSummary?.connected && monthFrom && monthTo
        ? await withTimeoutNull(
            fetchExecutiveContextPackFromOdoo({
              fromIso: monthFrom,
              toIso: monthTo,
              periodKey: 'month',
              includeLiveSnapshot: false,
              liveSummary,
            }),
            ITEM_PACK_TIMEOUT_MS,
          )
        : null

    const generated = await generateLiveOdooDecisionSnapshot({
      summary: liveSummary,
      contextPack,
      existingSnapshot: storedSnapshot,
      callLlm: isAuditor ? undefined : callCouncilProviderFast,
      timeoutMs: 4_200,
    })

    if (!generated.available) {
      return NextResponse.json(
        {
          ok: true,
          available: false,
          generatedAt: null,
          reports: [],
          discoveries: [],
          summary: null,
          liveSummary: null,
          canDecide,
        },
        { headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }

    const snapshotObj = {
      generatedAt: generated.generatedAt,
      reports: generated.reports,
      discoveries: generated.discoveries,
    }
    const finalSummary = isAuditor
      ? templateSummary(snapshotObj)
      : generated.aiEnriched && generated.summary
        ? generated.summary
        : await executiveSummaryFor(snapshotObj)

    const resultToCache: LiveDecisionGeneratorResult = {
      ...generated,
      summary: finalSummary,
    }
    g.__aetherLiveDecisionRoomCache = {
      at: Date.now(),
      result: resultToCache,
      liveSummary,
    }

    return NextResponse.json(
      {
        ok: true,
        available: true,
        generatedAt: generated.generatedAt,
        reports: generated.reports,
        discoveries: generated.discoveries,
        summary: finalSummary,
        liveSummary,
        aiEnriched: generated.aiEnriched,
        canDecide,
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  } catch (error) {
    logger.error('decision room read failed', errorFields(error))
    return NextResponse.json(
      {
        ok: true,
        available: false,
        generatedAt: null,
        reports: [],
        discoveries: [],
        summary: null,
        liveSummary: null,
        canDecide,
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
}
