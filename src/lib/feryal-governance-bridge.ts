/**
 * Feryal Live Governance, Strategic Planning & Regulatory Intelligence Bridge
 * (`src/lib/feryal-governance-bridge.ts`).
 *
 * Strictly read-only / event-driven bridge connecting `/erp/feryal` (`Ask Feryal`) to:
 *   1. Live Manager Bell & Odoo 17 Compliance Watchdog (`governance-compliance.ts`)
 *   2. Phased Strategic Roadmap & 3-Scenario Forecasts (`planning-engine.ts`)
 *   3. Kuwait F&B Regulations & 7-Branch Readiness Checkpoints (`regulations-engine.ts`)
 *   4. 1-Click `رفع التوصية لجرس المدير 🔔` (`pending` approval submission) & Executive Memo Copy
 *
 * Preserves strict Venture Foods 6-Brand & 7-Branch (+ EXB) entity whitelist and CFO conservatism.
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
  sanitizeStrategicPhases,
  SEEDED_STRATEGIC_PHASES,
  STRATEGIC_ROADMAP_STORAGE_KEY,
  type PlanningHubSnapshot,
  type StrategicRoadmapPhase,
} from '@/lib/aether/planning-engine'
import {
  DEFAULT_REGULATION_BRANCH_READINESS,
  REG_STOP_ORDERS_STORAGE_KEY,
  REGULATIONS_STORAGE_KEY,
  sanitizeRegulations,
  SEEDED_REGULATIONS,
  type RegulationPlaybookItem,
} from '@/lib/aether/regulations-engine'
import {
  emitGovernanceSync,
  evaluateLiveOdooBreaches,
  GOVERNANCE_STORAGE_KEY,
  GOVERNANCE_UPDATED_EVENT,
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
    labelAr: 'كشف المخالفات المفتوحة اليوم 🚨',
    labelEn: 'Audit Open Violations Today 🚨',
    badgeAr: 'رقابة أودو الحية',
    badgeEn: 'Live Odoo Watchdog',
    tone: 'rose',
  },
  {
    id: 'seven-branch-plan',
    labelAr: 'تقييم التزام الفروع السبعة بالخطة 📊',
    labelEn: '7-Branch Plan Compliance Audit 📊',
    badgeAr: 'التخطيط والتعميم',
    badgeEn: 'Planning & Circulars',
    tone: 'emerald',
  },
  {
    id: 'odoo-growth-plan',
    labelAr: 'بناء خطة نمو من أرقام أودو 📈',
    labelEn: 'Build Growth Plan from Odoo 📈',
    badgeAr: 'رفع صافي الكاش',
    badgeEn: 'Net Cash Growth',
    tone: 'amber',
  },
  {
    id: 'regulatory-readiness',
    labelAr: 'مراجعة جاهزية التشريعات الرقابية ⚖️',
    labelEn: 'Review Regulatory Readiness ⚖️',
    badgeAr: 'البلدية والتجارة وPAM',
    badgeEn: 'PAFN, PAM & MOCI',
    tone: 'sky',
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

const f0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')

function readStoredPhases(): StrategicRoadmapPhase[] {
  if (typeof window === 'undefined') return SEEDED_STRATEGIC_PHASES
  try {
    const raw = window.localStorage.getItem(STRATEGIC_ROADMAP_STORAGE_KEY)
    if (raw) return sanitizeStrategicPhases(JSON.parse(raw))
  } catch {}
  return SEEDED_STRATEGIC_PHASES
}

function readStoredRegulations(): {
  items: RegulationPlaybookItem[]
  stopped: Record<string, string>
} {
  if (typeof window === 'undefined') {
    return { items: SEEDED_REGULATIONS, stopped: {} }
  }
  let items = SEEDED_REGULATIONS
  let stopped: Record<string, string> = {}
  try {
    const raw = window.localStorage.getItem(REGULATIONS_STORAGE_KEY)
    if (raw) items = sanitizeRegulations(JSON.parse(raw))
  } catch {}
  try {
    const rawStop = window.localStorage.getItem(REG_STOP_ORDERS_STORAGE_KEY)
    if (rawStop) stopped = JSON.parse(rawStop) as Record<string, string>
  } catch {}
  return { items, stopped }
}

/**
 * Reads live Governance, Strategic Planning, Odoo Breach Watchdog, and Kuwait Regulatory
 * state synchronously from `localStorage` + seeded Venture Foods engines.
 */
