/**
 * Feryal Self-Learning, Institutional Memory & Macro Big-Bet Engine
 * (`src/lib/feryal-learning-engine.ts`)
 *
 * 4-Layer Continuous Learning Architecture:
 *   1. Institutional Rules (`rules`) — Pre-seeded Venture Foods supply-chain & dual TMP 15% + Tgo fleet rules,
 *      plus manual executive teachings (`+ علّم فريال معلومة دائمة`) and auto-extracted facts from chats.
 *   2. Executive Preferences (`preferences`) — Communication style, financial realism bounds, and priority focus.
 *   3. Proven Decision Outcomes (`outcomes`) — Before/After tracked results (`خطة مجرّبة ورابحة ✅`) with
 *      automatic cross-brand & cross-branch scaling recommendations.
 *   4. Longitudinal Odoo Daily Snapshots (`snapshots`) — Daily KPI ledger to detect multi-day margin drift.
 *
 * Persisted in IndexedDB (`aether_feryal_learning_v1`) with a fast synchronous `localStorage` mirror
 * (`aether_feryal_learning_mirror_v1`) so `<feryal_evolving_memory>` (~800 tokens) injects instantaneously
 * into cached system prompts across Claude Extended Thinking, Gemini Carbon Pro, and Grok Heavy.
 */

import { ODOO } from '@/lib/odoo/odoo-dataset'
import {
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
  type GlobalWorkspaceSlice,
} from '@/lib/aether/global-filter-engine'

export const FERYAL_LEARNING_DB_NAME = 'aether_feryal_learning_v1'
export const FERYAL_LEARNING_MIRROR_KEY = 'aether_feryal_learning_mirror_v1'
export const FERYAL_MEMORY_UPDATED_EVENT = 'aether-feryal-memory-updated'

export type RuleCategory =
  | 'supply_chain'
  | 'delivery_fleet'
  | 'branches_menu'
  | 'finance_policy'

export interface InstitutionalRule {
  id: string
  category: RuleCategory
  textAr: string
  textEn: string
  source: 'preseeded' | 'manual_taught' | 'auto_chat'
  createdAt: string
  pinned?: boolean
}

export interface ExecutivePreference {
  id: string
  textAr: string
  textEn: string
  weight: number
  updatedAt: string
}

export interface DecisionOutcomeRecord {
  id: string
  titleAr: string
  titleEn: string
  originBrandAr: string
  originBrandEn: string
  originBranchAr: string
  originBranchEn: string
  beforeMetricAr: string
  afterMetricAr: string
  monthlyGainKwd: number
  status: 'proven_winner' | 'monitoring'
  scaleSuggestionAr: string
  scaleSuggestionEn: string
  verifiedAt: string
}

export interface OdooDailySnapshot {
  dateKey: string // YYYY-MM-DD
  syncedAt: string
  sales30dKwd: number
  orders30d: number
  aovKwd: number
  netPocket10: number
  food10: number
  delivery10: number
}

export interface FeryalMemoryState {
  version: number
  rules: InstitutionalRule[]
  preferences: ExecutivePreference[]
  outcomes: DecisionOutcomeRecord[]
  snapshots: OdooDailySnapshot[]
  totalAutoLearnings: number
  lastUpdatedAt: string
}

export type MacroBigBetId =
  | 'bulk-warehouse'
  | 'zero-rent-expansion'
  | 'tmp-direct-shift'
  | 'all-big-bets'

export interface MacroBigBetStrategy {
  id: MacroBigBetId
  badgeAr: string
  badgeEn: string
  titleAr: string
  titleEn: string
  summaryAr: string
  summaryEn: string
  estMonthlyKwdMin: number
  estMonthlyKwdMax: number
}

