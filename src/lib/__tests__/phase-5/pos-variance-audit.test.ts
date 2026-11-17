import { describe, expect, it } from 'vitest'
import registry from '@/lib/odoo/pos-registry.json'
import { buildVarianceReport, classifyRegister, kuwaitRangeToOdooUtc } from '../../../../scripts/lib/pos-variance-lib.mjs'

describe('Phase 5 · Item 6 — per-register POS variance audit helpers', () => {
  it('maps Kuwait calendar days to Odoo UTC bounds (UTC+3)', () => {
    expect(kuwaitRangeToOdooUtc('2026-11-01', '2026-11-17')).toEqual({
      fromUtc: '2026-10-31 21:00:00',
      toExclusiveUtc: '2026-11-17 21:00:00',
    })
  })

  it('classifies registers against the pos-registry whitelist', () => {
    expect(classifyRegister(19, registry).category).toBe('restaurant')
    expect(classifyRegister(26, registry).category).toBe('exhibition')
    expect(classifyRegister(43, registry).category).toBe('school-canteen')
    expect(classifyRegister(24, registry).category).toBe('not-whitelisted')
  })

  it('separates exhibition booths and flags the basis gap that explains the target variance', () => {
    const report = buildVarianceReport(
      [
        { configId: 19, configName: 'Salmiya', orders: 100, grossKwd: 10_000, taxKwd: 0 },
        { configId: 26, configName: 'Booth A', orders: 20, grossKwd: 1_000, taxKwd: 0 },
        { configId: 27, configName: 'Booth B', orders: 15, grossKwd: 723, taxKwd: 0 },
        { configId: 24, configName: 'Old register', orders: 3, grossKwd: 50, taxKwd: 0 },
      ],
      registry,
      { targetVarianceKwd: 1723 },
    )
    expect(report.byCategory.exhibition.netKwd).toBe(1723)
    const hit = report.gaps.find((g: { matchesTarget: boolean }) => g.matchesTarget)
    expect(hit?.a).toBe('whitelisted')
    expect(hit?.b).toBe('whitelistedExclBooths')
  })
})
