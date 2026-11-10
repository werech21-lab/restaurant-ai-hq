'use client'

import React, { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Download, TrendingDown, TrendingUp } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { fmt, toCsv, type Lang, type Tone } from '@/lib/aether/ledger'

// ---------------------------------------------------------------------------
// Language helper
// ---------------------------------------------------------------------------
export function useLang() {
  const { locale } = useI18n()
  const lang: Lang = locale === 'en' ? 'en' : 'ar'
  const T = useCallback((en: string, ar: string) => (lang === 'ar' ? ar : en), [lang])
  return { lang, isAr: lang === 'ar', T, dir: (lang === 'ar' ? 'rtl' : 'ltr') as 'rtl' | 'ltr' }
}

// ---------------------------------------------------------------------------
// Tone tokens (semantic accents)
// ---------------------------------------------------------------------------
export const TONE_HEX: Record<Tone, string> = {
  emerald: '#059669',
  sky: '#0284C7',
  amber: '#D97706',
  rose: '#E11D48',
  slate: '#475569',
}

export const TONE_TEXT: Record<Tone, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  sky: 'text-sky-600 dark:text-sky-400',
  amber: 'text-amber-600 dark:text-amber-400',
  rose: 'text-rose-600 dark:text-rose-400',
  slate: 'text-slate-600 dark:text-slate-300',
}

export const TONE_BADGE: Record<Tone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  sky: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/70 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  rose: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
  slate: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/70 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30',
}

export function Badge({ tone = 'slate', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_BADGE[tone]} ${className}`}>
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------
export function Num({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`ae-num ${className}`}>{children}</span>
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
export function SectionHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {icon ? <span className="ae-icon-badge">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="ae-h text-base text-slate-900 dark:text-slate-50 sm:text-lg">{title}</h2>
          {subtitle ? <p className="ae-meta mt-0.5">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------
export function Sparkline({ data, color = '#0284C7', height = 32, width = 112 }: { data: number[]; color?: string; height?: number; width?: number }) {
  const id = useMemo(() => `sp-${Math.abs(data.reduce((s, v, i) => s + v * (i + 3), 0)).toString(36).slice(0, 8)}`, [data])
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 6)])
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={color} />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// StatsCard V2
// ---------------------------------------------------------------------------
export function StatsCardV2({
  icon,
  label,
  value,
  sub,
  delta,
  deltaTone = 'emerald',
  deltaDown = false,
  spark,
  sparkColor,
  target,
  valueTone,
  onClick,
}: {
  icon: ReactNode
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  delta?: ReactNode
  deltaTone?: Tone
  deltaDown?: boolean
  spark?: number[]
  sparkColor?: string
  target?: { label: ReactNode; progress: number; tone?: Tone }
  valueTone?: Tone
  onClick?: () => void
}) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="ae-tile ae-lift flex h-full w-full flex-col justify-between gap-3 p-5 text-start"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="ae-icon-badge">{icon}</span>
          <span className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        </div>
        {delta ? (
          <Badge tone={deltaTone}>
            {deltaDown ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            {delta}
          </Badge>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className={`ae-num text-[1.45rem] leading-tight ${valueTone ? TONE_TEXT[valueTone] : 'text-slate-900 dark:text-slate-50'}`}>{value}</div>
          {sub ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</div> : null}
        </div>
        {spark ? <Sparkline data={spark} color={sparkColor ?? TONE_HEX[valueTone ?? 'sky']} /> : null}
      </div>
      {target ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>{target.label}</span>
            <Num className="font-bold">{fmt(Math.min(100, Math.max(0, target.progress)), 0)}%</Num>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(2, target.progress))}%`, backgroundColor: TONE_HEX[target.tone ?? 'sky'] }}
            />
          </div>
        </div>
      ) : null}
    </Wrapper>
  )
}

