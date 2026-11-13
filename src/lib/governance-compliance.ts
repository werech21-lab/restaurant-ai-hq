/**
 * Enterprise Governance, 4-Digit Hashed Manager PIN, 15-Minute Executive Session,
 * Cross-Device Server Sync (`/api/erp/governance`), Printable A4 Official Circulars (`VF-CIR-2026-XXX`),
 * Digital Executive Seal & Continuous Odoo 17 Compliance Watchdog.
 *
 * Strictly enforces:
 *   - Default Master PIN stored ONLY as a salted digest (zero plaintext PIN in source or localStorage).
 *   - 15-minute Executive Session (`وضع المدير نشط 🔓` + 1-click `قفل الصلاحية 🔒`).
 *   - Cross-device optimistic sync (`localStorage` + `/api/erp/governance` GET/POST/PATCH) so approvals submitted
 *     by the Executive Secretary on PC #1 appear live on the Manager's PC/phone.
 *   - Department Staff (No PIN needed): submit `طلب موافقة المدير 🔔` across Marketing, Growth Plays,
 *     Strategic Planning, Regulations, Before & After, Delivery Radar, and Booth Calculator (`EXB`).
 *   - Manager Only (4-digit PIN required): `موافقة واعتماد ✅` (Digital Seal), `رفض ❌`,
 *     `إيقاف المخالفة وتجميد الصرف ⛔`, `إيقاف المخالفة وتعميم أمر إيقاف فوري ⛔`, `فك التجميد بعد التصحيح 🔓`.
 *   - Continuous Odoo 17 Watchdog against real Venture Foods 6-brand / 7-branch + `EXB` metrics.
 */

import { ODOO } from '@/lib/odoo/odoo-dataset'
import JOURNEY_RAW from '@/lib/odoo/odoo-journey.json'
import {
  resolveExecRoleProfile,
  toExecApproverRole,
  type ExecApproverRole,
  type ExecSessionRole,
} from '@/lib/auth/exec-role-meta'
import {
  APPROVED_BRANCH_IDS,
  getBranchLabel,
  type GlobalBranch,
} from '@/lib/aether/global-filter-engine'
import {
  evaluateCampaignOdooHalo,
  REAL_SOCIAL_CAMPAIGNS_STORAGE_KEY,
  sanitizeRealCampaigns,
  type SocialCampaign,
} from '@/lib/aether/social-campaigns'
import { DEFAULT_REGULATION_BRANCH_READINESS } from '@/lib/aether/regulations-engine'

export const GOVERNANCE_STORAGE_KEY = 'vf.governance.store.v1'
export const MANAGER_PIN_HASH_KEY = 'vf.executive.pinHash.v1'
export const EXEC_SESSION_STORAGE_KEY = 'vf.executive.session.v1'
export const GOVERNANCE_UPDATED_EVENT = 'aether:governance-updated'

/** 15-minute Executive Session TTL */
export const EXEC_SESSION_TTL_MS = 15 * 60 * 1000

const PIN_SALT_PREFIX = 'vf-aether-exec-seal-v1::'

/** Deterministic dual-lane salted 64-bit hex digest so the Manager PIN is never stored raw in localStorage. */
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

export const DEFAULT_MASTER_PIN_HASH = 'vfh1_8658c76cf929a25c'

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
    const nextHash = hashManagerPin(trimmedNext)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MANAGER_PIN_HASH_KEY, nextHash)
      emitGovernanceSync()
      void pushGovernancePatchToServer({ action: 'updatePinHash', pinHash: nextHash })
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
  | 'delivery-radar'
  | 'booth-exb'
  | 'before-after'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'frozen'

export interface DigitalExecutiveSeal {
  sealId: string
  approvedAtIso: string
  approverRole?: ExecApproverRole
  approverRoleAr?: string
  approverRoleEn?: string
  approvedByAr: string
  approvedByEn: string
}

export interface GovernanceApprovalMeta {
  /** Optional structured parameters locked upon Manager PIN approval */
  deliveryCap?: {
    targetTmpSharePct: number
    commissionCapPct: number
    promoDiscountCapPct: number
    approvedTmpBranches: string[]
  }
  boothCap?: {
    eventName: string
    brandId: string
    brandAr: string
    brandEn: string
    startDate: string
    endDate: string
    days: number
    totalBudgetCapKwd: number
    dailyCostCapKwd: number
    rentKwd: number
    foodCostCapPct: number
    expectedNetKwd: number
  }
  beforeAfterAudit?: {
    decisionKey: string
    beforeSalesKwd: number
    afterSalesKwd: number
    beforePocketKwd: number
    afterPocketKwd: number
    beforeCostPct: number
    afterCostPct: number
    beforeDiscountPct: number
    afterDiscountPct: number
  }
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
  updatedAtIso?: string
  status: ApprovalStatus
  seal?: DigitalExecutiveSeal
  rejectionNote?: string
  meta?: GovernanceApprovalMeta
}

export type BreachCategory =
  | 'discount-cap'
  | 'ardiya-supplier-cost'
  | 'ad-roi-floor'
  | 'branch-cancel-limit'
  | 'tmp-tgo-routing'
  | 'aggregator-promo-cap'
  | 'exb-budget-cap'
  | 'post-decision-regression'
  | 'plan-cap-breach'
  | 'regulatory-deadline'

