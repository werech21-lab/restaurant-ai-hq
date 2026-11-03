import { describe, expect, it } from 'vitest'
import {
  buildOperationalForensicReport,
  classifyOperationalReport,
  renderOperationalReportText,
} from '@/lib/reports/operational-forensic-report'
import { buildForensicMatrix } from '@/modules/governance/domain/forensic-radar'

describe('operational-forensic-report', () => {
  const at = new Date('2026-11-02T15:30:00.000Z') // Kuwait evening peak window

  it('is deterministic for the same snapshot clock', () => {
    const snap = buildForensicMatrix(at)
    const a = buildOperationalForensicReport([snap], at)
    const b = buildOperationalForensicReport([snap], at)
    expect(a.en).toBe(b.en)
    expect(a.ar).toBe(b.ar)
    expect(a.sections.critical.length).toBe(b.sections.critical.length)
  })

  it('renders Growdash-style EN structure with all four sections', () => {
    const snap = buildForensicMatrix(at)
    const sections = classifyOperationalReport([snap], at)
    const text = renderOperationalReportText(sections, 'en')
    expect(text).toContain('DAILY OPERATIONAL & FORENSIC REPORT — VENTURE FOODS')
    expect(text).toContain('1. CRITICAL ISSUES')
    expect(text).toContain('2. WATCH LIST')
    expect(text).toContain('3. TALABAT & AGGREGATORS COMMISSION AUDIT')
    expect(text).toContain('4. CLEAN BRANCHES')
    expect(text).toContain('Account 101513')
    expect(text).toContain('Account 101512')
    expect(text).toContain('Sec@venturefoodskw.com')
    expect(text).toContain('operations@venturefoodskw.com')
    expect(text).toContain('abdelrahmanm@venturefoodskw.com')
    expect(text).toContain('https://aetherbi.com/erp/aggregator-radar')
    expect(text).toContain('SUMMARY:')
  })

  it('renders Arabic twin with exclusive recipients lock', () => {
    const snap = buildForensicMatrix(at)
    const report = buildOperationalForensicReport([snap], at)
    expect(report.ar).toContain('التقرير التشغيلي والجنائي اليومي المفصل')
    expect(report.ar).toContain('Sec@venturefoodskw.com')
    expect(report.combined).toContain(report.en)
    expect(report.combined).toContain(report.ar)
  })
})