export function readLiveGovernanceSnapshot(
  workspace: GlobalWorkspaceSlice,
): FeryalGovernanceSnapshot {
  const store = loadGovernanceStore()
  const allBreaches = evaluateLiveOdooBreaches(store)
  const activeBreaches = allBreaches.filter((b) => !b.frozen)
  const frozenBreaches = allBreaches.filter((b) => b.frozen)
  const totalMonthlyBleedKwd = activeBreaches.reduce(
    (sum, b) => sum + (b.breachKind === 'procedural-cap-overrun' ? 0 : Math.max(0, b.monthlyLeakKwd)),
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

  // Compute 7-branch circular receipt status across strategic phases (fallback to master Q4 receipt map)
  const masterFallback = store.branchReceipts['plan:master-q4'] ?? {}
  let planConfirmedSlots = 0
  const planTotalSlots = Math.max(1, phases.length * APPROVED_BRANCH_IDS.length)
  const pendingByPhase = phases.map((p, idx) => {
    const map =
      store.branchReceipts[`plan-circular:${p.id}`] ??
      (idx === 0 ? masterFallback : masterFallback)
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

  const regulatoryReadinessPct = Math.round((regulatoryReadySlots / regulatoryTotalSlots) * 100)

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
      readinessPct: Math.round((planConfirmedSlots / planTotalSlots) * 100),
      pendingByPhase,
    },
    regulations,
    regulatoryReadinessPct,
    regulatoryReadySlots,
    regulatoryTotalSlots,
    totalPenaltiesShieldedKwd,
  }
}

/**
 * Builds the structured live executive context injected into Feryal's prompt across
 * Triple Brain, Claude Sonnet 5.5 / Opus 5.5, Gemini Carbon High, and Grok 4.20.
 */
export function buildFeryalGovernancePromptContext(
  snap: FeryalGovernanceSnapshot,
  workspace: GlobalWorkspaceSlice,
  lang: 'ar' | 'en',
): string {
  const realistic90 =
    snap.planning90d.scenarios.find((s) => s.id === 'realistic') ?? snap.planning90d.scenarios[0]

  if (lang === 'en') {
    const breachLines =
      snap.activeBreaches.length > 0
        ? snap.activeBreaches
            .map(
              (b, i) =>
                `  ${i + 1}. [${b.severity.toUpperCase()}] ${b.breachHeadlineEn} | Scope: ${b.affectedScopeEn} | Leak: -${f0(b.monthlyLeakKwd)} KWD/mo | Rule: ${b.approvedRuleLimitEn} | Proof: ${b.odooMetricProofEn}`,
            )
            .join('\n')
        : '  - Zero active unfrozen violations (all rules compliant).'

    const pendingLines =
      snap.pendingApprovals.length > 0
        ? snap.pendingApprovals
            .slice(0, 6)
            .map(
              (a, i) =>
                `  ${i + 1}. [${a.domain}] ${a.titleEn} | Cost Cap: ${f0(a.budgetOrCostKwd)} KWD | Expected Return: +${f0(a.expectedMonthlyReturnKwd)} KWD/mo`,
            )
            .join('\n')
        : '  - No pending items waiting in Manager Bell.'

    const phaseLines = snap.phases
      .slice(0, 5)
      .map(
        (p) =>
          `  - ${p.phaseCode}: ${p.titleEn} (${p.startDate} -> ${p.endDate}) | Owner: ${p.ownerEn} | Cap: ${f0(p.costCapKwd)} KWD | Target Return: +${f0(p.expectedMonthlyGainKwd)} KWD/mo`,
      )
      .join('\n')

    const regLines = snap.regulations
      .map(
        (r) =>
          `  - ${r.code} (${r.authorityEn}, Deadline ${r.deadlineDate}): ${r.readyCount}/${r.totalBranches} branches verified${
            r.pendingBranchesEn.length > 0 ? ` | Pending: ${r.pendingBranchesEn.join(', ')}` : ' | 100% Complete'
          }`,
      )
      .join('\n')

    return [
      workspace.feryalContextEn,
      `<feryal_live_governance_context>`,
      `Active Scope: ${workspace.subtitleEn} | Net Sales: ${f0(workspace.salesKwd)} KWD | Orders: ${f0(workspace.orders)} | Weighted Net Margin: ${workspace.weightedNetPct.toFixed(1)}%`,
      `1) ACTIVE ODOO 17 COMPLIANCE VIOLATIONS (${snap.activeBreaches.length} open, Total Bleed: -${f0(snap.totalMonthlyBleedKwd)} KWD/mo, Frozen: ${snap.frozenBreaches.length}):`,
      breachLines,
      `2) PENDING MANAGER BELL APPROVALS (${snap.pendingApprovals.length} pending, ${snap.approvedDecisions.length} sealed, ${snap.issuedCircularsCount} official circulars):`,
      pendingLines,
      `3) STRATEGIC ROADMAP & 90-DAY REALISTIC FORECAST (Sales ${f0(realistic90.projectedSalesKwd)} KWD - Costs ${f0(realistic90.projectedCostsKwd)} KWD = Net Cash +${f0(realistic90.projectedNetCashKwd)} KWD, Branch Plan Ack: ${snap.planReceiptSummary.readinessPct}%):`,
      phaseLines,
      `4) KUWAIT F&B REGULATORY READINESS (${snap.regulatoryReadinessPct}% — ${snap.regulatoryReadySlots}/${snap.regulatoryTotalSlots} checkpoints verified, Fines Shielded: ${f0(snap.totalPenaltiesShieldedKwd)} KWD):`,
      regLines,
      `CFO MANDATE: Cite exact KWD numbers, name specific Venture Foods branches/brands, give realistic conservative monthly KWD upside (94–97% price retention, <=3.0% POS promo cap, 15% TMP vs 25% Tgo), and end with a clear rule ready for Manager Bell approval.`,
      `</feryal_live_governance_context>`,
    ].join('\n')
  }

  const breachLinesAr =
    snap.activeBreaches.length > 0
      ? snap.activeBreaches
          .map(
            (b, i) =>
              `  ${i + 1}. ${b.breachHeadlineAr} | النطاق: ${b.affectedScopeAr} | التسرب: -${f0(b.monthlyLeakKwd)} د.ك/شهر | السقف المعتمد: ${b.approvedRuleLimitAr} | إثبات أودو: ${b.odooMetricProofAr}`,
          )
          .join('\n')
      : '  - لا توجد مخالفات نشطة غير مجمدة حالياً.'

  const pendingLinesAr =
    snap.pendingApprovals.length > 0
      ? snap.pendingApprovals
          .slice(0, 6)
          .map(
            (a, i) =>
              `  ${i + 1}. [${a.domain}] ${a.titleAr} | سقف التكلفة: ${f0(a.budgetOrCostKwd)} د.ك | العائد المتوقع: +${f0(a.expectedMonthlyReturnKwd)} د.ك/شهر`,
          )
          .join('\n')
      : '  - لا توجد طلبات معلقة في جرس المدير حالياً.'

  const phaseLinesAr = snap.phases
    .slice(0, 5)
    .map(
      (p) =>
        `  - ${p.phaseCode}: ${p.titleAr} (${p.startDate} ← ${p.endDate}) | المسؤول: ${p.ownerAr} | السقف: ${f0(p.costCapKwd)} د.ك | العائد المستهدف: +${f0(p.expectedMonthlyGainKwd)} د.ك/شهر`,
    )
    .join('\n')

  const regLinesAr = snap.regulations
    .map(
      (r) =>
        `  - ${r.code} (${r.authorityAr}، المهلة ${r.deadlineDate}): ${r.readyCount}/${r.totalBranches} فروع مطابقة${
          r.pendingBranchesAr.length > 0
            ? ` | قيد الاستكمال: ${r.pendingBranchesAr.join('، ')}`
            : ' | مكتمل 100%'
        }`,
    )
    .join('\n')

  return [
    workspace.feryalContextAr,
    `<feryal_live_governance_context>`,
    `النطاق النشط: ${workspace.subtitleAr} | صافي المبيعات: ${f0(workspace.salesKwd)} د.ك | الطلبات: ${f0(workspace.orders)} | صافي الربح الموزون: ${workspace.weightedNetPct.toFixed(1)}%`,
    `١) المخالفات الرقابية المفتوحة في أودو 17 (${snap.activeBreaches.length} نشطة، إجمالي النزيف: -${f0(snap.totalMonthlyBleedKwd)} د.ك/شهر، المجمدة: ${snap.frozenBreaches.length}):`,
    breachLinesAr,
    `٢) طلبات بانتظار موافقة جرس المدير (${snap.pendingApprovals.length} معلقة، ${snap.approvedDecisions.length} معتمدة بختم رقمي، ${snap.issuedCircularsCount} تعاميم رسمية):`,
    pendingLinesAr,
    `٣) خارطة التخطيط وتوقعات 90 يوم للسيناريو الواقعي (المبيعات ${f0(realistic90.projectedSalesKwd)} د.ك - التكاليف ${f0(realistic90.projectedCostsKwd)} د.ك = صافي الكاش +${f0(realistic90.projectedNetCashKwd)} د.ك، التزام استلام الفروع: ${snap.planReceiptSummary.readinessPct}%):`,
    phaseLinesAr,
    `٤) جاهزية التشريعات الرقابية بالكويت (${snap.regulatoryReadinessPct}% — ${snap.regulatoryReadySlots} من ${snap.regulatoryTotalSlots} نقطة مطابقة، غرامات متفاداة: ${f0(snap.totalPenaltiesShieldedKwd)} د.ك):`,
    regLinesAr,
    `توجيه المدير المالي: التزمي بدقة أرقام أودو بالدينار الكويتي، وسمّي الفروع والعلامات المعتمدة فقط، وقدّمي أثراً شهرياً محافظاً قابلاً للرفع المباشر إلى جرس اعتماد المدير 🔔 مع قاعدة رقابة واضحة.`,
    `</feryal_live_governance_context>`,
  ].join('\n')
}

/**
 * Builds a tailored, live-telemetry prompt when the user clicks one of the 4 Executive Quick-Audit Chips.
 */
export function buildQuickAuditChipPrompt(
  chipId: QuickAuditChipId,
  snap: FeryalGovernanceSnapshot,
  workspace: GlobalWorkspaceSlice,
  isAr: boolean,
): string {
  const scope = isAr ? workspace.subtitleAr : workspace.subtitleEn
  const realistic90 =
    snap.planning90d.scenarios.find((s) => s.id === 'realistic') ?? snap.planning90d.scenarios[0]

  switch (chipId) {
    case 'open-violations':
      return isAr
        ? `اكشفي بالتفصيل جميع المخالفات الرقابية المفتوحة اليوم في أودو 17 (${snap.activeBreaches.length} مخالفات نشطة بنزيف -${f0(snap.totalMonthlyBleedKwd)} د.ك/شهر ضمن ${scope})، ورتبيها حسب الأولوية المالية مع أمر الإيقاف والتصحيح الفوري لكل مخالفة.`
        : `Audit all ${snap.activeBreaches.length} open Odoo 17 compliance violations today (-${f0(snap.totalMonthlyBleedKwd)} KWD/mo bleed across ${scope}), rank them by KWD urgency, and give the immediate stop/fix directive for each.`

    case 'seven-branch-plan':
      return isAr
        ? `قيّمي التزام الفروع السبعة ومطبخ العارضية بخارطة التخطيط المعتمدة (${snap.phases.length} مراحل، صافي السيناريو الواقعي 90 يوم +${f0(realistic90.projectedNetCashKwd)} د.ك، نسبة تأكيد الاستلام ${snap.planReceiptSummary.readinessPct}%) وحددي الفروع المتأخرة وخطوات الضبط الفورية.`
        : `Evaluate 7-branch + Ardiya execution compliance against our ${snap.phases.length}-phase strategic plan (90d Realistic Net Cash +${f0(realistic90.projectedNetCashKwd)} KWD, receipt ack ${snap.planReceiptSummary.readinessPct}%) and pinpoint lagging branches and corrective actions.`

    case 'odoo-growth-plan':
      return isAr
        ? `ابني خطة نمو عملية ومحافظة من أرقام أودو الحية لنطاق (${scope} — مبيعات ${f0(workspace.salesKwd)} د.ك وصافي ${workspace.weightedNetPct.toFixed(1)}%) ترفع صافي الكاش عبر تحويل الطلبات القريبة إلى TMP (15%) وهندسة المينيو وموسم الشتاء والرواتب في الكويت.`
        : `Build a conservative, CFO-verified growth plan from live Odoo telemetry for (${scope} — ${f0(workspace.salesKwd)} KWD sales, ${workspace.weightedNetPct.toFixed(1)}% net margin) lifting net cash via TMP 15% fleet shift, menu engineering, and Kuwait payday/winter demand.`

    case 'regulatory-readiness':
      return isAr
        ? `راجعي جاهزية التشريعات الرقابية الأربعة عبر الفروع السبعة (${snap.regulatoryReadinessPct}% مكتمل — ${snap.regulatoryReadySlots} من ${snap.regulatoryTotalSlots} نقطة مطابقة لحماية ${f0(snap.totalPenaltiesShieldedKwd)} د.ك غرامات)، وحددي الفروع المعلقة قبل كل مهلة وخطة الإغلاق السريع.`
        : `Review our Kuwait F&B regulatory readiness across all 7 branches (${snap.regulatoryReadinessPct}% — ${snap.regulatoryReadySlots}/${snap.regulatoryTotalSlots} checkpoints shielding ${f0(snap.totalPenaltiesShieldedKwd)} KWD in fines), listing pending branches per deadline and rapid closure steps.`
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

function extractConservativeKwdNumbers(text: string): {
  monthlyReturnKwd: number
  costCapKwd: number
} {
  const norm = normalizeArabicDigits(text)
  // Look for explicit KWD amounts near monthly gain / saving / impact keywords
  const matches: number[] = []
  const kwdRegex = /([+-]?\d{1,3}(?:,\d{3})+|[+-]?\d{2,6})(?:\.\d+)?\s*(?:د\.ك|دينار|KWD)/gi
  let m: RegExpExecArray | null
  while ((m = kwdRegex.exec(norm)) !== null) {
    const val = Math.abs(Number(m[1].replace(/,/g, '')))
    if (Number.isFinite(val) && val >= 80 && val <= 9500) {
      matches.push(Math.round(val))
    }
  }

  // Pick conservative realistic monthly upside (prefer lower-middle bound among realistic operational levers)
  const operationalCandidates = matches.filter((v) => v >= 150 && v <= 4200)
  const sorted = [...operationalCandidates].sort((a, b) => a - b)
  const monthlyReturnKwd =
    sorted.length > 0 ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.35))] : 490

  // Check if explicit budget / cost cap is mentioned
  const costMatch = norm.match(
    /(?:سقف التكلفة|ميزانية|بتكلفة|cost cap|budget)[:\s]+(\d{1,4}(?:,\d{3})*)\s*(?:د\.ك|دينار|KWD)/i,
  )
  const parsedCost = costMatch ? Number(costMatch[1].replace(/,/g, '')) : 0
  const costCapKwd =
    Number.isFinite(parsedCost) && parsedCost > 0 && parsedCost <= 5000 ? Math.round(parsedCost) : 0

  return { monthlyReturnKwd, costCapKwd }
}

