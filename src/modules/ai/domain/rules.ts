import {
  formatBps,
  formatCount,
  formatKwd,
  formatPerDay,
  unitLabelAr,
} from '@/modules/ai/domain/messages'
import type {
  CreditHoldThresholds,
  DiscountIncentiveThresholds,
  FastDepletingThresholds,
  LowStockThresholds,
  MarginFloorThresholds,
  PaymentReminderThresholds,
  StalledLeadsThresholds,
} from '@/modules/ai/domain/thresholds'
import type {
  AutoReorderPayload,
  CustomerOverduePayload,
  DiscountPayload,
  Finding,
  LeadFollowupPayload,
  PriceAdjustmentPayload,
  ProposalDraft,
} from '@/modules/ai/domain/types'
import type { StalledLead } from '@/modules/crm/client'
import type { ReceivableSignal } from '@/modules/finance/client'
import { MAX_MOVEMENT_QUANTITY, MAX_STOCK, type StockSignal } from '@/modules/inventory/client'

// The deterministic rule engine. Every function here is pure: it reads signals that the services gathered from the
// finance, inventory and CRM modules and returns findings. It reads no database, clock or random value. Money is integer
// fils and every product or ratio is BigInt, so nothing rounds by accident.

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER)
/** The largest selling price the inventory schema accepts, in fils. */
export const MAX_PRICE_MINOR = 1_000_000_000

function safeNumber(value: bigint): number | null {
  return value >= -MAX_SAFE && value <= MAX_SAFE ? Number(value) : null
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator
}

/** Floor division for a positive denominator, correct for negative numerators too. */
function floorDiv(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator
  return numerator % denominator !== 0n && numerator < 0n ? quotient - 1n : quotient
}

/** `value x bps / 10000`, rounded half up, in BigInt. Null when the result does not fit a safe integer. */
export function bpsOf(value: number, bps: number): number | null {
  return safeNumber((BigInt(value) * BigInt(bps) + 5_000n) / 10_000n)
}

// ---- inventory ----

export type RestockPlan = {
  quantity: number
  /** The stock level after the restock. */
  targetStock: number
  totalCostMinor: number
}

/**
 * How much to order. The target is the larger of `restockMultiplier` times the reorder level and the stock that covers
 * `targetCoverDays` at the average daily sales of the window. The quantity is the gap from today's stock to the target.
 * Null when there is no gap, when the cost does not fit a safe integer, or when no whole quantity fits the limits.
 */
export function planRestock(
  signal: Pick<StockSignal, 'currentStock' | 'reorderLevel' | 'outQuantity' | 'unitCostMinor'>,
  params: { restockMultiplier: number; targetCoverDays: number; windowDays: number }
): RestockPlan | null {
  const byLevel = BigInt(signal.reorderLevel) * BigInt(params.restockMultiplier)
  const byCover = ceilDiv(BigInt(signal.outQuantity) * BigInt(params.targetCoverDays), BigInt(params.windowDays))
  const target = byLevel > byCover ? byLevel : byCover
  let quantity = target - BigInt(signal.currentStock)
  const room = BigInt(MAX_STOCK) - BigInt(signal.currentStock)
  if (quantity > room) quantity = room
  if (quantity > BigInt(MAX_MOVEMENT_QUANTITY)) quantity = BigInt(MAX_MOVEMENT_QUANTITY)
  if (quantity < 1n) return null
  const totalCost = safeNumber(quantity * BigInt(signal.unitCostMinor))
  if (totalCost === null) return null
  return { quantity: Number(quantity), targetStock: signal.currentStock + Number(quantity), totalCostMinor: totalCost }
}

