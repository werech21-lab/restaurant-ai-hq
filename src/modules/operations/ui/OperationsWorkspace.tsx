'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { errorClass, inputClass, labelClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor, parseKwdToMinor } from '@/lib/money'
import type { Contract, EnterpriseDocument, QualityTicket } from '@/modules/operations/client'

type Tab = 'contracts' | 'documents' | 'quality'
const tabs: readonly Tab[] = ['contracts', 'documents', 'quality']

function isTab(value: string): value is Tab {
  return (tabs as readonly string[]).includes(value)
}

function Workspace({ initialTab }: { initialTab: string }) {
  const { t } = useI18n()
  const canContract = useCan(permissions.opsContractManage)
  const canDocument = useCan(permissions.opsDocumentManage)
  const canTicket = useCan(permissions.opsQualityManage)
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : 'contracts')
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [documents, setDocuments] = useState<EnterpriseDocument[]>([])
  const [tickets, setTickets] = useState<QualityTicket[]>([])
  const [title, setTitle] = useState('')
  const [party, setParty] = useState('')
  const [value, setValue] = useState('')
  const [alertDays, setAlertDays] = useState('30')
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))

  function load() {
    const controller = new AbortController()
    setPhase('loading')
    Promise.all([
      apiRequest<{ data: Contract[] }>('/api/v1/operations/contracts', { signal: controller.signal }),
      apiRequest<{ data: EnterpriseDocument[] }>('/api/v1/operations/documents', { signal: controller.signal }),
      apiRequest<{ data: QualityTicket[] }>('/api/v1/operations/tickets', { signal: controller.signal }),
    ])
      .then(([contractPage, documentPage, ticketPage]) => {
        setContracts(contractPage.data)
        setDocuments(documentPage.data)
        setTickets(ticketPage.data)
        setPhase('ready')
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }

  useEffect(() => load(), [])

  async function addContract(event: FormEvent) {
    event.preventDefault()
    const amount = parseKwdToMinor(value)
    const days = Number(alertDays)
    if (amount === null || !Number.isInteger(days)) return
    setBusy(true)
    try {
      await apiRequest('/api/v1/operations/contracts', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { title, counterparty: party, startDate: '2026-01-01', endDate, valueMinor: amount, renewalAlertDays: days, status: 'active' },
      })
      setNotice(t('ops.saved'))
      load()
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  const kwd = t('admin.kwd')
  if (phase === 'loading') return <p className="text-sm text-gray-400">{t('ops.loading')}</p>
  if (phase === 'error') return <p className={errorClass} role="alert">{t(error)}</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">{t('ops.title')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">{t('ops.lead')}</p>
      </header>
      {notice ? <p className={noticeClass}>{notice}</p> : null}
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item} className={tab === item ? primaryButton : secondaryButton} type="button" onClick={() => setTab(item)}>{t(`ops.tab.${item}` as MessageKey)}</button>
        ))}
      </div>
      {tab === 'contracts' ? (
        <section className={panelClass}>
          {canContract ? (
            <form className="mb-4 grid gap-3 sm:grid-cols-2" onSubmit={addContract}>
              <label className={labelClass}>{t('ops.tab.contracts')}<input className={inputClass} required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
              <label className={labelClass}>{t('ops.party')}<input className={inputClass} required value={party} onChange={(event) => setParty(event.target.value)} /></label>
              <label className={labelClass}>{t('ops.value')}<input className={inputClass} required value={value} onChange={(event) => setValue(event.target.value)} /></label>
              <label className={labelClass}>{t('hr.end')}<input className={inputClass} type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
              <label className={labelClass}>{t('ops.alert')}<input className={inputClass} required value={alertDays} onChange={(event) => setAlertDays(event.target.value)} /></label>
              <div className="flex items-end"><button className={primaryButton} type="submit" disabled={busy}>{t('hr.add')}</button></div>
            </form>
          ) : null}
          {contracts.length === 0 ? <p className="text-sm text-gray-400">{t('hr.empty')}</p> : contracts.map((contract) => (
            <p key={contract.id} className="border-t border-[#30363d] py-3 text-sm text-gray-100">
              {contract.title} — {contract.counterparty} — {formatMinor(contract.valueMinor)} {kwd}
              {contract.renewalDue ? ` — ${t('ops.renewal')}` : ''}
            </p>
          ))}
        </section>
      ) : null}
      {tab === 'documents' ? (
        <section className={panelClass}>
          {documents.length === 0 ? <p className="text-sm text-gray-400">{t('hr.empty')}</p> : documents.map((document) => (
            <p key={document.id} className="text-sm text-gray-100">{document.title} — {document.category} — {document.issuedOn}</p>
          ))}
          {canDocument ? null : null}
        </section>
      ) : null}
      {tab === 'quality' ? (
        <section className={panelClass}>
          {tickets.length === 0 ? <p className="text-sm text-gray-400">{t('hr.empty')}</p> : tickets.map((ticket) => (
            <p key={ticket.id} className="border-t border-[#30363d] py-3 text-sm text-gray-100">
              {t(ticket.type === 'quality_inspection' ? 'ops.quality' : 'ops.maintenance')} — {ticket.assetName} — {t(`ops.${ticket.severity}` as MessageKey)} — {formatMinor(ticket.costMinor)} {kwd}
            </p>
          ))}
          {canTicket ? null : null}
        </section>
      ) : null}
    </div>
  )
}

export default function OperationsWorkspace({ permissions: held, initialTab }: { permissions: readonly string[]; initialTab: string }) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace initialTab={initialTab} />
    </PermissionProvider>
  )
}
