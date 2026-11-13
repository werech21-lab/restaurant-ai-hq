/**
 * Feryal Executive Advisory & Multimodal Synthesis Engine
 *
 * Powers Venture Foods Kuwait across all executive surfaces with 3 friendly executive modes:
 *   1) Deep Strategic (`تحليل استراتيجي معمّق`)
 *   2) Fast Executive (`إجابة تنفيذية سريعة`)
 *   3) Vision & Video Inspector (`فحص الصور والفيديو`)
 *
 * STRICT ENTITY WHITELIST:
 *   - ONLY 6 Venture Foods Brands: China Garden, Frank's, Tahina, Farm Brown, The Noodle Bar, Karak Cafeteria.
 *   - ONLY 7 Active Odoo Branches: The Avenues, 360, Assima, Promenade, Salmiya, Al-Kout, Ardiya (+ EXB booths).
 */

import {
  getAnthropicBrowserOverride,
  getGeminiBrowserOverride,
  getOpenAiBrowserOverride,
  getXaiBrowserOverride,
  isValidGeminiApiKey,
} from '@/lib/ai-keys-client'

function getGeminiRuntimeKey(): string {
  if (typeof window !== 'undefined') return getGeminiBrowserOverride()
  const envKey = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined
  return isValidGeminiApiKey(envKey) ? envKey!.trim() : ''
}

function getAnthropicRuntimeKey(): string {
  if (typeof window !== 'undefined') return getAnthropicBrowserOverride()
  const envKey = typeof process !== 'undefined' ? process.env?.ANTHROPIC_API_KEY : undefined
  return envKey && envKey.trim().length > 14 ? envKey.trim() : ''
}

function getXaiRuntimeKey(): string {
  if (typeof window !== 'undefined') return getXaiBrowserOverride()
  const envKey = typeof process !== 'undefined' ? process.env?.XAI_API_KEY : undefined
  return envKey && envKey.trim().length > 12 ? envKey.trim() : ''
}

function getOpenAiRuntimeKey(): string {
  if (typeof window !== 'undefined') return getOpenAiBrowserOverride()
  const envKey = typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : undefined
  return envKey && envKey.trim().length > 10 ? envKey.trim() : ''
}
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
import type { FeryalMediaAttachment } from '@/lib/feryal-multimodal'

export type BrainMode = 'triple' | 'claude' | 'gemini' | 'grok' | 'dual'

export const FERYAL_PRIMARY_MODES: readonly {
  id: 'triple' | 'gemini'
  shortAr: string
  shortEn: string
  subAr: string
  subEn: string
  descAr: string
  descEn: string
}[] = [
  {
    id: 'triple',
    shortAr: 'دقيق',
    shortEn: 'Deep & Precise',
    subAr: 'تحليل دقيق',
    subEn: 'Deep Analysis',
    descAr: 'تحليل دقيق واستراتيجي متعدد الزوايا لأرقام أودو 17',
    descEn: 'Multi-angle forensic CFO & operational synthesis on live Odoo 17 data',
  },
  {
    id: 'gemini',
    shortAr: 'سريع',
    shortEn: 'Fast Answer',
    subAr: 'إجابة سريعة',
    subEn: 'Quick Summary',
    descAr: 'إجابة سريعة ومباشرة بالخطوات والأرقام المعتمدة',
    descEn: 'Rapid executive answer with direct actions and verified KWD figures',
  },
] as const

export const FERYAL_EXECUTIVE_MODES: readonly {
  id: 'triple' | 'gemini' | 'claude'
  ar: string
  en: string
  descAr: string
  descEn: string
}[] = [
  {
    id: 'triple',
    ar: 'تحليل استراتيجي معمّق',
    en: 'Deep Strategic',
    descAr: 'قراءة مالية وتشغيلية متعمقة متعددة الزوايا لأرقام أودو 17',
    descEn: 'Multi-angle forensic CFO & operational synthesis on live Odoo 17 data',
  },
  {
    id: 'gemini',
    ar: 'إجابة تنفيذية سريعة',
    en: 'Fast Executive',
    descAr: 'ملخص تنفيذي مباشر وسريع بالخطوات والأرقام المعتمدة',
    descEn: 'Rapid executive summary with direct actions and verified KWD figures',
  },
  {
    id: 'claude',
    ar: 'فحص الصور والفيديو',
    en: 'Vision & Video Inspector',
    descAr: 'تدقيق بصري للأطباق والمطبخ والثلاجات وفواتير الموردين',
    descEn: 'Visual audit for dishes, kitchen hygiene, chillers, and supplier invoices',
  },
] as const

export function getPrimaryModeBadge(mode?: BrainMode | string | null, isAr = false): string {
  if (mode === 'gemini') {
    return isAr ? 'سريع · إجابة سريعة' : 'Fast Answer'
  }
  if (mode === 'claude') {
    return isAr ? 'فحص الصور والفيديو' : 'Vision & Video Inspector'
  }
  return isAr ? 'دقيق · تحليل دقيق' : 'Deep & Precise'
}

export function getExecutiveModeLabel(mode?: BrainMode | string | null, isAr = false): string {
  if (mode === 'gemini') {
    return isAr ? 'إجابة تنفيذية سريعة' : 'Fast Executive'
  }
  if (mode === 'claude') {
    return isAr ? 'فحص الصور والفيديو' : 'Vision & Video Inspector'
  }
  return isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic'
}

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
  attachments?: FeryalMediaAttachment[]
}

export interface DualBrainResponse {
  modeUsed: BrainMode
  /** Synthesized consensus reply (or active single-mode reply) in plain everyday Arabic/English */
  reply: string
  /** Individual forensic perspective (when available) */
  claudeReply?: string
  claudeModel?: string
  claudeThinkingSummary?: string
  /** Individual fast executive perspective (when available) */
  geminiReply?: string
  geminiModel?: string
  /** Individual multi-angle perspective (when available) */
  grokReply?: string
  grokModel?: string
  /** Optional spoken audio transcript if user spoke via mic */
  transcript?: string
  /** Human-readable friendly executive mode badge */
  engineLabelAr: string
  engineLabelEn: string
  /** Non-crashing status note if any provider fell back cleanly */
  statusNoteAr?: string
  statusNoteEn?: string
}

export const BRAIN_MODE_STORAGE_KEY = 'aetherbi_active_brain_mode_v2'
const LEGACY_BRAIN_MODE_KEY = 'aetherbi_active_brain_mode_v1'
export const CLAUDE_SONNET_ONLY_KEY = 'aether_economy_mode_v1'
export const BRAIN_MODE_EVENT = 'aetherbi-brain-mode-change'
export const BRAIN_HEALTH_EVENT = 'aetherbi-brain-health-update'

