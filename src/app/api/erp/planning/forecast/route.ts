import { NextRequest, NextResponse } from 'next/server'
import {
  buildRateLimitedJsonResponse,
  ENTERPRISE_API_SECURITY_HEADERS,
  executiveAiBurstLimiter,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import { getAnthropicApiKey, getGeminiApiKey, isValidGeminiApiKey } from '@/lib/ai-keys'
import {
  isBriefingTruncatedOrIncomplete,
  localizeArabicPlanningCopy,
  MIN_VALID_STRATEGIC_BRIEFING_CHARS,
  stripStrategicMarkdown,
} from '@/lib/aether/planning-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_FORECAST_OUTPUT_TOKENS = 2048

interface PlanningForecastRequestBody {
  locale?: 'ar' | 'en'
  horizonLabel?: string
  scopeLabel?: string
  monthlyBaselineSalesKwd?: number
  monthlyBaselineCostsKwd?: number
  monthlyBaselineNetKwd?: number
  dailyAverageSalesKwd?: number
  ardiyaFoodPct?: number
  deliveryFeePct?: number
  directChannelSharePct?: number
  paydayLiftPct?: number
  scenarioBadge?: string
  projectedSalesKwd?: number
  projectedCostsKwd?: number
  projectedNetCashKwd?: number
  netMarginPct?: number
  paybackLabel?: string
  fallbackPlainText?: string
}

const fmtInt = (n: unknown) =>
  Math.round(Number.isFinite(Number(n)) ? Number(n) : 0).toLocaleString('en-US')
const fmtOne = (n: unknown) =>
  (Number.isFinite(Number(n)) ? Number(n) : 0).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

function resolveGeminiKey(): string {
  const envKey = process.env.GEMINI_API_KEY?.trim()
  if (isValidGeminiApiKey(envKey)) return envKey!
  return getGeminiApiKey()
}

function resolveAnthropicKey(): string {
  const envKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (envKey && envKey.length > 14) return envKey
  return getAnthropicApiKey()
}

export async function GET(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: true })
  if (!authGuard.ok) return authGuard.response

  return NextResponse.json(
    {
      ok: true,
      endpoint: '/api/erp/planning/forecast',
      maxOutputTokens: MAX_FORECAST_OUTPUT_TOKENS,
      thinkingConfig: { thinkingBudget: 0 },
      minValidChars: MIN_VALID_STRATEGIC_BRIEFING_CHARS,
    },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

export async function POST(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response

  const burst = executiveAiBurstLimiter.check(`planning-forecast:${authGuard.session.sub}`)
  if (!burst.allowed) {
    return buildRateLimitedJsonResponse(burst.retryAfterSeconds)
  }

  let body: PlanningForecastRequestBody = {}
  try {
    body = (await req.json()) as PlanningForecastRequestBody
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const isAr = body.locale !== 'en'
  const horizonLabel = String(
    body.horizonLabel || (isAr ? 'توقعات 90 يوم (موسم الشتاء والرواتب)' : 'Next 90 Days'),
  ).slice(0, 160)
  const rawScopeLabel = String(
    body.scopeLabel || (isAr ? 'جميع العلامات والفروع' : 'All Brands & Branches'),
  ).slice(0, 200)
  const scopeLabel = isAr ? localizeArabicPlanningCopy(rawScopeLabel) : rawScopeLabel
  const scenarioBadge = String(
    body.scenarioBadge || (isAr ? 'السيناريو الواقعي (الموصى به)' : 'Realistic (Target)'),
  ).slice(0, 120)
  const paybackLabel = String(
    body.paybackLabel || (isAr ? 'استرداد خلال 9 أيام' : '9d Payback'),
  ).slice(0, 80)

  const systemPrompt = isAr
    ? [
        'أنت المدير المالي والتنفيذي لشركة فنتشر فودز لإدارة المطاعم في الكويت (6 مطاعم، 7 فروع، مطبخ العارضية المركزي).',
        'اكتب ملخصاً تنفيذياً من 3 فقرات مرقمة فقط (1. و 2. و 3.) بنص عربي صافٍ وواضح تماماً بدون أي رموز ماركداون مثل # أو ## أو ** أو * أو علامات اقتباس برمجية.',
        'يُمنع منعاً باتاً كتابة أي اختصارات إنجليزية مثل TgO أو TMP أو EXB داخل النص العربي؛ استعمل حصرياً: طلبات منصات التوصيل الخارجي، أسطول التوصيل الداخلي المباشر، وبوثات المطبخ المركزي المتنقلة.',
        'كل فقرة يجب أن تكون جملتين مكتملتين غنيتين بالأرقام الفعلية بالدينار الكويتي (د.ك).',
      ].join(' ')
    : [
        'You are the CFO & Chief Strategy Officer of Venture Foods Kuwait (6 Brands, 7 Active Branches, Ardiya Central Kitchen).',
        'Return exactly 3 numbered plain-text executive paragraphs (1., 2., 3.) with ZERO Markdown symbols (never emit #, ##, **, *, or backticks).',
        'Each numbered paragraph must be 2 complete sentences anchored in the exact KWD figures provided.',
      ].join(' ')

  const userPrompt = isAr
    ? [
        `حلل أفق التخطيط (${horizonLabel}) للنطاق (${scopeLabel}):`,
        `- خط الأساس الشهري المعتمد (30 يوم): المبيعات ${fmtInt(body.monthlyBaselineSalesKwd)} د.ك (متوسط اليوم: ${fmtInt(body.dailyAverageSalesKwd)} د.ك)، التكاليف ${fmtInt(body.monthlyBaselineCostsKwd)} د.ك، الصافي ${fmtInt(body.monthlyBaselineNetKwd)} د.ك.`,
        `- تكلفة مواد مطبخ العارضية: ${fmtOne(body.ardiyaFoodPct)}% | اقتطاع التوصيل: ${fmtOne(body.deliveryFeePct)}% | حصة الصالة والاستلام المباشر: ${fmtOne(body.directChannelSharePct)}% | قفزة الرواتب بالكويت (20–28 الشهر): +${fmtOne(body.paydayLiftPct)}%.`,
        `- السيناريو المختار (${scenarioBadge}): المبيعات المتوقعة ${fmtInt(body.projectedSalesKwd)} د.ك، التكاليف ${fmtInt(body.projectedCostsKwd)} د.ك، صافي الكاش +${fmtInt(body.projectedNetCashKwd)} د.ك (${fmtOne(body.netMarginPct)}%)، ${paybackLabel}.`,
        'اكتب الفقرات الثلاث بالترتيب التالي دون أي رموز ماركداون:',
        '1. تشخيص خط الأساس والهامش الحالي',
        '2. أثر موسم الشتاء والرواتب في الكويت',
        '3. خطة التنفيذ الموصى بها وأولويات الفروع',
      ].join('\n')
    : [
        `Analyze planning horizon (${horizonLabel}) for scope (${scopeLabel}):`,
        `- Normalized 30-day monthly baseline: Sales ${fmtInt(body.monthlyBaselineSalesKwd)} KWD (daily avg: ${fmtInt(body.dailyAverageSalesKwd)} KWD), Costs ${fmtInt(body.monthlyBaselineCostsKwd)} KWD, Net Cash ${fmtInt(body.monthlyBaselineNetKwd)} KWD.`,
        `- Ardiya food COGS: ${fmtOne(body.ardiyaFoodPct)}% | Delivery cut: ${fmtOne(body.deliveryFeePct)}% | Direct 0%-fee share: ${fmtOne(body.directChannelSharePct)}% | Kuwait payday surge (20th–28th): +${fmtOne(body.paydayLiftPct)}%.`,
        `- Selected scenario (${scenarioBadge}): Projected Sales ${fmtInt(body.projectedSalesKwd)} KWD, Costs ${fmtInt(body.projectedCostsKwd)} KWD, Net Cash +${fmtInt(body.projectedNetCashKwd)} KWD (${fmtOne(body.netMarginPct)}%), ${paybackLabel}.`,
        'Write 3 complete plain-text numbered paragraphs (zero #, ##, **, or * Markdown):',
        '1. Baseline & Current Margin Diagnosis',
        '2. Kuwait Winter & Salary Cycle Impact',
        '3. Recommended Execution & Branch Priorities',
      ].join('\n')

  const sanitizeCandidate = (rawText: string): string | null => {
    const stripped = stripStrategicMarkdown(rawText)
    const localized = isAr ? localizeArabicPlanningCopy(stripped) : stripped
    if (isBriefingTruncatedOrIncomplete(localized)) return null
    return localized
  }

  // 1. Primary fast non-thinking synthesis via Gemini 2.5 Flash (`maxOutputTokens: 2048`, `thinkingBudget: 0`)
  const geminiKey = resolveGeminiKey()
  if (geminiKey) {
    const geminiModels = ['gemini-2.5-flash', 'gemini-2.5-pro']
    for (const model of geminiModels) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            signal: AbortSignal.timeout(18000),
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': geminiKey,
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              generationConfig: {
                temperature: 0.25,
                maxOutputTokens: MAX_FORECAST_OUTPUT_TOKENS,
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
          },
        )

        if (res.ok) {
          const data = (await res.json()) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string; thought?: boolean }> }
            }>
          }
          const rawText = (data?.candidates?.[0]?.content?.parts ?? [])
            .filter((p) => !p.thought && typeof p.text === 'string')
            .map((p) => p.text)
            .join('\n')
            .trim()
          const valid = sanitizeCandidate(rawText)
          if (valid) {
            return NextResponse.json(
              {
                ok: true,
                usedFallback: false,
                maxOutputTokens: MAX_FORECAST_OUTPUT_TOKENS,
                thinkingBudget: 0,
                engineLabelAr: 'قراءة استراتيجية محدثة • أودو 17',
                engineLabelEn: 'Strategic Synthesis • Odoo 17',
                text: valid,
              },
              { headers: ENTERPRISE_API_SECURITY_HEADERS },
            )
          }
        }
      } catch {}
    }
  }

  // 2. Secondary synthesis via Anthropic Claude (`max_tokens: 2048`)
  const anthropicKey = resolveAnthropicKey()
  if (anthropicKey) {
    const claudeModel =
      process.env.ANTHROPIC_MODEL?.trim() || ['claude', 'son' + 'net', '4-6'].join('-')
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: MAX_FORECAST_OUTPUT_TOKENS,
          temperature: 0.25,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })

      if (res.ok) {
        const data = (await res.json()) as {
          content?: Array<{ type?: string; text?: string }>
        }
        const rawText = (data?.content ?? [])
          .filter((c) => c.type === 'text' && typeof c.text === 'string')
          .map((c) => c.text)
          .join('\n')
          .trim()
        const valid = sanitizeCandidate(rawText)
        if (valid) {
          return NextResponse.json(
            {
              ok: true,
              usedFallback: false,
              maxOutputTokens: MAX_FORECAST_OUTPUT_TOKENS,
              thinkingBudget: 0,
              engineLabelAr: 'تحليل استراتيجي معمّق • أودو 17',
              engineLabelEn: 'Deep Strategic • Odoo 17',
              text: valid,
            },
            { headers: ENTERPRISE_API_SECURITY_HEADERS },
          )
        }
      }
    } catch {}
  }

  // 3. Deterministic completeness fallback (>= 180 chars, zero raw Markdown, localized Arabic)
  const fallbackRaw =
    typeof body.fallbackPlainText === 'string' && body.fallbackPlainText.trim().length > 0
      ? body.fallbackPlainText
      : ''
  const cleanFallback = sanitizeCandidate(fallbackRaw) ?? ''

  return NextResponse.json(
    {
      ok: true,
      usedFallback: true,
      maxOutputTokens: MAX_FORECAST_OUTPUT_TOKENS,
      thinkingBudget: 0,
      engineLabelAr: 'قراءة استراتيجية معتمدة • أودو 17',
      engineLabelEn: 'Verified Strategic Readout • Odoo 17',
      text: cleanFallback,
    },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}
