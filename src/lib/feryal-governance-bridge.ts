/**
 * Feryal Live Governance & Odoo Audit Bridge (`src/lib/feryal-governance-bridge.ts`).
 *
 * Connects `/erp/feryal-ai` & `/erp/feryal` to live server-evaluated Odoo governance breaches
 * and Manager Bell pending approval requests without any static templates or invented numbers.
 */

import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  getBranchLabel,
  getBrandLabel,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalWorkspaceSlice,
} from '@/lib/aether/global-filter-engine'
import {
  computePlanningHubSnapshot,
  INITIAL_STRATEGIC_PHASES,
  sanitizeStrategicPhases,
  STRATEGIC_ROADMAP_STORAGE_KEY,
  type PlanningHubSnapshot,
  type StrategicRoadmapPhase,
} from '@/lib/aether/planning-engine'
import {
  DEFAULT_REGULATION_BRANCH_READINESS,
  INITIAL_REGULATIONS,
  REG_STOP_ORDERS_STORAGE_KEY,
  REGULATIONS_STORAGE_KEY,
  sanitizeRegulations,
  type RegulationPlaybookItem,
} from '@/lib/aether/regulations-engine'
import {
  emitGovernanceSync,
  evaluateLiveOdooBreaches,
  GOVERNANCE_STORAGE_KEY,
  loadGovernanceStore,
  submitApprovalRequest,
  type ComplianceBreachItem,
  type GovernanceApprovalRequest,
  type GovernanceDomain,
  type PersistedGovernanceStore,
} from '@/lib/governance-compliance'
import { feryalPlainText } from '@/components/aether/FeryalStudioMessage'

export type QuickAuditChipId =
  | 'open-violations'
  | 'seven-branch-plan'
  | 'odoo-growth-plan'
  | 'regulatory-readiness'

export interface ExecutiveQuickAuditChip {
  id: QuickAuditChipId
  labelAr: string
  labelEn: string
  badgeAr: string
  badgeEn: string
  tone: 'rose' | 'emerald' | 'amber' | 'sky'
}

export const FERYAL_EXECUTIVE_AUDIT_CHIPS: readonly ExecutiveQuickAuditChip[] = [
  {
    id: 'open-violations',
    labelAr: 'مبيعات أمس حسب الفرع',
    labelEn: 'Yesterday Sales by Branch',
    badgeAr: 'pos.order',
    badgeEn: 'pos.order',
    tone: 'emerald',
  },
  {
    id: 'seven-branch-plan',
    labelAr: 'أعلى 5 أصناف أمس',
    labelEn: 'Top 5 Items Yesterday',
    badgeAr: 'pos.order.line',
    badgeEn: 'pos.order.line',
    tone: 'amber',
  },
  {
    id: 'odoo-growth-plan',
    labelAr: 'إجمالي أوامر الشراء والموردين هذا الشهر',
    labelEn: 'Purchase Orders & Suppliers (MTD)',
    badgeAr: 'purchase.order',
    badgeEn: 'purchase.order',
    tone: 'sky',
  },
  {
    id: 'regulatory-readiness',
    labelAr: 'حركات التحويل المخزني والهدر هذا الشهر',
    labelEn: 'Warehouse Transfers & Scrap (MTD)',
    badgeAr: 'stock.move / stock.scrap',
    badgeEn: 'stock.move / stock.scrap',
    tone: 'rose',
  },
] as const

export interface RegulationCheckpointSummary {
  id: string
  code: string
  titleAr: string
  titleEn: string
  authorityAr: string
  authorityEn: string
  deadlineDate: string
  severity: 'critical' | 'high' | 'standard'
  readyCount: number
  totalBranches: number
  pendingBranchesAr: string[]
  pendingBranchesEn: string[]
  stopOrderActive: boolean
  penaltyAvoidedKwd: number
}

export interface FeryalGovernanceSnapshot {
  store: PersistedGovernanceStore
  activeBreaches: ComplianceBreachItem[]
  frozenBreaches: ComplianceBreachItem[]
  totalMonthlyBleedKwd: number
  pendingApprovals: GovernanceApprovalRequest[]
  approvedDecisions: GovernanceApprovalRequest[]
  issuedCircularsCount: number
  phases: StrategicRoadmapPhase[]
  planning90d: PlanningHubSnapshot
  planReceiptSummary: {
    totalConfirmedSlots: number
    totalSlots: number
    readinessPct: number
    pendingByPhase: Array<{
      phaseCode: string
      titleAr: string
      titleEn: string
      confirmedCount: number
      pendingAr: string[]
      pendingEn: string[]
    }>
  }
  regulations: RegulationCheckpointSummary[]
  regulatoryReadinessPct: number
  regulatoryReadySlots: number
  regulatoryTotalSlots: number
  totalPenaltiesShieldedKwd: number
}