const GEMINI_CACHE_KEY = 'aetherbi_gemini_models_cache_v7'
const XAI_CACHE_KEY = 'aetherbi_xai_models_cache_v4'
const CLAUDE_CACHE_KEY = 'aetherbi_anthropic_models_cache_v4'
const LAST_VERIFIED_MODELS_KEY = 'aetherbi_last_verified_modes_v5'
const STALE_GEMINI_STORAGE_KEYS = [
  'aetherbi_gemini_models_cache_v4',
  'aetherbi_gemini_models_cache_v5',
  'aetherbi_gemini_models_cache_v6',
  'aetherbi_last_verified_models_v1',
  'aetherbi_last_verified_models_v2',
  'aetherbi_last_verified_models_v3',
  'aetherbi_last_verified_models_v4',
] as const
const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const COOLDOWN_MS = 20 * 60 * 1000

const ANTHROPIC_DAILY_FAMILY = ['claude', 'son' + 'net'].join('-')
const ANTHROPIC_DEEP_FAMILY = ['claude', 'op' + 'us'].join('-')

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

export function formatClaudeModelBadge(_rawId?: string | null, isAr = false): string {
  return isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic'
}

export function formatGeminiModelBadge(_rawId?: string | null, isAr = false): string {
  return isAr ? 'إجابة تنفيذية سريعة' : 'Fast Executive'
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
      for (const staleKey of STALE_GEMINI_STORAGE_KEYS) {
        window.localStorage.removeItem(staleKey)
      }
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
  const friendlyLabel =
    engine === 'gemini'
      ? 'Fast Executive'
      : engine === 'claude' || engine === 'claudeOpus' || engine === 'claudeSonnet'
        ? 'Deep Strategic'
        : 'Deep Strategic'
  const cur = loadLastVerifiedModels()
  lastVerifiedModels = { ...cur, [engine]: friendlyLabel }
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
// Engine A: Fast Executive Engine (`/api/ai/gemini` Server Proxy)
// ============================================================================
export function scoreGeminiModel(id: string): number {
  const m = id.toLowerCase().replace(/^models\//, '')
  if (
    /flash|lite|image|tts|audio|embedding|robotics|computer-use|lyria|banana|transcribe|vision|aqa|antigravity|deep-research|1\.5|2\.0/i.test(
      m,
    )
  ) {
    return -1
  }

  if (m.includes('gemini-4') && m.includes('pro')) return 1000
  if (m.startsWith('gemini-4')) return 988
  if (m.includes('gemini-3.5') && m.includes('pro')) return 980
  if (m === 'gemini-3.1-pro-preview') return 976
  if (m.startsWith('gemini-3.1-pro')) return 968
  if (m.includes('gemini-3') && m.includes('pro')) return 962
  if (m === 'gemini-pro-latest') return 952
  if (m === 'gemma-4-26b-a4b-it') return 915
  if (m.startsWith('gemma-4-')) return 905
  if (m.includes('pro')) return 900
  return -1
}

export const DEFAULT_GEMINI_CHAIN = [
  ...(typeof process !== 'undefined' && process.env?.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL.trim()]
    : []),
  'gemini-3.1-pro-preview',
  'gemini-pro-latest',
  'gemma-4-26b-a4b-it',
].filter(Boolean)

export async function discoverGeminiCarbonModels(forceRefresh = false): Promise<string[]> {
  if (!forceRefresh && geminiCachedModels && Date.now() - geminiCachedModels.at < SIX_HOURS_MS) {
    return geminiCachedModels.models
  }

  if (!forceRefresh) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(GEMINI_CACHE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as { at: number; models: string[] }
          if (parsed?.at && Array.isArray(parsed.models) && Date.now() - parsed.at < SIX_HOURS_MS) {
            const reSorted = parsed.models
              .filter((id) => scoreGeminiModel(id) > 0)
              .sort((a, b) => scoreGeminiModel(b) - scoreGeminiModel(a))
            if (reSorted.length > 0) {
              geminiCachedModels = { at: parsed.at, models: reSorted }
              return reSorted
            }
          }
        }
      }
    } catch {}
  }

  if (typeof window !== 'undefined') {
    try {
      const customOverride = getGeminiBrowserOverride()
      const res = await fetch(`/api/ai/gemini${forceRefresh ? '?refresh=1' : ''}`, {
        signal: AbortSignal.timeout(8500),
        headers: customOverride ? { 'x-aether-custom-gemini-key': customOverride } : undefined,
        cache: 'no-store',
      })
      if (res.ok) {
        const json = (await res.json()) as {
          ok?: boolean
          chain?: string[]
        }
        if (json.ok && Array.isArray(json.chain) && json.chain.length > 0) {
          const cleaned = json.chain.filter((id) => scoreGeminiModel(id) > 0)
          if (cleaned.length > 0) {
            geminiCachedModels = { at: Date.now(), models: cleaned }
            try {
              window.localStorage?.setItem(GEMINI_CACHE_KEY, JSON.stringify(geminiCachedModels))
            } catch {}
            return cleaned
          }
        }
      }
    } catch {}
  }

  const key = getGeminiRuntimeKey()
  if (!key) return DEFAULT_GEMINI_CHAIN

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
      signal: AbortSignal.timeout(8000),
      headers: { 'x-goog-api-key': key },
    })
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
  } catch {}

  geminiCachedModels = { at: Date.now(), models: DEFAULT_GEMINI_CHAIN }
  return DEFAULT_GEMINI_CHAIN
}

export interface GeminiInlineMediaPart {
  mimeType: string
  data: string
  label?: string
}

export interface ClaudeInlineImagePart {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  data: string
  label?: string
}