function inferDomainAndRule(
  combinedText: string,
): {
  domain: GovernanceDomain
  deptAr: string
  deptEn: string
  ruleAr: string
  ruleEn: string
} {
  const t = combinedText.toLowerCase()
  if (
    /تشريع|بلدية|غذاء|قوى العاملة|تجارة|إطفاء|pafn|moci|pam|kff|شهادات صحية|مهلة/.test(t)
  ) {
    return {
      domain: 'regulations',
      deptAr: 'الشؤون الرقابية والامتثال والفروع',
      deptEn: 'Regulatory Compliance & Branch Ops',
      ruleAr: 'إغلاق نقاط المطابقة قبل المهلة الإلزامية ومنع أي مخالفة رقابية',
      ruleEn: 'Complete all branch checkpoints ahead of statutory deadline; zero unpermitted ops',
    }
  }
  if (/tmp|tgo|توصيل|طلبات|كيتا|ديليفرو|سائق|عمولة|delivery|rider|aggregator/.test(t)) {
    return {
      domain: 'delivery-radar',
      deptAr: 'عمليات التوصيل والمنصات',
      deptEn: 'Delivery & Aggregator Operations',
      ruleAr: 'أولوية توجيه TMP بعمولة 15% للنطاق القريب وسقف خصومات ≤ 3.0%',
      ruleEn: 'Prioritize 15% TMP fleet for nearby zones & enforce <= 3.0% promo cap',
    }
  }
  if (/بوث|معرض|exb|booth|exhibition/.test(t)) {
    return {
      domain: 'booth-exb',
      deptAr: 'المعارض الموسمية والتشغيل (EXB)',
      deptEn: 'Seasonal Exhibitions (EXB) & Ops',
      ruleAr: 'شرط إيجار البوث ≤ 15% من المبيعات وترخيص بلدية وإطفاء سارٍ',
      ruleEn: 'Strict <= 15% booth rent-to-sales ceiling + valid KFF/Municipality permit',
    }
  }
  if (/مشهور|حملة|إعلان|تسويق|رواتب|باقات|influencer|campaign|promo|marketing/.test(t)) {
    return {
      domain: 'marketing',
      deptAr: 'التسويق وهندسة النمو',
      deptEn: 'Marketing & Growth Engineering',
      ruleAr: 'سقف إعلان ≤ 250 د.ك بدون إذن مسبق وخصم كاشير/منصات ≤ 3.0%',
      ruleEn: 'Pre-approval cap <= 250 KWD ad spend & strict <= 3.0% POS/app discount cap',
    }
  }
  if (/خطة|تخطيط|سيناريو|مرحلة|خارطة|forecast|roadmap|scenario/.test(t)) {
    return {
      domain: 'planning',
      deptAr: 'التخطيط الاستراتيجي والمالي',
      deptEn: 'Strategic Planning & CFO Office',
      ruleAr: 'الالتزام بسقف تكلفة المرحلة وهدر مطبخ العارضية ≤ 1.8%',
      ruleEn: 'Enforce phase cost cap & Ardiya Central Kitchen prep waste <= 1.8%',
    }
  }
  return {
    domain: 'growth-play',
    deptAr: 'التشغيل الميداني ومطبخ العارضية',
    deptEn: 'Field Operations & Ardiya Kitchen',
    ruleAr: 'مراقبة التطبيق عبر أودو 17 (سقف خصم ≤ 3.0% وهدر العارضية ≤ 1.8%)',
    ruleEn: 'Monitored live in Odoo 17 (<= 3.0% promo cap & <= 1.8% Ardiya waste)',
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
      scopeAr: 'الفروع السبعة ومطبخ العارضية المركزي',
      scopeEn: 'All 7 Active Branches & Ardiya Central Kitchen',
    }
  }

  return {
    scopeAr: [...partsAr, ...branchAr].join(' · '),
    scopeEn: [...partsEn, ...branchEn].join(' · '),
  }
}