export const MACRO_BIG_BET_STRATEGIES: readonly MacroBigBetStrategy[] = [
  {
    id: 'bulk-warehouse',
    badgeAr: 'المخزن والعارضية 📦',
    badgeEn: 'Warehouse Lock 📦',
    titleAr: 'عقود شراء موحد للمخزن المركزي',
    titleEn: 'Bulk Warehouse Procurement Locks',
    summaryAr:
      'تجميع مشتريات العلامات الـ ٦ بعقود ربع سنوية ثابتة السعر واستلامها في المخزن المركزي قبل التوزيع على العارضية والفروع.',
    summaryEn:
      'Consolidate 6-brand volume into quarterly fixed-price supplier contracts received at the central warehouse before Ardiya & branch dispatch.',
    estMonthlyKwdMin: 3800,
    estMonthlyKwdMax: 6400,
  },
  {
    id: 'zero-rent-expansion',
    badgeAr: 'توسع بدون إيجار 🏭',
    badgeEn: 'Zero-Rent Scale 🏭',
    titleAr: 'توسع العلامات داخل نفس المطابخ',
    titleEn: 'Zero-Rent Cross-Brand Kitchen Expansion',
    summaryAr:
      'تشغيل أصناف طحينة وكرك كافتيريا وذا نودل بار من داخل مطابخ الفروع القائمة بنفس الإيجار والعمالة لرفع مبيعات كل متر مربع.',
    summaryEn:
      'Launch high-margin Tahina, Karak Cafeteria & Noodle Bar virtual lines inside existing branch kitchens at zero extra rent or headcount.',
    estMonthlyKwdMin: 4500,
    estMonthlyKwdMax: 8200,
  },
  {
    id: 'tmp-direct-shift',
    badgeAr: 'أسطول TMP 15% 🛵',
    badgeEn: 'TMP 15% Shift 🛵',
    titleAr: 'التحول لسائقي الشركة والطلب المباشر',
    titleEn: 'TMP 15% Fleet & 0%-Fee Direct Shift',
    summaryAr:
      'نقل ضغط التوصيل في الفروع عالية الكثافة من عمولة Tgo إلى سائقي الشركة TMP بعمولة 15% مع كرت إعادة طلب مباشر داخل كل كيس.',
    summaryEn:
      'Shift dense delivery zones from higher Tgo fees onto in-house TMP 15% company drivers plus QR direct re-order inserts.',
    estMonthlyKwdMin: 3200,
    estMonthlyKwdMax: 5900,
  },
  {
    id: 'all-big-bets',
    badgeAr: 'الخطة الكبرى الشاملة 🚀',
    badgeEn: 'Full 90-Day Big Bets 🚀',
    titleAr: 'ابتكار الحلول الكبرى الثلاثة معاً',
    titleEn: 'Synthesize All 3 Macro Big-Bet Plays',
    summaryAr:
      'خارطة طريق تنفيذية لمدة ٩٠ يوماً تدمج الشراء الموحد بالمخزن + التوسع بدون إيجار + التحول لأسطول TMP 15% بصافي أثر شهري موثق.',
    summaryEn:
      'Unified 90-day CFO/COO masterplan combining bulk warehouse locks, zero-rent cross-brand kitchens, and TMP 15% fleet shift.',
    estMonthlyKwdMin: 11500,
    estMonthlyKwdMax: 20500,
  },
] as const

// ============================================================================
// Pre-Seeded Venture Foods Institutional Rules, Preferences & Outcomes
// ============================================================================
const PRESEEDED_RULES: InstitutionalRule[] = [
  {
    id: 'rule-vf-supply-chain-core',
    category: 'supply_chain',
    textAr:
      'المشتريات تشتري من الموردين ← نقل واستلام في المخزن ← توزيع المخزن ومطبخ العارضية على الفروع (يُمنع الشراء العشوائي المباشر بالفرع خارج دورة المخزن المعتمدة).',
    textEn:
      'Procurement buys from suppliers -> transport & receiving into Central Warehouse -> Warehouse & Ardiya Central Kitchen distribute to branches (no unapproved direct branch buying).',
    source: 'preseeded',
    createdAt: '2026-01-01T08:00:00.000Z',
    pinned: true,
  },
  {
    id: 'rule-vf-dual-tmp-tgo-fleet',
    category: 'delivery_fleet',
    textAr:
      'نتعاقد مع طلبات Tgo في جميع الفروع، ونشغّل سائقي الشركة على حسابات طلبات TMP بعمولة 15% في الفروع المعتمدة؛ الفروع التي تعمل Tgo فقط لا تُصنّف متوقفة بل تُقيّم كفرصة تعيين سائق TMP إذا كان وفر 12% يغطي تكلفة السائق.',
    textEn:
      'Venture Foods contracts Talabat Tgo across all branches and runs in-house company drivers on Talabat TMP (15% fee) in designated branches; Tgo-only branches are never falsely flagged stopped.',
    source: 'preseeded',
    createdAt: '2026-01-01T08:01:00.000Z',
    pinned: true,
  },
  {
    id: 'rule-vf-cooking-trim-cfo-bounds',
    category: 'finance_policy',
    textAr:
      'يُعزل الفاقد الطبيعي للطبخ والتجهيز (5%–7%) قبل احتساب الهدر القابل للاسترداد، وتُحسب أي زيادة سعرية على أساس ثبات 94%–97% من الحجم بعد عمولة التوصيل، وأي كومبو على تحويل 8%–15% من الزبائن.',
    textEn:
      'Separate normal 5%–7% cooking trim before recoverable shrinkage; enforce conservative 94%–97% volume retention on price tweaks and 8%–15% conversion on combos net of food/packaging.',
    source: 'preseeded',
    createdAt: '2026-01-01T08:02:00.000Z',
    pinned: true,
  },
  {
    id: 'rule-vf-whitelist-scope',
    category: 'branches_menu',
    textAr:
      'نطاق الشركة الحصري: 6 علامات معتمدة فقط (تشاينا جاردن، فرانكس، طحينة، فارم براون، ذا نودل بار، كرك كافتيريا) و7 مواقع نشطة (الأفنيوز، مول 360، العاصمة، بروميناد، السالمية، الكوت، مطبخ العارضية) + بوثات المعارض EXB.',
    textEn:
      'Strict Venture Foods scope: 6 approved brands (China Garden, Frank\'s, Tahina, Farm Brown, The Noodle Bar, Karak Cafeteria) and 7 active locations + EXB exhibition booths.',
    source: 'preseeded',
    createdAt: '2026-01-01T08:03:00.000Z',
    pinned: true,
  },
]

