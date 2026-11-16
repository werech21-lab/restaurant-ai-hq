'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { deleteProduct, saveProduct, signOut, type ActionResult } from '@/app/admin/actions'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { minorToInput } from '@/lib/money'

export type ProductRow = {
  id: string
  name: string
  category: string
  priceMinor: number
  available: boolean
  version: number
}

export type AccessState = 'ok' | 'forbidden' | 'tenant' | 'error'

type Props = {
  products: ProductRow[]
  total: number
  page: number
  pageSize: number
  query: string
  canCreate: boolean
  canUpdate: boolean
  access: AccessState
}

const empty = { name: '', category: '', price: '', available: true }

const errorKeys: Record<Extract<ActionResult, { ok: false }>['error'], MessageKey> = {
  name: 'admin.nameRequired',
  price: 'admin.priceInvalid',
  category: 'admin.categoryInvalid',
  request: 'admin.error',
  config: 'admin.error',
  signin: 'admin.signinRequired',
  forbidden: 'admin.forbidden',
  tenant: 'admin.tenantRequired',
  conflict: 'admin.conflict',
}

const accessKeys: Record<Exclude<AccessState, 'ok'>, MessageKey> = {
  forbidden: 'admin.forbidden',
  tenant: 'admin.tenantRequired',
  error: 'admin.loadFailed',
}

const inputClass =
  'ds-focus-ring mt-1.5 w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2.5 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]'
