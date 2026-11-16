/**
 * Enterprise Governance, 4-Digit Hashed Manager PIN, 15-Minute Executive Session,
 * Cross-Device Server Sync (`/api/erp/governance`), Printable A4 Official Circulars (`VF-CIR-2026-XXX`),
 * Digital Executive Seal & Server-Backed Odoo Alert Schema.
 *
 * Zero hardcoded breaches, zero static JSON fallbacks, and zero synthetic randomness.
 * Every governance breach must carry `{ odooModel, odooDomain, period, odooRecordUrl, computedValue, adminThreshold }`
 * where `adminThreshold` comes exclusively from admin-saved server settings.
 */

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
import type { SocialCampaign } from '@/lib/aether/social-campaigns'

export const GOVERNANCE_STORAGE_KEY = 'vf.governance.store.v2'
export const MANAGER_PIN_HASH_KEY = 'vf.executive.pinHash.v1'
export const EXEC_SESSION_STORAGE_KEY = 'vf.executive.session.v1'
export const GOVERNANCE_UPDATED_EVENT = 'aether:governance-updated'

/** 15-minute Executive Session TTL */
export const EXEC_SESSION_TTL_MS = 15 * 60 * 1000

export const EXECUTIVE_GOVERNANCE_ROLES: readonly ExecApproverRole[] = [
  'admin',
  'gm',
  'dgm',
  'cfo',
  'ops',
] as const

export function isExecutiveGovernanceRole(role: unknown): role is ExecApproverRole {
  return (
    typeof role === 'string' &&
    (EXECUTIVE_GOVERNANCE_ROLES as readonly string[]).includes(role)
  )
}

const PIN_SALT_PREFIX = 'vf-aether-exec-seal-v1::'

let deterministicSeq = 0
function nextDeterministicSuffix(tag: string): string {
  deterministicSeq = (deterministicSeq + 1) % 9000
  const input = `${tag}:${Date.now()}:${deterministicSeq}`
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return String(1000 + ((h >>> 0) % 9000))
}

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

