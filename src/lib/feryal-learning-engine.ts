/**
 * Feryal Institutional Memory Store (`src/lib/feryal-learning-engine.ts`)
 *
 * Clean, zero-fabrication institutional notes store:
 * - Zero pre-loaded rules, zero fabricated decision outcomes, zero synthetic snapshots.
 * - Stores ONLY explicit executive notes and verified outcomes recorded directly by the user.
 * - Never injects unverified numbers into Odoo data answers.
 */

export const FERYAL_LEARNING_DB_NAME = 'aether_feryal_learning_clean_v3'
export const FERYAL_LEARNING_STORE = 'memory_state'
export const FERYAL_LEARNING_MIRROR_KEY = 'aether_feryal_learning_clean_v3'
export const FERYAL_MEMORY_UPDATED_EVENT = 'aether-feryal-memory-updated'

export type LearnedRuleCategory =
  | 'operations'
  | 'suppliers'
  | 'pricing'
  | 'delivery'
  | 'branches'
  | 'menu'
  | 'custom'

export interface LearnedRule {
  id: string
  category: LearnedRuleCategory
  textAr: string
  textEn: string
  createdAt: string
  source: 'user' | 'approved'
}

export interface LearnedPreference {
  key: string
  labelAr: string
  labelEn: string
  valueAr: string
  valueEn: string
  updatedAt: string
}

export interface ApprovedDecisionOutcome {
  id: string
  decisionTitleAr: string
  decisionTitleEn: string
  branchOrBrandAr: string
  branchOrBrandEn: string
  status: 'approved' | 'rejected'
  monthlyGainKwd: number
  lessonAr: string
  lessonEn: string
  recordedAt: string
}

export interface PeriodCompareSnapshot {
  periodKey: string
  labelAr: string
  labelEn: string
  totalSalesKwd: number
  totalOrders: number
  netPer10Kwd: number
  deliveryFeePer10Kwd: number
  foodCostPer10Kwd: number
  operatingPer10Kwd: number
  capturedAt: string
}

export interface FeryalMemoryState {
  version: number
  rules: LearnedRule[]
  preferences: LearnedPreference[]
  outcomes: ApprovedDecisionOutcome[]
  snapshots: PeriodCompareSnapshot[]
  totalInteractions: number
  lastUpdatedAt: string
}

export interface MacroBigBetStrategy {
  id: string
  badgeAr: string
  badgeEn: string
  titleAr: string
  titleEn: string
  summaryAr: string
  summaryEn: string
  monthlyPotentialAr: string
  monthlyPotentialEn: string
  promptAr: string
  promptEn: string
}

export const MACRO_BIG_BET_STRATEGIES: readonly MacroBigBetStrategy[] = []

let memorySeqCounter = 0
function nextMemoryId(prefix: string): string {
  memorySeqCounter = (memorySeqCounter + 1) % 1_000_000
  return `${prefix}-${Date.now()}-${memorySeqCounter}`
}

function buildEmptyMemoryState(): FeryalMemoryState {
  return {
    version: 3,
    rules: [],
    preferences: [],
    outcomes: [],
    snapshots: [],
    totalInteractions: 0,
    lastUpdatedAt: new Date().toISOString(),
  }
}

function sanitizeLoadedMemory(raw: Partial<FeryalMemoryState> | null | undefined): FeryalMemoryState {
  const empty = buildEmptyMemoryState()
  if (!raw || typeof raw !== 'object' || raw.version !== 3) {
    return empty
  }
  const rules = Array.isArray(raw.rules)
    ? raw.rules.filter(
        (r): r is LearnedRule =>
          Boolean(
            r &&
              typeof r.id === 'string' &&
              (r.source === 'user' || r.source === 'approved') &&
              typeof r.textAr === 'string' &&
              r.textAr.trim().length > 0,
          ),
      )
    : []
  const preferences = Array.isArray(raw.preferences) ? raw.preferences : []
  const outcomes = Array.isArray(raw.outcomes) ? raw.outcomes : []
  const snapshots = Array.isArray(raw.snapshots) ? raw.snapshots : []

  return {
    version: 3,
    rules,
    preferences,
    outcomes,
    snapshots,
    totalInteractions: typeof raw.totalInteractions === 'number' ? raw.totalInteractions : 0,
    lastUpdatedAt: typeof raw.lastUpdatedAt === 'string' ? raw.lastUpdatedAt : empty.lastUpdatedAt,
  }
}

