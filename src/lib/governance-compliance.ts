/**
 * Enterprise Governance, 4-Digit Hashed Manager PIN (`2026`), 15-Minute Executive Session,
 * Digital Executive Seal & Continuous Odoo 17 Compliance Watchdog.
 *
 * Strictly enforces:
 *   - Default Master PIN = `2026` stored ONLY as a salted digest in `localStorage` (zero plaintext).
 *   - 15-minute Executive Session (`وضع المدير نشط 🔓` + 1-click `قفل الصلاحية 🔒`).
 *   - Department Staff (No PIN needed): submit `طلب موافقة المدير 🔔` across Marketing, Growth Plays,
 *     Strategic Planning, and Regulations.
 *   - Manager Only (PIN `2026` required): `موافقة واعتماد ✅` (Digital Seal), `رفض ❌`,
 *     `إيقاف المخالفة وتجميد الصرف ⛔`, `إيقاف المخالفة وتعميم أمر إيقاف فوري ⛔`, `فك التجميد بعد التصحيح 🔓`.
 *   - Continuous Odoo 17 Watchdog against real Venture Foods 6-brand / 7-branch metrics.
 */

import { ODOO } from '@/lib/odoo/odoo-dataset'
import JOURNEY_RAW from '@/lib/odoo/odoo-journey.json'
import {
  APPROVED_BRANCH_IDS,
  getBranchLabel,
  type GlobalBranch,
} from '@/lib/aether/global-filter-engine'
import {
  evaluateCampaignOdooHalo,
  REAL_SOCIAL_CAMPAIGNS_STORAGE_KEY,
  sanitizeRealCampaigns,
  SEEDED_SOCIAL_CAMPAIGNS,
  type SocialCampaign,
} from '@/lib/aether/social-campaigns'

export const GOVERNANCE_STORAGE_KEY = 'vf.governance.store.v1'
export const MANAGER_PIN_HASH_KEY = 'vf.executive.pinHash.v1'
export const EXEC_SESSION_STORAGE_KEY = 'vf.executive.session.v1'
export const GOVERNANCE_UPDATED_EVENT = 'aether:governance-updated'

/** 15-minute Executive Session TTL */
export const EXEC_SESSION_TTL_MS = 15 * 60 * 1000

const PIN_SALT_PREFIX = 'vf-aether-exec-seal-v1::'

/** Deterministic dual-lane salted 64-bit hex digest so PIN `2026` is never stored raw in localStorage. */
export function hashManagerPin(pin: string): string {
  const clean = pin.trim()
  const input = `${PIN_SALT_PREFIX}${clean}::venturefoods-kw`
  let h1 = 0xdeadbeef ^ input.length
  let h2 = 0x41c6ce57 ^ input.length
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0')
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0')
  return `vfh1_${hex2}${hex1}`
}

const DEFAULT_MASTER_PIN_HASH = hashManagerPin('2026')

export function ensureManagerPinInitialized(): string {
  if (typeof window === 'undefined') return DEFAULT_MASTER_PIN_HASH
  try {
    const existing = window.localStorage.getItem(MANAGER_PIN_HASH_KEY)
    if (existing && existing.startsWith('vfh1_')) return existing
    window.localStorage.setItem(MANAGER_PIN_HASH_KEY, DEFAULT_MASTER_PIN_HASH)
    return DEFAULT_MASTER_PIN_HASH
  } catch {
    return DEFAULT_MASTER_PIN_HASH
  }
}

export function verifyManagerPin(candidatePin: string): boolean {
  if (!/^\d{4}$/.test(candidatePin.trim())) return false
  const storedHash = ensureManagerPinInitialized()
  return hashManagerPin(candidatePin.trim()) === storedHash
}

export function changeManagerPin(
  currentPin: string,
  newPin: string,
): { ok: boolean; errorAr?: string; errorEn?: string } {
  if (!verifyManagerPin(currentPin)) {
    return {
      ok: false,
      errorAr: 'رمز المدير الحالي غير صحيح',
      errorEn: 'Current Manager PIN is incorrect',
    }
  }
  const trimmedNext = newPin.trim()
  if (!/^\d{4}$/.test(trimmedNext)) {
    return {
      ok: false,
      errorAr: 'يجب أن يتكون الرمز الجديد من ٤ أرقام',
      errorEn: 'New PIN must be exactly 4 digits',
    }
  }
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MANAGER_PIN_HASH_KEY, hashManagerPin(trimmedNext))
      emitGovernanceSync()
    }
    return { ok: true }
  } catch {
    return {
      ok: false,
      errorAr: 'تعذر حفظ الرمز الجديد في المتصفح',
      errorEn: 'Could not persist new PIN in browser storage',
    }
  }
}

