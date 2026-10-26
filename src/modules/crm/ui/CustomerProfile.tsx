'use client'

import { useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { dateTimeText, type Phase } from '@/components/erp/common'
import { StatusBadge } from '@/components/erp/StatusBadge'
import { errorClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Badge, Money, Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Customer, CustomerProfile as Profile, CustomerRef, TeamMember } from '@/modules/crm/client'
import {
  activityLabel,
  CustomerStatusBadge,
  LeadStageBadge,
  memberName,
  minorText,
  QuotationStatusBadge,
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

function Tile({ label, children, tone = 'text-gray-100' }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-3">
      <p className="text-xs text-gray-400">{label}</p>
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
  const { t } = useI18n()
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

  if (phase === 'loading') return <p className="py-8 text-center text-sm text-gray-400">{t('erp.loading')}</p>

  if (phase === 'error' || !profile) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p role="alert" className={`${errorClass} inline-block`}>
          {t(error)}
        </p>
        <div>
          <button type="button" onClick={() => { setPhase('loading'); setRetry((value) => value + 1) }} className={secondaryButton}>
            {t('erp.retry')}
          </button>
        </div>
      </div>
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
          <h3 className="flex flex-wrap items-center gap-2 text-xl font-bold text-gray-100">
            {customer.name}
            <CustomerStatusBadge status={customer.status} />
            <Badge tone="neutral">{t(customer.customerType === 'company' ? 'crm.ctype.company' : 'crm.ctype.individual')}</Badge>
          </h3>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-gray-300 sm:grid-cols-2">
            {customer.phone ? (
              <div className="flex gap-2">
                <dt className="text-gray-400">{t('crm.cform.phone')}:</dt>
                <dd><Num>{customer.phone}</Num></dd>
              </div>
            ) : null}
            {customer.email ? (
              <div className="flex gap-2">
                <dt className="text-gray-400">{t('crm.cform.email')}:</dt>
                <dd><Num>{customer.email}</Num></dd>
              </div>
            ) : null}
            {customer.taxId ? (
              <div className="flex gap-2">
                <dt className="text-gray-400">{t('crm.prof.taxId')}:</dt>
                <dd><Num>{customer.taxId}</Num></dd>
              </div>
            ) : null}
            {customer.address ? (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="text-gray-400">{t('crm.prof.address')}:</dt>
                <dd>{customer.address}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onNewQuotation(ref)} disabled={customer.status === 'blocked'} className={primaryButton}>
            {t('crm.newQuotation')}
          </button>
          <button type="button" onClick={() => onNewLead(ref)} disabled={customer.status === 'blocked'} className={secondaryButton}>
            {t('crm.newLead')}
          </button>
          <button type="button" onClick={() => onEdit(customer)} className={secondaryButton}>
            {t('erp.edit')}
          </button>
        </div>
      </div>

      {customer.status === 'lead' || customer.status === 'prospect' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
          <span>{t('crm.prof.inactiveNote')}</span>
          <button type="button" onClick={() => void activate(customer)} disabled={activating} className={secondaryButton}>
            {activating ? t('erp.working') : t('crm.prof.activate')}
          </button>
        </div>
      ) : null}
      {actionError ? (
        <p role="alert" className={errorClass}>
          {t(actionError)}
        </p>
      ) : null}

      {financials ? (
        <div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label={t('crm.prof.invoiced')}>
              <Money value={minorText(financials.totalInvoicedMinor)} />
            </Tile>
            <Tile label={t('crm.prof.balance')} tone={financials.openBalanceMinor > 0 ? 'text-amber-300' : 'text-gray-100'}>
              <Money value={minorText(financials.openBalanceMinor)} />
            </Tile>
            <Tile label={t('crm.prof.overdue')} tone={financials.overdueMinor > 0 ? 'text-rose-300' : 'text-gray-100'}>
              <Money value={minorText(financials.overdueMinor)} />
            </Tile>
            <Tile label={t('crm.prof.invoiceCount')}>
              <Num>{financials.invoiceCount.toLocaleString('en-US')}</Num>
            </Tile>
          </div>
          <div className="mt-3 rounded-xl border border-[#30363d] bg-[#0d1117] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-gray-400">{t('crm.prof.credit')}</span>
              {limit === null ? (
                <span className="text-gray-200">{t('crm.dir.noLimit')}</span>
              ) : (
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <Money value={minorText(limit)} className="font-semibold text-gray-100" />
                  <span className="text-xs text-gray-400">
                    {t('crm.prof.available')}:{' '}
                    <Money value={minorText(available ?? 0)} className={(available ?? 0) < 0 ? 'text-rose-300' : 'text-emerald-300'} />
                  </span>
                </span>
              )}
            </div>
            {limit !== null ? (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#30363d]" role="presentation">
                <div className={`h-full ${usedPercent >= 90 ? 'bg-rose-500' : usedPercent >= 70 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${usedPercent}%` }} />
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-[#30363d] px-3 py-2 text-sm text-gray-400">{t('crm.prof.noFinance')}</p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section>
          <h4 className="mb-2 text-sm font-semibold text-gray-200">{t('crm.prof.quotations')}</h4>
          {quotations.length === 0 ? (
            <p className="text-sm text-gray-500">{t('crm.prof.none')}</p>
          ) : (
            <ul className="space-y-1.5">
              {quotations.map((quotation) => (
                <li key={quotation.id}>
                  <button
                    type="button"
                    onClick={() => onOpenQuotation(quotation.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#30363d] px-3 py-2 text-start text-sm hover:bg-white/5"
                  >
                    <span className="flex items-center gap-2">
                      <Num className="font-semibold text-blue-300">{quotation.quoteNumber}</Num>
                      <QuotationStatusBadge quotation={quotation} />
                    </span>
                    <Money value={minorText(quotation.totalMinor)} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-2 text-sm font-semibold text-gray-200">{t('crm.prof.leads')}</h4>
          {leads.length === 0 ? (
            <p className="text-sm text-gray-500">{t('crm.prof.none')}</p>
          ) : (
            <ul className="space-y-1.5">
              {leads.map((lead) => (
                <li key={lead.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#30363d] px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-gray-100">{lead.title}</span>
                    <span className="text-xs text-gray-400">{memberName(team, lead.assignedTo) ?? t('crm.pipe.unassigned')}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Money value={minorText(lead.expectedRevenueMinor)} />
                    <LeadStageBadge stage={lead.stage} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {financials ? (
          <section>
            <h4 className="mb-2 text-sm font-semibold text-gray-200">{t('crm.prof.invoices')}</h4>
            {financials.recentInvoices.length === 0 ? (
              <p className="text-sm text-gray-500">{t('crm.prof.none')}</p>
            ) : (
              <ul className="space-y-1.5">
                {financials.recentInvoices.slice(0, 5).map((invoice) => (
                  <li key={invoice.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#30363d] px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <Num className="font-semibold text-blue-300">{invoice.number}</Num>
                      <StatusBadge status={invoice.status} />
                    </span>
                    <Money value={minorText(invoice.totalMinor)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <section className={financials ? '' : 'lg:col-span-2'}>
          <h4 className="mb-2 text-sm font-semibold text-gray-200">{t('crm.prof.activity')}</h4>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-500">{t('crm.prof.none')}</p>
          ) : (
            <ol className="space-y-2 border-s border-[#30363d] ps-4">
              {activity.map((entry, index) => {
                const label = activityLabel(entry)
                return (
                  <li key={`${entry.kind}-${entry.action}-${entry.at}-${index}`} className="relative text-sm">
                    <span className="absolute -start-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
                    <p className="text-gray-100">
                      {label ? t(label) : entry.action} · <Num className="text-blue-300">{entry.reference}</Num>
                    </p>
                    <p className="text-xs text-gray-400">
                      <Num>{dateTimeText(entry.at)}</Num>
                      {entry.amountMinor !== null ? (
                        <>
                          {' · '}
                          <Money value={minorText(entry.amountMinor)} />
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
