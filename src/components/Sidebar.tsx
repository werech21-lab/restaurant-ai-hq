'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import DepartmentTree from '@/components/erp/DepartmentTree'
import { useI18n } from '@/lib/i18n'

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()

  return (
    <>
      {open ? (
        <button type="button" aria-label={t('closeMenu')} onClick={onClose} className="fixed inset-0 z-30 bg-black/60 md:hidden" />
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
            <p dir="ltr" className="text-[11px] font-semibold tracking-[0.18em] text-gold-400">Aether BI</p>
            <h1 className="truncate text-[15px] font-bold text-mist-100">{t('brand')}</h1>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <Link href="#erp-apps" onClick={onClose} className="mb-2 flex w-full items-center rounded-2xl border border-gold-300/25 bg-gold-400/10 px-3 py-2.5 text-sm font-semibold text-gold-300">
            {t('hub.title')}
          </Link>
          <Suspense fallback={null}>
            <DepartmentTree onNavigate={onClose} />
          </Suspense>
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
