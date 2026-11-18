/**
 * Inventory & supply advisor.
 *
 * - stock.quant: negative on-hand by stock location (stock leaving without a receipt).
 * - Warehouse chain (stock.move): scrap and consumption vs receipts from the central kitchen per
 *   branch, when the live chain is available.
 * - Theoretical usage (pos.order.line × mrp.bom) needs Bills of Materials; when Odoo has none the
 *   advisor lists exactly what must be recorded.
 */
import type { OdooLiveWarehouseChainPayload } from '@/lib/odoo-live-connector'
import { branchLabel, clamp01, evidence, r1 } from '../helpers'
import type { Advisor, AdvisorReport, CouncilDataGap, CouncilFinding } from '../types'

export interface QuantRow {
  locationName: string
  quantity: number
}

/** Stock location code → branch id (Odoo short names). */
export const LOCATION_BRANCH: Record<string, string> = {
  '360': '360-mall',
  PRM: 'promenade',
  ASM: 'assima',
  KOUT: 'al-kout',
  AVN: 'avenues',
  SLM: 'salmiya',
  ARD: 'ardiya',
  QRN: 'qurain',
}

export interface InventoryInput {
  quants: { rows: QuantRow[]; asOf: string; syncAt: string | null; capped: boolean; rowLimit: number | null } | null
  warehouse?: OdooLiveWarehouseChainPayload | null
  /** Result of the live model probe: does Odoo hold BoMs (mrp.bom)? null = not probed. */
  hasBoms?: boolean | null
}

export function negativeQuantsByLocation(rows: readonly QuantRow[]) {
  const by = new Map<string, { total: number; negative: number }>()
  for (const r of rows) {
    const root = r.locationName.split('/')[0]
    if (!(root in LOCATION_BRANCH)) continue // virtual / partner locations are not stock
    const s = by.get(root) ?? { total: 0, negative: 0 }
    s.total++
    if (r.quantity < 0) s.negative++
    by.set(root, s)
  }
  return by
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
        const lbl = branchId === 'qurain' ? { ar: 'القرين (المطبخ المركزي)', en: 'Qurain (Central Kitchen)' } : branchLabel(branchId)
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
            ar: `رصيد سالب يعني أن الاستهلاك أو البيع سُجّل قبل استلام البضاعة من المطبخ المركزي أو المورد: تحويلات غير مُستلمة في Odoo، أو صرف بلا مستند — وهذا يخفي الهدر الحقيقي. بقية المواقع: ${others || '—'}.`,
            en: `Negative on-hand means consumption or sales were recorded before the goods were received from the central kitchen or supplier: transfers not validated in Odoo, or issues without a document — which hides real waste. Other locations: ${others || '—'}.`,
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
      if (q.capped) gaps.push({ odooModel: 'stock.quant', missingAr: `عينة الأرصدة محدودة بـ${q.rowLimit} سجل وبتاريخ ${q.asOf}.`, missingEn: `The on-hand sample is capped at ${q.rowLimit} rows and dated ${q.asOf}.`, recordAr: 'قراءة حية كاملة لـstock.quant (للقراءة فقط).', recordEn: 'A full live read of stock.quant (read-only).' })
    } else {
      gaps.push({ odooModel: 'stock.quant', missingAr: 'لا توجد أرصدة مخزون (stock.quant) في البيانات الحالية.', missingEn: 'No on-hand stock (stock.quant) in the current data.', recordAr: 'قراءة stock.quant من Odoo.', recordEn: 'A stock.quant read from Odoo.' })
    }
    const wh = input.warehouse
    if (wh && wh.connected) {
      const scrapByBranch = new Map<string, { scrap: number; consumed: number }>()
      for (const day of wh.dailyMoves ?? []) {
        for (const [b, v] of Object.entries(day.byBranch)) {
          const s = scrapByBranch.get(b) ?? { scrap: 0, consumed: 0 }
          s.scrap += v.scrapKwd
          s.consumed += v.consumedKwd
          scrapByBranch.set(b, s)
        }
      }
      const top = [...scrapByBranch].filter(([, v]) => v.consumed > 0).sort((a, b) => b[1].scrap / b[1].consumed - a[1].scrap / a[1].consumed)[0]
      if (top && top[1].scrap > 0) {
        const lbl = branchLabel(top[0])
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
          proposals: [{ who: { ar: `شيف فرع ${lbl.ar}`, en: `${lbl.en} head chef` }, what: { ar: 'تجهيز يومي حسب توقع المبيعات للساعة بدلاً من كميات ثابتة', en: 'daily prep driven by the hourly sales forecast instead of fixed batches' }, when: { ar: 'من الغد', en: 'from tomorrow' }, expectedImpact: null }],
        })
      }
    } else {
      gaps.push({ odooModel: 'stock.move / stock.scrap', missingAr: 'حركات المخزون (الاستلام من المطبخ المركزي، الاستهلاك، الإتلاف) غير متوفرة في البيانات الحالية.', missingEn: 'Stock moves (central-kitchen receipts, consumption, scrap) are not in the current data.', recordAr: 'قراءة سلسلة المستودع من Odoo (للقراءة فقط)، مع تسجيل كل إتلاف كـstock.scrap بسببه.', recordEn: 'A read-only warehouse-chain read from Odoo, with every write-off recorded as a stock.scrap with its reason.' })
    }
    if (input.hasBoms !== true) {
      gaps.push({
        odooModel: 'mrp.bom / mrp.bom.line',
        missingAr: input.hasBoms === false ? 'لا توجد قوائم مكونات (BoM) في Odoo، فلا يمكن حساب الاستهلاك النظري من المبيعات ومقارنته بالفعلي.' : 'لم يُتحقق من وجود قوائم المكونات (BoM) في Odoo، فلا يُحسب الاستهلاك النظري.',
        missingEn: input.hasBoms === false ? 'Odoo holds no Bills of Materials, so theoretical usage from sales cannot be computed and compared with actual.' : 'Bills of Materials were not verified in Odoo, so theoretical usage is not computed.',
        recordAr: 'تسجيل وصفة (mrp.bom) لكل صنف بيع في نقاط البيع بكميات المكونات ووحداتها.',
        recordEn: 'Record a recipe (mrp.bom) for every POS item with ingredient quantities and units.',
      })
    }
    return {
      advisorId: 'inventory',
      domainAr: this.domainAr,
      domainEn: this.domainEn,
      period: q ? { from: q.asOf, to: q.asOf } : wh?.dateRange ?? null,
      generatedAt: q?.syncAt ?? wh?.lastSyncAt ?? null,
      status: findings.length === 0 ? 'unavailable' : 'partial',
      findings,
      dataGaps: gaps,
    }
  },
}