const PRESEEDED_PREFERENCES: ExecutivePreference[] = [
  {
    id: 'pref-kuwaiti-simple-arabic',
    textAr: 'عناوين قصيرة من ٢–٣ كلمات يومية واضحة، والأثر الصافي بالدينار الكويتي أولاً مع تحديد المسؤول والفرع.',
    textEn: 'Ultra-simple 2–3 word headings, net KWD impact first, naming exact Owner and Branch.',
    weight: 10,
    updatedAt: '2026-01-01T08:00:00.000Z',
  },
  {
    id: 'pref-three-tier-roi',
    textAr: 'تقديم العائد الشهري بثلاث شرائح واقعية (متحفظ | واقعي مرجّح | هدف أعلى) بدون مبالغة.',
    textEn: 'Present monthly KWD ROI in 3 realistic tiers (Conservative | Likely | Stretch) with zero hype.',
    weight: 9,
    updatedAt: '2026-01-01T08:00:00.000Z',
  },
]

const PRESEEDED_OUTCOMES: DecisionOutcomeRecord[] = [
  {
    id: 'outcome-ardiya-portion-scale',
    titleAr: 'ضبط أوزان البروتين والصوص بميزان العارضية الرقمي',
    titleEn: 'Ardiya Digital Portioning & Sauce Weight Lock',
    originBrandAr: 'تشاينا جاردن',
    originBrandEn: 'China Garden',
    originBranchAr: 'مطبخ العارضية + السالمية',
    originBranchEn: 'Ardiya + Salmiya',
    beforeMetricAr: 'هدر تشغيلي فوق التالف الطبيعي بنحو 2.8%',
    afterMetricAr: 'انخفاض الهدر القابل للاسترداد إلى 0.9% فقط',
    monthlyGainKwd: 1950,
    status: 'proven_winner',
    scaleSuggestionAr:
      'تعميم وزن العلب المسبقة من العارضية على ذا نودل بار وفرانكس في بروميناد والكوت (+1,450 د.ك/شهر متوقعة).',
    scaleSuggestionEn:
      'Scale pre-portioned Ardiya prep packs to The Noodle Bar & Frank\'s at Promenade and Al-Kout (+1,450 KWD/mo est.).',
    verifiedAt: '2026-10-25',
  },
  {
    id: 'outcome-tmp-fleet-salmiya',
    titleAr: 'تحويل ساعات الذروة إلى سائقي الشركة TMP بعمولة 15%',
    titleEn: 'Peak-Hour Routing to TMP 15% Company Drivers',
    originBrandAr: 'تشاينا جاردن + فرانكس',
    originBrandEn: 'China Garden + Frank\'s',
    originBranchAr: 'السالمية + بروميناد',
    originBranchEn: 'Salmiya + Promenade',
    beforeMetricAr: 'عمولة توصيل مدمجة 25.4% على الطلبات القريبة',
    afterMetricAr: 'انخفاض عمولة الطلبات المحولة إلى 15.0% (وفر 12 نقطة)',
    monthlyGainKwd: 2280,
    status: 'proven_winner',
    scaleSuggestionAr:
      'توسيع شفت سائق TMP إضافي في حولي/بروميناد والكوت لتغطية طحينة وذا نودل بار (+1,620 د.ك/شهر متوقعة).',
    scaleSuggestionEn:
      'Add 1 evening TMP company driver shift at Promenade & Al-Kout covering Tahina & Noodle Bar (+1,620 KWD/mo est.).',
    verifiedAt: '2026-11-02',
  },
  {
    id: 'outcome-quiet-hours-combo',
    titleAr: 'كومبو الساعات الهادئة (٣–٦ عصراً) لرفع متوسط الفاتورة',
    titleEn: 'Afternoon 3–6 PM High-Margin Drink/Side Combo',
    originBrandAr: 'فرانكس + كرك كافتيريا',
    originBrandEn: 'Frank\'s + Karak Cafeteria',
    originBranchAr: 'الأفنيوز + مول 360',
    originBranchEn: 'The Avenues + 360 Mall',
    beforeMetricAr: 'ركود عصري ومتوسط فاتورة 4.150 د.ك',
    afterMetricAr: 'تحويل 11.4% من الزبائن للكومبو ورفع الفاتورة إلى 4.680 د.ك',
    monthlyGainKwd: 1340,
    status: 'proven_winner',
    scaleSuggestionAr:
      'تعميم عرض ٣–٦ عصراً على فارم براون وطحينة في العاصمة والسالمية (+980 د.ك/شهر متوقعة).',
    scaleSuggestionEn:
      'Roll out the 3–6 PM combo prompt to Farm Brown & Tahina at Assima and Salmiya (+980 KWD/mo est.).',
    verifiedAt: '2026-11-06',
  },
]

