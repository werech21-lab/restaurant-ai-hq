/**
 * Feryal Live Odoo Client Bridge (`src/lib/dual-heavy-brain.ts`)
 *
 * Purged of all static `ODOO` / `LEDGER` / `JOURNEY_PLAYS` injections and regex template replies.
 * Routes all Feryal chat queries strictly through the protected live Odoo 17 endpoint
 * `POST /api/erp/feryal/chat` backed by `src/lib/feryal-odoo-agent.ts`.
 */

export type BrainMode = 'triple' | 'claude' | 'gemini' | 'grok'

export type FeryalPrimaryMode = 'triple' | 'gemini'

export interface FeryalPrimaryModeMeta {
  id: FeryalPrimaryMode
  shortAr: string
  shortEn: string
  subAr: string
  subEn: string
  badgeAr: string
  badgeEn: string
  labelAr: string
  labelEn: string
  subtitleAr: string
  subtitleEn: string
}

export const FERYAL_PRIMARY_MODES: readonly FeryalPrimaryModeMeta[] = [
  {
    id: 'triple',
    shortAr: 'مطابقة أرقام Odoo 17',
    shortEn: 'Odoo 17 Number Match',
    subAr: 'فحص صارم لأرقام Odoo 17',
    subEn: 'Strict Odoo 17 Check',
    badgeAr: 'مطابقة أرقام Odoo 17',
    badgeEn: 'Odoo 17 Number Match',
    labelAr: 'مطابقة أرقام Odoo 17',
    labelEn: 'Odoo 17 Number Match',
    subtitleAr: 'مبيعات وأصناف ومشتريات ومخزون وموارد بشرية وقيود Odoo 17 مع فاحص الأرقام',
    subtitleEn: 'Odoo 17 POS, items, POs, stock moves, HR & GL entries with numeric verifier',
  },
  {
    id: 'gemini',
    shortAr: 'استعلام Odoo 17',
    shortEn: 'Odoo 17 Query',
    subAr: 'بيانات Odoo 17 الفعلية',
    subEn: 'Odoo 17 Data',
    badgeAr: 'استعلام Odoo 17',
    badgeEn: 'Odoo 17 Query',
    labelAr: 'استعلام Odoo 17',
    labelEn: 'Odoo 17 Query',
    subtitleAr: 'استعلام فوري من جداول Odoo 17 المعتمدة للفروع السبعة',
    subtitleEn: 'Direct query across approved 7 branches + Unattributed bucket',
  },
] as const

export const FERYAL_EXECUTIVE_MODES = FERYAL_PRIMARY_MODES

export function mapModeToPrimary(mode?: BrainMode | string | null): FeryalPrimaryMode {
  if (mode === 'gemini') return 'gemini'
  return 'triple'
}

export function getPrimaryModeBadge(
  mode: BrainMode | string | undefined,
  langOrIsAr: 'ar' | 'en' | boolean,
): string {
  const isAr = typeof langOrIsAr === 'boolean' ? langOrIsAr : langOrIsAr === 'ar'
  const primary = mapModeToPrimary(mode)
  const meta = FERYAL_PRIMARY_MODES.find((m) => m.id === primary) ?? FERYAL_PRIMARY_MODES[0]
  return isAr ? meta.badgeAr : meta.badgeEn
}

export interface BrainLiveHealth {
  geminiOk: boolean
  geminiReady: boolean
  geminiModel: string
  geminiLatencyMs?: number
  claudeOk: boolean
  claudeReady: boolean
  claudeModel: string
  claudeLatencyMs?: number
  grokOk: boolean
  grokModel: string
  grokLatencyMs?: number
  sonnetOnly?: boolean
  checkedAt: string
}

export interface DualBrainTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface FeryalExecutedQueryMeta {
  model: string
  method: string
  domain: unknown[]
  groupby: string[]
  period: { from: string; to: string }
}

export interface DualBrainResult {
  reply: string
  provider: 'odoo-live' | 'deterministic'
  modeUsed: BrainMode
  engineBadgeAr: string
  engineBadgeEn: string
  geminiModel?: string
  claudeModel?: string
  grokModel?: string
  chatgptModel?: string
  learnedFact?: string
  executedQueries?: FeryalExecutedQueryMeta[]
  verifierValid?: boolean
}

export const BRAIN_MODE_STORAGE_KEY = 'aether_brain_mode_v3'
export const CLAUDE_SONNET_ONLY_KEY = 'aether_claude_sonnet_only_v1'
export const BRAIN_HEALTH_EVENT = 'aether-brain-health-updated'
export const BRAIN_MODE_EVENT = 'aether-brain-mode-changed'

export function normalizeBrainMode(raw?: string | null): BrainMode {
  if (raw === 'triple' || raw === 'claude' || raw === 'gemini' || raw === 'grok') {
    return raw
  }
  return 'triple'
}

export function getActiveBrainMode(): BrainMode {
  if (typeof window === 'undefined') return 'triple'
  try {
    return normalizeBrainMode(window.localStorage.getItem(BRAIN_MODE_STORAGE_KEY))
  } catch {
    return 'triple'
  }
}

