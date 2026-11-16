import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { kuwaitDateBoundsToOdooUtc } from '@/lib/odoo-live-connector'
import { assembleBriefReport, reviewModelText } from '@/server/ai/consensus'
import { briefPromptPayload, buildBriefFactPack, type BriefCubeInput } from '@/server/ai/facts'
import {
  kuwaitDayWindow,
  linksForFinding,
  linksForRecommendation,
  odooWebBase,
  parseFactSource,
  positiveIds,
  reportSectionNotes,
  sanitizePeriodOdooIds,
  sourceForMetric,
  type PeriodOdooIds,
} from '@/server/ai/source-links'

const BASE = 'https://odoo.example'
const IDS: PeriodOdooIds = {
  companyId: 3,
  configIdsByBranch: { avenues: [4, 9] },
  excludedConfigIds: [8],
  excludedPosCategoryIds: [150],
}

function cube(date: string): BriefCubeInput {
  return {
    connected: true,
    noData: false,
    dateRange: { from: date, to: date },
    totals: { netSalesKwd: 10.5, orders: 3 },
    byBranch: { avenues: { netKwd: 10.5, orders: 2 } },
    byBrand: { 'china-garden': { netKwd: 10.5 } },
    topProducts: [{ productId: 9, name: 'Noodles', netKwd: 4.5 }],
    hourlySeries: [{ hour: 13, netKwd: 4.5, orders: 2 }],
    posConfigIds: IDS,
    accounting: { available: true, glIncomplete: false, cogs: 3.5, deliveryCommissions: 1.5, aggregatorCommissionUnposted: false },
  }
}

function pack() {
  return buildBriefFactPack({
    yesterday: '2026-11-15',
    prior: '2026-11-14',
    current: cube('2026-11-15'),
    priorCube: cube('2026-11-14'),
    purchases: { connected: true, noData: false, totals: { totalAmountKwd: 6.75 } },
    receivables: { readable: true, openReceivableKwd: 2.5 },
  })
}

function numericIds(href: string): number[] {
  const hash = new URL(href).hash.slice(1)
  const params = new URLSearchParams(hash)
  const found: number[] = []
  const id = params.get('id')
  if (id) found.push(Number(id))
  const domain = params.get('domain')
  if (domain) {
    const tuples = JSON.parse(domain) as unknown[][]
    for (const tuple of tuples) {
      const value = tuple[2]
      const values = Array.isArray(value) ? value : [value]
      for (const item of values) {
        if (typeof item === 'number') found.push(item)
      }
    }
  }
  return found
}