// ---------------------------------------------------------------------------
// Donut gauge
// ---------------------------------------------------------------------------
export function DonutGauge({
  segments,
  center,
  size = 196,
  stroke = 22,
  activeIndex,
  onHover,
}: {
  segments: { key: string; value: number; color: string }[]
  center: ReactNode
  size?: number
  stroke?: number
  activeIndex?: number | null
  onHover?: (idx: number | null) => void
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const gap = segments.length > 1 ? 2.5 : 0
  let acc = 0
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = Math.max(0, (s.value / total) * c - gap)
          const offset = -(acc / total) * c
          acc += s.value
          const dim = activeIndex != null && activeIndex !== i
          return (
            <circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={activeIndex === i ? stroke + 4 : stroke}
              strokeDasharray={`${len} ${c}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              style={{ opacity: dim ? 0.35 : 1, transition: 'opacity 160ms ease, stroke-width 160ms ease' }}
              onMouseEnter={() => onHover?.(i)}
              onMouseLeave={() => onHover?.(null)}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">{center}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Circular gauge (single value)
// ---------------------------------------------------------------------------
export function CircularGauge({
  value,
  max = 100,
  color = '#059669',
  size = 128,
  stroke = 12,
  label,
  caption,
}: {
  value: number
  max?: number
  color?: string
  size?: number
  stroke?: number
  label: ReactNode
  caption?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = Math.max(0, Math.min(1, value / max))
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.09" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${ratio * c} ${c}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 600ms cubic-bezier(0.22,1.2,0.36,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{label}</div>
      </div>
      {caption ? <div className="text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">{caption}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rounded grouped bar chart (pure CSS, RTL-safe)
// ---------------------------------------------------------------------------
export function RoundedBars({
  rows,
  height = 220,
  seriesA,
  seriesB,
  formatTop,
  highlight,
  onSelect,
}: {
  rows: { key: string; label: string; a: number; b?: number; top?: string }[]
  height?: number
  seriesA: { color: string; label: string }
  seriesB?: { color: string; label: string }
  formatTop?: (row: { a: number; b?: number }) => string
  highlight?: string | null
  onSelect?: (key: string) => void
}) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.a, r.b ?? 0)))
  return (
    <div>
      <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
        {rows.map((r) => {
          const dim = highlight && highlight !== r.key
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onSelect?.(r.key)}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              style={{ opacity: dim ? 0.4 : 1, transition: 'opacity 160ms ease' }}
              title={r.label}
            >
              <span className="ae-num text-[10px] font-bold text-slate-500 dark:text-slate-400">{r.top ?? formatTop?.(r) ?? ''}</span>
              <div className="flex h-full w-full items-end justify-center gap-1">
                <div
                  className="ae-bar-grow w-full max-w-[22px] rounded-t-full rounded-b-md transition-[height] duration-500 ease-out group-hover:brightness-110"
                  style={{ height: `${Math.max(3, (r.a / max) * 100)}%`, backgroundColor: seriesA.color }}
                />
                {r.b != null && seriesB ? (
                  <div
                    className="ae-bar-grow w-full max-w-[22px] rounded-t-full rounded-b-md transition-[height] duration-500 ease-out group-hover:brightness-110"
                    style={{ height: `${Math.max(3, (r.b / max) * 100)}%`, backgroundColor: seriesB.color }}
                  />
                ) : null}
              </div>
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {rows.map((r) => (
          <span key={r.key} className="min-w-0 flex-1 truncate text-center text-[10px] font-semibold text-slate-500 dark:text-slate-400" title={r.label}>
            {r.label}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seriesA.color }} />
          {seriesA.label}
        </span>
        {seriesB ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seriesB.color }} />
            {seriesB.label}
          </span>
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CSV + clipboard helpers
// ---------------------------------------------------------------------------
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  if (typeof window === 'undefined') return
  const blob = new Blob(['\uFEFF' + toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function useCopy(timeout = 1800) {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = useCallback(
    async (key: string, text: string) => {
      try {
        await navigator.clipboard?.writeText(text)
      } catch {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        try {
          document.execCommand('copy')
        } catch {
          // clipboard unavailable
        }
        ta.remove()
      }
      setCopied(key)
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), timeout)
    },
    [timeout],
  )
  return { copied, copy }
}

// ---------------------------------------------------------------------------
// Column-reorderable analytical table with CSV export
// ---------------------------------------------------------------------------
export interface ReorderColumn<Row> {
  key: string
  en: string
  ar: string
  render: (row: Row) => ReactNode
  csv: (row: Row) => string | number
  align?: 'start' | 'end'
}

export function ReorderableTable<Row>({
  columns,
  rows,
  rowKey,
  csvName,
  maxHeight = 520,
  toolbar,
  footer,
}: {
  columns: ReorderColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  csvName: string
  maxHeight?: number
  toolbar?: ReactNode
  footer?: ReactNode
}) {
  const { lang, isAr, T } = useLang()
  const [order, setOrder] = useState<string[]>(() => columns.map((c) => c.key))
  const ordered = order.map((k) => columns.find((c) => c.key === k)).filter(Boolean) as ReorderColumn<Row>[]

  const move = (idx: number, visual: 'left' | 'right') => {
    // Visual direction → logical index direction depends on writing mode.
    const step = visual === 'left' ? (isAr ? 1 : -1) : isAr ? -1 : 1
    const target = idx + step
    if (target < 0 || target >= order.length) return
    const next = [...order]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setOrder(next)
  }

  const exportCsv = () => {
    const header = ordered.map((c) => (lang === 'ar' ? c.ar : c.en))
    const body = rows.map((r) => ordered.map((c) => c.csv(r)))
    downloadCsv(csvName, [header, ...body])
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
        <button type="button" onClick={exportCsv} className="ae-pill-dark">
          <Download className="h-3.5 w-3.5" />
          {T('Export CSV', 'تصدير الجدول')}
        </button>
      </div>
      <div className="ae-tile overflow-auto" style={{ maxHeight }}>
        <table className="w-full min-w-[720px] text-start text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              {ordered.map((c, idx) => (
                <th key={c.key} className={`whitespace-nowrap bg-slate-50 px-3 py-2.5 font-semibold text-slate-500 dark:bg-slate-700/60 dark:text-slate-400 ${c.align === 'end' ? 'text-end' : 'text-start'}`}>
                  <span className="inline-flex items-center gap-1.5">
                    <span>{isAr ? c.ar : c.en}</span>
                    <span className="no-print inline-flex items-center gap-0.5">
                      <button type="button" aria-label={T('Move column left', 'تحريك العمود لليسار')} onClick={() => move(idx, 'left')} className="rounded-full p-0.5 hover:bg-slate-200/70 dark:hover:bg-white/10">
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                      <button type="button" aria-label={T('Move column right', 'تحريك العمود لليمين')} onClick={() => move(idx, 'right')} className="rounded-full p-0.5 hover:bg-slate-200/70 dark:hover:bg-white/10">
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={rowKey(r)} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-white/5">
                {ordered.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 align-middle text-slate-700 dark:text-slate-200 ${c.align === 'end' ? 'text-end' : 'text-start'}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  )
}
