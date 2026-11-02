import { describe, expect, it } from 'vitest'
import {
  buildForensicMatrix,
  cleanBranchLabel,
  commissionPenaltyMinor,
  displayBrandName,
  filterForensicRows,
  formatKwdMinor,
  PENALTY_BPS,
} from '@/modules/governance/domain/forensic-radar'

describe('forensic-radar domain', () => {
  it('is deterministic for the same clock bucket', () => {
    const at = new Date('2026-11-02T10:00:00.000Z')
    const a = buildForensicMatrix(at)
    const b = buildForensicMatrix(at)
    expect(a.bucket).toBe(b.bucket)
    expect(a.rows.length).toBe(b.rows.length)
    expect(a.rows[0]?.id).toBe(b.rows[0]?.id)
    expect(a.kpis.financialImpactMinor).toBe(b.kpis.financialImpactMinor)
  })

  it('charges exactly +7% penalty on TGO GMV', () => {
    expect(commissionPenaltyMinor(100_000, 'TGO')).toBe(Math.round((100_000 * PENALTY_BPS) / 10_000))
    expect(commissionPenaltyMinor(100_000, 'TMP')).toBe(0)
  })

  it('formats KWD with three decimals and cleans branch labels', () => {
    expect(formatKwdMinor(1234)).toBe('1.234 KWD')
    expect(cleanBranchLabel('Farm Brown /Debit', 'Al-Kout Mall')).toBe('Al-Kout Mall')
    expect(displayBrandName('Karak Cafeteria', 'كرك كافتيريا', 'en')).toBe('Karak Cafeteria')
  })

  it('filters by brand scope', () => {
    const snap = buildForensicMatrix(new Date('2026-11-02T12:00:00.000Z'))
    const china = filterForensicRows(snap.rows, { brandId: 'CHINA-GARDEN' })
    expect(china.length).toBeGreaterThan(0)
    expect(china.every((row) => row.brandId === 'CHINA-GARDEN')).toBe(true)
  })
})
