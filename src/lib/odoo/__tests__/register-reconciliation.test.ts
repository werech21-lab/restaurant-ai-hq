import { describe, expect, it } from 'vitest'
import {
  buildRegisterReconciliation,
  classifyIncludedRegister,
} from '@/lib/odoo/register-reconciliation'
import { formatCompactKwdTick } from '@/components/charts/v35-chart-theme'
import { renderSignedBarShape } from '@/components/charts/v35-chart-kit'
import { renderToStaticMarkup } from 'react-dom/server'

describe('per-register reconciliation', () => {
  it('keeps restaurants, canteens and booths, and drops the excluded ids and Qurain', () => {
    expect(classifyIncludedRegister(8, 'Promenade POS')).toBe('restaurant')
    expect(classifyIncludedRegister(41, 'NPIS Hawally canteen')).toBe('school-canteen')
    expect(classifyIncludedRegister(26, 'Exhibition booth')).toBe('exhibition-booths')
    expect(classifyIncludedRegister(24, 'Closed register')).toBeNull()
    expect(classifyIncludedRegister(8, 'Qurain kitchen')).toBeNull()
    expect(classifyIncludedRegister(8, 'هايزن بريج')).toBeNull()
  })

  it('sums included registers, including a synthetic negative refund, against the company net', () => {
    // Synthetic labelled nets, not a live Odoo extract.
    const report = buildRegisterReconciliation(
      [
        { configId: 8, configName: 'synthetic promenade', netKwd: 2, orders: 4 },
        { configId: 41, configName: 'synthetic canteen', netKwd: 1.5, orders: 2 },
        { configId: 26, configName: 'synthetic booth', netKwd: -0.25, orders: 1 },
        { configId: 24, configName: 'synthetic excluded', netKwd: 9, orders: 3 },
      ],
      3.25,
    )
    expect(report).not.toBeNull()
    expect(report?.rows.map((row) => row.configId)).toEqual([26, 8, 41])
    expect(report?.rows.find((row) => row.configId === 26)?.netKwd).toBe(-0.25)
    expect(report?.includedNetKwd).toBe(3.25)
    expect(report?.companyNetKwd).toBe(3.25)
    expect(report?.gapKwd).toBe(0)
  })

  it('omits the report when every row is excluded', () => {
    expect(
      buildRegisterReconciliation(
        [{ configId: 39, configName: 'synthetic excluded', netKwd: 1, orders: 1 }],
        0,
      ),
    ).toBeNull()
  })
})

describe('signed refund chart values', () => {
  it('prints a minus on a negative tick and keeps the Arabic thousands separator', () => {
    expect(formatCompactKwdTick(-2500, false)).toBe('-2.5k')
    expect(formatCompactKwdTick(16000, true)).toBe('16.0\u00A0ألف')
    expect(formatCompactKwdTick(-16000, true)).toBe('-16.0\u00A0ألف')
    expect(formatCompactKwdTick(0, false)).toBe('0')
  })

  it('draws a negative bar below the baseline with a positive height', () => {
    const html = renderToStaticMarkup(
      renderSignedBarShape({ x: 10, y: 40, width: 12, height: -18, fill: '#059669', radius: [6, 6, 0, 0] }),
    )
    expect(html).toContain('height="18"')
    expect(html).toContain('y="22"')
    expect(html).not.toContain('height="-18"')
  })
})