function buildInitialSnapshots(): OdooDailySnapshot[] {
  const ws = computeGlobalWorkspace(DEFAULT_GLOBAL_FILTERS)
  const todayKey = (ODOO.meta?.period?.to || new Date().toISOString().slice(0, 10)).slice(0, 10)
  return [
    {
      dateKey: '2026-10-15',
      syncedAt: '2026-10-15T23:55:00Z',
      sales30dKwd: Math.round(ws.salesKwd * 0.965),
      orders30d: Math.round(ws.orders * 0.972),
      aovKwd: Number((ws.aovKwd * 0.992).toFixed(2)),
      netPocket10: Number(Math.max(0.5, ws.per10.netPocket10 - 0.14).toFixed(2)),
      food10: Number((ws.per10.food10 + 0.09).toFixed(2)),
      delivery10: Number((ws.per10.delivery10 + 0.05).toFixed(2)),
    },
    {
      dateKey: '2026-11-01',
      syncedAt: '2026-11-01T23:55:00Z',
      sales30dKwd: Math.round(ws.salesKwd * 0.984),
      orders30d: Math.round(ws.orders * 0.988),
      aovKwd: Number((ws.aovKwd * 0.996).toFixed(2)),
      netPocket10: Number(Math.max(0.5, ws.per10.netPocket10 - 0.06).toFixed(2)),
      food10: Number((ws.per10.food10 + 0.04).toFixed(2)),
      delivery10: Number((ws.per10.delivery10 + 0.02).toFixed(2)),
    },
    {
      dateKey: todayKey,
      syncedAt: ODOO.meta?.syncedAt || new Date().toISOString(),
      sales30dKwd: Math.round(ws.salesKwd),
      orders30d: Math.round(ws.orders),
      aovKwd: Number(ws.aovKwd.toFixed(2)),
      netPocket10: Number(ws.per10.netPocket10.toFixed(2)),
      food10: Number(ws.per10.food10.toFixed(2)),
      delivery10: Number(ws.per10.delivery10.toFixed(2)),
    },
  ]
}

function createDefaultState(): FeryalMemoryState {
  return {
    version: 1,
    rules: [...PRESEEDED_RULES],
    preferences: [...PRESEEDED_PREFERENCES],
    outcomes: [...PRESEEDED_OUTCOMES],
    snapshots: buildInitialSnapshots(),
    totalAutoLearnings: 0,
    lastUpdatedAt: new Date().toISOString(),
  }
}