function restockProposal(signal: StockSignal, plan: RestockPlan, why: string, windowDays: number): ProposalDraft | null {
  if (signal.restockWarehouse === null) return null
  const unit = unitLabelAr(signal.unit)
  const payload: AutoReorderPayload = {
    itemId: signal.itemId,
    sku: signal.sku,
    itemName: signal.name,
    warehouseId: signal.restockWarehouse.id,
    warehouseCode: signal.restockWarehouse.code,
    quantity: plan.quantity,
    unitCostMinor: signal.unitCostMinor,
    totalCostMinor: plan.totalCostMinor,
    currentStock: signal.currentStock,
    reorderLevel: signal.reorderLevel,
    targetStock: plan.targetStock,
    outQuantity: signal.outQuantity,
    windowDays,
  }
  return {
    actionType: 'auto_reorder',
    titleAr: `توريد ${formatCount(plan.quantity)} ${unit} من ${signal.name}`,
    summaryAr:
      `${why} الكمية المقترحة ${formatCount(plan.quantity)} ${unit} ترفع الرصيد إلى ${formatCount(plan.targetStock)} ${unit} ` +
      `وتكلفتها ${formatKwd(plan.totalCostMinor)}. يُسجَّل التوريد مستلَمًا في المستودع ${signal.restockWarehouse.code} ` +
      `بتكلفة الوحدة المسجلة، لأنه لا توجد أوامر شراء أو موردون في النظام.`,
    payload: payload,
    estimatedImpactFils: plan.totalCostMinor === 0 ? 0 : -plan.totalCostMinor,
  }
}

/** Active items at or below their reorder level (the same definition the inventory dashboard uses). */
export function evaluateLowStock(signals: readonly StockSignal[], thresholds: LowStockThresholds): Finding[] {
  const findings: Finding[] = []
  for (const signal of signals) {
    if (signal.currentStock > signal.reorderLevel) continue
    const unit = unitLabelAr(signal.unit)
    const plan = planRestock(signal, thresholds)
    const proposal =
      plan === null
        ? null
        : restockProposal(
            signal,
            plan,
            `رصيد ${signal.name} ${formatCount(signal.currentStock)} ${unit} وحد إعادة الطلب ${formatCount(signal.reorderLevel)}.`,
            thresholds.windowDays
          )
    let tail: string
    if (plan === null) tail = ' لا توجد كمية يمكن اقتراحها.'
    else if (signal.restockWarehouse === null) tail = ' لا يوجد مستودع نشط لاستلام التوريد، فلا يمكن اقتراح أمر تموين.'
    else
      tail = ` المقترح توريد ${formatCount(plan.quantity)} ${unit} إلى المستودع ${signal.restockWarehouse.code} بتكلفة ${formatKwd(plan.totalCostMinor)}.`
    findings.push({
      ruleKey: 'inventory.low_stock',
      fingerprint: `inventory.low_stock:${signal.itemId}`,
      insight: {
        severity: signal.currentStock === 0 ? 'critical' : 'warning',
        category: 'inventory',
        titleAr: signal.currentStock === 0 ? `نفد المخزون: ${signal.name}` : `مخزون منخفض: ${signal.name}`,
        descriptionAr: `رصيد ${signal.name} (${signal.sku}) هو ${formatCount(signal.currentStock)} ${unit} وحد إعادة الطلب ${formatCount(signal.reorderLevel)}.${tail}`,
        metricValue: signal.currentStock,
        metricUnit: 'count',
        sourceEntityType: 'item',
        sourceEntityId: signal.itemId,
      },
      proposal,
    })
  }
  return findings
}

/**
 * Whole days the stock lasts at the window's average daily sales, or null when nothing was sold in the window.
 * Integer math: stock x window / sold, rounded down.
 */
export function coverDays(currentStock: number, outQuantity: number, windowDays: number): number | null {
  if (outQuantity <= 0) return null
  return Number((BigInt(currentStock) * BigInt(windowDays)) / BigInt(outQuantity))
}

