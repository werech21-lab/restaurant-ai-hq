'use client'

import { useMemo } from 'react'
import { inputClass, secondaryButton } from '@/components/erp/styles'
import { Num } from '@/components/ui'
import { useI18n } from '@/lib/i18n'
import { emptyJournalLine, type JournalLineDraft, type LineSide } from '@/modules/finance/ui/journal-draft'
import { useAccounts } from '@/modules/finance/ui/useAccounts'

const MAX_LINES = 200

type Props = {
  lines: JournalLineDraft[]
  onChange: (lines: JournalLineDraft[]) => void
}

/**
 * The editable lines of a draft journal entry. Every line names one active postable account and carries one amount on one
 * side, which is the shape the API takes. The entry may still be unbalanced here: posting is what refuses that.
 */
export function JournalLineEditor({ lines, onChange }: Props) {
  const { t } = useI18n()
  const choices = useAccounts('all')
  const postable = useMemo(() => choices.accounts.filter((account) => account.isPostable), [choices.accounts])

  function update(key: string, patch: Partial<JournalLineDraft>) {
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  return (
    <div className="space-y-3">
      {choices.failure ? (
        <p role="alert" className="text-xs text-red-300">
          {t(choices.failure)}
        </p>
      ) : null}
      {choices.truncated ? <p className="text-xs text-amber-300">{t('led.line.truncated')}</p> : null}
      {!choices.loading && !choices.failure && postable.length === 0 ? <p className="text-xs text-amber-300">{t('led.line.noAccounts')}</p> : null}

      {lines.map((line, index) => (
        <div key={line.key} className="rounded-xl border border-[#30363d] bg-[#0d1117]/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400">
              {t('led.line.no')} <Num>{index + 1}</Num>
            </span>
            {lines.length > 2 ? (
              <button
                type="button"
                onClick={() => onChange(lines.filter((candidate) => candidate.key !== line.key))}
                className="text-xs text-red-400 hover:text-red-300"
              >
                {t('erp.form.removeLine')}
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className="text-xs text-gray-400 sm:col-span-2">
              {t('led.line.account')}
              <select
                value={line.accountId}
                onChange={(event) => update(line.key, { accountId: event.target.value })}
                disabled={choices.loading}
                className={inputClass}
              >
                <option value="">{choices.loading ? t('erp.loading') : t('led.line.pickAccount')}</option>
                {postable.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} · {account.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-gray-400">
              {t('led.line.side')}
              <select value={line.side} onChange={(event) => update(line.key, { side: event.target.value as LineSide })} className={inputClass}>
                <option value="debit">{t('led.line.debit')}</option>
                <option value="credit">{t('led.line.credit')}</option>
              </select>
            </label>

            <label className="text-xs text-gray-400">
              {t('led.line.amount')}
              <input
                value={line.amount}
                onChange={(event) => update(line.key, { amount: event.target.value })}
                inputMode="decimal"
                dir="ltr"
                className={inputClass}
              />
            </label>

            <label className="text-xs text-gray-400 sm:col-span-4">
              {t('led.line.description')}
              <input
                value={line.description}
                onChange={(event) => update(line.key, { description: event.target.value })}
                maxLength={300}
                className={inputClass}
              />
            </label>
          </div>
        </div>
      ))}

      {lines.length < MAX_LINES ? (
        <button type="button" onClick={() => onChange([...lines, emptyJournalLine(lines.length % 2 === 0 ? 'debit' : 'credit')])} className={secondaryButton}>
          {t('erp.form.addLine')}
        </button>
      ) : null}
    </div>
  )
}