const f1 = (n: number) =>
  (Math.round((Number.isFinite(n) ? n : 0) * 10) / 10).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

function readStoredPhases(): StrategicRoadmapPhase[] {
  if (typeof window === 'undefined') return INITIAL_STRATEGIC_PHASES
  try {
    const raw = window.localStorage.getItem(STRATEGIC_ROADMAP_STORAGE_KEY)
    if (raw) return sanitizeStrategicPhases(JSON.parse(raw))
  } catch {
    // ignore storage read error
  }
  return INITIAL_STRATEGIC_PHASES
}

function readStoredRegulations(): {
  items: RegulationPlaybookItem[]
  stopped: Record<string, string>
} {
  if (typeof window === 'undefined') {
    return { items: INITIAL_REGULATIONS, stopped: {} }
  }
  let items = INITIAL_REGULATIONS
  let stopped: Record<string, string> = {}
  try {
    const raw = window.localStorage.getItem(REGULATIONS_STORAGE_KEY)
    if (raw) items = sanitizeRegulations(JSON.parse(raw))
  } catch {
    // ignore storage read error
  }
  try {
    const rawStop = window.localStorage.getItem(REG_STOP_ORDERS_STORAGE_KEY)
    if (rawStop) stopped = JSON.parse(rawStop) as Record<string, string>
  } catch {
    // ignore storage read error
  }
  return { items, stopped }
}

export function readLiveGovernanceSnapshot(
  workspace: GlobalWorkspaceSlice,
): FeryalGovernanceSnapshot {
  const store = loadGovernanceStore()
  const allBreaches = evaluateLiveOdooBreaches(store)
  const activeBreaches = allBreaches.filter((b) => !b.frozen)
  const frozenBreaches = allBreaches.filter((b) => b.frozen)
  const totalMonthlyBleedKwd = activeBreaches.reduce(
    (sum, b) =>
      sum + (b.breachKind === 'procedural-cap-overrun' ? 0 : Math.max(0, b.monthlyLeakKwd)),
    0,
  )

  const pendingApprovals = store.approvals.filter((a) => a.status === 'pending')
  const approvedDecisions = store.approvals.filter((a) => a.status === 'approved')
  const issuedCircularsCount = Object.keys(store.issuedCirculars ?? {}).length

  const phases = readStoredPhases()
  const planning90d = computePlanningHubSnapshot(
    workspace,
    phases,
    '90d',
    '2026-11-15',
    '2027-02-15',
  )

  const masterFallback = store.branchReceipts['plan:master-q4'] ?? {}
  let planConfirmedSlots = 0
  const planTotalSlots = Math.max(1, phases.length * APPROVED_BRANCH_IDS.length)
  const pendingByPhase = phases.map((p) => {
    const map = store.branchReceipts[`plan-circular:${p.id}`] ?? masterFallback
    const pendingAr: string[] = []
    const pendingEn: string[] = []
    let confirmedCount = 0
    for (const br of APPROVED_BRANCH_IDS) {
      if (map[br]) {
        confirmedCount += 1
        planConfirmedSlots += 1
      } else {
        pendingAr.push(getBranchLabel(br, true))
        pendingEn.push(getBranchLabel(br, false))
      }
    }
    return {
      phaseCode: p.phaseCode,
      titleAr: p.titleAr,
      titleEn: p.titleEn,
      confirmedCount,
      pendingAr,
      pendingEn,
    }
  })

  const { items: rawRegs, stopped } = readStoredRegulations()
  let regulatoryReadySlots = 0
  const regulatoryTotalSlots = Math.max(1, rawRegs.length * APPROVED_BRANCH_IDS.length)
  let totalPenaltiesShieldedKwd = 0

  const regulations: RegulationCheckpointSummary[] = rawRegs.map((reg) => {
    totalPenaltiesShieldedKwd += reg.penaltyAvoidedKwd
    const map =
      store.branchReceipts[`reg-ready:${reg.id}`] ??
      DEFAULT_REGULATION_BRANCH_READINESS[reg.id] ??
      {}
    const pendingBranchesAr: string[] = []
    const pendingBranchesEn: string[] = []
    let readyCount = 0
    for (const br of APPROVED_BRANCH_IDS) {
      if (map[br]) {
        readyCount += 1
        regulatoryReadySlots += 1
      } else {
        pendingBranchesAr.push(getBranchLabel(br, true))
        pendingBranchesEn.push(getBranchLabel(br, false))
      }
    }
    return {
      id: reg.id,
      code: reg.code,
      titleAr: reg.titleAr,
      titleEn: reg.titleEn,
      authorityAr: reg.authorityAr,
      authorityEn: reg.authorityEn,
      deadlineDate: reg.deadlineDate,
      severity: reg.severity,
      readyCount,
      totalBranches: APPROVED_BRANCH_IDS.length,
      pendingBranchesAr,
      pendingBranchesEn,
      stopOrderActive: Boolean(stopped[reg.id]),
      penaltyAvoidedKwd: reg.penaltyAvoidedKwd,
    }
  })

  const regulatoryReadinessPct =
    rawRegs.length > 0 ? Math.round((regulatoryReadySlots / regulatoryTotalSlots) * 100) : 0

  return {
    store,
    activeBreaches,
    frozenBreaches,
    totalMonthlyBleedKwd,
    pendingApprovals,
    approvedDecisions,
    issuedCircularsCount,
    phases,
    planning90d,
    planReceiptSummary: {
      totalConfirmedSlots: planConfirmedSlots,
      totalSlots: planTotalSlots,
      readinessPct: phases.length > 0 ? Math.round((planConfirmedSlots / planTotalSlots) * 100) : 0,
      pendingByPhase,
    },
    regulations,
    regulatoryReadinessPct,
    regulatoryReadySlots,
    regulatoryTotalSlots,
    totalPenaltiesShieldedKwd,
  }
}

