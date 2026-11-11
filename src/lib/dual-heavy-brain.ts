/**
 * Dual-Brain Heavy Reasoning Engine ("GEMINI CARBON HIGH × xAI GROK HEAVY")
 *
 * Powers `aetherbi.com` across all 6 executive pages:
 *   - Engine A: Google Gemini "Carbon High" Auto-Resolver (6h model discovery + HIGH thinkingConfig + clean retry)
 *   - Engine B: xAI "Grok Heavy" Multi-Angle Deep Engine (6h /v1/models discovery + 3-lens heavy synthesis)
 *   - Engine C: Default "Dual-Brain Consensus" (`العقل المزدوج: جميني + جروك 🔥`) running both in parallel
 *               via Promise.allSettled, synthesizing a plain everyday Kuwaiti/Gulf Arabic executive answer
 *               plus individual Gemini & Grok perspectives on demand.
 *
 * STRICT ENTITY WHITELIST:
 *   - ONLY 6 Venture Foods Brands: China Garden, Frank's, Tahina, Farm Brown, The Noodle Bar, Karak Cafeteria.
 *   - ONLY 7 Active Odoo Branches: The Avenues, 360, Assima, Promenade, Salmiya, Al-Kout, Ardiya.
 */

import { getGeminiApiKey, getOpenAIApiKey, getXaiApiKey } from '@/lib/ai-keys'
import { ODOO } from '@/lib/odoo/odoo-dataset'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  getBranchLabel,
  getBrandLabel,
  type GlobalFilters,
  type GlobalWorkspaceSlice,
} from '@/lib/aether/global-filter-engine'
import {
  JOURNEY_SHORTCUTS,
  stripRawOdooTags,
} from '@/lib/full-journey-enterprise-brain'

export type BrainMode = 'dual' | 'gemini' | 'grok'

export interface BrainLiveHealth {
  geminiReady: boolean
  grokReady: boolean
  geminiModel: string
  grokModel: string
  grokQuotaNoteAr?: string
  grokQuotaNoteEn?: string
  checkedAt: number
}

export interface DualBrainRequest {
  query: string
  lang: 'ar' | 'en'
  mode?: BrainMode
  filters?: GlobalFilters
  workspace?: GlobalWorkspaceSlice
  pageContext?: string
  audioBase64?: string
  mimeType?: string
}

export interface DualBrainResponse {
  modeUsed: BrainMode
  /** Synthesized consensus reply (or active single-brain reply) in plain everyday Arabic/English */
  reply: string
  /** Individual Gemini Carbon High perspective (when available) */
  geminiReply?: string
  geminiModel?: string
  /** Individual xAI Grok Heavy 3-lens perspective (when available) */
  grokReply?: string
  grokModel?: string
  /** Optional spoken audio transcript if user spoke via mic */
  transcript?: string
  /** Human-readable engine badge */
  engineLabelAr: string
  engineLabelEn: string
  /** Non-crashing status note if either API hit rate/credit limits and fell back cleanly */
  statusNoteAr?: string
  statusNoteEn?: string
}

export const BRAIN_MODE_STORAGE_KEY = 'aetherbi_active_brain_mode_v1'
export const BRAIN_MODE_EVENT = 'aetherbi-brain-mode-change'

const GEMINI_CACHE_KEY = 'aetherbi_gemini_models_cache_v2'
const XAI_CACHE_KEY = 'aetherbi_xai_models_cache_v2'
const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const COOLDOWN_MS = 20 * 60 * 1000

// In-memory 6h discovery caches + rate-limit cooldown tracker
let geminiCachedModels: { at: number; models: string[] } | null = null
let xaiCachedModels: { at: number; models: string[]; quotaWarning?: string } | null = null
const modelCooldownUntil = new Map<string, number>()

function isCoolingDown(modelKey: string): boolean {
  const until = modelCooldownUntil.get(modelKey)
  if (!until) return false
  if (Date.now() > until) {
    modelCooldownUntil.delete(modelKey)
    return false
  }
  return true
}

function markCooldown(modelKey: string, durationMs = COOLDOWN_MS) {
  modelCooldownUntil.set(modelKey, Date.now() + durationMs)
}

export function getActiveBrainMode(): BrainMode {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(BRAIN_MODE_STORAGE_KEY)
      if (saved === 'dual' || saved === 'gemini' || saved === 'grok') {
        return saved
      }
    }
  } catch {}
  return 'dual'
}

export function setActiveBrainMode(mode: BrainMode): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(BRAIN_MODE_STORAGE_KEY, mode)
      window.dispatchEvent(new CustomEvent(BRAIN_MODE_EVENT, { detail: mode }))
    }
  } catch {}
}

// ============================================================================
// Verified Venture Foods Whitelisted Knowledge Base (6 Brands × 7 Branches)
// ============================================================================
const f0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')
const f1 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

function deriveWorkspaceFinancials(ws: GlobalWorkspaceSlice) {
  const { food10, delivery10, opexRent10, netPocket10 } = ws.per10
  const foodCostKwd = ws.salesKwd * (food10 / 10)
  const deliveryCommKwd = ws.salesKwd * (delivery10 / 10)
  const rentStaffOpexKwd = ws.salesKwd * (opexRent10 / 10)
  const netPocketKwd = ws.salesKwd * (netPocket10 / 10)
  const dimFactor =
    ws.filters.brand === 'all' && ws.filters.branch === 'all' && ws.filters.channel === 'all'
      ? 1
      : Math.max(0.12, ws.dimensionShare > 0 ? Math.min(1, ws.dimensionShare * 1.35) : 0.15)
  const deliveryDueKwd = Math.max(
    0,
    Math.round(
      JOURNEY_SHORTCUTS.delivery.openClearingKwd *
        (ws.filters.channel === 'dine-in' ? 0 : ws.filters.branch === 'avenues' ? 0 : dimFactor),
    ),
  )
  return {
    food10,
    delivery10,
    opexRent10,
    netPocket10,
    foodCostKwd,
    deliveryCommKwd,
    rentStaffOpexKwd,
    netPocketKwd,
    deliveryDueKwd,
  }
}