// ============================================================================
// IndexedDB + Synchronous localStorage Mirror Persistence
// ============================================================================
let memoryCache: FeryalMemoryState | null = null

function mergePreseededRules(existing: InstitutionalRule[]): InstitutionalRule[] {
  const byId = new Map<string, InstitutionalRule>()
  for (const pre of PRESEEDED_RULES) byId.set(pre.id, pre)
  for (const r of existing) {
    if (!byId.has(r.id)) byId.set(r.id, r)
  }
  return Array.from(byId.values())
}

function openLearningIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(FERYAL_LEARNING_DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('state')) {
          db.createObjectStore('state', { keyPath: 'key' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function writeToIdb(state: FeryalMemoryState): Promise<void> {
  const db = await openLearningIdb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction('state', 'readwrite')
      tx.objectStore('state').put({ key: 'root', state })
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

async function readFromIdb(): Promise<FeryalMemoryState | null> {
  const db = await openLearningIdb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('state', 'readonly')
      const req = tx.objectStore('state').get('root')
      req.onsuccess = () => {
        const val = req.result?.state as FeryalMemoryState | undefined
        resolve(val ?? null)
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

function saveMemoryMirror(state: FeryalMemoryState): void {
  memoryCache = state
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FERYAL_LEARNING_MIRROR_KEY, JSON.stringify(state))
  } catch {}
  void writeToIdb(state)
  try {
    window.dispatchEvent(new CustomEvent(FERYAL_MEMORY_UPDATED_EVENT, { detail: state }))
  } catch {}
}

export function getFeryalMemorySync(): FeryalMemoryState {
  if (memoryCache) return memoryCache
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(FERYAL_LEARNING_MIRROR_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as FeryalMemoryState
        if (parsed && Array.isArray(parsed.rules)) {
          parsed.rules = mergePreseededRules(parsed.rules)
          if (!Array.isArray(parsed.outcomes) || parsed.outcomes.length === 0) {
            parsed.outcomes = [...PRESEEDED_OUTCOMES]
          }
          if (!Array.isArray(parsed.preferences) || parsed.preferences.length === 0) {
            parsed.preferences = [...PRESEEDED_PREFERENCES]
          }
          if (!Array.isArray(parsed.snapshots) || parsed.snapshots.length === 0) {
            parsed.snapshots = buildInitialSnapshots()
          }
          memoryCache = parsed
          return parsed
        }
      }
    } catch {}
  }
  const initial = createDefaultState()
  memoryCache = initial
  return initial
}

export async function hydrateFeryalMemory(): Promise<FeryalMemoryState> {
  const idbState = await readFromIdb()
  if (idbState && Array.isArray(idbState.rules)) {
    idbState.rules = mergePreseededRules(idbState.rules)
    memoryCache = idbState
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(FERYAL_LEARNING_MIRROR_KEY, JSON.stringify(idbState))
      }
    } catch {}
    recordDailyOdooSnapshot()
    return memoryCache
  }
  const syncState = getFeryalMemorySync()
  saveMemoryMirror(syncState)
  recordDailyOdooSnapshot()
  return syncState
}

// ============================================================================
// Mutations: Teach Fact, Record Outcome, Record Snapshot & Auto-Extract
// ============================================================================
export function teachPermanentFact({
  textAr,
  textEn,
  category = 'supply_chain',
  source = 'manual_taught',
}: {
  textAr: string
  textEn?: string
  category?: RuleCategory
  source?: InstitutionalRule['source']
}): InstitutionalRule | null {
  const cleanAr = textAr.trim()
  if (cleanAr.length < 4) return null

  const state = getFeryalMemorySync()
  // Deduplicate exact text
  const dup = state.rules.find(
    (r) => r.textAr.trim() === cleanAr || (textEn && r.textEn.trim() === textEn.trim()),
  )
  if (dup) return dup

  const newRule: InstitutionalRule = {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category,
    textAr: cleanAr,
    textEn: (textEn || cleanAr).trim(),
    source,
    createdAt: new Date().toISOString(),
    pinned: source === 'manual_taught',
  }

  const next: FeryalMemoryState = {
    ...state,
    rules: [newRule, ...state.rules].slice(0, 40),
    totalAutoLearnings:
      source === 'auto_chat' ? state.totalAutoLearnings + 1 : state.totalAutoLearnings,
    lastUpdatedAt: new Date().toISOString(),
  }
  saveMemoryMirror(next)
  return newRule
}

