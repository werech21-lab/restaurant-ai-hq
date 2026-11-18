/**
 * V35 Executive Dashboard render parity tests.
 * Renders the real `FullJourney360` component (with `V35GlassCard` and `V35KpiRing`)
 * against the live and allocated today fixtures without mocking business logic.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DASHBOARD_BRANCH_CARD_IDS, type GlobalFilters } from '@/lib/aether/global-filter-engine'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { buildAllocatedTodaySummary, loadLiveTodaySummary } from './support/dashboard-fixture'
import {
  dashboardContext,
  renderAr,
  scopeBadgesOf,
  setDashboardContext,
  textOfAttr,
  todayFilters,
} from './support/render-dashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
  usePathname: () => '/erp',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => dashboardContext.value,
}))

const FIXTURE_NOW = new Date('2026-11-17T03:05:00Z')
const KWD_TOLERANCE = 0.001

async function renderDashboard(
  summary: OdooLiveSummary,
  filters: GlobalFilters,
): Promise<string> {
  setDashboardContext(summary, filters)
  const { FullJourney360 } = await import('@/components/aether/FullJourney360')
  return renderAr(React.createElement(FullJourney360))
}

function extractBalancedElement(
  html: string,
  matchIndex: number,
): { openTag: string; outerHtml: string; text: string } | null {
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

function findKpiElement(html: string, kpi: string) {
  const token = `data-kpi="${kpi}"`
  const idx = html.indexOf(token)
  if (idx < 0) return null
  return extractBalancedElement(html, idx)
}

interface ParsedBranchCard {
  id: string
  salesKwd: number
  orders: number
  text: string
}

function parseBranchCards(html: string): ParsedBranchCard[] {
  const cards: ParsedBranchCard[] = []
  const re = /data-branch-card="([^"]+)"/g
  for (const m of html.matchAll(re)) {
    const el = extractBalancedElement(html, m.index ?? 0)
    if (!el) continue
    // Branch card order: header (title + share %) -> V35KpiRing/span sales KWD -> orders count -> optional AOV KWD.
    const kwdMatch = /([\d,]+\.\d{3})\s*د\.ك/.exec(el.text)
    const ordersMatch = /([\d,]+)\s*طلب/.exec(el.text)
    expect(kwdMatch, `branch card ${m[1]} sales KWD in "${el.text}"`).not.toBeNull()
    expect(ordersMatch, `branch card ${m[1]} orders in "${el.text}"`).not.toBeNull()
    cards.push({
      id: m[1],
      salesKwd: Number(kwdMatch![1].replace(/,/g, '')),
      orders: Number(ordersMatch![1].replace(/,/g, '')),
      text: el.text,
    })
  }
  return cards
}

describe('V35 Executive Dashboard render parity (FullJourney360 + V35GlassCard + V35KpiRing)', () => {
  beforeEach(() => vi.useFakeTimers({ now: FIXTURE_NOW, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())

  it('1. brand=all, period=today on live fixture: headline KPIs and branch cards reconcile to 154.700 KWD and 24 orders with zero scope badges', async () => {
    const html = await renderDashboard(loadLiveTodaySummary(), todayFilters('all'))

    const netSalesEl = findKpiElement(html, 'net-sales')
    expect(netSalesEl).not.toBeNull()
    expect(netSalesEl!.openTag).not.toContain('data-unavailable="true"')
    expect(textOfAttr(html, 'data-kpi', 'net-sales')).toBe('154.700 د.ك')
    expect(netSalesEl!.text).toContain('154.700')

    const totalOrdersEl = findKpiElement(html, 'total-orders')
    expect(totalOrdersEl).not.toBeNull()
    expect(totalOrdersEl!.openTag).not.toContain('data-unavailable="true"')
    expect(textOfAttr(html, 'data-kpi', 'total-orders')).toBe('24')

    const cards = parseBranchCards(html)
    // This payload predates booth counting (no byLocation.exhibitions), so no booth card is shown —
    // a group the data doesn't report is never rendered as 0.000.
    expect(cards).toHaveLength(DASHBOARD_BRANCH_CARD_IDS.length)
    expect(cards.some((c) => c.id === 'exhibitions')).toBe(false)
    const sumKwd = cards.reduce((sum, c) => sum + c.salesKwd, 0)
    const sumOrders = cards.reduce((sum, c) => sum + c.orders, 0)
    expect(Math.abs(sumKwd - 154.7)).toBeLessThanOrEqual(KWD_TOLERANCE)
    expect(sumOrders).toBe(24)

    expect(scopeBadgesOf(html)).toEqual({})
    expect(html).not.toContain('data-scope-badge=')
  })

  it('2. brand=china-garden, period=today on live fixture: orders/AOV unavailable, branch & unpartitioned GL cards withheld, visible ScopeBadges present, net sales 133.550 with product-lines basis', async () => {
    const html = await renderDashboard(loadLiveTodaySummary(), todayFilters('china-garden'))

    const netSalesEl = findKpiElement(html, 'net-sales')
    expect(netSalesEl).not.toBeNull()
    expect(netSalesEl!.openTag).not.toContain('data-unavailable="true"')
    expect(textOfAttr(html, 'data-kpi', 'net-sales')).toBe('133.550 د.ك')
    expect(textOfAttr(html, 'data-brand-basis', 'product-lines')).toContain('5.600')

    const totalOrdersEl = findKpiElement(html, 'total-orders')
    expect(totalOrdersEl).not.toBeNull()
    expect(totalOrdersEl!.openTag).toContain('data-unavailable="true"')
    expect(totalOrdersEl!.text).toBe('—')

    // AOV inside the Net Sales hero card renders `• متوسط —` with `data-unavailable="true"`.
    const aovMatch = /<span\b[^>]*data-unavailable="true"[^>]*>[^<]*متوسط —[^<]*<\/span>/.exec(html)
    expect(aovMatch).not.toBeNull()

    // Branch section withholds cards and does not leak all-brand totals (154.70 / 99.350 / 24).
    const branchSectionIdx = html.indexOf('aria-label="أداء الفروع السبعة والمبيعات غير المنسوبة لفرع"')
    expect(branchSectionIdx).toBeGreaterThan(-1)
    const branchSection = extractBalancedElement(html, branchSectionIdx)
    expect(branchSection).not.toBeNull()
    expect(branchSection!.text).toContain('غير متاح لهذا الفلتر')
    expect(html).not.toContain('data-branch-card=')
    expect(branchSection!.outerHtml).not.toContain('154.70')
    expect(branchSection!.outerHtml).not.toContain('99.350')
    expect(branchSection!.text).not.toMatch(/\b24\b/)

    expect(scopeBadgesOf(html)).toEqual({
      'ledger-ar': 'company-wide',
      'sales-net-combo': 'all-brands',
      'weekly-pulse': 'all-brands',
    })
  })

  it('3a. unavailable headline net sales (brand=china-garden with byBrand=null): net-sales and total-orders both render — with data-unavailable="true"', async () => {
    const summary = loadLiveTodaySummary()
    summary.buckets!.today!.byBrand = null
    const html = await renderDashboard(summary, todayFilters('china-garden'))

    const netSalesEl = findKpiElement(html, 'net-sales')
    const totalOrdersEl = findKpiElement(html, 'total-orders')
    expect(netSalesEl).not.toBeNull()
    expect(totalOrdersEl).not.toBeNull()
    expect(netSalesEl!.openTag).toContain('data-unavailable="true"')
    expect(netSalesEl!.text).toBe('—')
    expect(totalOrdersEl!.openTag).toContain('data-unavailable="true"')
    expect(totalOrdersEl!.text).toBe('—')
  })

  it('3b. unavailable headline net sales (brand=china-garden with channel=dine-in): net-sales and total-orders both render — with data-unavailable="true"', async () => {
    const html = await renderDashboard(loadLiveTodaySummary(), {
      ...todayFilters('china-garden'),
      channel: 'dine-in',
    })

    const netSalesEl = findKpiElement(html, 'net-sales')
    const totalOrdersEl = findKpiElement(html, 'total-orders')
    expect(netSalesEl).not.toBeNull()
    expect(totalOrdersEl).not.toBeNull()
    expect(netSalesEl!.openTag).toContain('data-unavailable="true"')
    expect(netSalesEl!.text).toBe('—')
    expect(totalOrdersEl!.openTag).toContain('data-unavailable="true"')
    expect(totalOrdersEl!.text).toBe('—')
  })

  it('4. allocated today fixture (brand=china-garden): net-sales (128.383) and total-orders (20) match rendered branch cards', async () => {
    const html = await renderDashboard(buildAllocatedTodaySummary(), todayFilters('china-garden'))

    const netSalesEl = findKpiElement(html, 'net-sales')
    expect(netSalesEl).not.toBeNull()
    expect(netSalesEl!.openTag).not.toContain('data-unavailable="true"')
    expect(textOfAttr(html, 'data-kpi', 'net-sales')).toBe('128.383 د.ك')

    const totalOrdersEl = findKpiElement(html, 'total-orders')
    expect(totalOrdersEl).not.toBeNull()
    expect(totalOrdersEl!.openTag).not.toContain('data-unavailable="true"')
    expect(textOfAttr(html, 'data-kpi', 'total-orders')).toBe('20')

    const cards = parseBranchCards(html)
    // This payload predates booth counting (no byLocation.exhibitions), so no booth card is shown —
    // a group the data doesn't report is never rendered as 0.000.
    expect(cards).toHaveLength(DASHBOARD_BRANCH_CARD_IDS.length)
    expect(cards.some((c) => c.id === 'exhibitions')).toBe(false)
    const sumKwd = cards.reduce((sum, c) => sum + c.salesKwd, 0)
    const sumOrders = cards.reduce((sum, c) => sum + c.orders, 0)
    expect(Math.abs(sumKwd - 128.383)).toBeLessThanOrEqual(KWD_TOLERANCE)
    expect(sumOrders).toBe(20)
  })
})
