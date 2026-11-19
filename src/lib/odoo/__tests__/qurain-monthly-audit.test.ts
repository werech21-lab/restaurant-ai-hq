import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import {
  buildQurainMonthlyReport,
  isQurainLabel,
  renderQurainMonthlyMarkdown,
} from '../../../../scripts/lib/qurain-audit-lib.mjs'

describe('Qurain monthly audit', () => {
  it('matches Qurain names and leaves Qurainy Dates and Shawali alone', () => {
    expect(isQurainLabel('Qurain Kitchen')).toBe(true)
    expect(isQurainLabel('القرين')).toBe(true)
    expect(isQurainLabel('Qurainy Dates')).toBe(false)
    expect(isQurainLabel('Shawali')).toBe(false)
  })

  it('does not flip the company exclusion', () => {
    expect(isExcludedOdooEntity('القرين')).toBe(false)
    expect(isExcludedOdooEntity('Qurain')).toBe(false)
    expect(isExcludedOdooEntity('Delivery (Qurain)')).toBe(false)
  })

  it('groups synthetic sales and omits accounts when they were not readable', () => {
    const report = buildQurainMonthlyReport({
      configs: [
        { id: 4, name: 'Qurain Kitchen', active: true },
        { id: 5, name: 'Promenade', active: true },
      ],
      sales: [
        { month: '2026-11-01', configId: 4, configName: 'Qurain Kitchen', orders: 2, netKwd: -1.5 },
        { month: '2026-11-01', configId: 4, configName: 'Qurain Kitchen', orders: 3, netKwd: 4 },
      ],
      accounts: null,
    })
    expect(report.configs.map((row) => row.id)).toEqual([4])
    expect(report.sales).toEqual([
      { month: '2026-11', configId: 4, configName: 'Qurain Kitchen', orders: 2, netKwd: -1.5 },
      { month: '2026-11', configId: 4, configName: 'Qurain Kitchen', orders: 3, netKwd: 4 },
    ])
    expect(report.accounts).toBeNull()
    const markdown = renderQurainMonthlyMarkdown(report, {
      fromIso: '2026-11-01',
      toIso: '2026-11-30',
      generatedAt: '2026-11-19T00:00:00.000Z',
    })
    expect(markdown).toContain('still excluded')
    expect(markdown).toContain('omitted')
    expect(markdown).toContain('-1.500')
  })

  it('the runner only calls read methods', () => {
    const source = readFileSync(new URL('../../../../scripts/audit-qurain-monthly.mjs', import.meta.url), 'utf8')
    expect(source).toContain("new Set(['search_read', 'read', 'read_group', 'search_count', 'fields_get'])")
    expect(source).not.toMatch(/execute_kw[\s\S]{0,80}'(?:create|write|unlink)'/)
  })
})