/**
 * Extracts structured, conservative CFO metadata from any strategic Feryal reply
 * so it can be queued into Manager Bell (`pending`) in 1 click.
 */
export function extractFeryalRecommendationMeta(
  replyText: string,
  userQuery: string | undefined,
  workspace: GlobalWorkspaceSlice,
): ExtractedFeryalRecommendation {
  const cleanReply = feryalPlainText(replyText)
  const combined = `${userQuery ?? ''}\n${cleanReply}`
  const { domain, deptAr, deptEn, ruleAr, ruleEn } = inferDomainAndRule(combined)
  const { scopeAr, scopeEn } = inferWhitelistedScope(combined, workspace)
  const { monthlyReturnKwd, costCapKwd } = extractConservativeKwdNumbers(cleanReply)

  // Derive a clean concise headline from userQuery or first substantive line
  const cleanLines = cleanReply
    .split('\n')
    .map((l) => l.replace(/^[•\-*\d.)\s🔥⚡🔬🧠🚨📊📈⚖️✅📌]+/u, '').trim())
    .filter((l) => l.length >= 12 && !/^(إجماع|triple-brain|النتائج|3-tier|خطة التنفيذ)/i.test(l))

  const rawPromptHeadline = (userQuery ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 78)
  const firstActionHeadline = (cleanLines[0] ?? '').slice(0, 84)

  const hasArabicInReply = /[\u0600-\u06FF]/.test(cleanReply)
  const baseHeadlineAr = hasArabicInReply
    ? firstActionHeadline || rawPromptHeadline || 'توصية تنفيذية من المستشارة فريال'
    : rawPromptHeadline && /[\u0600-\u06FF]/.test(rawPromptHeadline)
      ? rawPromptHeadline
      : `توصية فريال التنفيذية (${scopeAr})`

  const baseHeadlineEn = !hasArabicInReply
    ? firstActionHeadline || rawPromptHeadline || 'Feryal Strategic Recommendation'
    : rawPromptHeadline && !/[\u0600-\u06FF]/.test(rawPromptHeadline)
      ? rawPromptHeadline
      : `Feryal CFO Recommendation (${scopeEn})`

  const titleAr = baseHeadlineAr.startsWith('اعتماد')
    ? baseHeadlineAr
    : `اعتماد توصية فريال: ${baseHeadlineAr}`
  const titleEn = baseHeadlineEn.toLowerCase().startsWith('approve')
    ? baseHeadlineEn
    : `Approve Feryal Play: ${baseHeadlineEn}`

  const summaryBullets = cleanLines.slice(0, 2).join(' — ').slice(0, 210)
  const summaryAr = hasArabicInReply
    ? `النطاق: ${scopeAr} • الأثر المحافظ: +${f0(monthlyReturnKwd)} د.ك/شهر • الرقابة: ${ruleAr}${summaryBullets ? ` • ${summaryBullets}` : ''}`
    : `النطاق: ${scopeAr} • الأثر المحافظ: +${f0(monthlyReturnKwd)} د.ك/شهر • الرقابة: ${ruleAr}`
  const summaryEn = !hasArabicInReply
    ? `Scope: ${scopeEn} • Conservative Upside: +${f0(monthlyReturnKwd)} KWD/mo • Rule: ${ruleEn}${summaryBullets ? ` • ${summaryBullets}` : ''}`
    : `Scope: ${scopeEn} • Conservative Upside: +${f0(monthlyReturnKwd)} KWD/mo • Rule: ${ruleEn}`

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

