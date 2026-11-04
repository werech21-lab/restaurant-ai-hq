'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import type { PanelSearchHit } from '@/app/api/panel/search/route'

export function PanelSpotlight() {
  const { locale } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PanelSearchHit[]>([])
  const [busy, setBusy] = useState(false)
  const ar = locale !== 'en'

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((v) => !v)
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
      fetch(`/api/panel/search?q=${encodeURIComponent(q)}`, { credentials: 'same-origin', signal: controller.signal })
        .then((r) => r.json())
        .then((json: { data?: PanelSearchHit[] }) => setHits(json.data || []))
        .catch(() => setHits([]))
        .finally(() => setBusy(false))
    }, 140)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [open, query])

  function go(href: string) {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-xl border border-white/10 bg-[#11161f] px-3 py-1.5 text-xs text-mist-300 hover:border-emerald-500/40 hover:text-emerald-300 sm:inline-flex"
        title="Ctrl+K"
      >
        <span>{ar ? 'بحث شامل' : 'Spotlight'}</span>
        <kbd className="rounded border border-white/15 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-mist-400">{ar ? 'سريع' : 'Ctrl+K'}</kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/70 p-4 pt-[10vh]"
          role="dialog"
          aria-modal
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0a0d12] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/10 px-4 py-3">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={ar ? 'ابحث عن موظف، صنف، فاتورة، قيد، فرع، وثيقة…' : 'Search employees, items, invoices, journals, docs…'}
                className="w-full bg-transparent text-base text-white outline-none placeholder:text-mist-500"
              />
              <p className="mt-1 text-[11px] text-mist-500">{busy ? (ar ? 'جاري البحث…' : 'Searching…') : (ar ? 'البحث السريع في جميع سجلات المنصة' : 'Ctrl/Cmd + K')}</p>
            </div>
            <ul className="max-h-[55vh] overflow-y-auto">
              {hits.map((hit) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 border-b border-white/5 px-4 py-3 text-start hover:bg-emerald-950/30"
                    onClick={() => go(hit.href)}
                  >
                    <span className="mt-0.5 rounded-md border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                      {hit.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-white">{hit.title}</span>
                      <span className="block truncate text-xs text-mist-400">{hit.subtitle}</span>
                    </span>
                  </button>
                </li>
              ))}
              {!busy && query.trim() && hits.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-mist-500">{ar ? 'لا نتائج' : 'No results'}</li>
              ) : null}
              {!query.trim() ? (
                <li className="px-4 py-8 text-center text-sm text-mist-500">
                  {ar ? 'اكتب للبحث في الموظفين والأصناف والفواتير والوثائق' : 'Type to search employees, products, invoices, documents'}
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  )
}