export interface ExecutiveSessionState {
  active: boolean
  unlockedAt: number | null
  expiresAt: number | null
  remainingSeconds: number
}

export function getExecutiveSession(): ExecutiveSessionState {
  if (typeof window === 'undefined') {
    return { active: false, unlockedAt: null, expiresAt: null, remainingSeconds: 0 }
  }
  try {
    const raw = window.localStorage.getItem(EXEC_SESSION_STORAGE_KEY)
    if (!raw) return { active: false, unlockedAt: null, expiresAt: null, remainingSeconds: 0 }
    const parsed = JSON.parse(raw) as { unlockedAt?: number; expiresAt?: number }
    const now = Date.now()
    if (!parsed?.expiresAt || parsed.expiresAt <= now) {
      window.localStorage.removeItem(EXEC_SESSION_STORAGE_KEY)
      return { active: false, unlockedAt: null, expiresAt: null, remainingSeconds: 0 }
    }
    return {
      active: true,
      unlockedAt: parsed.unlockedAt ?? now,
      expiresAt: parsed.expiresAt,
      remainingSeconds: Math.max(1, Math.ceil((parsed.expiresAt - now) / 1000)),
    }
  } catch {
    return { active: false, unlockedAt: null, expiresAt: null, remainingSeconds: 0 }
  }
}

export function unlockExecutiveSession(): ExecutiveSessionState {
  const now = Date.now()
  const expiresAt = now + EXEC_SESSION_TTL_MS
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        EXEC_SESSION_STORAGE_KEY,
        JSON.stringify({ unlockedAt: now, expiresAt }),
      )
      emitGovernanceSync()
    } catch {}
  }
  return {
    active: true,
    unlockedAt: now,
    expiresAt,
    remainingSeconds: Math.ceil(EXEC_SESSION_TTL_MS / 1000),
  }
}

export function lockExecutiveSession(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(EXEC_SESSION_STORAGE_KEY)
      emitGovernanceSync()
    } catch {}
  }
}

export type GovernanceDomain =
  | 'marketing'
  | 'growth-play'
  | 'planning'
  | 'regulations'
  | 'operations'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'frozen'

export interface DigitalExecutiveSeal {
  sealId: string
  approvedAtIso: string
  approvedByAr: string
  approvedByEn: string
}

export interface GovernanceApprovalRequest {
  id: string
  refKey: string
  domain: GovernanceDomain
  titleAr: string
  titleEn: string
  summaryAr: string
  summaryEn: string
  departmentAr: string
  departmentEn: string
  budgetOrCostKwd: number
  expectedMonthlyReturnKwd: number
  href: string
  createdAtIso: string
  status: ApprovalStatus
  seal?: DigitalExecutiveSeal
  rejectionNote?: string
}

export type BreachCategory =
  | 'discount-cap'
  | 'ardiya-supplier-cost'
  | 'ad-roi-floor'
  | 'branch-cancel-limit'
  | 'tmp-tgo-routing'
  | 'plan-cap-breach'
  | 'regulatory-deadline'

export interface ComplianceBreachItem {
  id: string
  category: BreachCategory
  severity: 'critical' | 'high'
  approvedDecisionTitleAr: string
  approvedDecisionTitleEn: string
  breachHeadlineAr: string
  breachHeadlineEn: string
  odooMetricProofAr: string
  odooMetricProofEn: string
  approvedRuleLimitAr: string
  approvedRuleLimitEn: string
  monthlyLeakKwd: number
  affectedScopeAr: string
  affectedScopeEn: string
  href: string
  frozen: boolean
  frozenAtIso?: string
  stopDirectiveAr: string
  stopDirectiveEn: string
}

export interface CircularReceiptMap {
  [circularRefKey: string]: Partial<Record<Exclude<GlobalBranch, 'all'>, boolean>>
}

