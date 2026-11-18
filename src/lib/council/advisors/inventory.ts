/**
 * Inventory & supply advisor.
 *
 * - stock.quant: negative on-hand by stock location (including Qurain `QRN/Stock` as the central kitchen).
 * - Qurain Central Kitchen (`القرين (المطبخ المركزي)` / `QRN/Stock`) outbound transfers vs branch
 *   receipts (`stock.move`), plus branch scrap vs consumption when live warehouse moves exist.
 * - Theoretical usage (`pos.order.line × mrp.bom.line` vs actual consumption) ONLY when Odoo holds
 *   Bills of Materials (`hasBoms === true`) and recipe/sales lines are provided; otherwise reports
 *   the precise `mrp.bom / mrp.bom.line` data gap.
 */
import type { OdooLiveWarehouseChainPayload } from '@/lib/odoo-live-connector'
import { branchLabel, clamp01, estimate, evidence, fromFils, r1, r3, toFils } from '../helpers'
import type { Advisor, AdvisorReport, CouncilDataGap, CouncilFinding } from '../types'

export interface QuantRow {
  locationName: string
  quantity: number
}

/** Stock location code / prefix → branch id (Odoo short names & Qurain Central Kitchen). */
export const LOCATION_BRANCH: Record<string, string> = {
  '360': '360-mall',
  PRM: 'promenade',
  ASM: 'assima',
  KOUT: 'al-kout',
  KOT: 'al-kout',
  AVN: 'avenues',
  SLM: 'salmiya',
  ARD: 'ardiya',
  QRN: 'qurain',
  Qurain: 'qurain',
  القرين: 'qurain',
  EXB: 'exhibitions',
  CNT: 'school-canteens',
}

export interface QurainBranchTransferRow {
  branchId: string
  dispatchedQty: number
  dispatchedKwd: number
  receivedQty: number
  receivedKwd: number
  unreceivedQty: number
  unreceivedKwd: number
}

export interface QurainTransferInput {
  period: { from: string; to: string }
  syncAt: string | null
  movesCount: number
  dispatchedQty: number
  dispatchedKwd: number
  receivedQty: number
  receivedKwd: number
  unreceivedQty: number
  unreceivedKwd: number
  byBranch: QurainBranchTransferRow[]
}

export interface BomRecipeLine {
  posProductId: number
  posProductName?: string
  bomProductQty?: number
  ingredientProductId: number
  ingredientName: string
  ingredientQty: number
  unitCostKwd?: number
}

export interface PosSoldProductQty {
  productId: number
  qtySold: number
  branchId?: string
}

export interface ActualIngredientConsumption {
  ingredientProductId: number
  actualQty: number
  actualKwd?: number
  branchId?: string
}

export interface BomUsageInput {
  period: { from: string; to: string }
  syncAt: string | null
  bomLines: readonly BomRecipeLine[]
  posSales: readonly PosSoldProductQty[]
  actualConsumption: readonly ActualIngredientConsumption[]
}

export interface InventoryInput {
  quants: { rows: QuantRow[]; asOf: string; syncAt: string | null; capped: boolean; rowLimit: number | null } | null
  warehouse?: OdooLiveWarehouseChainPayload | null
  qurainTransfers?: QurainTransferInput | null
  /** Result of the live model probe: does Odoo hold BoMs (mrp.bom)? null = not probed. */
  hasBoms?: boolean | null
  /** Recipe lines + POS quantities + actual consumption when `hasBoms === true`. */
  bomUsage?: BomUsageInput | null
}

function inventoryEntityLabel(branchId: string): { ar: string; en: string } {
  if (branchId === 'qurain') return { ar: 'القرين (المطبخ المركزي)', en: 'Qurain (Central Kitchen)' }
  return branchLabel(branchId)
}

/** Strips digits from raw Odoo item names when interpolated into prose so strict number guards never confuse pack sizes with figures. */
function proseItemLabel(rawName: string): string {
  const cleaned = rawName.replace(/\[[^\]]*\]/g, ' ').replace(/\d+(?:\.\d+)?\s*(?:kd|kwd|ml|kg|gr|g|pcs|pc|l)?/gi, ' ').replace(/\s+/g, ' ').trim()
  return cleaned || 'recipe ingredient'
}

