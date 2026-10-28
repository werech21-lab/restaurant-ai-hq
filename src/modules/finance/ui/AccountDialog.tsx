'use client'

import { useMemo, useState } from 'react'
import { apiRequest } from '@/components/erp/api'
import { inputClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Num } from '@/components/ui'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { accountTypes, createAccountSchema, updateAccountSchema, type Account, type AccountType } from '@/modules/finance/client'
import { accountTypeLabels, ActiveBadge, FormIssues, LedgerFailure } from '@/modules/finance/ui/shared'
import { useAccount, useAccounts } from '@/modules/finance/ui/useAccounts'
import { Fact, Field, useRunner } from '@/components/erp/actions'
import { useCan } from '@/components/erp/permissions'

type Props = {
  account?: Account
  onSaved: (message: MessageKey) => void
  onCancel: () => void
}

function issueOf(path: ReadonlyArray<PropertyKey>): MessageKey {
  if (path[0] === 'code') return 'led.err.form.code'
  if (path[0] === 'name') return 'led.err.form.name'
  if (path[0] === 'parentId') return 'led.err.form.parent'
  return 'led.err.form.generic'
}

/**
 * An account of the chart of accounts. The code, the type and the parent are its identity: they are chosen once and the
 * API refuses to change them afterwards, so editing offers the name and whether the account is still in use.
 */
export function AccountDialog({ account, onSaved, onCancel }: Props) {
  const { t } = useI18n()
  const canManage = useCan(permissions.financeAccountManage)
  const [code, setCode] = useState(account?.code ?? '')
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? 'asset')
  const [parentId, setParentId] = useState('')
  const [isPostable, setIsPostable] = useState(true)
  const [isActive, setIsActive] = useState(account?.isActive ?? true)
  const [issues, setIssues] = useState<MessageKey[]>([])
  const { pending, failure, run } = useRunner()

  // A parent must be a header account (not postable) of the same type, which the API checks again.
  const choices = useAccounts(account ? 'none' : type)
  const parents = useMemo(() => choices.accounts.filter((row) => !row.isPostable), [choices.accounts])
  const parent = useAccount(account?.parentId ?? null)

  function save() {
    setIssues([])
    const parsed = account
      ? updateAccountSchema.safeParse({ version: account.version, name, isActive })
      : createAccountSchema.safeParse({ code, name, type, parentId: parentId === '' ? null : parentId, isPostable })
    if (!parsed.success) {
      setIssues(Array.from(new Set(parsed.error.issues.map((issue) => issueOf(issue.path)))))
      return
    }
    void run(async () => {
      await apiRequest(account ? `/api/v1/finance/accounts/${account.id}` : '/api/v1/finance/accounts', {
        method: account ? 'PATCH' : 'POST',
        body: parsed.data,
      })
      onSaved(account ? 'led.msg.accountSaved' : 'led.msg.accountCreated')
    })
  }

  const parentText = (() => {
    if (account?.parentId === null || account?.parentId === undefined) return t('led.acc.noParent')
    if (parent.loading) return t('erp.loading')
    if (parent.failure) return t(parent.failure)
    return parent.account ? `${parent.account.code} · ${parent.account.name}` : t('led.acc.noParent')
  })()

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {account ? (
          <Fact label={t('led.acc.code')}>
            <Num className="font-semibold text-blue-300">{account.code}</Num>
          </Fact>
        ) : (
          <Field label={t('led.acc.code')}>
            <input value={code} onChange={(event) => setCode(event.target.value)} maxLength={20} dir="ltr" className={inputClass} />
          </Field>
        )}

        <Field label={t('led.acc.name')}>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} className={inputClass} />
        </Field>

        {account ? (
          <Fact label={t('led.acc.type')}>{t(accountTypeLabels[account.type])}</Fact>
        ) : (
          <Field label={t('led.acc.type')}>
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value as AccountType)
                setParentId('')
              }}
              className={inputClass}
            >
              {accountTypes.map((value) => (
                <option key={value} value={value}>
                  {t(accountTypeLabels[value])}
                </option>
              ))}
            </select>
          </Field>
        )}

        {account ? (
          <Fact label={t('led.acc.parent')}>{parentText}</Fact>
        ) : (
          <Field label={t('led.acc.parent')}>
            <select value={parentId} onChange={(event) => setParentId(event.target.value)} disabled={choices.loading} className={inputClass}>
              <option value="">{choices.loading ? t('erp.loading') : t('led.acc.noParent')}</option>
              {parents.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code} · {row.name}
                </option>
              ))}
            </select>
            {choices.failure ? (
              <span role="alert" className="mt-1 block text-xs text-red-300">
                {t(choices.failure)}
              </span>
            ) : null}
          </Field>
        )}

        {account ? (
          <>
            <Fact label={t('led.acc.postable')}>{t(account.isPostable ? 'led.acc.postableYes' : 'led.acc.header')}</Fact>
            <Fact label={t('led.col.status')}>
              <div className="flex items-center gap-3">
                <ActiveBadge active={account.isActive} />
                <label className="flex items-center gap-2 text-sm text-gray-200">
                  <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4" />
                  {t('led.acc.activeLabel')}
                </label>
              </div>
            </Fact>
          </>
        ) : (
          <label className="flex items-center gap-2 self-end text-sm text-gray-200 sm:col-span-2">
            <input type="checkbox" checked={isPostable} onChange={(event) => setIsPostable(event.target.checked)} className="h-4 w-4" />
            {t('led.acc.postableLabel')}
          </label>
        )}
      </div>

      <p className="text-xs text-gray-500">{t(account ? 'led.acc.identityNote' : 'led.acc.postableHint')}</p>

      <FormIssues issues={issues} />
      <LedgerFailure failure={failure} />

      <div className="flex flex-wrap justify-end gap-2 border-t border-[#30363d] pt-4">
        {canManage ? (
          <button type="button" onClick={save} disabled={pending} className={primaryButton}>
            {pending ? t('erp.loading') : t('led.save')}
          </button>
        ) : null}
        <button type="button" onClick={onCancel} className={secondaryButton}>
          {t('erp.cancel')}
        </button>
      </div>
    </div>
  )
}
