/**
 * V35 Polish — Shared chart-kit tests for `@/components/charts/v35-chart-kit` & `v35-chart-theme`.
 *
 * Verifies Recharts v3.10.1 SSR `ResponsiveContainer` (`initialDimension`), AR RTL axes
 * (`YAxis orientation="right"`, `XAxis reversed`), `TimelineAreaChart` (single-stat / hourly-area /
 * daily-area, thin `monotone` stroke, `<linearGradient>`, comparison overlay), `ComparisonBarChart`
 * (ghost-bar `background`, `[6, 6, 0, 0]` radius, slim `maxBarSize <= 24`), `V35DonutChart`,
 * and Chart Library palette tokens.
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
  it('V35_DONUT_PALETTE and V35_CHART_COLORS open on emerald, light navy, and amber — not three greens', async () => {
    const {
      V35_CHART_COLORS,
      V35_CHART_PALETTE,
      V35_DONUT_PALETTE,
      V35_HEATMAP_SCALE_DARK,
      V35_HEATMAP_SCALE_LIGHT,
    } = await import('@/components/charts/v35-chart-theme')

    expect(V35_CHART_COLORS.primary).toBe('#059669')
    expect(V35_CHART_COLORS.secondary).toBe('#1E40AF')
    expect(V35_CHART_COLORS.teal).toBe('#0D9488')
    expect(V35_CHART_COLORS.violet).toBe('#7C3AED')
    expect(V35_CHART_COLORS.warning).toBe('#D97706')
    expect(V35_CHART_COLORS.comparison).toBe('#94A3B8')

    expect(V35_DONUT_PALETTE).toContain('#059669')
    expect(V35_DONUT_PALETTE).toContain('#1E40AF')
    expect(V35_DONUT_PALETTE).toContain('#7C3AED')
    expect(V35_DONUT_PALETTE).toContain('#D97706')
    expect(V35_DONUT_PALETTE.slice(0, 3)).toEqual(['#059669', '#1E40AF', '#D97706'])
    expect(V35_CHART_PALETTE.slice(0, 3)).toEqual(['#059669', '#1E40AF', '#D97706'])
    expect(new Set(V35_CHART_PALETTE.slice(0, 3)).size).toBe(3)

    expect(V35_CHART_PALETTE).toContain('#059669')
    expect(V35_CHART_PALETTE).toContain('#0D9488')
    expect(V35_CHART_PALETTE).toContain('#7C3AED')
    expect(V35_CHART_PALETTE).toContain('#D97706')

    expect(V35_HEATMAP_SCALE_LIGHT).toHaveLength(5)
    expect(V35_HEATMAP_SCALE_DARK).toHaveLength(5)
  })
})

describe('V35 Polish — v35-chart-kit Recharts RTL & SVG wiring (mocked Recharts surface)', () => {
  afterEach(() => {
    vi.doUnmock('recharts')
    vi.resetModules()
  })

  function installRechartsMock() {
    const capturedYAxis: Array<{ orientation?: string }> = []
    const capturedXAxis: Array<{ reversed?: boolean }> = []
    const capturedAreaData: unknown[][] = []
    const capturedAreas: Array<{
      dataKey?: string
      type?: string
      strokeWidth?: number
      stroke?: string
      fill?: string
    }> = []
    const capturedBars: Array<{
      dataKey?: string
      radius?: unknown
      maxBarSize?: number
      background?: unknown
      fill?: string
      stackId?: string
    }> = []
    const capturedInitialDim: Array<{ width?: number; height?: number } | undefined> = []
    const capturedMinHeights: Array<number | string | undefined> = []

    vi.resetModules()
    vi.doMock('recharts', async (importOriginal) => {
      const actual = await importOriginal<typeof import('recharts')>()
      return {
        ...actual,
        ResponsiveContainer: ({
          children,
          initialDimension,
          minHeight,
        }: {
          children?: React.ReactNode
          initialDimension?: { width?: number; height?: number }
          minHeight?: number | string
        }) => {
          capturedInitialDim.push(initialDimension)
          capturedMinHeights.push(minHeight)
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
        Area: (props: {
          dataKey?: string
          type?: string
          strokeWidth?: number
          stroke?: string
          fill?: string
        }) => {
          capturedAreas.push({
            dataKey: props.dataKey,
            type: props.type,
            strokeWidth: props.strokeWidth,
            stroke: props.stroke,
            fill: props.fill,
          })
          return React.createElement('path', {
            'data-mock-area': String(props.dataKey ?? ''),
            'data-area-type': String(props.type ?? ''),
            'data-stroke-width': String(props.strokeWidth ?? ''),
          })
        },
        Bar: (props: {
          dataKey?: string
          radius?: unknown
          maxBarSize?: number
          background?: unknown
          fill?: string
          stackId?: string
        }) => {
          capturedBars.push({
            dataKey: props.dataKey,
            radius: props.radius,
            maxBarSize: props.maxBarSize,
            background: props.background,
            fill: props.fill,
            stackId: props.stackId,
          })
          return React.createElement('rect', {
            'data-mock-bar': String(props.dataKey ?? ''),
            'data-has-ghost': props.background ? 'true' : 'false',
            'data-max-bar-size': String(props.maxBarSize ?? ''),
          })
        },
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

    return {
      capturedYAxis,
      capturedXAxis,
      capturedAreaData,
      capturedAreas,
      capturedBars,
      capturedInitialDim,
      capturedMinHeights,
    }
  }

  it('TimelineAreaChart wires ResponsiveContainer initialDimension, monotone thin strokeWidth (<=2), gradient <linearGradient>, comparison overlay, and RTL axes', async () => {
    const cap = installRechartsMock()
    const { TimelineAreaChart } = await import('@/components/charts/v35-chart-kit')

    const hourlyHtml = renderToStaticMarkup(
      React.createElement(TimelineAreaChart, {
        dailySeries: ONE_DAY_SERIES,
        hourlySeries: HOURLY_SERIES,
        isAr: true,
      }),
    )

    expect(hourlyHtml).toContain('data-chart-mode="hourly-area"')
    expect(hourlyHtml).toContain('<path')
    expect(hourlyHtml).toContain('<linearGradient')
    expect(hourlyHtml).not.toContain('<rect')
    expect(cap.capturedInitialDim.some((d) => (d?.width ?? 0) > 0 && (d?.height ?? 0) > 0)).toBe(true)
    expect(cap.capturedMinHeights.some((h) => Number(h) >= 220)).toBe(true)
    expect(cap.capturedYAxis.some((y) => y.orientation === 'right')).toBe(true)
    const xReversedByProp = cap.capturedXAxis.some((x) => x.reversed === true)
    const firstPlotted = cap.capturedAreaData[0]?.[0] as { hour?: number; label?: string } | undefined
    const xReversedByOrder = firstPlotted?.hour === 18 || firstPlotted?.label === '18:00'
    expect(xReversedByProp || xReversedByOrder).toBe(true)

    expect(cap.capturedAreas).toHaveLength(1)
    expect(cap.capturedAreas[0].type).toBe('monotone')
    expect(cap.capturedAreas[0].strokeWidth).toBeLessThanOrEqual(2)
    expect(cap.capturedAreas[0].fill).toMatch(/^url\(#v35Area-/)

    // Comparison overlay via secondarySeries + secondaryValue in RTL
    cap.capturedAreas.length = 0
    cap.capturedYAxis.length = 0
    cap.capturedXAxis.length = 0

    const comparisonHtml = renderToStaticMarkup(
      React.createElement(TimelineAreaChart, {
        dailySeries: [
          { day: '2026-11-15', orders: 40, netKwd: 410.5 },
          { day: '2026-11-16', orders: 46, netKwd: 485.25, secondaryValue: 440.0 },
          { day: '2026-11-17', orders: 24, netKwd: 154.7 },
        ],
        secondarySeries: [
          { day: '2026-11-15', value: 380.0 },
          { day: '2026-11-17', value: 190.25 },
        ],
        isAr: true,
        valueLabel: 'الحالي',
        secondaryLabel: 'السابق',
      }),
    )

    expect(comparisonHtml).toContain('data-chart-mode="daily-area"')
    expect(comparisonHtml).toContain('v35Area-')
    expect(comparisonHtml).toContain('v35AreaSec-')
    expect((comparisonHtml.match(/<linearGradient/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(cap.capturedYAxis.some((y) => y.orientation === 'right')).toBe(true)
    expect(cap.capturedXAxis.some((x) => x.reversed === true)).toBe(true)

    expect(cap.capturedAreas).toHaveLength(2)
    const secArea = cap.capturedAreas.find((a) => a.dataKey === 'secondaryValue')
    const priArea = cap.capturedAreas.find((a) => a.dataKey === 'value')
    expect(secArea).toBeDefined()
    expect(priArea).toBeDefined()
    expect(secArea!.type).toBe('monotone')
    expect(priArea!.type).toBe('monotone')
    expect(secArea!.strokeWidth).toBeLessThanOrEqual(2)
    expect(priArea!.strokeWidth).toBeLessThanOrEqual(2)
    expect(secArea!.stroke).toBe('#94A3B8')
    expect(priArea!.stroke).toBe('#059669')
    expect(secArea!.fill).toMatch(/^url\(#v35AreaSec-/)
    expect(priArea!.fill).toMatch(/^url\(#v35Area-/)
  })

  it('ComparisonBarChart wires ghost-bar background, rounded [6, 6, 0, 0] radius, slim maxBarSize (<= 24), and RTL axes when showGhostBars defaults to true', async () => {
    const cap = installRechartsMock()
    const { ComparisonBarChart } = await import('@/components/charts/v35-chart-kit')

    const groupedHtml = renderToStaticMarkup(
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

    expect(groupedHtml).toContain('data-chart-kind="comparison-bar"')
    expect(cap.capturedYAxis.some((y) => y.orientation === 'right')).toBe(true)
    expect(cap.capturedXAxis.some((x) => x.reversed === true)).toBe(true)
    expect(cap.capturedBars).toHaveLength(2)

    for (const bar of cap.capturedBars) {
      expect(bar.radius).toEqual([6, 6, 0, 0])
      expect(bar.maxBarSize).toBeDefined()
      expect(bar.maxBarSize!).toBeLessThanOrEqual(24)
      expect(bar.background).toEqual(
        expect.objectContaining({
          fill: expect.stringContaining('--v35-chart-ghost'),
          radius: 6,
        }),
      )
    }

    // Single-series default also stays slim (<= 24) with ghost bars, and showGhostBars=false omits background
    cap.capturedBars.length = 0
    renderToStaticMarkup(
      React.createElement(ComparisonBarChart, {
        data: [
          { id: 'd1', label: '2026-11-16', value: 485.25 },
          { id: 'd2', label: '2026-11-17', value: 154.7 },
        ],
        isAr: false,
      }),
    )
    expect(cap.capturedBars).toHaveLength(1)
    expect(cap.capturedBars[0].radius).toEqual([6, 6, 0, 0])
    expect(cap.capturedBars[0].maxBarSize!).toBeLessThanOrEqual(24)
    expect(cap.capturedBars[0].background).toBeDefined()

    cap.capturedBars.length = 0
    renderToStaticMarkup(
      React.createElement(ComparisonBarChart, {
        data: [
          { id: 'd1', label: '2026-11-16', value: 485.25 },
          { id: 'd2', label: '2026-11-17', value: 154.7 },
        ],
        isAr: false,
        showGhostBars: false,
      }),
    )
    expect(cap.capturedBars).toHaveLength(1)
    expect(cap.capturedBars[0].background).toBeUndefined()
  })
})
