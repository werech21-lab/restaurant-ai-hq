/**
 * V35 Polish — Wave 0 RED tests for calm status surfaces, progressive provenance popover,
 * neutral unattributed branch tile, and honest AdminPosTerminalMappingPanel load-error state.
 */
import { PROFIT_AFTER_CLOSE_NOTE } from '@/lib/aether/closed-month-policy'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GlobalFilters } from '@/lib/aether/global-filter-engine'
import type { ExecSessionRole } from '@/lib/auth/exec-role-meta'
import { LanguageProvider } from '@/lib/i18n'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'
import { dashboardContext, setDashboardContext, todayFilters } from '../support/render-dashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => dashboardContext.value,
}))

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')

const TypedLangProvider = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

function renderWithLocale(locale: 'ar' | 'en', node: React.ReactElement): string {
  return renderToStaticMarkup(React.createElement(TypedLangProvider, { initialLocale: locale }, node))
}

async function renderDashboard(
  locale: 'ar' | 'en',
  summary: OdooLiveSummary,
  filters: GlobalFilters,
): Promise<string> {
  setDashboardContext(summary, filters)
  const { FullJourney360 } = await import('@/components/aether/FullJourney360')
  return renderWithLocale(locale, React.createElement(FullJourney360))
}

interface ExtractedElement {
  openTag: string
  outerHtml: string
  text: string
}

function extractBalancedElement(html: string, matchIndex: number): ExtractedElement | null {
  const open = html.lastIndexOf('<', matchIndex)
  if (open < 0) return null
  const openEnd = html.indexOf('>', open)
  if (openEnd < 0) return null
  const openTag = html.slice(open, openEnd + 1)
  const tag = /^<([a-z0-9]+)/i.exec(openTag)?.[1]
  if (!tag) return null
  let depth = 0
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi')
  re.lastIndex = open
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1
    if (depth === 0) {
      const outerHtml = html.slice(open, m.index + m[0].length)
      return {
        openTag,
        outerHtml,
        text: outerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      }
    }
  }
  return null
}

function findCardByTag(
  html: string,
  tagName: string,
  predicate: (outerHtml: string) => boolean,
): ExtractedElement | null {
  const re = new RegExp(`<${tagName}\\b[^>]*>`, 'gi')
  for (const m of html.matchAll(re)) {
    const el = extractBalancedElement(html, (m.index ?? 0) + 1)
    if (el && predicate(el.outerHtml)) return el
  }
  return null
}

function findElementByAttr(html: string, attr: string, value: string): ExtractedElement | null {
  const token = `${attr}="${value}"`
  const idx = html.indexOf(token)
  if (idx < 0) return null
  return extractBalancedElement(html, idx)
}

function findGlassCardContaining(html: string, patterns: string[]): ExtractedElement | null {
  const re = /data-variant="glass"/g
  for (const m of html.matchAll(re)) {
    const el = extractBalancedElement(html, m.index ?? 0)
    if (el && patterns.some((p) => el.outerHtml.includes(p))) {
      return el
    }
  }
  return null
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  return haystack.split(needle).length - 1
}

function visibleText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function summaryWithUnattributed(): OdooLiveSummary {
  const summary = loadLiveTodaySummary()
  summary.unattributedSalesKwd = 12.5
  summary.unattributedOrders = 2
  summary.unattributedBranch = {
    id: 'unattributed',
    labelAr: 'غير منسوب لفرع',
    labelEn: 'Unattributed to Branch',
    netSalesKwd: 12.5,
    orders: 2,
    sharePct: 7.476,
  }
  const today = summary.buckets!.today!
  today.unattributedSalesKwd = 12.5
  today.unattributedOrders = 2
  today.unattributedBranch = { ...summary.unattributedBranch }
  today.totals.netSalesKwd = 167.2
  today.totals.orders = 26
  return summary
}

