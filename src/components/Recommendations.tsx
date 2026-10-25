'use client'

import { useEffect, useState } from 'react'
import { Money, Num } from '@/components/ui'
import { useI18n } from '@/lib/i18n'

type ScenarioId = 'optimistic' | 'base' | 'conservative'

const scenarioSeed: Array<{ id: ScenarioId; saving: string }> = [
  { id: 'optimistic', saving: '42,000' },
  { id: 'base', saving: '36,000' },
  { id: 'conservative', saving: '24,000' },
]

const scenarioLook: Record<ScenarioId, { box: string; label: string; active: string }> = {
  optimistic: {
    box: 'border-green-500/30 bg-green-500/10',
    label: 'text-green-400',
    active: 'border-green-400 ring-1 ring-green-400/50',
  },
  base: {
    box: 'border-blue-500/30 bg-blue-500/10',
    label: 'text-blue-400',
    active: 'border-blue-400 ring-1 ring-blue-400/50',
  },
  conservative: {
    box: 'border-yellow-500/30 bg-yellow-500/10',
    label: 'text-yellow-400',
    active: 'border-yellow-400 ring-1 ring-yellow-400/50',
  },
}

function Toast({ message, detail, onDone }: { message: string; detail?: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2800)
    return () => window.clearTimeout(timer)
  }, [onDone])

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-[#30363d] bg-[#161b22] px-4 py-3 text-sm shadow-lift"
    >
      <p className="font-semibold text-gray-100">{message}</p>
      {detail ? <p className="mt-1 text-gray-400">{detail}</p> : null}
    </div>
  )
}

export default function Recommendations() {
  const { t } = useI18n()
  const [scenarioId, setScenarioId] = useState<ScenarioId>('base')
  const [approved, setApproved] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string; detail?: string } | null>(null)

  const scenarios = scenarioSeed.map((row) => ({
    ...row,
    label: t(`rec.${row.id}`),
  }))
  const selected = scenarios.find((row) => row.id === scenarioId) ?? scenarios[1]

  function notify(message: string, detail?: string) {
    setToast({ id: Date.now(), message, detail })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">{t('page.recommendations.title')}</h1>
        <p className="mt-1 text-sm text-gray-400">{t('page.recommendations.subtitle')}</p>
      </div>

      <div className="rounded-xl border border-[#30363d] border-s-4 border-s-blue-500 bg-[#1c2128] p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-100">{t('rec.project')}</h3>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-white/5 p-3 text-center">
            <div className="text-xs text-gray-400">{t('rec.saving')}</div>
            <div className="text-xl font-bold text-green-400">
              <Money value={selected.saving} />
            </div>
          </div>
          <div className="rounded-lg bg-white/5 p-3 text-center">
            <div className="text-xs text-gray-400">{t('rec.invest')}</div>
            <div className="text-xl font-bold text-gray-100">
              <Money value="5,000" />
            </div>
          </div>
          <div className="rounded-lg bg-white/5 p-3 text-center">
            <div className="text-xs text-gray-400">{t('rec.duration')}</div>
            <div className="text-xl font-bold text-gray-100">
              <Num>45</Num> {t('day')}
            </div>
          </div>
          <div className="rounded-lg bg-white/5 p-3 text-center">
            <div className="text-xs text-gray-400">{t('rec.risk')}</div>
            <div className="text-xl font-bold text-yellow-400">{t('rec.low')}</div>
          </div>
        </div>

        <div className="mb-4">
          <h4 className="mb-2 text-sm font-semibold text-gray-100">{t('rec.scenarios')}</h4>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {scenarios.map((row) => {
              const look = scenarioLook[row.id]
              const active = row.id === scenarioId
              return (
                <button
                  key={row.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setScenarioId(row.id)}
                  className={`rounded-lg border p-3 text-center transition ${look.box} ${active ? look.active : ''}`}
                >
                  <div className={look.label}>{row.label}</div>
                  <Money value={row.saving} className="mt-1 justify-center text-gray-100" />
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setApproved(true)
              notify(t('rec.toastApproved'), selected.label)
            }}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm text-white transition hover:bg-blue-700"
          >
            {approved ? t('rec.approved') : t('rec.approve')}
          </button>
          <button
            type="button"
            onClick={() => {
              setDetailsOpen(true)
              notify(t('rec.toastDetails'))
            }}
            className="rounded-lg border border-[#30363d] px-5 py-2 text-sm text-gray-100 transition hover:bg-white/5"
          >
            {t('rec.details')}
          </button>
        </div>

        {detailsOpen ? (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#30363d] pt-4 md:grid-cols-3">
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs font-semibold text-blue-400">{t('rec.assumption')}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">{t('rec.assumptionBody')}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs font-semibold text-blue-400">{t('rec.scope')}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">{t('rec.scopeBody')}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs font-semibold text-blue-400">{t('rec.duration')}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                {t('rec.pilotBefore')} <Num>14</Num> {t('day')} {t('rec.pilotAfter')}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {toast ? <Toast key={toast.id} message={toast.message} detail={toast.detail} onDone={() => setToast(null)} /> : null}
    </div>
  )
}