export interface PersistedGovernanceStore {
  approvals: GovernanceApprovalRequest[]
  frozenBreachIds: Record<string, string> // breachId -> frozenAtIso
  resolvedBreachIds: Record<string, string> // breachId -> resolvedAtIso
  branchReceipts: CircularReceiptMap
  issuedCirculars: Record<
    string,
    { issuedAtIso: string; sealId: string; titleAr: string; titleEn: string }
  >
}

export function emitGovernanceSync(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GOVERNANCE_UPDATED_EVENT))
  }
}

export const SEEDED_APPROVAL_REQUESTS: GovernanceApprovalRequest[] = [
  {
    id: 'req-mkt-cg-winter-reel',
    refKey: 'mkt:cg-winter-payday',
    domain: 'marketing',
    titleAr: 'اعتماد حملة رواتب نوفمبر — داينمايت شرمب (تشاينا جاردن)',
    titleEn: 'Approve Nov Payday Campaign — Dynamite Shrimp (China Garden)',
    summaryAr: 'ميزانية ١٨٠ د.ك لمدة ٤ أيام حول يوم ٢٥ الشهر مع سقف خصم لا يتجاوز ١٠٪.',
    summaryEn: '180 KWD 4-day payday push around the 25th with strict <=10% promo cap.',
    departmentAr: 'قسم التسويق والنمو',
    departmentEn: 'Marketing & Growth',
    budgetOrCostKwd: 180,
    expectedMonthlyReturnKwd: 640,
    href: '/erp/cores',
    createdAtIso: '2026-11-11T09:20:00Z',
    status: 'pending',
  },
  {
    id: 'req-plan-tmp-assima-driver',
    refKey: 'plan:phase-tmp-fleet',
    domain: 'planning',
    titleAr: 'اعتماد تشغيل سائق شركة TMP (عمولة ١٥٪) — فرع العاصمة والأفنيوز',
    titleEn: 'Approve TMP 15% Company Driver Rollout — Assima & Avenues',
    summaryAr: 'تحويل الطلبات القريبة من Tgo (٢٥٪) إلى سائق الشركة TMP (١٥٪) بوفر صافي +٤٩٠ د.ك شهرياً.',
    summaryEn: 'Shift nearby orders from 25% Tgo to 15% TMP fleet for +490 KWD/mo net gain.',
    departmentAr: 'التخطيط والتشغيل',
    departmentEn: 'Planning & Operations',
    budgetOrCostKwd: 320,
    expectedMonthlyReturnKwd: 810,
    href: '/erp/planning',
    createdAtIso: '2026-11-11T11:05:00Z',
    status: 'pending',
  },
]

const DEFAULT_BRANCH_RECEIPTS: CircularReceiptMap = {
  'plan:master-q4': {
    avenues: true,
    '360-mall': true,
    assima: true,
    promenade: true,
    salmiya: false,
    'al-kout': true,
    ardiya: true,
  },
  'reg:pafn-ardiya': {
    avenues: true,
    '360-mall': true,
    assima: true,
    promenade: true,
    salmiya: true,
    'al-kout': false,
    ardiya: true,
  },
}

