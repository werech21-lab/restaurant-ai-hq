'use client'

import { KpiCard } from '@/components/ui/kpi-card'
import { formatInt, type FormatLocale } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type { DashboardKpis } from '@/modules/ai/client'
import { AiMoney } from '@/modules/ai/ui/labels'

/** The five live numbers of the command center. A block the caller may not read renders unavailable (`—`). */
export function KpiGrid({ kpis }: { kpis: DashboardKpis }) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const { revenue, receivables, inventory, pipeline } = kpis

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
      aria-label={t('hq.title')}
    >
      <KpiCard
        label={t('ai.kpi.revenue')}
        value={revenue ? revenue.monthMinor / 1000 : null}
        format="kwd"
        locale={fmtLocale}
        subtitle={
          revenue ? (
            <span>
              {t('ai.kpi.revenuePrevious')}: <AiMoney minor={revenue.previousMonthMinor} />
            </span>
          ) : (
            t('ai.kpi.unavailable')
          )
        }
      />

      <KpiCard
        label={t('ai.kpi.receivables')}
        value={receivables ? receivables.outstandingMinor / 1000 : null}
        format="kwd"
        locale={fmtLocale}
        subtitle={
          receivables ? (
            <div className="space-y-0.5">
              <div>
                <span dir="ltr" className="ds-num tabular-nums">
                  {formatInt(receivables.outstandingMinor, fmtLocale)}
                </span>{' '}
                {t('ai.kpi.fils')}
              </div>
              <div
                className={
                  receivables.overdueMinor > 0
                    ? 'font-medium text-[var(--ds-negative)]'
                    : 'text-[var(--ds-text-muted)]'
                }
              >
                {t('ai.kpi.overdue')}: <AiMoney minor={receivables.overdueMinor} /> (
                <span dir="ltr" className="ds-num tabular-nums">
                  {formatInt(receivables.overdueCount, fmtLocale)}
                </span>
                )
              </div>
            </div>
          ) : (
            t('ai.kpi.unavailable')
          )
        }
      />

      <KpiCard
        label={t('ai.kpi.inventory')}
        value={inventory ? inventory.valuationMinor / 1000 : null}
        format="kwd"
        locale={fmtLocale}
        subtitle={
          inventory ? (
            <span>
              <span dir="ltr" className="ds-num tabular-nums">
                {formatInt(inventory.outOfStockCount, fmtLocale)}
              </span>{' '}
              {t('ai.kpi.outOfStock')}
            </span>
          ) : (
            t('ai.kpi.unavailable')
          )
        }
      />

      <KpiCard
        label={t('ai.kpi.lowStock')}
        value={inventory ? inventory.lowStockCount : null}
        format="int"
        locale={fmtLocale}
        subtitle={inventory ? t('ai.kpi.lowStockHint') : t('ai.kpi.unavailable')}
      />

      <KpiCard
        label={t('ai.kpi.pipeline')}
        value={pipeline ? pipeline.activeValueMinor / 1000 : null}
        format="kwd"
        locale={fmtLocale}
        subtitle={
          pipeline ? (
            <span>
              <span dir="ltr" className="ds-num tabular-nums">
                {formatInt(pipeline.activeCount, fmtLocale)}
              </span>{' '}
              {t('ai.kpi.pipelineCount')}
            </span>
          ) : (
            t('ai.kpi.unavailable')
          )
        }
      />
    </div>
  )
}
