'use client'

import { useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import type { Phase } from '@/components/erp/common'
import { StatusBadge } from '@/components/erp/StatusBadge'
import { Num, StateBlock } from '@/components/ui'
import { formatInt } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Customer, CustomerProfile as Profile, CustomerRef, TeamMember } from '@/modules/crm/client'
import {
  CrmMoney,
  CrmPill,
  CustomerStatusBadge,
  LeadStageBadge,
  QuotationStatusBadge,
  activityLabel,
  crmErrorClass,
  crmPrimaryBtn,
  crmSecondaryBtn,
  crmSubcardClass,
  formatCrmDateTime,
  memberName,
} from '@/modules/crm/ui/shared'

type Props = {
  customerId: string
  team: TeamMember[]
  reloadToken: number
  onEdit: (customer: Customer) => void
  onNewQuotation: (customer: CustomerRef) => void
  onNewLead: (customer: CustomerRef) => void
  onOpenQuotation: (quotationId: string) => void
  onChanged: (message: MessageKey) => void
}

function Tile({
  label,
  children,
  tone = 'text-slate-900 dark:text-white',
}: {
  label: string
  children: React.ReactNode
  tone?: string
}) {
  return (
    <div className={crmSubcardClass}>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p>
      <div className={`mt-1.5 text-lg font-semibold ${tone}`}>{children}</div>
    </div>
  )
}

