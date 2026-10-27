'use client'

import Link from 'next/link'
import { useState } from 'react'
import { errorClass, secondaryButton } from '@/components/erp/styles'
import { useI18n } from '@/lib/i18n'
import type { ScanResult } from '@/modules/ai/client'
import { CopilotBar } from '@/modules/ai/ui/CopilotBar'
import { DecisionsPanel } from '@/modules/ai/ui/DecisionsPanel'
import { InsightRow } from '@/modules/ai/ui/InsightRow'
import { KpiGrid } from '@/modules/ai/ui/KpiGrid'
import { ScanButton, ScanSummary } from '@/modules/ai/ui/ScanControl'
import { StatusStrip } from '@/modules/ai/ui/StatusStrip'
import { useDashboard } from '@/modules/ai/ui/useDashboard'

/** غرفة القيادة التنفيذية: live KPIs, the Copilot bar, decisions awaiting approval and the most urgent alerts. */
export default function ExecutiveCenter() {
  const { t } = useI18n()
  // Bumped after a scan or a decision so the numbers and both lists are read again.
  const [reloadToken, setReloadToken] = useState(0)
  const [scan, setScan] = useState<ScanResult | null>(null)
  const { dashboard, phase, error, retry } = useDashboard(reloadToken)

  const refresh = () => setReloadToken((value) => value + 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mist-100">{t('hq.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">{t('hq.subtitle')}</p>
        </div>
        <ScanButton
          onScanned={(result) => {
            setScan(result)
            refresh()
          }}
        />
      </div>

      {scan ? <ScanSummary result={scan} /> : null}

      {phase === 'loading' && !dashboard ? <p className="py-10 text-center text-sm text-gray-400">{t('ai.loading')}</p> : null}

      {phase === 'error' && !dashboard ? (
        <div className="space-y-3 rounded-xl border border-[#30363d] bg-[#1c2128] py-10 text-center">
          <p role="alert" className={`${errorClass} inline-block`}>
            {t(error)}
          </p>
          <div>
            <button type="button" onClick={retry} className={secondaryButton}>
              {t('ai.retry')}
            </button>
          </div>
        </div>
      ) : null}

      {dashboard ? (
        <>
          {phase === 'error' ? (
            <p role="alert" className={errorClass}>
              {t(error)}
            </p>
          ) : null}
          <KpiGrid kpis={dashboard.kpis} />
          <StatusStrip kpis={dashboard.kpis} />
        </>
      ) : null}

      <CopilotBar onScanned={refresh} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <DecisionsPanel reloadToken={reloadToken} onChanged={refresh} />
        </div>
        <section aria-label={t('ai.ins.title')} className="space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-100">{t('ai.ins.title')}</h2>
            <Link href="/erp/ai" className="text-sm text-blue-400 hover:text-blue-300">
              {t('erpnav.ai')}
            </Link>
          </div>
          {dashboard && dashboard.insights.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#30363d] px-4 py-10 text-center text-sm text-gray-400">{t('ai.ins.empty')}</p>
          ) : null}
          {dashboard && dashboard.insights.length > 0 ? (
            <ul className="space-y-3">
              {dashboard.insights.map((insight) => (
                <InsightRow key={insight.id} insight={insight} actions={null} />
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  )
}
