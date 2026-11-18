import { describe, expect, it } from 'vitest'
import { detectOdooToolKind } from '@/lib/feryal-intent'
import { FERYAL_NO_ODOO_DATA_REPLY } from '@/lib/feryal-odoo-agent'
import {
  answerFromFeryalContext,
  dropUnverifiedClaims,
  isFeryalSmallTalk,
} from '@/lib/feryal/context-answer'
import { monthCube } from '@/lib/__tests__/phase-5/support/feryal-dialect-fixture'

function withBooths() {
  const cube = monthCube()
  const canteens = cube.byBranch['school-canteens']
  cube.byBranch.exhibitions = canteens
    ? { ...canteens }
    : cube.byBranch.exhibitions
  return cube
}

describe('Feryal answers from the period cube', () => {
  const cube = withBooths()

  it('does not use the no-data refusal for small talk', () => {
    for (const question of ['فهمتي شو؟', 'مرحبا', 'محادثات قديمة', 'السلام عليكم']) {
      expect(isFeryalSmallTalk(question)).toBe(true)
      const result = answerFromFeryalContext(question, cube)
      expect(result.status).toBe('answered')
      expect(result.reply).not.toContain(FERYAL_NO_ODOO_DATA_REPLY)
    }
  })

  it('sends a greeting that also asks about sales to the sales tool', () => {
    for (const question of ['مرحبا، كم مبيعات أمس؟', 'السلام عليكم شو وضع المبيعات هالشهر؟']) {
      expect(isFeryalSmallTalk(question)).toBe(false)
      expect(detectOdooToolKind(question, null, { brandId: null, asksByBrandBreakdown: false }, false)).toBe(
        'pos_orders',
      )
      const result = answerFromFeryalContext(question, cube)
      expect(result.reply).not.toContain('وش تبي نشوف الحين')
    }
  })

  it('names the peak hour from hourlySeries', () => {
    const result = answerFromFeryalContext('شو أفضل ساعة عندنا؟', cube)
    const peak = cube.hourlySeries.reduce((best, row) => (row.netKwd > best.netKwd ? row : best))
    expect(result.reply).toContain(`${peak.hour}:00`)
    expect(result.reply).toContain(peak.netKwd.toFixed(3))
  })

  it('uses talabat channel data and labels a proposal', () => {
    const result = answerFromFeryalContext('ليش طلبات عم تنزلنا؟', cube)
    const talabat =
      (cube.byChannel?.['talabat-tgo']?.netKwd ?? 0) + (cube.byChannel?.['talabat-tmp']?.netKwd ?? 0)
    expect(result.reply).toContain(talabat.toFixed(3))
    expect(result.reply).toContain('اقتراح')
  })

  it('includes exhibition booth figures from the cube', () => {
    const result = answerFromFeryalContext('شو وضع البوثات؟', cube)
    expect(result.reply).toContain('بوثات المعارض')
    expect(result.reply).toContain((cube.byBranch.exhibitions?.netKwd ?? 0).toFixed(3))
  })

  it('states a missing metric once and still analyses the cube', () => {
    const result = answerFromFeryalContext('شو اقتراحك لزمن التحضير؟', cube)
    expect(result.missingMetrics).toEqual(['زمن التحضير غير متاح في Odoo'])
    expect(result.reply.match(/زمن التحضير غير متاح في Odoo/g)?.length).toBe(1)
    expect(result.reply).toContain(':00')
  })

  it('labels a forecast with the recomputed run-rate', () => {
    const result = answerFromFeryalContext('شو توقع الشهر الجاي؟', cube)
    const runRate = (cube.totals.netSalesKwd / cube.days) * cube.days
    expect(result.reply).toContain('تقدير')
    expect(result.reply).toContain(runRate.toFixed(3))
  })

  it('drops only the claim whose number is not in the pack', () => {
    const allowed = [cube.totals.netSalesKwd]
    const reply = dropUnverifiedClaims(
      [
        { text: `الصافي ${cube.totals.netSalesKwd.toFixed(3)}`, numbers: [cube.totals.netSalesKwd] },
        { text: 'رقم غير موجود 999999.000', numbers: [999999] },
      ],
      allowed,
    )
    expect(reply).toContain(cube.totals.netSalesKwd.toFixed(3))
    expect(reply).not.toContain('999999')
  })

  it('does not name excluded config ids', () => {
    const result = answerFromFeryalContext('شو وضع الشركة؟', cube)
    expect(result.reply).not.toMatch(/\b(24|25|39|40)\b/)
  })
})
