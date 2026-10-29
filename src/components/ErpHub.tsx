'use client'

import Link from 'next/link'
import { useState } from 'react'
import { erpCatalog, filterCatalog, type CatalogStatus } from '@/lib/erp-catalog'
import { useI18n, type MessageKey } from '@/lib/i18n'

const statusKey: Record<CatalogStatus, MessageKey> = {
  ready: 'hub.status.ready',
  beta: 'hub.status.beta',
  planned: 'hub.status.planned',
}

export default function ErpHub({ signedIn = false, devEntry = false }: { signedIn?: boolean; devEntry?: boolean }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const visible = filterCatalog(erpCatalog, query, t)

  return (
    <section id="erp-apps" aria-labelledby="erp-apps-title" className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="erp-apps-title" className="text-xl font-bold text-mist-100 sm:text-2xl">
            {t('hub.title')}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-mist-400">{t('hub.lead')}</p>
        </div>
        <label className="block w-full sm:w-64">
          <span className="sr-only">{t('hub.search')}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('hub.search')}
            className="w-full rounded-xl border border-gold-300/20 bg-black/30 px-3 py-2 text-sm text-mist-100 outline-none focus-visible:ring-2 focus-visible:ring-gold-400/40"
          />
        </label>
      </div>
      {visible.length === 0 ? <p className="mt-4 text-sm text-mist-400">{t('hub.empty')}</p> : null}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {visible.map((app) => {
          const body = (
            <>
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-gold-300">{t(app.title)}</span>
                <span className="rounded-full border border-gold-300/20 px-2 py-0.5 text-[11px] text-mist-100">{t(statusKey[app.status])}</span>
              </span>
              <span className="mt-1 text-sm text-mist-100">{t(app.detail)}</span>
              <span className="mt-3 text-xs text-mist-400">{app.href ? t(signedIn ? 'hub.open' : 'hub.login') : t('hub.status.planned')}</span>
            </>
          )
          return (
            <li key={app.id}>
              {app.href ? (
                <Link
                  href={devEntry && !signedIn && app.href ? `/dev/owner?next=${encodeURIComponent(app.href)}` : app.href}
                  className="flex h-full flex-col rounded-2xl border border-gold-300/15 bg-ink-900/80 px-4 py-3 transition hover:border-gold-300/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/40"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex h-full flex-col rounded-2xl border border-dashed border-gold-300/20 bg-black/20 px-4 py-3">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