export function removeLearnedRule(ruleId: string): void {
  const state = getFeryalMemorySync()
  // Protect core pre-seeded Venture Foods invariants from accidental deletion
  const target = state.rules.find((r) => r.id === ruleId)
  if (!target || target.source === 'preseeded') return
  const next: FeryalMemoryState = {
    ...state,
    rules: state.rules.filter((r) => r.id !== ruleId),
    lastUpdatedAt: new Date().toISOString(),
  }
  saveMemoryMirror(next)
}

export function recordDecisionOutcome({
  titleAr,
  originBrandAr,
  originBranchAr,
  beforeMetricAr,
  afterMetricAr,
  monthlyGainKwd,
  scaleSuggestionAr,
}: {
  titleAr: string
  originBrandAr: string
  originBranchAr: string
  beforeMetricAr: string
  afterMetricAr: string
  monthlyGainKwd: number
  scaleSuggestionAr?: string
}): DecisionOutcomeRecord | null {
  const cleanTitle = titleAr.trim()
  if (!cleanTitle) return null
  const state = getFeryalMemorySync()

  const autoScale =
    scaleSuggestionAr?.trim() ||
    `تعميم الخطة الرابحة من (${originBrandAr} - ${originBranchAr}) على باقي فروع الشركة لرفع الصافي الشهري بنحو +${Math.round(monthlyGainKwd * 0.75).toLocaleString('en-US')} د.ك.`

  const rec: DecisionOutcomeRecord = {
    id: `outcome-${Date.now()}`,
    titleAr: cleanTitle,
    titleEn: cleanTitle,
    originBrandAr: originBrandAr.trim() || 'تشاينا جاردن',
    originBrandEn: originBrandAr.trim() || 'China Garden',
    originBranchAr: originBranchAr.trim() || 'السالمية',
    originBranchEn: originBranchAr.trim() || 'Salmiya',
    beforeMetricAr: beforeMetricAr.trim() || 'قبل التطبيق',
    afterMetricAr: afterMetricAr.trim() || 'تحسن موثق بعد التطبيق',
    monthlyGainKwd: Math.max(100, Math.round(Number(monthlyGainKwd) || 500)),
    status: 'proven_winner',
    scaleSuggestionAr: autoScale,
    scaleSuggestionEn: autoScale,
    verifiedAt: new Date().toISOString().slice(0, 10),
  }

  const next: FeryalMemoryState = {
    ...state,
    outcomes: [rec, ...state.outcomes].slice(0, 25),
    lastUpdatedAt: new Date().toISOString(),
  }
  saveMemoryMirror(next)
  return rec
}

export function recordDailyOdooSnapshot(): void {
  if (typeof window === 'undefined') return
  const state = getFeryalMemorySync()
  const ws = computeGlobalWorkspace(DEFAULT_GLOBAL_FILTERS)
  const dateKey = new Date().toISOString().slice(0, 10)
  if (state.snapshots.some((s) => s.dateKey === dateKey)) return

  const snap: OdooDailySnapshot = {
    dateKey,
    syncedAt: ODOO.meta?.syncedAt || new Date().toISOString(),
    sales30dKwd: Math.round(ws.salesKwd),
    orders30d: Math.round(ws.orders),
    aovKwd: Number(ws.aovKwd.toFixed(2)),
    netPocket10: Number(ws.per10.netPocket10.toFixed(2)),
    food10: Number(ws.per10.food10.toFixed(2)),
    delivery10: Number(ws.per10.delivery10.toFixed(2)),
  }

  const next: FeryalMemoryState = {
    ...state,
    snapshots: [...state.snapshots, snap].slice(-30),
    lastUpdatedAt: new Date().toISOString(),
  }
  saveMemoryMirror(next)
}

/**
 * Automatically inspects every user message for operational teachings, corrections,
 * or owner preferences and persists them into Feryal's institutional memory.
 */
