'use client'

import { formatInt, type FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { DashboardKpis } from '@/modules/ai/client'

type Props = {
  kpis: DashboardKpis
}

/** One line under the KPI grid: how many decisions wait and how many alerts are active, by severity. */
export function StatusStrip({ kpis }: Props) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const { pendingApprovals, openInsights } = kpis
  if (pendingApprovals === null && openInsights === null) return null

  const parts: Array<{ label: MessageKey; value: number; tone: string }> = []
  if (pendingApprovals !== null) {
    parts.push({
      label: 'ai.kpi.pending',
      value: pendingApprovals,
      tone: pendingApprovals > 0 ? 'text-[var(--ds-warning)]' : 'text-[var(--ds-text-secondary)]',
    })
  }
  if (openInsights !== null) {
    parts.push({
      label: 'ai.kpi.insights',
      value: openInsights.total,
      tone: 'text-[var(--ds-text-primary)]',
    })
    parts.push({
      label: 'ai.kpi.critical',
      value: openInsights.critical,
      tone:
        openInsights.critical > 0
          ? 'text-[var(--ds-negative)]'
          : 'text-[var(--ds-text-secondary)]',
    })
    parts.push({
      label: 'ai.kpi.warning',
      value: openInsights.warning,
      tone:
        openInsights.warning > 0
          ? 'text-[var(--ds-warning)]'
          : 'text-[var(--ds-text-secondary)]',
    })
    parts.push({
      label: 'ai.kpi.opportunity',
      value: openInsights.opportunity,
      tone:
        openInsights.opportunity > 0
          ? 'text-[var(--ds-positive)]'
          : 'text-[var(--ds-text-secondary)]',
    })
  }

  return (
    <ul className="ds-surface flex flex-wrap gap-x-6 gap-y-2 rounded-2xl px-4 py-3 text-sm text-[var(--ds-text-muted)]">
      {parts.map((part) => (
        <li key={part.label}>
          {t(part.label)}:{' '}
          <span dir="ltr" className={`ds-num font-semibold tabular-nums ${part.tone}`}>
            {formatInt(part.value, fmtLocale)}
          </span>
        </li>
      ))}
    </ul>
  )
}