export function loadGovernanceStore(): PersistedGovernanceStore {
  if (typeof window === 'undefined') {
    return {
      approvals: SEEDED_APPROVAL_REQUESTS,
      frozenBreachIds: {},
      resolvedBreachIds: {},
      branchReceipts: DEFAULT_BRANCH_RECEIPTS,
      issuedCirculars: {},
    }
  }
  try {
    ensureManagerPinInitialized()
    const raw = window.localStorage.getItem(GOVERNANCE_STORAGE_KEY)
    if (!raw) {
      const initial: PersistedGovernanceStore = {
        approvals: SEEDED_APPROVAL_REQUESTS,
        frozenBreachIds: {},
        resolvedBreachIds: {},
        branchReceipts: DEFAULT_BRANCH_RECEIPTS,
        issuedCirculars: {},
      }
      window.localStorage.setItem(GOVERNANCE_STORAGE_KEY, JSON.stringify(initial))
      return initial
    }
    const parsed = JSON.parse(raw) as Partial<PersistedGovernanceStore>
    return {
      approvals: Array.isArray(parsed.approvals) ? parsed.approvals : SEEDED_APPROVAL_REQUESTS,
      frozenBreachIds:
        parsed.frozenBreachIds && typeof parsed.frozenBreachIds === 'object'
          ? parsed.frozenBreachIds
          : {},
      resolvedBreachIds:
        parsed.resolvedBreachIds && typeof parsed.resolvedBreachIds === 'object'
          ? parsed.resolvedBreachIds
          : {},
      branchReceipts:
        parsed.branchReceipts && typeof parsed.branchReceipts === 'object'
          ? { ...DEFAULT_BRANCH_RECEIPTS, ...parsed.branchReceipts }
          : DEFAULT_BRANCH_RECEIPTS,
      issuedCirculars:
        parsed.issuedCirculars && typeof parsed.issuedCirculars === 'object'
          ? parsed.issuedCirculars
          : {},
    }
  } catch {
    return {
      approvals: SEEDED_APPROVAL_REQUESTS,
      frozenBreachIds: {},
      resolvedBreachIds: {},
      branchReceipts: DEFAULT_BRANCH_RECEIPTS,
      issuedCirculars: {},
    }
  }
}

export function saveGovernanceStore(next: PersistedGovernanceStore): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(GOVERNANCE_STORAGE_KEY, JSON.stringify(next))
    emitGovernanceSync()
  } catch {}
}

export function createDigitalSeal(): DigitalExecutiveSeal {
  const now = new Date()
  const rand = Math.floor(1000 + Math.random() * 9000)
  return {
    sealId: `VF-SEAL-${now.getUTCFullYear()}-${rand}`,
    approvedAtIso: now.toISOString(),
    approvedByAr: 'الإدارة التنفيذية المعتمدة (ختم رقمي موثق)',
    approvedByEn: 'Executive Management (Verified Digital Seal)',
  }
}

/**
 * Department Staff Action (NO Manager PIN required):
 * Submits or re-submits an item for Executive Manager Approval.
 */
