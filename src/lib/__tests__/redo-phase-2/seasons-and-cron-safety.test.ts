/**
 * Phase 2 — Items 2.5 (`F7` Seasons) & 2.6 (`F8/F9` Cron & Storage Safety) regression suite.
 *
 * Rules enforced:
 * - Zero hand-typed KWD values: all sales assertions derive from `loadLiveTodaySummary()` via integer-fils arithmetic.
 * - `SUGGESTED_SEASON_EVENTS` carries no unrequested `winter` / `summer` assumptions, keeps Hijri & school dates
 *   `approximate: true`, and marks `salary-days` (`25th -> 1st`) `needsOwnerConfirmation: true` until owner-edited.
 * - Partial save of `salary-days` confirms it (`needsOwnerConfirmation: false`) without wiping Ramadan, Eids, or school dates.
 * - `SeasonsStudioView` visibly renders `«يحتاج تأكيد المالك»` / `"Needs owner confirmation"` in calm neutral slate styling
 *   (zero amber clutter) and clears it once edited & saved.
 * - `vercel.json` removes `/api/cron/council` crons, `/api/cron/council` skips unless `COUNCIL_CRON_ENABLED === 'true'`,
 *   and `docs/redo/council-cron-and-0052-runbook.md` documents the exact owner-only steps.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createExecSessionToken, EXEC_SESSION_COOKIE } from '@/lib/auth/exec-session'
import { SeasonsStudioView } from '@/components/erp/SeasonsStudio'
import {
  mergeSeasonEvents,
  SUGGESTED_SEASON_EVENTS,
  seasonsAdvisor,
  type SeasonEvent,
} from '@/lib/council/advisors/seasons'
import { completedDailyByBranch } from '@/lib/council/series'
import { untracedNumbers } from '@/lib/council/trace'
import type { CouncilSnapshot } from '@/lib/council/types'
import { isCouncilCronEnabled, validateSeasonEvent } from '@/server/council/store'
import * as councilService from '@/server/council/service'
import { DELETE as deleteSeasonsRoute, GET as getSeasonsRoute, POST as postSeasonsRoute } from '@/app/api/erp/seasons/route'
import { GET as getCouncilCronRoute } from '@/app/api/cron/council/route'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'

const ROOT = process.cwd()

function extractCardHtml(html: string, seasonId: string): string {
  const marker = `data-season="${seasonId}"`
  const start = html.indexOf(marker)
  if (start === -1) return ''
  const end = html.indexOf('</li>', start)
  return end === -1 ? html.slice(start) : html.slice(start, end + 5)
}

describe('Phase 2.5 (F7) — SUGGESTED_SEASON_EVENTS & Seasons advisor confirmation', () => {
  it('removes winter/summer assumptions, marks Hijri & school dates approximate, and flags salary-days needsOwnerConfirmation', () => {
    const ids = SUGGESTED_SEASON_EVENTS.map((e) => e.id)
    const kinds = SUGGESTED_SEASON_EVENTS.map((e) => e.kind)

    expect(ids).not.toContain('winter-2026')
    expect(ids).not.toContain('summer-2027')
    expect(kinds).not.toContain('winter')
    expect(kinds).not.toContain('summer')

    for (const approxId of ['ramadan-2027', 'eid-al-fitr-2027', 'eid-al-adha-2027', 'school-holiday-mid', 'school-start-2027']) {
      const ev = SUGGESTED_SEASON_EVENTS.find((e) => e.id === approxId)
      expect(ev, `missing ${approxId}`).toBeDefined()
      expect(ev!.approximate).toBe(true)
      expect(Boolean(ev!.needsOwnerConfirmation)).toBe(false)
    }

    const nationalDay = SUGGESTED_SEASON_EVENTS.find((e) => e.id === 'national-day-2027')
    expect(nationalDay).toBeDefined()
    expect(nationalDay!.approximate).toBe(false)
    expect(Boolean(nationalDay!.needsOwnerConfirmation)).toBe(false)

    const salary = SUGGESTED_SEASON_EVENTS.find((e) => e.id === 'salary-days')
    expect(salary).toBeDefined()
    expect(salary!.startsOn).toBe('2026-11-25')
    expect(salary!.endsOn).toBe('2026-12-01')
    expect(salary!.recurrence).toBe('monthly')
    expect(salary!.needsOwnerConfirmation).toBe(true)
  })

  it('computes real historical salary-window evidence from loadLiveTodaySummary() and labels unconfirmed rootCause until confirmed', () => {
    const summary = loadLiveTodaySummary()
    const daily = completedDailyByBranch(summary)!

    const avgWindowKwd = (from: string, to: string): number => {
      const days = daily.days.filter((day) => day >= from && day <= to)
      const totalFils = days.reduce(
        (sum, day) => sum + Object.values(daily.byDay[day]).reduce((daySum, cell) => daySum + cell.netFils, 0),
        0,
      )
      return Math.round(totalFils / days.length) / 1000
    }

    const unconfirmedReport = seasonsAdvisor.run({ summary, events: SUGGESTED_SEASON_EVENTS })
    expect(untracedNumbers(unconfirmedReport)).toEqual([])

    const unconfirmedSalary = unconfirmedReport.findings.find((f) => f.fingerprint.startsWith('seasons:salary-days'))
    expect(unconfirmedSalary).toBeDefined()
    expect(unconfirmedSalary!.rootCause.ar).toContain('يحتاج تأكيد المالك')
    expect(unconfirmedSalary!.rootCause.en.toLowerCase()).toContain('needs owner confirmation')

    const windowEvidences = unconfirmedSalary!.evidence.filter((e) => e.labelEn === 'Average day in the window')
    expect(windowEvidences.map((e) => ({ period: e.period, value: e.value }))).toEqual([
      { period: { from: '2026-10-25', to: '2026-10-31' }, value: avgWindowKwd('2026-10-25', '2026-10-31') },
      { period: { from: '2026-09-25', to: '2026-10-01' }, value: avgWindowKwd('2026-09-25', '2026-10-01') },
    ])

    const confirmedEvents = mergeSeasonEvents([
      {
        ...SUGGESTED_SEASON_EVENTS.find((e) => e.id === 'salary-days')!,
        needsOwnerConfirmation: false,
      },
    ])
    const confirmedReport = seasonsAdvisor.run({ summary, events: confirmedEvents })
    expect(untracedNumbers(confirmedReport)).toEqual([])
    const confirmedSalary = confirmedReport.findings.find((f) => f.fingerprint.startsWith('seasons:salary-days'))!
    expect(confirmedSalary.rootCause.ar).not.toContain('يحتاج تأكيد المالك')
    expect(confirmedSalary.rootCause.en.toLowerCase()).not.toContain('needs owner confirmation')
  })
})

describe('Phase 2.5 (F7) — Partial-save merge & /api/erp/seasons route persistence', () => {
  it('mergeSeasonEvents preserves all suggested events when only salary-days is saved, and clears needsOwnerConfirmation', () => {
    expect(mergeSeasonEvents(null)).toEqual(SUGGESTED_SEASON_EVENTS)
    expect(mergeSeasonEvents([])).toEqual(SUGGESTED_SEASON_EVENTS)

    const editedSalary: SeasonEvent = {
      id: 'salary-days',
      kind: 'salary-days',
      nameAr: 'أيام الرواتب المعتمدة',
      nameEn: 'Confirmed salary days',
      startsOn: '2026-11-26',
      endsOn: '2026-12-02',
      recurrence: 'monthly',
      approximate: false,
    }
    const merged = mergeSeasonEvents([editedSalary])
    expect(merged.map((e) => e.id).sort()).toEqual(SUGGESTED_SEASON_EVENTS.map((e) => e.id).sort())

    const salary = merged.find((e) => e.id === 'salary-days')!
    expect(salary.startsOn).toBe('2026-11-26')
    expect(salary.endsOn).toBe('2026-12-02')
    expect(salary.needsOwnerConfirmation).toBe(false)

    for (const preservedId of ['ramadan-2027', 'eid-al-fitr-2027', 'eid-al-adha-2027', 'school-holiday-mid', 'school-start-2027', 'national-day-2027']) {
      expect(merged.find((e) => e.id === preservedId)).toEqual(SUGGESTED_SEASON_EVENTS.find((e) => e.id === preservedId))
    }

    const custom: SeasonEvent = {
      id: 'custom-kuwait-expo',
      kind: 'custom',
      nameAr: 'معرض الكويت الغذائي',
      nameEn: 'Kuwait Food Expo',
      startsOn: '2026-12-15',
      endsOn: '2026-12-20',
      recurrence: 'none',
      approximate: false,
    }
    const withCustom = mergeSeasonEvents([editedSalary, custom])
    expect(withCustom).toHaveLength(SUGGESTED_SEASON_EVENTS.length + 1)
    expect(withCustom.find((e) => e.id === 'custom-kuwait-expo')?.needsOwnerConfirmation).toBe(false)
  })

  it('POST /api/erp/seasons editing salary-days confirms it without wiping Ramadan, Eids, or school dates on GET', async () => {
    const adminToken = await createExecSessionToken('admin@venturefoodskw.com', 'admin')
    const auditorToken = await createExecSessionToken('auditor@venturefoodskw.com', 'auditor')
    const cookieHeader = (token: string) => ({ cookie: `${EXEC_SESSION_COOKIE}=${token}` })

    const initialRes = await getSeasonsRoute(new NextRequest('http://localhost/api/erp/seasons', { headers: cookieHeader(adminToken) }))
    expect(initialRes.status).toBe(200)
    const initialBody = (await initialRes.json()) as { ok: boolean; suggested: boolean; events: SeasonEvent[] }
    expect(initialBody.ok).toBe(true)
    expect(initialBody.suggested).toBe(true)
    expect(initialBody.events.find((e) => e.id === 'salary-days')?.needsOwnerConfirmation).toBe(true)

    const auditorPostRes = await postSeasonsRoute(
      new NextRequest('http://localhost/api/erp/seasons', {
        method: 'POST',
        headers: { ...cookieHeader(auditorToken), 'content-type': 'application/json' },
        body: JSON.stringify({
          id: 'salary-days',
          kind: 'salary-days',
          nameAr: 'أيام الرواتب',
          nameEn: 'Salary days',
          startsOn: '2026-11-26',
          endsOn: '2026-12-02',
          recurrence: 'monthly',
          approximate: false,
        }),
      }),
    )
    expect(auditorPostRes.status).toBe(403)

    const validated = validateSeasonEvent({
      id: 'salary-days',
      kind: 'salary-days',
      nameAr: 'أيام الرواتب',
      nameEn: 'Salary days',
      startsOn: '2026-11-26',
      endsOn: '2026-12-02',
      recurrence: 'monthly',
      approximate: false,
      needsOwnerConfirmation: true,
    })
    expect(validated?.needsOwnerConfirmation).toBe(false)

    try {
      const saveRes = await postSeasonsRoute(
        new NextRequest('http://localhost/api/erp/seasons', {
          method: 'POST',
          headers: { ...cookieHeader(adminToken), 'content-type': 'application/json' },
          body: JSON.stringify({
            id: 'salary-days',
            kind: 'salary-days',
            nameAr: 'أيام الرواتب',
            nameEn: 'Salary days',
            startsOn: '2026-11-26',
            endsOn: '2026-12-02',
            recurrence: 'monthly',
            approximate: false,
          }),
        }),
      )
      expect(saveRes.status).toBe(200)
      const saveBody = (await saveRes.json()) as { ok: boolean; event: SeasonEvent }
      expect(saveBody.ok).toBe(true)
      expect(saveBody.event.needsOwnerConfirmation).toBe(false)

      const afterRes = await getSeasonsRoute(new NextRequest('http://localhost/api/erp/seasons', { headers: cookieHeader(auditorToken) }))
      expect(afterRes.status).toBe(200)
      const afterBody = (await afterRes.json()) as { ok: boolean; suggested: boolean; events: SeasonEvent[] }
      expect(afterBody.ok).toBe(true)
      expect(afterBody.suggested).toBe(false)
      expect(afterBody.events).toHaveLength(SUGGESTED_SEASON_EVENTS.length)

      const savedSalary = afterBody.events.find((e) => e.id === 'salary-days')!
      expect(savedSalary.startsOn).toBe('2026-11-26')
      expect(savedSalary.endsOn).toBe('2026-12-02')
      expect(savedSalary.needsOwnerConfirmation).toBe(false)

      for (const id of ['ramadan-2027', 'eid-al-fitr-2027', 'eid-al-adha-2027', 'school-holiday-mid', 'school-start-2027', 'national-day-2027']) {
        expect(afterBody.events.some((e) => e.id === id), `expected ${id} to remain after partial save`).toBe(true)
      }
    } finally {
      await deleteSeasonsRoute(
        new NextRequest('http://localhost/api/erp/seasons?id=salary-days', {
          method: 'DELETE',
          headers: cookieHeader(adminToken),
        }),
      )
    }
  })
})

describe('Phase 2.5 (F7) — SeasonsStudioView AR/EN confirmation badge & calm neutral styling', () => {
  const summary = loadLiveTodaySummary()
  const report = seasonsAdvisor.run({ summary, events: SUGGESTED_SEASON_EVENTS })

  it.each(['ar', 'en'] as const)('%s: shows Needs owner confirmation on salary-days, approximate on Hijri/school dates, and zero amber classes', (locale) => {
    const html = renderToStaticMarkup(
      createElement(SeasonsStudioView, {
        locale,
        events: [...SUGGESTED_SEASON_EVENTS],
        suggested: true,
        report,
        canEdit: true,
      }),
    )

    expect(html).not.toMatch(/\b(?:text|bg|ring|border)-amber-/)

    const salaryCard = extractCardHtml(html, 'salary-days')
    expect(salaryCard).toContain('data-needs-owner-confirmation="true"')
    expect(salaryCard).toContain(locale === 'ar' ? 'يحتاج تأكيد المالك' : 'Needs owner confirmation')

    for (const approxId of ['ramadan-2027', 'eid-al-fitr-2027', 'eid-al-adha-2027', 'school-holiday-mid', 'school-start-2027']) {
      const card = extractCardHtml(html, approxId)
      expect(card).toContain(locale === 'ar' ? 'تقريبي' : 'approximate')
      expect(card).not.toContain('data-needs-owner-confirmation="true"')
    }

    expect(html).not.toContain('data-season="winter-2026"')
    expect(html).not.toContain('data-season="summer-2027"')
  })

  it.each(['ar', 'en'] as const)('%s: clears Needs owner confirmation badge once salary-days is edited & saved', (locale) => {
    const confirmedEvents = mergeSeasonEvents([
      {
        ...SUGGESTED_SEASON_EVENTS.find((e) => e.id === 'salary-days')!,
        startsOn: '2026-11-26',
        endsOn: '2026-12-02',
        approximate: false,
        needsOwnerConfirmation: false,
      },
    ])
    const confirmedReport = seasonsAdvisor.run({ summary, events: confirmedEvents })
    const html = renderToStaticMarkup(
      createElement(SeasonsStudioView, {
        locale,
        events: confirmedEvents,
        suggested: false,
        report: confirmedReport,
        canEdit: true,
      }),
    )

    expect(html).not.toContain('data-needs-owner-confirmation="true"')
    expect(html).not.toContain(locale === 'ar' ? 'يحتاج تأكيد المالك' : 'Needs owner confirmation')
    expect(extractCardHtml(html, 'ramadan-2027')).toContain(locale === 'ar' ? 'تقريبي' : 'approximate')
    expect(html).not.toMatch(/\b(?:text|bg|ring|border)-amber-/)
  })
})

describe('Phase 2.6 (F8/F9) — Cron disabled by default, opt-in flag, and owner runbook', () => {
  const originalCronSecret = process.env.CRON_SECRET
  const originalCouncilFlag = process.env.COUNCIL_CRON_ENABLED

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalCronSecret
    if (originalCouncilFlag === undefined) delete process.env.COUNCIL_CRON_ENABLED
    else process.env.COUNCIL_CRON_ENABLED = originalCouncilFlag
  })

  it('vercel.json removes /api/cron/council schedules while keeping pre-existing crons intact', () => {
    const raw = fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')
    const parsed = JSON.parse(raw) as { crons: { path: string; schedule: string }[] }
    const paths = parsed.crons.map((c) => c.path)

    expect(paths.some((p) => p.startsWith('/api/cron/council'))).toBe(false)
    expect(paths).toEqual(['/api/erp/odoo-sync', '/api/aggregator-radar/alert', '/api/cron/ai-daily-brief'])
  })

  it('isCouncilCronEnabled is OFF unless explicitly set to "true"', () => {
    expect(isCouncilCronEnabled(undefined)).toBe(false)
    expect(isCouncilCronEnabled('')).toBe(false)
    expect(isCouncilCronEnabled('   ')).toBe(false)
    expect(isCouncilCronEnabled('false')).toBe(false)
    expect(isCouncilCronEnabled('0')).toBe(false)
    expect(isCouncilCronEnabled('1')).toBe(false)
    expect(isCouncilCronEnabled('yes')).toBe(false)
    expect(isCouncilCronEnabled('true')).toBe(true)
    expect(isCouncilCronEnabled(' TRUE ')).toBe(true)
  })

  it('GET /api/cron/council enforces CRON_SECRET first, skips when COUNCIL_CRON_ENABLED !== "true", and runs only when enabled', async () => {
    process.env.CRON_SECRET = 'test-cron-secret-value-for-unit-suite'
    delete process.env.COUNCIL_CRON_ENABLED

    const runSpy = vi.spyOn(councilService, 'runAndStoreCouncil').mockResolvedValue({
      generatedAt: '2026-11-17T03:05:00.000Z',
      reports: [],
      discoveries: [],
    } satisfies CouncilSnapshot)

    const unauthRes = await getCouncilCronRoute(new NextRequest('http://localhost/api/cron/council?scope=hourly'))
    expect(unauthRes.status).toBe(401)
    expect(runSpy).not.toHaveBeenCalled()

    const skippedRes = await getCouncilCronRoute(
      new NextRequest('http://localhost/api/cron/council?scope=hourly', {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    )
    expect(skippedRes.status).toBe(200)
    expect(await skippedRes.json()).toEqual({
      ok: true,
      skipped: true,
      reason: 'COUNCIL_CRON_DISABLED',
    })
    expect(runSpy).not.toHaveBeenCalled()

    process.env.COUNCIL_CRON_ENABLED = 'false'
    const explicitFalseRes = await getCouncilCronRoute(
      new NextRequest('http://localhost/api/cron/council?scope=nightly', {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    )
    expect(explicitFalseRes.status).toBe(200)
    expect(await explicitFalseRes.json()).toEqual({
      ok: true,
      skipped: true,
      reason: 'COUNCIL_CRON_DISABLED',
    })
    expect(runSpy).not.toHaveBeenCalled()

    process.env.COUNCIL_CRON_ENABLED = 'true'
    const activeRes = await getCouncilCronRoute(
      new NextRequest('http://localhost/api/cron/council?scope=nightly', {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    )
    expect(activeRes.status).toBe(200)
    const activeBody = (await activeRes.json()) as { ok: boolean; scope: string; skipped?: boolean }
    expect(activeBody.ok).toBe(true)
    expect(activeBody.scope).toBe('nightly')
    expect(activeBody.skipped).toBeUndefined()
    expect(runSpy).toHaveBeenCalledTimes(1)
    expect(runSpy).toHaveBeenCalledWith('nightly')
  })

  it('documents all required owner-only steps in docs/redo/council-cron-and-0052-runbook.md', () => {
    const runbookPath = path.join(ROOT, 'docs', 'redo', 'council-cron-and-0052-runbook.md')
    expect(fs.existsSync(runbookPath)).toBe(true)
    const md = fs.readFileSync(runbookPath, 'utf8')

    expect(md).toContain('Vercel Pro')
    expect(md).toContain('maxDuration = 300')
    expect(md).toContain('database/migrations/0052_council_reports_and_seasons.sql')
    expect(md).toContain('BYPASSRLS')
    expect(md).toContain('public.council_reports')
    expect(md).toContain('public.season_events')
    expect(md).toContain('CRON_SECRET')
    expect(md).toContain('COUNCIL_CRON_ENABLED=true')
    expect(md).toContain('/api/cron/council?scope=hourly')
    expect(md).toContain('/api/cron/council?scope=nightly')
  })
})