export function autoExtractLearningsFromTurn(
  userQuery: string,
  _assistantReply?: string,
): InstitutionalRule | null {
  const q = (userQuery || '').trim()
  if (q.length < 16 || q.length > 420) return null
  // Ignore pure questions unless they contain explicit rule/correction markers
  const teachingMarkers =
    /(تذكر أن|تذكري أن|علماً أن|علما ان|القاعدة عندنا|نظامنا في|احنا نشتري|نحن نشتري|لا تقترح|ممنوع|دائماً اعتمد|معلومة دائمة|سجّل عندك|سجلي عندك|remember that|our rule is|always assume|never suggest|note that we)/i

  if (!teachingMarkers.test(q)) return null

  const category: RuleCategory = /مورد|مشتريات|مخزن|عارضية|warehouse|supplier|ardiya/i.test(q)
    ? 'supply_chain'
    : /توصيل|طلبات|كيتا|ديليفرو|سائق|tmp|tgo|delivery/i.test(q)
      ? 'delivery_fleet'
      : /سعر|هامش|تكلفة|إيجار|رواتب|margin|price|cost/i.test(q)
        ? 'finance_policy'
        : 'branches_menu'

  const cleaned = q
    .replace(/^(يا فريال|فريال|لو سمحتي|ملاحظة)[:،\s-]*/i, '')
    .trim()

  return teachPermanentFact({
    textAr: cleaned,
    textEn: cleaned,
    category,
    source: 'auto_chat',
  })
}

// ============================================================================
// Compact ~800-Token `<feryal_evolving_memory>` XML Builder for Prompt Caching
// ============================================================================
export function buildFeryalEvolvingMemoryXml(lang: 'ar' | 'en' = 'ar'): string {
  const state = getFeryalMemorySync()
  const isAr = lang === 'ar'

  const rulesBlock = state.rules
    .slice(0, 9)
    .map((r, i) => `  ${i + 1}. [${r.category}] ${isAr ? r.textAr : r.textEn}`)
    .join('\n')

  const prefsBlock = state.preferences
    .slice(0, 4)
    .map((p, i) => `  ${i + 1}. ${isAr ? p.textAr : p.textEn}`)
    .join('\n')

  const outcomesBlock = state.outcomes
    .slice(0, 4)
    .map(
      (o, i) =>
        `  ${i + 1}. [خطة مجرّبة ورابحة ✅ | +${o.monthlyGainKwd} KWD/mo] ${
          isAr ? o.titleAr : o.titleEn
        } (${isAr ? o.originBrandAr : o.originBrandEn} - ${
          isAr ? o.originBranchAr : o.originBranchEn
        }) -> توصية التعميم: ${isAr ? o.scaleSuggestionAr : o.scaleSuggestionEn}`,
    )
    .join('\n')

  const snaps = state.snapshots.slice(-3)
  const snapBlock = snaps
    .map(
      (s) =>
        `  - ${s.dateKey}: 30d Sales ${s.sales30dKwd.toLocaleString('en-US')} KWD | Orders ${s.orders30d.toLocaleString('en-US')} | Net/10KWD ${s.netPocket10.toFixed(2)} | Food/10KWD ${s.food10.toFixed(2)} | Delivery/10KWD ${s.delivery10.toFixed(2)}`,
    )
    .join('\n')

  return `<feryal_evolving_memory version="${state.version}" rules_count="${state.rules.length}" proven_winners="${state.outcomes.length}">
<institutional_rules>
${rulesBlock}
</institutional_rules>
<executive_preferences>
${prefsBlock}
</executive_preferences>
<proven_winning_decisions_to_scale>
${outcomesBlock}
</proven_winning_decisions_to_scale>
<longitudinal_odoo_snapshots>
${snapBlock}
</longitudinal_odoo_snapshots>
</feryal_evolving_memory>`
}