const primaryBtnClass =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400'
const secondaryBtnClass =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-primary)] transition hover:bg-[var(--ds-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50'
const dangerBtnClass =
  'ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-3.5 py-2 text-sm font-semibold text-[var(--ds-negative)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'

function pageHref(query: string, page: number): string {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (page > 1) params.set('page', String(page))
  const text = params.toString()
  return text ? `/admin?${text}` : '/admin'
}

export default function ProductManager({
  products,
  total,
  page,
  pageSize,
  query,
  canCreate,
  canUpdate,
  access,
}: Props) {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState<{ id: string; version: number } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [noticeIsError, setNoticeIsError] = useState(false)
  const [pending, setPending] = useState(false)

  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  const showForm = access === 'ok' && (editing ? canUpdate : canCreate)

  function report(result: ActionResult, success: MessageKey) {
    if (result.ok) {
      setNotice(t(success))
      setNoticeIsError(false)
      setForm(empty)
      setEditing(null)
      setPendingDelete(null)
      return
    }
    setNotice(t(errorKeys[result.error]))
    setNoticeIsError(true)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    const result = await saveProduct(form, editing?.id, editing?.version)
    setPending(false)
    report(result, 'admin.saved')
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-5">
      <div>
        <Link
          href="/erp"
          className="ds-focus-ring inline-flex items-center text-sm font-semibold text-[var(--ds-accent)] hover:underline"
        >
          {t('admin.back')}
        </Link>
      </div>

      <div className="ds-surface flex flex-wrap items-start justify-between gap-3 rounded-2xl p-4 sm:p-6">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[var(--ds-text-primary)] sm:text-2xl">
            {t('admin.title')}
          </h1>
          <p className="mt-1 text-sm text-[var(--ds-text-muted)]">{t('admin.subtitle')}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className={secondaryBtnClass}>
            {t('admin.logout')}
          </button>
        </form>
      </div>

      {access !== 'ok' ? (
        <StateBlock
          state={access === 'forbidden' ? 'forbidden' : 'error'}
          locale={fmtLocale}
          title={t(accessKeys[access])}
        />
      ) : null}

      {showForm ? (
        <SectionCard
          title={editing ? t('admin.edit') : t('admin.add')}
          locale={fmtLocale}
        >
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-[var(--ds-text-secondary)]">
              <span>{t('admin.name')}</span>
              <input
                required
                maxLength={200}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-[var(--ds-text-secondary)]">
              <span>{t('admin.category')}</span>
              <input
                maxLength={80}
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-[var(--ds-text-secondary)]">
              <span>{t('admin.price')}</span>
              <input
                required
                dir="ltr"
                inputMode="decimal"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex cursor-pointer items-end gap-2 pb-2.5 text-sm font-medium text-[var(--ds-text-primary)]">
              <input
                type="checkbox"
                checked={form.available}
                onChange={(event) => setForm({ ...form, available: event.target.checked })}
                className="h-4 w-4 accent-emerald-600"
              />
              {t('admin.available')}
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" disabled={pending} className={primaryBtnClass}>
                {editing ? t('admin.save') : t('admin.add')}
              </button>
              {editing ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null)
                    setForm(empty)
                  }}
                  className={secondaryBtnClass}
                >
                  {t('admin.cancel')}
                </button>
              ) : null}
            </div>
          </form>
        </SectionCard>
      ) : null}

      {notice ? (
        <p
          role={noticeIsError ? 'alert' : 'status'}
          className={`rounded-xl border px-3.5 py-2.5 text-sm font-medium ${
            noticeIsError
              ? 'border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] text-[var(--ds-negative)]'
              : 'border-[var(--ds-positive-border)] bg-[var(--ds-positive-bg)] text-[var(--ds-positive)]'
          }`}
        >
          {notice}
        </p>
      ) : null}

      {access === 'ok' ? (
        <SectionCard
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span>{t('admin.title')}</span>
              <span
                dir="ltr"
                className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-2.5 py-0.5 text-xs font-bold tabular-nums"
              >
                {formatInt(total, fmtLocale)}
              </span>
            </span>
          }
          locale={fmtLocale}
        >
          <form action="/admin" method="get" className="mb-4 flex flex-wrap gap-2">
            <input
              name="q"
              defaultValue={query}
              maxLength={100}
              aria-label={t('admin.search')}
              placeholder={t('admin.search')}
              className={`${inputClass} mt-0 min-w-[200px] flex-1`}
            />
            <button type="submit" className={secondaryBtnClass}>
              {t('admin.searchButton')}
            </button>
          </form>

          {products.length === 0 ? (
            <StateBlock state="empty" locale={fmtLocale} title={t('admin.empty')} />
          ) : (
            <ul className="space-y-3">
              {products.map((product) => (
                <li
                  key={product.id}
                  className="rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-[var(--ds-text-primary)]">{product.name}</p>
                      <p className="text-sm text-[var(--ds-text-muted)]">
                        {product.category || (
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
                      </p>
                      <p className="text-sm font-semibold text-[var(--ds-text-primary)]">
                        {Number.isSafeInteger(product.priceMinor) ? (
                          <span dir="ltr" className="ds-num tabular-nums">
                            {formatKwd(product.priceMinor / 1000, fmtLocale)}
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
                      </p>
                      <p
                        className={`text-xs font-semibold ${
                          product.available ? 'text-[var(--ds-positive)]' : 'text-[var(--ds-warning)]'
                        }`}
                      >
                        {product.available ? t('admin.available') : t('admin.unavailable')}
                      </p>
                    </div>
                    {canUpdate ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing({ id: product.id, version: product.version })
                            setPendingDelete(null)
                            setForm({
                              name: product.name,
                              category: product.category,
                              price: minorToInput(product.priceMinor),
                              available: product.available,
                            })
                          }}
                          className={secondaryBtnClass}
                        >
                          {t('admin.edit')}
                        </button>
                        {pendingDelete === product.id ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={async () => {
                              setPending(true)
                              const result = await deleteProduct(product.id, product.version)
                              setPending(false)
                              report(result, 'admin.deleted')
                            }}
                            className={dangerBtnClass}
                          >
                            {t('admin.confirm')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPendingDelete(product.id)}
                            className={dangerBtnClass}
                          >
                            {t('admin.delete')}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pages > 1 ? (
            <nav
              className="mt-4 flex items-center justify-between border-t border-[var(--ds-border-hairline)] pt-4 text-sm text-[var(--ds-text-secondary)]"
              aria-label={t('admin.pages')}
            >
              {page > 1 ? (
                <Link href={pageHref(query, page - 1)} className={secondaryBtnClass}>
                  {t('admin.previous')}
                </Link>
              ) : (
                <span />
              )}
              <span dir="ltr" className="ds-num font-semibold tabular-nums">
                {formatInt(page, fmtLocale)} / {formatInt(pages, fmtLocale)}
              </span>
              {page < pages ? (
                <Link href={pageHref(query, page + 1)} className={secondaryBtnClass}>
                  {t('admin.next')}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </SectionCard>
      ) : null}
    </div>
  )
}
