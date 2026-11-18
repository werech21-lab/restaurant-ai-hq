import { GLOBAL_BRANCH_OPTIONS, GLOBAL_BRAND_OPTIONS } from '@/lib/aether/global-filter-engine'
import type { CouncilEstimate, CouncilEvidence } from './types'

export const toFils = (kwd: number): number => Math.round((Number(kwd) || 0) * 1000)
export const fromFils = (fils: number): number => fils / 1000
export const r3 = (n: number): number => Math.round(n * 1000) / 1000
export const r1 = (n: number): number => Math.round(n * 10) / 10
export const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

export function pctChange(current: number, prior: number): number | null {
  if (!Number.isFinite(prior) || prior === 0) return null
  return r1(((current - prior) / prior) * 100)
}

export function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 0 = Sunday … 6 = Saturday, for a Kuwait calendar day key. */
export function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay()
}

export const WEEKDAY_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const
export const WEEKDAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** Kuwait calendar day (UTC+3) of an ISO timestamp. */
export function kuwaitDayOf(isoTs: string | null | undefined): string | null {
  if (!isoTs) return null
  const t = Date.parse(isoTs)
  if (!Number.isFinite(t)) return null
  return new Date(t + 3 * 3600_000).toISOString().slice(0, 10)
}

export function branchLabel(id: string): { ar: string; en: string } {
  const o = GLOBAL_BRANCH_OPTIONS.find((b) => b.id === id)
  return o ? { ar: o.ar, en: o.en } : { ar: id, en: id }
}

export function brandLabel(id: string): { ar: string; en: string } {
  const o = GLOBAL_BRAND_OPTIONS.find((b) => b.id === id)
  return o ? { ar: o.ar, en: o.en } : { ar: id, en: id }
}

export const CHANNEL_LABELS: Record<string, { ar: string; en: string }> = {
  'dine-in': { ar: 'الصالة', en: 'Dine-in' },
  'takeaway-direct': { ar: 'السفري المباشر', en: 'Direct takeaway' },
  'talabat-tgo': { ar: 'طلبات TGO', en: 'Talabat TGO' },
  'talabat-tmp': { ar: 'طلبات TMP', en: 'Talabat TMP' },
  keeta: { ar: 'كيتا', en: 'Keeta' },
  deliveroo: { ar: 'ديليفرو', en: 'Deliveroo' },
  jahez: { ar: 'جاهز', en: 'Jahez' },
  snoonu: { ar: 'سنونو', en: 'Snoonu' },
}
export const AGGREGATOR_CHANNELS = ['talabat-tgo', 'talabat-tmp', 'keeta', 'deliveroo', 'jahez', 'snoonu'] as const
export const channelLabel = (id: string) => CHANNEL_LABELS[id] ?? { ar: id, en: id }

export function estimate(
  value: number,
  unit: CouncilEstimate['unit'],
  formula: string,
  inputs: Record<string, number>,
): CouncilEstimate {
  return { label: 'Estimate', value: unit === 'KWD' ? r3(value) : r1(value), unit, formula, inputs }
}

export function evidence(
  e: Omit<CouncilEvidence, 'value'> & { value: number },
): CouncilEvidence {
  return { ...e, value: e.unit === 'KWD' || e.unit === 'KWD/order' || e.unit === 'KWD/unit' ? r3(e.value) : e.unit === 'pct' ? r1(e.value) : e.value }
}

export function fmtKwd(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

export function fmtPct(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
