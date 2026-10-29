'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { errorClass, inputClass, noticeClass, primaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'
import type { DeliveryOrder, DeliveryPartner, DeliverySettlement } from '@/modules/delivery/client'

type Page<T> = { data: T[]; nextCursor: string | null }

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function Workspace() {
  const { t } = useI18n()
  const canSettle = useCan(permissions.financeJournalPost)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [notice, setNotice] = useState<string | null>(null)
  const [partners, setPartners] = useState<DeliveryPartner[]>([])
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [gross, setGross] = useState('2.000')
  const [commission, setCommission] = useState('0.500')
  const [orderedOn, setOrderedOn] = useState(today)
  const [busy, setBusy] = useState(false)

  function fils(value: string): number {
    const [whole, fraction = ''] = value.split('.')
    const padded = `${fraction}000`.slice(0, 3)
    return Number(whole) * 1000 + Number(padded)
  }

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      apiRequest<{ data: DeliveryPartner[] }>('/api/v1/delivery/partners', { signal: controller.signal }),
      apiRequest<Page<DeliveryOrder>>('/api/v1/delivery/orders?limit=20', { signal: controller.signal }),
    ])
      .then(([partnerPage, orderPage]) => {
        setPartners(partnerPage.data)
        setOrders(orderPage.data)
        setPartnerId(partnerPage.data[0]?.id ?? '')
        setPhase('ready')
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }, [])

  async function savePartner(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      const result = await apiRequest<{ data: DeliveryPartner }>('/api/v1/delivery/partners', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { code, name, commissionBps: 0 },
      })
      setPartners((current) => [...current, result.data])
      setPartnerId(result.data.id)
      setCode('')
      setName('')
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function saveOrder(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      const result = await apiRequest<{ data: DeliveryOrder }>('/api/v1/delivery/orders', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { partnerId, orderedOn, grossMinor: fils(gross), commissionMinor: fils(commission) },
      })
      setOrders((current) => [result.data, ...current])
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function settle(order: DeliveryOrder) {
    setBusy(true)
    setNotice(null)
    try {
      const result = await apiRequest<{ data: DeliverySettlement }>('/api/v1/delivery/settlements', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { orderId: order.id, settledOn: today() },
      })
      setOrders((current) => current.map((row) => (row.id === order.id ? { ...row, settled: true } : row)))
      setNotice(result.data.journalEntryId)
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'loading') return <p className="text-sm text-mist-300">{t('dwork.loading')}</p>
  if (phase === 'error') return <p className={errorClass}>{t(error)}</p>

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-mist-100">{t('dwork.title')}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-mist-400">{t('dwork.lead')}</p>
        <p className="mt-2 text-sm"><Link className="text-blue-300 underline" href="/erp/aggregator-radar">{t('agg.open')}</Link></p>
      </header>
      {notice ? (
        <p className={noticeClass}>
          {t('dwork.saved')}{' '}
          {notice ? (
            <Link href={`/erp/ledger?entry=${notice}`} className="text-blue-300 underline">
              {t('dwork.journal')}
            </Link>
          ) : null}
        </p>
      ) : null}
      {error !== 'erp.err.generic' ? <p className={errorClass}>{t(error)}</p> : null}
      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={(event) => void savePartner(event)} className="space-y-3 rounded-2xl border border-gold-300/15 p-4">
          <h2 className="font-semibold text-gold-300">{t('dwork.partner')}</h2>
          <label className="block text-sm text-mist-300">
            {t('dwork.code')}
            <input className={inputClass} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} disabled={!canSettle || busy} />
          </label>
          <label className="block text-sm text-mist-300">
            {t('dwork.name')}
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} disabled={!canSettle || busy} />
          </label>
          <button className={primaryButton} type="submit" disabled={!canSettle || busy || code === '' || name.trim() === ''}>
            {t('dwork.savePartner')}
          </button>
        </form>
        <form onSubmit={(event) => void saveOrder(event)} className="space-y-3 rounded-2xl border border-gold-300/15 p-4">
          <h2 className="font-semibold text-gold-300">{t('dwork.orders')}</h2>
          <label className="block text-sm text-mist-300">
            {t('dwork.partner')}
            <select className={inputClass} value={partnerId} onChange={(event) => setPartnerId(event.target.value)} disabled={!canSettle || busy}>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.code} — {partner.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-mist-300">
            {t('dwork.gross')}
            <input className={inputClass} value={gross} onChange={(event) => setGross(event.target.value)} disabled={!canSettle || busy} />
          </label>
          <label className="block text-sm text-mist-300">
            {t('dwork.commission')}
            <input className={inputClass} value={commission} onChange={(event) => setCommission(event.target.value)} disabled={!canSettle || busy} />
          </label>
          <label className="block text-sm text-mist-300">
            {t('dwork.date')}
            <input className={inputClass} type="date" value={orderedOn} onChange={(event) => setOrderedOn(event.target.value)} disabled={!canSettle || busy} />
          </label>
          <button className={primaryButton} type="submit" disabled={!canSettle || busy || partnerId === ''}>
            {t('dwork.saveOrder')}
          </button>
        </form>
      </section>
      <section>
        <h2 className="mb-2 font-semibold text-mist-100">{t('dwork.orders')}</h2>
        {orders.length === 0 ? <p className="text-sm text-mist-400">{t('dwork.empty')}</p> : null}
        <ul className="space-y-2">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-300/10 px-3 py-2 text-sm text-mist-100">
              <span>
                {order.partnerName} · {order.orderedOn} · {formatMinor(order.grossMinor)} · {formatMinor(order.commissionMinor)}
              </span>
              {order.settled ? (
                <span className="text-xs text-mist-400">{t('dwork.settled')}</span>
              ) : (
                <button type="button" className={primaryButton} disabled={!canSettle || busy} onClick={() => void settle(order)}>
                  {t('dwork.settle')}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export default function DeliveryWorkspace({ permissions: held }: { permissions: readonly string[] }) {
  return (
    <PermissionProvider permissions={held}>
      <Workspace />
    </PermissionProvider>
  )
}
