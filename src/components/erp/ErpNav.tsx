'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LanguageSwitch, useI18n } from '@/lib/i18n'
import { activeSectorId, erpSectors } from '@/lib/erp-sectors'

/** Brand and language. Department branches live in the collapsible tree. */
export default function ErpNav() {
  const { t } = useI18n()
  const path = usePathname() ?? ''
  const tab = useSearchParams().get('tab')
  const sector = erpSectors.find((item) => item.id === activeSectorId(path, tab)) ?? erpSectors[0]

  return (
    <header className="sticky top-0 z-30 border-b border-gold-300/10 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" title={t('erpnav.home')}>
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-gold-300/35 bg-gradient-to-b from-[#2a2418] to-[#100e0b] text-xs font-semibold text-gold-300">
            <span dir="ltr">BI</span>
          </span>
          <span dir="ltr" className="hidden text-[11px] font-semibold tracking-[0.18em] text-gold-400 sm:inline">Aether BI</span>
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gold-300">{t(sector.title)}</p>
        <LanguageSwitch />
      </div>
    </header>
  )
}
