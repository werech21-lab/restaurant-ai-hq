'use client'

import { useId } from 'react'
import { Activity, Building2, Lock, ShieldCheck } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

/**
 * Crisp inline vector Venture Foods emerald brand emblem (`#059669` -> `#064E3B`, unique `useId()` defs so multiple instances never collide across responsive breakpoints).
 */
export function VentureFoodsEmblem({ className = 'h-11 w-11' }: { className?: string }) {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const gradId = `vf-emblem-bg-${rawId}`

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#064E3B" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="#059669" />
      <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${gradId})`} />
      <rect
        x="2.75"
        y="2.75"
        width="42.5"
        height="42.5"
        rx="12.25"
        stroke="#FFFFFF"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />
      <path
        d="M12.2 16.5L19.6 32.5L26.2 18.4"
        stroke="#FFFFFF"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M25.5 32.5V16.5H35.8M25.5 24.2H33.5"
        stroke="#FFFFFF"
        strokeWidth="3.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="35.6" cy="31.5" r="2.3" fill="#6EE7B7" />
    </svg>
  )
}

export function LoginHero() {
  const { t, companyName, locale } = useI18n()
  const isAr = locale === 'ar'

  return (
    <section className="relative hidden min-w-0 items-center justify-center overflow-hidden border-s border-slate-200/80 bg-[#0B141B] px-8 py-10 text-slate-100 xl:px-14 lg:flex dark:border-white/[0.07]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(16,185,129,0.16),transparent_52%),radial-gradient(ellipse_at_85%_85%,rgba(14,165,233,0.10),transparent_48%)]" />

      <div className="relative z-10 w-full max-w-xl min-w-0 rounded-3xl border border-white/10 bg-white/[0.035] p-8 shadow-2xl backdrop-blur-md xl:p-9">
        {/* Top Release Pill */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tabular-nums text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>Aether BI v2.8 Enterprise</span>
          </span>
        </div>

        {/* Brand Identity Lockup with Inline Emerald Vector SVG Emblem */}
        <div className="mt-6 flex items-center gap-4">
          <VentureFoodsEmblem className="h-14 w-14 shrink-0 drop-shadow-md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold tracking-wider uppercase text-emerald-400" dir="ltr">
                Venture Foods
              </span>
              <span className="text-white/25" aria-hidden>
                •
              </span>
              <span className="text-xs font-medium text-slate-300">Odoo 17 Live ERP</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold leading-snug tracking-tight text-white xl:text-[26px]">
              {companyName}
            </h1>
          </div>
        </div>

        {/* Official Unified Executive Scope Statement */}
        <p className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-950/35 px-4 py-3 text-[13px] font-semibold leading-relaxed text-emerald-100">
          {isAr
            ? 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م • 6 مطاعم • 7 فروع • 8 قنوات • منصة إيثر لذكاء الأعمال والحوكمة المرتبطة بأودو 17'
            : 'Venture Foods Restaurants Co. W.L.L. • 6 Brands • 7 Branches • 8 Channels • Aether BI & Governance Platform Connected to Odoo 17'}
        </p>

        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          {t('login.heroLead')}
        </p>

        {/* Balanced 2x2 Executive Platform & Security Pillars */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
              <span>{t('login.coverage')}</span>
            </div>
            <p className="mt-1.5 text-sm font-bold tabular-nums text-emerald-300">
              {isAr
                ? '6 مطاعم • 7 فروع • 8 قنوات'
                : '6 Brands • 7 Branches • 8 Channels'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Activity className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
              <span>{t('login.currency')}</span>
            </div>
            <p className="mt-1.5 text-sm font-bold tabular-nums text-slate-100">
              {t('login.currencyVal')}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
              <span>{isAr ? 'الرقابة المالية ومطابقة أودو 17' : 'Odoo 17 Ledger & POS Audit'}</span>
            </div>
            <p className="mt-1.5 text-xs font-semibold leading-relaxed text-slate-200">
              {isAr
                ? 'مطابقة لحظية لدفتر الأستاذ ونقاط البيع والذمم عبر 7 فروع'
                : 'Zero-gap general ledger, POS & aggregator reconciliation'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
              <span>{isAr ? 'حوكمة الصلاحيات والأختام الرقمية' : 'RBAC & Digital Executive Seals'}</span>
            </div>
            <p className="mt-1.5 text-xs font-semibold leading-relaxed text-slate-200">
              {isAr
                ? 'صلاحيات معزولة للإدارة التنفيذية وحساب المراجعة للقراءة فقط'
                : 'Role-isolated executive seals & strict read-only auditor access'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
