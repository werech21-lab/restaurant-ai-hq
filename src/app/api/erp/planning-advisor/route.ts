import { NextRequest, NextResponse } from 'next/server'
import {
  buildBoothAdvisorFallback,
  buildStrategicAdvisorFallback,
  computeStrategicPlanning,
  computeWhatIfStrategicSimulation,
  extractBrandOdooActual,
  extractOdooVerifiedPlanningActuals,
  validateGroundedAdvisorSections,
  type BoothSimulationSummary,
  type BoothWhatIfInputs,
  type ForecastHorizonId,
  type PlanningAdvisorResponsePayload,
  type StrategicWhatIfInputs,
} from '@/lib/aether/strategic-planning-engine'
import { ENTERPRISE_API_SECURITY_HEADERS, requireExecApiSession } from '@/lib/auth/api-guard'
import { errorFields, logger } from '@/lib/logger'
import { fetchLiveOdooSnapshot } from '@/lib/odoo-live-connector'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { readCouncilKeys } from '@/server/ai/env'
import { resolveCouncilModels } from '@/server/ai/models'
import {
  ODOO_VERIFIED_ACTUALS_LABEL,
  PROPOSED_USER_INPUT_LABEL,
} from '@/server/ai/number-guard'
import { callProvider, type ProviderId } from '@/server/ai/providers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function numField(raw: unknown, fallback: number, min = -1_000_000, max = 10_000_000): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function strField(raw: unknown, fallback: string, maxLen = 80): string {
  return typeof raw === 'string' && raw.trim().length > 0
    ? raw.trim().slice(0, maxLen)
    : fallback
}

