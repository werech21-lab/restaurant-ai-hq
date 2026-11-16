'use client'

import Link from 'next/link'
import { useState } from 'react'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import type { FormatLocale } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type { ScanResult } from '@/modules/ai/client'
import { CopilotBar } from '@/modules/ai/ui/CopilotBar'
import { DecisionsPanel } from '@/modules/ai/ui/DecisionsPanel'
import { InsightRow } from '@/modules/ai/ui/InsightRow'
import { KpiGrid } from '@/modules/ai/ui/KpiGrid'
import { ScanButton, ScanSummary } from '@/modules/ai/ui/ScanControl'
import { StatusStrip } from '@/modules/ai/ui/StatusStrip'
import { aiErrorClass } from '@/modules/ai/ui/labels'
import { useDashboard } from '@/modules/ai/ui/useDashboard'

/** غرفة القيادة التنفيذية: live KPIs, the Copilot bar, decisions awaiting approval and the most urgent alerts. */
export default function ExecutiveCenter() {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  // Bumped after a scan or a decision so the numbers and both lists are read again.
  const [reloadToken, setReloadToken] = useState(0)
  const [scan, setScan] = useState<ScanResult | null>(null)
  const { dashboard, phase, error, retry } = useDashboard(reloadToken)

  const refresh = () => setReloadToken((value) => value + 1)

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-6">
      <SectionCard
        title={t('hq.title')}
        subtitle={t('hq.subtitle')}
        locale={fmtLocale}
        actions={
          <ScanButton
            onScanned={(result) => {
              setScan(result)
              refresh()
            }}
          />
        }
      />

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
          {phase === 'error' ? (
            <p role="alert" className={aiErrorClass}>
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
            <h2 className="text-lg font-semibold text-[var(--ds-text-primary)]">
              {t('ai.ins.title')}
            </h2>
            <Link
              href="/erp/ai"
              className="ds-focus-ring text-sm font-semibold text-[var(--ds-accent)] hover:underline"
            >
              {t('erpnav.ai')}
            </Link>
          </div>
          {dashboard && dashboard.insights.length === 0 ? (
            <StateBlock state="empty" locale={fmtLocale} title={t('ai.ins.empty')} />
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
