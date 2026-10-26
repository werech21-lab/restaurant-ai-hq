'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n'

/** Shared building blocks for the ERP screens (inventory, CRM). Not specific to any module. */

export type ListPage<T> = { data: T[]; nextCursor: string | null }

export type Phase = 'loading' | 'ready' | 'error'

export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

const modalWidths = { md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const

export function Modal({
  title,
  onClose,
  children,
  size = 'md',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  size?: keyof typeof modalWidths
}) {
  const { t } = useI18n()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`my-8 w-full ${modalWidths[size]} rounded-2xl border border-[#30363d] bg-[#161b22] p-5 shadow-lift`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('erp.close')}
            title={t('erp.close')}
            className="rounded-lg px-2 py-1 text-xl leading-none text-gray-400 hover:bg-white/5 hover:text-gray-100"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function dateTimeText(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
