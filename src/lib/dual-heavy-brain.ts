/**
 * Triple-Brain Heavy Council Engine
 * ("GEMINI CARBON PRO × xAI GROK HEAVY × CLAUDE OPUS EXTENDED THINKING")
 *
 * Powers `aetherbi.com` across all 6 executive pages:
 *   - Engine A: Google Gemini "Carbon Pro" Auto-Resolver (`-pro` strictly ranked above `-flash` + HIGH thinkingConfig)
 *   - Engine B: xAI "Grok Heavy" Multi-Angle Deep Engine (6h /v1/models discovery + 3-lens heavy synthesis)
 *   - Engine C: Anthropic "Claude Deep" Extended Thinking (`claude-opus-4*` / `claude-sonnet-4*`,
 *               `budget_tokens: 10000` + safe non-thinking retry + `cache_control: { type: "ephemeral" }`)
 *   - Default Mode: "Triple-Brain Council" (`العقل الثلاثي 🔥`) running all active engines in parallel
 *                   via Promise.allSettled, grounded in `<feryal_evolving_memory>` & Odoo 17 whitelisted figures.
 *
 * STRICT ENTITY WHITELIST:
 *   - ONLY 6 Venture Foods Brands: China Garden, Frank's, Tahina, Farm Brown, The Noodle Bar, Karak Cafeteria.
 *   - ONLY 7 Active Odoo Branches: The Avenues, 360, Assima, Promenade, Salmiya, Al-Kout, Ardiya (+ EXB booths).
 */

import {
  getAnthropicApiKey,
  getAnthropicBrowserOverride,
  getGeminiApiKey,
  getOpenAIApiKey,
  getXaiApiKey,
} from '@/lib/ai-keys'
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
import {
  autoExtractLearningsFromTurn,
  buildFeryalEvolvingMemoryXml,
} from '@/lib/feryal-learning-engine'

export type BrainMode = 'triple' | 'claude' | 'gemini' | 'grok' | 'dual'

export interface BrainLiveHealth {
  claudeReady: boolean
  geminiReady: boolean
  grokReady: boolean
  claudeModel: string
  claudeSonnetModel?: string
  claudeOpusModel?: string
  sonnetOnly?: boolean
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
  claudeTier?: 'daily' | 'deep'
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
  /** Individual Anthropic Claude Extended Thinking perspective (when available) */
  claudeReply?: string
  claudeModel?: string
  claudeThinkingSummary?: string
  /** Individual Gemini Carbon Pro perspective (when available) */
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
  /** Non-crashing status note if any API hit rate/credit limits and fell back cleanly */
  statusNoteAr?: string
  statusNoteEn?: string
}

export const BRAIN_MODE_STORAGE_KEY = 'aetherbi_active_brain_mode_v2'
const LEGACY_BRAIN_MODE_KEY = 'aetherbi_active_brain_mode_v1'
export const CLAUDE_SONNET_ONLY_KEY = 'aether_claude_sonnet_only_v1'
export const BRAIN_MODE_EVENT = 'aetherbi-brain-mode-change'
export const BRAIN_HEALTH_EVENT = 'aetherbi-brain-health-update'

const GEMINI_CACHE_KEY = 'aetherbi_gemini_models_cache_v4'
const XAI_CACHE_KEY = 'aetherbi_xai_models_cache_v3'
const CLAUDE_CACHE_KEY = 'aetherbi_claude_models_cache_v3'
const LAST_VERIFIED_MODELS_KEY = 'aetherbi_last_verified_models_v2'
const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const COOLDOWN_MS = 20 * 60 * 1000

// In-memory 6h discovery caches + runtime verified model IDs + rate-limit cooldown tracker
let geminiCachedModels: { at: number; models: string[] } | null = null
let xaiCachedModels: { at: number; models: string[]; quotaWarning?: string } | null = null
let claudeCachedCatalog: {
  at: number
  sonnetChain: string[]
  opusChain: string[]
} | null = null
let lastVerifiedModels: {
  claude?: string
  claudeSonnet?: string
  claudeOpus?: string
  gemini?: string
  grok?: string
} = {}
const modelCooldownUntil = new Map<string, number>()

export function getClaudeSonnetOnly(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(CLAUDE_SONNET_ONLY_KEY) === '1'
    }
  } catch {}
  return false
}

export function setClaudeSonnetOnly(enabled: boolean): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (enabled) window.localStorage.setItem(CLAUDE_SONNET_ONLY_KEY, '1')
      else window.localStorage.removeItem(CLAUDE_SONNET_ONLY_KEY)
      window.dispatchEvent(new CustomEvent(BRAIN_HEALTH_EVENT, { detail: { sonnetOnly: enabled } }))
    }
  } catch {}
}

export function formatClaudeModelBadge(rawId: string): string {
  const clean = rawId
    .replace(/^Claude\s+(?:Sonnet|Opus)\s*\(/i, '')
    .replace(/\)\s*[⚡🔬].*$/u, '')
    .replace(/\s*\(Extended Thinking\)\s*$/i, '')
    .trim()
  if (clean.includes('opus')) {
    return `Claude Opus (${clean}) 🔬`
  }
  return `Claude Sonnet (${clean}) ⚡`
}

function loadLastVerifiedModels() {
  if (
    lastVerifiedModels.claude ||
    lastVerifiedModels.claudeSonnet ||
    lastVerifiedModels.claudeOpus ||
    lastVerifiedModels.gemini ||
    lastVerifiedModels.grok
  ) {
    return lastVerifiedModels
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(LAST_VERIFIED_MODELS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as typeof lastVerifiedModels
        if (parsed && typeof parsed === 'object') {
          lastVerifiedModels = parsed
        }
      }
    }
  } catch {}
  return lastVerifiedModels
}

function recordVerifiedModel(
  engine: 'claude' | 'claudeSonnet' | 'claudeOpus' | 'gemini' | 'grok',
  modelId: string,
) {
  if (!modelId) return
  const cur = loadLastVerifiedModels()
  lastVerifiedModels = { ...cur, [engine]: modelId }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LAST_VERIFIED_MODELS_KEY, JSON.stringify(lastVerifiedModels))
      window.dispatchEvent(new CustomEvent(BRAIN_HEALTH_EVENT, { detail: lastVerifiedModels }))
    }
  } catch {}
}

export function clearBrainDiscoveryCaches(): void {
  geminiCachedModels = null
  xaiCachedModels = null
  claudeCachedCatalog = null
  lastVerifiedModels = {}
  modelCooldownUntil.clear()
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(GEMINI_CACHE_KEY)
      window.localStorage.removeItem(XAI_CACHE_KEY)
      window.localStorage.removeItem(CLAUDE_CACHE_KEY)
      window.localStorage.removeItem(LAST_VERIFIED_MODELS_KEY)
    }
  } catch {}
}

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