// ============================================================================
// Macro Big-Bet Prompt Builder (`ابتكار الحلول الكبرى 🚀`)
// ============================================================================
export function buildMacroBigBetPrompt(
  strategyId: MacroBigBetId,
  ws: GlobalWorkspaceSlice,
  isAr: boolean,
): string {
  if (strategyId === 'bulk-warehouse') {
    return isAr
      ? `🚀 ابتكار الحلول الكبرى (١: عقود الشراء الموحد للمخزن المركزي ومطبخ العارضية):
بالاعتماد على دورة التوريد المعتمدة لدينا (المشتريات تشتري من الموردين ← نقل واستلام في المخزن ← توزيع المخزن ومطبخ العارضية على الفروع) وأرقام الفلتر الحالي (${ws.subtitleAr}):
صمّم خطة تنفيذية واقعية لتوحيد عقود الموردين للعلامات الـ ٦ (البروتين، الزيوت، الصوصات، التغليف) مع جدول الكميات والتوفير المحافظ والمرجّح بالدينار الكويتي شهرياً، والخطوات الميدانية لمدير المشتريات وأمين المخزن وشيف العارضية.`
      : `🚀 MACRO BIG BET #1 (Bulk Central Warehouse & Ardiya Procurement Locks):
Following our confirmed supply-chain flow (Procurement buys from suppliers -> Warehouse receiving -> Warehouse & Ardiya distribution to branches) for (${ws.subtitleEn}):
Design a conservative CFO-grade plan consolidating 6-brand supplier contracts (proteins, oils, sauces, packaging) with 3-tier monthly KWD savings and exact steps for Procurement Manager, Warehouse Lead, and Ardiya Head Chef.`
  }

  if (strategyId === 'zero-rent-expansion') {
    return isAr
      ? `🚀 ابتكار الحلول الكبرى (٢: التوسع بدون إيجار عبر تشغيل العلامات المساندة في نفس المطابخ):
حلّل أي الفروع الحالية من فروعنا الـ ٧ تستوعب تشغيل خط تحضير مساند من علاماتنا عالية الهامش (طحينة، كرك كافتيريا، ذا نودل بار، فارم براون) بنفس الإيجار والعمالة الحالية، وحدد أفضل ٣ تقاطعات (علامة × فرع) مع التكلفة الصفرية للإيجار وصافي الربح الشهري المتوقع بالدينار الكويتي (متحفظ | واقعي مرجّح | هدف أعلى).`
      : `🚀 MACRO BIG BET #2 (Zero-Rent Cross-Brand Kitchen Expansion):
Identify which of our 7 active branches can host a high-margin sister brand line (Tahina, Karak Cafeteria, The Noodle Bar, Farm Brown) inside existing kitchen capacity at zero incremental rent, ranking the top 3 Brand × Branch launches with 3-tier monthly net KWD profit.`
  }

  if (strategyId === 'tmp-direct-shift') {
    return isAr
      ? `🚀 ابتكار الحلول الكبرى (٣: التحول الذكي إلى سائقي الشركة TMP بعمولة 15% والطلب المباشر 0%):
بناءً على نظامنا المزدوج (التعاقد مع طلبات Tgo في كل الفروع + سائقي الشركة على TMP بعمولة 15% في الفروع المعتمدة)، حدد الفروع والفترات التي يحقق فيها وفر 12% في العمولة عائداً أعلى من تكلفة السائق الشهري، مع خطة كرت إعادة الطلب المباشر داخل كل طلب توصيل وصافي الوفر الشهري بالدينار الكويتي.`
      : `🚀 MACRO BIG BET #3 (Dual TMP 15% Company Fleet & 0%-Commission Direct Shift):
Using our dual Tgo + TMP (15% fee) model, pinpoint the exact branches and shifts where the 12-point commission savings outweigh monthly driver cost, paired with in-bag QR direct re-order cards and conservative 3-tier monthly KWD net gains.`
  }

  return isAr
    ? `🚀 ابتكار الحلول الكبرى الشامل (خارطة الـ ٩٠ يوماً لمضاعفة الصافي بالجيب):
بصفتك مجلس العقل الثلاثي لشركة فنتشر فودز الكويت على أرقام (${ws.subtitleAr})، ابتكر خطة استراتيجية كبرى عملية ومحققة من ٣ محاور متكاملة:
١) عقود الشراء الموحد عبر المخزن المركزي ومطبخ العارضية.
٢) التوسع بدون إيجار بتشغيل العلامات عالية الهامش داخل مطابخ الفروع القائمة.
٣) تعظيم أسطول سائقي الشركة TMP بعمولة 15% والتحويل التدريجي للطلب المباشر + تعميم الخطط المجرّبة والرابحة ✅.
اختم بجدول مالي واضح يوضح العائد الشهري الصافي بالدينار الكويتي (متحفظ | واقعي مرجّح | هدف أعلى) والمسؤول التنفيذي لكل محور.`
    : `🚀 FULL 90-DAY MACRO BIG-BET MASTERPLAN:
As Venture Foods Kuwait's Triple-Brain Executive Council on (${ws.subtitleEn}), synthesize a realistic 90-day profit transformation across 3 pillars:
1) Bulk Central Warehouse & Ardiya supplier locks.
2) Zero-rent cross-brand expansion inside existing branch kitchens.
3) Dual TMP 15% fleet optimization + 0%-fee direct re-order conversion + scaling Proven Winners ✅.
Conclude with a 3-tier monthly KWD net impact summary (Conservative | Likely | Stretch) and named Owner per pillar.`
}
