/** M7 — company-wide cards say so when a brand is selected. Assertions render the real component. */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCOPE_LABELS } from '@/lib/aether/brand-scope'
import { buildAllocatedTodaySummary, loadLiveTodaySummary } from './support/dashboard-fixture'
import { dashboardContext, renderAr, scopeBadgesOf, setDashboardContext, todayFilters } from './support/render-dashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => dashboardContext.value,
}))

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')

async function render(summary = loadLiveTodaySummary(), brand = 'china-garden'): Promise<string> {
  setDashboardContext(summary, todayFilters(brand))
  const { FullJourney360 } = await import('@/components/aether/FullJourney360')
  return renderAr(React.createElement(FullJourney360))
}

describe('M7 — company-wide cards say so when a brand is selected', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('labels match the agreed wording', () => {
    expect(SCOPE_LABELS.companyWide.ar).toBe('على مستوى الشركة')
    expect(SCOPE_LABELS.allBrands.ar).toBe('كل العلامات')
    expect(SCOPE_LABELS.unavailableForFilter.ar).toBe('غير متاح لهذا الفلتر')
    expect(SCOPE_LABELS.noComparison.ar).toBe('لا توجد مقارنة')
  })

  it('M7: the GL and AR cards render the company-wide badge only when brand ≠ all', async () => {
    const brandHtml = await render()
    expect(scopeBadgesOf(brandHtml)['gl-operating-net']).toBeUndefined()
    expect(brandHtml).not.toContain('دفتر الأستاذ غير مقسّم حسب هذا الفلتر')
    expect(scopeBadgesOf(brandHtml)['ledger-ar']).toBe('company-wide')
    const allHtml = await render(loadLiveTodaySummary(), 'all')
    expect(scopeBadgesOf(allHtml)['gl-operating-net']).toBeUndefined()
    expect(scopeBadgesOf(allHtml)['ledger-ar']).toBeUndefined()
  })

  it('the pulse, delta badge, branch cards and brand basis carry their scope labels (live payload)', async () => {
    const html = await render()
    expect(scopeBadgesOf(html)['weekly-pulse']).toBe('all-brands')
    expect(html).toContain('data-delta-comparison="none"')
    expect(html).not.toContain(SCOPE_LABELS.unavailableForFilter.ar)
    expect(html).toContain('data-brand-basis="product-lines"')
  })

  it('order-allocated payload: the multi-brand orders note is shown and the basis line is not', async () => {
    const html = await render(buildAllocatedTodaySummary())
    expect(html).toContain(SCOPE_LABELS.multiBrandOrders.ar)
    expect(html).not.toContain('data-brand-basis="product-lines"')
  })
})