export function normalizeBrainMode(raw?: string | null): 'triple' | 'claude' | 'gemini' | 'grok' {
  if (raw === 'claude' || raw === 'gemini' || raw === 'grok') return raw
  return 'triple'
}

export function getActiveBrainMode(): BrainMode {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved =
        window.localStorage.getItem(BRAIN_MODE_STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_BRAIN_MODE_KEY)
      return normalizeBrainMode(saved)
    }
  } catch {}
  return 'triple'
}

export function setActiveBrainMode(mode: BrainMode): void {
  const normalized = normalizeBrainMode(mode)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(BRAIN_MODE_STORAGE_KEY, normalized)
      window.dispatchEvent(new CustomEvent(BRAIN_MODE_EVENT, { detail: normalized }))
    }
  } catch {}
}

// ============================================================================
// Verified Venture Foods Whitelisted Knowledge Base + Evolving Memory
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
  lang: 'ar' | 'en' = 'ar',
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

  const evolvingMemoryXml = buildFeryalEvolvingMemoryXml(lang)

  return `
COMPANY: Venture Foods Restaurants Management Co. W.L.L. — Kuwait (شركة فنتشر فودز لإدارة المطاعم ذ.م.م).
STRICT WHITELIST RULES (NON-NEGOTIABLE):
- Mention ONLY our 6 approved restaurant brands: China Garden (تشاينا جاردن), Frank's (فرانكس), Tahina (طحينة), Farm Brown (فارم براون), The Noodle Bar (ذا نودل بار), Karak Cafeteria (كرك كافتيريا).
- Mention ONLY our 7 active Odoo locations: The Avenues (الأفنيوز), 360 (مول 360), Assima (العاصمة), Promenade (بروميناد), Salmiya (السالمية), Al-Kout (الكوت), Ardiya Central Kitchen (مطبخ العارضية), plus EXB exhibition booths.
- NEVER mention canceled brands, school canteens, removed legacy branches, internal Odoo IDs, or complex academic jargon.
- Speak in ultra-simple, warm, everyday Kuwaiti/Gulf business Arabic (or plain everyday English when lang=en) that any restaurant owner or branch manager understands in 2 seconds.

${evolvingMemoryXml}

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
// Engine A: Google Gemini "Carbon Pro" Auto-Resolver
// STRICT INVARIANT: ALL `-pro` models ALWAYS rank strictly above `-flash`!
// ============================================================================
export function scoreGeminiModel(id: string): number {
  const m = id.toLowerCase()
  // Exclude non-text generation models or deprecated old names
  if (
    /tts|image|vision|embedding|aqa|lyria|banana|transcribe|gemma|argon|2\.0-flash-lite|1\.5/i.test(
      m,
    )
  ) {
    return -1
  }
  // Exclude known hanging preview endpoints
  if (m.includes('3.8-flash') || m.includes('3.7-flash')) return -1

  const isFlash = m.includes('flash') || m.includes('lite')
  const isPro = m.includes('pro')

  // Tier 1 (910–1000): Flagship Carbon & ALL `-pro` models (strictly >= 910)
  if (!isFlash) {
    if (m.includes('gemini-4') && (m.includes('carbon') || isPro)) return 1000
    if (m.includes('carbon')) return 990
    if (m.includes('gemini-4')) return 980
    if (m.includes('gemini-3.5') && isPro) return 970
    if (m.includes('gemini-3.1') && isPro) return 960
    if (m.includes('gemini-3') && isPro) return 950
    if (m === 'gemini-2.5-pro' || (m.includes('gemini-2.5') && isPro)) return 940
    if (m === 'gemini-pro-latest') return 930
    if (isPro) return 920
  }

  // Tier 2 (720–850): `-flash` models ONLY (strictly <= 850, ALWAYS below `-pro`!)
  if (m.includes('gemini-4') && isFlash) return 850
  if (m === 'gemini-3.6-flash') return 840
  if (m === 'gemini-3.5-flash') return 830
  if (m === 'gemini-3-flash-preview') return 820
  if (m.includes('gemini-3') && isFlash) return 810
  if (m === 'gemini-2.5-flash') return 800
  if (m === 'gemini-flash-latest') return 790
  if (isFlash) return 740
  if (m.includes('gemini')) return 700
  return -1
}

export const DEFAULT_GEMINI_CHAIN = [
  'gemini-2.5-pro',
  'gemini-pro-latest',
  'gemini-2.5-flash',
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
          const reSorted = [...parsed.models].sort(
            (a, b) => scoreGeminiModel(b) - scoreGeminiModel(a),
          )
          geminiCachedModels = { at: parsed.at, models: reSorted }
          return reSorted
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
      const rankedLive = [
        ...new Set(
          (data.models ?? [])
            .filter(
              (m) =>
                !m.supportedGenerationMethods ||
                m.supportedGenerationMethods.includes('generateContent'),
            )
            .map((m) => (m.name ?? '').replace(/^models\//, ''))
            .filter((id) => scoreGeminiModel(id) > 0),
        ),
      ].sort((a, b) => scoreGeminiModel(b) - scoreGeminiModel(a))

      const merged = [...new Set([...rankedLive, ...DEFAULT_GEMINI_CHAIN])]
        .sort((a, b) => scoreGeminiModel(b) - scoreGeminiModel(a))
        .slice(0, 7)

      geminiCachedModels = { at: Date.now(), models: merged }
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(GEMINI_CACHE_KEY, JSON.stringify(geminiCachedModels))
        }
      } catch {}
      return merged
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

    const configsToTry: Record<string, unknown>[] = [
      {
        temperature: 0.3,
        maxOutputTokens: 1600,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        thinkingConfig: model.includes('gemini-4')
          ? { thinkingLevel: 'HIGH' }
          : { thinkingBudget: 8192 },
      },
      {
        temperature: 0.3,
        maxOutputTokens: 1600,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    ]

    for (let attempt = 0; attempt < configsToTry.length; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          signal: AbortSignal.timeout(20000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts }],
            generationConfig: configsToTry[attempt],
          }),
        })

        if (res.status === 429 || res.status === 404 || res.status === 403) {
          markCooldown(`gemini:${model}`)
          break
        }

        if (res.status === 400 && attempt === 0) {
          continue
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
            const resolvedGeminiId =
              typeof data?.modelVersion === 'string' && data.modelVersion.trim()
                ? data.modelVersion.trim().replace(/^models\//, '')
                : model
            recordVerifiedModel('gemini', resolvedGeminiId)
            return { text: textOut, model: resolvedGeminiId }
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
  'grok-4.20-0309-reasoning',
  'grok-4-0709',
  'grok-4-latest',
  'grok-3',
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
(خطوة عملية فورية في الفرع أو المخزن ومطبخ العارضية بدون زيادة موظفين أو إيجار)
### ٣. زاوية التسويق وكشف المخاطر الخفية
(كيف نرفع الطلبات بذكاء ونتجنب الهدر أو عمولات التوصيل المخفية)`
    : `${knowledgeContext}

You are the "Grok Heavy" Multi-Angle Strategic Engine for Venture Foods Kuwait.
Analyze every business question across 3 simultaneous lenses in crisp, plain everyday English (zero consulting jargon):
### 1. Net Profit & Cash Lens
(Exact KWD impact on net cash in pocket)
### 2. Kitchen, Warehouse & Branch Lens
(Immediate field step across our branches, warehouse, or Ardiya Central Kitchen)
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
          max_tokens: 1200,
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
          const resolvedGrokId =
            typeof data?.model === 'string' && data.model.trim() ? data.model.trim() : model
          recordVerifiedModel('grok', resolvedGrokId)
          return { text: sanitizeExecutiveOutput(content), model: resolvedGrokId }
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
// Engine C: Anthropic Smart Dual-Tier Engine (`Sonnet` Daily ⚡ + `Opus` Deep 🔬)
// Routed via `/api/ai/claude` server proxy (keeps AetherBI-Live key out of browser headers)
// ============================================================================
export function scoreClaudeModel(id: string): number {
  const m = id.toLowerCase()
  if (/fable|mythos|embed|instant|haiku|claude-1|claude-2|claude-3|4-0|4-1|4\.0|4\.1/i.test(m)) {
    return -1
  }
  if (m.startsWith('claude-opus-5-5')) return 1000
  if (m.startsWith('claude-opus-5')) return 990
  if (m.startsWith('claude-sonnet-5-5')) return 985
  if (m.startsWith('claude-sonnet-5')) return 980
  if (m.startsWith('claude-opus-4-8') || m.startsWith('claude-opus-4-7')) return 970
  if (m.startsWith('claude-opus-4-6')) return 965
  if (m.startsWith('claude-sonnet-4-6')) return 960
  if (m.startsWith('claude-opus-4-5')) return 950
  if (m.startsWith('claude-sonnet-4-5')) return 940
  if (m.includes('opus')) return 900
  if (m.includes('sonnet')) return 890
  return -1
}

export const DEFAULT_CLAUDE_SONNET_CHAIN = [
  'claude-sonnet-5-5',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
]

export const DEFAULT_CLAUDE_OPUS_CHAIN = [
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
]

export const DEFAULT_CLAUDE_CHAIN = [
  ...DEFAULT_CLAUDE_OPUS_CHAIN,
  ...DEFAULT_CLAUDE_SONNET_CHAIN,
]

export async function discoverClaudeDualCatalog(
  forceRefresh = false,
): Promise<{ sonnetChain: string[]; opusChain: string[] }> {
  if (
    !forceRefresh &&
    claudeCachedCatalog &&
    Date.now() - claudeCachedCatalog.at < SIX_HOURS_MS
  ) {
    return {
      sonnetChain: claudeCachedCatalog.sonnetChain,
      opusChain: claudeCachedCatalog.opusChain,
    }
  }

  if (!forceRefresh) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(CLAUDE_CACHE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as {
            at: number
            sonnetChain: string[]
            opusChain: string[]
          }
          if (
            parsed?.at &&
            Array.isArray(parsed.sonnetChain) &&
            Array.isArray(parsed.opusChain) &&
            Date.now() - parsed.at < SIX_HOURS_MS
          ) {
            claudeCachedCatalog = parsed
            return { sonnetChain: parsed.sonnetChain, opusChain: parsed.opusChain }
          }
        }
      }
    } catch {}
  }

  // 1. Primary path in browser: Server proxy `/api/ai/claude` (zero API key in network headers!)
  if (typeof window !== 'undefined') {
    try {
      const customKey = getAnthropicBrowserOverride()
      const headers: Record<string, string> = {}
      if (customKey) headers['x-aether-custom-anthropic-key'] = customKey
      const res = await fetch(`/api/ai/claude${forceRefresh ? '?refresh=1' : ''}`, {
        signal: AbortSignal.timeout(8000),
        headers,
      })
      if (res.ok) {
        const data = (await res.json()) as {
          ok?: boolean
          sonnetChain?: string[]
          opusChain?: string[]
        }
        if (data?.ok && Array.isArray(data.sonnetChain) && Array.isArray(data.opusChain)) {
          claudeCachedCatalog = {
            at: Date.now(),
            sonnetChain: data.sonnetChain,
            opusChain: data.opusChain,
          }
          try {
            window.localStorage?.setItem(CLAUDE_CACHE_KEY, JSON.stringify(claudeCachedCatalog))
          } catch {}
          return {
            sonnetChain: data.sonnetChain,
            opusChain: data.opusChain,
          }
        }
      }
    } catch {}
  }

  // 2. Direct Node/SSR fallback
  const key = getAnthropicApiKey()
  if (key) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
        signal: AbortSignal.timeout(7000),
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
      })
      if (res.ok) {
        const data = (await res.json()) as { data?: { id?: string }[] }
        const valid = (data.data ?? [])
          .map((m) => m.id ?? '')
          .filter((id) => scoreClaudeModel(id) > 0)
        const sonnets = valid
          .filter((id) => id.includes('sonnet'))
          .sort((a, b) => scoreClaudeModel(b) - scoreClaudeModel(a))
        const opuses = valid
          .filter((id) => id.includes('opus'))
          .sort((a, b) => scoreClaudeModel(b) - scoreClaudeModel(a))

        const sonnetChain =
          sonnets.length > 0
            ? [...new Set([...sonnets, ...DEFAULT_CLAUDE_SONNET_CHAIN])].slice(0, 5)
            : DEFAULT_CLAUDE_SONNET_CHAIN
        const opusChain =
          opuses.length > 0
            ? [...new Set([...opuses, ...DEFAULT_CLAUDE_OPUS_CHAIN])].slice(0, 5)
            : DEFAULT_CLAUDE_OPUS_CHAIN

        claudeCachedCatalog = { at: Date.now(), sonnetChain, opusChain }
        return { sonnetChain, opusChain }
      }
    } catch {}
  }

  claudeCachedCatalog = {
    at: Date.now(),
    sonnetChain: DEFAULT_CLAUDE_SONNET_CHAIN,
    opusChain: DEFAULT_CLAUDE_OPUS_CHAIN,
  }
  return {
    sonnetChain: DEFAULT_CLAUDE_SONNET_CHAIN,
    opusChain: DEFAULT_CLAUDE_OPUS_CHAIN,
  }
}

export async function discoverClaudeDeepModels(): Promise<string[]> {
  const cat = await discoverClaudeDualCatalog(false)
  return [...new Set([...cat.opusChain, ...cat.sonnetChain])]
}

export function isExecutiveDeepClaudeCall(
  mode: BrainMode,
  query: string,
  pageContext?: string,
  explicitTier?: 'daily' | 'deep',
): boolean {
  if (explicitTier === 'deep') return true
  if (explicitTier === 'daily') return false
  if (mode === 'claude') return true
  const hay = `${query || ''}\n${pageContext || ''}`
  return /الحلول الكبرى|بلا سقف تقليدي|big-bet|moonshot|المعرض:|حاسبة المعارض|booth calculator|booth contract/i.test(
    hay,
  )
}

export async function runClaudeDeepEngine({
  knowledgeContext,
  userPrompt,
  lang,
  tier = 'deep',
}: {
  knowledgeContext: string
  userPrompt: string
  lang: 'ar' | 'en'
  tier?: 'daily' | 'deep'
}): Promise<{ text: string; model: string; rawModel: string; thinkingSummary?: string }> {
  const sonnetOnly = getClaudeSonnetOnly()
  const effectiveDeep = tier === 'deep' && !sonnetOnly
  const isAr = lang === 'ar'

  const claudeSystemText = isAr
    ? `${knowledgeContext}

