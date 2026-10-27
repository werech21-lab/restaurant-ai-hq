import { randomUUID } from 'node:crypto'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'
import { withTransaction, type Queryable } from '@/lib/db'
import { inCooldown } from '@/modules/ai/domain/approval'
import { sameInsight, sameProposal } from '@/modules/ai/domain/compare'
import {
  evaluateCreditHold,
  evaluateDiscountIncentive,
  evaluateFastDepleting,
  evaluateLowStock,
  evaluateMarginFloor,
  evaluatePaymentReminder,
  evaluateStalledLeads,
} from '@/modules/ai/domain/rules'
import { parseThresholds } from '@/modules/ai/domain/thresholds'
import type { AutomationRule, Finding, RuleKey, ScanResult, ScanSkip } from '@/modules/ai/domain/types'
import { aiEventBase, publishAiEvents, type AiEvent } from '@/modules/ai/events'
import * as repository from '@/modules/ai/repositories/ai-repository'
import { findCustomerContact, listStalledLeads } from '@/modules/crm'
import type { StalledLead } from '@/modules/crm/client'
import { listReceivableSignals } from '@/modules/finance'
import type { ReceivableSignal } from '@/modules/finance/client'
import { listStockSignals } from '@/modules/inventory'
import type { StockSignal } from '@/modules/inventory/client'

const WITHDRAWN_NOTE = 'سُحب الطلب تلقائيًا لأن سببه لم يعد قائمًا.'

export type ScanOptions = {
  /** Run only the rules bound to this event. Null runs every active rule (the full scan). */
  trigger: string | null
  /** Look only at these items (an inventory event). Null looks at everything. */
  itemIds: readonly string[] | null
}

/** Reads each family of signals once per distinct parameter set, from the other modules' public read functions. */
class Signals {
  private readonly stockCache = new Map<number, Promise<StockSignal[]>>()
  private readonly receivableCache = new Map<number, Promise<ReceivableSignal[]>>()
  private readonly leadCache = new Map<string, Promise<StalledLead[]>>()

  constructor(
    private readonly tx: Queryable,
    private readonly tenantId: string,
    private readonly itemIds: readonly string[] | null
  ) {}

  stock(windowDays: number): Promise<StockSignal[]> {
    const cached = this.stockCache.get(windowDays)
    if (cached) return cached
    const loaded = listStockSignals(this.tx, this.tenantId, windowDays, this.itemIds)
    this.stockCache.set(windowDays, loaded)
    return loaded
  }

  receivables(minDaysOverdue: number): Promise<ReceivableSignal[]> {
    const cached = this.receivableCache.get(minDaysOverdue)
    if (cached) return cached
    const loaded = listReceivableSignals(this.tx, this.tenantId, minDaysOverdue)
    this.receivableCache.set(minDaysOverdue, loaded)
    return loaded
  }

  stalledLeads(minProbability: number, staleDays: number): Promise<StalledLead[]> {
    const key = `${minProbability}:${staleDays}`
    const cached = this.leadCache.get(key)
    if (cached) return cached
    const loaded = listStalledLeads(this.tx, this.tenantId, { minProbability, staleDays })
    this.leadCache.set(key, loaded)
    return loaded
  }

  /** The customers among these ids that are already blocked. */
  async blockedAmong(customerIds: readonly string[]): Promise<Set<string>> {
    const blocked = new Set<string>()
    for (const id of customerIds) {
      const contact = await findCustomerContact(this.tx, this.tenantId, id)
      if (contact !== null && contact.status === 'blocked') blocked.add(id)
    }
    return blocked
  }
}

type Evaluation = { findings: Finding[]; cooldownDays: number } | { skip: ScanSkip['reason'] }

