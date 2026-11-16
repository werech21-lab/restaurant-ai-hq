import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ReportBody } from '@/app/erp/ai-brief/report-body'
import { claimResponse, structuredClaim } from '@/server/ai/__tests__/claim-fixture'
import { assembleBriefReport, reviewModelText } from '@/server/ai/consensus'
import type { BriefCitation, BriefFact, StoredBriefReport } from '@/server/ai/brief-types'
import {
  linksForFinding,
  linksForRecommendation,
  odooWebBase,
  reportSectionNotes,
  sourceForMetric,
} from '@/server/ai/source-links'

const BASE = 'https://venturefoods.example'
const PERIOD = '2026-11-15'
const IDS = {
  companyId: 1,
  configIdsByBranch: { promenade: [17] },
  excludedConfigIds: [] as number[],
  excludedPosCategoryIds: [] as number[],
}

function salesFact(): BriefFact {
  return {
    id: `net_sales_kwd|promenade|${PERIOD}`,
    metric: 'net_sales_kwd',
    period: PERIOD,
    scope: 'promenade',
    value: '40.5',
    unit: 'KWD',
    source: sourceForMetric({
      metric: 'net_sales_kwd',
      period: PERIOD,
      scope: 'promenade',
      productId: null,
      ids: IDS,
    }),
  }
}

function citationOf(fact: BriefFact): BriefCitation {
  return {
    metric: fact.metric,
    period: fact.period,
    scope: fact.scope,
    value: fact.value,
    unit: fact.unit,
    source: fact.source ?? null,
  }
}

