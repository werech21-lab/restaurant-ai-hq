'use client'

import Link from 'next/link'
import { formatInt, formatPct, type FormatLocale } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { type Insight } from '@/modules/ai/client'
import {
  AiMoney,
  AiUnavailableDash,
  CategoryBadge,
  SeverityBadge,
  aiCardClass,
  aiSecondaryBtn,
  formatAiDateTime,
  insightStatusLabels,
  recordHref,
  severityDot,
} from '@/modules/ai/ui/labels'

function Metric({ insight, locale }: { insight: Insight; locale: FormatLocale }) {
  const { t } = useI18n()
  switch (insight.metricUnit) {
    case 'fils':
      return <AiMoney minor={insight.metricValue} />
    case 'days':
      return (
        <span>
          <span dir="ltr" className="ds-num tabular-nums">
            {formatInt(insight.metricValue, locale)}
          </span>{' '}
          {t('ai.ins.days')}
        </span>
      )
    case 'bps':
      return (
        <span dir="ltr" className="ds-num tabular-nums">
          {formatPct(insight.metricValue / 100, { locale, decimals: 2 })}
        </span>
      )
    case 'count':
      return (
        <span dir="ltr" className="ds-num tabular-nums">
          {formatInt(insight.metricValue, locale)}
        </span>
      )
  }
}

type Props = {
  insight: Insight
  /** Null hides the buttons, for read-only lists such as command results. */
  actions: { busy: boolean; onAcknowledge: () => void; onResolve: () => void } | null
}

/** One alert: severity, title and text, the measured number, a link to the record, and the two ways to close it. */
export function InsightRow({ insight, actions }: Props) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const href =
    insight.sourceEntityType && insight.sourceEntityId
      ? recordHref(insight.sourceEntityType, insight.sourceEntityId)
      : null

  return (
    <li className={aiCardClass} data-insight-id={insight.id} data-severity={insight.severity}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${severityDot[insight.severity]}`} aria-hidden />
            <SeverityBadge severity={insight.severity} />
            <CategoryBadge category={insight.category} />
            {insight.status !== 'open' ? (
              <span className="text-xs font-medium text-[var(--ds-text-muted)]">
                {t(insightStatusLabels[insight.status])}
              </span>
            ) : null}
          </div>
          <h3 className="font-semibold text-[var(--ds-text-primary)]">{insight.titleAr}</h3>
          <p className="mt-1 text-sm leading-7 text-[var(--ds-text-secondary)]">
            {insight.descriptionAr}
          </p>
          <p className="mt-2 text-xs text-[var(--ds-text-muted)]">
            {t('ai.ins.detected')}:{' '}
            {insight.detectedAt ? (
              <span dir="ltr" className="ds-num tabular-nums">
                {formatAiDateTime(insight.detectedAt, fmtLocale)}
              </span>
            ) : (
              <AiUnavailableDash locale={fmtLocale} />
            )}
          </p>
        </div>
        <div className="text-end text-sm font-semibold text-[var(--ds-text-primary)]">
          <Metric insight={insight} locale={fmtLocale} />
        </div>
      </div>

      {href || (actions && insight.status !== 'resolved') ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {href ? (
            <Link href={href} className={`${aiSecondaryBtn} min-h-8 px-3 py-1.5 text-xs`}>
              {t('ai.ins.openRecord')}
            </Link>
          ) : null}
          {actions && insight.status === 'open' ? (
            <button
              type="button"
              disabled={actions.busy}
              onClick={actions.onAcknowledge}
              className={`${aiSecondaryBtn} min-h-8 px-3 py-1.5 text-xs`}
            >
              {t('ai.ins.ack')}
            </button>
          ) : null}
          {actions && insight.status !== 'resolved' ? (
            <button
              type="button"
              disabled={actions.busy}
              onClick={actions.onResolve}
              className={`${aiSecondaryBtn} min-h-8 px-3 py-1.5 text-xs`}
            >
              {t('ai.ins.resolve')}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