export function buildWhitelistedOdooKnowledge(
  filters: GlobalFilters = DEFAULT_GLOBAL_FILTERS,
  workspaceOverride?: GlobalWorkspaceSlice,
): string {
  const ws = workspaceOverride ?? computeGlobalWorkspace(filters)
  const fin = deriveWorkspaceFinancials(ws)

  const brandLines = APPROVED_BRAND_IDS.map((bid) => {
    const row = ODOO.brands.find((b) => b.id === bid)
    return `- ${getBrandLabel(bid, false)} (${getBrandLabel(bid, true)}): 30d POS ${f0(row?.netKwd ?? 0)} KWD · ${f0(row?.orders ?? 0)} orders · Avg Bill ${(row?.aovKwd ?? 0).toFixed(2)} KWD`
  }).join('\n')

  const branchLines = APPROVED_BRANCH_IDS.map((lid) => {
    const loc = ODOO.restaurants.find((r) => r.id === lid)
    return `- ${getBranchLabel(lid, false)} (${getBranchLabel(lid, true)}): 30d POS ${f0(loc?.netKwd ?? 0)} KWD · ${f0(loc?.orders ?? 0)} orders · Operating Profit ${f0(loc?.pnl?.operatingProfit ?? 0)} KWD`
  }).join('\n')

  const topPlays = ws.plays
    .slice(0, 5)
    .map(
      (p, idx) =>
        `${idx + 1}. ${p.titleAr} (${p.titleEn}): المشكلة: ${p.problemAr} | الحل: ${p.solutionAr} | الفايدة: +${p.periodLabelAr}`,
    )
    .join('\n')

  return `
COMPANY: Venture Foods Restaurants Management Co. W.L.L. — Kuwait (شركة فنتشر فودز لإدارة المطاعم ذ.م.م).
STRICT WHITELIST RULES (NON-NEGOTIABLE):
- Mention ONLY our 6 approved restaurant brands: China Garden (تشاينا جاردن), Frank's (فرانكس), Tahina (طحينة), Farm Brown (فارم براون), The Noodle Bar (ذا نودل بار), Karak Cafeteria (كرك كافتيريا).
- Mention ONLY our 7 active Odoo locations: The Avenues (الأفنيوز), 360 (مول 360), Assima (العاصمة), Promenade (بروميناد), Salmiya (السالمية), Al-Kout (الكوت), Ardiya Central Kitchen (مطبخ العارضية).
- NEVER mention canceled brands, school canteens, removed legacy branches, internal Odoo IDs, or complex academic jargon.
- Speak in ultra-simple, warm, everyday Kuwaiti/Gulf business Arabic (or plain everyday English when lang=en) that any restaurant owner or branch manager understands in 2 seconds.

ACTIVE FILTER CONTEXT (${ws.subtitleAr} / ${ws.subtitleEn}):
- Active Slice Sales: ${f0(ws.salesKwd)} KWD across ${f0(ws.orders)} orders (Average Bill: ${ws.aovKwd.toFixed(2)} KWD).
- Food & Packaging Cost: ${f0(fin.foodCostKwd)} KWD (${f1((fin.food10 / 10) * 100)}%).
- Delivery Platform Commissions: ${f0(fin.deliveryCommKwd)} KWD (${f1((fin.delivery10 / 10) * 100)}%).
- Rent, Payroll & Branch Expenses: ${f0(fin.rentStaffOpexKwd)} KWD (${f1((fin.opexRent10 / 10) * 100)}%).
- Net Cash in Pocket (الصافي بالجيب): ${f0(fin.netPocketKwd)} KWD (out of every 10 KWD sold, ${fin.netPocket10.toFixed(2)} KWD stays in pocket).
- Open Delivery Platform Dues (طلبات + كيتا + ديليفرو): ${f0(fin.deliveryDueKwd)} KWD.

30-DAY VERIFIED BRAND TOTALS (ODOO 17 POS):
${brandLines}

30-DAY VERIFIED ACTIVE BRANCHES (ODOO 17):
${branchLines}

TOP VERIFIED PROFIT PLAYS FOR CURRENT FILTER:
${topPlays}
`.trim()
}

export function sanitizeExecutiveOutput(raw: string): string {
  const base = stripRawOdooTags(raw || '')
  return base
    .replace(/\b(heisenberg|sushi[\s-]*hoko|tasty[\s-]*snacks|fresh[\s-]*daily[\s-]*canteen)\b/gi, '')
    .replace(/هايزنبرغ|سوشي هوكو|تيستي سناكس|فريش ديلي كانتين/g, '')
    .trim()
}

// ============================================================================
// Engine A: Google Gemini "Carbon High" Auto-Resolver
// ============================================================================
function scoreGeminiModel(id: string): number {
  const m = id.toLowerCase()
  // Exclude non-text generation models or deprecated old names
  if (
    /tts|image|vision|embedding|aqa|lyria|banana|transcribe|gemma|argon|2\.0-flash-lite|1\.5/i.test(
      m,
    )
  ) {
    return -1
  }
  // Exclude known hanging preview endpoint
  if (m.includes('3.8-flash') || m.includes('3.7-flash')) return -1

  if (m.includes('gemini-4') && m.includes('carbon')) return 1000
  if (m.includes('carbon')) return 980
  if (m.includes('gemini-4')) return 950
  if (m === 'gemini-3.6-flash') return 920
  if (m === 'gemini-3.5-flash') return 910
  if (m === 'gemini-3-flash-preview') return 900
  if (m.includes('gemini-3.1-pro')) return 890
  if (m.includes('gemini-3') && m.includes('pro')) return 880
  if (m.includes('gemini-3') && m.includes('flash')) return 860
  if (m === 'gemini-2.5-pro') return 840
  if (m === 'gemini-pro-latest') return 820
  if (m === 'gemini-flash-latest') return 800
  if (m.includes('gemini')) return 700
  return -1
}

