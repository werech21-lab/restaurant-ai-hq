'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/erp/common'
import { inputClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Money, Num } from '@/components/ui'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { accountTypes, entryStatuses, type Account, type FiscalPeriod, type JournalEntry } from '@/modules/finance/client'
import { AccountDialog } from '@/modules/finance/ui/AccountDialog'
import { JournalEntryDialog } from '@/modules/finance/ui/JournalEntryDialog'
import { PeriodDialog } from '@/modules/finance/ui/PeriodDialog'
import { accountTypeLabels, ActiveBadge, EntryStatusBadge, entryStatusLabels, PeriodStatusBadge, sourceTypeLabels } from '@/modules/finance/ui/shared'
import { TrialBalancePanel } from '@/modules/finance/ui/TrialBalancePanel'
import { PagedTable } from '@/modules/procurement/ui/PagedTable'
import { PermissionProvider, useCan } from '@/modules/procurement/ui/permissions'
import { dateTimeText, minorText } from '@/modules/procurement/ui/shared'

const allTabs = ['accounts', 'entries', 'periods', 'trial'] as const
type Tab = (typeof allTabs)[number]

/** The permission that lets a user see each tab. A tab the user may not read is not shown. */
const tabPermission: Record<Tab, string> = {
  accounts: permissions.financeAccountRead,
  entries: permissions.financeJournalRead,
  periods: permissions.financeJournalRead,
  trial: permissions.financeJournalRead,
}

type Dialog = { kind: 'account'; account?: Account } | { kind: 'entry'; entryId?: string } | { kind: 'period'; period?: FiscalPeriod } | null

/**
 * The general ledger: the chart of accounts, the journal, the fiscal periods and the trial balance. `permissions` come
 * from the server page and only decide what is shown; the API and the database check every request again.
 */
export default function LedgerWorkspace({ permissions: held }: { permissions: readonly string[] }) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace />
    </PermissionProvider>
  )
}

