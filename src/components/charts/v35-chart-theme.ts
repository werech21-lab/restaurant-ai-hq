import { formatInt } from '@/lib/format'

/**
 * V35 Executive Chart Theme & Shared Palette (server-safe, zero `'use client'`).
 * Refined "Chart Library" aesthetic combining calm slate/zinc neutrals, cobalt primary
 * (`#2563EB` light / `#3B82F6` dark), soft teal, violet, amber, sky, and comparison slate.
 */
export const V35_CHART_COLORS = {
  primary: '#059669',
  primaryDark: '#047857',
  primarySoft: '#10B981',
  primaryDeep: '#065F46',
  comparison: '#94A3B8',
  secondary: '#1E40AF',
  secondaryMuted: '#4F6673',
  indigo: '#1E40AF',
  info: '#0F766E',
  emerald: '#059669',
  teal: '#0D9488',
  tealSoft: '#14B8A6',
  violet: '#7C3AED',
  violetSoft: '#8B5CF6',
  warning: '#D97706',
  amberSoft: '#F59E0B',
  negative: '#E11D48',
  gridStroke: '#E2ECE8',
  axisTick: '#4F6673',
  ghostBarLight: 'rgba(209, 250, 229, 0.50)',
  ghostBarDark: 'rgba(148, 163, 184, 0.14)',
} as const

export const V35_DONUT_PALETTE = [
  '#047857',
  '#10B981',
  '#34D399',
  '#1E40AF',
  '#0D9488',
  '#64748B',
] as const

export const V35_CHART_PALETTE = [
  V35_CHART_COLORS.primary,
  V35_CHART_COLORS.teal,
  V35_CHART_COLORS.secondary,
  V35_CHART_COLORS.warning,
  V35_CHART_COLORS.info,
  V35_CHART_COLORS.comparison,
] as const

/**
 * 5-step subtle mint -> emerald -> forest intensity stops (0 = quietest -> 4 = peak)
 * for `HourWeekdayHeatmap` in Light & Dark modes.
 */
export const V35_HEATMAP_SCALE_LIGHT = [
  '#EDF2F0',
  '#D1FAE5',
  '#6EE7B7',
  '#10B981',
  '#047857',
] as const

export const V35_HEATMAP_SCALE_DARK = [
  '#1E293B',
  '#064E3B',
  '#047857',
  '#10B981',
  '#34D399',
] as const

export const V35_CHART_GRID_PROPS = {
  vertical: false,
  strokeDasharray: '3 3',
  stroke: V35_CHART_COLORS.gridStroke,
  strokeOpacity: 0.45,
  className: 'stroke-slate-200/70 dark:stroke-slate-800/80',
} as const

export const V35_AXIS_TICK_STYLE = {
  fontSize: 11.5,
  fontWeight: 500,
  fill: '#64748B',
} as const

/**
 * Always pairs light frosted white glass surface with dark slate ink so `[role="tooltip"]`
 * stays crisp and AA-accessible in both Light and Blue Dark modes.
 */
export const V35_GLASS_TOOLTIP_CLASS =
  'min-w-[192px] rounded-2xl border border-slate-200/80 bg-white/95 px-3.5 py-2.5 text-xs text-slate-950 shadow-xl backdrop-blur-md ring-1 ring-slate-900/5'

export type ChartTooltipTone = 'neutral' | 'emerald' | 'rose' | 'amber' | 'slate' | 'blue'

export const V35_TOOLTIP_TONE_CLASS: Record<ChartTooltipTone, string> = {
  neutral: 'text-slate-950',
  emerald: 'text-emerald-700',
  rose: 'text-rose-600',
  amber: 'text-amber-700',
  slate: 'text-slate-500',
  blue: 'text-[#047857]',
}

export const V35_CHART_CARD_CLASS =
  'rounded-2xl border border-slate-200/85 bg-white p-4 sm:p-5 shadow-[0_2px_6px_rgba(30,58,95,0.03)] dark:border-slate-800 dark:bg-slate-900/95'

export const V35_CHART_PLOT_SURFACE_CLASS = 'relative px-1 pt-2'

export function resolveV35DonutColor(index: number, explicit?: string): string {
  const trimmed = explicit?.trim()
  if (trimmed) return trimmed
  return V35_DONUT_PALETTE[index % V35_DONUT_PALETTE.length]
}

/**
 * Normalizes legacy ultra-dark bar fills (`#0B1220`, `#0F172A`) to V35 cobalt blue
 * so bars stay crisp on both frosted light and midnight-navy dark canvases.
 */
export function normalizeV35SeriesColor(
  color?: string,
  fallback: string = V35_CHART_COLORS.primary,
): string {
  if (!color) return fallback
  const upper = color.trim().toUpperCase()
  if (upper === '#0B1220' || upper === '#0F172A') {
    return V35_CHART_COLORS.primary
  }
  return color
}

/**
 * Normalizes YYYY-MM-DD ("2026-10-29") or MM-DD ("10-29", "11-01") date labels
 * into compact DD/MM ("29/10", "01/11") so X-axis ticks remain readable on narrow mobile viewports.
 */
export function formatCompactAxisLabel(raw: string): string {
  const s = (raw ?? '').trim()
  const fullIso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (fullIso) return `${fullIso[3]}/${fullIso[2]}`
  const mmDd = /^(\d{2})-(\d{2})$/.exec(s)
  if (mmDd) return `${mmDd[2]}/${mmDd[1]}`
  return s
}

/**
 * Formats Y-axis KWD ticks using Western 0-9 numerals (`tabular-nums`),
 * rendering `7.3 ألف` / `5.4 ألف` / `1.1 ألف` in Arabic and `7.3k` / `5.4k` in English.
 */
export function formatCompactKwdTick(v: number, isAr: boolean): string {
  const safe = Number.isFinite(v) ? Math.max(0, v) : 0
  if (safe >= 1000) {
    const k = (safe / 1000).toFixed(1)
    return isAr ? `${k} ألف` : `${k}k`
  }
  return formatInt(safe)
}