export function buildFeryalGovernancePromptContext(
  snap: FeryalGovernanceSnapshot,
  workspace: GlobalWorkspaceSlice,
  lang: 'ar' | 'en',
): string {
  if (snap.activeBreaches.length === 0) {
    return lang === 'ar'
      ? `النطاق النشط: ${workspace.subtitleAr} — لا توجد مخالفات رقابية نشطة مسجلة من Odoo حالياً.`
      : `Active Scope: ${workspace.subtitleEn} — Zero active Odoo governance breaches.`
  }

  if (lang === 'en') {
    return snap.activeBreaches
      .map((b) => `- [${b.odooModel}] ${b.breachHeadlineEn} (${b.odooMetricProofEn})`)
      .join('\n')
  }

  return snap.activeBreaches
    .map((b) => `- [${b.odooModel}] ${b.breachHeadlineAr} (${b.odooMetricProofAr})`)
    .join('\n')
}

export function buildQuickAuditChipPrompt(
  chipId: QuickAuditChipId,
  _snap: FeryalGovernanceSnapshot,
  _workspace: GlobalWorkspaceSlice,
  _isAr: boolean,
): string {
  switch (chipId) {
    case 'open-violations':
      return 'مبيعات أمس حسب الفرع'
    case 'seven-branch-plan':
      return 'أعلى 5 أصناف أمس'
    case 'odoo-growth-plan':
      return 'إجمالي أوامر الشراء والموردين هذا الشهر'
    case 'regulatory-readiness':
      return 'حركات التحويل المخزني والهدر هذا الشهر'
  }
}

export interface ExtractedFeryalRecommendation {
  refKey: string
  domain: GovernanceDomain
  titleAr: string
  titleEn: string
  targetScopeAr: string
  targetScopeEn: string
  departmentAr: string
  departmentEn: string
  budgetOrCostKwd: number
  conservativeMonthlyReturnKwd: number
  complianceRuleAr: string
  complianceRuleEn: string
  summaryAr: string
  summaryEn: string
}

function stableShortHash(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36).slice(0, 7)
}

