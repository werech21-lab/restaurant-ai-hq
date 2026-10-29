'use client'

import { useState } from 'react'
import { errorClass, secondaryButton } from '@/components/erp/styles'
import { useI18n } from '@/lib/i18n'
import type { ScanResult } from '@/modules/ai/client'
import { CopilotBar } from '@/modules/ai/ui/CopilotBar'
import { DecisionsPanel } from '@/modules/ai/ui/DecisionsPanel'
import { InsightList } from '@/modules/ai/ui/InsightList'
import { KpiGrid } from '@/modules/ai/ui/KpiGrid'
import { RulesPanel } from '@/modules/ai/ui/RulesPanel'
import { ScanButton, ScanSummary } from '@/modules/ai/ui/ScanControl'
import { StatusStrip } from '@/modules/ai/ui/StatusStrip'
import { useDashboard } from '@/modules/ai/ui/useDashboard'

const tabs = ['decisions', 'insights', 'rules'] as const
type Tab = (typeof tabs)[number]

/** الذكاء الاصطناعي والأتمتة: the KPIs and Copilot bar, then decisions with history, alerts, and the rules. */
export default function AiWorkspace({ initialTab = 'decisions' }: { initialTab?: string }) {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>(tabs.includes(initialTab as Tab) ? (initialTab as Tab) : 'decisions')
  const [reloadToken, setReloadToken] = useState(0)
  const [scan, setScan] = useState<ScanResult | null>(null)
  const { dashboard, phase, error, retry } = useDashboard(reloadToken)

  const refresh = () => setReloadToken((value) => value + 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mist-100">{t('ai.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">{t('ai.subtitle')}</p>
        </div>
        <ScanButton
          onScanned={(result) => {
            setScan(result)
            refresh()
          }}
        />
      </div>

      {scan ? <ScanSummary result={scan} /> : null}

      {phase === 'loading' && !dashboard ? <p className="py-6 text-center text-sm text-gray-400">{t('ai.loading')}</p> : null}

      {phase === 'error' && !dashboard ? (
        <div className="space-y-3 rounded-xl border border-[#30363d] bg-[#1c2128] py-8 text-center">
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
          <KpiGrid kpis={dashboard.kpis} />
          <StatusStrip kpis={dashboard.kpis} />
        </>
      ) : null}

      <CopilotBar onScanned={refresh} />

      <div role="tablist" aria-label={t('ai.title')} className="flex flex-wrap gap-1 border-b border-[#30363d]">
        {tabs.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`ai-tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`ai-panel-${value}`}
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition ${
              tab === value ? 'border-blue-500 font-semibold text-blue-300' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t(`ai.tab.${value}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`ai-panel-${tab}`} aria-labelledby={`ai-tab-${tab}`}>
        {tab === 'decisions' ? <DecisionsPanel showFilter reloadToken={reloadToken} onChanged={refresh} /> : null}
        {tab === 'insights' ? <InsightList reloadToken={reloadToken} onChanged={refresh} /> : null}
        {tab === 'rules' ? <RulesPanel /> : null}
      </div>
    </div>
  )
}
