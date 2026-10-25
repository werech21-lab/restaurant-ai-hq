'use client'

import { useState } from 'react'
import { Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'

const shell = 'rounded-xl border border-[#30363d] bg-[#1c2128] p-5'

const signalSeed: Array<{ key: MessageKey; value: number; text: string; bar: string }> = [
  { key: 'signal.chicken', value: 42, text: 'text-red-400', bar: 'bg-red-500' },
  { key: 'signal.commission', value: 31, text: 'text-yellow-400', bar: 'bg-yellow-500' },
  { key: 'share.waste', value: 18, text: 'text-blue-400', bar: 'bg-blue-500' },
]

const analysisSeed: Array<{ value: number; label: MessageKey; note: MessageKey }> = [
  { value: 42, label: 'analysis.materials', note: 'note.confirmed' },
  { value: 31, label: 'share.delivery', note: 'note.confirmed' },
  { value: 18, label: 'share.waste', note: 'note.check' },
]

export default function Intelligence() {
  const { t } = useI18n()
  const [cardReady, setCardReady] = useState(false)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">{t('page.intelligence.title')}</h1>
        <p className="mt-1 text-sm text-gray-400">{t('page.intelligence.subtitle')}</p>
      </div>

      <div className={`${shell} mb-4 border-s-4 border-s-blue-500`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-100">{t('case.title')}</h3>
          <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs text-yellow-400">{t('case.priority')}</span>
        </div>
        <p className="text-sm text-gray-400">
          {t('case.before')} <Num>34.2%</Num> {t('case.mid')} <Num>28.2%</Num>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={shell}>
          <h3 className="mb-4 font-semibold text-gray-100">{t('signals.title')}</h3>
          <div className="space-y-4 text-sm">
            {signalSeed.map((signal) => (
              <div key={signal.key}>
                <div className="mb-1 flex justify-between gap-3">
                  <span className="text-gray-200">{t(signal.key)}</span>
                  <Num className={signal.text}>{signal.value}%</Num>
                </div>
                <div
                  className="h-2 rounded-full bg-[#30363d]"
                  role="progressbar"
                  aria-valuenow={signal.value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t(signal.key)}
                >
                  <div className={`h-full rounded-full ${signal.bar}`} style={{ width: `${signal.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={shell}>
          <h3 className="mb-4 font-semibold text-gray-100">{t('analysis.title')}</h3>
          <div className="rounded-lg bg-blue-500/10 p-4 text-sm leading-relaxed text-gray-200">
            {analysisSeed.map((line) => (
              <p key={line.label}>
                • <Num>{line.value}%</Num> {t(line.label)} ({t(line.note)})
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCardReady(true)}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700"
          >
            {cardReady ? t('intel.decisionDone') : t('intel.decision')}
          </button>
          {cardReady ? (
            <div className="mt-4 rounded-lg border border-[#30363d] bg-[#161b22] p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-gray-100">{t('intel.cardTitle')}</p>
                <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs text-yellow-400">{t('intel.cardStatus')}</span>
              </div>
              <p className="mt-2 leading-relaxed text-gray-400">{t('intel.cardBody')}</p>
              <p className="mt-3 text-gray-300">
                {t('intel.recover')} <Num>3.5</Num> {t('point')}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