/** Customer 360: who they are, what they owe, their credit position, opportunities, quotations and a merged history. */
export function CustomerProfile({
  customerId,
  team,
  reloadToken,
  onEdit,
  onNewQuotation,
  onNewLead,
  onOpenQuotation,
  onChanged,
}: Props) {
  const { t, locale } = useI18n()
  const fmtLocale = locale === 'en' ? 'en' : 'ar'
  const [profile, setProfile] = useState<Profile | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [retry, setRetry] = useState(0)
  const [actionError, setActionError] = useState<MessageKey | null>(null)
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<{ data: Profile }>(`/api/v1/crm/customers/${customerId}/profile`, { signal: controller.signal })
      .then((payload) => {
        setProfile(payload.data)
        setPhase('ready')
      })
      .catch((failure: unknown) => {
        if (isAbort(failure)) return
        setError(errorKey(failure))
        setPhase('error')
      })
    return () => controller.abort()
  }, [customerId, reloadToken, retry])

  async function activate(customer: Customer) {
    setActionError(null)
    setActivating(true)
    try {
      await apiRequest<{ data: Customer }>(`/api/v1/crm/customers/${customer.id}`, {
        method: 'PATCH',
        body: {
          name: customer.name,
          customerType: customer.customerType,
          email: customer.email,
          phone: customer.phone,
          taxId: customer.taxId,
          address: customer.address,
          creditLimitMinor: customer.creditLimitMinor,
          status: 'active',
          notes: customer.notes,
          version: customer.version,
        },
      })
      onChanged('crm.msg.activated')
    } catch (failure) {
      setActionError(errorKey(failure))
      setRetry((value) => value + 1)
    } finally {
      setActivating(false)
    }
  }

  if (phase === 'loading') {
    return <StateBlock state="loading" locale={fmtLocale} title={t('erp.loading')} />
  }

  if (phase === 'error' || !profile) {
    return (
      <StateBlock
        state="error"
        locale={fmtLocale}
        title={t(error)}
        onRetry={() => {
          setPhase('loading')
          setRetry((value) => value + 1)
        }}
        retryLabel={t('erp.retry')}
      />
    )
  }

  const { customer, financials, quotations, leads, activity } = profile
  const ref: CustomerRef = { id: customer.id, name: customer.name, status: customer.status }
  const limit = customer.creditLimitMinor
  const open = financials?.openBalanceMinor ?? 0
  const usedPercent = limit === null ? 0 : limit === 0 ? (open > 0 ? 100 : 0) : Math.min(100, Math.round((open / limit) * 100))
  const available = limit === null ? null : limit - open

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
            {customer.name}
            <CustomerStatusBadge status={customer.status} />
            <CrmPill tone="neutral">{t(customer.customerType === 'company' ? 'crm.ctype.company' : 'crm.ctype.individual')}</CrmPill>
          </h3>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-2">
            {customer.phone ? (
              <div className="flex gap-2">
                <dt className="text-slate-600 dark:text-slate-400">{t('crm.cform.phone')}:</dt>
                <dd><Num>{customer.phone}</Num></dd>
              </div>
            ) : null}
            {customer.email ? (
              <div className="flex gap-2">
                <dt className="text-slate-600 dark:text-slate-400">{t('crm.cform.email')}:</dt>
                <dd><Num>{customer.email}</Num></dd>
              </div>
            ) : null}
            {customer.taxId ? (
              <div className="flex gap-2">
                <dt className="text-slate-600 dark:text-slate-400">{t('crm.prof.taxId')}:</dt>
                <dd><Num>{customer.taxId}</Num></dd>
              </div>
            ) : null}
            {customer.address ? (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="text-slate-600 dark:text-slate-400">{t('crm.prof.address')}:</dt>
                <dd>{customer.address}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onNewQuotation(ref)} disabled={customer.status === 'blocked'} className={crmPrimaryBtn}>
            {t('crm.newQuotation')}
          </button>
          <button type="button" onClick={() => onNewLead(ref)} disabled={customer.status === 'blocked'} className={crmSecondaryBtn}>
            {t('crm.newLead')}
          </button>
          <button type="button" onClick={() => onEdit(customer)} className={crmSecondaryBtn}>
            {t('erp.edit')}
          </button>
        </div>
      </div>

      {customer.status === 'lead' || customer.status === 'prospect' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
          <span>{t('crm.prof.inactiveNote')}</span>
          <button type="button" onClick={() => void activate(customer)} disabled={activating} className={crmSecondaryBtn}>
            {activating ? t('erp.working') : t('crm.prof.activate')}
          </button>
        </div>
      ) : null}
      {actionError ? (
        <p role="alert" className={crmErrorClass}>
          {t(actionError)}
        </p>
      ) : null}

      {financials ? (
        <div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label={t('crm.prof.invoiced')}>
              <CrmMoney minor={financials.totalInvoicedMinor} />
            </Tile>
            <Tile label={t('crm.prof.balance')} tone={financials.openBalanceMinor > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-white'}>
              <CrmMoney minor={financials.openBalanceMinor} />
            </Tile>
            <Tile label={t('crm.prof.overdue')} tone={financials.overdueMinor > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-white'}>
              <CrmMoney minor={financials.overdueMinor} />
            </Tile>
            <Tile label={t('crm.prof.invoiceCount')}>
              <Num>{formatInt(financials.invoiceCount, fmtLocale)}</Num>
            </Tile>
          </div>
          <div className={`${crmSubcardClass} mt-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-slate-600 dark:text-slate-300">{t('crm.prof.credit')}</span>
              {limit === null ? (
                <span className="text-slate-900 dark:text-slate-100">{t('crm.dir.noLimit')}</span>
              ) : (
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <CrmMoney minor={limit} className="font-semibold text-slate-900 dark:text-white" />
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    {t('crm.prof.available')}:{' '}
                    <CrmMoney
                      minor={available ?? 0}
                      className={(available ?? 0) < 0 ? 'font-semibold text-rose-700 dark:text-rose-300' : 'font-semibold text-emerald-700 dark:text-emerald-300'}
                    />
                  </span>
                </span>
              )}
            </div>
            {limit !== null ? (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="presentation">
                <div
                  className={`h-full ${usedPercent >= 90 ? 'bg-rose-500' : usedPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-600 dark:border-emerald-500/15 dark:text-slate-300">
          {t('crm.prof.noFinance')}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section>
          <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{t('crm.prof.quotations')}</h4>
          {quotations.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">{t('crm.prof.none')}</p>
          ) : (
            <ul className="space-y-1.5">
              {quotations.map((quotation) => (
                <li key={quotation.id}>
                  <button
                    type="button"
                    onClick={() => onOpenQuotation(quotation.id)}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-start text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-emerald-500/15 dark:hover:bg-white/[0.05]"
                  >
                    <span className="flex items-center gap-2">
                      <Num className="font-semibold text-emerald-700 dark:text-emerald-300">{quotation.quoteNumber}</Num>
                      <QuotationStatusBadge quotation={quotation} />
                    </span>
                    <CrmMoney minor={quotation.totalMinor} className="font-semibold" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{t('crm.prof.leads')}</h4>
          {leads.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">{t('crm.prof.none')}</p>
          ) : (
            <ul className="space-y-1.5">
              {leads.map((lead) => (
                <li
                  key={lead.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-emerald-500/15"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900 dark:text-white">{lead.title}</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {memberName(team, lead.assignedTo) ?? t('crm.pipe.unassigned')}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <CrmMoney minor={lead.expectedRevenueMinor} className="font-semibold" />
                    <LeadStageBadge stage={lead.stage} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {financials ? (
          <section>
            <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{t('crm.prof.invoices')}</h4>
            {financials.recentInvoices.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">{t('crm.prof.none')}</p>
            ) : (
              <ul className="space-y-1.5">
                {financials.recentInvoices.slice(0, 5).map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-emerald-500/15"
                  >
                    <span className="flex items-center gap-2">
                      <Num className="font-semibold text-emerald-700 dark:text-emerald-300">{invoice.number}</Num>
                      <StatusBadge status={invoice.status} />
                    </span>
                    <CrmMoney minor={invoice.totalMinor} className="font-semibold" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <section className={financials ? '' : 'lg:col-span-2'}>
          <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{t('crm.prof.activity')}</h4>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">{t('crm.prof.none')}</p>
          ) : (
            <ol className="space-y-2 border-s border-slate-200 ps-4 dark:border-emerald-500/20">
              {activity.map((entry, index) => {
                const label = activityLabel(entry)
                return (
                  <li key={`${entry.kind}-${entry.action}-${entry.at}-${index}`} className="relative text-sm">
                    <span className="absolute -start-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                    <p className="text-slate-900 dark:text-slate-100">
                      {label ? t(label) : entry.action} · <Num className="text-emerald-700 dark:text-emerald-300">{entry.reference}</Num>
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      <Num>{formatCrmDateTime(entry.at, locale)}</Num>
                      {entry.amountMinor !== null ? (
                        <>
                          {' · '}
                          <CrmMoney minor={entry.amountMinor} />
                        </>
                      ) : null}
                    </p>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