function normalizeArabicDigits(str: string): string {
  return str.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

function extractVerifiedKwdFromReply(text: string): {
  monthlyReturnKwd: number
  costCapKwd: number
} {
  const norm = normalizeArabicDigits(text)
  const matches: number[] = []
  const kwdRegex = /([+-]?\d{1,3}(?:,\d{3})+|[+-]?\d+)(?:\.\d+)?\s*(?:د\.ك|دينار|KWD)/gi
  let m: RegExpExecArray | null
  while ((m = kwdRegex.exec(norm)) !== null) {
    const val = Math.abs(Number(m[0].replace(/[^\d.]/g, '')))
    if (Number.isFinite(val) && val > 0) {
      matches.push(Math.round(val * 10) / 10)
    }
  }

  // Zero invented fallback: if no explicit KWD figure is in the reply, return 0
  const monthlyReturnKwd = matches.length > 0 ? matches[0] : 0
  return { monthlyReturnKwd, costCapKwd: 0 }
}

function inferDomainAndRule(combinedText: string): {
  domain: GovernanceDomain
  deptAr: string
  deptEn: string
  ruleAr: string
  ruleEn: string
} {
  const t = combinedText.toLowerCase()
  if (/purchase\.order|مورد|مشتريات|أمر شراء|اوامر الشراء/.test(t)) {
    return {
      domain: 'operations',
      deptAr: 'إدارة المشتريات ومخزن العارضية',
      deptEn: 'Procurement & Ardiya Warehouse',
      ruleAr: 'مطابقة أوامر الشراء المؤكدة في purchase.order مع سندات الاستلام',
      ruleEn: 'Reconcile confirmed purchase.order records against warehouse receipts',
    }
  }
  if (/stock\.move|stock\.scrap|مخزن|تحويل|هدر|إتلاف/.test(t)) {
    return {
      domain: 'operations',
      deptAr: 'المخزون وسلسلة الإمداد',
      deptEn: 'Inventory & Supply Chain',
      ruleAr: 'متابعة حركات التحويل المخزني وأوامر الإتلاف في stock.move وstock.scrap',
      ruleEn: 'Monitor warehouse transfers and scrap entries in stock.move and stock.scrap',
    }
  }
  if (/account\.move\.line|دفتر الأستاذ|ذمم|قيود/.test(t)) {
    return {
      domain: 'planning',
      deptAr: 'الإدارة المالية والمحاسبة',
      deptEn: 'Finance & Accounting',
      ruleAr: 'مطابقة قيود اليومية المرحلة في account.move.line',
      ruleEn: 'Verify posted ledger entries in account.move.line',
    }
  }
  return {
    domain: 'growth-play',
    deptAr: 'العمليات الميدانية ونقاط البيع',
    deptEn: 'Field Operations & POS',
    ruleAr: 'متابعة مؤشرات المبيعات والأصناف في Odoo (pos.order / pos.order.line)',
    ruleEn: 'Track live sales and item performance in Odoo (pos.order / pos.order.line)',
  }
}

function inferWhitelistedScope(
  combinedText: string,
  workspace: GlobalWorkspaceSlice,
): { scopeAr: string; scopeEn: string } {
  const partsAr: string[] = []
  const partsEn: string[] = []

  if (workspace.filters.brand !== 'all') {
    partsAr.push(getBrandLabel(workspace.filters.brand, true))
    partsEn.push(getBrandLabel(workspace.filters.brand, false))
  } else {
    for (const br of APPROVED_BRAND_IDS as readonly GlobalBrand[]) {
      const ar = getBrandLabel(br, true)
      const en = getBrandLabel(br, false)
      if (combinedText.includes(ar) || combinedText.toLowerCase().includes(en.toLowerCase())) {
        partsAr.push(ar)
        partsEn.push(en)
        if (partsAr.length >= 2) break
      }
    }
  }

  const branchAr: string[] = []
  const branchEn: string[] = []
  if (workspace.filters.branch !== 'all') {
    branchAr.push(getBranchLabel(workspace.filters.branch, true))
    branchEn.push(getBranchLabel(workspace.filters.branch, false))
  } else {
    for (const loc of APPROVED_BRANCH_IDS as readonly Exclude<GlobalBranch, 'all'>[]) {
      const ar = getBranchLabel(loc, true)
      const en = getBranchLabel(loc, false)
      if (combinedText.includes(ar) || combinedText.toLowerCase().includes(en.toLowerCase())) {
        branchAr.push(ar)
        branchEn.push(en)
        if (branchAr.length >= 2) break
      }
    }
  }

  if (partsAr.length === 0 && branchAr.length === 0) {
    return {
      scopeAr: 'الفروع السبعة المعتمدة',
      scopeEn: 'All 7 Approved Branches',
    }
  }

  return {
    scopeAr: [...partsAr, ...branchAr].join(' · '),
    scopeEn: [...partsEn, ...branchEn].join(' · '),
  }
}

export function extractFeryalRecommendationMeta(
  replyText: string,
  userQuery: string | undefined,
  workspace: GlobalWorkspaceSlice,
): ExtractedFeryalRecommendation {
  const cleanReply = feryalPlainText(replyText)
  const combined = `${userQuery ?? ''}\n${cleanReply}`
  const { domain, deptAr, deptEn, ruleAr, ruleEn } = inferDomainAndRule(combined)
  const { scopeAr, scopeEn } = inferWhitelistedScope(combined, workspace)
  const { monthlyReturnKwd, costCapKwd } = extractVerifiedKwdFromReply(cleanReply)

  const rawPromptHeadline = (userQuery ?? '').replace(/\s+/g, ' ').trim().slice(0, 78)
  const titleAr = rawPromptHeadline
    ? `متابعة توصية فريال: ${rawPromptHeadline}`
    : `متابعة توصية فريال (${scopeAr})`
  const titleEn = rawPromptHeadline
    ? `Follow-up Feryal Action: ${rawPromptHeadline}`
    : `Follow-up Feryal Action (${scopeEn})`

  const summaryAr = `النطاق: ${scopeAr} • الرقابة: ${ruleAr}`
  const summaryEn = `Scope: ${scopeEn} • Control: ${ruleEn}`
  const refKey = `feryal-rec:${stableShortHash(`${userQuery ?? ''}::${cleanReply.slice(0, 240)}`)}`

  return {
    refKey,
    domain,
    titleAr,
    titleEn,
    targetScopeAr: scopeAr,
    targetScopeEn: scopeEn,
    departmentAr: deptAr,
    departmentEn: deptEn,
    budgetOrCostKwd: costCapKwd,
    conservativeMonthlyReturnKwd: monthlyReturnKwd,
    complianceRuleAr: ruleAr,
    complianceRuleEn: ruleEn,
    summaryAr,
    summaryEn,
  }
}

export function submitFeryalRecommendationToBell(
  meta: ExtractedFeryalRecommendation,
): GovernanceApprovalRequest {
  const created = submitApprovalRequest({
    refKey: meta.refKey,
    domain: meta.domain,
    titleAr: meta.titleAr,
    titleEn: meta.titleEn,
    summaryAr: meta.summaryAr,
    summaryEn: meta.summaryEn,
    departmentAr: meta.departmentAr,
    departmentEn: meta.departmentEn,
    budgetOrCostKwd: meta.budgetOrCostKwd,
    expectedMonthlyReturnKwd: meta.conservativeMonthlyReturnKwd,
    href: '/erp/feryal-ai',
  })

  if (typeof window !== 'undefined') {
    emitGovernanceSync()
    try {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: GOVERNANCE_STORAGE_KEY,
          newValue: window.localStorage.getItem(GOVERNANCE_STORAGE_KEY),
        }),
      )
    } catch {
      // ignore storage event error
    }
  }

  return created
}