let cachedMemory: FeryalMemoryState | null = null

function emitMemoryUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FERYAL_MEMORY_UPDATED_EVENT))
  }
}

function openLearningDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(FERYAL_LEARNING_DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(FERYAL_LEARNING_STORE)) {
          db.createObjectStore(FERYAL_LEARNING_STORE)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function writeToIndexedDb(state: FeryalMemoryState): Promise<void> {
  const db = await openLearningDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(FERYAL_LEARNING_STORE, 'readwrite')
      tx.objectStore(FERYAL_LEARNING_STORE).put(state, 'primary')
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

async function readFromIndexedDb(): Promise<FeryalMemoryState | null> {
  const db = await openLearningDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(FERYAL_LEARNING_STORE, 'readonly')
      const req = tx.objectStore(FERYAL_LEARNING_STORE).get('primary')
      req.onsuccess = () => {
        const val = req.result as Partial<FeryalMemoryState> | undefined
        resolve(val && val.version === 3 ? sanitizeLoadedMemory(val) : null)
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export function getFeryalMemorySync(): FeryalMemoryState {
  if (cachedMemory) return cachedMemory
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(FERYAL_LEARNING_MIRROR_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FeryalMemoryState>
        cachedMemory = sanitizeLoadedMemory(parsed)
        return cachedMemory
      }
    } catch {
      // ignore storage read error
    }
  }
  const fresh = buildEmptyMemoryState()
  cachedMemory = fresh
  return fresh
}

export async function hydrateFeryalMemory(): Promise<FeryalMemoryState> {
  const fromIdb = await readFromIndexedDb()
  if (fromIdb) {
    cachedMemory = fromIdb
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(FERYAL_LEARNING_MIRROR_KEY, JSON.stringify(fromIdb))
      }
    } catch {
      // ignore storage quota errors
    }
    emitMemoryUpdated()
    return fromIdb
  }
  const syncState = getFeryalMemorySync()
  await saveFeryalMemory(syncState)
  return syncState
}

export async function saveFeryalMemory(next: FeryalMemoryState): Promise<FeryalMemoryState> {
  const stamped: FeryalMemoryState = {
    ...sanitizeLoadedMemory(next),
    lastUpdatedAt: new Date().toISOString(),
  }
  cachedMemory = stamped
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(FERYAL_LEARNING_MIRROR_KEY, JSON.stringify(stamped))
    } catch {
      // ignore storage errors
    }
  }
  await writeToIndexedDb(stamped)
  emitMemoryUpdated()
  return stamped
}

export async function teachPermanentFact(params: {
  text: string
  category?: LearnedRuleCategory
  source?: LearnedRule['source']
}): Promise<FeryalMemoryState> {
  const clean = params.text.trim()
  if (!clean) return getFeryalMemorySync()

  const state = getFeryalMemorySync()
  const exists = state.rules.some(
    (r) =>
      r.textAr.toLowerCase() === clean.toLowerCase() ||
      r.textEn.toLowerCase() === clean.toLowerCase(),
  )
  if (exists) return state

  const newRule: LearnedRule = {
    id: nextMemoryId('rule'),
    category: params.category || inferRuleCategory(clean),
    textAr: clean,
    textEn: clean,
    createdAt: new Date().toISOString().slice(0, 10),
    source: params.source === 'approved' ? 'approved' : 'user',
  }

  return saveFeryalMemory({
    ...state,
    rules: [newRule, ...state.rules].slice(0, 80),
  })
}

export async function deleteLearnedRule(ruleId: string): Promise<FeryalMemoryState> {
  const state = getFeryalMemorySync()
  return saveFeryalMemory({
    ...state,
    rules: state.rules.filter((r) => r.id !== ruleId),
  })
}

