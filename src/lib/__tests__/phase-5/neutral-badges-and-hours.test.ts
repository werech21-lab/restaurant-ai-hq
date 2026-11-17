/**
 * Phase 5 follow-up — neutral slate for the Read-Only Auditor badge and the Cores
 * "Unattributed to Branch" card, and contiguous hourly axes (no line across missing hours).
 * Rendering uses the live 2026-11-17 payload.
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeGlobalWorkspace, type GlobalFilters } from '@/lib/aether/global-filter-engine'
import { selectDisplayHours } from '@/lib/aether/hourly-integrity'
import { LanguageProvider } from '@/lib/i18n'
import { ThemeProvider } from '@/lib/theme'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'
import { todayFilters } from '../support/render-dashboard'

const ctx: { value: unknown } = { value: null }
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/aether/GlobalFilterContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/aether/GlobalFilterContext')>()),
  useGlobalFilter: () => ctx.value,
}))

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')
const NEUTRAL = ['bg-slate-100', 'text-slate-700', 'ring-slate-300/60', 'dark:bg-white/[0.06]']
const LangProvider = LanguageProvider as unknown as React.ComponentType<{ initialLocale: 'ar' | 'en'; children?: React.ReactNode }>
const Theme = ThemeProvider as unknown as React.ComponentType<{ initialTheme?: 'light' | 'dark'; children?: React.ReactNode }>

function setContext(filters: GlobalFilters, isAuditor: boolean) {
  const summary = loadLiveTodaySummary()
  ctx.value = {
    filters,
    workspace: computeGlobalWorkspace(filters, summary, '/erp'),
    liveSummary: summary,
    isAuditor,
    sessionRole: isAuditor ? 'auditor' : 'admin',
    syncingOdoo: false,
    syncCooldownSec: 0,
    triggerOdooSyncNow: async () => {},
    setPeriod: () => {},
    setCustomRange: () => {},
    setKuwaitSlice: () => {},
    setBrand: () => {},
    setBranch: () => {},
    setChannel: () => {},
    setLens: () => {},
    resetFilters: () => {},
    buildShareDeepLinkText: () => '',
  }
}

async function render(locale: 'ar' | 'en', node: React.ReactElement): Promise<string> {
  const { BiFilterProvider } = await import('@/components/aether/BiFilterContext')
  const { GovernanceProvider } = await import('@/components/erp/GovernanceBellDrawer')
  const Gov = GovernanceProvider as unknown as React.ComponentType<{ isAuditor: boolean; sessionRole: string; children?: React.ReactNode }>
  return renderToStaticMarkup(
    React.createElement(
      LangProvider,
      { initialLocale: locale },
      React.createElement(Theme, { initialTheme: 'light' }, React.createElement(BiFilterProvider, null, React.createElement(Gov, { isAuditor: true, sessionRole: 'auditor' }, node))),
    ),
  )
}

/** Opening tag of the first element carrying `attr="value"`. */
function openTag(html: string, attr: string, value: string): string | null {
  const i = html.indexOf(`${attr}="${value}"`)
  if (i < 0) return null
  return html.slice(html.lastIndexOf('<', i), html.indexOf('>', i) + 1)
}

describe('neutral slate badges', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('Read-Only Auditor badge in the top bar uses neutral slate (AR + EN)', async () => {
    setContext(todayFilters('all'), true)
    const { TopFilterBar } = await import('@/components/aether/TopFilterBar')
    for (const locale of ['ar', 'en'] as const) {
      const html = await render(locale, React.createElement(TopFilterBar))
      const tag = openTag(html, 'data-auditor-badge', 'bar')
      expect(tag, 'auditor badge rendered').not.toBeNull()
      for (const c of NEUTRAL) expect(tag).toContain(c)
      expect(tag).not.toMatch(/amber-|rose-/)
    }
  })

  it('both auditor badges (top bar + drawer) use the same neutral slate tokens in source', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('src/components/aether/TopFilterBar.tsx', 'utf8')
    for (const which of ['bar', 'drawer']) {
      const i = src.indexOf(`data-auditor-badge="${which}"`)
      expect(i).toBeGreaterThan(0)
      const tag = src.slice(i, src.indexOf('>', i))
      for (const c of NEUTRAL) expect(tag).toContain(c)
    }
  })

  it('Cores "Unattributed to Branch" card is neutral slate, not amber (AR + EN)', async () => {
    setContext(todayFilters('all'), false)
    const { CoresHubStudio } = await import('@/components/aether/CoresHubStudio')
    const Studio = CoresHubStudio as unknown as React.ComponentType<{ initialTab?: string }>
    for (const locale of ['ar', 'en'] as const) {
      const html = await render(locale, React.createElement(Studio, { initialTab: 'sales' }))
      const i = html.indexOf('data-unattributed-card="true"')
      expect(i, 'unattributed card rendered').toBeGreaterThan(0)
      const card = html.slice(html.lastIndexOf('<', i), html.indexOf('data-kpi-provenance', i) > 0 ? html.indexOf('data-kpi-provenance', i) : i + 2000)
      expect(card).toContain(locale === 'ar' ? 'غير منسوب لفرع' : 'Unattributed to Branch')
      expect(card).not.toMatch(/amber-|rose-/)
      expect(card).toContain('text-slate-')
    }
  })
})

describe('contiguous hourly axis', () => {
  // Real data only: the live 2026-11-17 payload's hourly series (it carries early-hour sales and a
  // real zero hour at 03:00). No hand-written hourly figures.
  const realHourly = loadLiveTodaySummary().hourlySeries ?? []

  it('once an early hour (00–08) is shown, every hour from it through 23:00 is drawn (zeros included)', () => {
    const hours = selectDisplayHours(realHourly)
    const firstEarly = Math.min(...realHourly.filter((r) => r.hour <= 8 && (r.netKwd !== 0 || r.orders !== 0)).map((r) => r.hour))
    expect(hours[0]).toBe(firstEarly)
    expect(hours).toEqual(Array.from({ length: 24 - firstEarly }, (_, i) => i + firstEarly))
    for (const zero of realHourly.filter((r) => r.netKwd === 0 && r.orders === 0 && r.hour >= firstEarly)) {
      expect(hours).toContain(zero.hour)
    }
  })

  it('with no hourly data at all, the axis is the contiguous 09:00–23:00 day (no gaps)', () => {
    expect(selectDisplayHours([])).toEqual(Array.from({ length: 15 }, (_, i) => i + 9))
  })

  it('never skips an hour: consecutive entries always differ by exactly one (real series)', () => {
    const hours = selectDisplayHours(realHourly)
    expect(hours[hours.length - 1]).toBe(23)
    for (let i = 1; i < hours.length; i++) expect(hours[i] - hours[i - 1]).toBe(1)
  })
})
