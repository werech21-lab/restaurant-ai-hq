import { describe, expect, it } from 'vitest'
import { buildOpenReceivableClauses, openReceivableLineIncluded } from '@/lib/odoo/receivable-domain'

describe('open receivable lines include journal entries and drop 10552', () => {
  it('does not filter move_type and names the receivable account codes', () => {
    const domain = buildOpenReceivableClauses()
    const flat = JSON.stringify(domain)
    expect(flat).not.toContain('move_type')
    expect(flat).not.toContain('out_invoice')
    expect(flat).toContain('10501')
    expect(flat).toContain('10509')
    expect(flat).toContain('121000')
    expect(flat).not.toContain('10552')
  })

  it('keeps entry lines on 10501–10509 and the credits from the same balances', () => {
    const lines = [
      { accountCode: '121000', accountType: 'asset_receivable', moveType: 'out_invoice', parentState: 'posted', reconciled: false, residualKwd: 1912.225 },
      { accountCode: '10501', accountType: 'asset_receivable', moveType: 'entry', parentState: 'posted', reconciled: false, residualKwd: 29749.822 },
      { accountCode: '10509', accountType: 'asset_receivable', moveType: 'entry', parentState: 'posted', reconciled: false, residualKwd: -1351.372 },
      { accountCode: '10552', accountType: 'asset_receivable', moveType: 'entry', parentState: 'posted', reconciled: false, residualKwd: -992.319 },
    ]
    const kept = lines.filter(openReceivableLineIncluded)
    expect(kept.map((line) => line.accountCode)).toEqual(['121000', '10501', '10509'])
    const credits = kept.filter((line) => line.residualKwd < 0).reduce((sum, line) => sum + line.residualKwd, 0)
    const net = kept.reduce((sum, line) => sum + line.residualKwd, 0)
    expect(Math.round(credits * 1000) / 1000).toBe(-1351.372)
    expect(Math.round(net * 1000) / 1000).toBe(30310.675)
  })
})