/** Items above their reorder level whose stock lasts fewer than `coverDays` days at the recent sales rate. */
export function evaluateFastDepleting(signals: readonly StockSignal[], thresholds: FastDepletingThresholds): Finding[] {
  const findings: Finding[] = []
  for (const signal of signals) {
    if (signal.currentStock <= signal.reorderLevel || signal.outQuantity <= 0) continue
    // stock / (sold / window) < coverDays, cross-multiplied so nothing divides.
    const lasts = BigInt(signal.currentStock) * BigInt(thresholds.windowDays)
    const limit = BigInt(thresholds.coverDays) * BigInt(signal.outQuantity)
    if (lasts >= limit) continue
    const days = coverDays(signal.currentStock, signal.outQuantity, thresholds.windowDays) ?? 0
    const unit = unitLabelAr(signal.unit)
    const plan = planRestock(signal, thresholds)
    const why = `يكفي رصيد ${signal.name} نحو ${formatCount(days)} يومًا فقط بمعدل صرف ${formatPerDay(signal.outQuantity, thresholds.windowDays)} ${unit} يوميًا خلال آخر ${formatCount(thresholds.windowDays)} يومًا.`
    const proposal = plan === null ? null : restockProposal(signal, plan, why, thresholds.windowDays)
    findings.push({
      ruleKey: 'inventory.fast_depleting',
      fingerprint: `inventory.fast_depleting:${signal.itemId}`,
      insight: {
        severity: 'warning',
        category: 'inventory',
        titleAr: `مخزون يتناقص بسرعة: ${signal.name}`,
        descriptionAr:
          `${why} حد التنبيه ${formatCount(thresholds.coverDays)} يومًا.` +
          (proposal === null || plan === null ? '' : ` المقترح توريد ${formatCount(plan.quantity)} ${unit} بتكلفة ${formatKwd(plan.totalCostMinor)}.`),
        metricValue: days,
        metricUnit: 'days',
        sourceEntityType: 'item',
        sourceEntityId: signal.itemId,
      },
      proposal,
    })
  }
  return findings
}

// ---- finance ----

function overduePayload(receivable: ReceivableSignal): CustomerOverduePayload {
  return {
    customerId: receivable.customerId,
    customerName: receivable.customerName,
    overdueMinor: receivable.overdueMinor,
    overdueInvoiceCount: receivable.overdueInvoiceCount,
    oldestDaysOverdue: receivable.oldestDaysOverdue,
    invoices: receivable.invoices.map((invoice) => ({ ...invoice })),
  }
}

/** Customers whose invoices overdue by at least `minOverdueDays` add up to at least `minOverdueMinor`. */
export function evaluatePaymentReminder(receivables: readonly ReceivableSignal[], thresholds: PaymentReminderThresholds): Finding[] {
  const findings: Finding[] = []
  for (const receivable of receivables) {
    if (receivable.overdueMinor <= 0) continue
    if (receivable.overdueMinor < thresholds.minOverdueMinor || receivable.oldestDaysOverdue < thresholds.minOverdueDays) continue
    findings.push({
      ruleKey: 'finance.payment_reminder',
      fingerprint: `finance.payment_reminder:${receivable.customerId}`,
      insight: {
        severity: 'critical',
        category: 'finance',
        titleAr: `فواتير متأخرة: ${receivable.customerName}`,
        descriptionAr:
          `${formatCount(receivable.overdueInvoiceCount)} فاتورة متأخرة ${formatCount(thresholds.minOverdueDays)} يومًا أو أكثر بإجمالي ` +
          `${formatKwd(receivable.overdueMinor)}، وأقدمها متأخرة ${formatCount(receivable.oldestDaysOverdue)} يومًا.`,
        metricValue: receivable.overdueMinor,
        metricUnit: 'fils',
        sourceEntityType: 'customer',
        sourceEntityId: receivable.customerId,
      },
      proposal: {
        actionType: 'payment_reminder',
        titleAr: `تذكير سداد لـ ${receivable.customerName}`,
        summaryAr:
          `إعداد رسالة تذكير بمبلغ ${formatKwd(receivable.overdueMinor)} عن ${formatCount(receivable.overdueInvoiceCount)} فاتورة متأخرة. ` +
          'لا يُرسل شيء تلقائيًا: تظهر الرسالة جاهزة للنسخ أو للإرسال عبر واتساب.',
        payload: overduePayload(receivable),
        estimatedImpactFils: receivable.overdueMinor,
      },
    })
  }
  return findings
}