أنت محرك "${effectiveDeep ? 'كلاود Opus العميق 🔬' : 'كلاود Sonnet السريع ⚡'}" (Claude Forensic CFO & COO Architect) لشركة فنتشر فودز الكويت.
دقّق الأرقام المحاسبية وسلسلة التوريد (المشتريات ← المخزن ← العارضية ← الفروع) وأسطول التوصيل المزدوج (TMP 15% + Tgo)، ثم قدّم التوصية بلغة كويتية تنفيذية صافية تحت ٣ عناوين واضحة:
### ١. التشخيص الجذري المدقق 🔬
### ٢. خطة التنفيذ الميدانية (المسؤول والفرع)
### ٣. الأثر الشهري الصافي بالدينار (متحفظ | مرجّح | أعلى)`
    : `${knowledgeContext}

You are the "${effectiveDeep ? 'Claude Opus Deep 🔬' : 'Claude Sonnet ⚡'}" Forensic CFO & COO Architect for Venture Foods Kuwait.
Cross-audit POS baskets, supplier -> warehouse -> Ardiya -> branch flows, and dual TMP 15% + Tgo fleet economics, then answer in crisp executive English under 3 clear headings:
### 1. Forensic Root-Cause Audit 🔬
### 2. Field Execution Plan (Owner & Branch)
### 3. 3-Tier Monthly Net KWD Impact`

  // 1. Primary secure browser path: Next.js Server Route `/api/ai/claude`
  if (typeof window !== 'undefined') {
    const customApiKey = getAnthropicBrowserOverride()
    const proxyRes = await fetch('/api/ai/claude', {
      method: 'POST',
      signal: AbortSignal.timeout(34000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier,
        sonnetOnly,
        systemText: claudeSystemText,
        userPrompt,
        maxTokens: effectiveDeep ? 8192 : 4096,
        ...(customApiKey ? { customApiKey } : {}),
      }),
    })

    if (proxyRes.ok) {
      const data = (await proxyRes.json()) as {
        ok?: boolean
        model?: string
        text?: string
        thinkingSummary?: string
        sonnetModel?: string
        opusModel?: string
      }
      if (data?.ok && data.text) {
        const rawClaudeId = (data.model || (effectiveDeep ? 'claude-opus-5-5' : 'claude-sonnet-5-5')).trim()
        const badge = formatClaudeModelBadge(rawClaudeId)
        if (rawClaudeId.includes('opus')) recordVerifiedModel('claudeOpus', rawClaudeId)
        else recordVerifiedModel('claudeSonnet', rawClaudeId)
        recordVerifiedModel('claude', badge)
        return {
          text: sanitizeExecutiveOutput(data.text),
          model: badge,
          rawModel: rawClaudeId,
          thinkingSummary: data.thinkingSummary,
        }
      }
    } else if (proxyRes.status === 401) {
      throw new Error('ANTHROPIC_AUTH_FAILED')
    }
  }

  // 2. Direct server/CLI fallback (e.g. non-Next Node scripts)
  const key = getAnthropicApiKey()
  if (!key) throw new Error('ANTHROPIC_KEY_MISSING')

  const cat = await discoverClaudeDualCatalog(false)
  const rawChain = effectiveDeep
    ? [...new Set([...cat.opusChain, cat.sonnetChain[0]])]
    : cat.sonnetChain
  const activeModels = rawChain.filter((m) => !isCoolingDown(`claude:${m}`))
  const chain = activeModels.length > 0 ? activeModels : rawChain
  const maxTokens = effectiveDeep ? 8192 : 4096

  for (const model of chain) {
    const fiveSeries = /claude-[a-z]+-5(?:$|[-.])/i.test(model)
    const payloads: Array<Record<string, unknown>> = [
      fiveSeries
        ? {
            model,
            max_tokens: maxTokens,
            output_config: { effort: effectiveDeep ? 'high' : 'medium' },
            system: [
              {
                type: 'text',
                text: claudeSystemText,
                cache_control: { type: 'ephemeral' },
              },
            ],
            messages: [{ role: 'user', content: userPrompt }],
          }
        : effectiveDeep
          ? {
              model,
              max_tokens: Math.max(maxTokens, 10000),
              thinking: { type: 'enabled', budget_tokens: 8000 },
              system: [
                {
                  type: 'text',
                  text: claudeSystemText,
                  cache_control: { type: 'ephemeral' },
                },
              ],
              messages: [{ role: 'user', content: userPrompt }],
            }
          : {
              model,
              max_tokens: maxTokens,
              temperature: 0.3,
              system: [
                {
                  type: 'text',
                  text: claudeSystemText,
                  cache_control: { type: 'ephemeral' },
                },
              ],
              messages: [{ role: 'user', content: userPrompt }],
            },
      {
        model,
        max_tokens: maxTokens,
        temperature: 0.3,
        system: [
          {
            type: 'text',
            text: claudeSystemText,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userPrompt }],
      },
    ]

    for (let attempt = 0; attempt < payloads.length; attempt++) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: AbortSignal.timeout(28000),
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(payloads[attempt]),
        })

        if (res.status === 401 || res.status === 403) {
          throw new Error('ANTHROPIC_AUTH_FAILED')
        }

        if (res.status === 429 || res.status === 529 || res.status === 404) {
          markCooldown(`claude:${model}`, 10 * 60 * 1000)
          break
        }

        if (res.status === 400 && attempt === 0) {
          continue // Retry cleanly without optional thinking/effort fields
        }

        if (res.ok) {
          const data = (await res.json()) as {
            model?: string
            content?: Array<{ type?: string; text?: string; thinking?: string }>
          }
          const blocks = data.content ?? []
          const thinkingText = blocks
            .filter((b: any) => b.type === 'thinking')
            .map((b: any) => b.thinking ?? '')
            .join('\n')
            .trim()
          const answerText = blocks
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text ?? '')
            .join('\n')
            .trim()

          if (answerText) {
            const rawClaudeId =
              typeof data.model === 'string' && data.model.trim() ? data.model.trim() : model
            const badge = formatClaudeModelBadge(rawClaudeId)
            if (rawClaudeId.includes('opus')) recordVerifiedModel('claudeOpus', rawClaudeId)
            else recordVerifiedModel('claudeSonnet', rawClaudeId)
            recordVerifiedModel('claude', badge)
            return {
              text: sanitizeExecutiveOutput(answerText),
              model: badge,
              rawModel: rawClaudeId,
              thinkingSummary: thinkingText ? thinkingText.slice(0, 500) : undefined,
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'ANTHROPIC_AUTH_FAILED') {
          throw err
        }
        markCooldown(`claude:${model}`, 3 * 60 * 1000)
        break
      }
    }
  }

  throw new Error('CLAUDE_ALL_MODELS_UNAVAILABLE')
}

