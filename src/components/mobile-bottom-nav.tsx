'use client'

import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n'

// Strictly locked to the 6 Executive Items on mobile
const links = [
  { href: '/erp', exact: true, ar: 'الرئيسية', en: 'Overview' },
  { href: '/erp/cores', ar: 'المبيعات والتسويق', en: 'Cores' },
  { href: '/erp/before-after', ar: 'قبل وبعد', en: 'Before/After' },
  { href: '/erp/feryal-ai', ar: 'فريال', en: 'Feryal' },
  { href: '/erp/aggregator-radar', ar: 'التوصيل', en: 'Delivery' },
  { href: '/erp/events-intelligence', ar: 'المعارض', en: 'Booths' },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const { locale } = useI18n()
  if (!pathname || pathname === '/login' || pathname === '/' || pathname === '/download' || pathname === '/home') return null
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 bg-white/95 shadow-[0_-1px_12px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] backdrop-blur dark:bg-[#0D1321]/95 dark:ring-white/[0.06] md:hidden">
      <div className="grid grid-cols-6">
        {links.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <a
              key={item.href}
              href={item.href}
              className={`truncate px-1 py-3 text-center text-[10.5px] font-bold transition-colors ${
                active ? 'text-slate-950 dark:text-white' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {locale === 'ar' ? item.ar : item.en}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