/**
 * Customers overdue by a long time and by a large amount, who are not blocked yet. The proposal blocks the customer in CRM,
 * so nothing new is quoted or invoiced to them until the block is lifted by hand.
 */
export function evaluateCreditHold(
  receivables: readonly ReceivableSignal[],
  blockedCustomerIds: ReadonlySet<string>,
  thresholds: CreditHoldThresholds
): Finding[] {
  const findings: Finding[] = []
  for (const receivable of receivables) {
    if (blockedCustomerIds.has(receivable.customerId)) continue
    if (receivable.overdueMinor <= 0) continue
    if (receivable.overdueMinor < thresholds.minOverdueMinor || receivable.oldestDaysOverdue < thresholds.minOverdueDays) continue
    findings.push({
      ruleKey: 'finance.credit_hold',
      fingerprint: `finance.credit_hold:${receivable.customerId}`,
      insight: {
        severity: 'critical',
        category: 'finance',
        titleAr: `إيقاف ائتمان مقترح: ${receivable.customerName}`,
        descriptionAr:
          `تأخر سداد ${formatKwd(receivable.overdueMinor)} لمدة ${formatCount(thresholds.minOverdueDays)} يومًا أو أكثر، وأقدم فاتورة متأخرة ` +
          `${formatCount(receivable.oldestDaysOverdue)} يومًا. يُنصح بإيقاف التعامل الجديد مع العميل حتى السداد.`,
        metricValue: receivable.overdueMinor,
        metricUnit: 'fils',
        sourceEntityType: 'customer',
        sourceEntityId: receivable.customerId,
      },
      proposal: {
        actionType: 'credit_hold',
        titleAr: `إيقاف ائتمان ${receivable.customerName}`,
        summaryAr:
          `تتحول حالة العميل إلى «محظور» فلا تصدر له عروض أسعار أو فواتير جديدة حتى يُرفع الحظر يدويًا من إدارة العملاء. ` +
          `المبلغ المتأخر المعرّض للخطر ${formatKwd(receivable.overdueMinor)}.`,
        payload: overduePayload(receivable),
        estimatedImpactFils: receivable.overdueMinor,
      },
    })
  }
  return findings
}

/** Margin in basis points, rounded down, or null when the price is zero (a margin of nothing has no meaning). */
export function marginBps(priceMinor: number, costMinor: number): number | null {
  if (priceMinor <= 0) return null
  return Number(floorDiv((BigInt(priceMinor) - BigInt(costMinor)) * 10_000n, BigInt(priceMinor)))
}

/** The lowest selling price that reaches the margin floor: cost / (1 - floor), rounded up. Null when it exceeds the price limit. */
export function priceForMargin(costMinor: number, floorBps: number): number | null {
  const price = ceilDiv(BigInt(costMinor) * 10_000n, BigInt(10_000 - floorBps))
  return price > BigInt(MAX_PRICE_MINOR) ? null : Number(price)
}

/**
 * Items sold below the margin floor. There is no price or cost history, so a "margin drop" is read as the margin being
 * below the floor today. The proposal raises the price to the lowest value that reaches the floor.
 */