export function negativeQuantsByLocation(rows: readonly QuantRow[]) {
  const by = new Map<string, { total: number; negative: number }>()
  for (const r of rows) {
    const root = r.locationName.split('/')[0].trim()
    if (!(root in LOCATION_BRANCH)) continue // virtual / partner locations are not stock
    const s = by.get(root) ?? { total: 0, negative: 0 }
    s.total++
    if (r.quantity < 0) s.negative++
    by.set(root, s)
  }
  return by
}

export interface BomVarianceRow {
  ingredientProductId: number
  ingredientName: string
  branchId: string | null
  theoreticalQty: number
  actualQty: number
  excessQty: number
  excessKwd: number
  variancePct: number
}

export function computeTheoreticalBomVariance(bomUsage: BomUsageInput): BomVarianceRow[] {
  const recipesByPosProduct = new Map<number, BomRecipeLine[]>()
  const metaByIngredient = new Map<number, { name: string; unitCostFils: number }>()
  for (const line of bomUsage.bomLines) {
    const list = recipesByPosProduct.get(line.posProductId) ?? []
    list.push(line)
    recipesByPosProduct.set(line.posProductId, list)
    if (!metaByIngredient.has(line.ingredientProductId)) {
      metaByIngredient.set(line.ingredientProductId, {
        name: line.ingredientName,
        unitCostFils: toFils(line.unitCostKwd ?? 0),
      })
    }
  }

  const theoMap = new Map<string, { ingredientId: number; branchId: string | null; theoQty: number }>()
  for (const sale of bomUsage.posSales) {
    if (sale.qtySold <= 0) continue
    const lines = recipesByPosProduct.get(sale.productId)
    if (!lines) continue
    for (const l of lines) {
      const baseQty = l.bomProductQty && l.bomProductQty > 0 ? l.bomProductQty : 1
      const qty = (sale.qtySold / baseQty) * l.ingredientQty
      const bKey = sale.branchId ?? null
      const k = `${l.ingredientProductId}|${bKey ?? '*'}`
      const cur = theoMap.get(k) ?? { ingredientId: l.ingredientProductId, branchId: bKey, theoQty: 0 }
      cur.theoQty += qty
      theoMap.set(k, cur)
    }
  }

  const actualMap = new Map<string, { actualQty: number; actualFils: number | null }>()
  for (const act of bomUsage.actualConsumption) {
    const k = `${act.ingredientProductId}|${act.branchId ?? '*'}`
    const cur = actualMap.get(k) ?? { actualQty: 0, actualFils: null }
    cur.actualQty += act.actualQty
    if (typeof act.actualKwd === 'number') {
      cur.actualFils = (cur.actualFils ?? 0) + toFils(act.actualKwd)
    }
    actualMap.set(k, cur)
  }

  const out: BomVarianceRow[] = []
  for (const [k, t] of theoMap.entries()) {
    if (t.theoQty <= 0) continue
    const act = actualMap.get(k)
    if (!act) continue
    const excessQty = r3(act.actualQty - t.theoQty)
    if (excessQty <= 0) continue
    const variancePct = r1((excessQty / t.theoQty) * 100)
    if (variancePct < 5) continue
    const meta = metaByIngredient.get(t.ingredientId)
    const theoFils = Math.round(t.theoQty * (meta?.unitCostFils ?? 0))
    const actFils = act.actualFils !== null ? act.actualFils : Math.round(act.actualQty * (meta?.unitCostFils ?? 0))
    const excessFils = Math.max(0, actFils - theoFils)
    out.push({
      ingredientProductId: t.ingredientId,
      ingredientName: meta?.name ?? `Product #${t.ingredientId}`,
      branchId: t.branchId,
      theoreticalQty: r3(t.theoQty),
      actualQty: r3(act.actualQty),
      excessQty,
      excessKwd: fromFils(excessFils),
      variancePct,
    })
  }
  return out.sort((a, b) => b.excessKwd - a.excessKwd || b.variancePct - a.variancePct)
}

