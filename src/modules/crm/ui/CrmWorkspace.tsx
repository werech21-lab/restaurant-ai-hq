'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { apiRequest, errorKey, isAbort } from '@/components/erp/api'
import { Modal } from '@/components/erp/common'
import { errorClass, noticeClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { Customer, CustomerRef, Lead, Quotation, TeamMember } from '@/modules/crm/client'
import { CustomerDirectory } from '@/modules/crm/ui/CustomerDirectory'
import { CustomerForm } from '@/modules/crm/ui/CustomerForm'
import { CustomerProfile } from '@/modules/crm/ui/CustomerProfile'
import { LeadForm } from '@/modules/crm/ui/LeadForm'
import { PipelineBoard } from '@/modules/crm/ui/PipelineBoard'
import { QuotationBuilder } from '@/modules/crm/ui/QuotationBuilder'
import { QuotationList } from '@/modules/crm/ui/QuotationList'

const tabs = ['pipeline', 'customers', 'quotations'] as const
type Tab = (typeof tabs)[number]

type Dialog =
  | { kind: 'lead'; lead?: Lead; customer?: CustomerRef }
  | { kind: 'customer'; customer?: Customer }
  | { kind: 'profile'; customerId: string }
  | { kind: 'quotation'; quotationId?: string; customer?: CustomerRef; leadId?: string }
  | null

/** The CRM screen: opportunity pipeline, customer directory with a 360 profile, and quotations. */
export default function CrmWorkspace() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('pipeline')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState<MessageKey | null>(null)
  const [alert, setAlert] = useState<MessageKey | null>(null)
  // Bumped after any change so every tab and open profile reloads its data.
  const [reloadToken, setReloadToken] = useState(0)
  const [team, setTeam] = useState<TeamMember[]>([])

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<{ data: TeamMember[] }>('/api/v1/crm/team', { signal: controller.signal })
      .then((payload) => setTeam(payload.data))
      .catch((error: unknown) => {
        if (!isAbort(error)) setTeam([])
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const changed = useCallback((message: MessageKey) => {
    setAlert(null)
    setNotice(message)
    setReloadToken((value) => value + 1)
  }, [])

  const closeDialog = useCallback(() => setDialog(null), [])

  /** A lead carries only its customer's name, so the customer is read to know whether it can be quoted. */
  const quoteForLead = useCallback(async (lead: Lead) => {
    setAlert(null)
    try {
      const payload = await apiRequest<{ data: Customer }>(`/api/v1/crm/customers/${lead.customerId}`)
      const { id, name, status } = payload.data
      setDialog({ kind: 'quotation', customer: { id, name, status }, leadId: lead.id })
    } catch (error) {
      setAlert(errorKey(error))
    }
  }, [])

  const dialogTitle =
    dialog?.kind === 'lead'
      ? t(dialog.lead ? 'crm.lead.edit' : 'crm.lead.new')
      : dialog?.kind === 'customer'
        ? t(dialog.customer ? 'crm.cform.edit' : 'crm.cform.new')
        : dialog?.kind === 'profile'
          ? t('crm.prof.title')
          : dialog?.kind === 'quotation'
            ? t(dialog.quotationId ? 'crm.qb.edit' : 'crm.qb.new')
            : ''

  return (
    <div>
      <Link href="/" className="mb-6 inline-block text-sm text-blue-400 hover:text-blue-300">
        {t('erp.back')}
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-mist-100">{t('crm.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">{t('crm.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setDialog({ kind: 'customer' })} className={secondaryButton}>
            {t('crm.newCustomer')}
          </button>
          <button type="button" onClick={() => setDialog({ kind: 'lead' })} className={secondaryButton}>
            {t('crm.newLead')}
          </button>
          <button type="button" onClick={() => setDialog({ kind: 'quotation' })} className={primaryButton}>
            {t('crm.newQuotation')}
          </button>
        </div>
      </div>

      {notice ? (
        <p role="status" className={`${noticeClass} mb-4`}>
          {t(notice)}
        </p>
      ) : null}
      {alert ? (
        <p role="alert" className={`${errorClass} mb-4`}>
          {t(alert)}
        </p>
      ) : null}

      <div role="tablist" aria-label={t('crm.title')} className="mb-4 flex flex-wrap gap-1 border-b border-[#30363d]">
        {tabs.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`crm-tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`crm-panel-${value}`}
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition ${
              tab === value ? 'border-blue-500 font-semibold text-blue-300' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t(`crm.tab.${value}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`crm-panel-${tab}`} aria-labelledby={`crm-tab-${tab}`}>
        {tab === 'pipeline' ? (
          <PipelineBoard
            team={team}
            reloadToken={reloadToken}
            onEdit={(lead) => setDialog({ kind: 'lead', lead })}
            onQuote={(lead) => void quoteForLead(lead)}
            onMoved={changed}
          />
        ) : null}
        {tab === 'customers' ? (
          <CustomerDirectory reloadToken={reloadToken} onOpen={(customer) => setDialog({ kind: 'profile', customerId: customer.id })} />
        ) : null}
        {tab === 'quotations' ? (
          <QuotationList reloadToken={reloadToken} onOpen={(quotation: Quotation) => setDialog({ kind: 'quotation', quotationId: quotation.id })} />
        ) : null}
      </div>

      {dialog ? (
        <Modal title={dialogTitle} onClose={closeDialog} size={dialog.kind === 'quotation' || dialog.kind === 'profile' ? 'xl' : 'md'}>
          {dialog.kind === 'lead' ? (
            <LeadForm
              lead={dialog.lead}
              customer={dialog.customer}
              team={team}
              onCancel={closeDialog}
              onSaved={(_lead, message) => {
                closeDialog()
                changed(message)
              }}
            />
          ) : null}
          {dialog.kind === 'customer' ? (
            <CustomerForm
              customer={dialog.customer}
              onCancel={closeDialog}
              onSaved={(_customer, message) => {
                closeDialog()
                changed(message)
              }}
            />
          ) : null}
          {dialog.kind === 'profile' ? (
            <CustomerProfile
              customerId={dialog.customerId}
              team={team}
              reloadToken={reloadToken}
              onEdit={(customer) => setDialog({ kind: 'customer', customer })}
              onNewQuotation={(customer) => setDialog({ kind: 'quotation', customer })}
              onNewLead={(customer) => setDialog({ kind: 'lead', customer })}
              onOpenQuotation={(quotationId) => setDialog({ kind: 'quotation', quotationId })}
              onChanged={changed}
            />
          ) : null}
          {dialog.kind === 'quotation' ? (
            <QuotationBuilder
              quotationId={dialog.quotationId}
              initialCustomer={dialog.customer ?? null}
              initialLeadId={dialog.leadId ?? null}
              onChanged={changed}
              onClose={closeDialog}
            />
          ) : null}
        </Modal>
      ) : null}
    </div>
  )
}