function Workspace() {
  const { t } = useI18n()
  const canReadAccounts = useCan(tabPermission.accounts)
  const canReadJournal = useCan(tabPermission.entries)
  const canManageAccounts = useCan(permissions.financeAccountManage)
  const canCreateEntry = useCan(permissions.financeJournalCreate)
  const canManagePeriods = useCan(permissions.financePeriodManage)

  const visibleTabs = useMemo<Tab[]>(() => {
    const allowed: Record<Tab, boolean> = {
      accounts: canReadAccounts,
      entries: canReadJournal,
      periods: canReadJournal,
      trial: canReadJournal,
    }
    return allTabs.filter((value) => allowed[value])
  }, [canReadAccounts, canReadJournal])

  const [chosenTab, setTab] = useState<Tab>('entries')
  const tab: Tab | null = visibleTabs.includes(chosenTab) ? chosenTab : (visibleTabs[0] ?? null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState<MessageKey | null>(null)
  // Bumped after any change so every list and the report reload.
  const [reloadToken, setReloadToken] = useState(0)
  const [accountType, setAccountType] = useState('all')
  const [accountStatus, setAccountStatus] = useState('all')
  const [entryStatus, setEntryStatus] = useState('all')
  const [entryFrom, setEntryFrom] = useState('')
  const [entryTo, setEntryTo] = useState('')
  const [periodStatus, setPeriodStatus] = useState('all')

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const changed = useCallback((message: MessageKey) => {
    setNotice(message)
    setReloadToken((value) => value + 1)
  }, [])
  const closeDialog = useCallback(() => setDialog(null), [])

  const accountPath = useMemo(() => {
    const query = new URLSearchParams({ limit: '25', status: accountStatus })
    if (accountType !== 'all') query.set('type', accountType)
    return `/api/v1/finance/accounts?${query.toString()}`
  }, [accountType, accountStatus])

  // The list endpoint takes whole dates only, so a half-typed date is left out instead of sent.
  const entryPath = useMemo(() => {
    const query = new URLSearchParams({ limit: '25', status: entryStatus })
    if (/^\d{4}-\d{2}-\d{2}$/.test(entryFrom)) query.set('from', entryFrom)
    if (/^\d{4}-\d{2}-\d{2}$/.test(entryTo)) query.set('to', entryTo)
    return `/api/v1/finance/journal-entries?${query.toString()}`
  }, [entryStatus, entryFrom, entryTo])

  const periodPath = useMemo(() => `/api/v1/finance/periods?limit=25&status=${periodStatus}`, [periodStatus])

  const title = (() => {
    switch (dialog?.kind) {
      case 'account':
        return t(dialog.account ? 'led.acc.edit' : 'led.acc.new')
      case 'entry':
        return t(dialog.entryId ? 'led.je.title' : 'led.je.new')
      case 'period':
        return t(dialog.period ? 'led.per.title' : 'led.per.new')
      default:
        return ''
    }
  })()

  return (
    <div>
      <Link href="/erp" className="mb-6 inline-block text-sm text-blue-400 hover:text-blue-300">
        {t('erp.back')}
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mist-100">{t('led.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">{t('led.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageAccounts ? (
            <button type="button" onClick={() => setDialog({ kind: 'account' })} className={secondaryButton}>
              {t('led.acc.new')}
            </button>
          ) : null}
          {canManagePeriods ? (
            <button type="button" onClick={() => setDialog({ kind: 'period' })} className={secondaryButton}>
              {t('led.per.new')}
            </button>
          ) : null}
          {canCreateEntry ? (
            <button type="button" onClick={() => setDialog({ kind: 'entry' })} className={primaryButton}>
              {t('led.je.new')}
            </button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <p role="status" className={`${noticeClass} mb-4`}>
          {t(notice)}
        </p>
      ) : null}

      {tab === null ? (
        <div className={panelClass}>
          <p role="status" className="py-8 text-center text-sm text-gray-300">
            {t('led.noAccess')}
          </p>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label={t('led.title')} className="mb-4 flex flex-wrap gap-1 border-b border-[#30363d]">
            {visibleTabs.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`led-tab-${value}`}
                aria-selected={tab === value}
                aria-controls={`led-panel-${value}`}
                onClick={() => setTab(value)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition ${
                  tab === value ? 'border-blue-500 font-semibold text-blue-300' : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {t(`led.tab.${value}`)}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`led-panel-${tab}`} aria-labelledby={`led-tab-${tab}`}>
            {tab === 'accounts' ? (
              <PagedTable<Account>
                path={accountPath}
                reloadToken={reloadToken}
                onOpen={(row) => setDialog({ kind: 'account', account: row })}
                emptyTitle="led.acc.empty"
                emptyHint="led.acc.emptyHint"
                toolbar={
                  <>
                    <select value={accountType} onChange={(event) => setAccountType(event.target.value)} aria-label={t('led.acc.type')} className={`${inputClass} mt-0 w-auto`}>
                      <option value="all">{t('led.acc.allTypes')}</option>
                      {accountTypes.map((value) => (
                        <option key={value} value={value}>
                          {t(accountTypeLabels[value])}
                        </option>
                      ))}
                    </select>
                    <select value={accountStatus} onChange={(event) => setAccountStatus(event.target.value)} aria-label={t('led.col.status')} className={`${inputClass} mt-0 w-auto`}>
                      <option value="all">{t('led.allStatuses')}</option>
                      <option value="active">{t('led.status.active')}</option>
                      <option value="inactive">{t('led.status.inactive')}</option>
                    </select>
                  </>
                }
                columns={[
                  { header: 'led.acc.code', cell: (row) => <Num className="font-semibold text-blue-300">{row.code}</Num> },
                  { header: 'led.acc.name', cell: (row) => row.name },
                  { header: 'led.acc.type', cell: (row) => t(accountTypeLabels[row.type]) },
                  { header: 'led.acc.postable', cell: (row) => t(row.isPostable ? 'led.acc.postableYes' : 'led.acc.header') },
                  { header: 'led.col.status', cell: (row) => <ActiveBadge active={row.isActive} /> },
                ]}
              />
            ) : null}

            {tab === 'entries' ? (
              <PagedTable<JournalEntry>
                path={entryPath}
                reloadToken={reloadToken}
                onOpen={(row) => setDialog({ kind: 'entry', entryId: row.id })}
                emptyTitle="led.je.empty"
                emptyHint="led.je.emptyHint"
                toolbar={
                  <>
                    <select value={entryStatus} onChange={(event) => setEntryStatus(event.target.value)} aria-label={t('led.col.status')} className={`${inputClass} mt-0 w-auto`}>
                      <option value="all">{t('led.allStatuses')}</option>
                      {entryStatuses.map((value) => (
                        <option key={value} value={value}>
                          {t(entryStatusLabels[value])}
                        </option>
                      ))}
                    </select>
                    <label className="text-xs text-gray-400">
                      {t('led.je.from')}
                      <input type="date" value={entryFrom} onChange={(event) => setEntryFrom(event.target.value)} dir="ltr" className={`${inputClass} mt-0 w-auto`} />
                    </label>
                    <label className="text-xs text-gray-400">
                      {t('led.je.to')}
                      <input type="date" value={entryTo} onChange={(event) => setEntryTo(event.target.value)} dir="ltr" className={`${inputClass} mt-0 w-auto`} />
                    </label>
                  </>
                }
                columns={[
                  { header: 'led.je.number', cell: (row) => <Num className="font-semibold text-blue-300">JE-{row.number}</Num> },
                  { header: 'led.je.date', cell: (row) => <Num>{row.entryDate}</Num> },
                  { header: 'led.je.memo', cell: (row) => (row.memo === '' ? '—' : row.memo) },
                  { header: 'led.je.source', cell: (row) => t(sourceTypeLabels[row.sourceType]) },
                  { header: 'led.je.lineCount', cell: (row) => <Num>{row.lineCount}</Num> },
                  { header: 'led.je.totalDebit', cell: (row) => <Money value={minorText(row.totalDebitMinor)} /> },
                  { header: 'led.je.totalCredit', cell: (row) => <Money value={minorText(row.totalCreditMinor)} /> },
                  { header: 'led.col.status', cell: (row) => <EntryStatusBadge status={row.status} /> },
                ]}
              />
            ) : null}

            {tab === 'periods' ? (
              <PagedTable<FiscalPeriod>
                path={periodPath}
                reloadToken={reloadToken}
                onOpen={(row) => setDialog({ kind: 'period', period: row })}
                emptyTitle="led.per.empty"
                emptyHint="led.per.emptyHint"
                toolbar={
                  <select value={periodStatus} onChange={(event) => setPeriodStatus(event.target.value)} aria-label={t('led.col.status')} className={`${inputClass} mt-0 w-auto`}>
                    <option value="all">{t('led.allStatuses')}</option>
                    <option value="open">{t('led.pstatus.open')}</option>
                    <option value="closed">{t('led.pstatus.closed')}</option>
                  </select>
                }
                columns={[
                  { header: 'led.per.name', cell: (row) => row.name },
                  { header: 'led.per.startsOn', cell: (row) => <Num>{row.startsOn}</Num> },
                  { header: 'led.per.endsOn', cell: (row) => <Num>{row.endsOn}</Num> },
                  { header: 'led.per.closedAt', cell: (row) => (row.closedAt ? dateTimeText(row.closedAt) : '—') },
                  { header: 'led.col.status', cell: (row) => <PeriodStatusBadge status={row.status} /> },
                ]}
              />
            ) : null}

            {tab === 'trial' ? <TrialBalancePanel reloadToken={reloadToken} /> : null}
          </div>
        </>
      )}

      {dialog ? (
        <Modal title={title} onClose={closeDialog} size={dialog.kind === 'entry' ? 'xl' : 'md'}>
          {dialog.kind === 'account' ? (
            <AccountDialog
              key={dialog.account?.id ?? 'new'}
              account={dialog.account}
              onCancel={closeDialog}
              onSaved={(message) => {
                closeDialog()
                changed(message)
              }}
            />
          ) : null}
          {dialog.kind === 'entry' ? (
            <JournalEntryDialog
              key={dialog.entryId ?? 'new'}
              entryId={dialog.entryId}
              onChanged={changed}
              onClose={closeDialog}
              onOpenEntry={(entryId) => setDialog({ kind: 'entry', entryId })}
            />
          ) : null}
          {dialog.kind === 'period' ? <PeriodDialog key={dialog.period?.id ?? 'new'} period={dialog.period} onChanged={changed} onClose={closeDialog} /> : null}
        </Modal>
      ) : null}
    </div>
  )
}