export async function recordDecisionOutcome(params: {
  titleAr: string
  titleEn?: string
  branchOrBrandAr?: string
  branchOrBrandEn?: string
  status: 'approved' | 'rejected'
  monthlyGainKwd?: number
  lessonAr?: string
  lessonEn?: string
}): Promise<FeryalMemoryState> {
  const state = getFeryalMemorySync()
  const entry: ApprovedDecisionOutcome = {
    id: nextMemoryId('out'),
    decisionTitleAr: params.titleAr,
    decisionTitleEn: params.titleEn || params.titleAr,
    branchOrBrandAr: params.branchOrBrandAr || 'الفروع المعتمدة',
    branchOrBrandEn: params.branchOrBrandEn || 'Approved Branches',
    status: params.status,
    monthlyGainKwd:
      typeof params.monthlyGainKwd === 'number' && Number.isFinite(params.monthlyGainKwd)
        ? params.monthlyGainKwd
        : 0,
    lessonAr:
      params.lessonAr ||
      (params.status === 'approved'
        ? `تم توثيق اعتماد القرار: ${params.titleAr}`
        : `تم تسجيل رفض المقترح: ${params.titleAr}`),
    lessonEn:
      params.lessonEn ||
      (params.status === 'approved'
        ? `Recorded executive approval: ${params.titleEn || params.titleAr}`
        : `Recorded executive rejection: ${params.titleEn || params.titleAr}`),
    recordedAt: new Date().toISOString().slice(0, 10),
  }

  return saveFeryalMemory({
    ...state,
    outcomes: [entry, ...state.outcomes].slice(0, 50),
  })
}

export async function resetFeryalMemoryToDefaults(): Promise<FeryalMemoryState> {
  const fresh = buildEmptyMemoryState()
  return saveFeryalMemory(fresh)
}

function inferRuleCategory(text: string): LearnedRuleCategory {
  const t = text.toLowerCase()
  if (/مورد|شراء|فاتور|supplier|vendor|purchase/.test(t)) return 'suppliers'
  if (/سعر|تسعير|خصم|price|discount/.test(t)) return 'pricing'
  if (/توصيل|طلبات|كيتا|ديليفرو|جاهز|delivery|talabat|keeta|deliveroo/.test(t)) return 'delivery'
  if (/فرع|أفنيوز|360|بروميناد|سالمية|كوت|عاصمة|عارضية|branch/.test(t)) return 'branches'
  if (/صنف|وجبة|طبق|منيو|menu|item/.test(t)) return 'menu'
  if (/مطبخ|مخزن|هدر|kitchen|waste|stock/.test(t)) return 'operations'
  return 'custom'
}

export async function autoLearnFromConversationTurn(
  userQuery: string,
  _assistantReply: string,
): Promise<{ learnedFact?: string }> {
  const q = userQuery.trim()
  if (!q) return {}

  const state = getFeryalMemorySync()
  let nextState: FeryalMemoryState = {
    ...state,
    totalInteractions: state.totalInteractions + 1,
  }

  let learnedFact: string | undefined
  const teachMatch = q.match(
    /^(?:علّمي فريال|علمي فريال|تذكري دائماً|تذكري دائما|قاعدة دائمة|معلومة ثابتة|teach feryal|remember always|permanent rule)\s*[:：\-]?\s*(.+)$/i,
  )
  const factCandidate = teachMatch?.[1]?.trim()

  if (factCandidate && factCandidate.length >= 6) {
    const alreadyExists = nextState.rules.some(
      (r) => r.textAr.toLowerCase() === factCandidate.toLowerCase(),
    )
    if (!alreadyExists) {
      const rule: LearnedRule = {
        id: nextMemoryId('rule'),
        category: inferRuleCategory(factCandidate),
        textAr: factCandidate,
        textEn: factCandidate,
        createdAt: new Date().toISOString().slice(0, 10),
        source: 'user',
      }
      nextState = {
        ...nextState,
        rules: [rule, ...nextState.rules].slice(0, 80),
      }
      learnedFact = factCandidate
    }
  }

  await saveFeryalMemory(nextState)
  return { learnedFact }
}

export function buildFeryalMemoryPromptInjection(lang: 'ar' | 'en'): string {
  const mem = getFeryalMemorySync()
  if (mem.rules.length === 0 && mem.outcomes.length === 0) {
    return ''
  }

  if (lang === 'ar') {
    const rulesLines = mem.rules.slice(0, 10).map((r) => `- ${r.textAr}`)
    return rulesLines.length > 0
      ? `\n\n[ملاحظات المستخدم المحفوظة]\n${rulesLines.join('\n')}`
      : ''
  }

  const rulesLines = mem.rules.slice(0, 10).map((r) => `- ${r.textEn}`)
  return rulesLines.length > 0 ? `\n\n[User Saved Notes]\n${rulesLines.join('\n')}` : ''
}

export function getMacroStrategyCards(): readonly MacroBigBetStrategy[] {
  return MACRO_BIG_BET_STRATEGIES
}
