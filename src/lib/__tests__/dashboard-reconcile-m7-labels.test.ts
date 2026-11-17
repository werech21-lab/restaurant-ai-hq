import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SCOPE_LABELS } from '@/lib/aether/brand-scope'

const SOURCE = fs.readFileSync(
  path.resolve(import.meta.dirname, '../../components/aether/FullJourney360.tsx'),
  'utf8',
)

describe('M7 — company-wide cards say so when a brand is selected', () => {
  it('labels match the agreed wording', () => {
    expect(SCOPE_LABELS.companyWide.ar).toBe('على مستوى الشركة')
    expect(SCOPE_LABELS.allBrands.ar).toBe('كل العلامات')
    expect(SCOPE_LABELS.unavailableForFilter.ar).toBe('غير متاح لهذا الفلتر')
    expect(SCOPE_LABELS.noComparison.ar).toBe('لا توجد مقارنة')
  })

  it('M7 RED→GREEN: the AR and GL cards render the company-wide badge only when brand ≠ all', () => {
    expect(SOURCE).toMatch(/const companyWideBadge =\s*filters\.brand !== 'all' \?/)
    expect(SOURCE.match(/\{companyWideBadge\}/g)?.length ?? 0).toBe(2)
    const glTitle = SOURCE.indexOf("T('Operating Net Profit (GL)'")
    const arTitle = SOURCE.indexOf("T('Ledger AR'")
    expect(SOURCE.indexOf('{companyWideBadge}', glTitle) - glTitle).toBeLessThan(300)
    expect(SOURCE.indexOf('{companyWideBadge}', arTitle) - arTitle).toBeLessThan(300)
  })

  it('the pulse, delta badge, branch cards and brand basis carry their scope labels', () => {
    expect(SOURCE).toContain("data-scope-badge=\"all-brands\"")
    expect(SOURCE).toContain('SCOPE_LABELS.noComparison')
    expect(SOURCE).toContain('SCOPE_LABELS.unavailableForFilter')
    expect(SOURCE).toContain('data-brand-basis="product-lines"')
    expect(SOURCE).toContain('SCOPE_LABELS.multiBrandOrders')
    expect(SOURCE).toContain('data-ar-unapplied-credits="true"')
  })
})