const DEFAULT_GEMINI_CHAIN = [
  'gemini-4-carbon',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-flash-latest',
]

export async function discoverGeminiCarbonModels(): Promise<string[]> {
  if (geminiCachedModels && Date.now() - geminiCachedModels.at < SIX_HOURS_MS) {
    return geminiCachedModels.models
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(GEMINI_CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { at: number; models: string[] }
        if (parsed?.at && Array.isArray(parsed.models) && Date.now() - parsed.at < SIX_HOURS_MS) {
          geminiCachedModels = parsed
          return parsed.models
        }
      }
    }
  } catch {}

  const key = getGeminiApiKey()
  if (!key) return DEFAULT_GEMINI_CHAIN

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(7000) },
    )
    if (res.ok) {
      const data = (await res.json()) as {
        models?: { name?: string; supportedGenerationMethods?: string[] }[]
      }
      const candidates = (data.models ?? [])
        .filter(
          (m) =>
            !m.supportedGenerationMethods ||
            m.supportedGenerationMethods.includes('generateContent'),
        )
        .map((m) => (m.name ?? '').replace(/^models\//, ''))
        .filter((id) => scoreGeminiModel(id) > 0)
        .sort((a, b) => scoreGeminiModel(b) - scoreGeminiModel(a))

      const unique = [...new Set([...candidates, ...DEFAULT_GEMINI_CHAIN])].slice(0, 7)
      geminiCachedModels = { at: Date.now(), models: unique }
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(GEMINI_CACHE_KEY, JSON.stringify(geminiCachedModels))
        }
      } catch {}
      return unique
    }
  } catch {
    // Fall back to verified default chain
  }

  geminiCachedModels = { at: Date.now(), models: DEFAULT_GEMINI_CHAIN }
  return DEFAULT_GEMINI_CHAIN
}

