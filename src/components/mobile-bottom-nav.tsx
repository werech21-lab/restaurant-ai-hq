'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  Bell,
  Check,
  Grid2x2,
  LayoutDashboard,
  Lock,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Unlock,
  X,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { ThemeToggle } from '@/components/ThemeToggle'
import { isNavItemActive, SIDEBAR_SECTIONS } from '@/components/erp-sidebar'
import { ExecutivePinModal } from '@/components/erp/ExecutivePinModal'
import {
  AUDITOR_ROLE_EVENT,
  OPEN_GOV_DRAWER_EVENT,
  useOptionalGovernance,
} from '@/components/erp/GovernanceBellDrawer'
import {
  evaluateLiveOdooBreaches,
  getExecutiveSession,
  GOVERNANCE_UPDATED_EVENT,
  loadGovernanceStore,
  lockExecutiveSession,
  type ExecutiveSessionState,
} from '@/lib/governance-compliance'

const HIDDEN_ROUTES = new Set(['/login', '/', '/download', '/home'])

const PRIMARY_DOCK_ROUTES = new Set([
  '/erp',
  '/erp/cores',
  '/erp/feryal-ai',
  '/erp/feryal',
  '/erp/prep-sla',
])

function formatSessionTimer(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function readDomAuditorFlag(): boolean {
  if (typeof document === 'undefined') return false
  if (document.documentElement.dataset.auditor === 'true') return true
  const root = document.getElementById('ae-root')
  return root?.dataset.auditor === 'true'
}

/**
 * Native-Grade 5-Tab Mobile Bottom Dock (`lg:hidden`) +
 * Full 13-Page Categorized "All Modules" Navigation Bottom Sheet.
 * Safe both inside and outside `GovernanceProvider`.
 */
export function MobileBottomNav({ isAuditor: isAuditorProp }: { isAuditor?: boolean } = {}) {
  const pathname = usePathname()
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const gov = useOptionalGovernance()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [standalonePinOpen, setStandalonePinOpen] = useState(false)
  const [domAuditor, setDomAuditor] = useState(false)
  const [fallbackSession, setFallbackSession] = useState<ExecutiveSessionState>({
    active: false,
    unlockedAt: null,
    expiresAt: null,
    remainingSeconds: 0,
  })
  const [fallbackBadgeCount, setFallbackBadgeCount] = useState(0)

  // Close sheet automatically on route navigation & refresh auditor flag from shell DOM
  useEffect(() => {
    setSheetOpen(false)
    setDomAuditor(readDomAuditorFlag())
  }, [pathname])

  useEffect(() => {
    setDomAuditor(readDomAuditorFlag())
    const onRoleEvent = (e: Event) => {
      const detail = (e as CustomEvent<boolean | undefined>).detail
      setDomAuditor(typeof detail === 'boolean' ? detail : readDomAuditorFlag())
    }
    window.addEventListener(AUDITOR_ROLE_EVENT, onRoleEvent)
    return () => window.removeEventListener(AUDITOR_ROLE_EVENT, onRoleEvent)
  }, [])

  // Escape key closes sheet
  useEffect(() => {
    if (!sheetOpen) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false)
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [sheetOpen])

  const isAuditor = Boolean(isAuditorProp ?? gov?.isAuditor ?? domAuditor)

  // Keep standalone Manager PIN session & badge count synced even when mounted in RootLayout outside GovernanceProvider
  const syncFallbackGovernance = useCallback(() => {
    if (gov) return
    try {
      setFallbackSession(
        isAuditor
          ? { active: false, unlockedAt: null, expiresAt: null, remainingSeconds: 0 }
          : getExecutiveSession(),
      )
      const st = loadGovernanceStore()
      const pending = st.approvals.filter((a) => a.status === 'pending').length
      const breaches = evaluateLiveOdooBreaches(st).filter((b) => !b.frozen).length
      setFallbackBadgeCount(pending + breaches)
    } catch {
      // safe SSR / cold-start fallback
    }
  }, [gov, isAuditor])

  useEffect(() => {
    if (gov) return
    syncFallbackGovernance()
    const onUpdate = () => syncFallbackGovernance()
    window.addEventListener(GOVERNANCE_UPDATED_EVENT, onUpdate)
    window.addEventListener('storage', onUpdate)
    const tick = window.setInterval(syncFallbackGovernance, 1000)
    return () => {
      window.removeEventListener(GOVERNANCE_UPDATED_EVENT, onUpdate)
      window.removeEventListener('storage', onUpdate)
      window.clearInterval(tick)
    }
  }, [gov, syncFallbackGovernance])

  if (!pathname || HIDDEN_ROUTES.has(pathname)) return null

  const activeSession = isAuditor
    ? { active: false, unlockedAt: null, expiresAt: null, remainingSeconds: 0 }
    : gov
      ? gov.session
      : fallbackSession
  const badgeCount = gov ? gov.liveBadgeCount : fallbackBadgeCount

  const handleUnlockPin = () => {
    if (isAuditor) return
    if (gov) {
      gov.requireManagerPin({
        titleAr: 'تفعيل وضع المدير لمدة 15 دقيقة',
        titleEn: 'Unlock 15-Minute Manager Session',
      })
    } else {
      setStandalonePinOpen(true)
    }
  }

  const handleLockPin = () => {
    if (isAuditor) return
    if (gov) {
      gov.lockSession()
    } else {
      lockExecutiveSession()
      syncFallbackGovernance()
    }
  }

  const handleOpenGovBell = () => {
    setSheetOpen(false)
    if (gov) {
      gov.openDrawer('all')
    } else {
      window.dispatchEvent(new CustomEvent(OPEN_GOV_DRAWER_EVENT, { detail: 'all' }))
    }
  }

  const homeActive = !sheetOpen && pathname === '/erp'
  const salesActive =
    !sheetOpen && (pathname === '/erp/cores' || pathname.startsWith('/erp/cores/'))
  const feryalActive =
    !sheetOpen &&
    (pathname === '/erp/feryal-ai' ||
      pathname === '/erp/feryal' ||
      pathname.startsWith('/erp/feryal'))
  const opsActive =
    !sheetOpen && (pathname === '/erp/prep-sla' || pathname.startsWith('/erp/prep-sla/'))
  const isSecondaryErpModule =
    pathname.startsWith('/erp/') &&
    !PRIMARY_DOCK_ROUTES.has(pathname) &&
    !pathname.startsWith('/erp/cores/') &&
    !pathname.startsWith('/erp/feryal') &&
    !pathname.startsWith('/erp/prep-sla/')
  const menuActive = sheetOpen || isSecondaryErpModule

  return (
    <>
      {/* Full 13-Page Categorized Navigation Bottom Sheet */}
      {sheetOpen ? (
        <>
          <div
            aria-hidden
            onClick={() => setSheetOpen(false)}
            className="ae-sheet-backdrop no-print fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs lg:hidden"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={isAr ? 'جميع أقسام النظام التنفيذي (13 شاشة)' : 'All 13 Executive ERP Modules'}
            dir={isAr ? 'rtl' : 'ltr'}
            className="ae-bottom-sheet no-print fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-slate-900/5 sm:p-5 sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:hidden dark:bg-[#101C17] dark:ring-emerald-500/15"
          >
            <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-slate-200 dark:bg-white/15" />

            {/* Sheet Header + ThemeToggle + AR/EN */}
            <div className="flex items-center justify-between gap-1.5 pb-3">
              <div className="min-w-0">
                <h2 className="whitespace-nowrap text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                  {isAr ? 'فنتشر فودز' : 'Venture Foods'}
                </h2>
                <p className="whitespace-nowrap text-[13px] font-medium text-slate-500 dark:text-slate-400">
                  {isAr ? '6 مطاعم · 7 فروع · 8 قنوات' : '6 Brands · 7 Branches · 8 Channels'}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <ThemeToggle className="h-8 !gap-1 !px-2 text-xs" />

                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-neutral-100 text-slate-600 transition-colors hover:text-slate-950 dark:bg-white/[0.08] dark:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Manager PIN Session / Auditor Read-Only Status & Bell Bar */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F6F7F8] px-3.5 py-2.5 ring-1 ring-slate-900/[0.04] dark:bg-[#09110E] dark:ring-emerald-500/15">
              {isAuditor ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{isAr ? 'حساب مراجعة — قراءة فقط' : 'Read-Only Auditor'}</span>
                </div>
              ) : activeSession.active ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <Unlock className="h-3.5 w-3.5 shrink-0" />
                  <span>{isAr ? 'وضع المدير نشط 🔓' : 'Manager Active 🔓'}</span>
                  <span
                    dir="ltr"
                    className="rounded-lg bg-emerald-100/80 px-1.5 py-0.5 font-mono text-xs tabular-nums text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                  >
                    {formatSessionTimer(activeSession.remainingSeconds)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{isAr ? 'صلاحية اعتماد المدير' : 'Manager PIN Session'}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                {pathname.startsWith('/erp') ? (
                  <button
                    type="button"
                    onClick={handleOpenGovBell}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl bg-white px-2.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-900/[0.06] transition-colors hover:bg-emerald-50 dark:bg-[#101C17] dark:text-slate-200 dark:ring-emerald-500/15"
                  >
                    <Bell className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span dir="ltr" className="font-bold tabular-nums">
                      {badgeCount}
                    </span>
                  </button>
                ) : null}

                {isAuditor ? (
                  <span className="inline-flex h-8 items-center gap-1 rounded-xl bg-amber-50 px-2.5 text-xs font-bold text-amber-900 ring-1 ring-amber-500/20 dark:bg-amber-950/60 dark:text-amber-200">
                    <Lock className="h-3 w-3 shrink-0" />
                    <span>{isAr ? 'وضع المراجعة — قراءة فقط' : 'Read-Only'}</span>
                  </span>
                ) : activeSession.active ? (
                  <button
                    type="button"
                    onClick={handleLockPin}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl bg-white px-3 text-xs font-semibold text-rose-700 ring-1 ring-rose-500/20 transition-colors hover:bg-rose-50 dark:bg-[#101C17] dark:text-rose-300"
                  >
                    <span>{isAr ? 'قفل الصلاحية 🔒' : 'Lock 🔒'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleUnlockPin}
                    className="btn-colored inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D]"
                  >
                    <span>{isAr ? 'فتح الصلاحية 🔓' : 'Unlock PIN 🔓'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* All 13 ERP Pages Grouped Under Their 4 Executive Categories */}
            <div className="space-y-4">
              {SIDEBAR_SECTIONS.map((section) => (
                <div key={section.id} className="space-y-1.5">
                  <div className="px-1 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    {isAr ? section.labelAr : section.labelEn}
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {section.items.map((item) => {
                      const Icon = item.icon
                      const active = isNavItemActive(item, pathname)
                      return (
                        <Link
                          key={item.key}
                          href={item.href}
                          onClick={() => setSheetOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={`flex items-center justify-between gap-2.5 rounded-2xl px-3.5 py-2.5 text-[13px] transition-all duration-[160ms] active:scale-[0.99] ${
                            active
                              ? 'bg-emerald-50 font-bold text-emerald-950 ring-1 ring-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/35'
                              : 'bg-[#F6F7F8] font-medium text-slate-700 hover:bg-neutral-200/60 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                                active
                                  ? 'btn-colored bg-emerald-600 text-white dark:bg-emerald-500 dark:text-[#04130D]'
                                  : 'bg-white text-emerald-600 ring-1 ring-slate-900/[0.05] dark:bg-[#101C17] dark:text-emerald-400 dark:ring-emerald-500/15'
                              }`}
                            >
                              <Icon size={16} />
                            </span>
                            <span className="truncate">{isAr ? item.labelAr : item.labelEn}</span>
                          </span>
                          {active ? (
                            <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          ) : null}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {/* Standalone PIN modal fallback when outside GovernanceProvider */}
      {!gov && !isAuditor ? (
        <ExecutivePinModal
          open={standalonePinOpen}
          actionTitleAr="تفعيل وضع المدير لمدة 15 دقيقة"
          actionTitleEn="Unlock 15-Minute Manager Session"
          onClose={() => setStandalonePinOpen(false)}
          onVerified={() => syncFallbackGovernance()}
        />
      ) : null}

      {/* Fixed 5-Tab Native-Grade Bottom Dock (`lg:hidden`) */}
      <nav
        aria-label={isAr ? 'التنقل السفلي السريع' : 'Mobile Primary Navigation'}
        dir={isAr ? 'rtl' : 'ltr'}
        className="ae-mobile-dock no-print fixed inset-x-0 bottom-0 z-40 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_rgba(0,0,0,0.06)] backdrop-blur-lg lg:hidden dark:bg-[#0B1512]/95 dark:shadow-[0_-1px_0_rgba(16,185,129,0.12)]"
      >
        <div className="grid h-16 grid-cols-5 items-center px-1">
          {/* 1) Home -> /erp */}
          <Link
            href="/erp"
            aria-current={homeActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 text-xs transition-colors duration-[160ms] ${
              homeActive
                ? 'font-bold text-emerald-600 dark:text-emerald-400'
                : 'font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="truncate">{isAr ? 'الرئيسية' : 'Home'}</span>
          </Link>

          {/* 2) Sales -> /erp/cores */}
          <Link
            href="/erp/cores"
            aria-current={salesActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 text-xs transition-colors duration-[160ms] ${
              salesActive
                ? 'font-bold text-emerald-600 dark:text-emerald-400'
                : 'font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="h-5 w-5" />
            <span className="truncate">{isAr ? 'المبيعات' : 'Sales'}</span>
          </Link>

          {/* 3) Feryal (Elevated Center Emerald Pill Accent) -> /erp/feryal-ai */}
          <Link
            href="/erp/feryal-ai"
            aria-current={feryalActive ? 'page' : undefined}
            className="flex flex-col items-center justify-center gap-0.5 py-1 text-xs"
          >
            <span
              className={`btn-colored flex h-9 w-12 items-center justify-center rounded-2xl transition-all duration-[160ms] active:scale-95 ${
                feryalActive
                  ? 'bg-emerald-600 text-white shadow-[0_4px_14px_rgba(16,185,129,0.42)] ring-2 ring-emerald-500/30 dark:bg-emerald-500 dark:text-[#04130D]'
                  : 'bg-emerald-600 text-white shadow-[0_3px_10px_rgba(16,185,129,0.28)] dark:bg-emerald-500 dark:text-[#04130D]'
              }`}
            >
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <span
              className={`truncate ${
                feryalActive
                  ? 'font-bold text-emerald-600 dark:text-emerald-400'
                  : 'font-semibold text-slate-600 dark:text-slate-300'
              }`}
            >
              {isAr ? 'فريال' : 'Feryal'}
            </span>
          </Link>

          {/* 4) Ops -> /erp/prep-sla */}
          <Link
            href="/erp/prep-sla"
            aria-current={opsActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 text-xs transition-colors duration-[160ms] ${
              opsActive
                ? 'font-bold text-emerald-600 dark:text-emerald-400'
                : 'font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Activity className="h-5 w-5" />
            <span className="truncate">{isAr ? 'التشغيل' : 'Ops'}</span>
          </Link>

          {/* 5) Menu -> Opens Full 13-Page Categorized Navigation Sheet */}
          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            aria-expanded={sheetOpen}
            aria-label={isAr ? 'فتح جميع الأقسام (13 شاشة)' : 'Open All 13 Modules'}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 py-1.5 text-xs transition-colors duration-[160ms] ${
              menuActive
                ? 'font-bold text-emerald-600 dark:text-emerald-400'
                : 'font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Grid2x2 className="h-5 w-5" />
            <span className="truncate">{isAr ? 'الأقسام' : 'Menu'}</span>
          </button>
        </div>
      </nav>
    </>
  )
}
