/**
 * Home «اكتشافات اليوم / Today's Discoveries» and the /erp/seasons view, rendered from the real
 * council run (17 Nov payload + 31 Oct Odoo export). Missing council → unavailable state, no 0.000.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TodaysDiscoveriesView } from '@/components/aether/TodaysDiscoveries'
import { SeasonsStudioView } from '@/components/erp/SeasonsStudio'
import { SUGGESTED_SEASON_EVENTS } from '@/lib/council/advisors/seasons'
import { runCouncil } from '@/lib/council/runner'
import { loadLiveTodaySummary, realHrInput, realInventoryInput } from './support'

const s = loadLiveTodaySummary()
const snap = runCouncil({ cfo: { summary: s }, hr: realHrInput(), inventory: realInventoryInput(), seasons: { summary: s, events: SUGGESTED_SEASON_EVENTS } })

describe("Today's Discoveries", () => {
  it.each(['ar', 'en'] as const)('%s: three cards with evidence, source and labelled Estimate', (locale) => {
    const html = renderToStaticMarkup(createElement(TodaysDiscoveriesView, { locale, discoveries: snap.discoveries }))
    expect(html).toContain(locale === 'ar' ? 'اكتشافات اليوم' : "Today&#x27;s Discoveries")
    expect(html.match(/data-discovery=/g)).toHaveLength(3)
    for (const d of snap.discoveries) expect(html).toContain(locale === 'ar' ? d.finding.titleAr.replace(/"/g, '&quot;') : d.finding.titleEn.replace(/"/g, '&quot;').replace(/'/g, '&#x27;'))
    expect(html).toContain('Odoo · pos.order')
    expect(html).toMatch(/data-estimate="true"[^>]*>.*(?:Estimate|تقدير).* = /)
    expect(html).not.toMatch(/(?:^|[^\d.,])0\.000(?!\d)/)
  })

  it('without a stored council run: unavailable state, no figures', () => {
    for (const locale of ['ar', 'en'] as const) {
      const html = renderToStaticMarkup(createElement(TodaysDiscoveriesView, { locale, discoveries: null }))
      expect(html).toContain('data-unavailable="true"')
      expect(html).not.toMatch(/\d+\.\d{3}/)
    }
  })
})

describe('/erp/seasons', () => {
  const report = snap.reports.find((r) => r.advisorId === 'seasons')!
  it.each(['ar', 'en'] as const)('%s: salary days show the comparison and prep plan; Ramadan shows its data gap', (locale) => {
    const html = renderToStaticMarkup(createElement(SeasonsStudioView, { locale, events: [...SUGGESTED_SEASON_EVENTS], suggested: true, report, canEdit: true }))
    expect(html).toContain('data-season="salary-days"')
    expect(html).toContain(locale === 'ar' ? 'خطة التحضير' : 'Prep plan')
    expect(html).toMatch(/data-season="ramadan-2027"[\s\S]*?data-season-gap="true"/)
    expect(html).not.toMatch(/(?:^|[^\d.,])0\.000(?!\d)/)
  })

  it('calendar unreadable → unavailable state', () => {
    const html = renderToStaticMarkup(createElement(SeasonsStudioView, { locale: 'ar', events: null, suggested: false, report: null, canEdit: false }))
    expect(html).toContain('data-unavailable="true"')
  })
})
