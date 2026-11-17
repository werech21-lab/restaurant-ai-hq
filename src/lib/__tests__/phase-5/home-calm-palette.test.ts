/**
 * Phase 5 · Item 8 — no amber or rose anywhere on Home (/erp).
 * Renders FullJourney360 from the live 2026-11-17 payload (AR + EN, all brands and a brand filter)
 * and also checks the component source, which covers states the real payload does not trigger
 * (e.g. the admin unmapped-terminals banner — the payload has 0 KWD unmapped).
 */
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/lib/i18n'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'
import { dashboardContext, renderAr, setDashboardContext, todayFilters } from '../support/render-dashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => dashboardContext.value,
}))

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')
const WARM = /\b(?:[a-z:]+:)?(?:bg|text|ring|border|from|to|via|fill|stroke|shadow)-(?:amber|rose)-/

const LangProvider = LanguageProvider as unknown as React.ComponentType<{ initialLocale: 'ar' | 'en'; children?: React.ReactNode }>
const renderEn = (node: React.ReactElement) =>
  renderToStaticMarkup(React.createElement(LangProvider, { initialLocale: 'en' }, node))

describe('Home has no amber or rose', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it.each(['all', 'china-garden'])('rendered Home (brand=%s) in AR and EN', async (brand) => {
    setDashboardContext(loadLiveTodaySummary(), todayFilters(brand))
    const { FullJourney360 } = await import('@/components/aether/FullJourney360')
    for (const html of [renderAr(React.createElement(FullJourney360)), renderEn(React.createElement(FullJourney360))]) {
      expect(html.match(WARM)?.[0] ?? null).toBeNull()
    }
  })

  it('FullJourney360 source has no amber/rose classes in any branch (incl. the admin banner)', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'src/components/aether/FullJourney360.tsx'), 'utf8')
    expect(src).not.toMatch(/amber-|rose-/)
    expect(src).toContain('data-admin-unmapped-banner="true"')
  })
})
