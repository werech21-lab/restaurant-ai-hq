'use client'

import Link from 'next/link'
import { useState } from 'react'
import { filterSectors, sectorSummary, erpSectors, type SectorMetrics, type SectorSummary } from '@/lib/erp-sectors'
import { useI18n } from '@/lib/i18n'
import { formatMinor } from '@/lib/money'

function summaryText(summary: SectorSummary, t: (key: 'sector.ready' | 'sector.kpi.pending' | 'sector.kpi.collected' | 'sector.kpi.journals' | 'sector.kpi.stock' | 'sector.kpi.recipes' | 'sector.kpi.deliveries') => string): string {
  if (summary.kind === 'pending') return `${t('sector.kpi.pending')} ${summary.pendingApprovals}`
  if (summary.kind === 'finance') return `${t('sector.kpi.collected')} ${formatMinor(summary.revenueMinor)} · ${t('sector.kpi.journals')} ${summary.postedJournals}`
  if (summary.kind === 'supply') {
    return `${t('sector.kpi.stock')} ${summary.stockAlerts} · ${t('sector.kpi.recipes')} ${summary.recipes} · ${t('sector.kpi.deliveries')} ${summary.deliveryOrders}`
  }
  return t('sector.ready')
}

export default function ErpHub({
  signedIn = false,
  devEntry = false,
  metrics = null,
}: {
  signedIn?: boolean
  devEntry?: boolean
  metrics?: SectorMetrics | null
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const visible = filterSectors(erpSectors, query, t)
  const target = (href: string) => (devEntry && !signedIn ? `/dev/owner?next=${encodeURIComponent(href)}` : href)

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
      <div className="mt-4 space-y-4">
        {visible.map((sector) => (
          <section key={sector.id} aria-labelledby={`sector-${sector.id}`} className="rounded-2xl border border-gold-300/15 bg-ink-900/80 px-4 py-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h3 id={`sector-${sector.id}`} className="text-base font-semibold text-gold-300">
                {t(sector.title)}
              </h3>
              <span className="rounded-full border border-gold-300/20 px-2 py-0.5 text-[11px] text-mist-100">{t('hub.status.ready')}</span>
            </header>
            <p className="mt-1 text-xs text-mist-400">{summaryText(sectorSummary(sector.id, metrics), t)}</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {sector.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={target(link.href)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gold-300/10 px-3 py-2 text-sm text-mist-100 transition hover:border-gold-300/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/40"
                  >
                    <span>{t(link.title)}</span>
                    <span className="shrink-0 text-xs text-gold-300">{t(signedIn ? 'hub.open' : 'hub.login')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  )
}
