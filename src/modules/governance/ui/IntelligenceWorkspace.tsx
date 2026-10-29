'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { errorClass, inputClass, labelClass, noticeClass, panelClass, primaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor, parseKwdToMinor } from '@/lib/money'
import type { BlockedAttempt, RadarRow, TelemetryRow } from '@/modules/governance/client'

type Tab = 'radar' | 'telemetry'
const tabs: readonly Tab[] = ['radar', 'telemetry']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function Workspace({ initialTab }: { initialTab: string }) {
  const { t } = useI18n()
  const canRadar = useCan(permissions.govRadarManage)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'radar')
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [radar, setRadar] = useState<RadarRow[]>([])
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([])
  const [blocks, setBlocks] = useState<BlockedAttempt[]>([])
  const [competitor, setCompetitor] = useState('')
  const [item, setItem] = useState('')
  const [ours, setOurs] = useState('')
  const [theirs, setTheirs] = useState('')

  function load() {
    const controller = new AbortController()
    setPhase('loading')
    Promise.all([
      apiRequest<{ data: RadarRow[] }>('/api/v1/governance/radar', { signal: controller.signal }),
      apiRequest<{ data: TelemetryRow[] }>('/api/v1/governance/telemetry', { signal: controller.signal }),
      apiRequest<{ data: BlockedAttempt[] }>('/api/v1/governance/blocks', { signal: controller.signal }),
    ])
      .then(([radarPage, telemetryPage, blockPage]) => {
        setRadar(radarPage.data)
        setTelemetry(telemetryPage.data)
        setBlocks(blockPage.data)
        setError(null)
        setPhase('ready')
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }

  useEffect(() => load(), [])

  async function addRadar(event: FormEvent) {
    event.preventDefault()
    const ourPriceMinor = parseKwdToMinor(ours)
    const competitorPriceMinor = parseKwdToMinor(theirs)
    if (ourPriceMinor === null || competitorPriceMinor === null) return
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest('/api/v1/governance/radar', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { competitorName: competitor, marketSegment: 'السوق المحلي', itemOrService: item, ourPriceMinor, competitorPriceMinor, promoDetectedAr: '' },
      })
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
        <h1 className="text-2xl font-semibold text-gray-50">{t('hub.intelligence')}</h1>
      </header>
      <div className="flex flex-wrap gap-2">
        {tabs.map((itemTab) => (
          <button key={itemTab} type="button" className={itemTab === tab ? primaryButton : 'rounded-md px-3 py-2 text-sm text-gray-300'} onClick={() => setTab(itemTab)}>{t(`gov.tab.${itemTab}` as MessageKey)}</button>
        ))}
      </div>
      {phase === 'loading' ? <p className="text-sm text-gray-400">{t('gov.loading')}</p> : null}
      {error ? <p className={errorClass}>{t(error)}</p> : null}
      {notice ? <p className={noticeClass}>{notice}</p> : null}
      {phase === 'ready' && tab === 'radar' ? (
        <section className={panelClass}>
          {canRadar ? (
            <form className="mb-4 flex flex-wrap gap-3" onSubmit={(event) => void addRadar(event)}>
              <label className={labelClass}>{t('gov.their')}<input className={inputClass} required value={competitor} onChange={(event) => setCompetitor(event.target.value)} /></label>
              <label className={labelClass}>{t('gov.item')}<input className={inputClass} required value={item} onChange={(event) => setItem(event.target.value)} /></label>
              <label className={labelClass}>{t('gov.our')}<input className={inputClass} required value={ours} onChange={(event) => setOurs(event.target.value)} /></label>
              <label className={labelClass}>{t('gov.theirPrice')}<input className={inputClass} required value={theirs} onChange={(event) => setTheirs(event.target.value)} /></label>
              <div className="flex items-end"><button className={primaryButton} type="submit" disabled={busy}>{t('gov.saved')}</button></div>
            </form>
          ) : null}
          {radar.length === 0 ? <p className="text-sm text-gray-400">{t('gov.empty')}</p> : radar.map((row) => (
            <article key={row.id} className="border-t border-[#30363d] py-3 text-sm text-gray-100">
              <p>{row.competitorName} — {row.itemOrService}</p>
              <p>{t('gov.our')} {formatMinor(row.ourPriceMinor)} / {t('gov.theirPrice')} {formatMinor(row.competitorPriceMinor)} {t('currency')}</p>
              <p>{t('gov.promo')}: {row.promoDetectedAr}</p>
              <p>{t('gov.insight')}: {row.aiExecutiveInsightAr}</p>
              <p>{t('gov.counter')}: {row.recommendedCounterActionAr}</p>
            </article>
          ))}
        </section>
      ) : null}
      {phase === 'ready' && tab === 'telemetry' ? (
        <section className={panelClass}>
          {telemetry.length === 0 ? <p className="text-sm text-gray-400">{t('gov.empty')}</p> : telemetry.map((row) => (
            <p key={row.id} className="border-t border-[#30363d] py-2 text-sm text-gray-100">
              {row.userName} — {row.role} — {row.activePath} — {t('gov.dwell')} {row.dwellTimeSeconds} — {t('gov.risk')} {row.riskLevel}
            </p>
          ))}
          <div className="mt-4">
            {blocks.map((block) => <p key={block.id} className="text-sm text-gray-300">{block.blockMessageAr}</p>)}
          </div>
        </section>
      ) : null}
    </div>
  )
}

export default function IntelligenceWorkspace({ permissions: held, initialTab }: { permissions: readonly string[]; initialTab: string }) {
  return <PermissionProvider permissions={held}><Workspace initialTab={initialTab} /></PermissionProvider>
}