export function evaluateMarginFloor(signals: readonly StockSignal[], thresholds: MarginFloorThresholds): Finding[] {
  const findings: Finding[] = []
  for (const signal of signals) {
    // margin < floor, cross-multiplied: (price - cost) x 10000 < floor x price.
    const left = (BigInt(signal.sellingPriceMinor) - BigInt(signal.unitCostMinor)) * 10_000n
    const right = BigInt(thresholds.marginFloorBps) * BigInt(signal.sellingPriceMinor)
    if (left >= right) continue
    const current = marginBps(signal.sellingPriceMinor, signal.unitCostMinor)
    const newPrice = priceForMargin(signal.unitCostMinor, thresholds.marginFloorBps)
    const loss = signal.sellingPriceMinor <= signal.unitCostMinor
    const description =
      signal.sellingPriceMinor === 0
        ? `سعر بيع ${signal.name} (${signal.sku}) صفر وتكلفة الوحدة ${formatKwd(signal.unitCostMinor)}.`
        : `سعر بيع ${signal.name} (${signal.sku}) ${formatKwd(signal.sellingPriceMinor)} وتكلفة الوحدة ${formatKwd(signal.unitCostMinor)}، ` +
          `فالهامش ${formatBps(current ?? 0)}% أقل من الحد الأدنى ${formatBps(thresholds.marginFloorBps)}%.`
    let proposal: ProposalDraft | null = null
    let tail = ' لا يوجد سعر ضمن الحد المسموح يحقق الهامش المطلوب.'
    if (newPrice !== null && newPrice > signal.sellingPriceMinor) {
      const gain = safeNumber(BigInt(newPrice - signal.sellingPriceMinor) * BigInt(signal.outQuantity))
      if (gain !== null) {
        const payload: PriceAdjustmentPayload = {
          itemId: signal.itemId,
          sku: signal.sku,
          itemName: signal.name,
          currentPriceMinor: signal.sellingPriceMinor,
          unitCostMinor: signal.unitCostMinor,
          newPriceMinor: newPrice,
          currentMarginBps: current,
          newMarginBps: marginBps(newPrice, signal.unitCostMinor) ?? 0,
          marginFloorBps: thresholds.marginFloorBps,
          outQuantity: signal.outQuantity,
          windowDays: thresholds.windowDays,
        }
        proposal = {
          actionType: 'price_adjustment',
          titleAr: `رفع سعر ${signal.name} إلى ${formatKwd(newPrice)}`,
          summaryAr:
            `رفع سعر البيع من ${formatKwd(signal.sellingPriceMinor)} إلى ${formatKwd(newPrice)} ليعود الهامش إلى ${formatBps(thresholds.marginFloorBps)}% على الأقل. ` +
            `الأثر المقدر على كمية آخر ${formatCount(thresholds.windowDays)} يومًا (${formatCount(signal.outQuantity)} وحدة) ${formatKwd(gain)}.`,
          payload: payload,
          estimatedImpactFils: gain,
        }
        tail = ` المقترح رفع السعر إلى ${formatKwd(newPrice)}.`
      }
    }
    findings.push({
      ruleKey: 'finance.margin_floor',
      fingerprint: `finance.margin_floor:${signal.itemId}`,
      insight: {
        severity: loss ? 'critical' : 'warning',
        category: 'finance',
        titleAr: loss ? `بيع بخسارة: ${signal.name}` : `هامش ربح منخفض: ${signal.name}`,
        descriptionAr: `${description}${tail}`,
        metricValue: current ?? -10_000,
        metricUnit: 'bps',
        sourceEntityType: 'item',
        sourceEntityId: signal.itemId,
      },
      proposal,
    })
  }
  return findings
}

// ---- crm ----