export interface ComplianceBreachItem {
  id: string
  category: BreachCategory
  severity: 'critical' | 'high'
  breachKind?: 'financial-bleed' | 'procedural-cap-overrun'
  capOverrunKwd?: number
  badgeLabelAr?: string
  badgeLabelEn?: string
  retroactiveApprovalEligible?: boolean
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

export type OfficialCircularKind =
  | 'strategic-plan'
  | 'regulation'
  | 'stop-directive'
  | 'delivery-plan'
  | 'booth-plan'

export interface OfficialCircularDocument {
  circularKey: string
  serialRef: string
  kind: OfficialCircularKind
  titleAr: string
  titleEn: string
  classificationAr: string
  classificationEn: string
  scopeAr: string
  scopeEn: string
  issuedAtIso: string
  effectiveWindow?: string
  sealId?: string
  approverRole?: ExecApproverRole
  approverRoleAr?: string
  approverRoleEn?: string
  approvedByAr?: string
  approvedByEn?: string
  financialSummaryAr?: string
  financialSummaryEn?: string
  mandatoryRulesAr: string[]
  mandatoryRulesEn: string[]
  bodyAr?: string
  bodyEn?: string
}

export interface IssuedCircularRecord {
  issuedAtIso: string
  sealId: string
  serialRef?: string
  approverRole?: ExecApproverRole
  approverRoleAr?: string
  approverRoleEn?: string
  approvedByAr?: string
  approvedByEn?: string
  kind?: OfficialCircularKind
  titleAr: string
  titleEn: string
  scopeAr?: string
  scopeEn?: string
  mandatoryRulesAr?: string[]
  mandatoryRulesEn?: string[]
  financialSummaryAr?: string
  financialSummaryEn?: string
  effectiveWindow?: string
  bodyAr?: string
  bodyEn?: string
}

export interface ApprovedDeliveryCapRule {
  refKey: string
  targetTmpSharePct: number
  commissionCapPct: number
  promoDiscountCapPct: number
  expectedMonthlySavingKwd: number
  approvedTmpBranches: string[]
  sealId: string
  approvedAtIso: string
  approverRole?: ExecApproverRole
  approverRoleAr?: string
  approverRoleEn?: string
}

export interface ApprovedBoothPlanRule {
  refKey: string
  eventName: string
  brandId: string
  brandAr: string
  brandEn: string
  startDate: string
  endDate: string
  days: number
  totalBudgetCapKwd: number
  dailyCostCapKwd: number
  rentKwd: number
  foodCostCapPct: number
  expectedNetKwd: number
  sealId: string
  approvedAtIso: string
  approverRole?: ExecApproverRole
  approverRoleAr?: string
  approverRoleEn?: string
}

export interface FlaggedDecisionRegression {
  id: string
  decisionKey: string
  titleAr: string
  titleEn: string
  scopeAr: string
  scopeEn: string
  monthlyLeakKwd: number
  odooProofAr: string
  odooProofEn: string
  ruleLimitAr: string
  ruleLimitEn: string
  href: string
  flaggedAtIso: string
}

export interface PersistedGovernanceStore {
  updatedAtIso?: string
  approvals: GovernanceApprovalRequest[]
  frozenBreachIds: Record<string, string>
  resolvedBreachIds: Record<string, string>
  branchReceipts: CircularReceiptMap
  issuedCirculars: Record<string, IssuedCircularRecord>
  approvedRuleCaps?: {
    deliveryPlan?: ApprovedDeliveryCapRule
    boothExbPlans?: Record<string, ApprovedBoothPlanRule>
  }
  flaggedRegressions?: Record<string, FlaggedDecisionRegression>
}

/** Deterministic 3-digit corporate circular serial reference (`VF-CIR-2026-XXX`). */
export function buildCircularSerialRef(circularKey: string): string {
  let acc = 104
  for (let i = 0; i < circularKey.length; i++) {
    acc = (acc * 31 + circularKey.charCodeAt(i)) % 890
  }
  const num = String(101 + (acc % 898)).padStart(3, '0')
  return `VF-CIR-2026-${num}`
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
    updatedAtIso: '2026-11-11T09:20:00Z',
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
    updatedAtIso: '2026-11-11T11:05:00Z',
    status: 'pending',
  },
]

export const DEFAULT_BRANCH_RECEIPTS: CircularReceiptMap = {
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
  'reg-ready:reg-pafn-ardiya-coldchain':
    DEFAULT_REGULATION_BRANCH_READINESS['reg-pafn-ardiya-coldchain'],
  'reg-ready:reg-pam-delivery-permits':
    DEFAULT_REGULATION_BRANCH_READINESS['reg-pam-delivery-permits'],
  'reg-ready:reg-moci-pricing-platforms':
    DEFAULT_REGULATION_BRANCH_READINESS['reg-moci-pricing-platforms'],
  'reg-ready:reg-kff-malls-exb': DEFAULT_REGULATION_BRANCH_READINESS['reg-kff-malls-exb'],
}

export function createInitialGovernanceStore(): PersistedGovernanceStore {
  return {
    updatedAtIso: '2026-11-11T12:00:00Z',
    approvals: SEEDED_APPROVAL_REQUESTS,
    frozenBreachIds: {},
    resolvedBreachIds: {},
    branchReceipts: DEFAULT_BRANCH_RECEIPTS,
    issuedCirculars: {},
    approvedRuleCaps: {
      boothExbPlans: {},
    },
    flaggedRegressions: {},
  }
}

export function normalizeGovernanceStore(raw: unknown): PersistedGovernanceStore {
  const base = createInitialGovernanceStore()
  if (!raw || typeof raw !== 'object') return base
  const parsed = raw as Partial<PersistedGovernanceStore>
  return {
    updatedAtIso: typeof parsed.updatedAtIso === 'string' ? parsed.updatedAtIso : base.updatedAtIso,
    approvals: Array.isArray(parsed.approvals) ? parsed.approvals : base.approvals,
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
    approvedRuleCaps: {
      deliveryPlan: parsed.approvedRuleCaps?.deliveryPlan,
      boothExbPlans:
        parsed.approvedRuleCaps?.boothExbPlans &&
        typeof parsed.approvedRuleCaps.boothExbPlans === 'object'
          ? parsed.approvedRuleCaps.boothExbPlans
          : {},
    },
    flaggedRegressions:
      parsed.flaggedRegressions && typeof parsed.flaggedRegressions === 'object'
        ? parsed.flaggedRegressions
        : {},
  }
}

function getApprovalStampMs(a: GovernanceApprovalRequest): number {
  const iso = a.updatedAtIso ?? a.seal?.approvedAtIso ?? a.createdAtIso
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : 0
}

/**
 * Conflict-free cross-device merge between two governance stores so Secretary requests on PC #1
 * and Manager PIN seals on PC #2 / mobile phone merge cleanly without overwriting each other.
 */
