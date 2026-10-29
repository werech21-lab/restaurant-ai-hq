'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { LanguageSwitch, useI18n, type MessageKey } from '@/lib/i18n'

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] shrink-0"
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

type NavLink = { href: string; label: MessageKey; exact: boolean; icon: ReactNode }

const links: readonly NavLink[] = [
  {
    href: '/erp',
    label: 'erpnav.hq',
    exact: true,
    icon: (
      <Glyph>
        <path d="M4 17h16" />
        <path d="M5 17l1.6-8L11 12l1-6 1 6 4.4-3L19 17" />
      </Glyph>
    ),
  },
  {
    href: '/erp/finance',
    label: 'erpnav.finance',
    exact: false,
    icon: (
      <Glyph>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 16v-4" />
        <path d="M12 16V8" />
        <path d="M16 16v-6" />
      </Glyph>
    ),
  },
  {
    href: '/erp/ledger',
    label: 'erpnav.ledger',
    exact: false,
    icon: (
      <Glyph>
        <path d="M5 5.5A1.5 1.5 0 016.5 4H18v16H6.5A1.5 1.5 0 015 18.5v-13z" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
        <path d="M9 16h3" />
      </Glyph>
    ),
  },
  {
    href: '/erp/inventory',
    label: 'erpnav.inventory',
    exact: false,
    icon: (
      <Glyph>
        <path d="M3 8l9-4 9 4-9 4-9-4z" />
        <path d="M3 8v8l9 4 9-4V8" />
        <path d="M12 12v8" />
      </Glyph>
    ),
  },
  {
    href: '/erp/kitchen',
    label: 'erpnav.kitchen',
    exact: false,
    icon: (
      <Glyph>
        <path d="M4 10h16" />
        <path d="M6 10v8a2 2 0 002 2h8a2 2 0 002-2v-8" />
        <path d="M9 6V4h6v2" />
      </Glyph>
    ),
  },
  {
    href: '/erp/delivery',
    label: 'erpnav.delivery',
    exact: false,
    icon: (
      <Glyph>
        <path d="M3 7h11v8H3z" />
        <path d="M14 10h4l3 3v2h-7" />
        <circle cx="7" cy="17" r="1.5" />
        <circle cx="17" cy="17" r="1.5" />
      </Glyph>
    ),
  },
  {
    href: '/erp/procurement',
    label: 'erpnav.procurement',
    exact: false,
    icon: (
      <Glyph>
        <path d="M3 5h2l2 10h10l2-7H6.5" />
        <circle cx="9" cy="19" r="1.2" />
        <circle cx="17" cy="19" r="1.2" />
      </Glyph>
    ),
  },
  {
    href: '/erp/crm',
    label: 'erpnav.crm',
    exact: false,
    icon: (
      <Glyph>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19v-.6A4.4 4.4 0 017.9 14h2.2a4.4 4.4 0 014.4 4.4v.6" />
        <path d="M16 6.5a3 3 0 010 5" />
        <path d="M18 14.3a4.2 4.2 0 012.5 3.9v.8" />
      </Glyph>
    ),
  },
  {
    href: '/erp/ai',
    label: 'erpnav.ai',
    exact: false,
    icon: (
      <Glyph>
        <rect x="5" y="7" width="14" height="11" rx="3" />
        <path d="M12 7V4" />
        <circle cx="9.5" cy="12.5" r="1" />
        <circle cx="14.5" cy="12.5" r="1" />
        <path d="M9.5 15.5h5" />
      </Glyph>
    ),
  },
  {
    href: '/erp/org',
    label: 'erpnav.org',
    exact: false,
    icon: (
      <Glyph>
        <path d="M4 20h16" />
        <path d="M6 20V7l6-3 6 3v13" />
        <path d="M10 20v-4h4v4" />
        <path d="M9 10h.01" />
        <path d="M15 10h.01" />
        <path d="M9 14h.01" />
        <path d="M15 14h.01" />
      </Glyph>
    ),
  },
  {
    href: '/erp/hr',
    label: 'erpnav.hr',
    exact: false,
    icon: (
      <Glyph>
        <path d="M8 11a3 3 0 100-6 3 3 0 000 6z" />
        <path d="M16 11a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
        <path d="M3 19c.6-2.6 2.8-4 5-4s4.4 1.4 5 4" />
        <path d="M14 15c1.6 0 3.2.8 3.8 2.5" />
      </Glyph>
    ),
  },
  {
    href: '/erp/operations',
    label: 'erpnav.operations',
    exact: false,
    icon: (
      <Glyph>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h10" />
      </Glyph>
    ),
  },
  {
    href: '/erp/contracts',
    label: 'erpnav.contracts',
    exact: false,
    icon: (
      <Glyph>
        <path d="M7 3h8l4 4v14H7z" />
        <path d="M15 3v4h4" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </Glyph>
    ),
  },
  {
    href: '/erp/compliance',
    label: 'erpnav.compliance',
    exact: false,
    icon: (
      <Glyph>
        <path d="M12 3l7 3v6c0 4.2-2.8 6.8-7 8-4.2-1.2-7-3.8-7-8V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </Glyph>
    ),
  },
  {
    href: '/erp/archive',
    label: 'erpnav.archive',
    exact: false,
    icon: (
      <Glyph>
        <path d="M4 7h16v12H4z" />
        <path d="M4 7l2-3h12l2 3" />
        <path d="M9 12h6" />
      </Glyph>
    ),
  },
  {
    href: '/erp/intelligence',
    label: 'erpnav.intelligence',
    exact: false,
    icon: (
      <Glyph>
        <circle cx="11" cy="11" r="6" />
        <path d="M16 16l4 4" />
      </Glyph>
    ),
  },
  {
    href: '/erp/admin',
    label: 'erpnav.admin',
    exact: false,
    icon: (
      <Glyph>
        <path d="M12 3l7 3v6c0 4.2-2.8 6.8-7 8-4.2-1.2-7-3.8-7-8V6l7-3z" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </Glyph>
    ),
  },
  {
    href: '/erp/iam',
    label: 'erpnav.iam',
    exact: false,
    icon: (
      <Glyph>
        <path d="M12 3l7 3v6c0 4.2-2.8 6.8-7 8-4.2-1.2-7-3.8-7-8V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </Glyph>
    ),
  },
]

function isActive(path: string, link: NavLink): boolean {
  if (link.exact) return path === link.href
  return path === link.href || path.startsWith(`${link.href}/`)
}

/** The header shared by every ERP screen. It links the command center and the modules. */
export default function ErpNav() {
  const { t } = useI18n()
  const path = usePathname() ?? ''

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
            {links.map((link) => {
              const active = isActive(path, link)
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/40 ${
                      active ? 'bg-gold-400/15 font-semibold text-gold-300' : 'text-mist-400 hover:bg-white/[0.04] hover:text-mist-100'
                    }`}
                  >
                    {link.icon}
                    <span>{t(link.label)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <LanguageSwitch />
      </div>
    </header>
  )
}