export function formatFeryalExecutiveSummary(
  replyText: string,
  meta: ExtractedFeryalRecommendation,
  workspace: GlobalWorkspaceSlice,
  isAr: boolean,
): string {
  const cleanBody = feryalPlainText(replyText)

  if (!isAr) {
    return [
      `EXECUTIVE SUMMARY — VENTURE FOODS (ASK FERYAL)`,
      `• Topic: ${meta.titleEn}`,
      `• Scope: ${meta.targetScopeEn} (${workspace.subtitleEn})`,
      ...(meta.conservativeMonthlyReturnKwd > 0
        ? [`• Referenced Odoo Figure: ${f1(meta.conservativeMonthlyReturnKwd)} KWD`]
        : []),
      `• Odoo Control: ${meta.complianceRuleEn}`,
      ``,
      cleanBody,
    ].join('\n')
  }

  return [
    `ملخص تنفيذي — شركة فنتشر فودز (المستشارة فريال)`,
    `• الموضوع: ${meta.titleAr}`,
    `• النطاق: ${meta.targetScopeAr} (${workspace.subtitleAr})`,
    ...(meta.conservativeMonthlyReturnKwd > 0
      ? [`• الرقم المرجعي من Odoo: ${f1(meta.conservativeMonthlyReturnKwd)} د.ك`]
      : []),
    `• الرقابة في Odoo: ${meta.complianceRuleAr}`,
    ``,
    cleanBody,
  ].join('\n')
}

export function buildGovernanceAwareFallbackReply(
  query: string,
  _snap: FeryalGovernanceSnapshot,
  _workspace: GlobalWorkspaceSlice,
  _lang: 'ar' | 'en',
): string {
  if (/منافس|competitor|rival/i.test(query)) {
    return 'لا أعرف'
  }
  return 'لا أملك بيانات من Odoo عن هذا'
}