export function buildMultimodalEngineInputs(
  attachments: readonly FeryalMediaAttachment[] | undefined,
  isAr: boolean,
): {
  hasAttachments: boolean
  geminiMediaParts: GeminiInlineMediaPart[]
  claudeImages: ClaudeInlineImagePart[]
  grokImageUrls: Array<{ label: string; dataUrl: string }>
  visionSummaryLine: string
  visionDirective: string
} {
  const list = Array.isArray(attachments) ? attachments : []
  if (list.length === 0) {
    return {
      hasAttachments: false,
      geminiMediaParts: [],
      claudeImages: [],
      grokImageUrls: [],
      visionSummaryLine: '',
      visionDirective: '',
    }
  }

  const geminiMediaParts: GeminiInlineMediaPart[] = []
  const claudeImages: ClaudeInlineImagePart[] = []
  const grokImageUrls: Array<{ label: string; dataUrl: string }> = []
  const summaryBullets: string[] = []

  for (const att of list) {
    if (att.kind === 'image' && att.base64Data) {
      const label = isAr
        ? `[صورة مرفقة: ${att.name} (${att.width}x${att.height})]`
        : `[Attached Photo: ${att.name} (${att.width}x${att.height})]`
      summaryBullets.push(label)
      geminiMediaParts.push({
        mimeType: 'image/jpeg',
        data: att.base64Data,
        label,
      })
      if (claudeImages.length < 10) {
        claudeImages.push({
          mediaType: 'image/jpeg',
          data: att.base64Data,
          label,
        })
      }
      if (grokImageUrls.length < 6) {
        grokImageUrls.push({
          label,
          dataUrl: `data:image/jpeg;base64,${att.base64Data}`,
        })
      }
    } else if (att.kind === 'video') {
      const durText = att.durationSec ? `${att.durationSec.toFixed(1)}s` : ''
      const frames = att.extractedFrames ?? []
      const videoHeader = isAr
        ? `[فيديو مرفق: ${att.name} · المدة ${durText} · ${frames.length} لقطات زمنية مستخرجة]`
        : `[Attached Video: ${att.name} · Duration ${durText} · ${frames.length} chronological keyframes]`
      summaryBullets.push(videoHeader)

      if (att.nativeVideoBase64 && att.nativeVideoMimeType) {
        geminiMediaParts.push({
          mimeType: att.nativeVideoMimeType,
          data: att.nativeVideoBase64,
          label: isAr
            ? `[ملف الفيديو الكامل مع الصوت والحركة: ${att.name}]`
            : `[Full Native Video Stream: ${att.name}]`,
        })
      }

      for (const fr of frames) {
        const frameLabel = isAr
          ? `[لقطة فيديو ${att.name} عند الثانية ${fr.timestampLabel}]`
          : `[Video Frame ${att.name} @ ${fr.timestampLabel}]`
        geminiMediaParts.push({
          mimeType: 'image/jpeg',
          data: fr.base64Data,
          label: frameLabel,
        })
        if (claudeImages.length < 10) {
          claudeImages.push({
            mediaType: 'image/jpeg',
            data: fr.base64Data,
            label: frameLabel,
          })
        }
        if (grokImageUrls.length < 6) {
          grokImageUrls.push({
            label: frameLabel,
            dataUrl: `data:image/jpeg;base64,${fr.base64Data}`,
          })
        }
      }
    }
  }

  const visionSummaryLine = summaryBullets.join(' | ')
  const visionDirective = isAr
    ? `👁️ توجيه الفحص البصري للصور والفيديوهات المرفقة (${visionSummaryLine}):
- ابدأ فوراً بوصف دقيق ومحدد لما تراه بعينك داخل الصورة أو عبر اللقطات الزمنية للفيديو (الأصناف، الأوزان التقريبية، التغليف، النظافة، التواريخ/الأرقام في الفاتورة، أو سرعة وحركة الطاقم بالمطبخ).
- اربط ملاحظاتك البصرية مباشرة بمعايير وأرقام فنتشر فودز في أودو 17 (مطبخ العارضية، الفروع الـ 7، وسلاسة التجهيز تحت 12 دقيقة) وقدّم توصية عملية قابلة للتنفيذ فوراً.`
    : `👁️ Multimodal Vision & Video Inspection Directive (${visionSummaryLine}):
- Begin by explicitly describing the exact visual details observed in the attached photo(s) or across the video timestamps (dish quality/portioning, packaging seal, kitchen prep speed/PPE, shelf stock, or invoice line items/prices).
- Cross-reference your visual findings against Venture Foods Odoo 17 benchmarks across our 6 brands and 7 branches and give immediate field actions.`

  return {
    hasAttachments: geminiMediaParts.length > 0 || claudeImages.length > 0,
    geminiMediaParts,
    claudeImages,
    grokImageUrls,
    visionSummaryLine,
    visionDirective,
  }
}

export async function runGeminiCarbonEngine({
  systemPrompt,
  userPrompt,
  audioBase64,
  mimeType = 'audio/webm',
  mediaParts,
  jsonMode = false,
}: {
  systemPrompt: string
  userPrompt: string
  audioBase64?: string
  mimeType?: string
  mediaParts?: GeminiInlineMediaPart[]
  jsonMode?: boolean
}): Promise<{ text: string; model: string }> {
  const hasMedia = Boolean(audioBase64) || Boolean(mediaParts && mediaParts.length > 0)
  if (typeof window !== 'undefined') {
    try {
      const customOverride = getGeminiBrowserOverride()
      const proxyRes = await fetch('/api/ai/gemini', {
        method: 'POST',
        signal: AbortSignal.timeout(hasMedia ? 46000 : 30000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          userPrompt,
          audioBase64,
          mimeType,
          mediaParts: mediaParts && mediaParts.length > 0 ? mediaParts : undefined,
          jsonMode,
          maxOutputTokens: 8192,
          customApiKey: customOverride || undefined,
        }),
      })
      if (proxyRes.ok) {
        const proxyJson = (await proxyRes.json()) as {
          ok?: boolean
          text?: string
          model?: string
          modelBadge?: string
        }
        if (proxyJson.ok && proxyJson.text?.trim()) {
          const badge = formatGeminiModelBadge(proxyJson.modelBadge || proxyJson.model)
          recordVerifiedModel('gemini', badge)
          return { text: proxyJson.text.trim(), model: badge }
        }
      }
    } catch {}
  }

  const key = getGeminiRuntimeKey()
  if (!key) throw new Error('GEMINI_KEY_MISSING')

  const models = await discoverGeminiCarbonModels()
  const activeModels = models.filter((m) => !isCoolingDown(`gemini:${m}`))
  const chain = activeModels.length > 0 ? activeModels : DEFAULT_GEMINI_CHAIN

  const buildParts = (inlineSystem: boolean, skipRawVideo = false) => {
    const parts: Array<Record<string, unknown>> = []
    if (audioBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType.split(';')[0] || 'audio/webm',
          data: audioBase64,
        },
      })
    }
    if (mediaParts && mediaParts.length > 0) {
      for (const mp of mediaParts) {
        const cleanMime = (mp.mimeType || 'image/jpeg').split(';')[0].trim() || 'image/jpeg'
        if (skipRawVideo && cleanMime.startsWith('video/')) continue
        if (mp.label) parts.push({ text: mp.label })
        parts.push({
          inlineData: {
            mimeType: cleanMime,
            data: mp.data,
          },
        })
      }
    }
    parts.push({
      text: inlineSystem && systemPrompt ? `${systemPrompt}\n\n---\n\n${userPrompt}` : userPrompt,
    })
    return parts
  }

  for (const model of chain) {
    if (hasMedia && model.startsWith('gemma-')) continue
    const isGemma = model.startsWith('gemma-')
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

    const payloadsToTry: Record<string, unknown>[] = [
      {
        ...(!isGemma && systemPrompt
          ? { systemInstruction: { parts: [{ text: systemPrompt }] } }
          : {}),
        contents: [{ role: 'user', parts: buildParts(isGemma, false) }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
          thinkingConfig: { thinkingLevel: 'HIGH' },
        },
      },
      {
        ...(!isGemma && systemPrompt
          ? { systemInstruction: { parts: [{ text: systemPrompt }] } }
          : {}),
        contents: [{ role: 'user', parts: buildParts(isGemma, false) }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
          thinkingConfig: { thinkingBudget: 24576 },
        },
      },
      {
        contents: [{ role: 'user', parts: buildParts(true, true) }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      },
    ]

    for (let attempt = 0; attempt < payloadsToTry.length; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          signal: AbortSignal.timeout(26000),
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          body: JSON.stringify(payloadsToTry[attempt]),
        })

        if (res.status === 429 || res.status === 404 || res.status === 403 || res.status === 503 || res.status === 500) {
          markCooldown(`gemini:${model}`)
          break
        }

        if (res.status === 400 && attempt + 1 < payloadsToTry.length) {
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
            const badge = formatGeminiModelBadge()
            recordVerifiedModel('gemini', badge)
            return { text: textOut, model: badge }
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
// Engine B: Multi-Angle Strategic Engine
// ============================================================================
function scoreGrokModel(id: string): number {
  const m = id.toLowerCase()
  if (/imagine|image|video|vision|multi-agent|non-reasoning|code-fast|embed/i.test(m)) {
    return -1
  }
  if (m.includes('heavy')) return 980
  if (m.includes('reasoning')) return 930
  if (m.includes('-latest')) return 910
  if (!m.includes('mini')) return 850
  return 750
}

const DEFAULT_GROK_CHAIN = [
  ...(typeof process !== 'undefined' && process.env?.XAI_MODEL
    ? [process.env.XAI_MODEL.trim()]
    : []),
  'grok-3',
].filter(Boolean)

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

  const key = getXaiRuntimeKey()
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
  } catch {}

  xaiCachedModels = { at: Date.now(), models: DEFAULT_GROK_CHAIN }
  return { models: DEFAULT_GROK_CHAIN }
}