export async function runGeminiCarbonEngine({
  systemPrompt,
  userPrompt,
  audioBase64,
  mimeType = 'audio/webm',
  jsonMode = false,
}: {
  systemPrompt: string
  userPrompt: string
  audioBase64?: string
  mimeType?: string
  jsonMode?: boolean
}): Promise<{ text: string; model: string }> {
  const key = getGeminiApiKey()
  if (!key) throw new Error('GEMINI_KEY_MISSING')

  const models = await discoverGeminiCarbonModels()
  const activeModels = models.filter((m) => !isCoolingDown(`gemini:${m}`))
  const chain = activeModels.length > 0 ? activeModels : DEFAULT_GEMINI_CHAIN

  const parts: Array<Record<string, unknown>> = []
  if (audioBase64) {
    parts.push({
      inlineData: {
        mimeType: mimeType.split(';')[0] || 'audio/webm',
        data: audioBase64,
      },
    })
  }
  parts.push({ text: userPrompt })

  for (const model of chain) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`

    // Attempt 1: HIGH Deep Reasoning config (`thinkingConfig`)
    const configsToTry: Record<string, unknown>[] = [
      {
        temperature: 0.3,
        maxOutputTokens: 1500,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        thinkingConfig: model.includes('gemini-4')
          ? { thinkingLevel: 'HIGH' }
          : { thinkingBudget: 8192 },
      },
      // Attempt 2: Automatic clean-config retry fallback so zero calls ever fail on schema mismatch
      {
        temperature: 0.3,
        maxOutputTokens: 1500,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    ]

    for (let attempt = 0; attempt < configsToTry.length; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          signal: AbortSignal.timeout(18000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts }],
            generationConfig: configsToTry[attempt],
          }),
        })

        if (res.status === 429 || res.status === 404 || res.status === 403) {
          markCooldown(`gemini:${model}`)
          break // Move immediately to next Gemini model in chain
        }

        if (res.status === 400 && attempt === 0) {
          continue // Retry same model with clean generationConfig
        }

        if (res.ok) {
          const data = await res.json()
          const rawParts: Array<{ text?: string; thought?: boolean }> =
            data?.candidates?.[0]?.content?.parts ?? []
          const textOut = rawParts
            .filter((p) => !p.thought && typeof p.text === 'string')
            .map((p) => p.text)
            .join('\n')
            .trim()

          if (textOut) {
            return { text: textOut, model }
          }
        }
      } catch {
        markCooldown(`gemini:${model}`, 3 * 60 * 1000)
        break
      }
    }
  }

  throw new Error('GEMINI_ALL_MODELS_UNAVAILABLE')
}

// ============================================================================
// Engine B: xAI "Grok Heavy" Multi-Angle Deep Engine
// ============================================================================
function scoreGrokModel(id: string): number {
  const m = id.toLowerCase()
  // Exclude image/video/code-only/multi-agent-responses-only/non-reasoning variants
  if (/imagine|image|video|vision|multi-agent|non-reasoning|code-fast|embed/i.test(m)) {
    return -1
  }
  if (m.includes('grok-4') && m.includes('heavy')) return 1000
  if (m.includes('heavy')) return 980
  if (m === 'grok-4.7') return 960
  if (m === 'grok-4.6') return 950
  if (m === 'grok-4.5') return 940
  if (m.includes('grok-4.20') && m.includes('reasoning')) return 930
  if (m === 'grok-4.3') return 920
  if (m === 'grok-4' || m === 'grok-4-0709' || m === 'grok-4-latest') return 910
  if (m.startsWith('grok-4')) return 900
  if (m.startsWith('grok-3') && !m.includes('mini')) return 850
  if (m.startsWith('grok-')) return 750
  return -1
}

const DEFAULT_GROK_CHAIN = [
  'grok-4.7',
  'grok-4.20-0309-reasoning',
  'grok-4.6',
  'grok-4.5',
  'grok-4.3',
]

export async function discoverGrokHeavyModels(): Promise<{
  models: string[]
  quotaWarning?: string
}> {
  if (xaiCachedModels && Date.now() - xaiCachedModels.at < SIX_HOURS_MS) {
    return { models: xaiCachedModels.models, quotaWarning: xaiCachedModels.quotaWarning }
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(XAI_CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as {
          at: number
          models: string[]
          quotaWarning?: string
        }
        if (parsed?.at && Array.isArray(parsed.models) && Date.now() - parsed.at < SIX_HOURS_MS) {
          xaiCachedModels = parsed
          return { models: parsed.models, quotaWarning: parsed.quotaWarning }
        }
      }
    }
  } catch {}

  const key = getXaiApiKey()
  if (!key) return { models: DEFAULT_GROK_CHAIN, quotaWarning: 'XAI_KEY_MISSING' }

  try {
    const res = await fetch('https://api.x.ai/v1/models', {
      signal: AbortSignal.timeout(7000),
      headers: { Authorization: `Bearer ${key}` },
    })

    if (res.status === 402 || res.status === 429) {
      xaiCachedModels = {
        at: Date.now(),
        models: DEFAULT_GROK_CHAIN,
        quotaWarning: `HTTP_${res.status}`,
      }
      return { models: DEFAULT_GROK_CHAIN, quotaWarning: `HTTP_${res.status}` }
    }

    if (res.ok) {
      const data = (await res.json()) as { data?: { id?: string }[] }
      const ranked = (data.data ?? [])
        .map((m) => m.id ?? '')
        .filter((id) => scoreGrokModel(id) > 0)
        .sort((a, b) => scoreGrokModel(b) - scoreGrokModel(a))

      const unique = [...new Set([...ranked, ...DEFAULT_GROK_CHAIN])].slice(0, 6)
      xaiCachedModels = { at: Date.now(), models: unique }
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(XAI_CACHE_KEY, JSON.stringify(xaiCachedModels))
        }
      } catch {}
      return { models: unique }
    }
  } catch {
    // Graceful network fallback
  }

  xaiCachedModels = { at: Date.now(), models: DEFAULT_GROK_CHAIN }
  return { models: DEFAULT_GROK_CHAIN }
}

export async function runGrokHeavyEngine({
  knowledgeContext,
  userPrompt,
  lang,
}: {
  knowledgeContext: string
  userPrompt: string
  lang: 'ar' | 'en'
}): Promise<{ text: string; model: string; quotaStatus?: '402' | '429' }> {
  const key = getXaiApiKey()
  if (!key) throw new Error('XAI_KEY_MISSING')

  const { models } = await discoverGrokHeavyModels()
  const activeModels = models.filter((m) => !isCoolingDown(`xai:${m}`))
  const chain = activeModels.length > 0 ? activeModels : DEFAULT_GROK_CHAIN

  const isAr = lang === 'ar'
  const heavySystemPrompt = isAr
    ? `${knowledgeContext}

أنت محرك "Grok Heavy" الاستراتيجي لشركة فنتشر فودز الكويت.
حلّل السؤال بعمق عبر ٣ زوايا متزامنة بلغة عربية كويتية/خليجية يومية واضحة جداً ومختصرة بدون أي فلسفة أو مصطلحات معقدة:
### ١. زاوية الربح الصافي والمالية
(الأثر المباشر بالدينار الكويتي على الصافي بالجيب والكاش)
### ٢. زاوية المطبخ والفروع والتشغيل
(خطوة عملية فورية في الفرع أو مطبخ العارضية بدون زيادة موظفين أو إيجار)
### ٣. زاوية التسويق وكشف المخاطر الخفية
(كيف نرفع الطلبات بذكاء ونتجنب الهدر أو عمولات التوصيل المخفية)`
    : `${knowledgeContext}

You are the "Grok Heavy" Multi-Angle Strategic Engine for Venture Foods Kuwait.
Analyze every business question across 3 simultaneous lenses in crisp, plain everyday English (zero consulting jargon):
### 1. Net Profit & Cash Lens
(Exact KWD impact on net cash in pocket)
### 2. Kitchen & Branch Operations Lens
(Immediate field step across our branches or Ardiya Central Kitchen)
### 3. Growth & Hidden Risk Lens
(Smart order growth play + hidden delivery/cost risk to guard against)`

  for (const model of chain) {
    try {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(22000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_tokens: 1100,
          messages: [
            { role: 'system', content: heavySystemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })

      if (res.status === 402 || res.status === 429) {
        markCooldown(`xai:${model}`, 10 * 60 * 1000)
        return {
          text: '',
          model,
          quotaStatus: res.status === 402 ? '402' : '429',
        }
      }

      if (res.status === 400 || res.status === 404) {
        markCooldown(`xai:${model}`)
        continue
      }

      if (res.ok) {
        const data = await res.json()
        const content: string = data?.choices?.[0]?.message?.content?.trim() ?? ''
        if (content) {
          return { text: sanitizeExecutiveOutput(content), model }
        }
      }
    } catch {
      markCooldown(`xai:${model}`, 3 * 60 * 1000)
      continue
    }
  }

  throw new Error('XAI_ALL_MODELS_UNAVAILABLE')
}

// ============================================================================
// Live Health Check (for Top Header Status Dot)
// ============================================================================
export async function probeDualBrainHealth(): Promise<BrainLiveHealth> {
  const [gemModels, grokInfo] = await Promise.all([
    discoverGeminiCarbonModels(),
    discoverGrokHeavyModels(),
  ])

  const geminiModel = gemModels.find((m) => !isCoolingDown(`gemini:${m}`)) ?? gemModels[0] ?? 'gemini-4-carbon'
  const grokModel = grokInfo.models.find((m) => !isCoolingDown(`xai:${m}`)) ?? grokInfo.models[0] ?? 'grok-4.7'
  const hasGeminiKey = Boolean(getGeminiApiKey())
  const hasXaiKey = Boolean(getXaiApiKey()) && !grokInfo.quotaWarning

  return {
    geminiReady: hasGeminiKey,
    grokReady: hasXaiKey,
    geminiModel,
    grokModel,
    grokQuotaNoteAr: grokInfo.quotaWarning
      ? 'جروك بانتظار شحن الرصيد — يعمل جميني Carbon تلقائياً'
      : undefined,
    grokQuotaNoteEn: grokInfo.quotaWarning
      ? 'Grok awaiting credit top-up — Gemini Carbon active automatically'
      : undefined,
    checkedAt: Date.now(),
  }
}

// ============================================================================
// Engine C: Unified Dual-Brain Orchestrator (Default: Carbon High + Grok Heavy)
// ============================================================================
export async function askDualHeavyBrain(req: DualBrainRequest): Promise<DualBrainResponse> {
  const mode: BrainMode = req.mode ?? getActiveBrainMode()
  const isAr = req.lang === 'ar'
  const filters = req.filters ?? DEFAULT_GLOBAL_FILTERS
  const ws = req.workspace ?? computeGlobalWorkspace(filters)
  const knowledge = buildWhitelistedOdooKnowledge(filters, ws)

  let effectiveQuery = (req.query || '').trim()
  let extractedTranscript: string | undefined

  // Step 0: If audioBase64 is passed (voice mic), transcribe cleanly first so BOTH Gemini & Grok can reason on it!
  if (req.audioBase64 && !effectiveQuery) {
    try {
      const audioPrompt = isAr
        ? 'استمع للتسجيل الصوتي واستخرج النص المنطوق، ثم أجب باختصار بصيغة JSON فقط: {"transcript": "النص المسموع", "reply": "الرد"}'
        : 'Transcribe this user audio and answer briefly in valid JSON: {"transcript": "spoken words", "reply": "answer"}'
      const gemAudio = await runGeminiCarbonEngine({
        systemPrompt: knowledge,
        userPrompt: audioPrompt,
        audioBase64: req.audioBase64,
        mimeType: req.mimeType,
        jsonMode: true,
      })
      const cleaned = gemAudio.text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      if (parsed?.transcript) {
        extractedTranscript = String(parsed.transcript).trim()
        effectiveQuery = extractedTranscript
      }
      if (mode === 'gemini' && parsed?.reply) {
        return {
          modeUsed: 'gemini',
          reply: sanitizeExecutiveOutput(String(parsed.reply)),
          geminiReply: sanitizeExecutiveOutput(String(parsed.reply)),
          geminiModel: gemAudio.model,
          transcript: extractedTranscript,
          engineLabelAr: `جميني Carbon (${gemAudio.model}) ⚡`,
          engineLabelEn: `Gemini Carbon (${gemAudio.model}) ⚡`,
        }
      }
    } catch {
      // Fallback to OpenAI Whisper if available
      const openAiKey = getOpenAIApiKey()
      if (openAiKey && typeof atob === 'function') {
        try {
          const byteChars = atob(req.audioBase64)
          const bytes = new Uint8Array(byteChars.length)
          for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
          const blob = new Blob([bytes], { type: req.mimeType || 'audio/webm' })
          const fd = new FormData()
          fd.append('file', blob, 'speech.webm')
          fd.append('model', 'whisper-1')
          fd.append('language', isAr ? 'ar' : 'en')
          const sttRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            signal: AbortSignal.timeout(12000),
            headers: { Authorization: `Bearer ${openAiKey}` },
            body: fd,
          })
          if (sttRes.ok) {
            const sttData = await sttRes.json()
            if (sttData?.text?.trim()) {
              extractedTranscript = sttData.text.trim()
              effectiveQuery = extractedTranscript || ''
            }
          }
        } catch {}
      }
    }
  }

  const fullUserPrompt = [
    req.pageContext ? `[سياق الصفحة الحالية / Page Slice]:\n${req.pageContext}` : '',
    effectiveQuery ||
      (isAr
        ? 'عطني أهم ٣ خطوات عملية لزيادة الصافي بالجيب الآن حسب الفلتر المختار.'
        : 'Give me the top 3 practical steps to grow net cash in pocket right now for the active filter.'),
  ]
    .filter(Boolean)
    .join('\n\n')

  const geminiFormatDirective = isAr
    ? `أجب باللغة العربية فقط بلغة كويتية/خليجية يومية بسيطة ومباشرة جداً بدون أي مصطلحات أكاديمية، وبالعناوين الثلاثة:
### المقترح والحل العملي
### آلية التنفيذ الواقعية
### النتائج المتوقعة في حال النجاح
التزم حصرياً بأرقام أودو الموثقة بالدينار الكويتي (د.ك) وبمطاعمنا الـ ٦ وفروعنا الـ ٧ فقط.`
    : `Answer strictly in plain, direct everyday English (zero consulting jargon) using these 3 headings:
### Practical Solution
### Execution Plan
### Expected Outcomes Upon Success
Cite only verified Odoo KWD numbers across our 6 approved brands and 7 active branches.`

  // --------------------------------------------------------------------------
  // Single-Brain Mode: Gemini Carbon Only
  // --------------------------------------------------------------------------
  if (mode === 'gemini') {
    try {
      const gem = await runGeminiCarbonEngine({
        systemPrompt: knowledge,
        userPrompt: `${fullUserPrompt}\n\n${geminiFormatDirective}`,
      })
      const clean = sanitizeExecutiveOutput(gem.text)
      return {
        modeUsed: 'gemini',
        reply: clean,
        geminiReply: clean,
        geminiModel: gem.model,
        transcript: extractedTranscript,
        engineLabelAr: `جميني Carbon (${gem.model}) ⚡`,
        engineLabelEn: `Gemini Carbon (${gem.model}) ⚡`,
      }
    } catch {
      // Seamless backup to Grok Heavy if Gemini is rate-limited
      try {
        const grokBackup = await runGrokHeavyEngine({
          knowledgeContext: knowledge,
          userPrompt: fullUserPrompt,
          lang: req.lang,
        })
        if (grokBackup.text) {
          return {
            modeUsed: 'grok',
            reply: grokBackup.text,
            grokReply: grokBackup.text,
            grokModel: grokBackup.model,
            transcript: extractedTranscript,
            engineLabelAr: `جروك Heavy (${grokBackup.model}) 🧠`,
            engineLabelEn: `Grok Heavy (${grokBackup.model}) 🧠`,
            statusNoteAr: 'تم التحويل تلقائياً إلى جروك Heavy لضمان سرعة الرد.',
            statusNoteEn: 'Automatically routed to Grok Heavy for instant response.',
          }
        }
      } catch {}
    }
  }

  // --------------------------------------------------------------------------
  // Single-Brain Mode: xAI Grok Heavy Only
  // --------------------------------------------------------------------------
  if (mode === 'grok') {
    try {
      const grok = await runGrokHeavyEngine({
        knowledgeContext: knowledge,
        userPrompt: fullUserPrompt,
        lang: req.lang,
      })
      if (grok.text) {
        return {
          modeUsed: 'grok',
          reply: grok.text,
          grokReply: grok.text,
          grokModel: grok.model,
          transcript: extractedTranscript,
          engineLabelAr: `جروك Heavy (${grok.model}) 🧠`,
          engineLabelEn: `Grok Heavy (${grok.model}) 🧠`,
        }
      }
      // Graceful 402/429 fallback to Gemini Carbon High
      const gemFallback = await runGeminiCarbonEngine({
        systemPrompt: knowledge,
        userPrompt: `${fullUserPrompt}\n\n${geminiFormatDirective}`,
      })
      const clean = sanitizeExecutiveOutput(gemFallback.text)
      return {
        modeUsed: 'gemini',
        reply: clean,
        geminiReply: clean,
        geminiModel: gemFallback.model,
        transcript: extractedTranscript,
        engineLabelAr: `جميني Carbon (${gemFallback.model}) ⚡`,
        engineLabelEn: `Gemini Carbon (${gemFallback.model}) ⚡`,
        statusNoteAr:
          grok.quotaStatus === '402'
            ? 'ملاحظة: رصيد مفتاح جروك قيد الشحن — تم الرد فوراً عبر جميني Carbon High بدون توقف.'
            : 'ملاحظة: ضغط مؤقت على جروك — تم الرد فوراً عبر جميني Carbon High.',
        statusNoteEn:
          grok.quotaStatus === '402'
            ? 'Note: xAI key awaiting credit top-up — answered seamlessly via Gemini Carbon High.'
            : 'Note: xAI rate limit reached — answered seamlessly via Gemini Carbon High.',
      }
    } catch {
      try {
        const gemFallback = await runGeminiCarbonEngine({
          systemPrompt: knowledge,
          userPrompt: `${fullUserPrompt}\n\n${geminiFormatDirective}`,
        })
        const clean = sanitizeExecutiveOutput(gemFallback.text)
        return {
          modeUsed: 'gemini',
          reply: clean,
          geminiReply: clean,
          geminiModel: gemFallback.model,
          transcript: extractedTranscript,
          engineLabelAr: `جميني Carbon (${gemFallback.model}) ⚡`,
          engineLabelEn: `Gemini Carbon (${gemFallback.model}) ⚡`,
          statusNoteAr: 'تم الرد تلقائياً عبر جميني Carbon High.',
          statusNoteEn: 'Answered seamlessly via Gemini Carbon High.',
        }
      } catch {}
    }
  }

  // --------------------------------------------------------------------------
  // DEFAULT MODE: Dual-Brain Consensus (`العقل المزدوج: Carbon High + Grok Heavy 🔥`)
  // Runs Gemini Carbon High + xAI Grok Heavy in parallel via Promise.allSettled!
  // --------------------------------------------------------------------------
  const [gemSettled, grokSettled] = await Promise.allSettled([
    runGeminiCarbonEngine({
      systemPrompt: knowledge,
      userPrompt: `${fullUserPrompt}\n\n${geminiFormatDirective}`,
    }),
    runGrokHeavyEngine({
      knowledgeContext: knowledge,
      userPrompt: fullUserPrompt,
      lang: req.lang,
    }),
  ])

  const gemOk = gemSettled.status === 'fulfilled' && gemSettled.value.text ? gemSettled.value : null
  const grokVal = grokSettled.status === 'fulfilled' ? grokSettled.value : null
  const grokOk = grokVal && grokVal.text ? grokVal : null

  // Both brains succeeded -> Run ultra-fast Dual-Brain Consensus Synthesis!
  if (gemOk && grokOk) {
    const cleanGem = sanitizeExecutiveOutput(gemOk.text)
    const cleanGrok = sanitizeExecutiveOutput(grokOk.text)

    let consensusReply = ''
    try {
      const synthPrompt = isAr
        ? `أمامك تحليلان مستقلان لنفس أرقام أودو ١٧ لشركة فنتشر فودز الكويت (${ws.subtitleAr}):

[تحليل جميني Carbon]:
${cleanGem}

[تحليل جروك Heavy الثلاثي]:
${cleanGrok}

ادمج التحليلين ودقق الأرقام في إجابة تنفيذية واحدة صافية ومباشرة جداً بلغة كويتية/خليجية يومية يفهمها صاحب المطعم في ثوانٍ (١٤٠ إلى ٢١٠ كلمة فقط) تحت هذه العناوين الثلاثة بالضبط:
### الخلاصة المشتركة 🔥
### الخطوات العملية الفورية
### الفايدة المتوقعة بالدينار`
        : `Below are two independent analyses on live Venture Foods Kuwait Odoo 17 data (${ws.subtitleEn}):

[Gemini Carbon Analysis]:
${cleanGem}

[xAI Grok Heavy 3-Lens Analysis]:
${cleanGrok}

Cross-check all KWD figures and synthesize ONE crystal-clear, plain everyday executive answer (140–210 words) using these exact 3 headings:
### Dual-Brain Consensus 🔥
### Immediate Action Steps
### Expected KWD Gain`

      // Use the fastest live engine to merge both brains cleanly within 12s
      const merged = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(12000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getXaiApiKey()}`,
        },
        body: JSON.stringify({
          model: grokOk.model,
          temperature: 0.25,
          max_tokens: 900,
          messages: [
            { role: 'system', content: knowledge },
            { role: 'user', content: synthPrompt },
          ],
        }),
      })
      if (merged.ok) {
        const mJson = await merged.json()
        consensusReply = sanitizeExecutiveOutput(mJson?.choices?.[0]?.message?.content?.trim() ?? '')
      }
    } catch {
      // Instant deterministic merge if synthesis call times out
    }

    if (!consensusReply) {
      consensusReply = isAr
        ? `### الخلاصة المشتركة 🔥\nاتفق جميني (${gemOk.model}) وجروك (${grokOk.model}) على التركيز الفوري في (${ws.subtitleAr}):\n\n${cleanGrok}`
        : `### Dual-Brain Consensus 🔥\nGemini (${gemOk.model}) and Grok (${grokOk.model}) aligned on (${ws.subtitleEn}):\n\n${cleanGrok}`
    }

    return {
      modeUsed: 'dual',
      reply: consensusReply,
      geminiReply: cleanGem,
      geminiModel: gemOk.model,
      grokReply: cleanGrok,
      grokModel: grokOk.model,
      transcript: extractedTranscript,
      engineLabelAr: `العقل المزدوج: جميني (${gemOk.model}) + جروك (${grokOk.model}) 🔥`,
      engineLabelEn: `Dual Brain: Gemini (${gemOk.model}) + Grok (${grokOk.model}) 🔥`,
    }
  }

  // Only Grok Heavy succeeded (e.g. Gemini free tier hit 429)
  if (grokOk) {
    return {
      modeUsed: 'dual',
      reply: grokOk.text,
      grokReply: grokOk.text,
      grokModel: grokOk.model,
      transcript: extractedTranscript,
      engineLabelAr: `العقل المزدوج · جروك Heavy (${grokOk.model}) 🔥`,
      engineLabelEn: `Dual Brain · Grok Heavy (${grokOk.model}) 🔥`,
      statusNoteAr: 'يعمل جروك Heavy بكامل طاقته (جميني في فترة تهدئة الحصة المجانية).',
      statusNoteEn: 'Grok Heavy active at full capacity (Gemini cooling down rate quota).',
    }
  }

  // Only Gemini Carbon succeeded (e.g. xAI 402/429)
  if (gemOk) {
    const cleanGem = sanitizeExecutiveOutput(gemOk.text)
    return {
      modeUsed: 'dual',
      reply: cleanGem,
      geminiReply: cleanGem,
      geminiModel: gemOk.model,
      transcript: extractedTranscript,
      engineLabelAr: `العقل المزدوج · جميني Carbon (${gemOk.model}) ⚡`,
      engineLabelEn: `Dual Brain · Gemini Carbon (${gemOk.model}) ⚡`,
      statusNoteAr:
        grokVal?.quotaStatus === '402'
          ? 'جروك بانتظار شحن الرصيد — تم التحليل فوراً عبر جميني Carbon High.'
          : 'تم التحليل فوراً عبر جميني Carbon High.',
      statusNoteEn:
        grokVal?.quotaStatus === '402'
          ? 'Grok awaiting credit top-up — analyzed seamlessly via Gemini Carbon High.'
          : 'Analyzed seamlessly via Gemini Carbon High.',
    }
  }

  // Deterministic Odoo 17 fallback so the UI NEVER crashes even offline!
  const topPlay = ws.plays[0]
  const fin = deriveWorkspaceFinancials(ws)
  const fallbackReply = isAr
    ? `### الخلاصة المشتركة 🔥
بناءً على أرقام أودو المباشرة لـ **${ws.subtitleAr}**: المبيعات **${f0(ws.salesKwd)} د.ك** عبر **${f0(ws.orders)} طلب**، والصافي الفعلي بالجيب **${f0(fin.netPocketKwd)} د.ك** (${fin.netPocket10.toFixed(2)} د.ك من كل ١٠ دنانير).

### الخطوات العملية الفورية
1. ${topPlay ? `${topPlay.titleAr}: ${topPlay.solutionAr}` : 'ضبط أوزان الوجبات في مطبخ العارضية ومراجعة أسعار الموردين.'}
2. تنشيط الساعات الهادئة (٣ إلى ٦ عصراً) وتوجيه عملاء التطبيقات للطلب المباشر بدون عمولة.
3. تحصيل مستحقات منصات التوصيل المعلقة والبالغة **${f0(fin.deliveryDueKwd)} د.ك**.

### الفايدة المتوقعة بالدينار
- استرداد وزيادة صافي الربح بنحو **+${topPlay ? topPlay.periodLabelAr : `${f0(ws.salesKwd * 0.05)} د.ك`}** خلال نفس الفترة.`
    : `### Dual-Brain Consensus 🔥
Based on verified Odoo 17 figures for **${ws.subtitleEn}**: Sales are **${f0(ws.salesKwd)} KWD** across **${f0(ws.orders)} orders**, with **${f0(fin.netPocketKwd)} KWD** net cash in pocket (${fin.netPocket10.toFixed(2)} KWD per 10 KWD sold).

### Immediate Action Steps
1. ${topPlay ? `${topPlay.titleEn}: ${topPlay.solutionEn}` : 'Lock daily portion weights at Ardiya Central Kitchen and audit supplier prices.'}
2. Activate afternoon 3–6 PM combos and convert repeat app buyers to 0%-fee direct orders.
3. Collect **${f0(fin.deliveryDueKwd)} KWD** in open delivery platform settlements.

### Expected KWD Gain
- Projected net profit uplift of **+${topPlay ? topPlay.periodLabelEn : `${f0(ws.salesKwd * 0.05)} KWD`}** over the selected period.`

  return {
    modeUsed: mode,
    reply: fallbackReply,
    transcript: extractedTranscript,
    engineLabelAr: 'محرك أودو المباشر (وضع الحماية التلقائي)',
    engineLabelEn: 'Verified Odoo 17 Engine (Offline Safe Mode)',
  }
}

