'use client'

import Link from 'next/link'
import { Money, Num } from '@/components/ui'
import { dateTimeText } from '@/components/erp/common'
import { useI18n } from '@/lib/i18n'
import { formatBps, type Insight } from '@/modules/ai/client'
import { CategoryBadge, SeverityBadge, insightStatusLabels, minorText, recordHref, severityDot } from '@/modules/ai/ui/labels'

function Metric({ insight }: { insight: Insight }) {
  const { t } = useI18n()
  switch (insight.metricUnit) {
    case 'fils':
      return <Money value={minorText(insight.metricValue)} />
    case 'days':
      return (
        <span>
          <Num>{insight.metricValue.toLocaleString('en-US')}</Num> {t('ai.ins.days')}
        </span>
      )
    case 'bps':
      return <Num>{formatBps(insight.metricValue)}%</Num>
    case 'count':
      return <Num>{insight.metricValue.toLocaleString('en-US')}</Num>
  }
}

type Props = {
  insight: Insight
  /** Null hides the buttons, for read-only lists such as command results. */
  actions: { busy: boolean; onAcknowledge: () => void; onResolve: () => void } | null
}

/** One alert: severity, Arabic title and text, the measured number, a link to the record, and the two ways to close it. */
export function InsightRow({ insight, actions }: Props) {
  const { t } = useI18n()
  const href = insight.sourceEntityType && insight.sourceEntityId ? recordHref(insight.sourceEntityType, insight.sourceEntityId) : null

  return (
    <li className="rounded-xl border border-[#30363d] bg-[#1c2128] p-4" data-insight-id={insight.id} data-severity={insight.severity}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${severityDot[insight.severity]}`} aria-hidden />
            <SeverityBadge severity={insight.severity} />
            <CategoryBadge category={insight.category} />
            {insight.status !== 'open' ? <span className="text-xs text-gray-400">{t(insightStatusLabels[insight.status])}</span> : null}
          </div>
          <h3 className="font-semibold text-gray-100">{insight.titleAr}</h3>
          <p className="mt-1 text-sm leading-7 text-gray-400">{insight.descriptionAr}</p>
          <p className="mt-2 text-xs text-gray-500">
            {t('ai.ins.detected')}: {dateTimeText(insight.detectedAt)}
          </p>
        </div>
        <div className="text-end text-sm font-semibold text-gray-100">
          <Metric insight={insight} />
        </div>
      </div>

      {href || (actions && insight.status !== 'resolved') ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {href ? (
            <Link href={href} className="rounded-lg border border-[#30363d] px-3 py-1.5 text-xs text-blue-300 hover:bg-white/5">
              {t('ai.ins.openRecord')}
            </Link>
          ) : null}
          {actions && insight.status === 'open' ? (
            <button
              type="button"
              disabled={actions.busy}
              onClick={actions.onAcknowledge}
              className="rounded-lg border border-[#30363d] px-3 py-1.5 text-xs text-gray-200 hover:bg-white/5 disabled:opacity-50"
            >
              {t('ai.ins.ack')}
            </button>
          ) : null}
          {actions && insight.status !== 'resolved' ? (
            <button
              type="button"
              disabled={actions.busy}
              onClick={actions.onResolve}
              className="rounded-lg border border-[#30363d] px-3 py-1.5 text-xs text-gray-200 hover:bg-white/5 disabled:opacity-50"
            >
              {t('ai.ins.resolve')}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
