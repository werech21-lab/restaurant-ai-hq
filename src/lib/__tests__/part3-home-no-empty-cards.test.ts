/**
 * Part 3: Home dashboard (ملخص الشركة, /erp) has no empty cards.
 *
 * Verifies against real fixture structures (`dashboard-today-2026-11-17.json` +
 * `venturefoods_odoo_cids1_dump.json` accounts routed through Part 2 `buildLedgerAccountingFromGroups`):
 * 1. GL revenue/COGS posted in a locked month with commission=0 (`glIncomplete: true`):
 *    - Card 3 (`Operating Net Profit (GL)`) renders real operating profit + `%` + honest month-end note.
 *    - Card 4 (`Aggregator Commissions`) is removed completely (never blank `—` / `Not posted yet`).
 *    - 10-KWD Donut renders real posted slices (omitting zero commission slice) + month-end note.
 *    - Combo Chart plots GL Operating Profit instead of blanking out.
 * 2. `platform_commission` posted via Part 2 classifier:
 *    - Card 4 renders strictly `platform_commission` KWD (excluding subscriptions/3P delivery/bank fees)
 *      plus exact `% of aggregator sales` primary ratio and `% of GL revenue` secondary ratio.
 *    - Card 2 renders `beforeRent` pill even when depreciation is unposted (`glIncomplete: true`).
 * 3. No GL at all (`accounting: undefined` or `lineCount: 0, income: 0, cogs: 0`):
 *    - Card 3, Card 4, and 10-KWD Donut are all absent; Combo Chart expands (`xl:col-span-12`);
 *      top KPI grid uses `lg:grid-cols-2` with zero empty grid slots.
 * 4. Open month (`glClosedThroughDate: null`):
 *    - Card 3 preserves `data-net-profit-withheld="true"` + `PROFIT_AFTER_CLOSE_NOTE` once (zero `—`, zero `0.000`, zero `<circle>`),
 *      and `gl-distribution` is hidden (`xl:col-span-12` combo chart).
 */
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROFIT_AFTER_CLOSE_NOTE } from '@/lib/aether/closed-month-policy'
import { computeGlobalWorkspace, type GlobalFilters } from '@/lib/aether/global-filter-engine'
import { LanguageProvider } from '@/lib/i18n'
import { buildLedgerAccountingFromGroups } from '@/lib/odoo-live-connector'
import type { GlAccountMeta, GlMoveLineGroupRow } from '@/lib/odoo/gl-statements'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { loadLiveTodaySummary } from './support/dashboard-fixture'
import { dashboardContext, setDashboardContext, textOfAttr, todayFilters } from './support/render-dashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => dashboardContext.value,
}))

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')

const DUMP_PATH = path.join(
  process.cwd(),
  'backups/odoo-full-dump/venturefoods_odoo_cids1_dump.json',
)
const DUMP_ACCOUNTS = (
  JSON.parse(fs.readFileSync(DUMP_PATH, 'utf8')) as {
    models: { 'account.account': GlAccountMeta[] }
  }
).models['account.account']

function dumpAccount(code: string): GlAccountMeta {
  const found = DUMP_ACCOUNTS.find((a) => a.code === code)
  if (!found) throw new Error(`Missing account ${code} in ${DUMP_PATH}`)
  return found
}

const TypedLangProvider = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

async function renderHome(
  locale: 'ar' | 'en',
  summary: OdooLiveSummary,
  filters: GlobalFilters = todayFilters('all'),
): Promise<string> {
  setDashboardContext(summary, filters)
  const { FullJourney360 } = await import('@/components/aether/FullJourney360')
  return renderToStaticMarkup(
    React.createElement(TypedLangProvider, { initialLocale: locale }, React.createElement(FullJourney360)),
  )
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  return haystack.split(needle).length - 1
}

function findArticleByKpi(html: string, kpi: string): string | null {
  const token = `data-kpi="${kpi}"`
  const idx = html.indexOf(token)
  if (idx < 0) return null
  const start = html.lastIndexOf('<article', idx)
  if (start < 0) return null
  let depth = 0
  const re = /<(\/?)article\b[^>]*>/gi
  re.lastIndex = start
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1
    if (depth === 0) return html.slice(start, m.index + m[0].length)
  }
  return null
}