/** The permissions a rule's data needs. A caller who cannot read the data cannot have a rule evaluated on their behalf. */
function requiredReads(ruleKey: RuleKey): string[] {
  switch (ruleKey) {
    case 'inventory.low_stock':
    case 'inventory.fast_depleting':
      return [permissions.inventoryStockRead]
    case 'finance.margin_floor':
      return [permissions.inventoryItemRead]
    case 'finance.payment_reminder':
      return [permissions.financeInvoiceRead]
    case 'finance.credit_hold':
      return [permissions.financeInvoiceRead, permissions.crmCustomerRead]
    case 'crm.stalled_leads':
      return [permissions.crmLeadRead]
    case 'crm.discount_incentive':
      return [permissions.crmLeadRead, permissions.crmQuotationRead]
  }
}

function isRuleKey(value: string): value is RuleKey {
  return (
    value === 'inventory.low_stock' ||
    value === 'inventory.fast_depleting' ||
    value === 'finance.payment_reminder' ||
    value === 'finance.credit_hold' ||
    value === 'finance.margin_floor' ||
    value === 'crm.stalled_leads' ||
    value === 'crm.discount_incentive'
  )
}

async function evaluateRule(rule: AutomationRule, signals: Signals, granted: ReadonlySet<string>): Promise<Evaluation> {
  const ruleKey = rule.ruleKey
  if (!isRuleKey(ruleKey)) return { skip: 'invalid_condition' }
  if (!requiredReads(ruleKey).every((permission) => granted.has(permission))) return { skip: 'missing_permission' }
  switch (ruleKey) {
    case 'inventory.low_stock': {
      const parsed = parseThresholds(ruleKey, rule.conditionJson)
      if (!parsed.ok) return { skip: 'invalid_condition' }
      const stock = await signals.stock(parsed.value.windowDays)
      return { findings: evaluateLowStock(stock, parsed.value), cooldownDays: parsed.value.cooldownDays }
    }
    case 'inventory.fast_depleting': {
      const parsed = parseThresholds(ruleKey, rule.conditionJson)
      if (!parsed.ok) return { skip: 'invalid_condition' }
      const stock = await signals.stock(parsed.value.windowDays)
      return { findings: evaluateFastDepleting(stock, parsed.value), cooldownDays: parsed.value.cooldownDays }
    }
    case 'finance.margin_floor': {
      const parsed = parseThresholds(ruleKey, rule.conditionJson)
      if (!parsed.ok) return { skip: 'invalid_condition' }
      const stock = await signals.stock(parsed.value.windowDays)
      return { findings: evaluateMarginFloor(stock, parsed.value), cooldownDays: parsed.value.cooldownDays }
    }
    case 'finance.payment_reminder': {
      const parsed = parseThresholds(ruleKey, rule.conditionJson)
      if (!parsed.ok) return { skip: 'invalid_condition' }
      const receivables = await signals.receivables(parsed.value.minOverdueDays)
      return { findings: evaluatePaymentReminder(receivables, parsed.value), cooldownDays: parsed.value.cooldownDays }
    }
    case 'finance.credit_hold': {
      const parsed = parseThresholds(ruleKey, rule.conditionJson)
      if (!parsed.ok) return { skip: 'invalid_condition' }
      const receivables = await signals.receivables(parsed.value.minOverdueDays)
      const candidates = receivables.filter(
        (receivable) =>
          receivable.overdueMinor >= parsed.value.minOverdueMinor && receivable.oldestDaysOverdue >= parsed.value.minOverdueDays
      )
      const blocked = await signals.blockedAmong(candidates.map((candidate) => candidate.customerId))
      return { findings: evaluateCreditHold(candidates, blocked, parsed.value), cooldownDays: parsed.value.cooldownDays }
    }
    case 'crm.stalled_leads': {
      const parsed = parseThresholds(ruleKey, rule.conditionJson)
      if (!parsed.ok) return { skip: 'invalid_condition' }
      const leads = await signals.stalledLeads(parsed.value.minProbability, parsed.value.staleDays)
      return { findings: evaluateStalledLeads(leads, parsed.value), cooldownDays: parsed.value.cooldownDays }
    }
    case 'crm.discount_incentive': {
      const parsed = parseThresholds(ruleKey, rule.conditionJson)
      if (!parsed.ok) return { skip: 'invalid_condition' }
      const leads = await signals.stalledLeads(parsed.value.minProbability, parsed.value.staleDays)
      return { findings: evaluateDiscountIncentive(leads, parsed.value), cooldownDays: parsed.value.cooldownDays }
    }
  }
}