/**
 * Queues a Feryal recommendation directly into the Manager Bell (`status: 'pending'`)
 * and broadcasts storage/governance sync events cleanly across tabs & components.
 */
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
    href: '/erp/feryal',
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
    } catch {}
  }

  return created
}

/**
 * Formats a crisp, WhatsApp & Boardroom-ready Executive Summary (`نسخ الملخص التنفيذي 📋`).
 */
export function formatFeryalExecutiveSummary(
  replyText: string,
  meta: ExtractedFeryalRecommendation,
  workspace: GlobalWorkspaceSlice,
  isAr: boolean,
): string {
  const cleanBody = feryalPlainText(replyText)
  const reviewDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)

  if (!isAr) {
    return [
      `📋 *EXECUTIVE SUMMARY — VENTURE FOODS (ASK FERYAL)*`,
      `• Recommendation: ${meta.titleEn}`,
      `• Target Scope: ${meta.targetScopeEn} (${workspace.subtitleEn})`,
      `• Conservative Net Impact: +${f0(meta.conservativeMonthlyReturnKwd)} KWD/month${
        meta.budgetOrCostKwd > 0 ? ` | Cost Cap: ${f0(meta.budgetOrCostKwd)} KWD` : ' | Zero Extra Capex'
      }`,
      `• Odoo 17 Compliance Rule: ${meta.complianceRuleEn}`,
      `• 14-Day CFO Audit Date: ${reviewDate}`,
      ``,
      cleanBody,
    ].join('\n')
  }

  return [
    `📋 *ملخص تنفيذي معتمد للمراجعة — شركة فنتشر فودز (المستشارة فريال)*`,
    `• التوصية: ${meta.titleAr}`,
    `• النطاق المستهدف: ${meta.targetScopeAr} (${workspace.subtitleAr})`,
    `• الأثر الشهري المحافظ: +${f0(meta.conservativeMonthlyReturnKwd)} د.ك/شهر${
      meta.budgetOrCostKwd > 0 ? ` | سقف التكلفة: ${f0(meta.budgetOrCostKwd)} د.ك` : ' | بدون تكلفة رأسمالية إضافية'
    }`,
    `• قاعدة الرقابة في أودو 17: ${meta.complianceRuleAr}`,
    `• موعد قياس الأثر (بعد 14 يوماً): ${reviewDate}`,
    ``,
    cleanBody,
  ].join('\n')
}

