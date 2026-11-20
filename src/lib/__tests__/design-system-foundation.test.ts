import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

import * as UiBarrelRoot from '@/components/ui'
import * as UiBarrelIndex from '@/components/ui/index'
import {
  Badge,
  Card,
  ChartCard,
  ChartTooltipContent,
  DataTable,
  KpiCard,
  Money,
  Num,
  OdooPartialWarningBanner,
  PartialWarningBanner,
  SectionCard,
  StateBlock,
  formatChartKwdTooltip,
} from '@/components/ui'
import { LanguageProvider } from '@/lib/i18n'

const el = React.createElement

describe('Wave 2 Design System Foundation', () => {
  describe('barrel exports & backwards compatibility', () => {
    it('exposes all new and legacy primitives consistently from @/components/ui and @/components/ui/index', () => {
      const expectedKeys = [
        'KpiCard',
        'SectionCard',
        'ChartCard',
        'ChartTooltipContent',
        'formatChartKwdTooltip',
        'DataTable',
        'StateBlock',
        'PartialWarningBanner',
        'OdooPartialWarningBanner',
        'StatCard',
        'SlidingPillTabs',
        'Modal',
        'ExportCsvButton',
        'Badge',
        'Button',
        'Card',
        'Money',
        'Num',
        'PageHeader',
        'Stat',
        'cx',
      ] as const

      for (const key of expectedKeys) {
        expect(UiBarrelRoot[key]).toBeDefined()
        expect(UiBarrelIndex[key]).toBe(UiBarrelRoot[key])
      }

      expect(typeof Badge).toBe('function')
      expect(typeof Card).toBe('function')
      expect(typeof Num).toBe('function')

      const legacyMoneyHtml = renderToStaticMarkup(
        el(LanguageProvider, {
          initialLocale: 'ar',
          children: el(Money, { value: '1,234.500' }),
        }),
      )
      expect(legacyMoneyHtml).toContain('1,234.500')
      expect(legacyMoneyHtml).toContain('د.ك')
    })
  })

  describe('KpiCard', () => {
    it('renders em-dash and localized Unavailable tooltip on null, undefined, NaN, and Infinity without units or zero fallback', () => {
      const badValues: Array<number | null | undefined> = [
        null,
        undefined,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
      ]

      for (const bad of badValues) {
        const htmlAr = renderToStaticMarkup(
          el(KpiCard, { label: 'صافي المبيعات', value: bad, unit: 'د.ك', locale: 'ar' }),
        )
        expect(htmlAr).toContain('—')
        expect(htmlAr).toContain('title="غير متاح"')
        expect(htmlAr).toContain('aria-label="غير متاح"')
        expect(htmlAr).toContain('data-unavailable="true"')
        expect(htmlAr).not.toContain('0.000')
        expect(htmlAr).not.toContain('— د.ك')

        const htmlEn = renderToStaticMarkup(
          el(KpiCard, { label: 'Net Sales', value: bad, unit: 'KWD', locale: 'en' }),
        )
        expect(htmlEn).toContain('—')
        expect(htmlEn).toContain('title="Unavailable"')
        expect(htmlEn).toContain('aria-label="Unavailable"')
        expect(htmlEn).toContain('data-unavailable="true"')
        expect(htmlEn).not.toContain('0.000')
        expect(htmlEn).not.toContain('— KWD')
      }
    })

    it('formats KWD values strictly to 3 decimals via formatKwd inside dir="ltr" tabular-nums island with semantic delta and provenance', () => {
      const htmlAr = renderToStaticMarkup(
        el(KpiCard, {
          label: 'صافي المبيعات',
          value: 1234.5,
          delta: 3.34,
          locale: 'ar',
          provenance: {
            odooModel: 'pos.order',
            dateRange: { from: '2026-11-01', to: '2026-11-16' },
            kind: 'فعلي',
            lastSyncAt: '2026-11-16T10:00:00.000Z',
          },
        }),
      )

      expect(htmlAr).toContain('dir="rtl"')
      expect(htmlAr).toContain('dir="ltr"')
      expect(htmlAr).toContain('tabular-nums')
      expect(htmlAr).toContain('1,234.500 د.ك')
      expect(htmlAr).toContain('+3.3%')
      expect(htmlAr).toContain('data-kpi-delta-tone="positive"')
      expect(htmlAr).toContain('data-kpi-provenance-slot="true"')
      expect(htmlAr).toContain('data-odoo-model="pos.order"')

      const htmlNegEn = renderToStaticMarkup(
        el(KpiCard, {
          label: 'Net Variance',
          value: -20,
          delta: -4.2,
          locale: 'en',
        }),
      )
      expect(htmlNegEn).toContain('dir="ltr"')
      expect(htmlNegEn).toContain('-20.000 KWD')
      expect(htmlNegEn).toContain('-4.2%')
      expect(htmlNegEn).toContain('data-kpi-delta-tone="negative"')

      const loadingHtml = renderToStaticMarkup(
        el(KpiCard, { label: 'Net Sales', value: null, loading: true, locale: 'en' }),
      )
      expect(loadingHtml).toContain('data-loading="true"')
      expect(loadingHtml).toContain('aria-busy="true"')

      const costHtml = renderToStaticMarkup(
        el(KpiCard, {
          label: 'تكلفة الطعام',
          value: 31.45,
          format: 'pct',
          delta: -2.1,
          higherIsBetter: false,
          locale: 'ar',
        }),
      )
      expect(costHtml).toContain('31.5%')
      expect(costHtml).toContain('-2.1%')
      expect(costHtml).toContain('data-kpi-delta-tone="positive"')

      const intHtml = renderToStaticMarkup(
        el(KpiCard, {
          label: 'Total Orders',
          value: 1480.2,
          format: 'int',
          unit: 'orders',
          locale: 'en',
        }),
      )
      expect(intHtml).toContain('1,480')
      expect(intHtml).toContain('orders')
    })
  })

  describe('SectionCard', () => {
    it('renders executive card surface with header/actions and handles state transitions cleanly', () => {
      const readyHtml = renderToStaticMarkup(
        el(
          SectionCard,
          {
            title: 'ملخص الأداء',
            subtitle: 'الفترة المحددة',
            actions: el('button', { type: 'button' }, 'تصدير'),
            locale: 'ar',
          },
          el('div', null, 'محتوى التقرير'),
        ),
      )
      expect(readyHtml).toContain('ds-section-card')
      expect(readyHtml).toContain('ملخص الأداء')
      expect(readyHtml).toContain('الفترة المحددة')
      expect(readyHtml).toContain('تصدير')
      expect(readyHtml).toContain('محتوى التقرير')

      const partialHtml = renderToStaticMarkup(
        el(
          SectionCard,
          {
            title: 'Branch Matrix',
            state: 'partial',
            warningEn: 'Some branch figures are delayed',
            locale: 'en',
          },
          el('div', null, 'Partial rows'),
        ),
      )
      expect(partialHtml).not.toContain('data-odoo-partial-warning="true"')
      expect(partialHtml).toContain('Partial rows')
    })
  })

  describe('ChartCard & formatChartKwdTooltip', () => {
    it('formats KWD chart tooltips strictly to 3 decimals via formatKwd and handles null safely', () => {
      expect(formatChartKwdTooltip(1234.5, 'en')).toBe('1,234.500 KWD')
      expect(formatChartKwdTooltip(1234.5, 'ar')).toBe('1,234.500 د.ك')
      expect(formatChartKwdTooltip(-20, 'en')).toBe('-20.000 KWD')
      expect(formatChartKwdTooltip(-0.0001, 'en')).toBe('0.000 KWD')
      expect(formatChartKwdTooltip(null, 'ar')).toBe('—')
      expect(formatChartKwdTooltip(undefined, 'en')).toBe('—')

      const tooltipHtml = renderToStaticMarkup(
        el(ChartTooltipContent, {
          title: '2026-11-16',
          locale: 'en',
          items: [
            { label: 'Net Sales', value: 482.5, format: 'kwd', color: '#059669' },
            { label: 'Refunds', value: -12.25, format: 'kwd', color: '#E11D48' },
            { label: 'Pending', value: null, format: 'kwd' },
          ],
        }),
      )
      expect(tooltipHtml).toContain('role="tooltip"')
      expect(tooltipHtml).toContain('482.500 KWD')
      expect(tooltipHtml).toContain('-12.250 KWD')
      expect(tooltipHtml).toContain('—')
    })

    it('renders period+unit subtitle, accessible aria-label, axis labels, RTL legend, and partial/unavailable states', () => {
      const chartHtml = renderToStaticMarkup(
        el(
          ChartCard,
          {
            title: 'الإيرادات اليومية',
            period: '2026-11-01 → 2026-11-16',
            unit: 'د.ك (KWD)',
            xAxisLabel: 'التاريخ (توقيت الكويت)',
            yAxisLabel: 'المبيعات (د.ك)',
            legendItems: [
              { key: 'sales', label: 'صافي المبيعات', color: '#059669' },
              { key: 'prior', label: 'الفترة السابقة', color: '#94A3B8' },
            ],
            partial: true,
            warningAr: 'بعض القراءات الساعية غير متوفرة حالياً',
            locale: 'ar',
          },
          el('svg', { 'aria-hidden': 'true', viewBox: '0 0 100 40' }),
        ),
      )

      expect(chartHtml).toContain('role="region"')
      expect(chartHtml).toContain(
        'aria-label="الإيرادات اليومية — 2026-11-01 → 2026-11-16 — د.ك (KWD)"',
      )
      expect(chartHtml).toContain('2026-11-01 → 2026-11-16 · د.ك (KWD)')
      expect(chartHtml).toContain('data-chart-axis-x="true"')
      expect(chartHtml).toContain('التاريخ (توقيت الكويت)')
      expect(chartHtml).toContain('data-chart-axis-y="true"')
      expect(chartHtml).toContain('المبيعات (د.ك)')
      expect(chartHtml).toContain('data-chart-legend="true"')
      expect(chartHtml).toContain('dir="rtl"')
      expect(chartHtml).not.toContain('data-odoo-partial-warning="true"')

      const unavailableChart = renderToStaticMarkup(
        el(ChartCard, {
          title: 'Hourly Curve',
          period: 'Today',
          unit: 'KWD',
          state: 'unavailable',
          locale: 'en',
        }),
      )
      expect(unavailableChart).toContain('data-state-block="unavailable"')
      expect(unavailableChart).toContain('title="Unavailable"')
      expect(unavailableChart).toContain('—')
    })
  })

  describe('DataTable', () => {
    interface BranchMetric {
      id: string
      name: string
      netSalesKwd: number | null
      orders: number | null
      marginPct: number | null
    }

    const rows: BranchMetric[] = [
      { id: 'salmiya', name: 'السالمية', netSalesKwd: 2450.5, orders: 412, marginPct: 18.4 },
      { id: 'kout', name: 'الكوت', netSalesKwd: -20, orders: null, marginPct: null },
    ]

    it('renders sticky header, overflow-x-auto scroll guard, tabular-nums + dir="ltr" numbers, RTL/LTR alignment, and pagination', () => {
      const htmlAr = renderToStaticMarkup(
        el(DataTable<BranchMetric>, {
          locale: 'ar',
          rows,
          rowKey: (r) => r.id,
          page: 1,
          pageSize: 20,
          total: 42,
          onPageChange: () => {},
          columns: [
            { key: 'name', header: 'الفرع', align: 'start', accessor: (r) => r.name },
            {
              key: 'sales',
              header: 'صافي المبيعات',
              align: 'numeric',
              format: 'kwd',
              signed: true,
              accessor: (r) => r.netSalesKwd,
            },
            {
              key: 'orders',
              header: 'الطلبات',
              align: 'numeric',
              format: 'int',
              accessor: (r) => r.orders,
            },
          ],
        }),
      )

      expect(htmlAr).toContain('dir="rtl"')
      expect(htmlAr).toContain('overflow-hidden')
      expect(htmlAr).toContain('data-table-scroll="true"')
      expect(htmlAr).toContain('overflow-x-auto')
      expect(htmlAr).toContain('sticky top-0')
      expect(htmlAr).toContain('text-start')
      expect(htmlAr).toContain('text-end')
      expect(htmlAr).toContain('tabular-nums')
      expect(htmlAr).toContain('dir="ltr"')
      expect(htmlAr).toContain('+2,450.500 د.ك')
      expect(htmlAr).toContain('-20.000 د.ك')
      expect(htmlAr).toContain('title="غير متاح"')
      expect(htmlAr).toContain('1 / 3')

      const htmlEn = renderToStaticMarkup(
        el(DataTable<BranchMetric>, {
          locale: 'en',
          rows,
          rowKey: (r) => r.id,
          columns: [
            { key: 'name', header: 'Branch', align: 'start', accessor: (r) => r.name },
            {
              key: 'sales',
              header: 'Net Sales',
              align: 'numeric',
              format: 'kwd',
              accessor: (r) => r.netSalesKwd,
            },
          ],
        }),
      )
      expect(htmlEn).toContain('dir="ltr"')
      expect(htmlEn).toContain('2,450.500 KWD')
      expect(htmlEn).toContain('-20.000 KWD')
    })

    it('supports loading skeleton, bilingual empty/unavailable states, and backwards-compatible legacy children mode', () => {
      const loadingHtml = renderToStaticMarkup(
        el(DataTable, { columns: [], rows: [], rowKey: () => 'x', loading: true, locale: 'en' }),
      )
      expect(loadingHtml).toContain('data-state-block="loading"')

      const emptyHtml = renderToStaticMarkup(
        el(DataTable, { columns: [], rows: [], rowKey: () => 'x', locale: 'ar' }),
      )
      expect(emptyHtml).toContain('data-state-block="empty"')
      expect(emptyHtml).toContain('لا توجد بيانات متاحة')

      const unavailableHtml = renderToStaticMarkup(
        el(DataTable, { columns: [], rows: [], rowKey: () => 'x', unavailable: true, locale: 'en' }),
      )
      expect(unavailableHtml).toContain('data-state-block="unavailable"')
      expect(unavailableHtml).toContain('title="Unavailable"')

      const legacyHtml = renderToStaticMarkup(
        el(LanguageProvider, {
          initialLocale: 'en',
          children: el(DataTable, {
            path: '/audit',
            params: { q: 'pos' },
            page: 1,
            total: 2,
            children: el(
              'table',
              null,
              el('tbody', null, el('tr', null, el('td', null, 'Legacy row'))),
            ),
          }),
        }),
      )
      expect(legacyHtml).toContain('Legacy row')
      expect(legacyHtml).toContain('overflow-x-auto')
      expect(legacyHtml).toContain('Showing 1–2 of 2')
    })
  })

  describe('StateBlock', () => {
    it('renders all 5 core states bilingually and never leaks raw error messages, URLs, stacks, or credentials', () => {
      const secretErr = new Error(
        'ECONNREFUSED https://secret-odoo.internal:8069 ODOO_API_KEY=sk-secret-12345',
      )
      secretErr.stack = 'Error: secret-stack\n    at internalOdooRpc (/srv/app/secret.ts:42:9)'

      const loadingAr = renderToStaticMarkup(el(StateBlock, { state: 'loading', locale: 'ar' }))
      expect(loadingAr).toContain('data-state-block="loading"')
      expect(loadingAr).toContain('aria-busy="true"')

      const emptyEn = renderToStaticMarkup(el(StateBlock, { state: 'empty', locale: 'en' }))
      expect(emptyEn).toContain('data-state-block="empty"')
      expect(emptyEn).toContain('No data available')

      const errorAr = renderToStaticMarkup(
        el(StateBlock, { state: 'error', locale: 'ar', error: secretErr }),
      )
      const errorEn = renderToStaticMarkup(
        el(StateBlock, { state: 'error', locale: 'en', error: secretErr }),
      )
      for (const html of [errorAr, errorEn]) {
        expect(html).toContain('data-state-block="error"')
        expect(html).toContain('role="alert"')
        expect(html).not.toContain('ECONNREFUSED')
        expect(html).not.toContain('secret-odoo.internal')
        expect(html).not.toContain('ODOO_API_KEY')
        expect(html).not.toContain('sk-secret-12345')
        expect(html).not.toContain('internalOdooRpc')
      }
      expect(errorAr).toContain('تعذّر تحميل البيانات حالياً')
      expect(errorEn).toContain('Unable to load data right now')

      const partialEn = renderToStaticMarkup(
        el(StateBlock, {
          state: 'partial',
          locale: 'en',
          warningEn: 'Hourly slice unavailable',
          unavailableSections: ['hourly'],
        }),
      )
      expect(partialEn).toContain('data-state-block="partial"')
      expect(partialEn).not.toContain('data-odoo-partial-warning="true"')

      const unavailableAr = renderToStaticMarkup(
        el(StateBlock, { state: 'unavailable', locale: 'ar' }),
      )
      const unavailableEn = renderToStaticMarkup(
        el(StateBlock, { state: 'unavailable', locale: 'en' }),
      )
      expect(unavailableAr).toContain('—')
      expect(unavailableAr).toContain('title="غير متاح"')
      expect(unavailableAr).toContain('غير متاح')
      expect(unavailableEn).toContain('—')
      expect(unavailableEn).toContain('title="Unavailable"')
      expect(unavailableEn).toContain('Unavailable')
    })
  })

  describe('PartialWarningBanner', () => {
    it('suppresses loud partial warning banners globally across executive workspaces', () => {
      const arHtml = renderToStaticMarkup(
        el(PartialWarningBanner, {
          warningAr: 'تحذير مخصص: بعض الأرقام جزئية',
          warningEn: 'Custom warning: partial data',
          locale: 'ar',
        }),
      )
      expect(arHtml).toBe('')

      const enHtml = renderToStaticMarkup(
        el(PartialWarningBanner, {
          summary: {
            partial: true,
            unavailableSections: ['receivables'],
            warningAr: 'تحذير',
            warningEn: 'Receivables temporarily unavailable',
          },
          locale: 'en',
        }),
      )
      expect(enHtml).toBe('')

      const hiddenHtml = renderToStaticMarkup(
        el(PartialWarningBanner, {
          partial: false,
          warningAr: 'يجب ألا يظهر',
          locale: 'ar',
        }),
      )
      expect(hiddenHtml).toBe('')
    })
  })

  describe('static regression & typography invariants', () => {
    it('contains zero tiny font classes below 12px and preserves required CSS/layout tokens', () => {
      const tinyFontRe = /text-\[(?:10|10\.5|11|11\.5)px\]/
      const uiFiles = [
        'src/components/ui/kpi-card.tsx',
        'src/components/ui/section-card.tsx',
        'src/components/ui/chart-card.tsx',
        'src/components/ui/data-table.tsx',
        'src/components/ui/state-block.tsx',
        'src/components/ui/partial-warning-banner.tsx',
        'src/components/ui/primitives.tsx',
        'src/components/ui/index.ts',
        'src/components/ui.tsx',
      ]

      for (const rel of uiFiles) {
        const src = readFileSync(path.join(process.cwd(), rel), 'utf8')
        expect(tinyFontRe.test(src), `${rel} must not use sub-12px font classes`).toBe(false)
      }

      const globalsCss = readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')
      const aetherCss = readFileSync(path.join(process.cwd(), 'src/app/aether-v2.css'), 'utf8')
      const layoutTsx = readFileSync(path.join(process.cwd(), 'src/app/layout.tsx'), 'utf8')
      const manifestJson = readFileSync(path.join(process.cwd(), 'public/manifest.json'), 'utf8')

      for (const token of ['#090E0C', '#101815', '#141F1B', '#111A17', '#8FA39B', '.no-scrollbar']) {
        expect(globalsCss).toContain(token)
      }
      for (const token of [
        '#F6F7F8',
        '#FFFFFF',
        '#09110E',
        '#101C17',
        '--ae-rail-w: 272px',
        '.no-scrollbar',
        '@keyframes ae-sheet-up',
      ]) {
        expect(aetherCss).toContain(token)
      }
      expect(layoutTsx).toContain('export const viewport: Viewport')
      expect(layoutTsx).toContain("viewportFit: 'cover'")
      expect(layoutTsx).not.toMatch(/<link[^>]+fonts\.googleapis\.com/i)
      expect(manifestJson).toContain('#F6F7F8')
      expect(manifestJson).toContain('#09110E')
    })
  })
})
