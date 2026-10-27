'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { deleteProduct, saveProduct, signOut, type ActionResult } from '@/app/admin/actions'
import { Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { formatMinor, minorToInput } from '@/lib/money'

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

function pageHref(query: string, page: number): string {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (page > 1) params.set('page', String(page))
  const text = params.toString()
  return text ? `/admin?${text}` : '/admin'
}

export default function ProductManager({ products, total, page, pageSize, query, canCreate, canUpdate, access }: Props) {
  const { t } = useI18n()
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState<{ id: string; version: number } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)

  const pages = Math.max(1, Math.ceil(total / pageSize))
  const showForm = access === 'ok' && (editing ? canUpdate : canCreate)

  function report(result: ActionResult, success: MessageKey) {
    if (result.ok) {
      setNotice(t(success))
      setForm(empty)
      setEditing(null)
      setPendingDelete(null)
      return
    }
    setNotice(t(errorKeys[result.error]))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    const result = await saveProduct(form, editing?.id, editing?.version)
    setPending(false)
    report(result, 'admin.saved')
  }

  return (
    <div>
      <Link href="/" className="mb-6 inline-block text-sm text-blue-400 hover:text-blue-300">
        {t('admin.back')}
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{t('admin.title')}</h1>
          <p className="mt-1 text-sm text-gray-400">{t('admin.subtitle')}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="rounded-lg border border-[#30363d] px-4 py-2 text-sm text-gray-200 hover:bg-white/5">
            {t('admin.logout')}
          </button>
        </form>
      </div>

      {access !== 'ok' ? (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-300">
          {t(accessKeys[access])}
        </p>
      ) : null}

      {showForm ? (
        <form onSubmit={onSubmit} className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-[#30363d] bg-[#1c2128] p-5 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-gray-400">{t('admin.name')}</span>
            <input
              required
              maxLength={200}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="mt-1.5 w-full rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500"
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-400">{t('admin.category')}</span>
            <input
              maxLength={80}
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              className="mt-1.5 w-full rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500"
            />
          </label>
          <label className="text-sm">
            <span className="text-gray-400">{t('admin.price')}</span>
            <input
              required
              inputMode="decimal"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
              className="mt-1.5 w-full rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500"
            />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={form.available}
              onChange={(event) => setForm({ ...form, available: event.target.checked })}
              className="h-4 w-4 accent-blue-500"
            />
            {t('admin.available')}
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {editing ? t('admin.save') : t('admin.add')}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(null)
                  setForm(empty)
                }}
                className="rounded-lg border border-[#30363d] px-4 py-2 text-sm text-gray-200 hover:bg-white/5"
              >
                {t('admin.cancel')}
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
      {notice ? (
        <p role="status" className="mb-4 text-sm text-gray-300">
          {notice}
        </p>
      ) : null}

      {access === 'ok' ? (
        <form action="/admin" method="get" className="mb-4 flex gap-2">
          <input
            name="q"
            defaultValue={query}
            maxLength={100}
            placeholder={t('admin.search')}
            className="w-full rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
          />
          <button type="submit" className="rounded-lg border border-[#30363d] px-4 py-2 text-sm text-gray-200 hover:bg-white/5">
            {t('admin.searchButton')}
          </button>
        </form>
      ) : null}

      {access !== 'ok' ? null : products.length === 0 ? (
        <p className="rounded-xl border border-[#30363d] bg-[#1c2128] p-5 text-sm text-gray-400">{t('admin.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {products.map((product) => (
            <li key={product.id} className="rounded-xl border border-[#30363d] bg-[#1c2128] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-100">{product.name}</p>
                  <p className="mt-1 text-sm text-gray-400">{product.category}</p>
                  <p className="mt-2 text-sm">
                    <Num>{formatMinor(product.priceMinor)}</Num> <span className="text-gray-400">{t('currency')}</span>
                  </p>
                  <p className={`mt-1 text-xs ${product.available ? 'text-green-400' : 'text-yellow-400'}`}>
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
                      className="rounded-lg border border-[#30363d] px-3 py-1.5 text-sm text-gray-200 hover:bg-white/5"
                    >
                      {t('admin.edit')}
                    </button>
                    {pendingDelete === product.id ? (
                      <button
                        type="button"
                        onClick={async () => {
                          setPending(true)
                          const result = await deleteProduct(product.id, product.version)
                          setPending(false)
                          report(result, 'admin.deleted')
                        }}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
                      >
                        {t('admin.confirm')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingDelete(product.id)}
                        className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
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

      {access === 'ok' && pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm text-gray-300" aria-label={t('admin.pages')}>
          {page > 1 ? (
            <Link href={pageHref(query, page - 1)} className="text-blue-400 hover:text-blue-300">
              {t('admin.previous')}
            </Link>
          ) : (
            <span />
          )}
          <span>
            <Num>{page}</Num> / <Num>{pages}</Num>
          </span>
          {page < pages ? (
            <Link href={pageHref(query, page + 1)} className="text-blue-400 hover:text-blue-300">
              {t('admin.next')}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  )
}