/**
 * Evaluates the rules against live finance, inventory and CRM data and saves what they find, in one transaction.
 *
 * - A finding that is new becomes an insight, and a request when it carries an action.
 * - A finding that is still true updates its insight and its pending request in place (the version moves only when the text
 *   or numbers changed). An acknowledged insight stays acknowledged.
 * - After a person decided a request, the same finding does not ask again until `cooldownDays` pass.
 * - A full scan also resolves the insights, and withdraws the pending requests, of the rules it ran when their cause is gone.
 *   An event scan (one item) only adds and updates.
 * - Scans of one tenant run one at a time, so two clicks cannot race.
 */
export async function runScan(auth: AuthContext, options: ScanOptions): Promise<ScanResult> {
  const events: AiEvent[] = []
  const now = new Date()
  const result = await withTransaction(async (tx): Promise<ScanResult> => {
    await tx.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`ai.scan:${auth.tenantId}`])

    const allRules = await repository.listRules(tx, auth.tenantId)
    const scoped = options.trigger === null ? allRules : allRules.filter((rule) => rule.triggerEvent === options.trigger)
    const skipped: ScanSkip[] = []
    const active: AutomationRule[] = []
    for (const rule of scoped) {
      if (!isRuleKey(rule.ruleKey)) continue
      if (rule.isActive) active.push(rule)
      else if (options.trigger === null) skipped.push({ ruleKey: rule.ruleKey, reason: 'inactive' })
    }

    const signals = new Signals(tx, auth.tenantId, options.itemIds)
    const ran: RuleKey[] = []
    const findings: Finding[] = []
    const cooldownByRule = new Map<RuleKey, number>()
    for (const rule of active) {
      if (!isRuleKey(rule.ruleKey)) continue
      const evaluation = await evaluateRule(rule, signals, auth.permissions)
      if ('skip' in evaluation) {
        skipped.push({ ruleKey: rule.ruleKey, reason: evaluation.skip })
        continue
      }
      ran.push(rule.ruleKey)
      cooldownByRule.set(rule.ruleKey, evaluation.cooldownDays)
      findings.push(...evaluation.findings)
    }

    const fingerprints = findings.map((finding) => finding.fingerprint)
    const liveInsights = await repository.lockLiveInsights(tx, auth.tenantId, fingerprints)
    const pendingApprovals = await repository.lockPendingApprovals(tx, auth.tenantId, fingerprints)
    const decisions = await repository.lastHumanDecisions(tx, auth.tenantId, fingerprints)

    const summary: ScanResult = {
      scannedAt: now.toISOString(),
      rulesRun: ran,
      skipped,
      findings: findings.length,
      insightsCreated: 0,
      insightsUpdated: 0,
      insightsResolved: 0,
      approvalsCreated: 0,
      approvalsUpdated: 0,
      approvalsWithdrawn: 0,
    }
    const seenFingerprints = new Set<string>()
    const keptApprovalIds = new Set<string>()

    for (const finding of findings) {
      if (seenFingerprints.has(finding.fingerprint)) continue
      seenFingerprints.add(finding.fingerprint)

      let insight = liveInsights.get(finding.fingerprint) ?? null
      if (insight === null) {
        insight = await repository.insertInsight(tx, auth.tenantId, auth.userId, finding.ruleKey, finding.fingerprint, finding.insight)
        await writeAudit(tx, {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          entity: 'ai_insight',
          entityId: insight.id,
          action: 'create',
          before: null,
          after: insight,
        })
        summary.insightsCreated += 1
        events.push({
          ...aiEventBase(auth.tenantId),
          name: 'ai.insight.detected',
          payload: { insightId: insight.id, ruleKey: finding.ruleKey, severity: insight.severity, category: insight.category },
        })
      } else if (!sameInsight(insight, finding.insight)) {
        const before = insight
        insight = await repository.refreshInsight(tx, auth.tenantId, insight.id, finding.insight)
        await writeAudit(tx, {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          entity: 'ai_insight',
          entityId: insight.id,
          action: 'update',
          before,
          after: insight,
        })
        summary.insightsUpdated += 1
      }

      const proposal = finding.proposal
      if (proposal === null) continue
      const pending = pendingApprovals.get(finding.fingerprint) ?? null
      if (pending !== null) {
        keptApprovalIds.add(pending.id)
        if (!sameProposal(pending, proposal, insight.id)) {
          const refreshed = await repository.refreshApproval(tx, auth.tenantId, pending.id, insight.id, proposal)
          await writeAudit(tx, {
            tenantId: auth.tenantId,
            actorId: auth.userId,
            entity: 'ai_action_approval',
            entityId: pending.id,
            action: 'update',
            before: pending,
            after: refreshed,
          })
          summary.approvalsUpdated += 1
        }
        continue
      }
      const decidedAt = decisions.get(finding.fingerprint)
      const cooldownDays = cooldownByRule.get(finding.ruleKey) ?? 0
      if (decidedAt !== undefined && inCooldown(decidedAt, cooldownDays, now)) continue
      const approval = await repository.insertApproval(tx, auth.tenantId, auth.userId, {
        insightId: insight.id,
        ruleKey: finding.ruleKey,
        fingerprint: finding.fingerprint,
        proposal,
      })
      keptApprovalIds.add(approval.id)
      await writeAudit(tx, {
        tenantId: auth.tenantId,
        actorId: auth.userId,
        entity: 'ai_action_approval',
        entityId: approval.id,
        action: 'create',
        before: null,
        after: approval,
      })
      summary.approvalsCreated += 1
      events.push({
        ...aiEventBase(auth.tenantId),
        name: 'ai.approval.requested',
        payload: {
          approvalId: approval.id,
          ruleKey: finding.ruleKey,
          actionType: approval.actionType,
          estimatedImpactFils: approval.estimatedImpactFils,
        },
      })
    }

    if (options.trigger === null) {
      const stale = (await repository.listLiveInsightsOfRules(tx, auth.tenantId, ran)).filter(
        (insight) => !seenFingerprints.has(insight.fingerprint)
      )
      await repository.resolveInsights(tx, auth.tenantId, stale.map((insight) => insight.id))
      for (const insight of stale) {
        await writeAudit(tx, {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          entity: 'ai_insight',
          entityId: insight.id,
          action: 'update',
          before: insight,
          after: { ...insight, status: 'resolved' },
        })
      }
      summary.insightsResolved = stale.length

      const orphaned = (await repository.listPendingApprovalsOfRules(tx, auth.tenantId, ran)).filter(
        (approval) => !keptApprovalIds.has(approval.id)
      )
      await repository.withdrawApprovals(tx, auth.tenantId, orphaned.map((approval) => approval.id), WITHDRAWN_NOTE)
      for (const approval of orphaned) {
        await writeAudit(tx, {
          tenantId: auth.tenantId,
          actorId: auth.userId,
          entity: 'ai_action_approval',
          entityId: approval.id,
          action: 'update',
          before: approval,
          after: { ...approval, status: 'rejected', decisionNote: WITHDRAWN_NOTE },
        })
      }
      summary.approvalsWithdrawn = orphaned.length
    }

    await writeAudit(tx, {
      tenantId: auth.tenantId,
      actorId: auth.userId,
      entity: 'ai_scan',
      entityId: randomUUID(),
      action: 'create',
      before: null,
      after: { trigger: options.trigger, itemIds: options.itemIds, ...summary },
    })
    events.push({
      ...aiEventBase(auth.tenantId),
      name: 'ai.scan.completed',
      payload: {
        scannedBy: auth.userId,
        rulesRun: ran,
        findings: summary.findings,
        insightsCreated: summary.insightsCreated,
        approvalsCreated: summary.approvalsCreated,
      },
    })
    return summary
  })
  await publishAiEvents(events)
  return result
}
