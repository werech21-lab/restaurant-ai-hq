'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LanguageSwitch, useI18n } from '@/lib/i18n'
import { activeSectorId, effectiveTab, erpSectors, linkPath, linkTab } from '@/lib/erp-sectors'

/** The header shared by every ERP screen: six sectors, then that sector's specialties. */
export default function ErpNav() {
  const { t } = useI18n()
  const path = usePathname() ?? ''
  const tab = useSearchParams().get('tab')
  const sectorId = activeSectorId(path, tab)
  const sector = erpSectors.find((item) => item.id === sectorId) ?? erpSectors[0]
  const openTab = effectiveTab(path, tab)

  return (
    <header className="sticky top-0 z-30 border-b border-gold-300/10 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" title={t('erpnav.home')}>
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-gold-300/35 bg-gradient-to-b from-[#2a2418] to-[#100e0b] text-xs font-semibold text-gold-300">
            <span dir="ltr">BI</span>
          </span>
          <span dir="ltr" className="hidden text-[11px] font-semibold tracking-[0.18em] text-gold-400 sm:inline">
            Aether BI
          </span>
        </Link>

        <nav aria-label={t('erpnav.label')} className="-mx-1 min-w-0 flex-1 overflow-x-auto px-1">
          <ul className="flex w-max items-center gap-1">
            {erpSectors.map((item) => {
              const active = item.id === sectorId
              return (
                <li key={item.id}>
                  <Link
                    href={item.links[0]?.href ?? '/erp'}
                    aria-current={active ? 'page' : undefined}
                    className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/40 ${
                      active ? 'bg-gold-400/15 font-semibold text-gold-300' : 'text-mist-400 hover:bg-white/[0.04] hover:text-mist-100'
                    }`}
                  >
                    {t(item.title)}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <LanguageSwitch />
      </div>

      <nav aria-label={t(sector.title)} className="border-t border-gold-300/10">
        <ul className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
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
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/40 ${
                    active ? 'bg-white/[0.06] font-semibold text-mist-100' : 'text-mist-400 hover:text-mist-100'
                  }`}
                >
                  {t(link.title)}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </header>
  )
}