// ============================================================================
// Live Health Check (for Top Header Sub-Badge & `🔑⚙️` Modal)
// ============================================================================
export async function probeDualBrainHealth(forceRefresh = false): Promise<BrainLiveHealth> {
  if (forceRefresh) {
    clearBrainDiscoveryCaches()
  }
  const [gemModels, grokInfo, claudeCat] = await Promise.all([
    discoverGeminiCarbonModels(),
    discoverGrokHeavyModels(),
    discoverClaudeDualCatalog(forceRefresh),
  ])

  const verified = loadLastVerifiedModels()
  const sonnetOnly = getClaudeSonnetOnly()
  const activeMode = normalizeBrainMode(getActiveBrainMode())

  const discoveredGemini =
    gemModels.find((m) => !isCoolingDown(`gemini:${m}`)) ?? gemModels[0] ?? 'gemini-2.5-pro'
  const discoveredGrok =
    grokInfo.models.find((m) => !isCoolingDown(`xai:${m}`)) ??
    grokInfo.models[0] ??
    'grok-4.20-0309-reasoning'

  const claudeSonnetModel =
    verified.claudeSonnet ||
    claudeCat.sonnetChain.find((m) => !isCoolingDown(`claude:${m}`)) ||
    claudeCat.sonnetChain[0] ||
    'claude-sonnet-5-5'

  const claudeOpusModel =
    verified.claudeOpus ||
    claudeCat.opusChain.find((m) => !isCoolingDown(`claude:${m}`)) ||
    claudeCat.opusChain[0] ||
    'claude-opus-5-5'

  // Active Claude badge reflects Smart Dual-Tier Routing:
  // - `Claude Deep` mode (when not in Sonnet-only max economy) -> `Claude Opus (claude-opus-5-5) 🔬`
  // - `Triple Brain` daily council or `Sonnet-only` max economy -> `Claude Sonnet (claude-sonnet-5-5) ⚡`
  const activeClaudeRaw =
    activeMode === 'claude' && !sonnetOnly ? claudeOpusModel : claudeSonnetModel
  const claudeModel = formatClaudeModelBadge(activeClaudeRaw)

  const geminiModel = verified.gemini || discoveredGemini
  const grokModel = verified.grok || discoveredGrok

  const hasGeminiKey = Boolean(getGeminiApiKey())
  const hasXaiKey = Boolean(getXaiApiKey()) && !grokInfo.quotaWarning
  const hasClaudeKey = Boolean(getAnthropicApiKey())

  return {
    claudeReady: hasClaudeKey,
    geminiReady: hasGeminiKey,
    grokReady: hasXaiKey,
    claudeModel,
    claudeSonnetModel,
    claudeOpusModel,
    sonnetOnly,
    geminiModel,
    grokModel,
    grokQuotaNoteAr: grokInfo.quotaWarning
      ? 'جروك بانتظار شحن الرصيد — يعمل المجلس تلقائياً بدون توقف'
      : undefined,
    grokQuotaNoteEn: grokInfo.quotaWarning
      ? 'Grok awaiting credit top-up — Council active automatically'
      : undefined,
    checkedAt: Date.now(),
  }
}