async function invokeAdvisorProvider(input: {
  system: string
  user: string
  timeoutMs: number
}): Promise<{ text: string; modelLabelEn: string; modelLabelAr: string } | null> {
  const keys = readCouncilKeys()
  const models = resolveCouncilModels()
  const candidates: Array<{
    provider: ProviderId
    apiKey: string
    model: string
    labelEn: string
    labelAr: string
  }> = [
    {
      provider: 'google',
      apiKey: keys.google,
      model: models.google,
      labelEn: `Gemini Council (${models.google}) • Number-Verified`,
      labelAr: `مجلس الذكاء التنفيذي (${models.google}) • متحقق رقمياً`,
    },
    {
      provider: 'anthropic',
      apiKey: keys.anthropic,
      model: models.anthropic,
      labelEn: `Claude Council (${models.anthropic}) • Number-Verified`,
      labelAr: `مجلس الذكاء التنفيذي (${models.anthropic}) • متحقق رقمياً`,
    },
    {
      provider: 'xai',
      apiKey: keys.xai,
      model: models.xai,
      labelEn: `Grok Council (${models.xai}) • Number-Verified`,
      labelAr: `مجلس الذكاء التنفيذي (${models.xai}) • متحقق رقمياً`,
    },
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
    maxTokens: 1_000,
  })
  if (res.status !== 'ok' || res.text.trim().length === 0) return null
  return {
    text: res.text,
    modelLabelEn: picked.labelEn,
    modelLabelAr: picked.labelAr,
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'METHOD_NOT_ALLOWED' },
    { status: 405, headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

/**
 * Authenticated Read-Only AI Strategic Advisor (`POST /api/erp/planning-advisor`)
 * for `Strategic Planning` (`/erp/planning`) and `Booth Feasibility` (`/erp/booth-feasibility`).
 *
 * Strictly grounded in live read-only Odoo actuals + current user simulator parameters,
 * verified via `number-guard` with deterministic Odoo-grounded CFO fallback.
 */
export async function POST(req: NextRequest) {
  const guard = await requireExecApiSession(req, { allowAuditor: false })
  if (!guard.ok) return guard.response

  let rawBody: Record<string, unknown> = {}
  try {
    const parsed = (await req.json()) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      rawBody = parsed as Record<string, unknown>
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const mode =
    rawBody.mode === 'booth-feasibility' ? 'booth-feasibility' : 'strategic-planning'

  try {
    const envelope = await fetchLiveOdooSnapshot({ period: 'month', readOnly: true }).catch(
      () => null,
    )
    const serverSummary: OdooLiveSummary | null =
      envelope?.summary ?? (envelope?.connected ? envelope : null)
    const clientSummaryCandidate =
      !serverSummary && rawBody.liveSummary && typeof rawBody.liveSummary === 'object'
        ? (rawBody.liveSummary as OdooLiveSummary)
        : null
    const liveSummary = serverSummary ?? clientSummaryCandidate
    const actuals = extractOdooVerifiedPlanningActuals(liveSummary)

    if (mode === 'booth-feasibility') {
      const inputsRaw =
        rawBody.boothInputs && typeof rawBody.boothInputs === 'object'
          ? (rawBody.boothInputs as Record<string, unknown>)
          : {}
      const boothInputs: BoothWhatIfInputs = {
        brandId: strField(inputsRaw.brandId, 'china-garden', 40),
        brandLabelEn: strField(inputsRaw.brandLabelEn, 'China Garden', 80),
        brandLabelAr: strField(inputsRaw.brandLabelAr, 'تشاينا جاردن', 80),
        days: Math.max(1, Math.round(numField(inputsRaw.days, 30, 1, 365))),
        rentKwd: numField(inputsRaw.rentKwd, 3000, 0, 500_000),
        setupKwd: numField(inputsRaw.setupKwd, 800, 0, 500_000),
        staffCount: Math.max(0, Math.round(numField(inputsRaw.staffCount, 0, 0, 200))),
        staffCostKwd: numField(inputsRaw.staffCostKwd, 0, 0, 500_000),
        avgTicketKwd: numField(inputsRaw.avgTicketKwd, 3.5, 0.25, 500),
        foodCostPct: numField(inputsRaw.foodCostPct, 28, 5, 92),
        expectedDailyOrders: numField(inputsRaw.expectedDailyOrders, 80, 0, 50_000),
      }

      const gpPerOrderKwd =
        Math.round(boothInputs.avgTicketKwd * (1 - boothInputs.foodCostPct / 100) * 1000) / 1000
      const fixedCostKwd =
        Math.round((boothInputs.rentKwd + boothInputs.setupKwd + boothInputs.staffCostKwd) * 1000) /
        1000
      const beRaw =
        boothInputs.days > 0 && gpPerOrderKwd > 0
          ? fixedCostKwd / boothInputs.days / gpPerOrderKwd
          : null
      const baseOrders = boothInputs.expectedDailyOrders * boothInputs.days
      const baseRevenueKwd = Math.round(baseOrders * boothInputs.avgTicketKwd * 1000) / 1000
      const baseProfitKwd =
        Math.round((baseOrders * gpPerOrderKwd - fixedCostKwd) * 1000) / 1000
      const lowOrders = baseOrders * 0.6
      const lowGp = lowOrders * gpPerOrderKwd
      const conservativeProfitKwd = Math.round((lowGp - fixedCostKwd) * 1000) / 1000
      const upsideProfitKwd =
        Math.round((baseOrders * 1.3 * gpPerOrderKwd - fixedCostKwd) * 1000) / 1000
      const rentCeilingKwd =
        Math.round(
          Math.max(0, lowGp - boothInputs.setupKwd - boothInputs.staffCostKwd) * 1000,
        ) / 1000
      const rentSharePct =
        baseRevenueKwd > 0 ? Math.round((boothInputs.rentKwd / baseRevenueKwd) * 1000) / 10 : 0

      const sim: BoothSimulationSummary = {
        fixedCostKwd,
        gpPerOrderKwd,
        breakEvenDailyOrders: beRaw !== null && Number.isFinite(beRaw) ? Math.round(beRaw) : null,
        baseRevenueKwd,
        baseProfitKwd,
        conservativeProfitKwd,
        upsideProfitKwd,
        rentCeilingKwd,
        rentSharePct,
        verdict:
          baseProfitKwd <= 0 ? 'walk' : conservativeProfitKwd >= 0 ? 'go' : 'conditional',
      }

      const brandActual = extractBrandOdooActual(liveSummary, boothInputs.brandId)
      const fallback = buildBoothAdvisorFallback({
        actuals,
        brandActual,
        boothInputs,
        sim,
      })

      const facts = {
        odooActuals: {
          month30dNetSalesKwd: actuals.month30dNetSalesKwd,
          month30dDailyRunRateKwd: actuals.month30dDailyRunRateKwd,
          month30dAovKwd: actuals.month30dAovKwd,
          branchDailyMedianKwd: actuals.branchDailyMedianKwd,
          branchDailyMedianOrders: actuals.branchDailyMedianOrders,
          exhibitionsNetKwd: actuals.exhibitionsActuals.netKwd,
          exhibitionsOrders: actuals.exhibitionsActuals.orders,
          brandNetKwd: brandActual.netKwd,
          brandAovKwd: brandActual.aovKwd,
        },
        simulatorInputs: boothInputs,
        simulationOutputs: sim,
      }

      const userInputTokens = [
        String(boothInputs.days),
        String(boothInputs.rentKwd),
        String(boothInputs.setupKwd),
        String(boothInputs.staffCount),
        String(boothInputs.staffCostKwd),
        String(boothInputs.avgTicketKwd),
        String(boothInputs.foodCostPct),
        String(boothInputs.expectedDailyOrders),
        String(sim.baseProfitKwd),
        String(sim.conservativeProfitKwd),
        String(sim.rentCeilingKwd),
        String(sim.fixedCostKwd),
        ...(sim.breakEvenDailyOrders !== null ? [String(sim.breakEvenDailyOrders)] : []),
      ]

      const system = [
        'You are the CFO & Exhibitions Advisor for Venture Foods Co. W.L.L. in Kuwait.',
        `Strictly distinguish ${ODOO_VERIFIED_ACTUALS_LABEL} from ${PROPOSED_USER_INPUT_LABEL}.`,
        'Return ONLY valid JSON: {"recommendations":[{"titleEn":"...","titleAr":"...","bodyEn":"...","bodyAr":"..."}]} with exactly 3 items covering: (1) Rent Negotiation & 60% Stress-Test Gate, (2) Calibration vs Brand & Odoo Actuals, (3) Staffing & POS Register Control.',
        'STRICT NUMERIC RULE: Use ONLY exact numbers from the provided JSON facts. Never invent numbers, never mention excluded entities, and never use raw EXB/TMP/TgO acronyms inside Arabic bodyAr.',
      ].join('\n')

      const llmRes = await invokeAdvisorProvider({
        system,
        user: JSON.stringify(facts),
        timeoutMs: 6_500,
      }).catch(() => null)

      const validated = llmRes
        ? validateGroundedAdvisorSections(llmRes.text, facts, userInputTokens, fallback)
        : null

      const payload: PlanningAdvisorResponsePayload = {
        ok: true,
        source: validated ? 'ai' : 'deterministic',
        modelLabelEn:
          validated && llmRes
            ? llmRes.modelLabelEn
            : 'CFO Deterministic Advisor • Odoo 17 Grounded',
        modelLabelAr:
          validated && llmRes
            ? llmRes.modelLabelAr
            : 'مستشار مالي رقمي حتمي • موثّق من أودو 17',
        updatedAtIso: new Date().toISOString(),
        recommendations: validated ?? fallback,
      }
      return NextResponse.json(payload, { headers: ENTERPRISE_API_SECURITY_HEADERS })
    }

    // Mode: 'strategic-planning'
    const inputsRaw =
      rawBody.whatIfInputs && typeof rawBody.whatIfInputs === 'object'
        ? (rawBody.whatIfInputs as Record<string, unknown>)
        : {}
    const horizonRaw = strField(rawBody.horizonId, '90d', 16)
    const horizonId: ForecastHorizonId =
      horizonRaw === '30d' ||
      horizonRaw === '90d' ||
      horizonRaw === '6m' ||
      horizonRaw === '12m' ||
      horizonRaw === 'custom'
        ? horizonRaw
        : '90d'

    const whatIf: StrategicWhatIfInputs = {
      targetGrowthPct: numField(inputsRaw.targetGrowthPct, 9.5, -50, 100),
      directChannelShiftPct: numField(inputsRaw.directChannelShiftPct, 5, 0, 50),
      costEfficiencyPct: numField(inputsRaw.costEfficiencyPct, 3.4, 0, 35),
      horizonDays: Math.max(1, Math.round(numField(inputsRaw.horizonDays, 90, 1, 730))),
      roadmapCostCapKwd: numField(inputsRaw.roadmapCostCapKwd, 0, 0, 5_000_000),
      roadmapMonthlyGainKwd: numField(inputsRaw.roadmapMonthlyGainKwd, 0, 0, 5_000_000),
    }

    const planSnap = computeStrategicPlanning(
      { period: 'month' },
      liveSummary,
      [],
      horizonId,
      strField(rawBody.customFrom, '2026-11-15', 10),
      strField(rawBody.customTo, '2027-02-15', 10),
    )

    const sim = computeWhatIfStrategicSimulation(planSnap, whatIf)
    const fallback = buildStrategicAdvisorFallback({ actuals, whatIf, sim })

    const facts = {
      odooActuals: {
        month30dNetSalesKwd: actuals.month30dNetSalesKwd,
        month30dDailyRunRateKwd: actuals.month30dDailyRunRateKwd,
        month30dAovKwd: actuals.month30dAovKwd,
        ytdNetSalesKwd: actuals.ytdNetSalesKwd,
        directSharePct: actuals.directSharePct,
        aggregatorSharePct: actuals.aggregatorSharePct,
        topBranchNetKwd: actuals.topBranch?.netKwd ?? null,
        lowestBranchNetKwd: actuals.lowestBranch?.netKwd ?? null,
        topBrandNetKwd: actuals.topBrand?.netKwd ?? null,
      },
      whatIfInputs: whatIf,
      simulationOutputs: {
        projectedSalesKwd: sim.projectedSalesKwd,
        incrementalSalesDeltaKwd: sim.incrementalSalesDeltaKwd,
        directCommissionProtectedVolumeKwd: sim.directCommissionProtectedVolumeKwd,
        projectedCostsKwd: sim.projectedCostsKwd,
        projectedNetCashKwd: sim.projectedNetCashKwd,
        projectedMarginPct: sim.projectedMarginPct,
      },
    }

    const userInputTokens = [
      String(whatIf.targetGrowthPct),
      String(whatIf.directChannelShiftPct),
      String(whatIf.costEfficiencyPct),
      String(whatIf.horizonDays),
      String(whatIf.roadmapCostCapKwd),
      String(whatIf.roadmapMonthlyGainKwd),
      String(sim.projectedSalesKwd),
      String(sim.incrementalSalesDeltaKwd),
      String(sim.directCommissionProtectedVolumeKwd),
      ...(sim.projectedCostsKwd !== null ? [String(sim.projectedCostsKwd)] : []),
      ...(sim.projectedNetCashKwd !== null ? [String(sim.projectedNetCashKwd)] : []),
      ...(sim.projectedMarginPct !== null ? [String(sim.projectedMarginPct)] : []),
    ]

    const system = [
      'You are the Executive CFO & Strategy Advisor for Venture Foods Co. W.L.L. in Kuwait.',
      `Strictly distinguish ${ODOO_VERIFIED_ACTUALS_LABEL} from ${PROPOSED_USER_INPUT_LABEL}.`,
      'Return ONLY valid JSON: {"recommendations":[{"titleEn":"...","titleAr":"...","bodyEn":"...","bodyAr":"..."}]} with exactly 3 items covering: (1) Baseline Velocity vs What-If Growth Pacing, (2) Direct Channel Margin Protection & Aggregator Cap, (3) Cost Cap Discipline & Ardiya Central Kitchen Execution.',
      'STRICT NUMERIC RULE: Use ONLY exact numbers from the provided JSON facts. Never invent numbers, never estimate standard_price/COGS when null, never mention excluded entities, and never use raw EXB/TMP/TgO acronyms inside Arabic bodyAr.',
    ].join('\n')

    const llmRes = await invokeAdvisorProvider({
      system,
      user: JSON.stringify(facts),
      timeoutMs: 6_500,
    }).catch(() => null)

    const validated = llmRes
      ? validateGroundedAdvisorSections(llmRes.text, facts, userInputTokens, fallback)
      : null

    const payload: PlanningAdvisorResponsePayload = {
      ok: true,
      source: validated ? 'ai' : 'deterministic',
      modelLabelEn:
        validated && llmRes
          ? llmRes.modelLabelEn
          : 'CFO Deterministic Advisor • Odoo 17 Grounded',
      modelLabelAr:
        validated && llmRes
          ? llmRes.modelLabelAr
          : 'مستشار مالي رقمي حتمي • موثّق من أودو 17',
      updatedAtIso: new Date().toISOString(),
      recommendations: validated ?? fallback,
    }
    return NextResponse.json(payload, { headers: ENTERPRISE_API_SECURITY_HEADERS })
  } catch (error) {
    logger.error('planning advisor failed', errorFields(error))
    return NextResponse.json(
      { ok: false, error: 'ADVISOR_FAILED' },
      { status: 500, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
}