describe('V35 Polish — Calm Unavailable States, Provenance Popover & Terminal Mapping Error State', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('keeps Total Orders card free of incomplete GL warnings in AR and EN when glIncomplete=true', async () => {
    const arHtml = await renderDashboard('ar', loadLiveTodaySummary(), todayFilters('all'))
    const arOrdersCard = findCardByTag(arHtml, 'article', (h) => h.includes('data-kpi="total-orders"'))
    expect(arOrdersCard).not.toBeNull()
    expect(arOrdersCard!.text).not.toContain('قيود غير مكتملة')
    expect(arOrdersCard!.text).not.toContain('Incomplete GL')

    const enHtml = await renderDashboard('en', loadLiveTodaySummary(), todayFilters('all'))
    const enOrdersCard = findCardByTag(enHtml, 'article', (h) => h.includes('data-kpi="total-orders"'))
    expect(enOrdersCard).not.toBeNull()
    expect(enOrdersCard!.text).not.toContain('Incomplete GL')
    expect(enOrdersCard!.text).not.toContain('قيود غير مكتملة')
  })

  it('lists posted GL lines on an open month and withholds operating profit', async () => {
    const source = loadLiveTodaySummary().buckets!.today!.accounting!
    const revenue = source.totalRevenue ?? 0
    const cogs = source.cogs ?? 0
    const expense = source.expense ?? 0
    const kwd = (n: number) =>
      n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    const gross = Math.round((revenue - cogs) * 1000) / 1000
    const arHtml = await renderDashboard('ar', loadLiveTodaySummary(), todayFilters('all'))
    const arOpCard = findCardByTag(arHtml, 'article', (h) =>
      h.includes('قيود دفتر الأستاذ المرحّلة'),
    )
    expect(arOpCard).not.toBeNull()
    expect(arOpCard!.text).toContain('قيود دفتر الأستاذ المرحّلة')
    expect(arOpCard!.text).toContain('إيراد دفتر الأستاذ المرحّل')
    expect(arOpCard!.text).toContain('تكلفة البضاعة المرحّلة')
    expect(arOpCard!.text).toContain('المصروفات المرحّلة')
    expect(arOpCard!.text).not.toContain('صافي الربح التشغيلي')
    expect(arOpCard!.text).not.toContain(kwd(gross))
    expect(arOpCard!.outerHtml).toContain('data-posted-gl="revenue"')
    expect(arOpCard!.outerHtml).toContain(kwd(revenue))
    expect(arOpCard!.outerHtml).toContain(kwd(cogs))
    expect(arOpCard!.outerHtml).toContain(kwd(expense))
    expect(
      countOccurrences(arOpCard!.text, 'غير متاح بعد — لم تُرحّل قيود الدفتر العام') +
        countOccurrences(arOpCard!.text, PROFIT_AFTER_CLOSE_NOTE.ar),
    ).toBe(1)
    expect(arOpCard!.outerHtml).toContain('data-net-profit-withheld="true"')
    expect(countOccurrences(arOpCard!.text, PROFIT_AFTER_CLOSE_NOTE.ar)).toBe(1)
    expect(arOpCard!.text).toContain('العمولات والاستهلاك تُرحَّل نهاية الشهر')
    expect(arOpCard!.outerHtml).not.toContain('data-kpi="operating-net"')
    expect(arOpCard!.outerHtml).not.toContain('amber-')
    expect(arOpCard!.outerHtml).not.toContain('rose-')
    expect(arOpCard!.outerHtml).not.toContain('data-ring-mode="unavailable"')
    expect(arOpCard!.outerHtml).not.toContain('<circle')

    const enHtml = await renderDashboard('en', loadLiveTodaySummary(), todayFilters('all'))
    const enOpCard = findCardByTag(enHtml, 'article', (h) =>
      h.includes('Posted general ledger entries'),
    )
    expect(enOpCard).not.toBeNull()
    expect(enOpCard!.text).toContain('Posted general ledger entries')
    expect(enOpCard!.text).toContain('Posted GL revenue')
    expect(enOpCard!.text).toContain('Posted COGS')
    expect(enOpCard!.text).toContain('Posted expenses')
    expect(enOpCard!.text).not.toContain('Operating Net Profit')
    expect(enOpCard!.text).not.toContain(kwd(gross))
    expect(
      countOccurrences(enOpCard!.text, 'Not available yet — GL entries not posted') +
        countOccurrences(enOpCard!.text, PROFIT_AFTER_CLOSE_NOTE.en),
    ).toBe(1)
    expect(enOpCard!.text).toContain('Not posted yet')
    expect(enOpCard!.outerHtml).not.toContain('amber-')
    expect(enOpCard!.outerHtml).not.toContain('rose-')
    expect(enOpCard!.outerHtml).not.toContain('data-ring-mode="unavailable"')
    expect(enOpCard!.outerHtml).not.toContain('<circle')
  })

  it('renders GL Distribution and Aggregator Commissions cards calmly without amber/rose classes or hollow rings when GL is incomplete / commissions unposted', async () => {
    const arHtml = await renderDashboard('ar', loadLiveTodaySummary(), todayFilters('all'))
    const enHtml = await renderDashboard('en', loadLiveTodaySummary(), todayFilters('all'))

    const arCommCard = findCardByTag(
      arHtml,
      'article',
      (h) => h.includes('data-scope-for="aggregator-commissions"') || h.includes('عمولات تطبيقات التوصيل'),
    )
    expect(arCommCard).toBeNull()

    const enCommCard = findCardByTag(
      enHtml,
      'article',
      (h) => h.includes('data-scope-for="aggregator-commissions"') || h.includes('Aggregator Commissions'),
    )
    expect(enCommCard).toBeNull()

    const arDistCard = findGlassCardContaining(arHtml, [
      'data-scope-for="gl-distribution"',
      'كيف تتوزع كل 10 دنانير من المبيعات؟',
    ])
    expect(arDistCard).toBeNull()

    const enDistCard = findGlassCardContaining(enHtml, [
      'data-scope-for="gl-distribution"',
      'How Every 10 KWD of Sales Is Distributed',
    ])
    expect(enDistCard).toBeNull()
  })

  it('styles unattributed branch tile with neutral dashed slate and zero amber or orange classes when unattributed > 0', async () => {
    const arHtml = await renderDashboard('ar', summaryWithUnattributed(), todayFilters('all'))
    const arTile = findElementByAttr(arHtml, 'data-branch-card', 'unattributed')
    expect(arTile).not.toBeNull()
    expect(arTile!.outerHtml).toContain('border-dashed')
    expect(arTile!.outerHtml).toContain('slate-')
    expect(arTile!.outerHtml).not.toContain('amber-')
    expect(arTile!.outerHtml).not.toContain('orange-')
    expect(arTile!.text).toContain('12.500')

    const enHtml = await renderDashboard('en', summaryWithUnattributed(), todayFilters('all'))
    const enTile = findElementByAttr(enHtml, 'data-branch-card', 'unattributed')
    expect(enTile).not.toBeNull()
    expect(enTile!.outerHtml).toContain('border-dashed')
    expect(enTile!.outerHtml).toContain('slate-')
    expect(enTile!.outerHtml).not.toContain('amber-')
    expect(enTile!.outerHtml).not.toContain('orange-')
  })

  it('renders KpiProvenanceBadge as a compact Details trigger without inline model/sync clutter while keeping provenance data attributes', async () => {
    const { KpiProvenanceBadge } = await import('@/components/erp/KpiProvenanceBadge')

    const arHtml = renderWithLocale(
      'ar',
      React.createElement(KpiProvenanceBadge, {
        odooModel: 'pos.order',
        dateRange: { from: '2026-11-17', to: '2026-11-17' },
        lastSyncAt: '2026-11-17T03:00:36.564Z',
        isStale24h: false,
        kind: 'actual',
        compact: true,
        isAr: true,
      }),
    )
    expect(arHtml).toContain('data-kpi-provenance="فعلي"')
    expect(arHtml).toContain('data-odoo-model="pos.order"')
    expect(arHtml).toContain('data-kpi-stale="false"')
    expect(arHtml).toContain('data-details-trigger="true"')
    expect(arHtml).toContain('aria-expanded="false"')
    const arText = visibleText(arHtml)
    expect(arText).toContain('التفاصيل')
    expect(arText).not.toContain('pos.order')
    expect(arText).not.toContain('2026-11-17')
    expect(arText).not.toContain('مزامنة:')

    const enHtml = renderWithLocale(
      'en',
      React.createElement(KpiProvenanceBadge, {
        odooModel: 'account.move.line',
        dateRange: { from: '2026-11-17', to: '2026-11-17' },
        lastSyncAt: '2026-11-17T03:00:36.564Z',
        isStale24h: true,
        kind: 'formula',
        compact: true,
        isAr: false,
      }),
    )
    expect(enHtml).toContain('data-kpi-provenance="محسوب بمعادلة"')
    expect(enHtml).toContain('data-odoo-model="account.move.line"')
    expect(enHtml).toContain('data-kpi-stale="true"')
    expect(enHtml).toContain('data-details-trigger="true"')
    expect(enHtml).toContain('aria-expanded="false"')
    const enText = visibleText(enHtml)
    expect(enText).toContain('Details')
    expect(enText).not.toContain('account.move.line')
    expect(enText).not.toContain('2026-11-17')
    expect(enText).not.toContain('Sync:')
  })

  it('renders honest Arabic & English retry error state on AdminPosTerminalMappingPanel load failure and never fakes 0.000 or all-mapped copy', async () => {
    setDashboardContext(loadLiveTodaySummary(), todayFilters('all'))
    const { AdminPosTerminalMappingPanel } = await import('@/components/erp/AdminPosTerminalMappingPanel')
    type AdminPanelWithErrorProp = React.ComponentType<{
      role?: ExecSessionRole
      initialLoadError?: string | null
    }>
    const Panel = AdminPosTerminalMappingPanel as unknown as AdminPanelWithErrorProp

    const arFailedHtml = renderWithLocale(
      'ar',
      React.createElement(Panel, { role: 'admin', initialLoadError: 'failed' }),
    )
    expect(arFailedHtml).toContain('تعذّر تحميل ربط الأجهزة — أعد المحاولة')
    expect(arFailedHtml).toMatch(/<button\b[^>]*>[\s\S]*?(?:أعد المحاولة|إعادة المحاولة)[\s\S]*?<\/button>/)
    expect(arFailedHtml).not.toContain('0.000')
    expect(arFailedHtml).not.toContain('جميع أجهزة الكاشير مربوطة')
    expect(arFailedHtml).not.toContain('جميع أجهزة نقاط البيع النشطة مربوطة')

    const enFailedHtml = renderWithLocale(
      'en',
      React.createElement(Panel, { role: 'admin', initialLoadError: 'failed' }),
    )
    expect(enFailedHtml).toMatch(/<button\b[^>]*>[\s\S]*?Retry[\s\S]*?<\/button>/i)
    expect(enFailedHtml).not.toContain('0.000')
    expect(enFailedHtml.toLowerCase()).not.toContain('all terminals mapped')
    expect(enFailedHtml).not.toContain('All discovered Odoo 17 POS terminals are mapped')
    expect(enFailedHtml).not.toMatch(/[\u0600-\u06FF]/)

    // Before client fetch completes (initial SSR with data=null), it must also not lie with 0.000 / all-mapped.
    const initialArHtml = renderWithLocale('ar', React.createElement(Panel, { role: 'admin' }))
    expect(initialArHtml).not.toContain('0.000')
    expect(initialArHtml).not.toContain('جميع أجهزة نقاط البيع النشطة مربوطة')
  })
})