describe('Odoo source links', () => {
  it('uses the same Kuwait day window as the live connector', () => {
    const official = kuwaitDateBoundsToOdooUtc('2026-11-15', '2026-11-15')
    expect(kuwaitDayWindow('2026-11-15')).toEqual({
      fromUtc: official.fromUtc,
      toExclusiveUtc: official.toExclusiveUtc,
    })
  })

  it('builds a list link only from real models and the ids on the fact', () => {
    const source = sourceForMetric({
      metric: 'net_sales_kwd',
      period: '2026-11-15',
      scope: 'avenues',
      productId: null,
      ids: IDS,
    })
    const links = linksForFinding({ citations: [{ metric: 'net_sales_kwd', period: '2026-11-15', scope: 'avenues', value: '10.5', unit: 'KWD', source }] }, BASE)
    const hrefs = links.map((link) => link.href).filter((href): href is string => Boolean(href))
    expect(hrefs.length).toBeGreaterThan(0)
    expect(links.every((link) => link.href || (link.model && link.domainText))).toBe(true)
    for (const href of hrefs) {
      expect(href.startsWith(`${BASE}/web#`)).toBe(true)
      expect(href).not.toContain('action-')
      expect(new URL(href).hash).toContain('model=pos.order')
      const ids = numericIds(href)
      expect(ids.every((id) => [3, 4, 9].includes(id))).toBe(true)
      expect(ids).toContain(4)
      expect(ids).toContain(9)
      expect(ids).not.toContain(8)
    }
  })

  it('keeps the product form link and refuses ids that were not supplied', () => {
    const source = sourceForMetric({
      metric: 'product_net_sales_kwd',
      period: '2026-11-15',
      scope: 'Noodles',
      productId: 9,
      ids: null,
    })
    const links = linksForFinding(
      { citations: [{ metric: 'product_net_sales_kwd', period: '2026-11-15', scope: 'Noodles', value: '4.5', unit: 'KWD', source }] },
      BASE,
    )
    const form = links.find((link) => link.href?.includes('model=product.product'))
    expect(form?.href).toBe(`${BASE}/web#id=9&model=product.product&view_type=form`)
    const list = links.find((link) => link.model === 'pos.order.line')
    expect(list?.href).toBeNull()
    expect(list?.domainText).toContain('product_id')
    expect(list?.domainText).toContain('not on this fact')
    expect(odooWebBase('http://odoo.example')).toBeNull()
    expect(odooWebBase('https://user:pass@odoo.example')).toBeNull()
    expect(odooWebBase('https://odoo.example/extra')).toBeNull()
    expect(odooWebBase('javascript:alert(1)')).toBeNull()
    expect(parseFactSource({ model: 'crm.lead', domain: [], records: [] })).toBeNull()
    expect(positiveIds([0, -3, 1.5, '4', 9])).toEqual([9])
    expect(sanitizePeriodOdooIds({ configIdsByBranch: { avenues: [0, 4], heisenberg: [99] }, companyId: -1 })?.configIdsByBranch).toEqual({
      avenues: [4],
    })
  })

  it('describes a commission and a brand without inventing a filtered URL', () => {
    const commission = sourceForMetric({
      metric: 'delivery_commission_kwd',
      period: '2026-11-15',
      scope: 'company',
      productId: null,
      ids: IDS,
    })
    const brand = sourceForMetric({
      metric: 'brand_net_sales_kwd',
      period: '2026-11-15',
      scope: 'china-garden',
      productId: null,
      ids: IDS,
    })
    expect(linksForFinding({ citations: [{ metric: 'delivery_commission_kwd', period: '2026-11-15', scope: 'company', value: '1.5', unit: 'KWD', source: commission }] }, BASE).every((link) => link.href == null)).toBe(true)
    expect(formatNeeded(commission)).toContain('account.move.line')
    expect(linksForFinding({ citations: [{ metric: 'brand_net_sales_kwd', period: '2026-11-15', scope: 'china-garden', value: '10.5', unit: 'KWD', source: brand }] }, BASE).every((link) => link.href == null)).toBe(true)
    const receivable = sourceForMetric({
      metric: 'open_receivable_kwd',
      period: '2026-11-15',
      scope: 'company',
      productId: null,
      ids: null,
    })
    const receivableHref = linksForFinding(
      { citations: [{ metric: 'open_receivable_kwd', period: '2026-11-15', scope: 'company', value: '2.5', unit: 'KWD', source: receivable }] },
      BASE,
    ).find((link) => link.href)?.href
    expect(decodeURIComponent(receivableHref ?? '')).toContain('asset_receivable')
    expect(decodeURIComponent(receivableHref ?? '')).not.toContain('2026-11-15')
  })

  it('points a recommendation at the comparison page and the stored report', () => {
    const built = pack()
    const fact = built.facts.find((item) => item.metric === 'net_sales_kwd' && item.scope === 'avenues' && item.period === '2026-11-15')
    expect(fact?.source).toBeTruthy()
    const links = linksForRecommendation(
      { citations: [{ metric: fact!.metric, period: fact!.period, scope: fact!.scope, value: fact!.value, unit: fact!.unit, source: fact!.source }] },
      BASE,
      '/erp/ai-brief#report-brief-1',
    )
    const app = links.find((link) => link.kind === 'app')?.href ?? ''
    expect(app.startsWith('/erp/weekday-comparison?')).toBe(true)
    expect(app).toContain('dateA=2026-11-15')
    expect(app).toContain('branch=avenues')
    expect(app).toContain('branches=avenues')
    expect(app).not.toContain('Noodles')
    expect(links.some((link) => link.href === '/erp/ai-brief#report-brief-1')).toBe(true)
    const product = built.facts.find((item) => item.metric === 'product_net_sales_kwd')
    const productApp = linksForRecommendation(
      { citations: [{ metric: product!.metric, period: product!.period, scope: product!.scope, value: product!.value, unit: product!.unit, source: product!.source }] },
      null,
      '/erp/ai-brief#report-brief-1',
    ).find((link) => link.kind === 'app')?.href ?? ''
    expect(productApp.startsWith('/erp/menu-engineering?')).toBe(true)
    expect(productApp).not.toContain('branch=')
  })

  it('gives every finding a source link and every report section a recommendation', () => {
    const built = pack()
    const fact = built.facts.find((item) => item.metric === 'product_net_sales_kwd')!
    const reviewed = reviewModelText({
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-6',
      text: JSON.stringify({
        findings: [{ factIds: [fact.id], text: `راجع ${fact.value}` }],
        recommendations: [{ factIds: [fact.id], solution: `راجع ${fact.value}`, stance: 'support' }],
      }),
      facts: built.facts,
    })
    const also = reviewModelText({
      provider: 'google',
      modelId: 'gemini-3.1-pro-preview',
      text: JSON.stringify({
        findings: [{ factIds: [fact.id], text: `راجع ${fact.value}` }],
        recommendations: [{ factIds: [fact.id], solution: `راجع ${fact.value}`, stance: 'support' }],
      }),
      facts: built.facts,
    })
    const report = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'manual',
      periods: built.periods,
      sections: built.sections,
      facts: built.facts,
      models: [reviewed, also],
    })
    for (const finding of [...report.findings, ...report.unadoptedFindings]) {
      const links = linksForFinding(finding, BASE)
      expect(links.length).toBeGreaterThan(0)
      expect(links.some((link) => Boolean(link.href) || Boolean(link.model && link.domainText))).toBe(true)
    }
    expect(report.findings[0].citations[0].source?.records[0]?.id).toBe(9)
    const notes = reportSectionNotes({
      report,
      base: BASE,
      reportHref: '/erp/ai-brief#report-brief-1',
      includeAdminRuns: true,
    })
    expect(notes.map((item) => item.id)).toEqual([
      'cleanliness',
      'analysis',
      'guard',
      'recommendations',
      'advisory',
      'proposals',
    ])
    for (const item of notes) {
      expect(item.recommendationAr.trim().length).toBeGreaterThan(0)
      expect(item.links.length).toBeGreaterThan(0)
      expect(item.links.every((link) => link.href || (link.model && link.domainText))).toBe(true)
    }
    expect(notes.find((item) => item.id === 'analysis')?.links.some((link) => link.href === '/admin/ai-runs')).toBe(true)
    expect(briefPromptPayload(built)).not.toContain('session_id.config_id')
    expect(briefPromptPayload(built)).not.toContain('"records"')
  })

  it('does not let a source id bypass the number guard', () => {
    const built = pack()
    const fact = built.facts.find((item) => item.metric === 'net_sales_kwd' && item.scope === 'company')!
    const reviewed = reviewModelText({
      provider: 'xai',
      modelId: 'grok-4',
      text: JSON.stringify({
        findings: [{ factIds: [fact.id], text: `ملاحظة ${fact.value} و 4242` }],
        recommendations: [],
      }),
      facts: built.facts,
    })
    expect(reviewed.status).toBe('rejected')
    expect(reviewed.errorCode).toBe('GUARD_REJECTED')
  })

  it('keeps action ids and foreign hosts out of the link builder', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/server/ai/source-links.ts'), 'utf8')
    const page = readFileSync(path.join(process.cwd(), 'src/app/erp/ai-brief/page.tsx'), 'utf8')
    expect(`${source}\n${page}`).not.toContain('action-')
    expect(`${source}\n${page}`).not.toContain('odoo.com')
  })
})

function formatNeeded(source: { model: string; domain: { field: string }[] }): string {
  return `${source.model} ${source.domain.map((item) => item.field).join(' ')}`
}