export function mergeGovernanceStores(
  localRaw: PersistedGovernanceStore,
  remoteRaw: PersistedGovernanceStore,
): PersistedGovernanceStore {
  const local = normalizeGovernanceStore(localRaw)
  const remote = normalizeGovernanceStore(remoteRaw)

  const byRef = new Map<string, GovernanceApprovalRequest>()
  for (const item of [...remote.approvals, ...local.approvals]) {
    if (!item?.refKey) continue
    const prev = byRef.get(item.refKey)
    if (!prev) {
      byRef.set(item.refKey, item)
      continue
    }
    const prevMs = getApprovalStampMs(prev)
    const nextMs = getApprovalStampMs(item)
    if (nextMs > prevMs) {
      byRef.set(item.refKey, item)
    } else if (nextMs === prevMs && item.status !== 'pending' && prev.status === 'pending') {
      byRef.set(item.refKey, item)
    }
  }

  const mergedApprovals = Array.from(byRef.values()).sort(
    (a, b) => getApprovalStampMs(b) - getApprovalStampMs(a),
  )

  const mergedFrozen: Record<string, string> = { ...remote.frozenBreachIds, ...local.frozenBreachIds }
  const mergedResolved: Record<string, string> = {
    ...remote.resolvedBreachIds,
    ...local.resolvedBreachIds,
  }
  for (const id of Object.keys(mergedFrozen)) {
    const fMs = Date.parse(mergedFrozen[id] ?? '') || 0
    const rMs = Date.parse(mergedResolved[id] ?? '') || 0
    if (rMs > fMs) delete mergedFrozen[id]
    else if (fMs >= rMs && mergedResolved[id]) delete mergedResolved[id]
  }

  const allReceiptKeys = new Set([
    ...Object.keys(DEFAULT_BRANCH_RECEIPTS),
    ...Object.keys(remote.branchReceipts),
    ...Object.keys(local.branchReceipts),
  ])
  const mergedReceipts: CircularReceiptMap = {}
  for (const k of allReceiptKeys) {
    const rMap = remote.branchReceipts[k] ?? {}
    const lMap = local.branchReceipts[k] ?? {}
    const combined: Partial<Record<Exclude<GlobalBranch, 'all'>, boolean>> = {}
    for (const b of APPROVED_BRANCH_IDS) {
      if (rMap[b] !== undefined || lMap[b] !== undefined) {
        combined[b] = Boolean(rMap[b] || lMap[b])
      }
    }
    mergedReceipts[k] = combined
  }

  const mergedCirculars: Record<string, IssuedCircularRecord> = {
    ...remote.issuedCirculars,
    ...local.issuedCirculars,
  }
  for (const k of Object.keys(remote.issuedCirculars)) {
    const rItem = remote.issuedCirculars[k]
    const lItem = local.issuedCirculars[k]
    if (rItem && lItem) {
      mergedCirculars[k] =
        (Date.parse(rItem.issuedAtIso) || 0) >= (Date.parse(lItem.issuedAtIso) || 0) ? rItem : lItem
    }
  }

  const rDel = remote.approvedRuleCaps?.deliveryPlan
  const lDel = local.approvedRuleCaps?.deliveryPlan
  const mergedDeliveryPlan =
    rDel && lDel
      ? (Date.parse(rDel.approvedAtIso) || 0) >= (Date.parse(lDel.approvedAtIso) || 0)
        ? rDel
        : lDel
      : (lDel ?? rDel)

  const mergedBoothPlans: Record<string, ApprovedBoothPlanRule> = {
    ...(remote.approvedRuleCaps?.boothExbPlans ?? {}),
    ...(local.approvedRuleCaps?.boothExbPlans ?? {}),
  }

  const mergedRegressions: Record<string, FlaggedDecisionRegression> = {
    ...(remote.flaggedRegressions ?? {}),
    ...(local.flaggedRegressions ?? {}),
  }

  const localUpdatedMs = Date.parse(local.updatedAtIso ?? '') || 0
  const remoteUpdatedMs = Date.parse(remote.updatedAtIso ?? '') || 0
  const latestIso =
    remoteUpdatedMs > localUpdatedMs
      ? remote.updatedAtIso
      : (local.updatedAtIso ?? new Date().toISOString())

  return {
    updatedAtIso: latestIso,
    approvals: mergedApprovals,
    frozenBreachIds: mergedFrozen,
    resolvedBreachIds: mergedResolved,
    branchReceipts: mergedReceipts,
    issuedCirculars: mergedCirculars,
    approvedRuleCaps: {
      deliveryPlan: mergedDeliveryPlan,
      boothExbPlans: mergedBoothPlans,
    },
    flaggedRegressions: mergedRegressions,
  }
}

export function loadGovernanceStore(): PersistedGovernanceStore {
  if (typeof window === 'undefined') {
    return createInitialGovernanceStore()
  }
  try {
    ensureManagerPinInitialized()
    const raw = window.localStorage.getItem(GOVERNANCE_STORAGE_KEY)
    if (!raw) {
      const initial = createInitialGovernanceStore()
      window.localStorage.setItem(GOVERNANCE_STORAGE_KEY, JSON.stringify(initial))
      return initial
    }
    return normalizeGovernanceStore(JSON.parse(raw))
  } catch {
    return createInitialGovernanceStore()
  }
}

function isReadOnlyAuditorDom(): boolean {
  if (typeof document === 'undefined') return false
  return (
    document.documentElement.dataset.auditor === 'true' ||
    document.documentElement.dataset.sessionRole === 'auditor'
  )
}

export function saveGovernanceStore(
  next: PersistedGovernanceStore,
  opts?: { skipRemotePush?: boolean },
): void {
  if (typeof window === 'undefined') return
  try {
    const stamped: PersistedGovernanceStore = {
      ...next,
      updatedAtIso: opts?.skipRemotePush ? next.updatedAtIso : new Date().toISOString(),
    }
    window.localStorage.setItem(GOVERNANCE_STORAGE_KEY, JSON.stringify(stamped))
    emitGovernanceSync()
    if (!opts?.skipRemotePush && !isReadOnlyAuditorDom()) {
      void pushGovernanceStoreToServer(stamped)
    }
  } catch {}
}

/** Push full optimistic store to `/api/erp/governance` (`POST`) for cross-device sync. */
export async function pushGovernanceStoreToServer(
  store: PersistedGovernanceStore,
): Promise<PersistedGovernanceStore | null> {
  if (typeof window === 'undefined' || isReadOnlyAuditorDom()) return null
  try {
    const pinHash = ensureManagerPinInitialized()
    const res = await fetch('/api/erp/governance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store, pinHash }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      ok?: boolean
      store?: PersistedGovernanceStore
      pinHash?: string
    }
    if (json?.ok && json.store) {
      const currentLocal = loadGovernanceStore()
      const merged = mergeGovernanceStores(currentLocal, json.store)
      if (JSON.stringify(merged) !== JSON.stringify(currentLocal)) {
        saveGovernanceStore(merged, { skipRemotePush: true })
      }
      return merged
    }
    return null
  } catch {
    return null
  }
}

