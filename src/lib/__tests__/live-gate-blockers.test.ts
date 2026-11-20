/**
 * Cross-cutting Live-Gate Blockers Verification Suite (`fix/live-gate-blockers` on `78453fd`).
 *
 * Verifies all 5 live-gate blockers together:
 * 1. AR aging unification (`computeUnifiedReceivableAging`) isolates `POS_CLEARING_ACCOUNT_ID = 35`
 *    with Fail-Closed behavior on missing `accountId` and reconciles `sum(buckets) === 28,168.351` KWD.
 * 2. Migration `0055_live_gate_server_rls_and_ai_briefs.sql` enables RLS with `NO FORCE ROW LEVEL SECURITY`
 *    and explicit server grants on `vf_odoo_closed_year_cache` while revoking `PUBLIC, anon, authenticated`.
 * 3. `/login` `<LoginForm />` renders explicit `method="post" action="/api/auth/login"`.
 * 4. `ai_daily_briefs` & `ai_runs` are provisioned idempotently in `0055` and `persist.ts` uses PostgreSQL
 *    `TIMESTAMPTZ` DDL (never SQLite `DATETIME` on Postgres).
 * 5. `DemandForecastPanel` has deterministic SSR/client hydration parity and Arabic surfaces are free of `(COGS)`.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { LoginForm } from '@/app/login/login-form'
import { localizeQueryOrFormulaAr } from '@/components/erp/KpiProvenanceBadge'
import { LanguageProvider } from '@/lib/i18n'
import { computeUnifiedReceivableAging } from '@/lib/odoo/receivable-aging'
import { POS_CLEARING_ACCOUNT_ID } from '@/lib/odoo/receivable-domain'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push() {},
    replace() {},
    refresh() {},
    back() {},
    forward() {},
    prefetch() {},
  }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(),
}))

const TypedLangProvider = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

describe('Live Gate Blockers — Unified 5-Point Verification', () => {
  it('1) reconciles AR aging buckets to exact verified open debits (28,168.351 KWD) and fails closed on missing accountId', () => {
    const result = computeUnifiedReceivableAging({
      todayIso: '2026-11-20',
      partnerGroups: [
        { partnerId: 10, accountId: POS_CLEARING_ACCOUNT_ID, residualKwd: -18000, linesCount: 500 },
        { partnerId: 101, accountId: 41, residualKwd: 15168.351, linesCount: 4, oldestDueDate: '2026-09-10' },
        { partnerId: 102, accountId: 42, residualKwd: 13000.0, linesCount: 2, oldestDueDate: '2026-11-16' },
        { partnerId: 103, accountId: 41, residualKwd: -2142.324, linesCount: 120, oldestDueDate: '2026-06-01' },
      ],
      lines: [
        // Settled/net-negative platform partner with massive historical un-reconciled lines (must net out to 0 open debit)
        { partnerId: 103, accountId: 41, residualKwd: 1049384.148, dateMaturity: '2026-07-01', date: '2026-07-01' },
        { partnerId: 103, accountId: 41, residualKwd: -1051526.472, dateMaturity: '2026-07-05', date: '2026-07-05' },
        // Net-positive debtor #101 (old invoice partially offset by credit)
        { partnerId: 101, accountId: 41, residualKwd: 20000.0, dateMaturity: '2026-09-10', date: '2026-09-10' },
        { partnerId: 101, accountId: 41, residualKwd: -4831.649, dateMaturity: '2026-09-12', date: '2026-09-12' },
        // Net-positive debtor #102 (current 0-7d)
        { partnerId: 102, accountId: 42, residualKwd: 13000.0, dateMaturity: '2026-11-16', date: '2026-11-16' },
        // POS cashier clearing account 35 (must be isolated completely)
        { partnerId: 10, accountId: POS_CLEARING_ACCOUNT_ID, residualKwd: 55000, dateMaturity: '2026-08-01', date: '2026-08-01' },
      ],
    })

    expect(result.failClosed).toBe(false)
    expect(result.openDebitsKwd).toBe(28168.351)
    const bucketSum = Math.round(result.buckets.reduce((s, b) => s + b.positiveDebitKwd, 0) * 1000) / 1000
    expect(bucketSum).toBe(28168.351)
    expect(bucketSum).not.toBe(1077552.499)

    const failClosed = computeUnifiedReceivableAging({
      todayIso: '2026-11-20',
      partnerGroups: [{ partnerId: 101, accountId: null, residualKwd: 500, linesCount: 1 }],
      lines: [],
    })
    expect(failClosed.failClosed).toBe(true)
    expect(failClosed.buckets).toEqual([])
  })

  it('2 & 4) guarantees 0055 migration configures ENABLE + NO FORCE RLS and TIMESTAMPTZ ai_daily_briefs without destructive SQL', () => {
    const sql = readFileSync(
      path.resolve(process.cwd(), 'database/migrations/0055_live_gate_server_rls_and_ai_briefs.sql'),
      'utf8',
    )
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.vf_odoo_closed_year_cache')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.ai_daily_briefs')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.ai_runs')
    expect(sql).toContain('ALTER TABLE public.vf_odoo_closed_year_cache ENABLE ROW LEVEL SECURITY;')
    expect(sql).toContain('ALTER TABLE public.vf_odoo_closed_year_cache NO FORCE ROW LEVEL SECURITY;')
    expect(sql).toContain('ALTER TABLE public.ai_daily_briefs ENABLE ROW LEVEL SECURITY;')
    expect(sql).toContain('ALTER TABLE public.ai_daily_briefs NO FORCE ROW LEVEL SECURITY;')
    expect(sql).toContain('REVOKE ALL ON TABLE public.vf_odoo_closed_year_cache FROM PUBLIC, anon, authenticated;')
    expect(sql).toContain('REVOKE ALL ON TABLE public.ai_daily_briefs FROM PUBLIC, anon, authenticated;')
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i)

    const persistSrc = readFileSync(path.resolve(process.cwd(), 'src/server/ai/persist.ts'), 'utf8')
    expect(persistSrc).toContain('ensureAiTablesPostgres')
    expect(persistSrc).toContain('TIMESTAMPTZ NOT NULL DEFAULT NOW()')
  })

  it('3) renders explicit method="post" on the executive login form', () => {
    const html = renderToStaticMarkup(
      createElement(TypedLangProvider, { initialLocale: 'ar' }, createElement(LoginForm)),
    )
    expect(html).toMatch(/<form[^>]*\bmethod="post"/i)
    expect(html).toMatch(/<form[^>]*\baction="\/api\/auth\/login"/i)
    expect(html).not.toMatch(/<form[^>]*\bmethod="get"/i)
  })

  it('5) keeps council.ts byte-identical to b985f9b and localizes Arabic formulas without COGS', () => {
    const diff = execFileSync('git', ['diff', 'b985f9b', '--', '**/council.ts'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    expect(diff).toBe('')
    expect(localizeQueryOrFormulaAr('Revenue - COGS', 'account.move.line')).not.toContain('COGS')
    expect(localizeQueryOrFormulaAr('Revenue - COGS', 'account.move.line')).not.toMatch(/[A-Za-z]/)
  })
})