describe('Part 3 — Home dashboard (/erp) has no empty cards', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('locked month with GL revenue/COGS posted and deliveryCommissions=0 (glIncomplete=true): Card 3 renders profit + month-end note, Card 4 is absent, 10-KWD Donut renders real slices', async () => {
    const summary = loadLiveTodaySummary()
    summary.buckets!.today!.accounting!.glClosedThroughDate = '2026-11-30'

    const arHtml = await renderHome('ar', summary)
    const enHtml = await renderHome('en', summary)

    // Real posted operating profit from fixture (3299.305 - 455.109 - 97.999 = 2746.197; 83.2%)
    expect(textOfAttr(arHtml, 'data-kpi', 'operating-net')).toBe('2,746.197 د.ك')
    expect(textOfAttr(enHtml, 'data-kpi', 'operating-net')).toBe('2,746.197 KWD')

    const arOpCard = findArticleByKpi(arHtml, 'operating-net')
    const enOpCard = findArticleByKpi(enHtml, 'operating-net')
    expect(arOpCard).not.toBeNull()
    expect(enOpCard).not.toBeNull()
    expect(arOpCard).toContain('83.2%')
    expect(enOpCard).toContain('83.2%')
    expect(arOpCard).toContain(
      'القيود المرحّلة حتى 2026-11-17؛ العمولات والاستهلاك تُرحَّل نهاية الشهر',
    )
    expect(enOpCard).toContain(
      'Posted entries through 2026-11-17; commissions &amp; depreciation post at month-end',
    )
    expect(arOpCard).not.toContain('data-unavailable-state="true"')
    expect(enOpCard).not.toContain('data-unavailable-state="true"')

    // Card 4 (Aggregator Commissions) is removed completely when commission = 0 / unposted
    expect(arHtml).not.toContain('data-kpi="aggregator-commissions"')
    expect(enHtml).not.toContain('data-kpi="aggregator-commissions"')
    expect(arHtml).not.toContain('غير مُرحَّل بعد')
    expect(enHtml).not.toContain('Not posted yet')

    // Grid columns match 3 visible KPI cards (no empty 4th slot)
    expect(arHtml).toContain('sm:grid-cols-2 lg:grid-cols-3')
    expect(enHtml).toContain('sm:grid-cols-2 lg:grid-cols-3')

    // 10-KWD Donut renders real posted slices (COGS, Opex, Operating Profit) + month-end note, omitting zero commission slice
    expect(arHtml).toContain('كيف تتوزع كل 10 دنانير من المبيعات؟')
    expect(enHtml).toContain('How Every 10 KWD of Sales Is Distributed')
    expect(arHtml).toContain('تكلفة البضاعة والمواد (COGS)')
    expect(arHtml).not.toContain('عمولات التوصيل المرحّلة')
    expect(enHtml).toContain('Cost of Goods &amp; Packaging (COGS)')
    expect(enHtml).not.toContain('Posted Delivery Commissions')
    expect(arHtml).toContain('data-chart-kind="v35-donut"')
    expect(enHtml).toContain('data-chart-kind="v35-donut"')

    // Combo chart plots GL Operating Profit rather than blanking out
    expect(arHtml).toContain('صافي التشغيل (دفتر الأستاذ)')
    expect(enHtml).toContain('GL Operating Profit')
    expect(arHtml).toContain('xl:col-span-7')
  })

  it('platform_commission posted via Part 2 classifier: Card 4 renders strictly platform_commission KWD + exact % of aggregator POS sales', async () => {
    const summary = loadLiveTodaySummary()
    const today = summary.buckets!.today!
    // Aggregator POS sales in today fixture: 62.95 + 27 + 57.8 + 6.95 = 154.700 KWD
    const aggSalesKwd = 62.95 + 27 + 57.8 + 6.95
    const commissionKwd = Math.round(aggSalesKwd * 0.2 * 1000) / 1000 // 30.940 KWD (20.0% of agg sales)

    const incomeAcc = dumpAccount('50001') // Food Revenue (income)
    const cogsAcc = dumpAccount('40001') // Cost for Raw Food Items (expense_direct_cost)
    const commAcc = dumpAccount('40229') // platform_commission (Talabat GO)
    const subAcc = dumpAccount('40224') // platform_subscription (must NOT enter Card 4)
    const deliv3pAcc = dumpAccount('40231') // third_party_delivery (must NOT enter Card 4)
    const bankFeeAcc = dumpAccount('40756') // bank_fees (must NOT enter Card 4)

    const accountById = new Map<number, GlAccountMeta>(
      [incomeAcc, cogsAcc, commAcc, subAcc, deliv3pAcc, bankFeeAcc].map((a) => [a.id, a]),
    )
    const rows: GlMoveLineGroupRow[] = [
      { account_id: [incomeAcc.id, `${incomeAcc.code} ${incomeAcc.name}`], debit: 0, credit: 3299.305, balance: -3299.305, __count: 10 },
      { account_id: [cogsAcc.id, `${cogsAcc.code} ${cogsAcc.name}`], debit: 455.109, credit: 0, balance: 455.109, __count: 5 },
      { account_id: [commAcc.id, `${commAcc.code} ${commAcc.name}`], debit: commissionKwd, credit: 0, balance: commissionKwd, __count: 4 },
      { account_id: [subAcc.id, `${subAcc.code} ${subAcc.name}`], debit: 15, credit: 0, balance: 15, __count: 1 },
      { account_id: [deliv3pAcc.id, `${deliv3pAcc.code} ${deliv3pAcc.name}`], debit: 12, credit: 0, balance: 12, __count: 1 },
      { account_id: [bankFeeAcc.id, `${bankFeeAcc.code} ${bankFeeAcc.name}`], debit: 5, credit: 0, balance: 5, __count: 1 },
    ]
    const builtGl = buildLedgerAccountingFromGroups({
      fromIso: '2026-11-17',
      toInclusiveIso: '2026-11-17',
      accountById,
      rows,
    })
    // Depreciation is still 0 so glIncomplete remains true, yet commissions + beforeRent + profit must all render!
    expect(builtGl.glIncomplete).toBe(true)
    expect(builtGl.deliveryCommissions).toBe(commissionKwd)

    today.accounting = {
      ...builtGl,
      glClosedThroughDate: '2026-11-30',
    }

    const arHtml = await renderHome('ar', summary)
    const enHtml = await renderHome('en', summary)

    expect(textOfAttr(arHtml, 'data-kpi', 'aggregator-commissions')).toBe('30.940 د.ك')
    expect(textOfAttr(enHtml, 'data-kpi', 'aggregator-commissions')).toBe('30.940 KWD')

    const arCommCard = findArticleByKpi(arHtml, 'aggregator-commissions')
    const enCommCard = findArticleByKpi(enHtml, 'aggregator-commissions')
    expect(arCommCard).not.toBeNull()
    expect(enCommCard).not.toBeNull()

    // Primary ratio: 30.940 / 154.700 = 20.0% of aggregator sales
    expect(arCommCard).toContain('20.0%')
    expect(arCommCard).toContain('من مبيعات تطبيقات التوصيل')
    expect(enCommCard).toContain('20.0%')
    expect(enCommCard).toContain('of aggregator sales')

    // Secondary ratio: 30.940 / 3299.305 = 0.9% of GL revenue
    expect(arCommCard).toContain('0.9%')
    expect(arCommCard).toContain('من إيراد دفتر الأستاذ')
    expect(enCommCard).toContain('0.9%')
    expect(enCommCard).toContain('of GL revenue')

    // Card 2 beforeRent pill renders even though glIncomplete === true
    const enOrdersCard = findArticleByKpi(enHtml, 'total-orders')
    expect(enOrdersCard).toContain('2,813.256 KWD')

    // All 4 KPI cards visible -> lg:grid-cols-4
    expect(enHtml).toContain('sm:grid-cols-2 lg:grid-cols-4')
  })

  it('no GL at all (accounting undefined OR lineCount: 0, income: 0, cogs: 0): Card 3, Card 4, and 10-KWD Donut are all ABSENT and Combo Chart expands to xl:col-span-12', async () => {
    const undefinedGlSummary = loadLiveTodaySummary()
    delete undefinedGlSummary.buckets!.today!.accounting

    const zeroGlSummary = loadLiveTodaySummary()
    zeroGlSummary.buckets!.today!.accounting = {
      available: false,
      from: '2026-11-17',
      to: '2026-11-17',
      sourceModel: 'account.move.line',
      lineCount: 0,
      income: 0,
      otherIncome: 0,
      totalRevenue: 0,
      cogs: 0,
      deliveryCommissions: 0,
      expense: 0,
      depreciation: 0,
      operatingProfit: 0,
      completeAccrualPosted: false,
      glIncomplete: true,
    }

    for (const s of [undefinedGlSummary, zeroGlSummary]) {
      const arHtml = await renderHome('ar', s)
      const enHtml = await renderHome('en', s)

      for (const html of [arHtml, enHtml]) {
        // Card 1 & Card 2 remain with real POS data
        expect(html).toContain('data-kpi="net-sales"')
        expect(html).toContain('data-kpi="total-orders"')
        expect(html).toContain('154.700')

        // Card 3, Card 4, and 10-KWD Donut are completely absent
        expect(html).not.toContain('data-kpi="operating-net"')
        expect(html).not.toContain('data-kpi="aggregator-commissions"')
        expect(html).not.toContain('Operating Net Profit (GL)')
        expect(html).not.toContain('صافي الربح التشغيلي (دفتر الأستاذ)')
        expect(html).not.toContain('Aggregator Commissions')
        expect(html).not.toContain('عمولات تطبيقات التوصيل')
        expect(html).not.toContain('How Every 10 KWD of Sales Is Distributed')
        expect(html).not.toContain('كيف تتوزع كل 10 دنانير من المبيعات؟')
        expect(html).not.toContain('Not posted yet')
        expect(html).not.toContain('غير مُرحَّل بعد')
        expect(html).not.toContain('Not available yet — GL entries not posted')
        expect(html).not.toContain('غير متاح بعد — لم تُرحّل قيود الدفتر العام')

        // Grid shrinks cleanly to 2 columns and Combo Chart expands to xl:col-span-12
        expect(html).toContain('sm:grid-cols-2 lg:grid-cols-2')
        const comboCardTag = /<div[^>]*id="cash-flow-chart-card"[^>]*>/.exec(html)?.[0] ?? ''
        expect(comboCardTag).toContain('xl:col-span-12')
        expect(comboCardTag).not.toContain('xl:col-span-7')
      }
    }
  })

  it('open month (no lock date): Card 3 withholds profit cleanly with PROFIT_AFTER_CLOSE_NOTE once (no —, no 0.000, no <circle>), and hides 10-KWD Donut', async () => {
    const summary = loadLiveTodaySummary() // glClosedThroughDate unset, deliveryCommissions: 0
    const arHtml = await renderHome('ar', summary)
    const enHtml = await renderHome('en', summary)

    const arOpCard = findArticleByKpi(arHtml, 'operating-net')
    const enOpCard = findArticleByKpi(enHtml, 'operating-net')
    // data-kpi="operating-net" is NOT emitted when netProfitWithheld (no '—' placeholder ring!)
    expect(arOpCard).toBeNull()
    expect(enOpCard).toBeNull()

    expect(arHtml).toContain('data-net-profit-withheld="true"')
    expect(enHtml).toContain('data-net-profit-withheld="true"')
    expect(countOccurrences(arHtml, PROFIT_AFTER_CLOSE_NOTE.ar)).toBe(1)
    expect(countOccurrences(enHtml, PROFIT_AFTER_CLOSE_NOTE.en)).toBe(1)
    expect(arHtml).not.toContain('2,746.197')
    expect(enHtml).not.toContain('2,746.197')
    expect(arHtml).not.toContain('How Every 10 KWD of Sales Is Distributed')
    expect(arHtml).not.toContain('كيف تتوزع كل 10 دنانير من المبيعات؟')
    expect(arHtml).toContain('xl:col-span-12')
  })

  it('hides Card 4 aggregator-sales badge when uiChannels is unavailable (null) and hides order sparkline-unavailable note when nullableOrders is null', async () => {
    const summary = loadLiveTodaySummary()
    const today = summary.buckets!.today!
    today.uiChannels = null
    today.accounting!.deliveryCommissions = 30.94
    today.accounting!.deliveryCommissionLinesCount = 4
    today.accounting!.aggregatorCommissionUnposted = false
    today.accounting!.glClosedThroughDate = '2026-11-30'

    const ws = computeGlobalWorkspace(todayFilters('all'), summary)
    expect(ws.accounting.deliveryCommissionsKwd).toBe(30.94)

    const enHtml = await renderHome('en', summary)
    const commCard = findArticleByKpi(enHtml, 'aggregator-commissions')
    expect(commCard).not.toBeNull()
    expect(commCard).toContain('30.940 KWD')
    expect(commCard).not.toContain('data-commission-agg-pct="true"')
    expect(commCard).not.toContain('— of aggregator sales')
    expect(commCard).toContain('0.9%')
    expect(commCard).toContain('of GL revenue')

    // Partial brand scope with nullableOrders === null: Card 2 does not emit data-sparkline-unavailable
    const brandHtml = await renderHome('en', loadLiveTodaySummary(), todayFilters('china-garden'))
    const ordersCard = findArticleByKpi(brandHtml, 'total-orders')
    expect(ordersCard).not.toBeNull()
    expect(ordersCard).not.toContain('data-sparkline-unavailable="true"')
  })
})
