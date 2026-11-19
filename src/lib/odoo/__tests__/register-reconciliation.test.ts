import { describe, expect, it } from 'vitest'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import { DEFAULT_GLOBAL_FILTERS } from '@/lib/aether/global-filter-engine'
import { buildReconciledBucket } from '@/lib/odoo-live-connector'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
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
    expect(classifyIncludedRegister(24, 'Closed register')).toBe('restaurant')
    expect(classifyIncludedRegister(25, 'Jahra')).toBeNull()
    expect(classifyIncludedRegister(8, 'Qurain kitchen')).toBe('restaurant')
    expect(classifyIncludedRegister(4, 'Delivery (Qurain)')).toBeNull()
    expect(classifyIncludedRegister(24, 'Delivery (Qurain)')).toBe('restaurant')
    expect(classifyIncludedRegister(36, 'Delivery (Qurain Temp)')).toBe('restaurant')
    expect(classifyIncludedRegister(8, 'هايزن بريج')).toBeNull()
  })

  it('sums included registers, including a synthetic negative refund, against the company net', () => {
    // Synthetic labelled nets, not a live Odoo extract.
    const report = buildRegisterReconciliation(
      [
        { configId: 8, configName: 'synthetic promenade', netKwd: 2, orders: 4 },
        { configId: 41, configName: 'synthetic canteen', netKwd: 1.5, orders: 2 },
        { configId: 26, configName: 'synthetic booth', netKwd: -0.25, orders: 1 },
        { configId: 40, configName: 'synthetic excluded', netKwd: 9, orders: 3 },
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

describe('connector bucket register reconciliation', () => {
  it('keeps the allowed configs in a connector-shaped bucket and drops the exclusions', () => {
    const included = [
      { configId: 8, configName: 'labelled promenade 8', netKwd: 1.1, orders: 1 },
      { configId: 9, configName: 'labelled promenade 9', netKwd: 1.2, orders: 1 },
      { configId: 10, configName: 'labelled promenade 10', netKwd: 1.3, orders: 1 },
      { configId: 11, configName: 'labelled promenade 11', netKwd: 1.4, orders: 1 },
      ...[26, 27, 28, 29, 30, 31, 32, 33, 37, 38].map((configId) => ({
        configId,
        configName: `labelled booth ${configId}`,
        netKwd: 0.1,
        orders: 1,
      })),
      { configId: 41, configName: 'labelled canteen 41', netKwd: 0.3, orders: 1 },
      { configId: 42, configName: 'labelled canteen 42', netKwd: 0.3, orders: 1 },
      { configId: 43, configName: 'labelled canteen 43', netKwd: 0.3, orders: 1 },
      { configId: 24, configName: 'Delivery (Qurain)', netKwd: 9, orders: 1 },
    ]
    const excluded = [
      { configId: 25, configName: 'labelled closed 25', netKwd: 9, orders: 1 },
      { configId: 39, configName: 'labelled closed 39', netKwd: 9, orders: 1 },
      { configId: 40, configName: 'labelled closed 40', netKwd: 9, orders: 1 },
      { configId: 9001, configName: 'Jahra register', netKwd: 9, orders: 1 },
      { configId: 9002, configName: 'هايزن بريج', netKwd: 9, orders: 1 },
    ]
    const includedNet = Math.round(included.reduce((sum, row) => sum + row.netKwd, 0) * 1000) / 1000
    const bucket = buildReconciledBucket({
      key: 'month',
      from: '2026-11-01',
      to: '2026-11-19',
      days: 18,
      locNetMap: new Map([['promenade', includedNet]]),
      locOrdersMap: new Map([['promenade', included.length]]),
      brandRawWeights: new Map([['china-garden', includedNet]]),
      brandQtyWeights: new Map([['china-garden', 1]]),
      locUiRawMap: new Map(),
      registerRows: [...included, ...excluded],
    })
    const summary = {
      source: 'live',
      connected: true,
      sourceMode: 'odoo17-live',
      syncedAt: '2026-11-19T00:00:00.000Z',
      noData: false,
      buckets: { month: bucket },
    } as OdooLiveSummary
    const snap = computeCoresHubSnapshot({ ...DEFAULT_GLOBAL_FILTERS, period: 'month' }, [], summary)
    const ids = snap.sales.registerReconciliation?.rows.map((row) => row.configId) ?? []
    expect(ids).toEqual(expect.arrayContaining([8, 9, 10, 11, 26, 33, 37, 38, 41, 42, 43]))
    expect(ids).toContain(24)
    for (const id of [25, 39, 40, 9001, 9002]) {
      expect(ids).not.toContain(id)
    }
    expect(snap.sales.registerReconciliation?.includedNetKwd).toBe(includedNet)
    expect(snap.sales.registerReconciliation?.gapKwd).toBe(0)
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
