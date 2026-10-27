'use client'

import { Money, Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { DashboardKpis } from '@/modules/ai/client'
import { minorText } from '@/modules/ai/ui/labels'

const cardClass = 'rounded-xl border border-[#30363d] bg-[#1c2128] p-5'

function Unavailable() {
  const { t } = useI18n()
  return <p className="mt-3 text-sm text-gray-500">{t('ai.kpi.unavailable')}</p>
}

function Tile({ label, children }: { label: MessageKey; children: React.ReactNode }) {
  const { t } = useI18n()
  return (
    <div className={cardClass}>
      <div className="text-sm text-gray-400">{t(label)}</div>
      {children}
    </div>
  )
}

/** The five live numbers of the command center. A block the caller may not read says so instead of showing zero. */
export function KpiGrid({ kpis }: { kpis: DashboardKpis }) {
  const { t } = useI18n()
  const { revenue, receivables, inventory, pipeline } = kpis

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label={t('hq.title')}>
      <Tile label="ai.kpi.revenue">
        {revenue ? (
          <>
            <div className="mt-2 text-2xl font-bold text-mist-100">
              <Money value={minorText(revenue.monthMinor)} />
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {t('ai.kpi.revenuePrevious')}: <Money value={minorText(revenue.previousMonthMinor)} />
            </div>
          </>
        ) : (
          <Unavailable />
        )}
      </Tile>

      <Tile label="ai.kpi.receivables">
        {receivables ? (
          <>
            <div className="mt-2 text-2xl font-bold text-mist-100">
              <Money value={minorText(receivables.outstandingMinor)} />
            </div>
            <div className="mt-1 text-xs text-gray-500">
              <Num>{receivables.outstandingMinor.toLocaleString('en-US')}</Num> {t('ai.kpi.fils')}
            </div>
            <div className={`mt-1 text-xs ${receivables.overdueMinor > 0 ? 'text-rose-300' : 'text-gray-500'}`}>
              {t('ai.kpi.overdue')}: <Money value={minorText(receivables.overdueMinor)} /> (<Num>{receivables.overdueCount}</Num>)
            </div>
          </>
        ) : (
          <Unavailable />
        )}
      </Tile>

      <Tile label="ai.kpi.inventory">
        {inventory ? (
          <>
            <div className="mt-2 text-2xl font-bold text-mist-100">
              <Money value={minorText(inventory.valuationMinor)} />
            </div>
            <div className="mt-1 text-xs text-gray-500">
              <Num>{inventory.outOfStockCount.toLocaleString('en-US')}</Num> {t('ai.kpi.outOfStock')}
            </div>
          </>
        ) : (
          <Unavailable />
        )}
      </Tile>

      <Tile label="ai.kpi.lowStock">
        {inventory ? (
          <>
            <div className={`mt-2 text-2xl font-bold ${inventory.lowStockCount > 0 ? 'text-yellow-300' : 'text-mist-100'}`}>
              <Num>{inventory.lowStockCount.toLocaleString('en-US')}</Num>
            </div>
            <div className="mt-1 text-xs text-gray-500">{t('ai.kpi.lowStockHint')}</div>
          </>
        ) : (
          <Unavailable />
        )}
      </Tile>

      <Tile label="ai.kpi.pipeline">
        {pipeline ? (
          <>
            <div className="mt-2 text-2xl font-bold text-mist-100">
              <Money value={minorText(pipeline.activeValueMinor)} />
            </div>
            <div className="mt-1 text-xs text-gray-500">
              <Num>{pipeline.activeCount.toLocaleString('en-US')}</Num> {t('ai.kpi.pipelineCount')}
            </div>
          </>
        ) : (
          <Unavailable />
        )}
      </Tile>
    </div>
  )
}
