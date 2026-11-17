import { formatInt } from '@/lib/format'

/**
 * V35 Executive Chart Theme & Shared Palette (server-safe, zero `'use client'`).
 * Soft cobalt/sky blue primary paired with calm comparison slate, subtle hairline
 * horizontal grids, frosted glass tooltips, and restrained indigo/sky donut tones.
 */
export const V35_CHART_COLORS = {
  primary: '#2563EB',
  primaryDark: '#38BDF8',
  primarySoft: '#60A5FA',
  primaryDeep: '#1D4ED8',
  comparison: '#94A3B8',
  secondary: '#475569',
  secondaryMuted: '#94A3B8',
  indigo: '#818CF8',
  info: '#0EA5E9',
  emerald: '#10B981',
  warning: '#D97706',
  negative: '#E11D48',
  gridStroke: '#E2E8F0',
  axisTick: '#64748B',
} as const

export const V35_DONUT_PALETTE = [
  '#2563EB',
  '#38BDF8',
  '#818CF8',
  '#94A3B8',
  '#0EA5E9',
] as const

export const V35_CHART_PALETTE = [
  V35_CHART_COLORS.primary,
  V35_CHART_COLORS.comparison,
  V35_CHART_COLORS.info,
  V35_CHART_COLORS.indigo,
  V35_CHART_COLORS.primaryDark,
] as const

export const V35_CHART_GRID_PROPS = {
  vertical: false,
  strokeDasharray: '3 3',
  stroke: V35_CHART_COLORS.gridStroke,
  strokeOpacity: 0.6,
  className: 'stroke-slate-200/60 dark:stroke-slate-400/15',
} as const

export const V35_AXIS_TICK_STYLE = {
  fontSize: 12,
  fontWeight: 600,
  fill: V35_CHART_COLORS.axisTick,
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
  blue: 'text-blue-700',
}

export const V35_CHART_PLOT_SURFACE_CLASS =
  'ae-bento-subcard relative rounded-2xl border border-slate-200/70 bg-slate-50/70 px-2.5 py-3.5 sm:p-4 backdrop-blur-sm dark:border-sky-400/15 dark:bg-slate-900/35'

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
