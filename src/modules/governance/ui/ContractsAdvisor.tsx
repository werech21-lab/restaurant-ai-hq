'use client'

import { useEffect, useState } from 'react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { errorClass, noticeClass, panelClass, primaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import type { ContractAnalysis } from '@/modules/governance/client'
import type { Contract } from '@/modules/operations/client'

function Workspace() {
  const { t } = useI18n()
  const canAnalyze = useCan(permissions.govContractAnalyze)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [analyses, setAnalyses] = useState<ContractAnalysis[]>([])
  const [selected, setSelected] = useState<string>('')

  function load() {
    const controller = new AbortController()
    setPhase('loading')
    Promise.all([
      apiRequest<{ data: Contract[] }>('/api/v1/operations/contracts', { signal: controller.signal }),
      apiRequest<{ data: ContractAnalysis[] }>('/api/v1/governance/analyses', { signal: controller.signal }),
    ])
      .then(([contractPage, analysisPage]) => {
        setContracts(contractPage.data)
        setAnalyses(analysisPage.data)
        setSelected((current) => current || contractPage.data[0]?.id || '')
        setPhase('ready')
        setError(null)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }

  useEffect(() => load(), [])

  const analysis = analyses.find((item) => item.contractId === selected) ?? null
  const contract = contracts.find((item) => item.id === selected) ?? null

  async function analyze() {
    if (!selected) return
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest('/api/v1/governance/analyses', { method: 'POST', idempotencyKey: newIdempotencyKey(), body: { contractId: selected } })
      setNotice(t('gov.saved'))
      load()
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-gray-50">{t('hub.advisor')}</h1>
        <p className="mt-1 text-sm text-gray-400">{t('gov.summary')}</p>
      </header>
      {phase === 'loading' ? <p className="text-sm text-gray-400">{t('gov.loading')}</p> : null}
      {phase === 'error' && error ? <p className={errorClass}>{t(error)}</p> : null}
      {phase === 'ready' && error ? <p className={errorClass}>{t(error)}</p> : null}
      {notice ? <p className={noticeClass}>{notice}</p> : null}
      {phase === 'ready' ? (
        <section className={panelClass}>
          {contracts.length === 0 ? <p className="text-sm text-gray-400">{t('gov.empty')}</p> : (
            <label className="mb-4 block text-sm text-gray-300">
              {t('hub.branch.contracts')}
              <select className="mt-1 w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2" value={selected} onChange={(event) => setSelected(event.target.value)}>
                {contracts.map((item) => <option key={item.id} value={item.id}>{item.title} — {item.counterparty} — {formatMinor(item.valueMinor)} {t('currency')}</option>)}
              </select>
            </label>
          )}
          {canAnalyze && contract ? <button className={primaryButton} type="button" disabled={busy} onClick={() => void analyze()}>{t('gov.analyze')}</button> : null}
          {analysis ? (
            <div className="mt-4 space-y-3 text-sm text-gray-100">
              <p>{t('gov.score')}: {analysis.riskScore}</p>
              <p>{t('gov.summary')}: {analysis.clausesSummaryAr}</p>
              <div>
                <p className="text-gray-400">{t('gov.risks')}</p>
                {analysis.risks.map((risk) => <p key={risk.code}>{risk.detailAr}</p>)}
              </div>
              <div>
                <p className="text-gray-400">{t('gov.obligations')}</p>
                {analysis.obligations.map((item) => <p key={item.textAr}>{item.textAr}</p>)}
              </div>
              <p>{t('gov.penalties')}: {analysis.penaltyClausesAr}</p>
              <p>{t('gov.advice')}: {analysis.negotiationRecommendationsAr}</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

export default function ContractsAdvisor({ permissions: held }: { permissions: readonly string[] }) {
  return <PermissionProvider permissions={held}><Workspace /></PermissionProvider>
}
