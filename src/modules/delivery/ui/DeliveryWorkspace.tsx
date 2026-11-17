'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import { permissions } from '@/lib/auth/permissions'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatInt,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type {
  DeliveryOrder,
  DeliveryPartner,
  DeliverySettlement,
} from '@/modules/delivery/client'

type Page<T> = { data: T[]; nextCursor: string | null }

function todayKuwait(): string {
  return formatDate(new Date(), 'en')
}

const inputClass =
  'ds-focus-ring mt-1.5 w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2.5 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] disabled:cursor-not-allowed disabled:opacity-60'
const labelClass = 'block text-sm font-medium text-[var(--ds-text-secondary)]'
const primaryBtnClass =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400'
const noticeClass =
  'rounded-xl border border-[var(--ds-positive-border)] bg-[var(--ds-positive-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-positive)]'
const errorClass =
  'rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--ds-negative)]'

function Workspace() {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)
  const canSettle = useCan(permissions.financeJournalPost)

  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [actionError, setActionError] = useState<MessageKey | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [partners, setPartners] = useState<DeliveryPartner[]>([])
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [gross, setGross] = useState('2.000')
  const [commission, setCommission] = useState('0.500')
  const [orderedOn, setOrderedOn] = useState(todayKuwait)
  const [busy, setBusy] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  const reload = useCallback(() => {
    setReloadTick((value) => value + 1)
  }, [])

  function fils(value: string): number {
    const [whole, fraction = ''] = value.split('.')
    const padded = `${fraction}000`.slice(0, 3)
    return Number(whole) * 1000 + Number(padded)
  }

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    Promise.all([
      apiRequest<{ data: DeliveryPartner[] }>('/api/v1/delivery/partners', {
        signal: controller.signal,
      }),
      apiRequest<Page<DeliveryOrder>>('/api/v1/delivery/orders?limit=20', {
        signal: controller.signal,
      }),
    ])
      .then(([partnerPage, orderPage]) => {
        setPartners(partnerPage.data)
        setOrders(orderPage.data)
        setPartnerId(partnerPage.data[0]?.id ?? '')
        setActionError(null)
        setPhase('ready')
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(errorKey(caught))
        setPhase('error')
      })
    return () => controller.abort()
  }, [reloadTick])

  async function savePartner(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    setActionError(null)
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
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function saveOrder(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      const result = await apiRequest<{ data: DeliveryOrder }>('/api/v1/delivery/orders', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: {
          partnerId,
          orderedOn,
          grossMinor: fils(gross),
          commissionMinor: fils(commission),
        },
      })
      setOrders((current) => [result.data, ...current])
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  async function settle(order: DeliveryOrder) {
    setBusy(true)
    setNotice(null)
    setActionError(null)
    try {
      const result = await apiRequest<{ data: DeliverySettlement }>(
        '/api/v1/delivery/settlements',
        {
          method: 'POST',
          idempotencyKey: newIdempotencyKey(),
          body: { orderId: order.id, settledOn: todayKuwait() },
        },
      )
      setOrders((current) =>
        current.map((row) => (row.id === order.id ? { ...row, settled: true } : row)),
      )
      setNotice(result.data.journalEntryId)
    } catch (caught) {
      setActionError(errorKey(caught))
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'loading') {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-5">
        <SectionCard title={t('dwork.title')} subtitle={t('dwork.lead')} locale={fmtLocale}>
          <StateBlock state="loading" locale={fmtLocale} title={t('dwork.loading')} skeletonRows={4} />
        </SectionCard>
      </div>
    )
  }

  if (phase === 'error') {
    const forbidden = error === 'erp.err.forbidden'
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-5">
        <SectionCard title={t('dwork.title')} subtitle={t('dwork.lead')} locale={fmtLocale}>
          <StateBlock
            state={forbidden ? 'forbidden' : 'error'}
            locale={fmtLocale}
            title={t(error)}
            onRetry={forbidden ? undefined : reload}
          />
        </SectionCard>
      </div>
    )
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-6">
      <SectionCard
        title={t('dwork.title')}
        subtitle={t('dwork.lead')}
        locale={fmtLocale}
        actions={
          <Link
            className="ds-focus-ring inline-flex items-center text-sm font-semibold text-[var(--ds-accent)] underline"
            href="/erp/aggregator-radar"
          >
            {t('agg.open')}
          </Link>
        }
      >
        {notice ? (
          <p role="status" className={noticeClass}>
            {t('dwork.saved')}{' '}
            <Link href={`/erp/ledger?entry=${notice}`} className="font-semibold underline">
              {t('dwork.journal')}
            </Link>
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className={errorClass}>
            {t(actionError)}
          </p>
        ) : null}
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title={t('dwork.partner')} locale={fmtLocale}>
          <form onSubmit={(event) => void savePartner(event)} className="space-y-3">
            <label className={labelClass}>
              {t('dwork.code')}
              <input
                className={inputClass}
                dir="ltr"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                disabled={!canSettle || busy}
              />
            </label>
            <label className={labelClass}>
              {t('dwork.name')}
              <input
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canSettle || busy}
              />
            </label>
            <button
              className={primaryBtnClass}
              type="submit"
              disabled={!canSettle || busy || code === '' || name.trim() === ''}
            >
              {t('dwork.savePartner')}
            </button>
          </form>
        </SectionCard>

        <SectionCard title={t('dwork.orders')} locale={fmtLocale}>
          <form onSubmit={(event) => void saveOrder(event)} className="space-y-3">
            <label className={labelClass}>
              {t('dwork.partner')}
              <select
                className={inputClass}
                value={partnerId}
                onChange={(event) => setPartnerId(event.target.value)}
                disabled={!canSettle || busy}
              >
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.code} — {partner.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={labelClass}>
                {t('dwork.gross')}
                <input
                  className={inputClass}
                  dir="ltr"
                  value={gross}
                  onChange={(event) => setGross(event.target.value)}
                  disabled={!canSettle || busy}
                />
              </label>
              <label className={labelClass}>
                {t('dwork.commission')}
                <input
                  className={inputClass}
                  dir="ltr"
                  value={commission}
                  onChange={(event) => setCommission(event.target.value)}
                  disabled={!canSettle || busy}
                />
              </label>
              <label className={labelClass}>
                {t('dwork.date')}
                <input
                  className={inputClass}
                  dir="ltr"
                  type="date"
                  value={orderedOn}
                  onChange={(event) => setOrderedOn(event.target.value)}
                  disabled={!canSettle || busy}
                />
              </label>
            </div>
            <button
              className={primaryBtnClass}
              type="submit"
              disabled={!canSettle || busy || partnerId === ''}
            >
              {t('dwork.saveOrder')}
            </button>
          </form>
        </SectionCard>
      </div>

      <SectionCard
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span>{t('dwork.orders')}</span>
            <span
              dir="ltr"
              className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-2.5 py-0.5 text-xs font-bold tabular-nums"
            >
              {formatInt(orders.length, fmtLocale)}
            </span>
          </span>
        }
        locale={fmtLocale}
      >
        {orders.length === 0 ? (
          <StateBlock state="empty" locale={fmtLocale} title={t('dwork.empty')} />
        ) : (
          <div className="w-full overflow-x-auto rounded-xl border border-[var(--ds-border-hairline)]">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] text-xs font-bold text-[var(--ds-text-secondary)]">
                <tr>
                  <th className="px-3.5 py-2.5 text-start">{t('dwork.partner')}</th>
                  <th className="px-3.5 py-2.5 text-start">{t('dwork.date')}</th>
                  <th className="px-3.5 py-2.5 text-end">{t('dwork.gross')}</th>
                  <th className="px-3.5 py-2.5 text-end">{t('dwork.commission')}</th>
                  <th className="px-3.5 py-2.5 text-end">
                    {isAr ? 'التسوية' : 'Settlement'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-[var(--ds-bg-hover)]">
                    <td className="px-3.5 py-2.5 font-medium text-[var(--ds-text-primary)]">
                      {order.partnerName || UNAVAILABLE_DASH}
                    </td>
                    <td className="px-3.5 py-2.5 text-[var(--ds-text-secondary)]">
                      <span dir="ltr" className="ds-num whitespace-nowrap tabular-nums">
                        {formatDate(order.orderedOn, fmtLocale)}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-end">
                      {Number.isSafeInteger(order.grossMinor) ? (
                        <span
                          dir="ltr"
                          className="ds-num whitespace-nowrap font-semibold tabular-nums text-[var(--ds-text-primary)]"
                        >
                          {formatKwd(order.grossMinor / 1000, fmtLocale)}
                        </span>
                      ) : (
                        <span
                          dir="ltr"
                          title={unavailableTooltip}
                          aria-label={unavailableTooltip}
                          data-unavailable="true"
                          style={{ color: 'var(--ds-unavailable)' }}
                        >
                          {UNAVAILABLE_DASH}
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-end">
                      {Number.isSafeInteger(order.commissionMinor) ? (
                        <span
                          dir="ltr"
                          className="ds-num whitespace-nowrap tabular-nums text-[var(--ds-text-secondary)]"
                        >
                          {formatKwd(order.commissionMinor / 1000, fmtLocale)}
                        </span>
                      ) : (
                        <span
                          dir="ltr"
                          title={unavailableTooltip}
                          aria-label={unavailableTooltip}
                          data-unavailable="true"
                          style={{ color: 'var(--ds-unavailable)' }}
                        >
                          {UNAVAILABLE_DASH}
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-end">
                      {order.settled ? (
                        <span className="inline-flex rounded-full border border-[var(--ds-positive-border)] bg-[var(--ds-positive-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ds-positive)]">
                          {t('dwork.settled')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={primaryBtnClass}
                          disabled={!canSettle || busy}
                          onClick={() => void settle(order)}
                        >
                          {t('dwork.settle')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
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