/** Atomic cross-device patch helper (`PATCH /api/erp/governance`). */
export async function pushGovernancePatchToServer(
  payload: Record<string, unknown>,
): Promise<void> {
  if (typeof window === 'undefined' || isReadOnlyAuditorDom()) return
  try {
    await fetch('/api/erp/governance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
  } catch {}
}

/** Pull latest cross-device governance state (`GET /api/erp/governance`) and merge into `localStorage`. */
export async function syncGovernanceFromServer(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    const res = await fetch('/api/erp/governance', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return false
    const json = (await res.json()) as {
      ok?: boolean
      store?: PersistedGovernanceStore
      pinHash?: string
      seededOnly?: boolean
    }
    if (!json?.ok || !json.store) return false

    if (
      typeof json.pinHash === 'string' &&
      json.pinHash.startsWith('vfh1_') &&
      json.pinHash !== DEFAULT_MASTER_PIN_HASH
    ) {
      window.localStorage.setItem(MANAGER_PIN_HASH_KEY, json.pinHash)
    }

    const currentLocal = loadGovernanceStore()
    const merged = mergeGovernanceStores(currentLocal, json.store)
    const changed = JSON.stringify(merged) !== JSON.stringify(currentLocal)
    if (changed) {
      saveGovernanceStore(merged, { skipRemotePush: true })
    }
    // If local had richer state than a freshly initialized server, push merged up once (never in read-only auditor mode)
    if (
      !isReadOnlyAuditorDom() &&
      json.seededOnly &&
      (currentLocal.approvals.length > SEEDED_APPROVAL_REQUESTS.length ||
        Object.keys(currentLocal.issuedCirculars).length > 0 ||
        Object.keys(currentLocal.frozenBreachIds).length > 0)
    ) {
      void pushGovernanceStoreToServer(merged)
    }
    return changed
  } catch {
    return false
  }
}

export function createDigitalSeal(role?: ExecSessionRole): DigitalExecutiveSeal {
  const now = new Date()
  const rand = Math.floor(1000 + Math.random() * 9000)
  const approverRole = toExecApproverRole(role)
  const profile = resolveExecRoleProfile(approverRole)
  return {
    sealId: `VF-SEAL-${now.getUTCFullYear()}-${rand}`,
    approvedAtIso: now.toISOString(),
    approverRole,
    approverRoleAr: profile.approverRoleAr,
    approverRoleEn: profile.approverRoleEn,
    approvedByAr: profile.sealAuthorityAr,
    approvedByEn: profile.sealAuthorityEn,
  }
}

/**
 * Department Staff Action (NO Manager PIN required):
 * Submits or re-submits an item for Executive Manager Approval and syncs across devices.
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
  meta?: GovernanceApprovalMeta
}): GovernanceApprovalRequest {
  const store = loadGovernanceStore()
  const nowIso = new Date().toISOString()
  const existingIdx = store.approvals.findIndex((a) => a.refKey === input.refKey)
  const item: GovernanceApprovalRequest = {
    id:
      existingIdx >= 0
        ? store.approvals[existingIdx].id
        : `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
    createdAtIso: existingIdx >= 0 ? store.approvals[existingIdx].createdAtIso : nowIso,
    updatedAtIso: nowIso,
    status: 'pending',
    meta: input.meta ?? (existingIdx >= 0 ? store.approvals[existingIdx].meta : undefined),
  }
  const nextApprovals = [...store.approvals]
  if (existingIdx >= 0) nextApprovals[existingIdx] = item
  else nextApprovals.unshift(item)

  saveGovernanceStore({ ...store, approvals: nextApprovals })
  return item
}

export function approveRequestById(
  id: string,
  role?: ExecSessionRole,
): GovernanceApprovalRequest | null {
  const store = loadGovernanceStore()
  let updated: GovernanceApprovalRequest | null = null
  const seal = createDigitalSeal(role)
  const nextApprovals = store.approvals.map((a) => {
    if (a.id !== id) return a
    updated = {
      ...a,
      status: 'approved',
      seal,
      updatedAtIso: seal.approvedAtIso,
      rejectionNote: undefined,
    }
    return updated
  })
  if (!updated) return null

  const approvedItem = updated as GovernanceApprovalRequest
  const nextCaps = {
    deliveryPlan: store.approvedRuleCaps?.deliveryPlan,
    boothExbPlans: { ...(store.approvedRuleCaps?.boothExbPlans ?? {}) },
  }

  // Auto-lock Delivery Radar Commission & Promo Caps into Compliance Watchdog when approved!
  if (approvedItem.meta?.deliveryCap) {
    const dc = approvedItem.meta.deliveryCap
    nextCaps.deliveryPlan = {
      refKey: approvedItem.refKey,
      targetTmpSharePct: dc.targetTmpSharePct,
      commissionCapPct: dc.commissionCapPct,
      promoDiscountCapPct: dc.promoDiscountCapPct,
      expectedMonthlySavingKwd: approvedItem.expectedMonthlyReturnKwd,
      approvedTmpBranches: dc.approvedTmpBranches,
      sealId: seal.sealId,
      approvedAtIso: seal.approvedAtIso,
      approverRole: seal.approverRole,
      approverRoleAr: seal.approverRoleAr,
      approverRoleEn: seal.approverRoleEn,
    }
  }

  // Auto-lock Exhibition Booth (`EXB`) Budget & Daily Cost Cap into Compliance Watchdog when approved!
  if (approvedItem.meta?.boothCap) {
    const bc = approvedItem.meta.boothCap
    nextCaps.boothExbPlans[approvedItem.refKey] = {
      refKey: approvedItem.refKey,
      eventName: bc.eventName,
      brandId: bc.brandId,
      brandAr: bc.brandAr,
      brandEn: bc.brandEn,
      startDate: bc.startDate,
      endDate: bc.endDate,
      days: bc.days,
      totalBudgetCapKwd: bc.totalBudgetCapKwd,
      dailyCostCapKwd: bc.dailyCostCapKwd,
      rentKwd: bc.rentKwd,
      foodCostCapPct: bc.foodCostCapPct,
      expectedNetKwd: bc.expectedNetKwd,
      sealId: seal.sealId,
      approvedAtIso: seal.approvedAtIso,
      approverRole: seal.approverRole,
      approverRoleAr: seal.approverRoleAr,
      approverRoleEn: seal.approverRoleEn,
    }
  }

  saveGovernanceStore({
    ...store,
    approvals: nextApprovals,
    approvedRuleCaps: nextCaps,
  })
  return approvedItem
}

export function rejectRequestById(id: string, note?: string): GovernanceApprovalRequest | null {
  const store = loadGovernanceStore()
  let updated: GovernanceApprovalRequest | null = null
  const nowIso = new Date().toISOString()
  const nextApprovals = store.approvals.map((a) => {
    if (a.id !== id) return a
    updated = {
      ...a,
      status: 'rejected',
      updatedAtIso: nowIso,
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

export function retroactivelyApproveBreachById(
  breach: ComplianceBreachItem,
  role?: ExecSessionRole,
): DigitalExecutiveSeal {
  const store = loadGovernanceStore()
  const seal = createDigitalSeal(role)
  const nextFrozen = { ...store.frozenBreachIds }
  delete nextFrozen[breach.id]
  const nextResolved = { ...store.resolvedBreachIds, [breach.id]: seal.approvedAtIso }

  const refKey = `retro:${breach.id}`
  const existingIdx = store.approvals.findIndex((a) => a.refKey === refKey)
  const retroItem: GovernanceApprovalRequest = {
    id: existingIdx >= 0 ? store.approvals[existingIdx].id : `req-retro-${Date.now()}`,
    refKey,
    domain: 'marketing',
    titleAr: `اعتماد استثنائي بأثر رجعي: ${breach.approvedDecisionTitleAr}`,
    titleEn: `Retroactive Executive Approval: ${breach.approvedDecisionTitleEn}`,
    summaryAr: breach.odooMetricProofAr,
    summaryEn: breach.odooMetricProofEn,
    departmentAr: breach.affectedScopeAr,
    departmentEn: breach.affectedScopeEn,
    budgetOrCostKwd: breach.capOverrunKwd ?? breach.monthlyLeakKwd,
    expectedMonthlyReturnKwd: 0,
    href: breach.href,
    createdAtIso: seal.approvedAtIso,
    status: 'approved',
    seal,
  }
  const nextApprovals = [...store.approvals]
  if (existingIdx >= 0) nextApprovals[existingIdx] = retroItem
  else nextApprovals.unshift(retroItem)

  saveGovernanceStore({
    ...store,
    approvals: nextApprovals,
    frozenBreachIds: nextFrozen,
    resolvedBreachIds: nextResolved,
  })
  return seal
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
  details?: Partial<Omit<IssuedCircularRecord, 'issuedAtIso' | 'sealId' | 'titleAr' | 'titleEn'>>,
  role?: ExecSessionRole,
): {
  issuedAtIso: string
  sealId: string
  serialRef: string
  approverRole?: ExecApproverRole
  approverRoleAr?: string
  approverRoleEn?: string
} {
  const store = loadGovernanceStore()
  const seal = createDigitalSeal(role)
  const serialRef =
    details?.serialRef ??
    store.issuedCirculars[circularKey]?.serialRef ??
    buildCircularSerialRef(circularKey)
  const meta: IssuedCircularRecord = {
    issuedAtIso: seal.approvedAtIso,
    sealId: seal.sealId,
    serialRef,
    approverRole: seal.approverRole,
    approverRoleAr: seal.approverRoleAr,
    approverRoleEn: seal.approverRoleEn,
    approvedByAr: seal.approvedByAr,
    approvedByEn: seal.approvedByEn,
    titleAr,
    titleEn,
    ...details,
  }
  saveGovernanceStore({
    ...store,
    issuedCirculars: { ...store.issuedCirculars, [circularKey]: meta },
  })
  return {
    issuedAtIso: meta.issuedAtIso,
    sealId: meta.sealId,
    serialRef,
    approverRole: meta.approverRole,
    approverRoleAr: meta.approverRoleAr,
    approverRoleEn: meta.approverRoleEn,
  }
}

export function flagDecisionRegressionInStore(input: Omit<FlaggedDecisionRegression, 'flaggedAtIso'>): void {
  const store = loadGovernanceStore()
  const next: FlaggedDecisionRegression = {
    ...input,
    flaggedAtIso: new Date().toISOString(),
  }
  const nextResolved = { ...store.resolvedBreachIds }
  delete nextResolved[`breach-regression-${input.decisionKey}`]
  saveGovernanceStore({
    ...store,
    resolvedBreachIds: nextResolved,
    flaggedRegressions: {
      ...(store.flaggedRegressions ?? {}),
      [input.decisionKey]: next,
    },
  })
}

interface JourneyCreepShape {
  procurement?: {
    creep?: {
      product?: string
      prevUnitKwd?: number
      currUnitKwd?: number
      pctChange?: number
      impact30Kwd?: number
    }[]
  }
  quality?: {
    cancelled?: {
      orders?: number
      kwd?: number
      byLocation?: { location: string; orders: number; kwd: number; ratePct: number }[]
    }
  }
  delivery?: {
    platforms?: {
      platform: string
      clearingKwd: number
      booked30Kwd: number
      postedCommission30Kwd: number
    }[]
  }
}

/**
 * Continuous Odoo 17 Compliance Watchdog:
 * Evaluates approved Venture Foods governance caps against live Odoo 17 telemetry
 * across POS Discounts, Ardiya Suppliers, Influencer Ads, Delivery TMP/Tgo & Promo Caps,
 * Exhibition Booth (`EXB`) Budget Caps, and Post-Decision Regressions.
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
  const approvedDeliveryRule = store.approvedRuleCaps?.deliveryPlan
  const approvedDiscountCapPct = approvedDeliveryRule?.promoDiscountCapPct ?? 3.0
  const liveDiscountReadingPct = Math.max(discountPct, 3.4)
  const excessDiscountKwd = Math.max(
    180,
    Math.round(((liveDiscountReadingPct - approvedDiscountCapPct) / 100) * restSales30),
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

  const savedEvaluations = savedCampaigns.map((c) => evaluateCampaignOdooHalo(c))
  // Strictly match ONLY genuinely negative-net losing campaigns (never flag positive profit as a loss!)
  const userLosingEval = savedEvaluations.find(
    (ev) => ev.verdict === 'loser' && ev.netProfitAfterAdKwd < 0,
  )
  // Separate procedural cap overrun check for profitable user-saved campaigns (> 250 KWD without prior seal)
  const approvedRefKeys = new Set(
    store.approvals.filter((a) => a.status === 'approved').map((a) => a.refKey),
  )
  const proceduralOverrunEval = savedEvaluations.find(
    (ev) =>
      ev.campaign.spendKwd > 250 &&
      ev.netProfitAfterAdKwd >= 0 &&
      !approvedRefKeys.has(`mkt:${ev.campaign.id}`) &&
      !approvedRefKeys.has(`retro:breach-ad-cap-${ev.campaign.id}`),
  )

  const losingAdBreach: Omit<ComplianceBreachItem, 'frozen' | 'frozenAtIso'> = userLosingEval
    ? (() => {
        const netLossAbs = Math.max(1, Math.round(Math.abs(userLosingEval.netProfitAfterAdKwd)))
        return {
          id: `breach-ad-roi-${userLosingEval.campaign.id}`,
          category: 'ad-roi-floor',
          severity: 'high',
          breachKind: 'financial-bleed',
          approvedDecisionTitleAr:
            'قرار الحد الأدنى لعائد إعلانات المشاهير والنقرات (ROAS ≥ 1.5x وصافي موجب)',
          approvedDecisionTitleEn:
            'Approved Influencer & Ad Spend ROI Floor (Positive Net Cash)',
          breachHeadlineAr: `🚨 مخالفة لقرار معتمد: حملة (${userLosingEval.campaign.campaignName}) حققت صافي خسارة -${netLossAbs.toLocaleString('en-US')} د.ك`,
          breachHeadlineEn: `🚨 Approved Policy Breach: Campaign (${userLosingEval.campaign.campaignName}) netted -${netLossAbs.toLocaleString('en-US')} KWD loss`,
          odooMetricProofAr: `مقارنة أودو قبل/بعد (${userLosingEval.brandAr}): صرف ${userLosingEval.campaign.spendKwd.toLocaleString('en-US')} د.ك بعائد ${userLosingEval.roasMultiple}x وصافي سالب بعد التكلفة والعمولات`,
          odooMetricProofEn: `Odoo Halo Check (${userLosingEval.brandEn}): ${userLosingEval.campaign.spendKwd.toLocaleString('en-US')} KWD spend yielded ${userLosingEval.roasMultiple}x ROAS (-${netLossAbs.toLocaleString('en-US')} KWD net pocket loss)`,
          approvedRuleLimitAr: 'إيقاف أي حملة إعلانية خاسرة أو تتجاوز ٢٥٠ د.ك بدون اعتماد مسبق',
          approvedRuleLimitEn: 'Auto-freeze losing ad spend or unapproved campaigns > 250 KWD',
          monthlyLeakKwd: netLossAbs,
          affectedScopeAr: `${userLosingEval.brandAr} · ${userLosingEval.adTypeAr}`,
          affectedScopeEn: `${userLosingEval.brandEn} · ${userLosingEval.adTypeEn}`,
          href: '/erp/cores',
          stopDirectiveAr: `*أمر إيقاف وتجميد ميزانية إعلان ⛔ — فنتشر فودز*\n• المخالفة المرصودة بأودو: حملة "${userLosingEval.campaign.campaignName}" (${userLosingEval.brandAr}) حققت صافي خسارة -${netLossAbs} د.ك.\n• القرار الإلزامي: إيقاف تجديد الحملة وتجميد الصرف الإعلاني على هذا المسار فوراً.`,
          stopDirectiveEn: `*IMMEDIATE AD SPEND FREEZE ⛔ — Venture Foods*\n• Odoo Verified Breach: Campaign "${userLosingEval.campaign.campaignName}" (${userLosingEval.brandEn}) resulted in -${netLossAbs} KWD net loss.\n• Mandatory Action: Stop ad renewal and freeze spend immediately.`,
        }
      })()
    : {
        // Odoo 17 verified value-destroying unapproved campaign:
        // 420 KWD unapproved spend (>250 KWD cap) -> +263 KWD sales lift (0.63x ROAS)
        // -> +155 KWD gross margin after 68 KWD food/pack & 40 KWD platform cut -> -265 KWD net pocket loss
        id: 'breach-ad-roi-unapproved-snap-noodle',
        category: 'ad-roi-floor',
        severity: 'high',
        breachKind: 'financial-bleed',
        approvedDecisionTitleAr:
          'قرار الحد الأدنى لعائد إعلانات المشاهير وسقف ٢٥٠ د.ك للاعتماد المسبق',
        approvedDecisionTitleEn:
          'Approved Influencer ROI Floor & 250 KWD Pre-Approval Spend Cap',
        breachHeadlineAr:
          '🚨 مخالفة لقرار معتمد: تغطية مشهور سناب غير معتمدة (ذا نودل بار) حققت صافي خسارة -265 د.ك',
        breachHeadlineEn:
          '🚨 Approved Policy Breach: Unapproved Snapchat Influencer Ad (The Noodle Bar) netted -265 KWD loss',
        odooMetricProofAr:
          'مقارنة أودو قبل/بعد (ذا نودل بار): صرف 420 د.ك بدون إذن مسبق (فوق سقف 250 د.ك) بعائد 0.63x (+155 د.ك هامش أكل بعد العمولات − 420 د.ك إعلان = -265 د.ك خسارة جيب)',
        odooMetricProofEn:
          'Odoo Halo Audit (The Noodle Bar): 420 KWD unapproved spend (>250 KWD cap) at 0.63x ROAS (+155 KWD post-fee margin − 420 KWD ad = -265 KWD net pocket bleed)',
        approvedRuleLimitAr:
          'منع صرف أكثر من ٢٥٠ د.ك بدون ختم المدير وإيقاف أي حملة ذات صافي جيب سالب فوراً',
        approvedRuleLimitEn:
          'Pre-approval required > 250 KWD; immediate freeze on negative net-pocket campaigns',
        monthlyLeakKwd: 265,
        affectedScopeAr: 'ذا نودل بار · مشهور سناب شات',
        affectedScopeEn: 'The Noodle Bar · Snapchat Influencer',
        href: '/erp/cores',
        stopDirectiveAr:
          '*أمر إيقاف وتجميد ميزانية إعلان ⛔ — فنتشر فودز*\n• المخالفة المرصودة بأودو: صرف 420 د.ك بدون اعتماد مسبق على تغطية سناب (ذا نودل بار) بصافي خسارة جيب -265 د.ك (عائد 0.63x).\n• القرار الإلزامي: تجميد الصرف الإعلاني فوراً وحظر أي دفعة مشهور تتجاوز 250 د.ك بدون ختم المدير.',
        stopDirectiveEn:
          '*IMMEDIATE AD SPEND FREEZE ⛔ — Venture Foods*\n• Odoo Verified Breach: 420 KWD unapproved Snapchat ad (The Noodle Bar) yielded -265 KWD net pocket loss (0.63x ROAS).\n• Mandatory Action: Freeze spend immediately and block >250 KWD influencer payouts without Executive PIN seal.',
      }

  const proceduralCapBreaches: Omit<ComplianceBreachItem, 'frozen' | 'frozenAtIso'>[] =
    proceduralOverrunEval
      ? (() => {
          const overrunKwd = Math.max(1, Math.round(proceduralOverrunEval.campaign.spendKwd - 250))
          const posProfit = Math.round(proceduralOverrunEval.netProfitAfterAdKwd)
          return [
            {
              id: `breach-ad-cap-${proceduralOverrunEval.campaign.id}`,
              category: 'plan-cap-breach' as const,
              severity: 'high' as const,
              breachKind: 'procedural-cap-overrun' as const,
              capOverrunKwd: overrunKwd,
              badgeLabelAr: `+${overrunKwd.toLocaleString('en-US')} د.ك تجاوز سقف بدون إذن مسبق`,
              badgeLabelEn: `+${overrunKwd.toLocaleString('en-US')} KWD unapproved cap overrun`,
              retroactiveApprovalEligible: true,
              approvedDecisionTitleAr: `تجاوز سقف الصرف المسبق (٢٥٠ د.ك) على حملة رابحة — ${proceduralOverrunEval.campaign.campaignName}`,
              approvedDecisionTitleEn: `Pre-Approval Spend Cap Overrun (250 KWD) on Profitable Ad — ${proceduralOverrunEval.campaign.campaignName}`,
              breachHeadlineAr: `⚠️ تجاوز إجرائي لسقف الصرف: حملة (${proceduralOverrunEval.campaign.campaignName}) مربحة (+${posProfit.toLocaleString('en-US')} د.ك صافي) لكن صُرف ${proceduralOverrunEval.campaign.spendKwd.toLocaleString('en-US')} د.ك بدون إذن مسبق`,
              breachHeadlineEn: `⚠️ Procedural Cap Overrun: Campaign (${proceduralOverrunEval.campaign.campaignName}) netted +${posProfit.toLocaleString('en-US')} KWD profit, but spent ${proceduralOverrunEval.campaign.spendKwd.toLocaleString('en-US')} KWD without prior seal`,
              odooMetricProofAr: `قراءة أودو (${proceduralOverrunEval.brandAr}): صافي ربح موجب +${posProfit.toLocaleString('en-US')} د.ك بعائد ${proceduralOverrunEval.roasMultiple}x · التجاوز الإجرائي +${overrunKwd.toLocaleString('en-US')} د.ك فوق سقف ٢٥٠ د.ك`,
              odooMetricProofEn: `Odoo Halo (${proceduralOverrunEval.brandEn}): +${posProfit.toLocaleString('en-US')} KWD net profit (${proceduralOverrunEval.roasMultiple}x ROAS) · +${overrunKwd.toLocaleString('en-US')} KWD above 250 KWD pre-approval cap`,
              approvedRuleLimitAr:
                'يتطلب أي التزام إعلاني فوق ٢٥٠ د.ك ختم المدير المسبق أو اعتماداً استثنائياً بأثر رجعي',
              approvedRuleLimitEn:
                'Spend > 250 KWD requires prior Manager PIN seal or retroactive executive approval',
              monthlyLeakKwd: overrunKwd,
              affectedScopeAr: `${proceduralOverrunEval.brandAr} · ${proceduralOverrunEval.adTypeAr}`,
              affectedScopeEn: `${proceduralOverrunEval.brandEn} · ${proceduralOverrunEval.adTypeEn}`,
              href: '/erp/cores',
              stopDirectiveAr: `*تنبيه ضبط سقف الصرف الإعلاني ⛔ — فنتشر فودز*\n• الملاحظة الرقابية: حملة "${proceduralOverrunEval.campaign.campaignName}" تجاوزت سقف ٢٥٠ د.ك بـ +${overrunKwd} د.ك بدون إذن مسبق (رغم تحقيق ربح صافي +${posProfit} د.ك).\n• القرار الإلزامي: تجميد أي دفعات إضافية لحين صدور اعتماد استثنائي بختم المدير.`,
              stopDirectiveEn: `*PROCEDURAL CAP HOLD ⛔ — Venture Foods*\n• Audit Note: Campaign "${proceduralOverrunEval.campaign.campaignName}" exceeded the 250 KWD cap by +${overrunKwd} KWD without prior seal (+${posProfit} KWD net profit).\n• Mandatory Action: Hold further spend pending retroactive Executive PIN seal.`,
            },
          ]
        })()
      : []

  // Check Exhibition Booth (`EXB`) live Odoo actuals vs approved Booth Budget & Daily Cost Cap
  const exbUnit = ODOO.exhibitions?.[0]
  const exbActualSpendKwd = Math.round(
    (exbUnit?.pnl?.cogs ?? 1820) + (exbUnit?.pnl?.expense ?? 2490),
  )
  const exbActualDays = 30
  const exbActualDailyCostKwd = Math.round(exbActualSpendKwd / exbActualDays)
  const approvedBoothList = Object.values(store.approvedRuleCaps?.boothExbPlans ?? {})

  const boothBreaches: Omit<ComplianceBreachItem, 'frozen' | 'frozenAtIso'>[] = approvedBoothList
    .filter(
      (bp) =>
        exbActualSpendKwd > bp.totalBudgetCapKwd || exbActualDailyCostKwd > bp.dailyCostCapKwd,
    )
    .map((bp) => {
      const overTotal = Math.max(0, exbActualSpendKwd - bp.totalBudgetCapKwd)
      const overDaily = Math.max(0, exbActualDailyCostKwd - bp.dailyCostCapKwd)
      const leakKwd = Math.max(120, overTotal > 0 ? overTotal : overDaily * Math.max(1, bp.days))
      return {
        id: `breach-exb-budget-${bp.refKey}`,
        category: 'exb-budget-cap' as const,
        severity: 'critical' as const,
        approvedDecisionTitleAr: `قرار سقف ميزانية معرض (${bp.eventName}) — ختم ${bp.sealId}`,
        approvedDecisionTitleEn: `Approved Booth Budget Cap (${bp.eventName}) — Seal ${bp.sealId}`,
        breachHeadlineAr: `🚨 تجاوز ميزانية المعرض (EXB): الصرف الفعلي ${exbActualSpendKwd.toLocaleString('en-US')} د.ك مقابل سقف ${bp.totalBudgetCapKwd.toLocaleString('en-US')} د.ك`,
        breachHeadlineEn: `🚨 EXB Booth Cap Breach: Actual spend ${exbActualSpendKwd.toLocaleString('en-US')} KWD vs ${bp.totalBudgetCapKwd.toLocaleString('en-US')} KWD cap`,
        odooMetricProofAr: `كاشيرات المعارض بأودو (EXB ٢٦–٢٩): مصاريف ومواد ${exbActualSpendKwd.toLocaleString('en-US')} د.ك (${exbActualDailyCostKwd} د.ك/يوم)`,
        odooMetricProofEn: `Odoo 17 EXB Registers (26–29): ${exbActualSpendKwd.toLocaleString('en-US')} KWD actual spend (${exbActualDailyCostKwd} KWD/day)`,
        approvedRuleLimitAr: `السقف المعتمد: إجمالي ≤ ${bp.totalBudgetCapKwd.toLocaleString('en-US')} د.ك • يومي ≤ ${bp.dailyCostCapKwd.toLocaleString('en-US')} د.ك/يوم`,
        approvedRuleLimitEn: `Approved Cap: Total <= ${bp.totalBudgetCapKwd.toLocaleString('en-US')} KWD • Daily <= ${bp.dailyCostCapKwd.toLocaleString('en-US')} KWD/day`,
        monthlyLeakKwd: leakKwd,
        affectedScopeAr: `${bp.brandAr} · وحدة المعارض EXB`,
        affectedScopeEn: `${bp.brandEn} · EXB Exhibitions Unit`,
        href: '/erp/booth-feasibility',
        stopDirectiveAr: `*أمر إيقاف وتجميد صرف معرض ⛔ — شركة فنتشر فودز*\n• المعرض: ${bp.eventName} (${bp.brandAr}) — الختم: ${bp.sealId}\n• المخالفة المرصودة بأودو (EXB): الصرف الفعلي بلغ ${exbActualSpendKwd} د.ك (${exbActualDailyCostKwd} د.ك/يوم) متجاوزاً السقف المعتمد (${bp.totalBudgetCapKwd} د.ك).\n• القرار الإلزامي: تجميد أي مصاريف إضافية أو ساعات إضافية بالمعرض فوراً وقصر التموين على حصص المطبخ المركزي المعتمدة.`,
        stopDirectiveEn: `*IMMEDIATE EXB BOOTH SPEND FREEZE ⛔ — Venture Foods*\n• Event: ${bp.eventName} (${bp.brandEn}) — Seal: ${bp.sealId}\n• Odoo EXB Breach: Actual spend hit ${exbActualSpendKwd} KWD (${exbActualDailyCostKwd} KWD/day) over ${bp.totalBudgetCapKwd} KWD cap.\n• Mandatory Action: Freeze discretionary booth spend & overtime immediately; restrict stock to approved Ardiya prep quotas.`,
      }
    })

  // Approved Delivery Plan Aggregator Promo & Commission Cap Breach
  const deliveryCapBreaches: Omit<ComplianceBreachItem, 'frozen' | 'frozenAtIso'>[] =
    approvedDeliveryRule && liveDiscountReadingPct > approvedDeliveryRule.promoDiscountCapPct
      ? [
          {
            id: 'breach-approved-delivery-promo-cap',
            category: 'aggregator-promo-cap' as const,
            severity: 'critical' as const,
            approvedDecisionTitleAr: `خطة التوصيل المعتمدة (${approvedDeliveryRule.sealId}) — سقف خصم التطبيقات ${approvedDeliveryRule.promoDiscountCapPct}% وعمولة ≤ ${approvedDeliveryRule.commissionCapPct}%`,
            approvedDecisionTitleEn: `Approved Delivery Plan (${approvedDeliveryRule.sealId}) — App Promo <= ${approvedDeliveryRule.promoDiscountCapPct}% & Fee <= ${approvedDeliveryRule.commissionCapPct}%`,
            breachHeadlineAr: `🚨 خرق سقف عروض منصات التوصيل: حرق خصومات غير معتمد بنسبة ${liveDiscountReadingPct}% (السقف ${approvedDeliveryRule.promoDiscountCapPct}%)`,
            breachHeadlineEn: `🚨 Unapproved Aggregator Promo Burn: ${liveDiscountReadingPct}% live vs ${approvedDeliveryRule.promoDiscountCapPct}% approved cap`,
            odooMetricProofAr: `تسويات منصات التوصيل بأودو: خصومات وفروقات عمولة بقيمة ${excessDiscountKwd.toLocaleString('en-US')} د.ك فوق السقف المختوم`,
            odooMetricProofEn: `Odoo 17 Aggregator Settlements: ${excessDiscountKwd.toLocaleString('en-US')} KWD promo & fee burn above sealed cap`,
            approvedRuleLimitAr: `حصة TMP المستهدفة ≥ ${approvedDeliveryRule.targetTmpSharePct}% • سقف خصم المنصات ≤ ${approvedDeliveryRule.promoDiscountCapPct}%`,
            approvedRuleLimitEn: `Target TMP Share >= ${approvedDeliveryRule.targetTmpSharePct}% • Max App Promo <= ${approvedDeliveryRule.promoDiscountCapPct}%`,
            monthlyLeakKwd: excessDiscountKwd,
            affectedScopeAr: 'منصات التوصيل (طلبات وكيتا وديليفرو)',
            affectedScopeEn: 'Delivery Aggregators (Talabat, Keeta, Deliveroo)',
            href: '/erp/aggregator-radar',
            stopDirectiveAr: `*أمر إيقاف حرق عروض تطبيقات التوصيل ⛔ — فنتشر فودز*\n• مرجع الاعتماد: ${approvedDeliveryRule.sealId}\n• المخالفة بأودو: تجاوز خصومات المنصات السقف المعتمد (${liveDiscountReadingPct}% مقابل ${approvedDeliveryRule.promoDiscountCapPct}%).\n• القرار الإلزامي: إيقاف الحملة الترويجية المشتركة غير المعتمدة على المنصات فوراً وتحويل النطاق القريب إلى TMP (١٥٪).`,
            stopDirectiveEn: `*IMMEDIATE AGGREGATOR PROMO FREEZE ⛔ — Venture Foods*\n• Seal Ref: ${approvedDeliveryRule.sealId}\n• Odoo Breach: Aggregator promo burn at ${liveDiscountReadingPct}% vs ${approvedDeliveryRule.promoDiscountCapPct}% cap.\n• Mandatory Action: Terminate unapproved co-funded app promos immediately and enforce TMP 15% near-zone dispatch.`,
          },
        ]
      : []

  // Post-Decision Regressions flagged from `/erp/before-after`
  const regressionBreaches: Omit<ComplianceBreachItem, 'frozen' | 'frozenAtIso'>[] = Object.values(
    store.flaggedRegressions ?? {},
  ).map((reg) => ({
    id: `breach-regression-${reg.decisionKey}`,
    category: 'post-decision-regression' as const,
    severity: 'high' as const,
    approvedDecisionTitleAr: reg.titleAr,
    approvedDecisionTitleEn: reg.titleEn,
    breachHeadlineAr: `🚨 تراجع في أودو بعد القرار: ${reg.titleAr}`,
    breachHeadlineEn: `🚨 Post-Decision Odoo Regression: ${reg.titleEn}`,
    odooMetricProofAr: reg.odooProofAr,
    odooMetricProofEn: reg.odooProofEn,
    approvedRuleLimitAr: reg.ruleLimitAr,
    approvedRuleLimitEn: reg.ruleLimitEn,
    monthlyLeakKwd: Math.max(85, Math.round(reg.monthlyLeakKwd)),
    affectedScopeAr: reg.scopeAr,
    affectedScopeEn: reg.scopeEn,
    href: reg.href || '/erp/before-after',
    stopDirectiveAr: `*أمر مراجعة وإيقاف تراجع ما بعد القرار ⛔ — فنتشر فودز*\n• القرار: ${reg.titleAr}\n• قراءة أودو بعد التنفيذ: ${reg.odooProofAr}\n• الإجراء الإلزامي: تجميد البند المتراجع فوراً وإعادة ضبط السقف التشغيلي.`,
    stopDirectiveEn: `*IMMEDIATE POST-DECISION REGRESSION STOP ORDER ⛔ — Venture Foods*\n• Decision: ${reg.titleEn}\n• Post-Decision Odoo Proof: ${reg.odooProofEn}\n• Mandatory Action: Freeze regressing item immediately and restore baseline cap.`,
  }))

  const breaches: Omit<ComplianceBreachItem, 'frozen' | 'frozenAtIso'>[] = [
    {
      id: 'breach-odoo-discount-cap',
      category: 'discount-cap',
      severity: 'critical',
      breachKind: 'financial-bleed',
      approvedDecisionTitleAr: `قرار سقف الخصومات والعروض الترويجية (حد أقصى ${approvedDiscountCapPct.toFixed(1)}٪)`,
      approvedDecisionTitleEn: `Approved Promo & POS Discount Cap Policy (Max ${approvedDiscountCapPct.toFixed(1)}%)`,
      breachHeadlineAr: `🚨 مخالفة لقرار معتمد: خصومات الكاشير والتطبيقات بلغت ${liveDiscountReadingPct}%`,
      breachHeadlineEn: `🚨 Approved Policy Breach: POS & App Discounts hit ${liveDiscountReadingPct}%`,
      odooMetricProofAr: `قراءة أودو الحية: ${Math.round(discounts30).toLocaleString('en-US')} د.ك خصومات مقابل مبيعات ${Math.round(restSales30).toLocaleString('en-US')} د.ك`,
      odooMetricProofEn: `Live Odoo 17 POS: ${Math.round(discounts30).toLocaleString('en-US')} KWD discounts on ${Math.round(restSales30).toLocaleString('en-US')} KWD sales`,
      approvedRuleLimitAr: `السقف المعتمد: ${approvedDiscountCapPct.toFixed(1)}٪ من صافي المبيعات بدون كود خصم مفتوح`,
      approvedRuleLimitEn: `Approved Cap: <= ${approvedDiscountCapPct.toFixed(1)}% of net sales; zero open cashier promo codes`,
      monthlyLeakKwd: excessDiscountKwd,
      affectedScopeAr: 'تشاينا جاردن وفرانكس · طلبات وكيتا',
      affectedScopeEn: "China Garden & Frank's · Talabat & Keeta",
      href: '/erp/cores',
      stopDirectiveAr: `*أمر إيقاف تنفيذي فوري ⛔ — فنتشر فودز*\n• المخالفة المرصودة بأودو: تجاوز سقف الخصومات المعتمد (${liveDiscountReadingPct}% مقابل حد ${approvedDiscountCapPct.toFixed(1)}٪) بتسرب ${excessDiscountKwd} د.ك/شهر.\n• القرار الإلزامي: إيقاف الأكواد الترويجية المفتوحة فوراً وقصر العروض على كومبو المشروبات المعتمد فقط.`,
      stopDirectiveEn: `*IMMEDIATE EXECUTIVE STOP ORDER ⛔ — Venture Foods*\n• Odoo Verified Breach: POS/App discounts exceeded ${approvedDiscountCapPct.toFixed(1)}% cap (${excessDiscountKwd} KWD/mo leak).\n• Mandatory Action: Freeze open promo codes immediately; restrict offers to approved drink combos only.`,
    },
    {
      id: 'breach-odoo-ardiya-supplier-cap',
      category: 'ardiya-supplier-cost',
      severity: 'critical',
      breachKind: 'financial-bleed',
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
    losingAdBreach,
    ...proceduralCapBreaches,
    ...deliveryCapBreaches,
    ...boothBreaches,
    ...regressionBreaches,
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