export function setActiveBrainMode(mode: BrainMode): void {
  if (typeof window === 'undefined') return
  try {
    const clean = normalizeBrainMode(mode)
    window.localStorage.setItem(BRAIN_MODE_STORAGE_KEY, clean)
    window.dispatchEvent(new CustomEvent(BRAIN_MODE_EVENT, { detail: clean }))
  } catch {
    // ignore storage errors
  }
}

export function getClaudeSonnetOnly(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(CLAUDE_SONNET_ONLY_KEY) === '1'
  } catch {
    return false
  }
}

export function setClaudeSonnetOnly(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CLAUDE_SONNET_ONLY_KEY, enabled ? '1' : '0')
    window.dispatchEvent(new CustomEvent(BRAIN_MODE_EVENT, { detail: getActiveBrainMode() }))
  } catch {
    // ignore storage errors
  }
}

export async function probeDualBrainHealth(_forceRefresh = false): Promise<BrainLiveHealth> {
  const start = Date.now()
  let odooOk = false
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/erp/feryal/chat?limit=1', {
        method: 'GET',
        cache: 'no-store',
      })
      odooOk = res.ok
    } catch {
      odooOk = false
    }
  }
  const latency = Date.now() - start
  const health: BrainLiveHealth = {
    geminiOk: odooOk,
    geminiReady: odooOk,
    geminiModel: 'odoo-live',
    geminiLatencyMs: latency,
    claudeOk: odooOk,
    claudeReady: odooOk,
    claudeModel: 'odoo-live',
    claudeLatencyMs: latency,
    grokOk: odooOk,
    grokModel: 'odoo-live',
    grokLatencyMs: latency,
    sonnetOnly: getClaudeSonnetOnly(),
    checkedAt: new Date().toISOString(),
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BRAIN_HEALTH_EVENT, { detail: health }))
  }
  return health
}

export function buildGrokUltraClipboardBrief(
  questionOrFilters?: unknown,
  langOrWorkspace?: unknown,
  isArParam?: boolean,
  pageTitle?: string,
): string {
  const isAr =
    typeof isArParam === 'boolean'
      ? isArParam
      : langOrWorkspace === 'en'
        ? false
        : true

  const wsObj =
    langOrWorkspace && typeof langOrWorkspace === 'object'
      ? (langOrWorkspace as { subtitleAr?: string; subtitleEn?: string })
      : null

  const scopeLine = wsObj
    ? isAr
      ? wsObj.subtitleAr || ''
      : wsObj.subtitleEn || ''
    : typeof questionOrFilters === 'string'
      ? questionOrFilters.trim()
      : ''

  if (!isAr) {
    return [
      'Venture Foods Kuwait — Odoo 17 Scope (6 Approved Brands, 7 Branches + Unattributed Bucket)',
      pageTitle ? `Page: ${pageTitle}` : '',
      scopeLine ? `Active Scope: ${scopeLine}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  return [
    'شركة فنتشر فودز الكويت — نطاق Odoo 17 الفعلي (6 علامات تجارية و7 فروع معتمدة + غير منسوب لفرع)',
    pageTitle ? `الصفحة: ${pageTitle}` : '',
    scopeLine ? `النطاق النشط: ${scopeLine}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function getDeterministicFeryalReply(query: string, _lang: 'ar' | 'en' = 'ar'): string {
  if (/منافس|competitor|rival/i.test(query)) {
    return 'لا أعرف'
  }
  return 'لا أملك بيانات من Odoo عن هذا'
}

export async function askDualHeavyBrain(params: {
  prompt: string
  lang?: 'ar' | 'en'
  mode?: BrainMode
  history?: DualBrainTurn[]
  extraContext?: string
}): Promise<DualBrainResult> {
  const question = (params.prompt ?? '').trim()
  const modeUsed = normalizeBrainMode(params.mode ?? getActiveBrainMode())

  if (/منافس|competitor|rival/i.test(question)) {
    return {
      reply: 'لا أعرف',
      provider: 'odoo-live',
      modeUsed,
      engineBadgeAr: 'رفض خارج نطاق الشركة',
      engineBadgeEn: 'Out-of-Scope Competitor Refusal',
      executedQueries: [],
      verifierValid: true,
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/erp/feryal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      if (res.ok) {
        const data = (await res.json()) as {
          ok?: boolean
          reply?: string
          model?: string
          executedQueries?: FeryalExecutedQueryMeta[]
          verifier?: { valid?: boolean }
        }
        if (data.ok && typeof data.reply === 'string') {
          const modelLabel = data.model || 'odoo-live'
          return {
            reply: data.reply,
            provider: 'odoo-live',
            modeUsed,
            engineBadgeAr: `Odoo 17 (${modelLabel})`,
            engineBadgeEn: `Odoo 17 (${modelLabel})`,
            geminiModel: modelLabel,
            executedQueries: data.executedQueries ?? [],
            verifierValid: data.verifier?.valid ?? true,
          }
        }
      }
    } catch {
      // fall through to explicit no-data message
    }
  }

  return {
    reply: 'لا أملك بيانات من Odoo عن هذا',
    provider: 'deterministic',
    modeUsed,
    engineBadgeAr: 'لا تتوفر بيانات من Odoo',
    engineBadgeEn: 'No Odoo Data',
    executedQueries: [],
    verifierValid: true,
  }
}