export const inventoryAdvisor: Advisor<InventoryInput> = {
  id: 'inventory',
  domainAr: 'المخزون والتوريد',
  domainEn: 'Inventory & supply',
  run(input: InventoryInput): AdvisorReport {
    const gaps: CouncilDataGap[] = []
    const findings: CouncilFinding[] = []
    const q = input.quants
    if (q && q.rows.length > 0) {
      const by = negativeQuantsByLocation(q.rows)
      const period = { from: q.asOf, to: q.asOf }
      const ranked = [...by].filter(([, v]) => v.total >= 20).sort((a, b) => b[1].negative / b[1].total - a[1].negative / a[1].total)
      const top = ranked[0]
      if (top && top[1].negative > 0) {
        const branchId = LOCATION_BRANCH[top[0]]
        const lbl = inventoryEntityLabel(branchId)
        const share = r1((top[1].negative / top[1].total) * 100)
        const others = ranked.slice(1).map(([loc, v]) => `${loc} ${v.negative}/${v.total}`).join(', ')
        findings.push({
          fingerprint: `inventory:negative-quants:${branchId}`,
          advisorId: 'inventory',
          kind: 'negative-stock',
          entities: { branchId },
          titleAr: `مخزون ${lbl.ar} سالب في ${top[1].negative} من ${top[1].total} صنفاً (${share.toFixed(1)}%)`,
          titleEn: `${lbl.en} stock is negative on ${top[1].negative} of ${top[1].total} items (${share.toFixed(1)}%)`,
          evidence: [
            evidence({ odooModel: 'stock.quant', domain: `location=${top[0]}/Stock, quantity < 0`, period, value: top[1].negative, unit: 'count', syncAt: q.syncAt, labelAr: 'أصناف برصيد سالب', labelEn: 'Items with negative on-hand' }),
            evidence({ odooModel: 'stock.quant', domain: `location=${top[0]}/Stock`, period, value: top[1].total, unit: 'count', syncAt: q.syncAt, labelAr: q.capped ? `أصناف في العينة (حد ${q.rowLimit} سجل)` : 'أصناف الموقع', labelEn: q.capped ? `Items in the sample (capped at ${q.rowLimit} rows)` : 'Items at the location' }),
            evidence({ odooModel: 'stock.quant', domain: `location=${top[0]}/Stock, quantity < 0`, period, value: share, unit: 'pct', syncAt: q.syncAt, labelAr: 'نسبة الأصناف السالبة', labelEn: 'Share of negative items' }),
            ...ranked.slice(1).flatMap(([loc, v]) => [
              evidence({ odooModel: 'stock.quant', domain: `location=${loc}/Stock, quantity < 0`, period, value: v.negative, unit: 'count', syncAt: q.syncAt, labelAr: `سالب في ${loc}`, labelEn: `Negative at ${loc}` }),
              evidence({ odooModel: 'stock.quant', domain: `location=${loc}/Stock`, period, value: v.total, unit: 'count', syncAt: q.syncAt, labelAr: `أصناف ${loc}`, labelEn: `Items at ${loc}` }),
            ]),
          ],
          thresholds: { rowLimit: q.rowLimit ?? 0, responseDays: 7 },
          rootCause: {
            ar: `رصيد سالب يعني أن الاستهلاك أو البيع سُجّل قبل استلام البضاعة من المطبخ المركزي في القرين أو المورد: تحويلات غير مُستلمة في Odoo، أو صرف بلا مستند — وهذا يخفي الهدر الحقيقي. بقية المواقع: ${others || '—'}.`,
            en: `Negative on-hand means consumption or sales were recorded before goods were received from Qurain Central Kitchen or supplier: transfers not validated in Odoo, or issues without a document — which hides real waste. Other locations: ${others || '—'}.`,
          },
          severity: share >= 10 ? 'high' : 'medium',
          novelty: clamp01(share / 25),
          weeklyImpact: null,
          proposals: [
            {
              who: { ar: `أمين مخزن ${lbl.ar} مع مسؤول المطبخ المركزي`, en: `${lbl.en} storekeeper with the central-kitchen lead` },
              what: { ar: 'اعتماد كل تحويل من القرين عند الاستلام نفسه في Odoo، وجرد عدّ للأصناف السالبة هذا الأسبوع', en: 'validate every Qurain transfer in Odoo at the moment of receipt, and cycle-count the negative items this week' },
              when: { ar: 'خلال 7 أيام', en: 'within 7 days' },
              expectedImpact: null,
            },
            {
              who: { ar: 'المدير المالي', en: 'Finance manager' },
              what: { ar: `منع إقفال جلسة نقاط البيع في ${lbl.ar} إذا بقي تحويل من المطبخ المركزي غير مُستلم، ومقارنة رصيد ${lbl.ar} بأفضل موقع (KOUT) أسبوعياً`, en: `block closing the ${lbl.en} POS session while a central-kitchen transfer is still unreceived, and compare ${lbl.en} with the best location (KOUT) weekly` },
              when: { ar: 'من الشهر القادم', en: 'from next month' },
              expectedImpact: null,
            },
          ],
        })
      }
      if (q.capped) {
        gaps.push({
          odooModel: 'stock.quant',
          missingAr: `عينة الأرصدة محدودة بـ${q.rowLimit} سجل وبتاريخ ${q.asOf}.`,
          missingEn: `The on-hand sample is capped at ${q.rowLimit} rows and dated ${q.asOf}.`,
          recordAr: 'قراءة حية كاملة لـstock.quant (للقراءة فقط).',
          recordEn: 'A full live read of stock.quant (read-only).',
        })
      }
    } else {
      gaps.push({
        odooModel: 'stock.quant',
        missingAr: 'لا توجد أرصدة مخزون (stock.quant) في البيانات الحالية.',
        missingEn: 'No on-hand stock (stock.quant) in the current data.',
        recordAr: 'قراءة stock.quant من Odoo.',
        recordEn: 'A stock.quant read from Odoo.',
      })
    }

    const wh = input.warehouse
    const qt = input.qurainTransfers

    // Qurain (QRN/Stock / القرين) outbound transfers vs branch receipts
    if (qt) {
      if (qt.movesCount === 0) {
        gaps.push({
          odooModel: 'stock.move',
          missingAr: 'لا توجد حركات تحويل مسجلة من القرين (المطبخ المركزي · QRN/Stock) إلى الفروع في هذه الفترة.',
          missingEn: 'No outbound transfer moves recorded from Qurain Central Kitchen (QRN/Stock) to branches in this period.',
          recordAr: 'تسجيل كل إرسالية من القرين (QRN/Stock) إلى الفروع كحركة stock.move واعتمادها عند الاستلام.',
          recordEn: 'Record every dispatch from Qurain Central Kitchen (QRN/Stock) to branches as a stock.move and validate on receipt.',
        })
      } else if (qt.unreceivedQty > 0 || toFils(qt.unreceivedKwd) > 0) {
        const rankedBranches = [...qt.byBranch]
          .filter((b) => b.unreceivedQty > 0 || toFils(b.unreceivedKwd) > 0)
          .sort((a, b) => toFils(b.unreceivedKwd) - toFils(a.unreceivedKwd) || b.unreceivedQty - a.unreceivedQty)
        const topBranch = rankedBranches[0]
        const targetBranchId = topBranch?.branchId ?? 'qurain'
        const targetLbl = inventoryEntityLabel(targetBranchId)
        const unrecQty = topBranch ? topBranch.unreceivedQty : qt.unreceivedQty
        const dispQty = topBranch ? topBranch.dispatchedQty : qt.dispatchedQty
        const recQty = topBranch ? topBranch.receivedQty : qt.receivedQty
        const unrecKwd = topBranch ? topBranch.unreceivedKwd : qt.unreceivedKwd
        const unrecShare = dispQty > 0 ? r1((unrecQty / dispQty) * 100) : 0
        const days = Math.max(1, (Date.parse(`${qt.period.to}T00:00:00Z`) - Date.parse(`${qt.period.from}T00:00:00Z`)) / 86_400_000 + 1)

        findings.push({
          fingerprint: `inventory:qurain-transfer-gap:${targetBranchId}`,
          advisorId: 'inventory',
          kind: 'qurain-transfer-gap',
          entities: { branchId: targetBranchId },
          titleAr: `فجوة استلام من القرين (المطبخ المركزي) في ${targetLbl.ar}: ${unrecQty} وحدة غير مُستلمة من أصل ${dispQty} (${unrecShare.toFixed(1)}%)`,
          titleEn: `Unreceived Qurain (Central Kitchen) transfers at ${targetLbl.en}: ${unrecQty} of ${dispQty} dispatched units (${unrecShare.toFixed(1)}%) unvalidated`,
          evidence: [
            evidence({ odooModel: 'stock.move', domain: `origin=QRN/Stock -> branch=${targetBranchId}, state != done`, period: qt.period, value: unrecQty, unit: 'count', syncAt: qt.syncAt, labelAr: 'وحدات صادرة من القرين غير مُستلمة', labelEn: 'Dispatched units from Qurain not yet received' }),
            evidence({ odooModel: 'stock.move', domain: `origin=QRN/Stock -> branch=${targetBranchId}, all active states`, period: qt.period, value: dispQty, unit: 'count', syncAt: qt.syncAt, labelAr: 'إجمالي الوحدات الصادرة من القرين', labelEn: 'Total units dispatched from Qurain' }),
            evidence({ odooModel: 'stock.move', domain: `origin=QRN/Stock -> branch=${targetBranchId}, state = done`, period: qt.period, value: recQty, unit: 'count', syncAt: qt.syncAt, labelAr: 'الوحدات المُستلمة فعلياً في الفرع', labelEn: 'Units validated at branch receipt' }),
            evidence({ odooModel: 'stock.move', domain: `origin=QRN/Stock -> branch=${targetBranchId}, unreceived share`, period: qt.period, value: unrecShare, unit: 'pct', syncAt: qt.syncAt, labelAr: 'نسبة التحويلات المعلقة', labelEn: 'Unreceived transfer share' }),
            ...(toFils(unrecKwd) > 0
              ? [
                  evidence({
                    odooModel: 'stock.move',
                    domain: `origin=QRN/Stock -> branch=${targetBranchId}, unreceived standard value`,
                    period: qt.period,
                    value: unrecKwd,
                    unit: 'KWD' as const,
                    syncAt: qt.syncAt,
                    labelAr: 'قيمة التحويلات غير المُستلمة',
                    labelEn: 'Unreceived transfer value',
                  }),
                ]
              : []),
          ],
          thresholds: { reviewHours: 24 },
          rootCause: {
            ar: 'تحويلات خرجت من القرين (المطبخ المركزي · QRN/Stock) وبقيت معلّقة دون اعتماد الاستلام في الفرع، فتظهر الأصناف بالسالب عند البيع ويتشوه حساب الهدر.',
            en: 'Transfers left Qurain Central Kitchen (QRN/Stock) and stayed pending without branch receipt validation, pushing branch stock negative on sale and distorting waste figures.',
          },
          severity: unrecShare >= 15 ? 'high' : 'medium',
          novelty: clamp01(unrecShare / 30),
          weeklyImpact:
            toFils(unrecKwd) > 0
              ? estimate((unrecKwd * 7) / days, 'KWD', 'unreceived Qurain transfer value × 7 ÷ days in window', {
                  unreceivedKwd: r3(unrecKwd),
                  days,
                })
              : null,
          proposals: [
            {
              who: { ar: `مشرف ${targetLbl.ar} مع أمين مخزن القرين`, en: `${targetLbl.en} supervisor with Qurain storekeeper` },
              what: {
                ar: 'مطابقة واعتماد التحويلات المعلّقة الصادرة من QRN/Stock خلال 24 ساعة أو تسجيل فرق الاستلام الفعلي',
                en: 'reconcile and validate pending QRN/Stock transfers within 24 hours or record the exact short-receipt variance',
              },
              when: { ar: 'خلال 24 ساعة', en: 'within 24 hours' },
              expectedImpact: null,
            },
          ],
        })
      }
    }

    if (wh && wh.connected) {
      const ckOutFils = toFils(wh.totals.ckToBranchTransferKwd)
      const ckOutQty = r3((wh.dailyMoves ?? []).reduce((s, d) => s + d.ckToBranchTransferQty, 0))
      let branchRecFils = 0
      let branchRecQty = 0
      const scrapByBranch = new Map<string, { scrap: number; consumed: number }>()
      for (const day of wh.dailyMoves ?? []) {
        for (const [b, v] of Object.entries(day.byBranch)) {
          branchRecFils += toFils(v.receivedFromCkKwd)
          branchRecQty = r3(branchRecQty + v.receivedFromCkQty)
          const s = scrapByBranch.get(b) ?? { scrap: 0, consumed: 0 }
          s.scrap += v.scrapKwd
          s.consumed += v.consumedKwd
          scrapByBranch.set(b, s)
        }
      }

      if (!qt) {
        if (ckOutFils === 0 && ckOutQty === 0 && branchRecQty === 0) {
          gaps.push({
            odooModel: 'stock.move',
            missingAr: 'لا توجد سطور تحويلات بين القرين (المطبخ المركزي · QRN/Stock) والفروع في سلسلة المستودع لهذه الفترة.',
            missingEn: 'No transfer lines between Qurain Central Kitchen (QRN/Stock) and branches in the warehouse chain for this period.',
            recordAr: 'تسجيل تحويلات التموين من QRN/Stock إلى مخزون كل فرع كحركات stock.move معتمدة في Odoo.',
            recordEn: 'Record replenishment transfers from QRN/Stock to each branch stock location as validated stock.move lines in Odoo.',
          })
        } else if (ckOutFils - branchRecFils > 1) {
          const gapKwd = fromFils(ckOutFils - branchRecFils)
          const outKwd = fromFils(ckOutFils)
          const recKwd = fromFils(branchRecFils)
          const gapPct = ckOutFils > 0 ? r1(((ckOutFils - branchRecFils) / ckOutFils) * 100) : 0
          findings.push({
            fingerprint: 'inventory:qurain-transfer-gap:qurain',
            advisorId: 'inventory',
            kind: 'qurain-transfer-gap',
            entities: { branchId: 'qurain' },
            titleAr: `فرق تحويلات القرين (المطبخ المركزي): ${gapKwd.toFixed(3)} د.ك (${gapPct.toFixed(1)}%) بين الصادر واستلام الفروع`,
            titleEn: `Qurain (Central Kitchen) transfer discrepancy: ${gapKwd.toFixed(3)} KWD (${gapPct.toFixed(1)}%) between outbound and branch receipts`,
            evidence: [
              evidence({ odooModel: 'stock.move', domain: 'origin=QRN/CK -> branches (outbound)', period: wh.dateRange, value: outKwd, unit: 'KWD', syncAt: wh.lastSyncAt ?? null, labelAr: 'الصادر من المطبخ المركزي (القرين)', labelEn: 'Outbound from Qurain Central Kitchen' }),
              evidence({ odooModel: 'stock.move', domain: 'destination=active branches (received)', period: wh.dateRange, value: recKwd, unit: 'KWD', syncAt: wh.lastSyncAt ?? null, labelAr: 'المُستلم في الفروع', labelEn: 'Received across branches' }),
              evidence({ odooModel: 'stock.move', domain: 'outbound minus branch receipts', period: wh.dateRange, value: gapKwd, unit: 'KWD', syncAt: wh.lastSyncAt ?? null, labelAr: 'فرق التحويل غير المنسوب لفرع', labelEn: 'Unreconciled transfer gap' }),
              evidence({ odooModel: 'stock.move', domain: 'gap share of outbound', period: wh.dateRange, value: gapPct, unit: 'pct', syncAt: wh.lastSyncAt ?? null, labelAr: 'نسبة الفرق', labelEn: 'Discrepancy share' }),
            ],
            thresholds: { reviewHours: 24 },
            rootCause: {
              ar: 'جزء من تحويلات القرين (المطبخ المركزي) سُجّل إلى موقع وسيط أو غير منسوب لفرع نشط فلم يطابق استلامات الفروع.',
              en: 'Part of Qurain Central Kitchen outbound transfers posted to a transit or unmapped destination and did not reconcile to active branch receipts.',
            },
            severity: gapPct >= 10 ? 'high' : 'medium',
            novelty: clamp01(gapPct / 25),
            weeklyImpact: null,
            proposals: [
              {
                who: { ar: 'مسؤول مخزن القرين مع المحاسبة', en: 'Qurain warehouse lead with accounting' },
                what: { ar: 'مراجعة حركات التحويل الصادرة من QRN/Stock وتقفيل المواقع الوسيطة خلال 24 ساعة', en: 'audit QRN/Stock outbound moves and clear transit locations within 24 hours' },
                when: { ar: 'خلال 24 ساعة', en: 'within 24 hours' },
                expectedImpact: null,
              },
            ],
          })
        }
      }

      const top = [...scrapByBranch].filter(([, v]) => v.consumed > 0).sort((a, b) => b[1].scrap / b[1].consumed - a[1].scrap / a[1].consumed)[0]
      if (top && top[1].scrap > 0) {
        const lbl = inventoryEntityLabel(top[0])
        const pct = r1((top[1].scrap / top[1].consumed) * 100)
        findings.push({
          fingerprint: `inventory:scrap:${top[0]}`,
          advisorId: 'inventory',
          kind: 'scrap-ratio',
          entities: { branchId: top[0] },
          titleAr: `أعلى نسبة إتلاف: ${lbl.ar} ${pct.toFixed(1)}% من الاستهلاك`,
          titleEn: `Highest scrap rate: ${lbl.en} at ${pct.toFixed(1)}% of consumption`,
          evidence: [
            evidence({ odooModel: 'stock.move (scrap)', domain: `branch=${top[0]}`, period: wh.dateRange, value: top[1].scrap, unit: 'KWD', syncAt: wh.lastSyncAt ?? null, labelAr: 'قيمة الإتلاف', labelEn: 'Scrap value' }),
            evidence({ odooModel: 'stock.move (consumption)', domain: `branch=${top[0]}`, period: wh.dateRange, value: top[1].consumed, unit: 'KWD', syncAt: wh.lastSyncAt ?? null, labelAr: 'قيمة الاستهلاك', labelEn: 'Consumption value' }),
          ],
          rootCause: { ar: 'إتلاف مرتفع مقارنة بالاستهلاك: إنتاج أكثر من الطلب أو تخزين خاطئ.', en: 'Scrap is high against consumption: over-production or poor storage.' },
          severity: pct >= 5 ? 'high' : 'medium',
          novelty: clamp01(pct / 10),
          weeklyImpact: null,
          proposals: [
            {
              who: { ar: `شيف فرع ${lbl.ar}`, en: `${lbl.en} head chef` },
              what: { ar: 'تجهيز يومي حسب توقع المبيعات للساعة بدلاً من كميات ثابتة', en: 'daily prep driven by the hourly sales forecast instead of fixed batches' },
              when: { ar: 'من الغد', en: 'from tomorrow' },
              expectedImpact: null,
            },
          ],
        })
      }
    } else if (!qt) {
      gaps.push({
        odooModel: 'stock.move / stock.scrap',
        missingAr: 'حركات المخزون (تحويلات القرين المطبخ المركزي مقابل استلام الفروع، الاستهلاك، الإتلاف) غير متوفرة في البيانات الحالية.',
        missingEn: 'Stock moves (Qurain Central Kitchen transfers vs branch receipts, consumption, scrap) are not in the current data.',
        recordAr: 'قراءة سلسلة المستودع من Odoo (للقراءة فقط)، مع تسجيل تحويلات QRN/Stock وكل إتلاف كـstock.scrap بسببه.',
        recordEn: 'A read-only warehouse-chain read from Odoo, with QRN/Stock transfers and every write-off recorded as a stock.scrap with its reason.',
      })
    }

    // Theoretical usage (pos.order.line × mrp.bom.line vs actual consumption) ONLY when hasBoms === true & BoM lines exist
    if (input.hasBoms === true && input.bomUsage && input.bomUsage.bomLines.length > 0 && input.bomUsage.posSales.length > 0) {
      const variances = computeTheoreticalBomVariance(input.bomUsage)
      const topVar = variances[0]
      if (topVar) {
        const bLbl = topVar.branchId ? inventoryEntityLabel(topVar.branchId) : { ar: 'الفروع', en: 'branches' }
        const itemLabel = proseItemLabel(topVar.ingredientName)
        const days = Math.max(
          1,
          (Date.parse(`${input.bomUsage.period.to}T00:00:00Z`) - Date.parse(`${input.bomUsage.period.from}T00:00:00Z`)) / 86_400_000 + 1,
        )
        findings.push({
          fingerprint: `inventory:bom-variance:${topVar.branchId ?? 'company'}:${topVar.ingredientProductId}`,
          advisorId: 'inventory',
          kind: 'bom-variance',
          entities: topVar.branchId ? { branchId: topVar.branchId } : {},
          titleAr: `انحراف استهلاك عن الوصفة (${itemLabel}) في ${bLbl.ar}: الفعلي ${topVar.actualQty} مقابل النظري ${topVar.theoreticalQty} (+${topVar.variancePct.toFixed(1)}%)`,
          titleEn: `BoM usage variance (${itemLabel}) at ${bLbl.en}: actual ${topVar.actualQty} vs theoretical ${topVar.theoreticalQty} (+${topVar.variancePct.toFixed(1)}%)`,
          evidence: [
            evidence({
              odooModel: 'pos.order.line × mrp.bom.line',
              domain: `product=${topVar.ingredientName} (#${topVar.ingredientProductId})${topVar.branchId ? `, branch=${topVar.branchId}` : ''}`,
              period: input.bomUsage.period,
              value: topVar.theoreticalQty,
              unit: 'count',
              syncAt: input.bomUsage.syncAt,
              labelAr: 'الاستهلاك النظري حسب المبيعات والوصفة',
              labelEn: 'Theoretical usage from POS sales × BoM',
            }),
            evidence({
              odooModel: 'stock.move',
              domain: `product=${topVar.ingredientName} (#${topVar.ingredientProductId})${topVar.branchId ? `, branch=${topVar.branchId}` : ''}`,
              period: input.bomUsage.period,
              value: topVar.actualQty,
              unit: 'count',
              syncAt: input.bomUsage.syncAt,
              labelAr: 'الاستهلاك الفعلي المسجل',
              labelEn: 'Actual recorded consumption',
            }),
            evidence({
              odooModel: 'pos.order.line × mrp.bom.line',
              domain: `excess over theoretical (${topVar.excessQty})`,
              period: input.bomUsage.period,
              value: topVar.variancePct,
              unit: 'pct',
              syncAt: input.bomUsage.syncAt,
              labelAr: 'نسبة التجاوز فوق الوصفة',
              labelEn: 'Excess over BoM recipe',
            }),
            ...(toFils(topVar.excessKwd) > 0
              ? [
                  evidence({
                    odooModel: 'stock.move',
                    domain: `excess cost for product #${topVar.ingredientProductId}`,
                    period: input.bomUsage.period,
                    value: topVar.excessKwd,
                    unit: 'KWD' as const,
                    syncAt: input.bomUsage.syncAt,
                    labelAr: 'تكلفة الزيادة عن الوصفة',
                    labelEn: 'Excess consumption cost',
                  }),
                ]
              : []),
          ],
          thresholds: { excessUnits: topVar.excessQty },
          rootCause: {
            ar: 'الاستهلاك الفعلي أعلى من كمية الوصفة المعيارية (mrp.bom.line) مضروبة في المبيعات: زيادة وزن الحصة عند التحضير أو هدر غير مسجل كإتلاف.',
            en: 'Actual consumption exceeds standard recipe quantities (mrp.bom.line) times POS sales: over-portioning on the line or waste not logged as scrap.',
          },
          severity: topVar.variancePct >= 20 ? 'high' : 'medium',
          novelty: clamp01(topVar.variancePct / 50),
          weeklyImpact:
            toFils(topVar.excessKwd) > 0
              ? estimate((topVar.excessKwd * 7) / days, 'KWD', '(actual consumption cost − theoretical BoM cost) × 7 ÷ days', {
                  excessKwd: r3(topVar.excessKwd),
                  days,
                })
              : null,
          proposals: [
            {
              who: { ar: `شيف ${bLbl.ar}`, en: `${bLbl.en} head chef` },
              what: {
                ar: `مراجعة عيار الحصة الفعلي لصنف (${itemLabel}) على خط التحضير ومطابقته مع mrp.bom.line`,
                en: `audit portion weights for (${itemLabel}) on the prep line against mrp.bom.line`,
              },
              when: { ar: 'هذا الأسبوع', en: 'this week' },
              expectedImpact: null,
            },
          ],
        })
      }
    } else {
      gaps.push({
        odooModel: 'mrp.bom / mrp.bom.line',
        missingAr:
          input.hasBoms === false
            ? 'لا توجد قوائم مكونات (BoM) في Odoo، فلا يمكن حساب الاستهلاك النظري من المبيعات ومقارنته بالفعلي.'
            : input.hasBoms === true
              ? 'قوائم المكونات (mrp.bom) موجودة في Odoo، لكن سطور الاستهلاك النظري (pos.order.line × mrp.bom.line) غير محمّلة لهذه الفترة.'
              : 'لم يُتحقق من وجود قوائم المكونات (BoM) في Odoo، فلا يُحسب الاستهلاك النظري.',
        missingEn:
          input.hasBoms === false
            ? 'Odoo holds no Bills of Materials, so theoretical usage from sales cannot be computed and compared with actual.'
            : input.hasBoms === true
              ? 'Bills of Materials (mrp.bom) exist in Odoo, but pos.order.line × mrp.bom.line rows were not loaded for this window.'
              : 'Bills of Materials were not verified in Odoo, so theoretical usage is not computed.',
        recordAr: 'تسجيل وصفة (mrp.bom) لكل صنف بيع في نقاط البيع بكميات المكونات ووحداتها.',
        recordEn: 'Record a recipe (mrp.bom) for every POS item with ingredient quantities and units.',
      })
    }

    return {
      advisorId: 'inventory',
      domainAr: this.domainAr,
      domainEn: this.domainEn,
      period: q ? { from: q.asOf, to: q.asOf } : qt?.period ?? wh?.dateRange ?? null,
      generatedAt: q?.syncAt ?? qt?.syncAt ?? wh?.lastSyncAt ?? null,
      status: findings.length === 0 && gaps.length > 0 ? 'unavailable' : gaps.length > 0 ? 'partial' : 'ready',
      findings,
      dataGaps: gaps,
    }
  },
}
