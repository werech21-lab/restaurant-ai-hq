'use client'

import { useEffect, useRef, useState } from 'react'
import type { SectionId } from '@/lib/nav'
import { searchIndex, sectionIds } from '@/lib/nav'
import { LanguageSwitch, useI18n, type MessageKey } from '@/lib/i18n'

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

export default function Topbar({
  title,
  onNavigate,
  onMenu,
}: {
  title: string
  onNavigate: (id: SectionId) => void
  onMenu: () => void
}) {
  const { locale, t } = useI18n()
  const [query, setQuery] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)
  const [dateLabel, setDateLabel] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)
  const notesRef = useRef<HTMLDivElement>(null)

  const notes: { id: SectionId; title: string; body: string }[] = [
    { id: 'finance', title: t('note.margin'), body: t('note.marginBody') },
    { id: 'kitchen', title: t('note.waste'), body: t('note.wasteBody') },
    { id: 'delivery', title: t('note.contract'), body: t('note.contractBody') },
  ]

  useEffect(() => {
    setDateLabel(
      new Date().toLocaleDateString(locale === 'ar' ? 'ar-KW' : 'en-GB', {
        numberingSystem: 'latn',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    )
  }, [locale])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNotesOpen(false)
        setQuery('')
      }
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (!searchRef.current?.contains(target)) setQuery('')
      if (!notesRef.current?.contains(target)) setNotesOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [])

  const q = query.trim()
  const results = q
    ? sectionIds
        .filter((id) => `${t(`nav.${id}` as MessageKey)} ${searchIndex[id]}`.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 6)
    : []

  return (
    <header className="relative z-20 flex shrink-0 flex-wrap items-center gap-2 border-b border-gold-300/10 bg-ink-900/80 px-3 py-2.5 backdrop-blur-xl sm:px-5 md:px-8">
      <div className="order-1 flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          aria-label={t('openMenu')}
          onClick={onMenu}
          className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/10 text-mist-300 transition duration-300 hover:border-gold-400/30 hover:bg-white/[0.04] hover:text-mist-100 md:hidden"
        >
          <Glyph>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </Glyph>
        </button>
        <div className="min-w-0">
          <p className="hidden text-[11px] text-gold-400/80 sm:block">{t('brandMark')}</p>
          <h2 className="truncate text-sm font-semibold tracking-tight text-mist-100 sm:text-base">{title}</h2>
        </div>
      </div>

      <div ref={searchRef} className="relative order-3 w-full sm:order-2 sm:w-44 md:w-56">
        <label className="relative block">
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-mist-500">
            <Glyph>
              <circle cx="11" cy="11" r="6" />
              <path d="M20 20l-3.5-3.5" />
            </Glyph>
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-full border border-gold-300/15 bg-black/30 py-2 pe-3 ps-10 text-sm text-mist-100 outline-none transition placeholder:text-mist-500 focus:border-gold-300/40 focus:ring-2 focus:ring-gold-400/15"
          />
        </label>
        {q ? (
          <div className="absolute end-0 z-30 mt-2 w-full overflow-hidden rounded-2xl border border-gold-300/15 bg-ink-800 shadow-lift">
            {results.length === 0 ? (
              <p className="px-3 py-3 text-sm text-mist-400">{t('noResults')}</p>
            ) : (
              results.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onNavigate(id)
                    setQuery('')
                  }}
                  className="block w-full cursor-pointer px-3 py-2.5 text-start text-sm text-mist-100 transition hover:bg-white/[0.04]"
                >
                  {t(`nav.${id}` as MessageKey)}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div className="order-2 flex items-center gap-2 sm:order-3">
        <p className="hidden text-sm text-mist-400 xl:block">{dateLabel}</p>
        <LanguageSwitch />
        <div ref={notesRef} className="relative">
          <button
            type="button"
            aria-label={t('alerts')}
            aria-expanded={notesOpen}
            onClick={() => setNotesOpen((open) => !open)}
            className="relative grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-gold-300/15 text-mist-300 transition hover:border-gold-300/40 hover:bg-gold-300/[0.06] hover:text-mist-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/40"
          >
            <Glyph>
              <path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6" />
              <path d="M10 19a2 2 0 004 0" />
            </Glyph>
            <span className="absolute end-2 top-2 h-2 w-2 rounded-full bg-gold-400" />
          </button>
          {notesOpen ? (
            <div className="absolute end-0 z-30 mt-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-gold-300/15 bg-ink-800 shadow-lift">
              <p className="border-b border-gold-300/10 px-4 py-3 text-xs text-gold-400">{t('alerts')}</p>
              {notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => {
                    onNavigate(note.id)
                    setNotesOpen(false)
                  }}
                  className="block w-full cursor-pointer px-4 py-3 text-start transition hover:bg-white/[0.04]"
                >
                  <span className="block text-sm font-semibold text-mist-100">{note.title}</span>
                  <span className="mt-1 block text-xs text-mist-400">{note.body}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
