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
import {
  normalizeExecSessionRole,
  type ExecSessionRole,
} from '@/lib/auth/exec-role-meta'
import {
  isErpRouteAllowedForRole,
  resolveRoleDefaultHome,
} from '@/lib/auth/role-access-policy'
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
  '/erp/warehouse-chain',
  '/erp/aggregator-radar',
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

function readDomSessionRole(): ExecSessionRole {
  if (typeof document === 'undefined') return 'admin'
  const root = document.getElementById('ae-root')
  return normalizeExecSessionRole(root?.dataset.sessionRole) ?? 'admin'
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
  const [domRole, setDomRole] = useState<ExecSessionRole>('admin')
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
    setDomRole(readDomSessionRole())
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
  const activeRole: ExecSessionRole = isAuditor
    ? 'auditor'
    : (gov?.sessionRole ?? domRole ?? 'admin')
  const visibleMobileSections = SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      isErpRouteAllowedForRole(activeRole, item.href),
    ),
  })).filter((section) => section.items.length > 0)
  const dockHomeHref = resolveRoleDefaultHome(activeRole)
  const dockTab2Href =
    activeRole === 'supply' ? '/erp/warehouse-chain' : '/erp/cores'
  const dockTab4Href =
    activeRole === 'marketing'
      ? '/erp/cores'
      : activeRole === 'supply'
        ? '/erp/warehouse-chain'
        : '/erp/aggregator-radar'

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

  const homeActive =
    !sheetOpen &&
    (pathname === dockHomeHref ||
      (dockHomeHref !== '/erp' && pathname.startsWith(`${dockHomeHref}/`)))
  const salesActive =
    !sheetOpen && (pathname === dockTab2Href || pathname.startsWith(`${dockTab2Href}/`))
  const feryalActive =
    !sheetOpen &&
    (pathname === '/erp/feryal-ai' ||
      pathname === '/erp/feryal' ||
      pathname.startsWith('/erp/feryal'))
  const opsActive =
    !sheetOpen &&
    (pathname === dockTab4Href || pathname.startsWith(`${dockTab4Href}/`))
  const isSecondaryErpModule =
    pathname.startsWith('/erp/') &&
    !PRIMARY_DOCK_ROUTES.has(pathname) &&
    !pathname.startsWith('/erp/cores/') &&
    !pathname.startsWith('/erp/feryal') &&
    !pathname.startsWith('/erp/warehouse-chain') &&
    !pathname.startsWith('/erp/aggregator-radar')
  const menuActive = sheetOpen || isSecondaryErpModule

  return (
    <>
      {/* Full 13-Page Categorized Navigation Bottom Sheet */}
      {sheetOpen ? (
        <>
          <div
            aria-hidden
            onClick={() => setSheetOpen(false)}
            className="ae-sheet-backdrop no-print fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs lg:hidden"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={isAr ? 'جميع أقسام النظام التنفيذي (13 شاشة)' : 'All 13 Executive ERP Modules'}
            dir={isAr ? 'rtl' : 'ltr'}
            className="ae-bottom-sheet no-print fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[28px] bg-white/95 p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] backdrop-blur-xl shadow-[0_-14px_44px_-10px_rgba(15,23,42,0.16)] ring-1 ring-slate-400/25 sm:p-5 sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:hidden dark:bg-[#0F1A30]/95 dark:shadow-[0_-14px_44px_-10px_rgba(2,6,23,0.72)] dark:ring-sky-400/20"
          >
            <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-slate-300/80 dark:bg-sky-300/20" />

            {/* Sheet Header + ThemeToggle + AR/EN */}
            <div className="flex items-center justify-between gap-1.5 pb-3">
              <div className="min-w-0">
                <h2 className="whitespace-nowrap text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                  {isAr ? 'فنتشر فودز' : 'Venture Foods'}
                </h2>
                <p className="whitespace-nowrap text-[13px] font-medium text-slate-600 dark:text-slate-300">
                  {isAr ? '6 علامات تجارية · 7 فروع · 8 قنوات' : '6 Brands · 7 Branches · 8 Channels'}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <ThemeToggle className="h-8 !gap-1 !px-2.5 text-xs" />

                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'}
                  className="v35-focus-ring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-blue-50/80 text-slate-600 ring-1 ring-slate-400/20 transition-colors hover:bg-blue-100/80 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-white/[0.08] dark:text-slate-200 dark:ring-white/10 dark:hover:bg-sky-400/15 dark:hover:text-white dark:focus-visible:ring-sky-400/60"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Manager PIN Session / Auditor Read-Only Status & Bell Bar */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-blue-50/75 px-3.5 py-2.5 backdrop-blur-sm ring-1 ring-slate-400/20 dark:bg-[#13203B]/80 dark:ring-sky-400/20">
              {isAuditor ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-slate-300" />
                  <span>{isAr ? 'حساب مراجعة — قراءة فقط' : 'Read-Only Auditor'}</span>
                </div>
              ) : activeSession.active ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-sky-300">
                  <Unlock className="h-3.5 w-3.5 shrink-0" />
                  <span>{isAr ? 'وضع المدير نشط 🔓' : 'Manager Active 🔓'}</span>
                  <span
                    dir="ltr"
                    className="rounded-full bg-blue-100/90 px-2 py-0.5 font-mono text-xs tabular-nums text-blue-900 dark:bg-sky-400/20 dark:text-sky-100"
                  >
                    {formatSessionTimer(activeSession.remainingSeconds)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-sky-400" />
                  <span>{isAr ? 'صلاحية اعتماد المدير' : 'Manager PIN Session'}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                {pathname.startsWith('/erp') ? (
                  <button
                    type="button"
                    onClick={handleOpenGovBell}
                    aria-label={isAr ? 'الإشعارات والاعتمادات' : 'Notifications and approvals'}
                    className="v35-focus-ring inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-white/85 px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-400/25 transition-colors hover:bg-blue-50 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-[#0F1A30]/90 dark:text-slate-200 dark:ring-sky-400/20 dark:hover:bg-sky-400/15 dark:focus-visible:ring-sky-400/60"
                  >
                    <Bell className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
                    <span dir="ltr" className="font-bold tabular-nums">
                      {badgeCount}
                    </span>
                  </button>
                ) : null}

                {isAuditor ? (
                  <span className="inline-flex h-9 items-center gap-1 rounded-full bg-slate-100/90 px-3 text-xs font-bold text-slate-800 ring-1 ring-slate-400/30 dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-400/25">
                    <Lock className="h-3 w-3 shrink-0" />
                    <span>{isAr ? 'وضع المراجعة — قراءة فقط' : 'Read-Only'}</span>
                  </span>
                ) : activeSession.active ? (
                  <button
                    type="button"
                    onClick={handleLockPin}
                    className="v35-focus-ring inline-flex h-9 cursor-pointer items-center gap-1 rounded-full bg-white/85 px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-400/25 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-[#0F1A30]/90 dark:text-slate-200 dark:ring-sky-400/25 dark:hover:bg-white/[0.08] dark:focus-visible:ring-sky-400/60"
                  >
                    <span>{isAr ? 'قفل الصلاحية 🔒' : 'Lock 🔒'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleUnlockPin}
                    className="btn-colored v35-focus-ring inline-flex h-9 cursor-pointer items-center gap-1 rounded-full bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-[0_4px_14px_-4px_rgba(37,99,235,0.42)] transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-sky-400 dark:text-[#081226] dark:hover:bg-sky-300 dark:focus-visible:ring-sky-400/60"
                  >
                    <span>{isAr ? 'فتح الصلاحية 🔓' : 'Unlock PIN 🔓'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Scoped ERP Pages Grouped Under Executive Categories */}
            <div className="space-y-4">
              {visibleMobileSections.map((section) => (
                <div key={section.id} className="space-y-1.5">
                  <div className="px-1 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
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
                          className={`v35-focus-ring flex items-center justify-between gap-2.5 rounded-2xl px-3.5 py-2.5 text-[13px] transition-all duration-[160ms] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60 ${
                            active
                              ? 'bg-blue-50/95 font-bold text-blue-950 ring-1 ring-blue-500/35 shadow-[0_4px_14px_-6px_rgba(37,99,235,0.22)] dark:bg-sky-400/15 dark:text-sky-100 dark:ring-sky-400/35'
                              : 'bg-blue-50/45 font-medium text-slate-700 ring-1 ring-slate-400/15 hover:bg-blue-50/85 hover:text-slate-950 dark:bg-white/[0.04] dark:text-slate-200 dark:ring-white/[0.08] dark:hover:bg-sky-400/10'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                                active
                                  ? 'btn-colored bg-blue-600 text-white shadow-[0_4px_10px_-3px_rgba(37,99,235,0.45)] dark:bg-sky-400 dark:text-[#081226]'
                                  : 'bg-white/90 text-blue-600 ring-1 ring-slate-400/20 dark:bg-[#0F1A30] dark:text-sky-300 dark:ring-sky-400/20'
                              }`}
                            >
                              <Icon size={16} />
                            </span>
                            <span className="truncate">{isAr ? item.labelAr : item.labelEn}</span>
                          </span>
                          {active ? (
                            <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-sky-300" />
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
        className="ae-mobile-dock no-print fixed inset-x-2 bottom-2 z-40 rounded-[26px] bg-white/85 pb-[env(safe-area-inset-bottom)] shadow-[0_12px_32px_-8px_rgba(15,23,42,0.16)] ring-1 ring-slate-400/25 backdrop-blur-xl lg:hidden dark:bg-[#0D162A]/90 dark:shadow-[0_12px_34px_-8px_rgba(2,6,23,0.72)] dark:ring-sky-400/20"
      >
        <div className="grid h-16 grid-cols-5 items-center gap-0.5 px-1.5">
          {/* 1) Home -> role default home */}
          <Link
            href={dockHomeHref}
            aria-current={homeActive ? 'page' : undefined}
            className={`v35-focus-ring flex flex-col items-center justify-center gap-1 rounded-2xl py-1.5 text-xs transition-all duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60 ${
              homeActive
                ? 'bg-blue-50/90 font-bold text-blue-700 ring-1 ring-blue-500/20 dark:bg-sky-400/15 dark:text-sky-300 dark:ring-sky-400/25'
                : 'font-medium text-slate-600 hover:bg-blue-50/50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="truncate">
              {activeRole === 'supply'
                ? isAr
                  ? 'المخزن'
                  : 'Supply'
                : isAr
                  ? 'الرئيسية'
                  : 'Home'}
            </span>
          </Link>

          {/* 2) Sales / Delivery SLA -> role-scoped tab 2 */}
          <Link
            href={dockTab2Href}
            aria-current={salesActive ? 'page' : undefined}
            className={`v35-focus-ring flex flex-col items-center justify-center gap-1 rounded-2xl py-1.5 text-xs transition-all duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60 ${
              salesActive
                ? 'bg-blue-50/90 font-bold text-blue-700 ring-1 ring-blue-500/20 dark:bg-sky-400/15 dark:text-sky-300 dark:ring-sky-400/25'
                : 'font-medium text-slate-600 hover:bg-blue-50/50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
            }`}
          >
            <TrendingUp className="h-5 w-5" />
            <span className="truncate">
              {activeRole === 'supply'
                ? isAr
                  ? 'المخزن'
                  : 'Warehouse'
                : isAr
                  ? 'المبيعات'
                  : 'Sales'}
            </span>
          </Link>

          {/* 3) Feryal (Elevated Center Cobalt/Sky Pill Accent) -> /erp/feryal-ai */}
          <Link
            href="/erp/feryal-ai"
            aria-current={feryalActive ? 'page' : undefined}
            className="v35-focus-ring flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60"
          >
            <span
              className={`btn-colored flex h-9 w-12 items-center justify-center rounded-full bg-gradient-to-br transition-all duration-[160ms] active:scale-95 ${
                feryalActive
                  ? 'from-blue-700 via-blue-600 to-sky-500 text-white shadow-[0_6px_16px_rgba(37,99,235,0.45)] ring-2 ring-blue-400/40 dark:from-sky-400 dark:via-sky-400 dark:to-blue-400 dark:text-[#081226] dark:ring-sky-300/45'
                  : 'from-blue-700 via-blue-600 to-blue-500 text-white shadow-[0_4px_12px_rgba(37,99,235,0.32)] dark:from-sky-500 dark:to-blue-600 dark:text-white'
              }`}
            >
              <Sparkles className="h-5 w-5" />
            </span>
            <span
              className={`truncate ${
                feryalActive
                  ? 'font-bold text-blue-700 dark:text-sky-300'
                  : 'font-semibold text-slate-600 dark:text-slate-300'
              }`}
            >
              {isAr ? 'فريال' : 'Feryal'}
            </span>
          </Link>

          {/* 4) Ops / Reviews -> role-scoped tab 4 */}
          <Link
            href={dockTab4Href}
            aria-current={opsActive ? 'page' : undefined}
            className={`v35-focus-ring flex flex-col items-center justify-center gap-1 rounded-2xl py-1.5 text-xs transition-all duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60 ${
              opsActive
                ? 'bg-blue-50/90 font-bold text-blue-700 ring-1 ring-blue-500/20 dark:bg-sky-400/15 dark:text-sky-300 dark:ring-sky-400/25'
                : 'font-medium text-slate-600 hover:bg-blue-50/50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
            }`}
          >
            <Activity className="h-5 w-5" />
            <span className="truncate">
              {activeRole === 'marketing'
                ? isAr
                  ? 'المبيعات'
                  : 'Sales'
                : activeRole === 'supply'
                  ? isAr
                    ? 'المخزن'
                    : 'Warehouse'
                  : isAr
                    ? 'العمولات'
                    : 'Fees'}
            </span>
          </Link>

          {/* 5) Menu -> Opens Full 13-Page Categorized Navigation Sheet */}
          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            aria-expanded={sheetOpen}
            aria-label={isAr ? 'فتح جميع الأقسام (13 شاشة)' : 'Open All 13 Modules'}
            className={`v35-focus-ring flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl py-1.5 text-xs transition-all duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60 ${
              menuActive
                ? 'bg-blue-50/90 font-bold text-blue-700 ring-1 ring-blue-500/20 dark:bg-sky-400/15 dark:text-sky-300 dark:ring-sky-400/25'
                : 'font-medium text-slate-600 hover:bg-blue-50/50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
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
