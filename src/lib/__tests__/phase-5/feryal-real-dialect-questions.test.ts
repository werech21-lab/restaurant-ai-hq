/**
 * Phase 5 · Item 3 — the 10 real Gulf/Kuwaiti dialect questions from the independent review.
 * Each row pins the routing (Odoo model / status) and the grounded figures that must appear, plus
 * the wrong answers that must never appear. Questions stay in Arabic exactly as executives type them.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { askFeryalOdooAgent, resetFeryalAuditCache } from '@/lib/feryal-odoo-agent'
import { createDialectDataSource, DIALECT_NOW_MS, todayCube } from './support/feryal-dialect-fixture'

interface Row {
  question: string
  status: 'answered' | 'no_odoo_data'
  model?: string
  period?: { from: string; to: string }
  mustContain: string[]
  mustNotContain?: string[]
}

const ROWS: Row[] = [
  {
    question: 'شو كانت مبيعات امبارح؟',
    status: 'answered',
    model: 'pos.order',
    period: { from: '2026-11-16', to: '2026-11-16' },
    mustContain: ['4,890.000 د.ك'],
  },
  {
    question: 'كم مبيعات كيتا بالكوت امبارح؟',
    status: 'answered',
    model: 'pos.order',
    period: { from: '2026-11-16', to: '2026-11-16' },
    mustContain: ['قناة كيتا', 'الكوت', '160.000 د.ك', '34 دفعات'],
    mustNotContain: ['34 طلبات'],
  },
  {
    question: 'كم مبيعات طلبات بالكوت امس؟',
    status: 'answered',
    model: 'pos.order',
    period: { from: '2026-11-16', to: '2026-11-16' },
    // Talabat = TGO 160 + TMP 70 at Al-Kout; 32 + 14 payouts. Never total branch sales (690).
    mustContain: ['TGO + TMP', '230.000 د.ك', '46 دفعات'],
    mustNotContain: ['690.000 د.ك'],
  },
  {
    question: 'كم مصاريف فرع الكوت هالشهر؟',
    status: 'no_odoo_data',
    mustContain: ['غير متاح', 'مصاريف الفرع'],
    mustNotContain: ['pos.order', '11,040.000'],
  },
  {
    question: 'كم المخزون بالفرع؟',
    status: 'no_odoo_data',
    mustContain: ['غير متاح', 'المخزون'],
    mustNotContain: ['pos.order', '78,240.000'],
  },
  {
    question: 'كم مبيعات فرع الفحاحيل؟',
    status: 'no_odoo_data',
    // FAS Fahaheel is school-canteen register 43; its sales are not separable from the other
    // canteens in the live cube, so the answer is «غير متاح» naming the register — never Al-Kout.
    mustContain: ['غير متاح', 'FAS Fahaheel', 'pos.config 43', 'مقاصف المدارس'],
    mustNotContain: ['الكوت', '11,040.000'],
  },
  {
    question: 'شو أكثر صنف انباع امس؟',
    status: 'answered',
    model: 'pos.order.line',
    period: { from: '2026-11-16', to: '2026-11-16' },
    mustContain: ['وجبة تشاينا جاردن العائلية', '420.000 د.ك'],
    mustNotContain: ['توزعت المبيعات حسب الفرع'],
  },
  {
    question: 'شو أضعف فرع هالشهر؟',
    status: 'answered',
    model: 'pos.order',
    period: { from: '2026-11-01', to: '2026-11-17' },
    // Lowest RESTAURANT branch (canteens and unattributed excluded from the headline).
    mustContain: ['أضعف فرع مطاعم هو العاصمة', '6,720.000 د.ك'],
    mustNotContain: ['أضعف فرع مطاعم هو مقاصف', 'تصدر فرع مول 360 المبيعات'],
  },
  {
    question: 'قارن مبيعات اليوم مع امبارح',
    status: 'answered',
    model: 'pos.order',
    // Same hours until 14:00 Kuwait: today 1,265.000 vs yesterday 1,150.000 = +10.0% (not −72.4%).
    mustContain: ['نفس الساعات حتى الساعة 14:00', '1,265.000 د.ك', '1,150.000 د.ك', 'بارتفاع', '10.0%'],
    mustNotContain: ['4,890.000', '72.4%', '65.4%'],
  },
  {
    question: 'طلبات TGO و TMP امبارح',
    status: 'answered',
    model: 'pos.order',
    period: { from: '2026-11-16', to: '2026-11-16' },
    // Company Talabat = TGO 900 + TMP 400; 180 + 80 payouts.
    mustContain: ['TGO + TMP', '1,300.000 د.ك', '260 دفعات'],
    mustNotContain: ['260 طلبات'],
  },
]

describe('Feryal — 10 real Gulf dialect questions (table-driven)', () => {
  beforeEach(() => resetFeryalAuditCache())

  it.each(ROWS)('$question', async (row) => {
    const res = await askFeryalOdooAgent({
      question: row.question,
      userSub: 'phase5-dialect',
      userRole: 'gm',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: createDialectDataSource(),
      skipAuditLog: true,
    })
    expect(res.status, res.reply).toBe(row.status)
    if (row.model) expect(res.executedQueries[0]?.model).toBe(row.model)
    if (row.period) expect(res.period).toEqual(row.period)
    for (const s of row.mustContain) expect(res.reply, res.reply).toContain(s)
    for (const s of row.mustNotContain ?? []) expect(res.reply, res.reply).not.toContain(s)
    if (row.status === 'answered') {
      expect(res.verifier.valid).toBe(true)
      expect(res.reply).toContain('• المصدر: Odoo 17')
    }
  })
})

describe('Feryal comparison reason never contradicts itself', () => {
  beforeEach(() => resetFeryalAuditCache())

  it('sales up while orders down: explains the gap by average order value, not by fewer orders', async () => {
    const base = createDialectDataSource()
    const dataSource = {
      ...base,
      fetchPeriodCube: async (from: string, to: string, ref?: number) => {
        const cube = await base.fetchPeriodCube(from, to, ref)
        if (cube && from === '2026-11-17' && to === '2026-11-17') {
          // Same Odoo shape; today's completed hours carry fewer orders than yesterday's.
          const today = todayCube()
          today.hourlySeries = today.hourlySeries.map((h) => ({ ...h, orders: Math.floor(h.orders / 2) }))
          return today
        }
        return cube
      },
    }
    const res = await askFeryalOdooAgent({
      question: 'قارن مبيعات اليوم مع امبارح',
      userSub: 'phase5-dialect',
      userRole: 'gm',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource,
      skipAuditLog: true,
    })
    expect(res.status, res.reply).toBe('answered')
    expect(res.reply).toContain('بارتفاع')
    expect(res.reply).toContain('ارتفعت المبيعات رغم تراجع الطلبات')
    expect(res.reply).toContain('متوسط الطلب')
    expect(res.reply).not.toMatch(/يعود الفارق[^.]*إلى تراجع الطلبات/)
    expect(res.verifier.valid).toBe(true)
  })
})
