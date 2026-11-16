'use client'

import { useState } from 'react'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import type { FormatLocale } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type { ScanResult } from '@/modules/ai/client'
import { CopilotBar } from '@/modules/ai/ui/CopilotBar'
import { DecisionsPanel } from '@/modules/ai/ui/DecisionsPanel'
import { InsightList } from '@/modules/ai/ui/InsightList'
import { KpiGrid } from '@/modules/ai/ui/KpiGrid'
import { RulesPanel } from '@/modules/ai/ui/RulesPanel'
import { ScanButton, ScanSummary } from '@/modules/ai/ui/ScanControl'
import { StatusStrip } from '@/modules/ai/ui/StatusStrip'
import { aiPrimaryBtn, aiSecondaryBtn } from '@/modules/ai/ui/labels'
import { useDashboard } from '@/modules/ai/ui/useDashboard'

const tabs = ['decisions', 'insights', 'rules'] as const
type Tab = (typeof tabs)[number]

/** الذكاء الاصطناعي والأتمتة: the KPIs and Copilot bar, then decisions with history, alerts, and the rules. */
export default function AiWorkspace({ initialTab = 'decisions' }: { initialTab?: string }) {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const [tab, setTab] = useState<Tab>(
    tabs.includes(initialTab as Tab) ? (initialTab as Tab) : 'decisions',
  )
  const [reloadToken, setReloadToken] = useState(0)
  const [scan, setScan] = useState<ScanResult | null>(null)
  const { dashboard, phase, error, retry } = useDashboard(reloadToken)

  const refresh = () => setReloadToken((value) => value + 1)

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-6">
      <SectionCard
        title={t('ai.title')}
        subtitle={t('ai.subtitle')}
        locale={fmtLocale}
        actions={
          <ScanButton
            onScanned={(result) => {
              setScan(result)
              refresh()
            }}
          />
        }
      >
        <div
          role="tablist"
          aria-label={t('ai.title')}
          className="flex flex-wrap gap-2 border-b border-[var(--ds-border-hairline)] pb-3"
        >
          {tabs.map((value) => {
            const active = tab === value
            return (
              <button
                key={value}
                type="button"
                role="tab"
                id={`ai-tab-${value}`}
                aria-selected={active}
                aria-controls={`ai-panel-${value}`}
                onClick={() => setTab(value)}
                className={active ? aiPrimaryBtn : aiSecondaryBtn}
              >
                {t(`ai.tab.${value}`)}
              </button>
            )
          })}
        </div>
      </SectionCard>

      {scan ? <ScanSummary result={scan} /> : null}

      {phase === 'loading' && !dashboard ? (
        <StateBlock state="loading" locale={fmtLocale} title={t('ai.loading')} skeletonRows={3} />
      ) : null}

      {phase === 'error' && !dashboard ? (
        <StateBlock
          state={error === 'erp.err.forbidden' ? 'forbidden' : 'error'}
          locale={fmtLocale}
          title={t(error)}
          onRetry={error === 'erp.err.forbidden' ? undefined : retry}
          retryLabel={t('ai.retry')}
        />
      ) : null}

      {dashboard ? (
        <>
          <KpiGrid kpis={dashboard.kpis} />
          <StatusStrip kpis={dashboard.kpis} />
        </>
      ) : null}

      <CopilotBar onScanned={refresh} />

      <div role="tabpanel" id={`ai-panel-${tab}`} aria-labelledby={`ai-tab-${tab}`}>
        {tab === 'decisions' ? (
          <DecisionsPanel showFilter reloadToken={reloadToken} onChanged={refresh} />
        ) : null}
        {tab === 'insights' ? <InsightList reloadToken={reloadToken} onChanged={refresh} /> : null}
        {tab === 'rules' ? <RulesPanel /> : null}
      </div>
    </div>
  )
}