describe('phase 4 reports and advisory', () => {
  it('builds an Odoo link only from the configured origin and real ids', () => {
    const source = sourceForMetric({
      metric: 'net_sales_kwd',
      period: PERIOD,
      scope: 'promenade',
      productId: null,
      ids: IDS,
    })
    expect(source.model).toBe('pos.order')
    expect(JSON.stringify(source.domain)).toContain('17')
    expect(odooWebBase(BASE)).toBe(BASE)
    expect(odooWebBase('http://venturefoods.example')).toBeNull()
    expect(odooWebBase('https://user:secret@venturefoods.example')).toBeNull()
    expect(odooWebBase('https://venturefoods.example/odoo')).toBeNull()
    expect(odooWebBase('')).toBeNull()

    const linked = linksForFinding({ citations: [citationOf(salesFact())] }, BASE)
    expect(linked.some((link) => link.href?.startsWith(`${BASE}/web#model=pos.order&view_type=list&domain=`))).toBe(true)
    expect(linked.some((link) => link.href?.includes('/odoo/action'))).toBe(false)
    const plain = linksForFinding({ citations: [citationOf(salesFact())] }, null)
    expect(plain.every((link) => link.href == null)).toBe(true)
    expect(plain.some((link) => link.model === 'pos.order' && (link.domainText ?? '').includes('pos.order'))).toBe(true)

    const product = sourceForMetric({
      metric: 'product_net_sales_kwd',
      period: PERIOD,
      scope: 'Chicken',
      productId: 21,
      ids: IDS,
    })
    const productLinks = linksForFinding(
      { citations: [{ metric: product.model, period: PERIOD, scope: 'Chicken', value: '12', unit: 'KWD', source: product }] },
      BASE,
    )
    expect(productLinks.some((link) => link.href === `${BASE}/web#id=21&model=product.product&view_type=form`)).toBe(true)
  })

  it('links each recommendation to the in-app page and the stored report', () => {
    const links = linksForRecommendation(
      { citations: [citationOf(salesFact())] },
      BASE,
      '/erp/ai-brief#report-brief-1',
    )
    expect(links.some((link) => link.href === '/erp/ai-brief#report-brief-1')).toBe(true)
    const app = links.find((link) => link.kind === 'app')
    expect(app?.href?.startsWith('/erp/weekday-comparison?')).toBe(true)
    expect(app?.href).toContain('from=2026-11-15')
    expect(app?.href).toContain('branch=promenade')
  })

  it('gives every report section a written recommendation and a link', () => {
    const fact = salesFact()
    const report = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'schedule',
      periods: { yesterday: PERIOD, prior: '2026-11-14' },
      sections: [{ id: 'sales', status: 'linked', noteAr: '' }],
      facts: [fact],
      models: [
        reviewModelText({
          provider: 'anthropic',
          modelId: 'claude-test',
          text: claimResponse({
            findings: [structuredClaim([fact])],
            recommendations: [structuredClaim([fact])],
            advisory: [{ topic: 'organization', text: 'رتب متابعة الفروع يومياً.' }],
          }),
          facts: [fact],
        }),
        reviewModelText({
          provider: 'google',
          modelId: 'gemini-test',
          text: claimResponse({
            findings: [structuredClaim([fact])],
            recommendations: [structuredClaim([fact])],
            advisory: [{ topic: 'strategic_plan', text: 'الخطة تركز على الفروع المرتبطة.' }],
          }),
          facts: [fact],
        }),
        reviewModelText({
          provider: 'xai',
          modelId: 'grok-test',
          text: JSON.stringify({
            findings: [],
            recommendations: [],
            advisory: [{ topic: 'organization', text: 'أضف هدفاً رقمياً 77.' }],
          }),
          facts: [fact],
        }),
      ],
    })
    expect(report.findings).toHaveLength(1)
    expect(report.recommendations).toHaveLength(1)
    expect(report.advisory.map((item) => item.text).join(' ')).not.toContain('77')
    expect(report.advisory.every((item) => item.kind === 'opinion')).toBe(true)

    const notes = reportSectionNotes({
      report,
      base: BASE,
      reportHref: '/erp/ai-brief#report-brief-1',
      includeAdminRuns: false,
    })
    expect(notes.map((note) => note.id)).toEqual([
      'cleanliness',
      'analysis',
      'guard',
      'recommendations',
      'advisory',
      'proposals',
    ])
    for (const note of notes) {
      expect(note.recommendationAr.trim().length).toBeGreaterThan(10)
      expect(note.links.length).toBeGreaterThan(0)
    }
  })

  it('renders every finding with a source link and labels advisory as opinion', () => {
    const fact = salesFact()
    const report: StoredBriefReport = {
      ...assembleBriefReport({
        generatedAt: '2026-11-16T03:00:00.000Z',
        trigger: 'manual',
        periods: { yesterday: PERIOD, prior: '2026-11-14' },
        sections: [{ id: 'sales', status: 'linked', noteAr: '' }],
        facts: [fact],
        models: [
          reviewModelText({
            provider: 'anthropic',
            modelId: 'claude-test',
            text: claimResponse({
              findings: [structuredClaim([fact])],
              recommendations: [structuredClaim([fact])],
              advisory: [{ topic: 'organization', text: 'رتب متابعة الفروع يومياً.' }],
            }),
            facts: [fact],
          }),
          reviewModelText({
            provider: 'google',
            modelId: 'gemini-test',
          text: claimResponse({
            findings: [structuredClaim([fact])],
            recommendations: [structuredClaim([fact])],
          }),
            facts: [fact],
          }),
        ],
      }),
    }
    const html = renderToStaticMarkup(
      createElement(ReportBody, {
        report,
        canExport: false,
        odooBase: BASE,
        reportHref: '/erp/ai-brief#report-brief-1',
        includeAdminRuns: false,
      }),
    )
    expect(html).toContain('حالة نظافة البيانات')
    expect(html).toContain('التحليل الخلفي')
    expect(html).toContain('حارس الحقيقة')
    expect(html).toContain('ب) التوصيات والحلول')
    expect(html).toContain('ج) رأي استشاري — ليس بياناً من Odoo')
    expect(html).toContain('مقترحات بحالة proposed')
    expect(html).toContain(`${BASE}/web#model=pos.order`)
    expect(html).toContain('/erp/weekday-comparison?')
    expect(html).toContain('/erp/ai-brief#report-brief-1')
    expect(html).toContain('رأي')
    expect(html).not.toContain('رتب متابعة الفروع يومياً.')
    expect(html).not.toContain('/odoo/action')
    expect(html).not.toContain('77')

    const offline = renderToStaticMarkup(
      createElement(ReportBody, {
        report,
        canExport: false,
        odooBase: null,
        reportHref: '/erp/ai-brief#report-brief-1',
        includeAdminRuns: false,
      }),
    )
    expect(offline).toContain('pos.order')
    expect(offline).not.toContain('https://venturefoods.example/web#')
  })
})