export async function changeManagerPin(
  currentPin: string,
  newPin: string,
): Promise<{ ok: boolean; errorAr?: string; errorEn?: string }> {
  const currentClean = currentPin.trim()
  const trimmedNext = newPin.trim()
  if (!/^\d{4}$/.test(currentClean) || !/^\d{4}$/.test(trimmedNext)) {
    return {
      ok: false,
      errorAr: 'يجب أن يتكون الرمز من ٤ أرقام',
      errorEn: 'PIN must be exactly 4 digits',
    }
  }
  if (typeof window === 'undefined') {
    return { ok: false, errorAr: 'تعذر حفظ الرمز', errorEn: 'Could not persist the PIN' }
  }
  try {
    const res = await fetch('/api/erp/governance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'changePin', currentPin: currentClean, newPin: trimmedNext }),
      cache: 'no-store',
    })
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; valid?: boolean }
    if (!res.ok || !json.ok || json.valid === false) {
      return {
        ok: false,
        errorAr: 'رمز المدير الحالي غير صحيح',
        errorEn: 'Current Manager PIN is incorrect',
      }
    }
    window.localStorage.setItem(MANAGER_PIN_HASH_KEY, hashManagerPin(trimmedNext))
    emitGovernanceSync()
    return { ok: true }
  } catch {
    return {
      ok: false,
      errorAr: 'تعذر حفظ الرمز الجديد',
      errorEn: 'Could not persist the new PIN',
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

/**
 * Mandatory server-backed Odoo governance breach schema:
 * Every breach MUST come from a real Odoo query evaluated against an admin-saved server threshold.
 */
export interface ComplianceBreachItem {
  id: string
  category: BreachCategory
  severity: 'critical' | 'high'
  /** Mandatory live Odoo provenance fields */
  odooModel: string
  odooDomain: unknown[]
  period: { from: string; to: string }
  odooRecordUrl: string
  computedValue: number
  adminThreshold: number
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

export interface GovernanceAdminThresholdRule {
  enabled: boolean
  thresholdValue: number
  odooModel: 'pos.order.line' | 'purchase.order.line' | 'account.move.line'
  updatedAtIso: string
  updatedBySub: string
  updatedByRole: ExecApproverRole
}

export interface GovernanceAdminThresholds {
  posDiscountPctCap?: GovernanceAdminThresholdRule
  supplierOrderTotalCapKwd?: GovernanceAdminThresholdRule
  aggregatorCommissionPctCap?: GovernanceAdminThresholdRule
}

export interface GovernanceAuditLogEntry {
  id: string
  timestampIso: string
  actorSub: string
  actorRole: ExecApproverRole
  action:
    | 'saveThresholds'
    | 'freezeBreach'
    | 'unfreezeBreach'
    | 'issueCircular'
    | 'approveRequest'
    | 'rejectRequest'
  targetId: string
  confirmedByExecutive: boolean
  summaryAr: string
  summaryEn: string
}

export function isVerifiedOdooGovernanceBreach(
  b: Partial<ComplianceBreachItem> | null | undefined,
): b is ComplianceBreachItem {
  if (!b || typeof b !== 'object') return false
  return Boolean(
    typeof b.id === 'string' &&
      b.id.length > 0 &&
      typeof b.odooModel === 'string' &&
      b.odooModel.trim().length > 0 &&
      Array.isArray(b.odooDomain) &&
      b.period &&
      typeof b.period.from === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(b.period.from) &&
      typeof b.period.to === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(b.period.to) &&
      typeof b.odooRecordUrl === 'string' &&
      /^https?:\/\//i.test(b.odooRecordUrl) &&
      typeof b.computedValue === 'number' &&
      Number.isFinite(b.computedValue) &&
      typeof b.adminThreshold === 'number' &&
      Number.isFinite(b.adminThreshold),
  )
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
  /** Set when backed by a verified live Odoo breach with admin-saved threshold */
  odooRecordUrl?: string
  odooModel?: string
  adminThreshold?: number
  computedValue?: number
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
  adminThresholds?: GovernanceAdminThresholds
  liveBreaches?: ComplianceBreachItem[]
  auditLog?: GovernanceAuditLogEntry[]
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

const LEGACY_HARDCODED_APPROVAL_IDS = new Set<string>([
  'req-mkt-cg-winter-reel',
  'req-plan-tmp-assima-driver',
])

export function createInitialGovernanceStore(): PersistedGovernanceStore {
  return {
    updatedAtIso: new Date(0).toISOString(),
    approvals: [],
    frozenBreachIds: {},
    resolvedBreachIds: {},
    branchReceipts: {},
    issuedCirculars: {},
    adminThresholds: {},
    liveBreaches: [],
    auditLog: [],
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
  const cleanApprovals = Array.isArray(parsed.approvals)
    ? parsed.approvals.filter((a) => a && typeof a === 'object' && !LEGACY_HARDCODED_APPROVAL_IDS.has(a.id))
    : []
  const cleanBreaches = Array.isArray(parsed.liveBreaches)
    ? parsed.liveBreaches.filter((b) => isVerifiedOdooGovernanceBreach(b))
    : []
  const cleanAuditLog = Array.isArray(parsed.auditLog)
    ? parsed.auditLog.filter((e) => e && typeof e === 'object' && typeof e.id === 'string')
    : []

  return {
    updatedAtIso: typeof parsed.updatedAtIso === 'string' ? parsed.updatedAtIso : base.updatedAtIso,
    approvals: cleanApprovals,
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
        ? parsed.branchReceipts
        : {},
    issuedCirculars:
      parsed.issuedCirculars && typeof parsed.issuedCirculars === 'object'
        ? parsed.issuedCirculars
        : {},
    adminThresholds:
      parsed.adminThresholds && typeof parsed.adminThresholds === 'object'
        ? parsed.adminThresholds
        : {},
    liveBreaches: cleanBreaches,
    auditLog: cleanAuditLog,
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

  // Server (`remote`) is strictly authoritative for adminThresholds, liveBreaches, and auditLog
  const mergedThresholds: GovernanceAdminThresholds = {
    ...(local.adminThresholds ?? {}),
    ...(remote.adminThresholds ?? {}),
  }
  const mergedLiveBreaches = remote.liveBreaches ?? local.liveBreaches ?? []

  const auditMap = new Map<string, GovernanceAuditLogEntry>()
  for (const entry of [...(local.auditLog ?? []), ...(remote.auditLog ?? [])]) {
    if (entry?.id) auditMap.set(entry.id, entry)
  }
  const mergedAuditLog = Array.from(auditMap.values())
    .sort((a, b) => (Date.parse(b.timestampIso) || 0) - (Date.parse(a.timestampIso) || 0))
    .slice(0, 200)

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
    adminThresholds: mergedThresholds,
    liveBreaches: mergedLiveBreaches,
    auditLog: mergedAuditLog,
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

export async function pushGovernanceStoreToServer(
  store: PersistedGovernanceStore,
): Promise<PersistedGovernanceStore | null> {
  if (typeof window === 'undefined' || isReadOnlyAuditorDom()) return null
  try {
    const res = await fetch('/api/erp/governance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      ok?: boolean
      store?: PersistedGovernanceStore
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

export async function pushGovernancePatchToServer(
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === 'undefined' || isReadOnlyAuditorDom()) {
    return { ok: false, error: 'Read-only session' }
  }
  try {
    const res = await fetch('/api/erp/governance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      store?: PersistedGovernanceStore
    }
    if (res.ok && json?.ok && json.store) {
      saveGovernanceStore(json.store, { skipRemotePush: true })
      return { ok: true }
    }
    return { ok: false, error: json?.error ?? 'Governance patch rejected' }
  } catch {
    return { ok: false, error: 'Network error' }
  }
}

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
      initialEmpty?: boolean
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
    if (
      !isReadOnlyAuditorDom() &&
      json.initialEmpty &&
      (currentLocal.approvals.length > 0 ||
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
  const suffix = nextDeterministicSuffix(String(role ?? 'exec'))
  const approverRole = toExecApproverRole(role)
  const profile = resolveExecRoleProfile(approverRole)
  return {
    sealId: `VF-SEAL-${now.getUTCFullYear()}-${suffix}`,
    approvedAtIso: now.toISOString(),
    approverRole,
    approverRoleAr: profile.approverRoleAr,
    approverRoleEn: profile.approverRoleEn,
    approvedByAr: profile.sealAuthorityAr,
    approvedByEn: profile.sealAuthorityEn,
  }
}

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
        : `req-${Date.now()}-${nextDeterministicSuffix(input.refKey)}`,
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

export function flagDecisionRegressionInStore(
  input: Omit<FlaggedDecisionRegression, 'flaggedAtIso'>,
): void {
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

/**
 * Evaluates server-verified Odoo breaches strictly against admin-saved thresholds on the server.
 * Zero hardcoded breaches: returns `[]` (`0` breaches) unless `/api/erp/governance` computed
 * a real Odoo violation carrying `{ odooModel, odooDomain, period, odooRecordUrl, computedValue, adminThreshold }`.
 */
export function evaluateLiveOdooBreaches(
  store: PersistedGovernanceStore,
  _extraCampaigns?: SocialCampaign[],
): ComplianceBreachItem[] {
  const thresholds = store.adminThresholds ?? {}
  const hasEnabledThreshold = Boolean(
    thresholds.posDiscountPctCap?.enabled ||
      thresholds.supplierOrderTotalCapKwd?.enabled ||
      thresholds.aggregatorCommissionPctCap?.enabled,
  )
  if (!hasEnabledThreshold) return []

  const serverBreaches = Array.isArray(store.liveBreaches) ? store.liveBreaches : []
  return serverBreaches
    .filter((b) => isVerifiedOdooGovernanceBreach(b) && !store.resolvedBreachIds[b.id])
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
