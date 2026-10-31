'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { activeSectorId, effectiveTab, erpSectors, linkPath, linkTab } from '@/lib/erp-sectors'
import { useI18n } from '@/lib/i18n'

/** Main department headers with their branches nested underneath. */
export default function DepartmentTree({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n()
  const path = usePathname() ?? ''
  const tab = useSearchParams().get('tab')
  const current = activeSectorId(path, tab)
  const openTab = effectiveTab(path, tab)
  const [opened, setOpened] = useState<string>(current)

  return (
    <nav aria-label={t('erpnav.label')} className="space-y-1">
      {erpSectors.map((sector) => {
        const open = opened === sector.id
        return (
          <div key={sector.id} className="rounded-2xl">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpened(open ? '' : sector.id)}
              className={`flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-start text-sm font-semibold ${
                sector.id === current ? 'text-gold-300' : 'text-mist-100'
              }`}
            >
              <span>{t(sector.title)}</span>
              <span aria-hidden className="text-xs text-mist-400">{open ? '−' : '+'}</span>
            </button>
            {open ? (
              <ul className="mb-1 space-y-0.5 border-s border-gold-300/20 ps-2 ms-4">
                {sector.links.map((link) => {
                  const base = linkPath(link.href)
                  const want = linkTab(link.href)
                  const pathOk = base === '/erp' ? path === '/erp' : path === base || path.startsWith(`${base}/`)
                  const active = pathOk && (want === null || want === openTab)
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={active ? 'page' : undefined}
                        onClick={onNavigate}
                        className={`block rounded-xl px-3 py-1.5 text-sm ${
                          active ? 'bg-gold-400/15 font-semibold text-gold-300' : 'text-mist-400 hover:bg-white/[0.04] hover:text-mist-100'
                        }`}
                      >
                        {t(link.title)}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}