/**
 * Live-governance-grounded deterministic fallback if external AI providers are unreachable.
 */
export function buildGovernanceAwareFallbackReply(
  query: string,
  snap: FeryalGovernanceSnapshot,
  workspace: GlobalWorkspaceSlice,
  lang: 'ar' | 'en',
): string {
  const q = query.toLowerCase()
  const realistic90 =
    snap.planning90d.scenarios.find((s) => s.id === 'realistic') ?? snap.planning90d.scenarios[0]

  if (/مخالف|نزيف|تجميد|إيقاف|violation|breach|bleed/.test(q)) {
    if (lang === 'en') {
      return [
        `### Open Odoo 17 Compliance Violations (${snap.activeBreaches.length} Active)`,
        ...snap.activeBreaches.map(
          (b, i) =>
            `${i + 1}. **${b.breachHeadlineEn}** (${b.affectedScopeEn}): -${f0(b.monthlyLeakKwd)} KWD/mo — ${b.odooMetricProofEn}.`,
        ),
        `### Immediate CFO Action Plan`,
        `- Freeze open cashier promo codes above 3.0% and hold any Ardiya supplier invoice >2% above contracted PO unit price.`,
        `- Lock nearby Salmiya & Assima delivery routing onto our 15% TMP fleet instead of 25% Tgo.`,
        `### Expected Outcome`,
        `- Conservative monthly cash recovery: **+${f0(Math.round(snap.totalMonthlyBleedKwd * 0.75))} KWD/month** (up to +${f0(snap.totalMonthlyBleedKwd)} KWD/month upon full freeze).`,
      ].join('\n')
    }
    return [
      `### كشف المخالفات الرقابية المفتوحة في أودو 17 (${snap.activeBreaches.length} مخالفات نشطة)`,
      ...snap.activeBreaches.map(
        (b, i) =>
          `${i + 1}. **${b.breachHeadlineAr}** (${b.affectedScopeAr}): نزيف -${f0(b.monthlyLeakKwd)} د.ك/شهر — ${b.odooMetricProofAr}.`,
      ),
      `### خطة التنفيذ والضبط الفوري`,
      `- إيقاف أكواد الخصم المفتوحة فوق سقف 3.0% فوراً وقصر الترويج على كومبو المشروبات المعتمد.`,
      `- تجميد صرف أي فاتورة مورد بمطبخ العارضية تتجاوز السعر التعاقدي بأكثر من 2% وتثبيت توجيه الطلبات القريبة عبر أسطول TMP (15%).`,
      `### النتائج المتوقعة`,
      `- استرداد نقدي شهري محافظ: **+${f0(Math.round(snap.totalMonthlyBleedKwd * 0.75))} د.ك شهرياً** (يصل إلى +${f0(snap.totalMonthlyBleedKwd)} د.ك/شهر بعد الإغلاق الكامل).`,
    ].join('\n')
  }

  if (/تشريع|رقاب|بلدية|غذاء|تجارة|قوى العاملة|جاهزية|regulat|pafn|moci|pam/.test(q)) {
    if (lang === 'en') {
      return [
        `### 7-Branch Regulatory Readiness (${snap.regulatoryReadinessPct}% — ${snap.regulatoryReadySlots}/${snap.regulatoryTotalSlots} Verified)`,
        ...snap.regulations.map(
          (r) =>
            `- **${r.code}** (${r.authorityEn}, Deadline ${r.deadlineDate}): ${r.readyCount}/${r.totalBranches} ready${
              r.pendingBranchesEn.length > 0 ? ` — Pending: **${r.pendingBranchesEn.join(', ')}**` : ' — 100% Complete'
            }.`,
        ),
        `### Expected Outcome`,
        `- Closing the remaining ${snap.regulatoryTotalSlots - snap.regulatoryReadySlots} branch checkpoints shields **${f0(snap.totalPenaltiesShieldedKwd)} KWD** in statutory fines and prevents branch downtime.`,
      ].join('\n')
    }
    return [
      `### جاهزية التشريعات الرقابية عبر الفروع السبعة (${snap.regulatoryReadinessPct}% — ${snap.regulatoryReadySlots} من ${snap.regulatoryTotalSlots} مطابقة)`,
      ...snap.regulations.map(
        (r) =>
          `- **${r.code}** (${r.authorityAr}، المهلة ${r.deadlineDate}): ${r.readyCount}/${r.totalBranches} فروع جاهزة${
            r.pendingBranchesAr.length > 0
              ? ` — بانتظار الاستكمال في: **${r.pendingBranchesAr.join('، ')}**`
              : ' — مكتمل 100%'
          }.`,
      ),
      `### النتائج المتوقعة`,
      `- استكمال النقاط الـ ${snap.regulatoryTotalSlots - snap.regulatoryReadySlots} المتبقية يحمي الشركة من غرامات قيمتها **${f0(snap.totalPenaltiesShieldedKwd)} د.ك** ويمنع أي إيقاف تشغيلي.`,
    ].join('\n')
  }

  if (lang === 'en') {
    return [
      `### Strategic Assessment (${workspace.subtitleEn})`,
      `- Live Odoo 17 baseline stands at **${f0(workspace.salesKwd)} KWD** net sales across **${f0(workspace.orders)}** orders (${workspace.weightedNetPct.toFixed(1)}% weighted net margin).`,
      `- Linked 90-Day Realistic Scenario reconciles cleanly at **${f0(realistic90.projectedSalesKwd)} KWD** sales minus **${f0(realistic90.projectedCostsKwd)} KWD** costs = **+${f0(realistic90.projectedNetCashKwd)} KWD** net cash.`,
      `### Field Execution Steps`,
      `1. Route <=4km orders in Salmiya, Assima & Avenues onto 15% TMP drivers instead of 25% Tgo.`,
      `2. Enforce <=3.0% POS promo cap and <=1.8% Ardiya Central Kitchen prep waste.`,
      `### Expected Outcome`,
      `- Conservative net cash lift: **+680 KWD/month** within approved cost guardrails, ready to submit to Manager Bell 🔔.`,
    ].join('\n')
  }

  return [
    `### التقييم التنفيذي من أرقام أودو 17 (${workspace.subtitleAr})`,
    `- صافي المبيعات في النطاق الحالي **${f0(workspace.salesKwd)} د.ك** عبر **${f0(workspace.orders)}** طلب بصافي هامش موزون **${workspace.weightedNetPct.toFixed(1)}%**.`,
    `- السيناريو الواقعي لـ 90 يوم يحقق **${f0(realistic90.projectedSalesKwd)} د.ك** مبيعات ناقص **${f0(realistic90.projectedCostsKwd)} د.ك** تكاليف = **+${f0(realistic90.projectedNetCashKwd)} د.ك** صافي كاش (تأكيد استلام الفروع ${snap.planReceiptSummary.readinessPct}%).`,
    `### خطوات التنفيذ الميدانية`,
    `1. تحويل الطلبات القريبة (≤ 4 كم) في السالمية والعاصمة والأفنيوز إلى أسطول الشركة TMP بعمولة 15% بدلاً من 25% في Tgo.`,
    `2. تثبيت سقف الخصومات عند ≤ 3.0% وضبط هدر التحضير في مطبخ العارضية المركزي عند ≤ 1.8%.`,
    `### النتائج المتوقعة`,
    `- أثر شهري صافي محافظ: **+680 د.ك شهرياً** بدون تكلفة رأسمالية إضافية، جاهز للرفع المباشر لجرس اعتماد المدير 🔔.`,
  ].join('\n')
}
