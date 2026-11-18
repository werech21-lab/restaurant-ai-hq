/**
 * Guards for the visual defects found in the full-site review (local production build, AR/EN,
 * desktop/phone, real 17 Nov payload). Each test pins the root cause, not a pixel.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatCompactKwdTick } from '@/components/charts/v35-chart-theme'
import { computeCoresHubSnapshot } from '@/lib/aether/cores-hub-engine'
import { DEFAULT_GLOBAL_FILTERS, computeGlobalWorkspace } from '@/lib/aether/global-filter-engine'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
const css = read('src/app/globals.css')

describe('global CSS', () => {
  it('white-text overrides match solid colour tokens only — never pale tints or dark:/hover: variants', () => {
    // A substring match on "bg-emerald-6" also hit bg-emerald-600/10 chips and dark:bg-emerald-600
    // links, turning their text white on a white surface (Feryal model chips, "New Journal Entry").
    expect(css).not.toMatch(/\[class\*="bg-(blue|emerald|red|purple|indigo|teal)-6"\]/)
    expect(css).not.toMatch(/\[class\*="bg-amber-5"\]/)
    expect(css).toContain('[class*=" bg-emerald-6"]')
    expect(css).toContain('[class*="bg-emerald-600/1"]')
  })

  it('white text on solid emerald / teal meets AA (darkened to the 700 shade in light theme)', () => {
    expect(css).toMatch(/html:not\(\.dark\) \[class~="bg-emerald-600"\] \{ background-color: #047857 !important; \}/)
    expect(css).toMatch(/html:not\(\.dark\) \[class~="bg-teal-600"\] \{ background-color: #0F766E !important; \}/)
    expect(css).toContain(':is(html.dark, html[data-theme=\'dark\']) :is([class~="bg-emerald-600"], [class~="dark:bg-emerald-600"]) { background-color: #047857 !important; }')
  })

  it('numeric span safety rule has zero specificity, so inline-flex / hidden / gap utilities still apply', () => {
    expect(css).toContain(':where(span.tabular-nums) {')
    expect(css).not.toMatch(/^span\.tabular-nums \{/m)
  })
})

describe('components', () => {
  it('hero KPI value is sized from its own column (container query), not the viewport', () => {
    const ring = read('src/components/aether/v35/V35KpiRing.tsx')
    expect(ring).toContain('[container-type:inline-size]')
    expect(ring).not.toContain('1.9vw')
    expect(read('src/components/aether/FullJourney360.tsx')).not.toContain('1.9vw')
  })

  it('Arabic compact axis ticks never wrap («16.0 ألف» on one line)', () => {
    expect(formatCompactKwdTick(16000, true)).toBe('16.0 ألف')
    expect(formatCompactKwdTick(16000, false)).toBe('16.0k')
  })

  it('the odoo-sync console help wraps its long URL on phones', () => {
    expect(read('src/modules/odoo/ui/OdooSync.tsx')).toContain("[overflow-wrap:anywhere]\">{t('odoo.consoleHelp')}")
  })

  it('the auto-translator waits for the page to load before touching the DOM (no hydration mismatch)', () => {
    const tr = read('src/components/GlobalAutoTranslator.tsx')
    expect(tr).toContain("window.addEventListener('load', startAfterLoad, { once: true })")
  })
})

describe('missing sections show «غير متاح», never 0.000 (real 17 Nov payload, Month)', () => {
  const summary = loadLiveTodaySummary()
  const month = { ...DEFAULT_GLOBAL_FILTERS, period: 'month' as const }
  it('the Month bucket carries totals only: channel split is unavailable on Cores', () => {
    expect(summary.buckets?.month && 'uiChannels' in summary.buckets.month).toBe(false)
    const snap = computeCoresHubSnapshot(month, [], summary)
    expect(snap.sales.channelsUnavailable).toBe(true)
  })
  it('brand options carry no 0.000 sales when the bucket has no brand section', () => {
    const ws = computeGlobalWorkspace(month, summary)
    for (const b of ws.cascadingOptions.brands.filter((o) => o.id !== 'all')) expect(b.salesKwd).toBeUndefined()
  })
})
