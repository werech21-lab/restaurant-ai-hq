/**
 * /erp/decisions — Decision Room, rendered from the real council run on the 17 Nov 2026 payload
 * (and the same payload for the browser-side analysis views). No hand-written sales figures.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DecisionRoomView, type DecisionRoomTab } from '@/components/aether/DecisionRoomStudio'
import { decisionFromFinding, measureDecisionOutcome } from '@/lib/council/decisions'
import { summaryFindings, templateSummary } from '@/lib/council/executive-summary'
import { runCouncil } from '@/lib/council/runner'
import { completedDailyByBranch } from '@/lib/council/series'
import { checkSummaryLines, executiveSummaryFor } from '@/server/council/executive-summary'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'

const summary = loadLiveTodaySummary()
const snap = runCouncil({ cfo: { summary }, seasons: { summary, events: [] }, drivers: { summary }, benchmark: { summary }, forecast: { summary } })
const all = snap.reports.flatMap((r) => r.findings)
const promenade = all.find((f) => f.kind === 'branch-driver-down')!
const decided = {
  ...decisionFromFinding(promenade, { fingerprint: promenade.fingerprint, status: 'testing', note: null }, { id: 'd1', decidedBy: 'gm', decidedAt: '2026-10-19T09:00:00.000Z', decidedDay: '2026-10-19' }),
  outcome: measureDecisionOutcome({ decidedDay: '2026-10-19', branchId: 'promenade' }, completedDailyByBranch(summary)),
}

const render = (locale: 'ar' | 'en', tab: DecisionRoomTab, extra: Partial<Parameters<typeof DecisionRoomView>[0]> = {}) =>
  renderToStaticMarkup(createElement(DecisionRoomView, { locale, generatedAt: snap.generatedAt, reports: snap.reports, summary: templateSummary(snap), decisions: [], canDecide: true, liveSummary: summary, initialTab: tab, onDecide: () => {}, ...extra }))

describe('Decision Room', () => {
  it.each(['ar', 'en'] as const)('%s: summary, ranked proposal cards with evidence, Estimate formula and decide buttons', (locale) => {
    const html = render(locale, 'all')
    expect(html).toContain(locale === 'ar' ? 'غرفة القرار' : 'Decision Room')
    expect(html).toContain('data-executive-summary="template"')
    expect(html).toContain(`data-room-finding="${promenade.fingerprint}"`)
    expect(html).toMatch(/data-room-estimate="true"/)
    expect(html.match(/data-decide="accepted"/g)!.length).toBeGreaterThan(2)
    expect(html).not.toMatch(/(?:^|[^\d.,+-])0\.000(?!\d)/)
  })

  it('auditors and other roles see the proposals without decide buttons', () => {
    expect(render('ar', 'all', { canDecide: false })).not.toContain('data-decide=')
  })

  it('drivers view: branch bars add up to the company change; benchmark heat map; forecast with its backtest error', () => {
    const d = render('en', 'drivers')
    expect(d).toContain('data-room-view="drivers"')
    expect(d.match(/data-driver-row=/g)).toHaveLength(7)
    const b = render('en', 'benchmark')
    expect(b.match(/data-benchmark-row=/g)).toHaveLength(7)
    expect(b).toContain('data-weekday-heatmap="true"')
    const f = render('en', 'forecast')
    expect(f).toContain('data-forecast-bars="true"')
    expect(f).toContain('10.0%')
    expect(f).toContain('data-market-wide="true"')
    expect(f).toContain('data-anomaly="promenade:2026-11-14"')
  })

  it('without the payload the analysis views and their tabs are not rendered at all — no empty card', () => {
    for (const tab of ['drivers', 'benchmark', 'forecast'] as const) {
      const html = render('ar', tab, { liveSummary: null })
      expect(html).not.toMatch(/data-room-view=/)
      expect(html).not.toContain(`data-room-tab="${tab}"`)
      expect(html).not.toContain('data-unavailable="true"')
      // Falls back to "all": the proposals are still there.
      expect(html).toContain('data-room-tab="all"')
      expect(html).toContain('data-room-finding=')
    }
  })

  it('menu and log tabs are only offered when they have content; no empty-section cards', () => {
    const html = render('en', 'log')
    expect(html).not.toContain('data-room-tab="menu"')
    expect(html).not.toContain('data-room-tab="log"')
    expect(html).not.toContain('data-decision-log')
    expect(html).not.toContain('No proposal in this section')
    expect(render('en', 'log', { decisions: [decided] })).toContain('data-room-tab="log"')
  })

  it('a decided proposal shows its status; the log shows the measured lift against the peers', () => {
    const cards = render('en', 'all', { decisions: [decided] })
    expect(cards).toMatch(new RegExp(`data-room-finding="${promenade.fingerprint}"[\\s\\S]*?data-decision-status="testing"`))
    const log = render('en', 'log', { decisions: [decided] })
    expect(log).toContain(`data-decision-row="${promenade.fingerprint}"`)
    expect(decided.outcome.state).toBe('measured')
    expect(log).toContain(`${decided.outcome.changePct! > 0 ? '+' : ''}${decided.outcome.changePct!.toFixed(1)}%`)
    expect(log).toContain(`${decided.outcome.peersChangePct! > 0 ? '+' : ''}${decided.outcome.peersChangePct!.toFixed(1)}%`)
  })

  it('no stored council run still renders drivers, branches and forecast from daily POS', () => {
    const html = render('ar', 'all', { reports: [], summary: null, generatedAt: null })
    expect(html).toContain('غرفة القرار')
    expect(html).toContain('data-room-view="drivers"')
    expect(html).toContain('data-room-tab="drivers"')
    expect(html).toContain('data-room-tab="benchmark"')
    expect(html).toContain('data-room-tab="forecast"')
    expect(html).not.toContain('data-room-tab="all"')
    expect(html).not.toContain('data-room-finding=')
    expect(html).not.toContain('data-unavailable="true"')
    expect(render('en', 'benchmark', { reports: [], summary: null, generatedAt: null })).toContain('data-room-view="benchmark"')
    expect(render('en', 'forecast', { reports: [], summary: null, generatedAt: null })).toContain('data-room-view="forecast"')
  })

  it('no stored council run and no daily series renders the header only', () => {
    const html = render('ar', 'all', { reports: [], summary: null, generatedAt: null, liveSummary: null })
    expect(html).toContain('غرفة القرار')
    expect(html).not.toContain('data-room-tab=')
    expect(html).not.toContain('data-room-view=')
  })
})

describe('executive summary guard', () => {
  afterEach(() => vi.unstubAllEnvs())
  const picks = summaryFindings(snap, 5)
  const tmpl = templateSummary(snap)
  const tagged = tmpl.ar.map((line, i) => `[F${i + 1}] ${line}`)
  const marketIdx = picks.findIndex((f) => f.kind === 'market-wide-drop')

  it('the template lines, tagged with their own finding, pass; tags are stripped for display', () => {
    expect(tmpl.basis).toEqual(picks.slice(0, tmpl.ar.length).map((f) => f.fingerprint))
    const r = checkSummaryLines(tagged, picks)
    expect(r.failures).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.lines).toEqual(tmpl.ar)
  })

  it("a line quoting another finding's numbers fails", () => {
    const other = (marketIdx + 1) % tmpl.ar.length
    const r = checkSummaryLines([`[F${other + 1}] ${tmpl.ar[marketIdx]}`], picks)
    expect(r.ok).toBe(false)
    expect(r.failures.some((f) => f.reason === 'number' || f.reason === 'date')).toBe(true)
  })

  it('an invented number, a bare day / month integer, a wrong date, or a missing / unknown tag fails', () => {
    const tag = `[F${marketIdx + 1}]`
    expect(checkSummaryLines([`${tag} ارتفعت المبيعات 12.345 د.ك`], picks).failures).toEqual([{ line: 0, reason: 'number', token: '12.345' }])
    expect(checkSummaryLines([`${tag} يوم 13 من شهر 11`], picks).failures.map((f) => f.token)).toEqual(['13', '11'])
    expect(checkSummaryLines([`${tag} 2026-11-13 تراجع عام`], picks).ok).toBe(true)
    expect(checkSummaryLines([`${tag} 2026-11-12 تراجع عام`], picks).failures).toEqual([{ line: 0, reason: 'date', token: '2026-11-12' }])
    expect(checkSummaryLines([tmpl.ar[0]], picks).failures).toEqual([{ line: 0, reason: 'no-finding-tag' }])
    expect(checkSummaryLines([`[F9] ${tmpl.ar[0]}`], picks).failures[0].reason).toBe('unknown-finding')
  })

  it('without a provider key the template is served (no provider call)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const s = await executiveSummaryFor(snap)
    expect(s.source).toBe('template')
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
