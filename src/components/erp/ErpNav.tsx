'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageSwitch, useI18n } from '@/lib/i18n'
import { activeSectorId, erpSectors } from '@/lib/erp-sectors'

/** Brand and language. Department branches live in the collapsible tree. */
export default function ErpNav() {
  const { t } = useI18n()
  const path = usePathname() ?? ''
  const tab = useSearchParams().get('tab')
  const sector = erpSectors.find((item) => item.id === activeSectorId(path, tab)) ?? erpSectors[0]

  return (
    <header className="sticky top-0 z-30 border-b border-gold-300/10 bg-ink-950/90 backdrop-blur" suppressHydrationWarning>
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6" suppressHydrationWarning>
        <Link href="/erp" className="flex shrink-0 items-center gap-2.5" title={t('erpnav.home')} suppressHydrationWarning>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/venture-foods-logo-dark.svg" alt="Venture Foods" className="h-9 w-auto object-contain" />
          <span dir="ltr" className="hidden text-[11px] font-semibold tracking-[0.12em] text-[#8cc63f] sm:inline">
            Venture Foods
          </span>
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gold-300">{t(sector.title)}</p>
        <ThemeToggle />
        <LanguageSwitch />
      </div>
    </header>
  )
}