/** Open leads with a high probability that have not changed for a while. The proposal prepares a follow-up message. */
export function evaluateStalledLeads(leads: readonly StalledLead[], thresholds: StalledLeadsThresholds): Finding[] {
  const findings: Finding[] = []
  for (const lead of leads) {
    if (lead.probability < thresholds.minProbability || lead.daysStalled < thresholds.staleDays) continue
    if (lead.customerStatus === 'blocked') continue
    const payload: LeadFollowupPayload = {
      leadId: lead.leadId,
      leadTitle: lead.title,
      stage: lead.stage,
      probability: lead.probability,
      expectedRevenueMinor: lead.expectedRevenueMinor,
      daysStalled: lead.daysStalled,
      customerId: lead.customerId,
      customerName: lead.customerName,
    }
    findings.push({
      ruleKey: 'crm.stalled_leads',
      fingerprint: `crm.stalled_leads:${lead.leadId}`,
      insight: {
        severity: 'opportunity',
        category: 'crm',
        titleAr: `فرصة عالية الاحتمال متوقفة: ${lead.title}`,
        descriptionAr:
          `فرصة ${lead.customerName} باحتمال ${formatCount(lead.probability)}% وقيمة متوقعة ${formatKwd(lead.expectedRevenueMinor)} ` +
          `دون أي تحديث منذ ${formatCount(lead.daysStalled)} يومًا.`,
        metricValue: lead.expectedRevenueMinor,
        metricUnit: 'fils',
        sourceEntityType: 'lead',
        sourceEntityId: lead.leadId,
      },
      proposal: {
        actionType: 'lead_followup',
        titleAr: `متابعة ${lead.title}`,
        summaryAr:
          `إعداد رسالة متابعة لـ ${lead.customerName} بخصوص الفرصة المتوقفة. لا يُرسل شيء تلقائيًا: تظهر الرسالة جاهزة للنسخ أو للإرسال عبر واتساب.`,
        payload: payload,
        estimatedImpactFils: lead.expectedRevenueMinor,
      },
    })
  }
  return findings
}

/** Stalled, likely leads that have a draft quotation. The proposal lowers that draft's unit prices by `discountBps`. */
export function evaluateDiscountIncentive(leads: readonly StalledLead[], thresholds: DiscountIncentiveThresholds): Finding[] {
  const findings: Finding[] = []
  for (const lead of leads) {
    if (lead.probability < thresholds.minProbability || lead.daysStalled < thresholds.staleDays) continue
    if (lead.customerStatus === 'blocked') continue
    const draft = lead.draftQuotation
    if (draft === null || draft.subtotalMinor <= 0) continue
    const discount = bpsOf(draft.subtotalMinor, thresholds.discountBps)
    if (discount === null || discount <= 0) continue
    const percent = formatBps(thresholds.discountBps)
    const payload: DiscountPayload = {
      leadId: lead.leadId,
      leadTitle: lead.title,
      customerId: lead.customerId,
      customerName: lead.customerName,
      quotationId: draft.id,
      quoteNumber: draft.quoteNumber,
      quotationVersion: draft.version,
      subtotalMinor: draft.subtotalMinor,
      discountBps: thresholds.discountBps,
      estimatedDiscountMinor: discount,
    }
    findings.push({
      ruleKey: 'crm.discount_incentive',
      fingerprint: `crm.discount_incentive:${lead.leadId}`,
      insight: {
        severity: 'opportunity',
        category: 'crm',
        titleAr: `حافز سعري مقترح: ${lead.title}`,
        descriptionAr:
          `لفرصة ${lead.customerName} عرض سعر مسودة ${draft.quoteNumber} بقيمة ${formatKwd(draft.totalMinor)}، والفرصة متوقفة منذ ` +
          `${formatCount(lead.daysStalled)} يومًا باحتمال ${formatCount(lead.probability)}%. خصم ${percent}% قد يحرك الصفقة.`,
        metricValue: lead.expectedRevenueMinor,
        metricUnit: 'fils',
        sourceEntityType: 'lead',
        sourceEntityId: lead.leadId,
      },
      proposal: {
        actionType: 'discount_approval',
        titleAr: `خصم ${percent}% على ${draft.quoteNumber}`,
        summaryAr:
          `تخفيض سعر كل بند في المسودة ${draft.quoteNumber} بنسبة ${percent}% (الخصم المقدر ${formatKwd(discount)} من ${formatKwd(draft.subtotalMinor)}). ` +
          'يتم التعديل بالمسار العادي لتعديل المسودة مع إعادة حساب الضريبة والإجمالي.',
        payload: payload,
        estimatedImpactFils: discount === 0 ? 0 : -discount,
      },
    })
  }
  return findings
}
