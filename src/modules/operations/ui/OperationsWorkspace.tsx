'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Briefcase } from 'lucide-react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { parseKwdToMinor } from '@/lib/money'
import type { Contract, EnterpriseDocument, QualityTicket } from '@/modules/operations/client'

type Tab = 'contracts' | 'documents' | 'quality'
const tabs: readonly Tab[] = ['contracts', 'documents', 'quality']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

const inputCls =
  'ds-focus-ring mt-1.5 w-full rounded-xl border border-slate-300/90 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-white/15 dark:bg-[#0D1512] dark:text-slate-100'
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300'
const primaryBtnCls =
  'ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
const secondaryBtnCls =
  'ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-slate-300/90 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-100 dark:hover:bg-white/[0.06]'
const noticeCls =
  'rounded-xl border border-emerald-500/30 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200'

export interface OperationsWorkspaceInitialData {
  contracts?: Contract[]
  documents?: EnterpriseDocument[]
  tickets?: QualityTicket[]
}

function Workspace({
  initialTab,
  initialPhase,
  initialError,
  initialData,
}: {
  initialTab: string
  initialPhase?: 'loading' | 'ready' | 'error'
  initialError?: MessageKey
  initialData?: OperationsWorkspaceInitialData
}) {
  const { t, locale } = useI18n()
  const fmtLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const isAr = fmtLocale === 'ar'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)
  const canContract = useCan(permissions.opsContractManage)
  const canDocument = useCan(permissions.opsDocumentManage)
  const canTicket = useCan(permissions.opsQualityManage)

  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'contracts')
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>(initialPhase ?? 'loading')
  const [error, setError] = useState<MessageKey>(initialError ?? 'erp.err.generic')
  const [actionError, setActionError] = useState<MessageKey | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [contracts, setContracts] = useState<Contract[]>(initialData?.contracts ?? [])
  const [documents, setDocuments] = useState<EnterpriseDocument[]>(initialData?.documents ?? [])
  const [tickets, setTickets] = useState<QualityTicket[]>(initialData?.tickets ?? [])
  const [title, setTitle] = useState('')
  const [party, setParty] = useState('')
  const [value, setValue] = useState('')
  const [alertDays, setAlertDays] = useState('30')
  const [endDate, setEndDate] = useState(() => formatDate(new Date(), 'en'))
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1)
  }, [])

  useEffect(() => {
    if (initialPhase !== undefined && reloadToken === 0) return
    const controller = new AbortController()
    setPhase('loading')
    Promise.all([
      apiRequest<{ data: Contract[] }>('/api/v1/operations/contracts', {
        signal: controller.signal,
      }),
      apiRequest<{ data: EnterpriseDocument[] }>('/api/v1/operations/documents', {
        signal: controller.signal,
      }),
      apiRequest<{ data: QualityTicket[] }>('/api/v1/operations/tickets', {
        signal: controller.signal,
      }),
    ])
      .then(([contractPage, documentPage, ticketPage]) => {
        setContracts(contractPage.data)
        setDocuments(documentPage.data)
        setTickets(ticketPage.data)
        setActionError(null)
        setPhase('ready')
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }, [initialPhase, reloadToken])

  async function addContract(event: FormEvent) {
    event.preventDefault()
    const amount = parseKwdToMinor(value)
    const days = Number(alertDays)
    if (amount === null || !Number.isInteger(days)) {
      setActionError('erp.err.validation_failed')
      return
    }
    setBusy(true)
    setActionError(null)
    try {
      await apiRequest('/api/v1/operations/contracts', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: {
          title,
          counterparty: party,
          startDate: '2026-01-01',
          endDate,
          valueMinor: amount,
          renewalAlertDays: days,
          status: 'active',
        },
      })
      setNotice(t('ops.saved'))
      reload()
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'loading') {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-4">
        <StateBlock state="loading" locale={fmtLocale} skeletonRows={4} title={t('ops.loading')} />
      </div>
    )
  }

  if (phase === 'error') {
    const isForbidden = error === 'erp.err.forbidden' || error === 'erp.err.unauthenticated'
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-4">
        <StateBlock
          state={isForbidden ? 'forbidden' : 'error'}
          locale={fmtLocale}
          title={t(error)}
          onRetry={isForbidden ? undefined : reload}
        />
      </div>
    )
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-5">
      <SectionCard
        locale={fmtLocale}
        icon={<Briefcase className="h-4 w-4" aria-hidden />}
        title={t('ops.title')}
        subtitle={t('ops.lead')}
      >
        {notice ? (
          <p role="status" className={`${noticeCls} mb-4`}>
            {notice}
          </p>
        ) : null}
        {actionError ? (
          <div className="mb-4">
            <StateBlock
              state={actionError === 'erp.err.forbidden' ? 'forbidden' : 'error'}
              compact
              locale={fmtLocale}
              title={t(actionError)}
            />
          </div>
        ) : null}

        <div
          role="tablist"
          aria-label={t('ops.title')}
          className="mb-5 flex flex-wrap gap-2 border-b border-[var(--ds-border-hairline)] pb-3"
        >
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              id={`ops-tab-${item}`}
              aria-selected={tab === item}
              aria-controls={`ops-panel-${item}`}
              onClick={() => setTab(item)}
              className={tab === item ? primaryBtnCls : secondaryBtnCls}
            >
              {t(`ops.tab.${item}` as MessageKey)}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`ops-panel-${tab}`} aria-labelledby={`ops-tab-${tab}`}>
          {tab === 'contracts' ? (
            <div className="space-y-5">
              {canContract ? (
                <form className="grid gap-3 sm:grid-cols-2" onSubmit={addContract}>
                  <label className={labelCls}>
                    {t('ops.tab.contracts')}
                    <input
                      className={inputCls}
                      required
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    {t('ops.party')}
                    <input
                      className={inputCls}
                      required
                      value={party}
                      onChange={(event) => setParty(event.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    {t('ops.value')}
                    <input
                      className={inputCls}
                      dir="ltr"
                      inputMode="decimal"
                      required
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    {t('hr.end')}
                    <input
                      className={inputCls}
                      dir="ltr"
                      type="date"
                      required
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </label>
                  <label className={labelCls}>
                    {t('ops.alert')}
                    <input
                      className={inputCls}
                      dir="ltr"
                      inputMode="numeric"
                      required
                      value={alertDays}
                      onChange={(event) => setAlertDays(event.target.value)}
                    />
                  </label>
                  <div className="flex items-end">
                    <button className={primaryBtnCls} type="submit" disabled={busy}>
                      {t('hr.add')}
                    </button>
                  </div>
                </form>
              ) : null}

              {contracts.length === 0 ? (
                <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead className="border-b border-[var(--ds-border-hairline)] text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2 text-start">{t('ops.tab.contracts')}</th>
                        <th className="px-3 py-2 text-start">{t('ops.party')}</th>
                        <th className="px-3 py-2 text-end">{t('ops.value')}</th>
                        <th className="px-3 py-2 text-start">{t('hr.end')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                      {contracts.map((contract) => {
                        const formattedValue = Number.isSafeInteger(contract.valueMinor)
                          ? formatKwd(contract.valueMinor / 1000, { locale: fmtLocale })
                          : UNAVAILABLE_DASH
                        return (
                          <tr key={contract.id}>
                            <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                              {contract.title}
                              {contract.renewalDue ? (
                                <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                                  {t('ops.renewal')}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                              {contract.counterparty}
                            </td>
                            <td
                              dir="ltr"
                              title={
                                formattedValue === UNAVAILABLE_DASH ? unavailableTooltip : undefined
                              }
                              className="ds-num px-3 py-2.5 text-end font-semibold text-slate-900 dark:text-slate-100"
                            >
                              {formattedValue}
                            </td>
                            <td
                              dir="ltr"
                              className="ds-num px-3 py-2.5 text-slate-600 dark:text-slate-300"
                            >
                              {formatDate(contract.endDate, fmtLocale)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {tab === 'documents' ? (
            <div className="space-y-3">
              {documents.length === 0 ? (
                <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[30rem] text-sm">
                    <thead className="border-b border-[var(--ds-border-hairline)] text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2 text-start">{t('ops.document')}</th>
                        <th className="px-3 py-2 text-start">{t('gov.category')}</th>
                        <th className="px-3 py-2 text-start">{t('hr.start')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                      {documents.map((document) => (
                        <tr key={document.id}>
                          <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                            {document.title}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                            {document.category}
                          </td>
                          <td
                            dir="ltr"
                            className="ds-num px-3 py-2.5 text-slate-600 dark:text-slate-300"
                          >
                            {formatDate(document.issuedOn, fmtLocale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {canDocument ? null : null}
            </div>
          ) : null}

          {tab === 'quality' ? (
            <div className="space-y-3">
              {tickets.length === 0 ? (
                <StateBlock state="empty" compact locale={fmtLocale} title={t('hr.empty')} />
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead className="border-b border-[var(--ds-border-hairline)] text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2 text-start">{t('ops.tab.quality')}</th>
                        <th className="px-3 py-2 text-start">{t('ops.asset')}</th>
                        <th className="px-3 py-2 text-start">{t('ops.severity')}</th>
                        <th className="px-3 py-2 text-end">{t('ops.cost')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                      {tickets.map((ticket) => {
                        const costText = Number.isSafeInteger(ticket.costMinor)
                          ? formatKwd(ticket.costMinor / 1000, { locale: fmtLocale })
                          : UNAVAILABLE_DASH
                        return (
                          <tr key={ticket.id}>
                            <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                              {t(
                                ticket.type === 'quality_inspection'
                                  ? 'ops.quality'
                                  : 'ops.maintenance',
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                              {ticket.assetName}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                              {t(`ops.${ticket.severity}` as MessageKey)}
                            </td>
                            <td
                              dir="ltr"
                              title={costText === UNAVAILABLE_DASH ? unavailableTooltip : undefined}
                              className="ds-num px-3 py-2.5 text-end font-semibold text-slate-900 dark:text-slate-100"
                            >
                              {costText}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {canTicket ? null : null}
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  )
}

export default function OperationsWorkspace({
  permissions: held,
  initialTab,
  initialPhase,
  initialError,
  initialData,
}: {
  permissions: readonly string[]
  initialTab: string
  initialPhase?: 'loading' | 'ready' | 'error'
  initialError?: MessageKey
  initialData?: OperationsWorkspaceInitialData
}) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace
        initialTab={initialTab}
        initialPhase={initialPhase}
        initialError={initialError}
        initialData={initialData}
      />
    </PermissionProvider>
  )
}
