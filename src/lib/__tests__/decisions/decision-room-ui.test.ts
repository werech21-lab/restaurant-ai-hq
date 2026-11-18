/**
 * /erp/decisions — Decision Room, rendered from the real council run on the 17 Nov 2026 payload
 * (and the same payload for the browser-side analysis views). No hand-written sales figures.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DecisionRoomView, type DecisionRoomTab } from '@/components/aether/DecisionRoomStudio'
import { decisionFromFinding, measureDecisionOutcome } from '@/lib/council/decisions'
import { summaryFactNumbers, templateSummary } from '@/lib/council/executive-summary'
import { runCouncil } from '@/lib/council/runner'
import { completedDailyByBranch } from '@/lib/council/series'
import { guardAnswerNumbers } from '@/server/ai/number-guard'
import { executiveSummaryFor, summaryAllowedTokens } from '@/server/council/executive-summary'
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

  it('without the payload the analysis views say what is missing — never 0.000', () => {
    for (const tab of ['drivers', 'benchmark', 'forecast'] as const) {
      const html = render('ar', tab, { liveSummary: null })
      expect(html).toContain('data-unavailable="true"')
      expect(html).not.toMatch(/data-room-view=/)
    }
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

  it('no stored council run → unavailable state with no figures', () => {
    const html = render('ar', 'all', { reports: [], summary: null, generatedAt: null })
    expect(html).toContain('data-unavailable="true"')
    expect(html).not.toMatch(/\d+\.\d{3}/)
  })
})

describe('executive summary guard', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('an invented number fails the guard; the council figures pass', () => {
    const allowed = summaryAllowedTokens(snap)
    expect(summaryFactNumbers(snap).length).toBeGreaterThan(0)
    expect(guardAnswerNumbers([...templateSummary(snap).ar, ...templateSummary(snap).en].join('\n'), allowed)).toEqual({ ok: true, offending: [] })
    expect(guardAnswerNumbers('ارتفعت المبيعات 12.345 د.ك', allowed)).toEqual({ ok: false, offending: ['12.345'] })
    expect(guardAnswerNumbers('النمو 7.7%', allowed).ok).toBe(false)
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
