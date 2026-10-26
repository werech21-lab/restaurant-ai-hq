'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import type { SectionId } from '@/lib/nav'
import { navGroups } from '@/lib/nav'
import { useI18n, type MessageKey } from '@/lib/i18n'

function Icon({ children }: { children: ReactNode }) {
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

const icons: Record<SectionId, ReactNode> = {
  ceo: (
    <Icon>
      <path d="M4 17h16" />
      <path d="M5 17l1.6-8L11 12l1-6 1 6 4.4-3L19 17" />
    </Icon>
  ),
  intelligence: (
    <Icon>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.5-3.5" />
    </Icon>
  ),
  finance: (
    <Icon>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-4" />
      <path d="M12 16V8" />
      <path d="M16 16v-6" />
    </Icon>
  ),
  branches: (
    <Icon>
      <path d="M4 10h16v9H4z" />
      <path d="M4 10l2-5h12l2 5" />
      <path d="M10 19v-5h4v5" />
    </Icon>
  ),
  kitchen: (
    <Icon>
      <path d="M6 10h12v2a6 6 0 01-12 0v-2z" />
      <path d="M9 10V8a3 3 0 016 0v2" />
    </Icon>
  ),
  delivery: (
    <Icon>
      <path d="M3 7h11v8H3z" />
      <path d="M14 10h4l3 3v2h-7" />
      <circle cx="7" cy="17.5" r="1.4" />
      <circle cx="17" cy="17.5" r="1.4" />
    </Icon>
  ),
  inventory: (
    <Icon>
      <path d="M3 8l9-4 9 4-9 4-9-4z" />
      <path d="M3 8v8l9 4 9-4V8" />
      <path d="M12 12v8" />
    </Icon>
  ),
  quality: (
    <Icon>
      <path d="M12 3l7 3v6c0 4.2-2.8 6.6-7 8.2C7.8 18.6 5 16.2 5 12V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </Icon>
  ),
  recommendations: (
    <Icon>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M8.5 14a4.5 4.5 0 117 0c0 1.6-.8 2.6-1.7 3.4h-3.6C9.3 16.6 8.5 15.6 8.5 14z" />
    </Icon>
  ),
  reports: (
    <Icon>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </Icon>
  ),
  agents: (
    <Icon>
      <circle cx="12" cy="8" r="3" />
      <path d="M5.5 19v-.8A4.7 4.7 0 0110.2 13.5h3.6a4.7 4.7 0 014.7 4.7V19" />
    </Icon>
  ),
  settings: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M5.8 5.8l1.4 1.4M16.8 16.8l1.4 1.4M18.2 5.8l-1.4 1.4M7.2 16.8l-1.4 1.4" />
    </Icon>
  ),
}

export default function Sidebar({
  active,
  onChange,
  open,
  onClose,
}: {
  active: string
  onChange: (id: SectionId) => void
  open: boolean
  onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label={t('closeMenu')}
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 start-0 z-40 flex h-screen w-[min(17.5rem,86vw)] shrink-0 flex-col border-e border-gold-300/10 bg-ink-900 transition-transform duration-200 md:static md:w-[17.5rem] md:translate-x-0 ${
          open ? 'translate-x-0' : 'max-md:ltr:-translate-x-full max-md:rtl:translate-x-full'
        }`}
      >
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-gold-300/35 bg-gradient-to-b from-[#2a2418] to-[#100e0b] text-sm font-semibold text-gold-300 shadow-[inset_0_1px_0_rgba(244,224,184,0.35)]">
          <span dir="ltr">BI</span>
        </div>
        <div className="min-w-0">
          <p dir="ltr" className="text-[11px] font-semibold tracking-[0.18em] text-gold-400">
            Aether BI
          </p>
          <h1 className="truncate text-[15px] font-bold text-mist-100">{t('brand')}</h1>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {navGroups.map((group) => (
          <div key={group.id} className="mt-4 first:mt-1">
            <p className="mb-1.5 px-3 text-[11px] font-medium text-gold-400/70">{t(`group.${group.id}` as MessageKey)}</p>
            <div className="space-y-1">
              {group.items.map((id) => {
                const isActive = active === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChange(id)}
                    className={`relative flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition duration-200 before:absolute before:inset-y-3 before:start-1.5 before:w-px before:rounded-full before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/40 ${
                      isActive
                        ? 'bg-gradient-to-l from-gold-400/15 to-transparent font-medium text-gold-300 before:bg-gold-300 rtl:bg-gradient-to-l ltr:bg-gradient-to-r'
                        : 'text-mist-400 before:bg-transparent hover:bg-white/[0.03] hover:text-mist-100'
                    }`}
                  >
                    {icons[id]}
                    <span className="truncate text-start">{t(`nav.${id}` as MessageKey)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-2">
        <Link
          href="/erp/finance"
          className="flex w-full items-center rounded-2xl px-3 py-2.5 text-sm text-mist-400 transition hover:bg-white/[0.03] hover:text-mist-100"
        >
          {t('erp.nav')}
        </Link>
        <Link
          href="/erp/inventory"
          className="flex w-full items-center rounded-2xl px-3 py-2.5 text-sm text-mist-400 transition hover:bg-white/[0.03] hover:text-mist-100"
        >
          {t('inv.nav')}
        </Link>
        <Link
          href="/erp/crm"
          className="flex w-full items-center rounded-2xl px-3 py-2.5 text-sm text-mist-400 transition hover:bg-white/[0.03] hover:text-mist-100"
        >
          {t('crm.nav')}
        </Link>
        <Link
          href="/admin"
          className="flex w-full items-center rounded-2xl px-3 py-2.5 text-sm text-mist-400 transition hover:bg-white/[0.03] hover:text-mist-100"
        >
          {t('admin.nav')}
        </Link>
      </div>

      <div className="m-3 flex items-center gap-3 rounded-2xl border border-gold-300/10 bg-black/20 px-3 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-full border border-gold-300/30 text-sm font-semibold text-gold-300">{t('ownerInitial')}</div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-mist-100">{t('owner')}</div>
          <div className="text-xs text-mist-400">{t('ownerRole')}</div>
        </div>
      </div>
    </aside>
    </>
  )
}