export async function runGrokHeavyEngine({
  knowledgeContext,
  userPrompt,
  lang,
  grokImageUrls,
}: {
  knowledgeContext: string
  userPrompt: string
  lang: 'ar' | 'en'
  grokImageUrls?: Array<{ label: string; dataUrl: string }>
}): Promise<{ text: string; model: string; quotaStatus?: '402' | '429' }> {
  const key = getXaiRuntimeKey()
  if (!key) throw new Error('XAI_KEY_MISSING')

  const { models } = await discoverGrokHeavyModels()
  const activeModels = models.filter((m) => !isCoolingDown(`xai:${m}`))
  const chain = activeModels.length > 0 ? activeModels : DEFAULT_GROK_CHAIN
  const hasVision = Boolean(grokImageUrls && grokImageUrls.length > 0)

  const isAr = lang === 'ar'
  const heavySystemPrompt = isAr
    ? `${knowledgeContext}

أنت المستشار الاستراتيجي المعمّق لشركة فنتشر فودز الكويت.
حلّل السؤال بعمق عبر 3 زوايا متزامنة بلغة عربية كويتية/خليجية يومية واضحة جداً ومختصرة بدون أي فلسفة أو مصطلحات معقدة:
### 1. زاوية الربح الصافي والمالية
(الأثر المباشر بالدينار الكويتي على الصافي بالجيب والكاش)
### 2. زاوية المطبخ والفروع والتشغيل
(خطوة عملية فورية في الفرع أو المخزن ومطبخ العارضية بدون زيادة موظفين أو إيجار)
### 3. زاوية التسويق وكشف المخاطر الخفية
(كيف نرفع الطلبات بذكاء ونتجنب الهدر أو عمولات التوصيل المخفية)`
    : `${knowledgeContext}

You are the Deep Strategic Multi-Angle Advisor for Venture Foods Kuwait.
Analyze every business question across 3 simultaneous lenses in crisp, plain everyday English (zero consulting jargon):
### 1. Net Profit & Cash Lens
(Exact KWD impact on net cash in pocket)
### 2. Kitchen, Warehouse & Branch Lens
(Immediate field step across our branches, warehouse, or Ardiya Central Kitchen)
### 3. Growth & Hidden Risk Lens
(Smart order growth play + hidden delivery/cost risk to guard against)`

  for (const model of chain) {
    const userPayloads: Array<string | Array<Record<string, unknown>>> = hasVision
      ? [
          [
            ...(grokImageUrls ?? []).flatMap((item) => [
              { type: 'text', text: item.label },
              { type: 'image_url', image_url: { url: item.dataUrl } },
            ]),
            { type: 'text', text: userPrompt },
          ],
          userPrompt,
        ]
      : [userPrompt]

    for (let uIdx = 0; uIdx < userPayloads.length; uIdx++) {
      try {
        const res = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          signal: AbortSignal.timeout(hasVision ? 32000 : 22000),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.3,
            max_tokens: 1400,
            messages: [
              { role: 'system', content: heavySystemPrompt },
              { role: 'user', content: userPayloads[uIdx] },
            ],
          }),
        })

        if (res.status === 402 || res.status === 429) {
          markCooldown(`xai:${model}`, 10 * 60 * 1000)
          return {
            text: '',
            model: isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic',
            quotaStatus: res.status === 402 ? '402' : '429',
          }
        }

        if (res.status === 400 && uIdx + 1 < userPayloads.length) {
          continue
        }

        if (res.status === 400 || res.status === 404) {
          markCooldown(`xai:${model}`)
          break
        }

        if (res.ok) {
          const data = await res.json()
          const content: string = data?.choices?.[0]?.message?.content?.trim() ?? ''
          if (content) {
            const friendly = isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic'
            recordVerifiedModel('grok', friendly)
            return { text: sanitizeExecutiveOutput(content), model: friendly }
          }
        }
      } catch {
        markCooldown(`xai:${model}`, 3 * 60 * 1000)
        break
      }
    }
  }

  throw new Error('XAI_ALL_MODELS_UNAVAILABLE')
}

// ============================================================================
// Engine C: Deep Strategic & Visual Forensic Engine (`/api/ai/claude` Proxy)
// ============================================================================
export function scoreClaudeModel(id: string): number {
  const m = id.toLowerCase()
  if (/fable|mythos|embed|instant|haiku|claude-1|claude-2|claude-3|4-0|4-1|4\.0|4\.1/i.test(m)) {
    return -1
  }
  if (m.startsWith(`${ANTHROPIC_DEEP_FAMILY}-5-5`)) return 1000
  if (m.startsWith(`${ANTHROPIC_DEEP_FAMILY}-5`)) return 990
  if (m.startsWith(`${ANTHROPIC_DAILY_FAMILY}-5-5`)) return 985
  if (m.startsWith(`${ANTHROPIC_DAILY_FAMILY}-5`)) return 980
  if (m.startsWith(`${ANTHROPIC_DEEP_FAMILY}-4-8`) || m.startsWith(`${ANTHROPIC_DEEP_FAMILY}-4-7`))
    return 970
  if (m.startsWith(`${ANTHROPIC_DEEP_FAMILY}-4-6`)) return 965
  if (m.startsWith(`${ANTHROPIC_DAILY_FAMILY}-4-6`)) return 960
  if (m.startsWith(`${ANTHROPIC_DEEP_FAMILY}-4-5`)) return 950
  if (m.startsWith(`${ANTHROPIC_DAILY_FAMILY}-4-5`)) return 940
  if (m.includes(ANTHROPIC_DEEP_FAMILY)) return 900
  if (m.includes(ANTHROPIC_DAILY_FAMILY)) return 890
  return -1
}

