/**
 * V35 Polish — Wave 0 RED tests for `@/components/charts/v35-chart-kit`.
 *
 * Uses dynamic `await import('@/components/charts/v35-chart-kit')` inside tests so
 * missing module cleanly fails RED before Lane 2 lands `v35-chart-kit.tsx`.
 *
 * Also documents the Recharts v3.10.1 SSR contract: `ResponsiveContainer` needs
 * `initialDimension={{ width: 640, height: 240 }}` to render `.recharts-wrapper` in SSR,
 * while `ReportChartSize` only writes Redux size inside `useEffect` (so SVG surface
 * mounts on client hydration; Recharts prop-wiring is verified via mocked Recharts below).
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ONE_DAY_SERIES = [{ day: '2026-11-17', orders: 24, netKwd: 154.7 }]
const MULTI_DAY_SERIES = [
  { day: '2026-11-15', orders: 40, netKwd: 410.5 },
  { day: '2026-11-16', orders: 46, netKwd: 485.25 },
  { day: '2026-11-17', orders: 24, netKwd: 154.7 },
]
const HOURLY_SERIES = [
  { hour: 9, orders: 4, netKwd: 25.5 },
  { hour: 12, orders: 8, netKwd: 54.0 },
  { hour: 15, orders: 7, netKwd: 45.2 },
  { hour: 18, orders: 5, netKwd: 30.0 },
]

describe('V35 Polish — v35-chart-kit SSR render & RTL contracts', () => {
  beforeEach(() => {
    vi.doUnmock('recharts')
    vi.resetModules()
  })

  it('TimelineAreaChart renders a compact single-value stat with date and ZERO <rect bars for a 1-point daily series without hourlySeries', async () => {
    const { TimelineAreaChart } = await import('@/components/charts/v35-chart-kit')

    const arHtml = renderToStaticMarkup(
      React.createElement(TimelineAreaChart, {
        dailySeries: ONE_DAY_SERIES,
        isAr: true,
        unitLabel: 'د.ك',
      }),
    )
    expect(arHtml).toContain('data-chart-mode="single-stat"')
    expect(arHtml).toContain('154.700')
    expect(arHtml).toMatch(/2026-11-17|17\/11/)
    expect(arHtml).not.toContain('<rect')
    expect(arHtml).not.toContain('recharts-wrapper')

    const enHtml = renderToStaticMarkup(
      React.createElement(TimelineAreaChart, {
        dailySeries: ONE_DAY_SERIES,
        hourlySeries: [],
        isAr: false,
        unitLabel: 'KWD',
      }),
    )
    expect(enHtml).toContain('data-chart-mode="single-stat"')
    expect(enHtml).toContain('154.700')
    expect(enHtml).toMatch(/2026-11-17|17\/11/)
    expect(enHtml).not.toContain('<rect')
    expect(enHtml).not.toContain('recharts-wrapper')
  })

  it('TimelineAreaChart switches to hourly area chart when 1-point daily series has hourlySeries and uses ResponsiveContainer initialDimension', async () => {
    const { TimelineAreaChart } = await import('@/components/charts/v35-chart-kit')

    const html = renderToStaticMarkup(
      React.createElement(TimelineAreaChart, {
        dailySeries: ONE_DAY_SERIES,
        hourlySeries: HOURLY_SERIES,
        isAr: true,
        unitLabel: 'د.ك',
      }),
    )

    expect(html).toContain('data-chart-kind="timeline-area"')
    expect(html).toContain('data-chart-mode="hourly-area"')
    expect(html).not.toContain('data-chart-mode="single-stat"')
    expect(html).not.toContain('<rect')
    const hasSvgPath = html.includes('<path')
    const hasSizedRechartsContainer =
      html.includes('recharts-responsive-container') && html.includes('recharts-wrapper')
    expect(hasSvgPath || hasSizedRechartsContainer).toBe(true)
  })

  it('TimelineAreaChart, ComparisonBarChart, and V35DonutChart set RTL right-side Y-axis metadata and bilingual labels', async () => {
    const { TimelineAreaChart, ComparisonBarChart, V35DonutChart } = await import(
      '@/components/charts/v35-chart-kit'
    )

    const arArea = renderToStaticMarkup(
      React.createElement(TimelineAreaChart, {
        dailySeries: MULTI_DAY_SERIES,
        isAr: true,
      }),
    )
    expect(arArea).toContain('dir="rtl"')
    expect(arArea).toContain('data-y-axis-side="right"')
    expect(arArea).toContain('data-x-axis-reversed="true"')

    const enArea = renderToStaticMarkup(
      React.createElement(TimelineAreaChart, {
        dailySeries: MULTI_DAY_SERIES,
        isAr: false,
      }),
    )
    expect(enArea).toContain('dir="ltr"')
    expect(enArea).toContain('data-y-axis-side="left"')
    expect(enArea).toContain('data-x-axis-reversed="false"')

    const arBar = renderToStaticMarkup(
      React.createElement(ComparisonBarChart, {
        data: [
          { id: 'ardiya', label: 'العارضية', value: 99.35, comparisonValue: 85.0 },
          { id: 'promenade', label: 'بروميناد', value: 31.55, comparisonValue: 28.0 },
        ],
        isAr: true,
        primaryLabel: 'الحالي',
        comparisonLabel: 'السابق',
      }),
    )
    expect(arBar).toContain('data-chart-kind="comparison-bar"')
    expect(arBar).toContain('dir="rtl"')
    expect(arBar).toContain('data-y-axis-side="right"')
    expect(arBar).toContain('data-x-axis-reversed="true"')
    expect(arBar.includes('<rect') || arBar.includes('recharts-wrapper')).toBe(true)

    const arDonut = renderToStaticMarkup(
      React.createElement(V35DonutChart, {
        slices: [
          {
            id: 'cogs',
            label: 'تكلفة المواد',
            value: 3.5,
            valueFormatted: '3.500 د.ك',
            pctFormatted: '35.0%',
            color: '#38BDF8',
          },
          {
            id: 'net',
            label: 'صافي التشغيل',
            value: 6.5,
            valueFormatted: '6.500 د.ك',
            pctFormatted: '65.0%',
            color: '#2563EB',
          },
        ],
        centerValue: '6.500 د.ك',
        centerLabel: 'صافي التشغيل',
        isAr: true,
      }),
    )
    expect(arDonut).toContain('data-chart-kind="v35-donut"')
    expect(arDonut).toContain('dir="rtl"')
    expect(arDonut).toContain('6.500 د.ك')
    expect(arDonut).toContain('تكلفة المواد')
  })
})

describe('V35 Polish — v35-chart-kit Recharts RTL & SVG wiring (mocked Recharts surface)', () => {
  afterEach(() => {
    vi.doUnmock('recharts')
    vi.resetModules()
  })

  it('wires ResponsiveContainer initialDimension, Area <path>, YAxis orientation="right", and reversed XAxis in RTL', async () => {
    const capturedYAxis: Array<{ orientation?: string }> = []
    const capturedXAxis: Array<{ reversed?: boolean }> = []
    const capturedAreaData: unknown[][] = []
    const capturedInitialDim: Array<{ width?: number; height?: number } | undefined> = []

    vi.resetModules()
    vi.doMock('recharts', async (importOriginal) => {
      const actual = await importOriginal<typeof import('recharts')>()
      return {
        ...actual,
        ResponsiveContainer: ({
          children,
          initialDimension,
        }: {
          children?: React.ReactNode
          initialDimension?: { width?: number; height?: number }
        }) => {
          capturedInitialDim.push(initialDimension)
          return React.createElement(
            'div',
            {
              'data-mock-responsive-container': 'true',
              'data-init-w': initialDimension?.width ?? 0,
              'data-init-h': initialDimension?.height ?? 0,
            },
            children,
          )
        },
        AreaChart: ({
          children,
          data,
        }: {
          children?: React.ReactNode
          data?: unknown[]
        }) => {
          if (Array.isArray(data)) capturedAreaData.push(data)
          return React.createElement('svg', { 'data-mock-chart': 'area' }, children)
        },
        BarChart: ({
          children,
          data,
        }: {
          children?: React.ReactNode
          data?: unknown[]
        }) => {
          if (Array.isArray(data)) capturedAreaData.push(data)
          return React.createElement('svg', { 'data-mock-chart': 'bar' }, children)
        },
        PieChart: ({ children }: { children?: React.ReactNode }) =>
          React.createElement('svg', { 'data-mock-chart': 'pie' }, children),
        Area: ({ dataKey }: { dataKey?: string }) =>
          React.createElement('path', { 'data-mock-area': String(dataKey ?? '') }),
        Bar: ({ dataKey }: { dataKey?: string }) =>
          React.createElement('rect', { 'data-mock-bar': String(dataKey ?? '') }),
        Pie: ({ dataKey }: { dataKey?: string }) =>
          React.createElement('path', { 'data-mock-pie': String(dataKey ?? '') }),
        YAxis: ({ orientation }: { orientation?: string }) => {
          capturedYAxis.push({ orientation })
          return React.createElement('g', { 'data-mock-yaxis-orientation': orientation ?? 'left' })
        },
        XAxis: ({ reversed }: { reversed?: boolean }) => {
          capturedXAxis.push({ reversed })
          return React.createElement('g', { 'data-mock-xaxis-reversed': String(Boolean(reversed)) })
        },
        CartesianGrid: () => null,
        Tooltip: () => null,
        Legend: () => null,
        Cell: () => null,
      }
    })

    const { TimelineAreaChart } = await import('@/components/charts/v35-chart-kit')
    const html = renderToStaticMarkup(
      React.createElement(TimelineAreaChart, {
        dailySeries: ONE_DAY_SERIES,
        hourlySeries: HOURLY_SERIES,
        isAr: true,
      }),
    )

    expect(html).toContain('<path')
    expect(html).not.toContain('<rect')
    expect(capturedInitialDim.some((d) => (d?.width ?? 0) > 0 && (d?.height ?? 0) > 0)).toBe(true)
    expect(capturedYAxis.some((y) => y.orientation === 'right')).toBe(true)
    const xReversedByProp = capturedXAxis.some((x) => x.reversed === true)
    const firstPlotted = capturedAreaData[0]?.[0] as { hour?: number; label?: string } | undefined
    const xReversedByOrder = firstPlotted?.hour === 18 || firstPlotted?.label === '18:00'
    expect(xReversedByProp || xReversedByOrder).toBe(true)
  })
})