// ============================================================================
// Unified Triple-Brain Council Orchestrator
// ============================================================================
export async function askDualHeavyBrain(req: DualBrainRequest): Promise<DualBrainResponse> {
  const mode = normalizeBrainMode(req.mode ?? getActiveBrainMode())
  const isAr = req.lang === 'ar'
  const filters = req.filters ?? DEFAULT_GLOBAL_FILTERS
  const ws = req.workspace ?? computeGlobalWorkspace(filters)
  const knowledge = buildWhitelistedOdooKnowledge(filters, ws, req.lang)

  let effectiveQuery = (req.query || '').trim()
  let extractedTranscript: string | undefined

  // Step 0: If audioBase64 is passed (voice mic), transcribe cleanly first so all council brains can reason on it!
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
        const cleanReply = sanitizeExecutiveOutput(String(parsed.reply))
        autoExtractLearningsFromTurn(effectiveQuery, cleanReply)
        return {
          modeUsed: 'gemini',
          reply: cleanReply,
          geminiReply: cleanReply,
          geminiModel: gemAudio.model,
          transcript: extractedTranscript,
          engineLabelAr: `جميني Carbon (${gemAudio.model}) ⚡`,
          engineLabelEn: `Gemini Carbon (${gemAudio.model}) ⚡`,
        }
      }
    } catch {
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
### آلية التنفيذ الواقعية (المسؤول والفرع)
### الأثر المتوقع بالدينار (متحفظ | مرجّح | أعلى)
التزم حصرياً بأرقام أودو الموثقة بالدينار الكويتي (د.ك) وبمطاعمنا الـ ٦ وفروعنا الـ ٧ فقط.`
    : `Answer strictly in plain, direct everyday English (zero consulting jargon) using these 3 headings:
### Practical Solution
### Field Execution Plan (Owner & Branch)
### Expected Net KWD Impact (Conservative | Likely | Stretch)
Cite only verified Odoo KWD numbers across our 6 approved brands and 7 active branches.`

  const claudeTier: 'daily' | 'deep' = isExecutiveDeepClaudeCall(
    mode,
    effectiveQuery,
    req.pageContext,
    req.claudeTier,
  )
    ? 'deep'
    : 'daily'

  // --------------------------------------------------------------------------
  // Single-Brain Mode: Claude Deep (`كلاود العميق 🔬` -> Opus Deep Tier)
  // --------------------------------------------------------------------------
  if (mode === 'claude') {
    try {
      const claude = await runClaudeDeepEngine({
        knowledgeContext: knowledge,
        userPrompt: fullUserPrompt,
        lang: req.lang,
        tier: 'deep',
      })
      autoExtractLearningsFromTurn(effectiveQuery, claude.text)
      return {
        modeUsed: 'claude',
        reply: claude.text,
        claudeReply: claude.text,
        claudeModel: claude.model,
        claudeThinkingSummary: claude.thinkingSummary,
        transcript: extractedTranscript,
        engineLabelAr: `${claude.model}`,
        engineLabelEn: `${claude.model}`,
      }
    } catch {
      // Seamless automatic continuity if network blips
    }

    try {
      const gemBackup = await runGeminiCarbonEngine({
        systemPrompt: knowledge,
        userPrompt: `${fullUserPrompt}\n\n${geminiFormatDirective}`,
      })
      const clean = sanitizeExecutiveOutput(gemBackup.text)
      autoExtractLearningsFromTurn(effectiveQuery, clean)
      return {
        modeUsed: 'gemini',
        reply: clean,
        geminiReply: clean,
        geminiModel: gemBackup.model,
        transcript: extractedTranscript,
        engineLabelAr: `جميني Carbon Pro (${gemBackup.model}) ⚡`,
        engineLabelEn: `Gemini Carbon Pro (${gemBackup.model}) ⚡`,
        statusNoteAr: 'تم التحويل التلقائي إلى جميني Carbon Pro لضمان استجابة فورية بدون توقف.',
        statusNoteEn: 'Automatically routed to Gemini Carbon Pro for uninterrupted response.',
      }
    } catch {}
  }

  // --------------------------------------------------------------------------
  // Single-Brain Mode: Gemini Carbon Pro Only (`جميني Carbon ⚡`)
  // --------------------------------------------------------------------------
  if (mode === 'gemini') {
    try {
      const gem = await runGeminiCarbonEngine({
        systemPrompt: knowledge,
        userPrompt: `${fullUserPrompt}\n\n${geminiFormatDirective}`,
      })
      const clean = sanitizeExecutiveOutput(gem.text)
      autoExtractLearningsFromTurn(effectiveQuery, clean)
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
      try {
        const grokBackup = await runGrokHeavyEngine({
          knowledgeContext: knowledge,
          userPrompt: fullUserPrompt,
          lang: req.lang,
        })
        if (grokBackup.text) {
          autoExtractLearningsFromTurn(effectiveQuery, grokBackup.text)
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
  // Single-Brain Mode: xAI Grok Heavy Only (`جروك Heavy 🧠`)
  // --------------------------------------------------------------------------
  if (mode === 'grok') {
    try {
      const grok = await runGrokHeavyEngine({
        knowledgeContext: knowledge,
        userPrompt: fullUserPrompt,
        lang: req.lang,
      })
      if (grok.text) {
        autoExtractLearningsFromTurn(effectiveQuery, grok.text)
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
      const gemFallback = await runGeminiCarbonEngine({
        systemPrompt: knowledge,
        userPrompt: `${fullUserPrompt}\n\n${geminiFormatDirective}`,
      })
      const clean = sanitizeExecutiveOutput(gemFallback.text)
      autoExtractLearningsFromTurn(effectiveQuery, clean)
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
            ? 'ملاحظة: رصيد مفتاح جروك قيد الشحن — تم الرد فوراً عبر جميني Carbon Pro بدون توقف.'
            : 'ملاحظة: ضغط مؤقت على جروك — تم الرد فوراً عبر جميني Carbon Pro.',
        statusNoteEn:
          grok.quotaStatus === '402'
            ? 'Note: xAI key awaiting credit top-up — answered seamlessly via Gemini Carbon Pro.'
            : 'Note: xAI rate limit reached — answered seamlessly via Gemini Carbon Pro.',
      }
    } catch {
      try {
        const gemFallback = await runGeminiCarbonEngine({
          systemPrompt: knowledge,
          userPrompt: `${fullUserPrompt}\n\n${geminiFormatDirective}`,
        })
        const clean = sanitizeExecutiveOutput(gemFallback.text)
        autoExtractLearningsFromTurn(effectiveQuery, clean)
        return {
          modeUsed: 'gemini',
          reply: clean,
          geminiReply: clean,
          geminiModel: gemFallback.model,
          transcript: extractedTranscript,
          engineLabelAr: `جميني Carbon (${gemFallback.model}) ⚡`,
          engineLabelEn: `Gemini Carbon (${gemFallback.model}) ⚡`,
          statusNoteAr: 'تم الرد تلقائياً عبر جميني Carbon Pro.',
          statusNoteEn: 'Answered seamlessly via Gemini Carbon Pro.',
        }
      } catch {}
    }
  }

  // --------------------------------------------------------------------------
  // DEFAULT MODE: Triple-Brain Council (`العقل الثلاثي 🔥`)
  // Smart Dual-Tier Routing:
  //   - Daily Speed & Economy -> Claude Sonnet (`claude-sonnet-5-5` ⚡, max_tokens: 4096)
  //   - Big-Bet / Booth Contract Forensics -> Claude Opus (`claude-opus-5-5` 🔬, max_tokens: 8192)
  // --------------------------------------------------------------------------
  const [claudeSettled, gemSettled, grokSettled] = await Promise.allSettled([
    runClaudeDeepEngine({
      knowledgeContext: knowledge,
      userPrompt: fullUserPrompt,
      lang: req.lang,
      tier: claudeTier,
    }),
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

  const claudeOk =
    claudeSettled.status === 'fulfilled' && claudeSettled.value.text ? claudeSettled.value : null
  const gemOk =
    gemSettled.status === 'fulfilled' && gemSettled.value.text ? gemSettled.value : null
  const grokVal = grokSettled.status === 'fulfilled' ? grokSettled.value : null
  const grokOk = grokVal && grokVal.text ? grokVal : null

  const cleanClaude = claudeOk ? sanitizeExecutiveOutput(claudeOk.text) : undefined
  const cleanGem = gemOk ? sanitizeExecutiveOutput(gemOk.text) : undefined
  const cleanGrok = grokOk ? sanitizeExecutiveOutput(grokOk.text) : undefined

  const activeCount = [cleanClaude, cleanGem, cleanGrok].filter(Boolean).length

  // Multi-Brain Consensus Synthesis when >= 2 brains succeeded
  if (activeCount >= 2) {
    const sectionsAr = [
      cleanClaude ? `[تحليل كلاود العميق (${claudeOk?.model})]:\n${cleanClaude}` : '',
      cleanGem ? `[تحليل جميني Carbon Pro (${gemOk?.model})]:\n${cleanGem}` : '',
      cleanGrok ? `[تحليل جروك Heavy الثلاثي (${grokOk?.model})]:\n${cleanGrok}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    const sectionsEn = [
      cleanClaude ? `[Claude Deep (${claudeOk?.model})]:\n${cleanClaude}` : '',
      cleanGem ? `[Gemini Carbon Pro (${gemOk?.model})]:\n${cleanGem}` : '',
      cleanGrok ? `[xAI Grok Heavy (${grokOk?.model})]:\n${cleanGrok}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    const synthPrompt = isAr
      ? `أمامك تحليلات مستقلة من مجلس العقل الثلاثي لنفس أرقام أودو ١٧ لشركة فنتشر فودز الكويت (${ws.subtitleAr}):

${sectionsAr}

ادمج النقاط المشتركة ودقّق كل الأرقام بالدينار الكويتي في إجابة تنفيذية واحدة صافية ومباشرة جداً بلغة كويتية/خليجية يومية (١٥٠ إلى ٢٣٠ كلمة) تحت هذه العناوين الثلاثة بالضبط:
### إجماع العقل الثلاثي 🔥
### خطة التنفيذ الميدانية (المسؤول والفرع)
### الأثر الشهري الصافي بالدينار (متحفظ | مرجّح | أعلى)`
      : `Below are independent analyses from our AI Executive Council on live Venture Foods Kuwait Odoo 17 data (${ws.subtitleEn}):

${sectionsEn}

Cross-verify all KWD figures and synthesize ONE crystal-clear executive consensus (150–230 words) using these exact 3 headings:
### Triple-Brain Council Consensus 🔥
### Field Execution Plan (Owner & Branch)
### 3-Tier Monthly Net KWD Impact`

    let consensusReply = ''
    try {
      if (grokOk && getXaiApiKey()) {
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
            max_tokens: 950,
            messages: [
              { role: 'system', content: knowledge },
              { role: 'user', content: synthPrompt },
            ],
          }),
        })
        if (merged.ok) {
          const mJson = await merged.json()
          consensusReply = sanitizeExecutiveOutput(
            mJson?.choices?.[0]?.message?.content?.trim() ?? '',
          )
        }
      } else if (gemOk) {
        const mergedGem = await runGeminiCarbonEngine({
          systemPrompt: knowledge,
          userPrompt: synthPrompt,
        })
        consensusReply = sanitizeExecutiveOutput(mergedGem.text)
      }
    } catch {
      // Deterministic merge below if fast synthesis times out
    }

    if (!consensusReply) {
      const leadText = cleanClaude || cleanGrok || cleanGem || ''
      consensusReply = isAr
        ? `### إجماع العقل الثلاثي 🔥\nاتفقت محركات المجلس على خطة العمل الفورية لـ (${ws.subtitleAr}):\n\n${leadText}`
        : `### Triple-Brain Council Consensus 🔥\nCouncil engines aligned on (${ws.subtitleEn}):\n\n${leadText}`
    }

    const badgePartsAr = [
      claudeOk ? claudeOk.model : '',
      gemOk ? `جميني (${gemOk.model})` : '',
      grokOk ? `جروك (${grokOk.model})` : '',
    ].filter(Boolean)

    const badgePartsEn = [
      claudeOk ? claudeOk.model : '',
      gemOk ? `Gemini (${gemOk.model})` : '',
      grokOk ? `Grok (${grokOk.model})` : '',
    ].filter(Boolean)

    autoExtractLearningsFromTurn(effectiveQuery, consensusReply)

    return {
      modeUsed: 'triple',
      reply: consensusReply,
      claudeReply: cleanClaude,
      claudeModel: claudeOk?.model,
      claudeThinkingSummary: claudeOk?.thinkingSummary,
      geminiReply: cleanGem,
      geminiModel: gemOk?.model,
      grokReply: cleanGrok,
      grokModel: grokOk?.model,
      transcript: extractedTranscript,
      engineLabelAr: `العقل الثلاثي: ${badgePartsAr.join(' + ')} 🔥`,
      engineLabelEn: `Triple Brain: ${badgePartsEn.join(' + ')} 🔥`,
    }
  }

  // Single surviving brain in council mode
  if (claudeOk && cleanClaude) {
    autoExtractLearningsFromTurn(effectiveQuery, cleanClaude)
    return {
      modeUsed: 'triple',
      reply: cleanClaude,
      claudeReply: cleanClaude,
      claudeModel: claudeOk.model,
      claudeThinkingSummary: claudeOk.thinkingSummary,
      transcript: extractedTranscript,
      engineLabelAr: `العقل الثلاثي · ${claudeOk.model}`,
      engineLabelEn: `Triple Brain · ${claudeOk.model}`,
    }
  }

  if (grokOk && cleanGrok) {
    autoExtractLearningsFromTurn(effectiveQuery, cleanGrok)
    return {
      modeUsed: 'triple',
      reply: cleanGrok,
      grokReply: cleanGrok,
      grokModel: grokOk.model,
      transcript: extractedTranscript,
      engineLabelAr: `العقل الثلاثي · جروك Heavy (${grokOk.model}) 🔥`,
      engineLabelEn: `Triple Brain · Grok Heavy (${grokOk.model}) 🔥`,
    }
  }

  if (gemOk && cleanGem) {
    autoExtractLearningsFromTurn(effectiveQuery, cleanGem)
    return {
      modeUsed: 'triple',
      reply: cleanGem,
      geminiReply: cleanGem,
      geminiModel: gemOk.model,
      transcript: extractedTranscript,
      engineLabelAr: `العقل الثلاثي · جميني Carbon Pro (${gemOk.model}) ⚡`,
      engineLabelEn: `Triple Brain · Gemini Carbon Pro (${gemOk.model}) ⚡`,
      statusNoteAr: 'تم التحليل فوراً عبر جميني Carbon Pro.',
      statusNoteEn: 'Analyzed seamlessly via Gemini Carbon Pro.',
    }
  }

  // Deterministic Odoo 17 fallback so the UI NEVER crashes even offline!
  const topPlay = ws.plays[0]
  const fin = deriveWorkspaceFinancials(ws)
  const fallbackReply = isAr
    ? `### إجماع العقل الثلاثي 🔥
بناءً على أرقام أودو المباشرة لـ **${ws.subtitleAr}**: المبيعات **${f0(ws.salesKwd)} د.ك** عبر **${f0(ws.orders)} طلب**، والصافي الفعلي بالجيب **${f0(fin.netPocketKwd)} د.ك** (${fin.netPocket10.toFixed(2)} د.ك من كل ١٠ دنانير).

### خطة التنفيذ الميدانية (المسؤول والفرع)
1. ${topPlay ? `${topPlay.titleAr}: ${topPlay.solutionAr}` : 'ضبط أوزان الوجبات في المخزن ومطبخ العارضية ومراجعة أسعار الموردين.'}
2. تنشيط الساعات الهادئة (٣ إلى ٦ عصراً) وتحويل ضغط التوصيل إلى سائقي الشركة TMP بعمولة 15%.
3. تحصيل مستحقات منصات التوصيل المعلقة والبالغة **${f0(fin.deliveryDueKwd)} د.ك**.

### الأثر الشهري الصافي بالدينار (متحفظ | مرجّح | أعلى)
- استرداد وزيادة صافي الربح بنحو **+${topPlay ? topPlay.periodLabelAr : `${f0(ws.salesKwd * 0.04)} د.ك`}** خلال نفس الفترة.`
    : `### Triple-Brain Council Consensus 🔥
Based on verified Odoo 17 figures for **${ws.subtitleEn}**: Sales are **${f0(ws.salesKwd)} KWD** across **${f0(ws.orders)} orders**, with **${f0(fin.netPocketKwd)} KWD** net cash in pocket (${fin.netPocket10.toFixed(2)} KWD per 10 KWD sold).

### Field Execution Plan (Owner & Branch)
1. ${topPlay ? `${topPlay.titleEn}: ${topPlay.solutionEn}` : 'Lock daily portion weights across Central Warehouse & Ardiya Kitchen and audit supplier prices.'}
2. Activate afternoon 3–6 PM combos and route dense zones to TMP 15% company drivers.
3. Collect **${f0(fin.deliveryDueKwd)} KWD** in open delivery platform settlements.

### 3-Tier Monthly Net KWD Impact
- Projected net profit uplift of **+${topPlay ? topPlay.periodLabelEn : `${f0(ws.salesKwd * 0.04)} KWD`}** over the selected period.`

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
    .map(
      (p, i) =>
        `${i + 1}) ${isAr ? p.titleAr : p.titleEn}: +${isAr ? p.periodLabelAr : p.periodLabelEn}`,
    )
    .join('\n')

  if (isAr) {
    return `🧠 طلب تحليل عميق (العقل الثلاثي / Grok Ultra / Claude Opus) — شركة فنتشر فودز الكويت (Odoo 17)
• الصفحة: ${pageTitle || 'ملخص الشركة'}
• الفلتر النشط: ${ws.subtitleAr}
• المطاعم المعتمدة فقط (٦ مطاعم): تشاينا جاردن، فرانكس، طحينة، فارم براون، ذا نودل بار، كرك كافتيريا
• الفروع النشطة فقط (٧ مواقع + بوثات المعارض): الأفنيوز، مول 360، العاصمة، بروميناد، السالمية، الكوت، مطبخ العارضية
• القاعدة المؤسسية للتوريد: المشتريات تشتري من الموردين ← نقل واستلام في المخزن ← توزيع المخزن ومطبخ العارضية على الفروع
• قاعدة التوصيل المزدوج: تعاقد Tgo في كل الفروع + سائقو الشركة على TMP بعمولة 15% في الفروع المعتمدة

📊 الأرقام الفعلية الحالية من أودو:
- المبيعات: ${f0(ws.salesKwd)} د.ك (${f0(ws.orders)} طلب · متوسط الفاتورة ${ws.aovKwd.toFixed(2)} د.ك)
- تكلفة الأكل والتغليف: ${f0(fin.foodCostKwd)} د.ك (${fin.food10.toFixed(2)} من كل ١٠ د.ك)
- عمولات تطبيقات التوصيل: ${f0(fin.deliveryCommKwd)} د.ك (${fin.delivery10.toFixed(2)} من كل ١٠ د.ك)
- الإيجار والرواتب والمصاريف: ${f0(fin.rentStaffOpexKwd)} د.ك (${fin.opexRent10.toFixed(2)} من كل ١٠ د.ك)
- الصافي الفعلي بالجيب: ${f0(fin.netPocketKwd)} د.ك (${fin.netPocket10.toFixed(2)} من كل ١٠ د.ك)
- مستحقات التوصيل المعلقة للتحصيل: ${f0(fin.deliveryDueKwd)} د.ك

🎯 أهم الفرص المرصودة حالياً:
${top3}

المطلوب:
حلّل هذه الأرقام عبر ٣ زوايا (١: زيادة الصافي بالجيب، ٢: ضبط المخزن والعارضية والفروع، ٣: تعظيم سائقي TMP 15% وكشف أي تسرب خفي) بلغة كويتية عملية بسيطة وبأرقام محددة بالدينار الكويتي (متحفظ | مرجّح | أعلى).`
  }

  return `🧠 Executive Deep Prompt (Triple Brain / Grok Ultra / Claude Opus) — Venture Foods Kuwait (Odoo 17)
• Page: ${pageTitle || 'Company Summary'}
• Active Filter: ${ws.subtitleEn}
• Strictly 6 Approved Brands: China Garden, Frank's, Tahina, Farm Brown, The Noodle Bar, Karak Cafeteria
• Strictly 7 Active Locations + EXB Booths: The Avenues, 360, Assima, Promenade, Salmiya, Al-Kout, Ardiya
• Supply-Chain Rule: Procurement -> Central Warehouse receiving -> Warehouse & Ardiya dispatch to branches
• Dual Delivery Fleet: Talabat Tgo across all branches + in-house company drivers on TMP (15% fee) in designated branches

📊 Live Odoo 17 Numbers:
- Net Sales: ${f0(ws.salesKwd)} KWD (${f0(ws.orders)} orders · Avg Bill ${ws.aovKwd.toFixed(2)} KWD)
- Food & Packaging Cost: ${f0(fin.foodCostKwd)} KWD (${fin.food10.toFixed(2)} per 10 KWD)
- Delivery App Commissions: ${f0(fin.deliveryCommKwd)} KWD (${fin.delivery10.toFixed(2)} per 10 KWD)
- Rent, Payroll & Branch Opex: ${f0(fin.rentStaffOpexKwd)} KWD (${fin.opexRent10.toFixed(2)} per 10 KWD)
- Net Cash in Pocket: ${f0(fin.netPocketKwd)} KWD (${fin.netPocket10.toFixed(2)} per 10 KWD)
- Open Delivery Dues: ${f0(fin.deliveryDueKwd)} KWD

🎯 Top Flagged Opportunities:
${top3}

Task:
Analyze across 3 simultaneous lenses (1: Net Cash & Margin, 2: Warehouse, Ardiya & Branch Execution, 3: TMP 15% Fleet & Hidden Risk Audit) in plain business English with 3-tier monthly KWD targets.`
}
