'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { apiRequest, errorKey } from '@/components/erp/api'
import { errorClass, inputClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Badge } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { CommandOutcome, CommandResultKind } from '@/modules/ai/client'
import { InsightRow } from '@/modules/ai/ui/InsightRow'
import { ScanSummary } from '@/modules/ai/ui/ScanControl'

const kindLabels: Record<CommandResultKind, MessageKey> = {
  invoice: 'ai.kind.invoice',
  item: 'ai.kind.item',
  customer: 'ai.kind.customer',
}

const chips: ReadonlyArray<MessageKey> = ['ai.cp.chipScan', 'ai.cp.chipCritical', 'ai.cp.chipInventory', 'ai.cp.chipFinance', 'ai.cp.chipCrm']

type Props = {
  /** Called when the bar ran a scan, so the screen reads its numbers again. */
  onScanned: () => void
}

/**
 * The Copilot bar. It sends the text to the server, which reads fixed Arabic and English keywords: run the full scan,
 * filter alerts, or search invoices, items and customers and give a direct link to each match.
 */
export function CopilotBar({ onScanned }: Props) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const [outcome, setOutcome] = useState<CommandOutcome | null>(null)

  async function run(value: string) {
    const trimmed = value.trim()
    if (trimmed === '' || running) return
    setRunning(true)
    setError(null)
    try {
      const payload = await apiRequest<{ data: CommandOutcome }>('/api/v1/ai/command', { method: 'POST', body: { text: trimmed } })
      setOutcome(payload.data)
      if (payload.data.intent === 'scan') onScanned()
    } catch (failure) {
      setOutcome(null)
      setError(errorKey(failure))
    } finally {
      setRunning(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(text)
  }

  const empty = outcome !== null && outcome.intent !== 'scan' && outcome.insights.length === 0 && outcome.results.length === 0

  return (
    <section aria-label={t('ai.cp.title')} className="rounded-xl border border-gold-300/20 bg-[#1c2128] p-5">
      <h2 className="text-lg font-semibold text-gray-100">{t('ai.cp.title')}</h2>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-[14rem] flex-1 text-sm text-gray-400">
          <span className="sr-only">{t('ai.cp.label')}</span>
          <input
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={200}
            placeholder={t('ai.cp.placeholder')}
            aria-label={t('ai.cp.label')}
            className={`${inputClass} mt-0`}
          />
        </label>
        <button type="submit" disabled={running || text.trim() === ''} className={primaryButton}>
          {running ? t('ai.cp.running') : t('ai.cp.run')}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={running}
            onClick={() => {
              const value = t(chip)
              setText(value)
              void run(value)
            }}
            className="rounded-full border border-[#30363d] px-3 py-1 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-50"
          >
            {t(chip)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500">{t('ai.cp.hint')}</p>

      {error ? (
        <p role="alert" className={`${errorClass} mt-3`}>
          {t(error)}
        </p>
      ) : null}

      {outcome ? (
        <div className="mt-4 space-y-4" data-intent={outcome.intent}>
          {outcome.scan ? <ScanSummary result={outcome.scan} /> : null}

          {outcome.insights.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-300">{t('ai.cp.insights')}</h3>
              <ul className="space-y-2">
                {outcome.insights.map((insight) => (
                  <InsightRow key={insight.id} insight={insight} actions={null} />
                ))}
              </ul>
            </div>
          ) : null}

          {outcome.results.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-300">{t('ai.cp.records')}</h3>
              <ul className="space-y-2">
                {outcome.results.map((result) => (
                  <li key={`${result.kind}:${result.id}`}>
                    <Link
                      href={result.href}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm hover:border-blue-500/60"
                    >
                      <span className="flex items-center gap-2">
                        <Badge tone="info">{t(kindLabels[result.kind])}</Badge>
                        <span className="font-medium text-gray-100">{result.label}</span>
                      </span>
                      <span className="text-xs text-gray-400">{result.detail}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {empty ? <p className="text-sm text-gray-400">{t('ai.cp.nothing')}</p> : null}

          <button type="button" onClick={() => setOutcome(null)} className={secondaryButton}>
            {t('ai.cp.clear')}
          </button>
        </div>
      ) : null}
    </section>
  )
}