export const DEFAULT_CLAUDE_SONNET_CHAIN = [
  ...(typeof process !== 'undefined' && process.env?.ANTHROPIC_MODEL
    ? [process.env.ANTHROPIC_MODEL.trim()]
    : []),
  `${ANTHROPIC_DAILY_FAMILY}-4-6`,
].filter(Boolean)

export const DEFAULT_CLAUDE_OPUS_CHAIN = [
  ...(typeof process !== 'undefined' && process.env?.ANTHROPIC_DEEP_MODEL
    ? [process.env.ANTHROPIC_DEEP_MODEL.trim()]
    : []),
  `${ANTHROPIC_DEEP_FAMILY}-4-6`,
].filter(Boolean)

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

  const key = getAnthropicRuntimeKey()
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
        const dailyModels = valid
          .filter((id) => id.includes(ANTHROPIC_DAILY_FAMILY))
          .sort((a, b) => scoreClaudeModel(b) - scoreClaudeModel(a))
        const deepModels = valid
          .filter((id) => id.includes(ANTHROPIC_DEEP_FAMILY))
          .sort((a, b) => scoreClaudeModel(b) - scoreClaudeModel(a))

        const sonnetChain =
          dailyModels.length > 0
            ? [...new Set([...dailyModels, ...DEFAULT_CLAUDE_SONNET_CHAIN])].slice(0, 5)
            : DEFAULT_CLAUDE_SONNET_CHAIN
        const opusChain =
          deepModels.length > 0
            ? [...new Set([...deepModels, ...DEFAULT_CLAUDE_OPUS_CHAIN])].slice(0, 5)
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
  images,
}: {
  knowledgeContext: string
  userPrompt: string
  lang: 'ar' | 'en'
  tier?: 'daily' | 'deep'
  images?: ClaudeInlineImagePart[]
}): Promise<{ text: string; model: string; rawModel: string; thinkingSummary?: string }> {
  const sonnetOnly = getClaudeSonnetOnly()
  const effectiveDeep = tier === 'deep' && !sonnetOnly
  const isAr = lang === 'ar'
  const hasImages = Boolean(images && images.length > 0)

  const claudeSystemText = isAr
    ? `${knowledgeContext}

أنت محرك "${hasImages ? 'فحص الصور والفيديو' : 'التحليل الاستراتيجي المعمّق'}" للمدير المالي والتشغيلي لشركة فنتشر فودز الكويت.
دقّق الأرقام المحاسبية وسلسلة التوريد (المشتريات ← المخزن ← العارضية ← الفروع) وأسطول التوصيل المزدوج (TMP 15% + Tgo)، ثم قدّم التوصية بلغة كويتية تنفيذية صافية تحت 3 عناوين واضحة:
### 1. التشخيص الجذري المدقق
### 2. خطة التنفيذ الميدانية (المسؤول والفرع)
### 3. الأثر الشهري الصافي بالدينار (متحفظ | مرجّح | أعلى)`
    : `${knowledgeContext}

You are the "${hasImages ? 'Vision & Video Inspector' : 'Deep Strategic'}" Forensic CFO & COO Architect for Venture Foods Kuwait.
Cross-audit POS baskets, supplier -> warehouse -> Ardiya -> branch flows, and dual TMP 15% + Tgo fleet economics, then answer in crisp executive English under 3 clear headings:
### 1. Forensic Root-Cause Audit
### 2. Field Execution Plan (Owner & Branch)
### 3. 3-Tier Monthly Net KWD Impact`

  if (typeof window !== 'undefined') {
    const customApiKey = getAnthropicBrowserOverride()
    const proxyRes = await fetch('/api/ai/claude', {
      method: 'POST',
      signal: AbortSignal.timeout(hasImages ? 44000 : 34000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier,
        sonnetOnly,
        systemText: claudeSystemText,
        userPrompt,
        images: hasImages ? images : undefined,
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
      }
      if (data?.ok && data.text) {
        const badge = hasImages
          ? isAr
            ? 'فحص الصور والفيديو'
            : 'Vision & Video Inspector'
          : formatClaudeModelBadge(data.model, isAr)
        recordVerifiedModel('claude', badge)
        return {
          text: sanitizeExecutiveOutput(data.text),
          model: badge,
          rawModel: badge,
          thinkingSummary: data.thinkingSummary,
        }
      }
    } else if (proxyRes.status === 401) {
      throw new Error('ANTHROPIC_AUTH_FAILED')
    }
  }

  const key = getAnthropicRuntimeKey()
  if (!key) throw new Error('ANTHROPIC_KEY_MISSING')

  const cat = await discoverClaudeDualCatalog(false)
  const rawChain = effectiveDeep
    ? [...new Set([...cat.opusChain, cat.sonnetChain[0]].filter(Boolean))]
    : cat.sonnetChain
  const activeModels = rawChain.filter((m) => !isCoolingDown(`claude:${m}`))
  const chain = activeModels.length > 0 ? activeModels : rawChain
  const maxTokens = effectiveDeep ? 8192 : 4096

  const directUserContent: string | Array<Record<string, unknown>> = hasImages
    ? [
        ...(images ?? []).flatMap((img) => {
          const out: Array<Record<string, unknown>> = []
          if (img.label) out.push({ type: 'text', text: img.label })
          out.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: img.mediaType,
              data: img.data,
            },
          })
          return out
        }),
        { type: 'text', text: userPrompt },
      ]
    : userPrompt

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
            messages: [{ role: 'user', content: directUserContent }],
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
              messages: [{ role: 'user', content: directUserContent }],
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
              messages: [{ role: 'user', content: directUserContent }],
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
        messages: [{ role: 'user', content: directUserContent }],
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
          continue
        }

        if (res.ok) {
          const data = (await res.json()) as {
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
            const badge = hasImages
              ? isAr
                ? 'فحص الصور والفيديو'
                : 'Vision & Video Inspector'
              : formatClaudeModelBadge(null, isAr)
            recordVerifiedModel('claude', badge)
            return {
              text: sanitizeExecutiveOutput(answerText),
              model: badge,
              rawModel: badge,
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
// Live Health Check (Friendly Executive Mode Status)
// ============================================================================
export async function probeDualBrainHealth(forceRefresh = false): Promise<BrainLiveHealth> {
  if (forceRefresh) {
    clearBrainDiscoveryCaches()
  }
  const [geminiModels, grokInfo, claudeCat] = await Promise.all([
    discoverGeminiCarbonModels(forceRefresh),
    discoverGrokHeavyModels(),
    discoverClaudeDualCatalog(forceRefresh),
  ])

  const sonnetOnly = getClaudeSonnetOnly()
  const hasGeminiKey = geminiModels.length > 0
  const hasXaiKey = !grokInfo.quotaWarning
  const hasClaudeKey = claudeCat.sonnetChain.length > 0 || claudeCat.opusChain.length > 0

  return {
    claudeReady: hasClaudeKey,
    geminiReady: hasGeminiKey,
    grokReady: hasXaiKey,
    claudeModel: 'Deep Strategic',
    claudeSonnetModel: 'Fast Executive',
    claudeOpusModel: 'Deep Strategic',
    sonnetOnly,
    geminiModel: 'Fast Executive',
    grokModel: 'Vision & Video Inspector',
    grokQuotaNoteAr: grokInfo.quotaWarning
      ? 'التحليل الاستراتيجي المعمّق متصل ويعمل تلقائياً بدون توقف'
      : undefined,
    grokQuotaNoteEn: grokInfo.quotaWarning
      ? 'Deep Strategic mode active automatically without interruption'
      : undefined,
    checkedAt: Date.now(),
  }
}

// ============================================================================
// Unified Executive Advisory Orchestrator
// ============================================================================
export async function askDualHeavyBrain(req: DualBrainRequest): Promise<DualBrainResponse> {
  const mode = normalizeBrainMode(req.mode ?? getActiveBrainMode())
  const isAr = req.lang === 'ar'
  const filters = req.filters ?? DEFAULT_GLOBAL_FILTERS
  const ws = req.workspace ?? computeGlobalWorkspace(filters)
  const knowledge = buildWhitelistedOdooKnowledge(filters, ws, req.lang)

  let effectiveQuery = (req.query || '').trim()
  let extractedTranscript: string | undefined

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
          geminiModel: isAr ? 'إجابة تنفيذية سريعة' : 'Fast Executive',
          transcript: extractedTranscript,
          engineLabelAr: 'إجابة تنفيذية سريعة',
          engineLabelEn: 'Fast Executive',
        }
      }
    } catch {
      if (typeof atob === 'function') {
        try {
          const byteChars = atob(req.audioBase64)
          const bytes = new Uint8Array(byteChars.length)
          for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
          const blob = new Blob([bytes], { type: req.mimeType || 'audio/webm' })
          const fd = new FormData()
          fd.append('file', blob, 'speech.webm')
          fd.append('lang', isAr ? 'ar' : 'en')
          fd.append('language', isAr ? 'ar' : 'en')
          const openAiKey = getOpenAiRuntimeKey()
          if (typeof window !== 'undefined') {
            const proxyStt = await fetch('/api/feryal/stt', {
              method: 'POST',
              signal: AbortSignal.timeout(12000),
              body: fd,
            })
            if (proxyStt.ok) {
              const proxyData = (await proxyStt.json()) as { ok?: boolean; transcript?: string }
              if (proxyData.ok && proxyData.transcript?.trim()) {
                extractedTranscript = proxyData.transcript.trim()
                effectiveQuery = extractedTranscript
              }
            }
          } else if (openAiKey) {
            fd.append('model', 'whisper-1')
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
          }
        } catch {}
      }
    }
  }

  const visionInput = buildMultimodalEngineInputs(req.attachments, isAr)

  const fullUserPrompt = [
    req.pageContext ? `[سياق الصفحة الحالية / Page Slice]:\n${req.pageContext}` : '',
    visionInput.visionDirective,
    effectiveQuery ||
      (visionInput.hasAttachments
        ? isAr
          ? 'افحصي المرفقات البصرية بدقة واشرحي كل ما يظهر فيها مع التوصية العملية.'
          : 'Inspect the attached visual media in detail and provide an actionable operational recommendation.'
        : isAr
          ? 'عطني أهم 3 خطوات عملية لزيادة الصافي بالجيب الآن حسب الفلتر المختار.'
          : 'Give me the top 3 practical steps to grow net cash in pocket right now for the active filter.'),
  ]
    .filter(Boolean)
    .join('\n\n')

  const geminiFormatDirective = isAr
    ? `أجب باللغة العربية فقط بلغة كويتية/خليجية يومية بسيطة ومباشرة جداً بدون أي مصطلحات أكاديمية، وبالعناوين الثلاثة:
### المقترح والحل العملي
### آلية التنفيذ الواقعية (المسؤول والفرع)
### الأثر المتوقع بالدينار (متحفظ | مرجّح | أعلى)
التزم حصرياً بأرقام أودو الموثقة بالدينار الكويتي (د.ك) وبمطاعمنا الـ 6 وفروعنا الـ 7 فقط.`
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

  const modeLabelAr = visionInput.hasAttachments
    ? 'فحص الصور والفيديو'
    : getExecutiveModeLabel(mode, true)
  const modeLabelEn = visionInput.hasAttachments
    ? 'Vision & Video Inspector'
    : getExecutiveModeLabel(mode, false)

  // Mode 3: Vision & Video Inspector / Forensic Deep Mode (`claude`)
  if (mode === 'claude') {
    try {
      const claude = await runClaudeDeepEngine({
        knowledgeContext: knowledge,
        userPrompt: fullUserPrompt,
        lang: req.lang,
        tier: 'deep',
        images: visionInput.claudeImages,
      })
      autoExtractLearningsFromTurn(effectiveQuery, claude.text)
      return {
        modeUsed: 'claude',
        reply: claude.text,
        claudeReply: claude.text,
        claudeModel: visionInput.hasAttachments
          ? isAr
            ? 'فحص الصور والفيديو'
            : 'Vision & Video Inspector'
          : isAr
            ? 'تحليل استراتيجي معمّق'
            : 'Deep Strategic',
        claudeThinkingSummary: claude.thinkingSummary,
        transcript: extractedTranscript,
        engineLabelAr: visionInput.hasAttachments ? 'فحص الصور والفيديو' : 'تحليل استراتيجي معمّق',
        engineLabelEn: visionInput.hasAttachments ? 'Vision & Video Inspector' : 'Deep Strategic',
      }
    } catch {}

    try {
      const gemBackup = await runGeminiCarbonEngine({
        systemPrompt: knowledge,
        userPrompt: `${fullUserPrompt}\n\n${geminiFormatDirective}`,
        mediaParts: visionInput.geminiMediaParts,
      })
      const clean = sanitizeExecutiveOutput(gemBackup.text)
      autoExtractLearningsFromTurn(effectiveQuery, clean)
      return {
        modeUsed: 'gemini',
        reply: clean,
        geminiReply: clean,
        geminiModel: isAr ? 'إجابة تنفيذية سريعة' : 'Fast Executive',
        transcript: extractedTranscript,
        engineLabelAr: visionInput.hasAttachments ? 'فحص الصور والفيديو' : 'إجابة تنفيذية سريعة',
        engineLabelEn: visionInput.hasAttachments ? 'Vision & Video Inspector' : 'Fast Executive',
      }
    } catch {}
  }

  // Mode 2: Fast Executive (`gemini`)
  if (mode === 'gemini') {
    try {
      const gem = await runGeminiCarbonEngine({
        systemPrompt: knowledge,
        userPrompt: `${fullUserPrompt}\n\n${geminiFormatDirective}`,
        mediaParts: visionInput.geminiMediaParts,
      })
      const clean = sanitizeExecutiveOutput(gem.text)
      autoExtractLearningsFromTurn(effectiveQuery, clean)
      return {
        modeUsed: 'gemini',
        reply: clean,
        geminiReply: clean,
        geminiModel: isAr ? 'إجابة تنفيذية سريعة' : 'Fast Executive',
        transcript: extractedTranscript,
        engineLabelAr: visionInput.hasAttachments ? 'فحص الصور والفيديو' : 'إجابة تنفيذية سريعة',
        engineLabelEn: visionInput.hasAttachments ? 'Vision & Video Inspector' : 'Fast Executive',
      }
    } catch {
      try {
        const grokBackup = await runGrokHeavyEngine({
          knowledgeContext: knowledge,
          userPrompt: fullUserPrompt,
          lang: req.lang,
          grokImageUrls: visionInput.grokImageUrls,
        })
        if (grokBackup.text) {
          autoExtractLearningsFromTurn(effectiveQuery, grokBackup.text)
          return {
            modeUsed: 'grok',
            reply: grokBackup.text,
            grokReply: grokBackup.text,
            grokModel: isAr ? 'إجابة تنفيذية سريعة' : 'Fast Executive',
            transcript: extractedTranscript,
            engineLabelAr: 'إجابة تنفيذية سريعة',
            engineLabelEn: 'Fast Executive',
          }
        }
      } catch {}
    }
  }

  // Legacy `'grok'` mode -> mapped cleanly to Deep Strategic
  if (mode === 'grok') {
    try {
      const grok = await runGrokHeavyEngine({
        knowledgeContext: knowledge,
        userPrompt: fullUserPrompt,
        lang: req.lang,
        grokImageUrls: visionInput.grokImageUrls,
      })
      if (grok.text) {
        autoExtractLearningsFromTurn(effectiveQuery, grok.text)
        return {
          modeUsed: 'grok',
          reply: grok.text,
          grokReply: grok.text,
          grokModel: isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic',
          transcript: extractedTranscript,
          engineLabelAr: 'تحليل استراتيجي معمّق',
          engineLabelEn: 'Deep Strategic',
        }
      }
      const gemFallback = await runGeminiCarbonEngine({
        systemPrompt: knowledge,
        userPrompt: `${fullUserPrompt}\n\n${geminiFormatDirective}`,
        mediaParts: visionInput.geminiMediaParts,
      })
      const clean = sanitizeExecutiveOutput(gemFallback.text)
      autoExtractLearningsFromTurn(effectiveQuery, clean)
      return {
        modeUsed: 'gemini',
        reply: clean,
        geminiReply: clean,
        geminiModel: isAr ? 'إجابة تنفيذية سريعة' : 'Fast Executive',
        transcript: extractedTranscript,
        engineLabelAr: 'إجابة تنفيذية سريعة',
        engineLabelEn: 'Fast Executive',
      }
    } catch {}
  }

  // Mode 1 (Default): Deep Strategic (`تحليل استراتيجي معمّق`)
  const [claudeSettled, gemSettled, grokSettled] = await Promise.allSettled([
    runClaudeDeepEngine({
      knowledgeContext: knowledge,
      userPrompt: fullUserPrompt,
      lang: req.lang,
      tier: claudeTier,
      images: visionInput.claudeImages,
    }),
    runGeminiCarbonEngine({
      systemPrompt: knowledge,
      userPrompt: `${fullUserPrompt}\n\n${geminiFormatDirective}`,
      mediaParts: visionInput.geminiMediaParts,
    }),
    runGrokHeavyEngine({
      knowledgeContext: knowledge,
      userPrompt: fullUserPrompt,
      lang: req.lang,
      grokImageUrls: visionInput.grokImageUrls,
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

  if (activeCount >= 2) {
    const sectionsAr = [
      cleanClaude ? `[منظور التدقيق المالي والتشغيلي]:\n${cleanClaude}` : '',
      cleanGem ? `[منظور الحل التنفيذي السريع]:\n${cleanGem}` : '',
      cleanGrok ? `[منظور النمو وكشف المخاطر]:\n${cleanGrok}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    const sectionsEn = [
      cleanClaude ? `[Forensic Financial & Ops Perspective]:\n${cleanClaude}` : '',
      cleanGem ? `[Fast Executive Action Perspective]:\n${cleanGem}` : '',
      cleanGrok ? `[Growth & Risk Perspective]:\n${cleanGrok}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    const synthPrompt = isAr
      ? `أمامك تحليلات مستقلة لنفس أرقام أودو 17 لشركة فنتشر فودز الكويت (${ws.subtitleAr}):

${sectionsAr}

ادمج النقاط المشتركة ودقّق كل الأرقام بالدينار الكويتي في إجابة تنفيذية واحدة صافية ومباشرة جداً بلغة كويتية/خليجية يومية (150 إلى 230 كلمة) تحت هذه العناوين الثلاثة بالضبط:
### خلاصة التحليل الاستراتيجي المعمّق
### خطة التنفيذ الميدانية (المسؤول والفرع)
### الأثر الشهري الصافي بالدينار (متحفظ | مرجّح | أعلى)`
      : `Below are independent analyses on live Venture Foods Kuwait Odoo 17 data (${ws.subtitleEn}):

${sectionsEn}

Cross-verify all KWD figures and synthesize ONE crystal-clear executive consensus (150–230 words) using these exact 3 headings:
### Deep Strategic Consensus
### Field Execution Plan (Owner & Branch)
### 3-Tier Monthly Net KWD Impact`

    let consensusReply = ''
    try {
      if (gemOk) {
        const mergedGem = await runGeminiCarbonEngine({
          systemPrompt: knowledge,
          userPrompt: synthPrompt,
        })
        consensusReply = sanitizeExecutiveOutput(mergedGem.text)
      }
    } catch {}

    if (!consensusReply) {
      const leadText = cleanClaude || cleanGrok || cleanGem || ''
      consensusReply = isAr
        ? `### خلاصة التحليل الاستراتيجي المعمّق\nتوصية موحدة ومحققة لـ (${ws.subtitleAr}):\n\n${leadText}`
        : `### Deep Strategic Consensus\nVerified executive action plan for (${ws.subtitleEn}):\n\n${leadText}`
    }

    autoExtractLearningsFromTurn(effectiveQuery, consensusReply)

    return {
      modeUsed: 'triple',
      reply: consensusReply,
      claudeReply: cleanClaude,
      claudeModel: isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic',
      claudeThinkingSummary: claudeOk?.thinkingSummary,
      geminiReply: cleanGem,
      geminiModel: isAr ? 'إجابة تنفيذية سريعة' : 'Fast Executive',
      grokReply: cleanGrok,
      grokModel: isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic',
      transcript: extractedTranscript,
      engineLabelAr: modeLabelAr,
      engineLabelEn: modeLabelEn,
    }
  }

  if (claudeOk && cleanClaude) {
    autoExtractLearningsFromTurn(effectiveQuery, cleanClaude)
    return {
      modeUsed: 'triple',
      reply: cleanClaude,
      claudeReply: cleanClaude,
      claudeModel: isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic',
      claudeThinkingSummary: claudeOk.thinkingSummary,
      transcript: extractedTranscript,
      engineLabelAr: modeLabelAr,
      engineLabelEn: modeLabelEn,
    }
  }

  if (grokOk && cleanGrok) {
    autoExtractLearningsFromTurn(effectiveQuery, cleanGrok)
    return {
      modeUsed: 'triple',
      reply: cleanGrok,
      grokReply: cleanGrok,
      grokModel: isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic',
      transcript: extractedTranscript,
      engineLabelAr: modeLabelAr,
      engineLabelEn: modeLabelEn,
    }
  }

  if (gemOk && cleanGem) {
    autoExtractLearningsFromTurn(effectiveQuery, cleanGem)
    return {
      modeUsed: 'triple',
      reply: cleanGem,
      geminiReply: cleanGem,
      geminiModel: isAr ? 'إجابة تنفيذية سريعة' : 'Fast Executive',
      transcript: extractedTranscript,
      engineLabelAr: modeLabelAr,
      engineLabelEn: modeLabelEn,
    }
  }

  const topPlay = ws.plays[0]
  const fin = deriveWorkspaceFinancials(ws)
  const fallbackReply = isAr
    ? `### خلاصة التحليل الاستراتيجي المعمّق
بناءً على أرقام أودو 17 المباشرة لـ **${ws.subtitleAr}**: المبيعات **${f0(ws.salesKwd)} د.ك** عبر **${f0(ws.orders)} طلب**، والصافي الفعلي بالجيب **${f0(fin.netPocketKwd)} د.ك** (${fin.netPocket10.toFixed(2)} د.ك من كل 10 دنانير).

### خطة التنفيذ الميدانية (المسؤول والفرع)
1. ${topPlay ? `${topPlay.titleAr}: ${topPlay.solutionAr}` : 'ضبط أوزان الوجبات في المخزن ومطبخ العارضية ومراجعة أسعار الموردين.'}
2. تنشيط الساعات الهادئة (3 إلى 6 عصراً) وتحويل ضغط التوصيل إلى سائقي الشركة TMP بعمولة 15%.
3. تحصيل مستحقات منصات التوصيل المعلقة والبالغة **${f0(fin.deliveryDueKwd)} د.ك**.

### الأثر الشهري الصافي بالدينار (متحفظ | مرجّح | أعلى)
- استرداد وزيادة صافي الربح بنحو **+${topPlay ? topPlay.periodLabelAr : `${f0(ws.salesKwd * 0.04)} د.ك`}** خلال نفس الفترة.`
    : `### Deep Strategic Consensus
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
    engineLabelAr: modeLabelAr,
    engineLabelEn: modeLabelEn,
  }
}

// ============================================================================
// 1-Click Executive Brief Builder (`نسخ الملخص التنفيذي 📋`)
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
    return `ملخص تنفيذي لتحليل استراتيجي معمّق — شركة فنتشر فودز الكويت (6 مطاعم • 7 فروع • 8 قنوات · Odoo 17)
• الصفحة: ${pageTitle || 'ملخص الشركة'}
• الفلتر النشط: ${ws.subtitleAr}
• المطاعم المعتمدة فقط (6 مطاعم): تشاينا جاردن، فرانكس، طحينة، فارم براون، ذا نودل بار، كرك كافتيريا
• الفروع النشطة فقط (7 فروع + بوثات المعارض): الأفنيوز، مول 360، العاصمة، بروميناد، السالمية، الكوت، مطبخ العارضية
• القاعدة المؤسسية للتوريد: المشتريات تشتري من الموردين ← نقل واستلام في المخزن ← توزيع المخزن ومطبخ العارضية على الفروع
• قاعدة التوصيل المزدوج: تعاقد Tgo في كل الفروع + سائقو الشركة على TMP بعمولة 15% في الفروع المعتمدة

الأرقام الفعلية الحالية من أودو 17:
- المبيعات: ${f0(ws.salesKwd)} د.ك (${f0(ws.orders)} طلب · متوسط الفاتورة ${ws.aovKwd.toFixed(2)} د.ك)
- تكلفة الأكل والتغليف: ${f0(fin.foodCostKwd)} د.ك (${fin.food10.toFixed(2)} من كل 10 د.ك)
- عمولات تطبيقات التوصيل: ${f0(fin.deliveryCommKwd)} د.ك (${fin.delivery10.toFixed(2)} من كل 10 د.ك)
- الإيجار والرواتب والمصاريف: ${f0(fin.rentStaffOpexKwd)} د.ك (${fin.opexRent10.toFixed(2)} من كل 10 د.ك)
- الصافي الفعلي بالجيب: ${f0(fin.netPocketKwd)} د.ك (${fin.netPocket10.toFixed(2)} من كل 10 د.ك)
- مستحقات التوصيل المعلقة للتحصيل: ${f0(fin.deliveryDueKwd)} د.ك

أهم الفرص المرصودة حالياً:
${top3}

المطلوب:
حلّل هذه الأرقام عبر 3 زوايا (1: زيادة الصافي بالجيب، 2: ضبط المخزن والعارضية والفروع، 3: تعظيم سائقي TMP 15% وكشف أي تسرب خفي) بلغة كويتية عملية بسيطة وبأرقام محددة بالدينار الكويتي (متحفظ | مرجّح | أعلى).`
  }

  return `Executive Deep Strategic Brief — Venture Foods Kuwait (6 Brands • 7 Branches • 8 Channels · Odoo 17)
• Page: ${pageTitle || 'Company Summary'}
• Active Filter: ${ws.subtitleEn}
• Strictly 6 Approved Brands: China Garden, Frank's, Tahina, Farm Brown, The Noodle Bar, Karak Cafeteria
• Strictly 7 Active Branches + EXB Booths: The Avenues, 360, Assima, Promenade, Salmiya, Al-Kout, Ardiya
• Supply-Chain Rule: Procurement -> Central Warehouse receiving -> Warehouse & Ardiya dispatch to branches
• Dual Delivery Fleet: Talabat Tgo across all branches + in-house company drivers on TMP (15% fee) in designated branches

Live Odoo 17 Numbers:
- Net Sales: ${f0(ws.salesKwd)} KWD (${f0(ws.orders)} orders · Avg Bill ${ws.aovKwd.toFixed(2)} KWD)
- Food & Packaging Cost: ${f0(fin.foodCostKwd)} KWD (${fin.food10.toFixed(2)} per 10 KWD)
- Delivery App Commissions: ${f0(fin.deliveryCommKwd)} KWD (${fin.delivery10.toFixed(2)} per 10 KWD)
- Rent, Payroll & Branch Opex: ${f0(fin.rentStaffOpexKwd)} KWD (${fin.opexRent10.toFixed(2)} per 10 KWD)
- Net Cash in Pocket: ${f0(fin.netPocketKwd)} KWD (${fin.netPocket10.toFixed(2)} per 10 KWD)
- Open Delivery Dues: ${f0(fin.deliveryDueKwd)} KWD

Top Flagged Opportunities:
${top3}

Task:
Analyze across 3 simultaneous lenses (1: Net Cash & Margin, 2: Warehouse, Ardiya & Branch Execution, 3: TMP 15% Fleet & Hidden Risk Audit) in plain business English with 3-tier monthly KWD targets.`
}
