'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/components/erp/api'
import { inputClass, panelClass } from '@/components/erp/styles'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { SearchHit } from '@/lib/search/global-search'

const kindKey: Record<SearchHit['kind'], MessageKey> = {
  employee: 'search.kind.employee',
  brand: 'search.kind.brand',
  branch: 'search.kind.branch',
  item: 'search.kind.item',
  invoice: 'search.kind.invoice',
  module: 'search.kind.module',
}

export default function CommandPalette() {
  const { t } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 1) {
      setHits([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setBusy(true)
      apiRequest<{ data: SearchHit[] }>(`/api/v1/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((page) => setHits(page.data))
        .catch(() => setHits([]))
        .finally(() => setBusy(false))
    }, 180)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [open, query])

  if (!open) {
    return (
      <button
        type="button"
        className="fixed bottom-4 start-4 z-40 rounded-full border border-gold-300/30 bg-ink-900 px-3 py-2 text-xs text-gold-300 shadow-lg md:bottom-6 md:start-6"
        onClick={() => setOpen(true)}
      >
        {t('search.open')}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]" role="dialog" aria-modal aria-label={t('search.title')}>
      <div className={`${panelClass} w-full max-w-xl space-y-3`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">{t('search.title')}</h2>
          <button type="button" className="text-xs text-gray-400" onClick={() => setOpen(false)}>{t('hr.close')}</button>
        </div>
        <input
          autoFocus
          className={inputClass}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('search.placeholder')}
        />
        {busy ? <p className="text-xs text-gray-500">{t('suite.loading')}</p> : null}
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {hits.map((hit) => (
            <li key={`${hit.kind}:${hit.id}`}>
              <button
                type="button"
                className="flex w-full flex-col rounded-lg px-3 py-2 text-start hover:bg-white/5"
                onClick={() => {
                  setOpen(false)
                  setQuery('')
                  router.push(hit.href)
                }}
              >
                <span className="text-sm text-white">{hit.kind === 'module' ? t(hit.title as MessageKey) : hit.title}</span>
                <span className="text-xs text-gray-500">{t(kindKey[hit.kind])} · {hit.kind === 'module' ? t(hit.subtitle as MessageKey) : hit.subtitle}</span>
              </button>
            </li>
          ))}
          {!busy && query.trim() && hits.length === 0 ? <li className="px-2 py-3 text-sm text-gray-400">{t('search.empty')}</li> : null}
        </ul>
      </div>
    </div>
  )
}