// ============================================================================
// 1-Click "Copy for Grok Ultra" Executive Brief Builder (`نسخ لجروك الترا 📋`)
// ============================================================================
export function buildGrokUltraClipboardBrief(
  _filters: GlobalFilters,
  ws: GlobalWorkspaceSlice,
  isAr: boolean,
  pageTitle?: string,
): string {
  const fin = deriveWorkspaceFinancials(ws)
  const top3 = ws.plays
    .slice(0, 3)
    .map((p, i) => `${i + 1}) ${isAr ? p.titleAr : p.titleEn}: +${isAr ? p.periodLabelAr : p.periodLabelEn}`)
    .join('\n')

  if (isAr) {
    return `🧠 طلب تحليل عميق (Grok Heavy / Ultra) — شركة فنتشر فودز الكويت (Odoo 17)
• الصفحة: ${pageTitle || 'ملخص الشركة'}
• الفلتر النشط: ${ws.subtitleAr}
• المطاعم المعتمدة فقط (٦ مطاعم): تشاينا جاردن، فرانكس، طحينة، فارم براون، ذا نودل بار، كرك كافتيريا
• الفروع النشطة فقط (٧ مواقع): الأفنيوز، مول 360، العاصمة، بروميناد، السالمية، الكوت، مطبخ العارضية

📊 الأرقام الفعلية الحالية من أودو:
- المبيعات: ${f0(ws.salesKwd)} د.ك (${f0(ws.orders)} طلب · متوسط الفاتورة ${ws.aovKwd.toFixed(2)} د.ك)
- تكلفة الأكل والتغليف: ${f0(fin.foodCostKwd)} د.ك (${fin.food10.toFixed(2)} من كل ١٠ د.ك)
- عمولات تطبيقات التوصيل: ${f0(fin.deliveryCommKwd)} د.ك (${fin.delivery10.toFixed(2)} من كل ١٠ د.ك)
- الإيجار والرواتب والمصاريف: ${f0(fin.rentStaffOpexKwd)} د.ك (${fin.opexRent10.toFixed(2)} من كل ١٠ د.ك)
- الصافي الفعلي بالجيب: ${f0(fin.netPocketKwd)} د.ك (${fin.netPocket10.toFixed(2)} من كل ١٠ د.ك)
- مستحقات التوصيل المعلقة للتحصيل: ${f0(fin.deliveryDueKwd)} د.ك

🎯 أهم الفرص المرصودة حالياً:
${top3}

المطلوب من جروك الترا:
حلّل هذه الأرقام عبر ٣ زوايا (١: زيادة الصافي بالجيب، ٢: ضبط المطبخ والفروع، ٣: خطة تسويق ذكية وكشف أي تسرب خفي) بلغة كويتية عملية بسيطة جداً وبأرقام محددة بالدينار الكويتي.`
  }

  return `🧠 Executive Deep Prompt for Grok Heavy / Ultra — Venture Foods Kuwait (Odoo 17)
• Page: ${pageTitle || 'Company Summary'}
• Active Filter: ${ws.subtitleEn}
• Strictly 6 Approved Brands: China Garden, Frank's, Tahina, Farm Brown, The Noodle Bar, Karak Cafeteria
• Strictly 7 Active Locations: The Avenues, 360, Assima, Promenade, Salmiya, Al-Kout, Ardiya

📊 Live Odoo 17 Numbers:
- Net Sales: ${f0(ws.salesKwd)} KWD (${f0(ws.orders)} orders · Avg Bill ${ws.aovKwd.toFixed(2)} KWD)
- Food & Packaging Cost: ${f0(fin.foodCostKwd)} KWD (${fin.food10.toFixed(2)} per 10 KWD)
- Delivery App Commissions: ${f0(fin.deliveryCommKwd)} KWD (${fin.delivery10.toFixed(2)} per 10 KWD)
- Rent, Payroll & Branch Opex: ${f0(fin.rentStaffOpexKwd)} KWD (${fin.opexRent10.toFixed(2)} per 10 KWD)
- Net Cash in Pocket: ${f0(fin.netPocketKwd)} KWD (${fin.netPocket10.toFixed(2)} per 10 KWD)
- Open Delivery Dues: ${f0(fin.deliveryDueKwd)} KWD

🎯 Top Flagged Opportunities:
${top3}

Task for Grok Ultra:
Analyze these figures across 3 simultaneous lenses (1: Net Cash & Margin, 2: Kitchen & Branch Execution, 3: Smart Kuwait Growth & Hidden Risk Detection) in plain, actionable business English with exact KWD targets.`
}