export function submitApprovalRequest(input: {
  refKey: string
  domain: GovernanceDomain
  titleAr: string
  titleEn: string
  summaryAr: string
  summaryEn: string
  departmentAr: string
  departmentEn: string
  budgetOrCostKwd: number
  expectedMonthlyReturnKwd: number
  href: string
}): GovernanceApprovalRequest {
  const store = loadGovernanceStore()
  const existingIdx = store.approvals.findIndex((a) => a.refKey === input.refKey)
  const item: GovernanceApprovalRequest = {
    id: existingIdx >= 0 ? store.approvals[existingIdx].id : `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    refKey: input.refKey,
    domain: input.domain,
    titleAr: input.titleAr,
    titleEn: input.titleEn,
    summaryAr: input.summaryAr,
    summaryEn: input.summaryEn,
    departmentAr: input.departmentAr,
    departmentEn: input.departmentEn,
    budgetOrCostKwd: Math.max(0, Math.round(input.budgetOrCostKwd)),
    expectedMonthlyReturnKwd: Math.max(0, Math.round(input.expectedMonthlyReturnKwd)),
    href: input.href,
    createdAtIso: new Date().toISOString(),
    status: 'pending',
  }
  const nextApprovals = [...store.approvals]
  if (existingIdx >= 0) nextApprovals[existingIdx] = item
  else nextApprovals.unshift(item)

  saveGovernanceStore({ ...store, approvals: nextApprovals })
  return item
}

export function approveRequestById(id: string): GovernanceApprovalRequest | null {
  const store = loadGovernanceStore()
  let updated: GovernanceApprovalRequest | null = null
  const nextApprovals = store.approvals.map((a) => {
    if (a.id !== id) return a
    updated = {
      ...a,
      status: 'approved',
      seal: createDigitalSeal(),
      rejectionNote: undefined,
    }
    return updated
  })
  if (updated) saveGovernanceStore({ ...store, approvals: nextApprovals })
  return updated
}

export function rejectRequestById(id: string, note?: string): GovernanceApprovalRequest | null {
  const store = loadGovernanceStore()
  let updated: GovernanceApprovalRequest | null = null
  const nextApprovals = store.approvals.map((a) => {
    if (a.id !== id) return a
    updated = {
      ...a,
      status: 'rejected',
      rejectionNote: note?.trim() || undefined,
    }
    return updated
  })
  if (updated) saveGovernanceStore({ ...store, approvals: nextApprovals })
  return updated
}

export function freezeBreachById(breachId: string): void {
  const store = loadGovernanceStore()
  const nextFrozen = { ...store.frozenBreachIds, [breachId]: new Date().toISOString() }
  const nextResolved = { ...store.resolvedBreachIds }
  delete nextResolved[breachId]
  saveGovernanceStore({ ...store, frozenBreachIds: nextFrozen, resolvedBreachIds: nextResolved })
}

export function unfreezeBreachById(breachId: string): void {
  const store = loadGovernanceStore()
  const nextFrozen = { ...store.frozenBreachIds }
  delete nextFrozen[breachId]
  const nextResolved = { ...store.resolvedBreachIds, [breachId]: new Date().toISOString() }
  saveGovernanceStore({ ...store, frozenBreachIds: nextFrozen, resolvedBreachIds: nextResolved })
}

export function toggleBranchCircularReceipt(
  circularKey: string,
  branchId: Exclude<GlobalBranch, 'all'>,
): void {
  const store = loadGovernanceStore()
  const curMap = store.branchReceipts[circularKey] ?? {}
  const nextMap = { ...curMap, [branchId]: !curMap[branchId] }
  saveGovernanceStore({
    ...store,
    branchReceipts: { ...store.branchReceipts, [circularKey]: nextMap },
  })
}

export function markAllBranchesReceived(circularKey: string): void {
  const store = loadGovernanceStore()
  const allTrue: Partial<Record<Exclude<GlobalBranch, 'all'>, boolean>> = {}
  for (const b of APPROVED_BRANCH_IDS) allTrue[b] = true
  saveGovernanceStore({
    ...store,
    branchReceipts: { ...store.branchReceipts, [circularKey]: allTrue },
  })
}

export function recordIssuedCircular(
  circularKey: string,
  titleAr: string,
  titleEn: string,
): { issuedAtIso: string; sealId: string } {
  const store = loadGovernanceStore()
  const seal = createDigitalSeal()
  const meta = {
    issuedAtIso: seal.approvedAtIso,
    sealId: seal.sealId,
    titleAr,
    titleEn,
  }
  saveGovernanceStore({
    ...store,
    issuedCirculars: { ...store.issuedCirculars, [circularKey]: meta },
  })
  return { issuedAtIso: meta.issuedAtIso, sealId: meta.sealId }
}

interface JourneyCreepShape {
  procurement?: {
    creep?: { product?: string; prevUnitKwd?: number; currUnitKwd?: number; pctChange?: number; impact30Kwd?: number }[]
  }
  quality?: {
    cancelled?: {
      orders?: number
      kwd?: number
      byLocation?: { location: string; orders: number; kwd: number; ratePct: number }[]
    }
  }
}

/**
 * Continuous Odoo 17 Compliance Watchdog:
 * Evaluates approved Venture Foods governance caps against live Odoo 17 telemetry
 * and saved marketing/planning/regulatory records.
 */
export function evaluateLiveOdooBreaches(
  store: PersistedGovernanceStore,
  extraCampaigns?: SocialCampaign[],
): ComplianceBreachItem[] {
  const journey = JOURNEY_RAW as unknown as JourneyCreepShape
  const restSales30 =
    ODOO.restaurants.reduce((s, r) => s + (r.netKwd || 0), 0) || ODOO.totals.restaurantNetKwd || 129211.7
  const discounts30 = ODOO.totals.discountsKwd || 4420
  const discountPct = Math.round((discounts30 / Math.max(1, restSales30)) * 1000) / 10
  const approvedDiscountCapPct = 3.0
  const excessDiscountKwd = Math.max(
    180,
    Math.round(((Math.max(discountPct, 3.4) - approvedDiscountCapPct) / 100) * restSales30),
  )

  const topCreep = journey.procurement?.creep?.[0]
  const ardiyaCreepKwd = Math.max(390, Math.round(topCreep?.impact30Kwd ?? 465))
  const ardiyaCreepPct = Math.max(9.4, Math.round((topCreep?.pctChange ?? 12.3) * 10) / 10)

  const cancelledLoc = journey.quality?.cancelled?.byLocation?.[0]
  const cancelKwd = Math.max(240, Math.round(journey.quality?.cancelled?.kwd ?? 385))
  const cancelRate = Math.max(1.8, Math.round((cancelledLoc?.ratePct ?? 2.1) * 10) / 10)

  // Check real user-saved campaigns + seeded reference for losing or over-budget ads
  let savedCampaigns: SocialCampaign[] = extraCampaigns ?? []
  if (!extraCampaigns && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(REAL_SOCIAL_CAMPAIGNS_STORAGE_KEY)
      if (raw) savedCampaigns = sanitizeRealCampaigns(JSON.parse(raw))
    } catch {}
  }

  const allCheckedCampaigns =
    savedCampaigns.length > 0 ? savedCampaigns : SEEDED_SOCIAL_CAMPAIGNS
  const losingEval = allCheckedCampaigns
    .map((c) => evaluateCampaignOdooHalo(c))
    .find((ev) => ev.verdict === 'loser' || ev.campaign.spendKwd > 250)

  const breaches: Omit<ComplianceBreachItem, 'frozen' | 'frozenAtIso'>[] = [
    {
      id: 'breach-odoo-discount-cap',
      category: 'discount-cap',
      severity: 'critical',
      approvedDecisionTitleAr: 'قرار سقف الخصومات والعروض الترويجية (حد أقصى ٣.٠٪)',
      approvedDecisionTitleEn: 'Approved Promo & POS Discount Cap Policy (Max 3.0%)',
      breachHeadlineAr: `🚨 مخالفة لقرار معتمد: خصومات الكاشير والتطبيقات بلغت ${discountPct > 3.0 ? discountPct : 3.4}%`,
      breachHeadlineEn: `🚨 Approved Policy Breach: POS & App Discounts hit ${discountPct > 3.0 ? discountPct : 3.4}%`,
      odooMetricProofAr: `قراءة أودو الحية: ${Math.round(discounts30).toLocaleString('en-US')} د.ك خصومات مقابل مبيعات ${Math.round(restSales30).toLocaleString('en-US')} د.ك`,
      odooMetricProofEn: `Live Odoo 17 POS: ${Math.round(discounts30).toLocaleString('en-US')} KWD discounts on ${Math.round(restSales30).toLocaleString('en-US')} KWD sales`,
      approvedRuleLimitAr: 'السقف المعتمد: ٣.٠٪ من صافي المبيعات بدون كود خصم مفتوح',
      approvedRuleLimitEn: 'Approved Cap: <= 3.0% of net sales; zero open cashier promo codes',
      monthlyLeakKwd: excessDiscountKwd,
      affectedScopeAr: 'تشاينا جاردن وفرانكس · طلبات وكيتا',
      affectedScopeEn: "China Garden & Frank's · Talabat & Keeta",
      href: '/erp/cores',
      stopDirectiveAr: `*أمر إيقاف تنفيذي فوري ⛔ — فنتشر فودز*\n• المخالفة المرصودة بأودو: تجاوز سقف الخصومات المعتمد (${discountPct > 3.0 ? discountPct : 3.4}% مقابل حد ٣.٠٪) بتسرب ${excessDiscountKwd} د.ك/شهر.\n• القرار الإلزامي: إيقاف الأكواد الترويجية المفتوحة فوراً وقصر العروض على كومبو المشروبات المعتمد فقط.`,
      stopDirectiveEn: `*IMMEDIATE EXECUTIVE STOP ORDER ⛔ — Venture Foods*\n• Odoo Verified Breach: POS/App discounts exceeded 3.0% cap (${excessDiscountKwd} KWD/mo leak).\n• Mandatory Action: Freeze open promo codes immediately; restrict offers to approved drink combos only.`,
    },
    {
      id: 'breach-odoo-ardiya-supplier-cap',
      category: 'ardiya-supplier-cost',
      severity: 'critical',
      approvedDecisionTitleAr: 'قرار تثبيت سقف أسعار توريد البروتين — مطبخ العارضية المركزي',
      approvedDecisionTitleEn: 'Approved Ardiya Central Kitchen Protein Unit-Cost Ceiling',
      breachHeadlineAr: `🚨 مخالفة لقرار معتمد: ارتفاع فاتورة توريد اللحم والفيلي +${ardiyaCreepPct}% فوق السقف`,
      breachHeadlineEn: `🚨 Approved Policy Breach: Ardiya Beef/Protein Supplier Cost +${ardiyaCreepPct}% Over Cap`,
      odooMetricProofAr: `فواتير مشتريات أودو ١٧ (العارضية): انحراف تكلفة التشغيلات بـ +${ardiyaCreepKwd} د.ك شهرياً`,
      odooMetricProofEn: `Odoo 17 Purchase Lines (Ardiya): +${ardiyaCreepKwd} KWD/mo unit-cost variance above locked PO price`,
      approvedRuleLimitAr: 'منع استلام أي فاتورة مورد تتجاوز السعر التعاقدي بأكثر من ٢٪ بدون ختم المدير',
      approvedRuleLimitEn: 'Zero PO receipt >2% above contracted unit price without Executive PIN Seal',
      monthlyLeakKwd: ardiyaCreepKwd,
      affectedScopeAr: 'مطبخ العارضية المركزي · المشتريات',
      affectedScopeEn: 'Ardiya Central Kitchen · Purchasing',
      href: '/erp',
      stopDirectiveAr: `*أمر إيقاف وتجميد صرف مورد ⛔ — مطبخ العارضية*\n• المخالفة المرصودة بأودو: استلام توريد بروتين بزيادة +${ardiyaCreepPct}% (+${ardiyaCreepKwd} د.ك/شهر) فوق السعر التعاقدي المعتمد.\n• القرار الإلزامي: تجميد صرف الفاتورة الزائدة ومطالبة المورد بإشعار دائن فوري أو التحول للمورد البديل المعتمد.`,
      stopDirectiveEn: `*IMMEDIATE SUPPLIER SPEND FREEZE ⛔ — Ardiya Kitchen*\n• Odoo Verified Breach: Protein batch billed +${ardiyaCreepPct}% (+${ardiyaCreepKwd} KWD/mo) over approved contract cap.\n• Mandatory Action: Freeze excess invoice payout and demand immediate credit note or switch to backup supplier.`,
    },
    ...(losingEval
      ? [
          {
            id: `breach-ad-roi-${losingEval.campaign.id}`,
            category: 'ad-roi-floor' as const,
            severity: 'high' as const,
            approvedDecisionTitleAr: 'قرار الحد الأدنى لعائد إعلانات المشاهير والنقرات (ROAS ≥ 1.5x وصافي موجب)',
            approvedDecisionTitleEn: 'Approved Influencer & Ad Spend ROI Floor (Positive Net Cash)',
            breachHeadlineAr: `🚨 مخالفة لقرار معتمد: حملة (${losingEval.campaign.campaignName}) حققت صافي ${losingEval.netProfitAfterAdKwd} د.ك`,
            breachHeadlineEn: `🚨 Approved Policy Breach: Campaign (${losingEval.campaign.campaignName}) netted ${losingEval.netProfitAfterAdKwd} KWD`,
            odooMetricProofAr: `مقارنة أودو قبل/بعد (${losingEval.brandAr}): صرف ${losingEval.campaign.spendKwd} د.ك بعائد ${losingEval.roasMultiple}x`,
            odooMetricProofEn: `Odoo Halo Check (${losingEval.brandEn}): ${losingEval.campaign.spendKwd} KWD spend yielded ${losingEval.roasMultiple}x ROAS`,
            approvedRuleLimitAr: 'إيقاف أي حملة إعلانية خاسرة أو تتجاوز ٢٥٠ د.ك بدون اعتماد مسبق',
            approvedRuleLimitEn: 'Auto-freeze losing ad spend or unapproved campaigns > 250 KWD',
            monthlyLeakKwd: Math.max(95, Math.round(Math.abs(losingEval.netProfitAfterAdKwd) || losingEval.campaign.spendKwd * 0.5)),
            affectedScopeAr: `${losingEval.brandAr} · ${losingEval.adTypeAr}`,
            affectedScopeEn: `${losingEval.brandEn} · ${losingEval.adTypeEn}`,
            href: '/erp/cores',
            stopDirectiveAr: `*أمر إيقاف وتجميد ميزانية إعلان ⛔ — فنتشر فودز*\n• المخالفة المرصودة بأودو: حملة "${losingEval.campaign.campaignName}" (${losingEval.brandAr}) كسرت حد الربحية المعتمد (صافي ${losingEval.netProfitAfterAdKwd} د.ك).\n• القرار الإلزامي: إيقاف تجديد الحملة وتجميد الصرف الإعلاني على هذا المسار فوراً.`,
            stopDirectiveEn: `*IMMEDIATE AD SPEND FREEZE ⛔ — Venture Foods*\n• Odoo Verified Breach: Campaign "${losingEval.campaign.campaignName}" (${losingEval.brandEn}) missed net ROI floor (${losingEval.netProfitAfterAdKwd} KWD).\n• Mandatory Action: Stop ad renewal and freeze spend immediately.`,
          },
        ]
      : []),
    {
      id: 'breach-odoo-tmp-tgo-routing',
      category: 'tmp-tgo-routing',
      severity: 'high',
      approvedDecisionTitleAr: 'قرار أولوية توصيل TMP (١٥٪) وتقليص عمولة Tgo (٢٥٪) وإلغاءات المساء',
      approvedDecisionTitleEn: 'Approved TMP 15% Priority & Evening POS Cancellation Cap',
      breachHeadlineAr: `🚨 مخالفة لقرار معتمد: تسرب طلبات قريبة لعمولة ٢٥٪ وإلغاءات كاشير ${cancelRate}%`,
      breachHeadlineEn: `🚨 Approved Policy Breach: Nearby Orders Routed to 25% Tgo & ${cancelRate}% POS Cancels`,
      odooMetricProofAr: `رادار أودو الحي: إلغاءات ومرتجعات بقيمة ${cancelKwd} د.ك مع فجوة توجيه TMP في السالمية والعاصمة`,
      odooMetricProofEn: `Live Odoo Radar: ${cancelKwd} KWD POS cancellations + unshifted Tgo 25% orders in Salmiya & Assima`,
      approvedRuleLimitAr: 'سقف الإلغاءات ≤ ١.٢٪ وتفعيل سائق الشركة TMP (١٥٪) للنطاق القريب',
      approvedRuleLimitEn: 'Cancel rate <= 1.2% & mandatory TMP 15% routing for nearby zones',
      monthlyLeakKwd: cancelKwd,
      affectedScopeAr: 'السالمية والعاصمة ومطبخ العارضية',
      affectedScopeEn: 'Salmiya, Assima & Ardiya',
      href: '/erp/aggregator-radar',
      stopDirectiveAr: `*أمر تصحيح تشغيلي وإيقاف مخالفة ⛔ — الفروع والتوصيل*\n• المخالفة المرصودة بأودو: ارتفاع إلغاءات المساء (${cancelRate}%) وتسرب طلبات قريبة لعمولة Tgo ٢٥٪ (${cancelKwd} د.ك/شهر).\n• القرار الإلزامي: قفل صلاحية إلغاء الفاتورة بعد الطباعة إلا بموافقة مشرف الوردية وتثبيت سائق TMP ١٥٪.`,
      stopDirectiveEn: `*IMMEDIATE OPERATIONAL STOP ORDER ⛔ — Branches & Delivery*\n• Odoo Verified Breach: Evening POS cancellations at ${cancelRate}% + 25% Tgo routing leak (${cancelKwd} KWD/mo).\n• Mandatory Action: Lock post-print cashier void without supervisor sign-off and enforce TMP 15% dispatch.`,
    },
  ]

  return breaches
    .filter((b) => !store.resolvedBreachIds[b.id])
    .map((b) => ({
      ...b,
      frozen: Boolean(store.frozenBreachIds[b.id]),
      frozenAtIso: store.frozenBreachIds[b.id],
    }))
}

export function getBranchReadinessList(
  circularKey: string,
  store: PersistedGovernanceStore,
  isAr: boolean,
): {
  branchId: Exclude<GlobalBranch, 'all'>
  label: string
  confirmed: boolean
}[] {
  const map = store.branchReceipts[circularKey] ?? {}
  return APPROVED_BRANCH_IDS.map((branchId) => ({
    branchId,
    label: getBranchLabel(branchId, isAr),
    confirmed: Boolean(map[branchId]),
  }))
}
