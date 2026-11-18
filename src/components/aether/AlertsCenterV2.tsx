'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BellRing,
  ExternalLink,
  FileText,
  RefreshCw,
  ShieldAlert,
  Snowflake,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatDateTime,
  formatInt,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import {
  isVerifiedOdooGovernanceBreach,
  type ComplianceBreachItem,
  type GovernanceAdminThresholds,
} from '@/lib/governance-compliance'
import { useOptionalGovernance } from '@/components/erp/GovernanceBellDrawer'
import { KpiCard } from '@/components/ui/kpi-card'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'

export type AlertsCenterPhase = 'loading' | 'error' | 'unlinked' | 'empty' | 'ready'

export interface AlertsCenterV2Props {
  locale?: FormatLocale
  initialState?: AlertsCenterPhase
  initialBreaches?: ComplianceBreachItem[]
  initialUpdatedAtIso?: string | null
  initialHasThresholds?: boolean
}

function hasAnyEnabledThreshold(thresholds?: GovernanceAdminThresholds | null): boolean {
  if (!thresholds) return false
  return Boolean(
    (thresholds.posDiscountPctCap?.enabled &&
      Number.isFinite(thresholds.posDiscountPctCap.thresholdValue)) ||
      (thresholds.supplierOrderTotalCapKwd?.enabled &&
        Number.isFinite(thresholds.supplierOrderTotalCapKwd.thresholdValue)) ||
      (thresholds.aggregatorCommissionPctCap?.enabled &&
        Number.isFinite(thresholds.aggregatorCommissionPctCap.thresholdValue)),
  )
}

function AlertsCenterV2Body({
  locale,
  initialState,
  initialBreaches,
  initialUpdatedAtIso = null,
  initialHasThresholds,
}: Omit<AlertsCenterV2Props, 'locale'> & { locale: FormatLocale }) {
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const unavailableTooltip = getUnavailableTooltip(locale)
  const gov = useOptionalGovernance()

  const [phase, setPhase] = useState<AlertsCenterPhase>(() => {
    if (initialState) return initialState
    if (initialBreaches && initialBreaches.length > 0) return 'ready'
    return 'loading'
  })
  const [breaches, setBreaches] = useState<ComplianceBreachItem[]>(
    () => (initialBreaches ?? []).filter((row) => isVerifiedOdooGovernanceBreach(row)),
  )
  const [updatedAtIso, setUpdatedAtIso] = useState<string | null>(initialUpdatedAtIso)
  const [hasThresholds, setHasThresholds] = useState<boolean>(
    initialHasThresholds ?? hasAnyEnabledThreshold(gov?.store?.adminThresholds),
  )
  const [refreshing, setRefreshing] = useState(false)

  const fetchAlerts = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/erp/governance', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal,
      })
      if (!res.ok) {
        setPhase('error')
        return
      }
      const data = (await res.json()) as {
        breaches?: ComplianceBreachItem[]
        updatedAtIso?: string | null
        store?: { adminThresholds?: GovernanceAdminThresholds }
      }
      const verified = Array.isArray(data.breaches)
        ? data.breaches.filter((row) => isVerifiedOdooGovernanceBreach(row))
        : []
      const configured = hasAnyEnabledThreshold(data.store?.adminThresholds)
      setBreaches(verified)
      setHasThresholds(configured)
      setUpdatedAtIso(typeof data.updatedAtIso === 'string' ? data.updatedAtIso : null)
      if (verified.length > 0) {
        setPhase('ready')
      } else if (configured) {
        setPhase('empty')
      } else {
        setPhase('unlinked')
      }
    } catch (caught: unknown) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setPhase('error')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (initialState !== undefined) return
    const controller = new AbortController()
    void fetchAlerts(controller.signal)
    return () => controller.abort()
  }, [fetchAlerts, initialState])

  const totalImpactKwd = breaches.reduce(
    (sum, item) => (Number.isFinite(item.monthlyLeakKwd) ? sum + item.monthlyLeakKwd : sum),
    0,
  )
  const frozenCount = breaches.filter((item) => item.frozen).length
  const formattedSync = updatedAtIso
    ? formatDateTime(updatedAtIso, { locale, showZone: true })
    : UNAVAILABLE_DASH

  const refreshButton = (
    <button
      type="button"
      onClick={() => void fetchAlerts()}
      disabled={refreshing}
      aria-label={isAr ? 'تحديث التنبيهات من Odoo' : 'Refresh alerts from Odoo'}
      className="ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-300/90 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-100 dark:hover:bg-white/[0.06]"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
      <span>{isAr ? 'تحديث التنبيهات' : 'Refresh Alerts'}</span>
    </button>
  )

  return (
    <div dir={dir} className="mx-auto w-full max-w-[1920px] min-w-0 space-y-5 p-3.5 sm:p-5">
      <SectionCard
        locale={locale}
        icon={<BellRing className="h-4 w-4" aria-hidden />}
        title={isAr ? 'مركز التنبيهات المالية الآلية' : 'Automated Financial Alerts Center'}
        subtitle={
          isAr
            ? 'تقييم فوري لسقوف الصرف والخصومات والعمولات المعتمدة من مسؤول النظام مقابل قيود Odoo 17'
            : 'Real-time evaluation of admin-approved spend, discount, and commission thresholds against Odoo 17 records'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              dir="ltr"
              title={!updatedAtIso ? unavailableTooltip : undefined}
              className="ds-num inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-[#141F1B] dark:text-slate-200"
            >
              <span>{formattedSync}</span>
            </span>
            {refreshButton}
          </div>
        }
      >
        {phase === 'loading' ? (
          <StateBlock
            state="loading"
            locale={locale}
            skeletonRows={4}
            title={
              isAr
                ? 'جارٍ فحص التنبيهات المالية مقابل Odoo 17…'
                : 'Evaluating financial alerts against Odoo 17…'
            }
          />
        ) : null}

        {phase === 'error' ? (
          <StateBlock
            state="error"
            locale={locale}
            onRetry={() => void fetchAlerts()}
            title={
              isAr
                ? 'تعذّر جلب التنبيهات المالية حالياً'
                : 'Unable to load financial alerts right now'
            }
            description={
              isAr
                ? 'حدث خلل مؤقت أثناء التواصل مع خادم الحوكمة. يرجى إعادة المحاولة.'
                : 'A temporary issue occurred while querying governance alerts. Please retry.'
            }
          />
        ) : null}

        {phase === 'unlinked' ? (
          <StateBlock
            state="empty"
            locale={locale}
            title={
              isAr
                ? 'لا توجد سقوف أو تجاوزات محفوظة من الإدارة'
                : 'No admin thresholds or breaches are saved'
            }
            description={
              isAr
                ? 'التنبيهات تظهر فقط عندما يحفظ مسؤول النظام سقوفاً على خدمة الحوكمة وتتحقق مقابل استعلامات أودو.'
                : 'Alerts appear only after an admin saves governance thresholds that are checked against Odoo.'
            }
          />
        ) : null}

        {phase === 'empty' ? (
          <StateBlock
            state="empty"
            locale={locale}
            title={
              isAr
                ? 'لا توجد تجاوزات مالية نشطة حالياً'
                : 'No active financial threshold breaches'
            }
            description={
              hasThresholds
                ? isAr
                  ? 'جميع استعلامات Odoo 17 ضمن السقوف الإدارية المعتمدة على الخادم.'
                  : 'All Odoo 17 queries are currently within admin-configured server thresholds.'
                : isAr
                  ? 'لا توجد تنبيهات مسجلة في الفترة المحددة.'
                  : 'No alerts recorded for the selected window.'
            }
          />
        ) : null}

        {phase === 'ready' ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KpiCard
                locale={locale}
                label={isAr ? 'التنبيهات النشطة' : 'Active Alerts'}
                value={breaches.length}
                format="int"
                icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
              />
              <KpiCard
                locale={locale}
                label={isAr ? 'الأثر المالي الشهري المقدر' : 'Estimated Monthly Impact'}
                value={totalImpactKwd}
                format="kwd"
                higherIsBetter={false}
                icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
              />
              <KpiCard
                locale={locale}
                label={isAr ? 'بنود الصرف المجمّدة' : 'Frozen Spend Orders'}
                value={frozenCount}
                format="int"
                icon={<Snowflake className="h-4 w-4" aria-hidden />}
              />
            </div>

            <div className="space-y-3">
              {breaches.map((breach) => (
                <article
                  key={breach.id}
                  className="ds-surface-subtle space-y-3 rounded-2xl p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        dir="ltr"
                        className="rounded-lg bg-rose-600 px-2.5 py-0.5 font-mono text-xs font-bold text-white"
                      >
                        {breach.odooModel}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          breach.severity === 'critical'
                            ? 'bg-rose-100 text-rose-900 dark:bg-rose-950/70 dark:text-rose-200'
                            : 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200'
                        }`}
                      >
                        {breach.severity === 'critical'
                          ? isAr
                            ? 'حرج'
                            : 'Critical'
                          : isAr
                            ? 'مرتفع'
                            : 'High'}
                      </span>
                      {breach.frozen ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-900 dark:bg-sky-950/70 dark:text-sky-200">
                          <Snowflake className="h-3 w-3" aria-hidden />
                          <span>{isAr ? 'مجمّد' : 'Frozen'}</span>
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        dir="ltr"
                        className="ds-num font-semibold text-slate-600 dark:text-slate-300"
                      >
                        {formatDate(breach.period.from, locale)} →{' '}
                        {formatDate(breach.period.to, locale)}
                      </span>
                      <span
                        dir="ltr"
                        className="ds-num rounded-lg bg-rose-100 px-2.5 py-1 font-bold text-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
                      >
                        {formatKwd(breach.monthlyLeakKwd, { locale })}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
                    {isAr ? breach.breachHeadlineAr : breach.breachHeadlineEn}
                  </h3>

                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {isAr ? breach.odooMetricProofAr : breach.odooMetricProofEn}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3 text-xs dark:border-white/10">
                    <span className="font-semibold text-rose-800 dark:text-rose-300">
                      {isAr ? breach.approvedRuleLimitAr : breach.approvedRuleLimitEn}
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {breach.frozenAtIso ? (
                        <span
                          dir="ltr"
                          className="ds-num text-slate-600 dark:text-slate-300"
                        >
                          {formatDateTime(breach.frozenAtIso, { locale, showZone: true })}
                        </span>
                      ) : null}

                      {breach.href ? (
                        <Link
                          href={breach.href}
                          className="ds-focus-ring inline-flex items-center gap-1 rounded-lg border border-slate-300/80 bg-white px-2.5 py-1.5 font-semibold text-slate-800 hover:bg-slate-50 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-100"
                        >
                          <span>{isAr ? 'فتح التحليل' : 'Open Analysis'}</span>
                        </Link>
                      ) : null}

                      {breach.odooRecordUrl ? (
                        <a
                          href={breach.odooRecordUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ds-focus-ring inline-flex items-center gap-1 rounded-lg border border-emerald-600/30 bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-950/50 dark:text-emerald-200"
                        >
                          <span>{isAr ? 'سجل Odoo' : 'Odoo Record'}</span>
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      ) : null}

                      {gov && !gov.isAuditor && !breach.frozen ? (
                        <button
                          type="button"
                          onClick={() => gov.freezeBreachWithPin(breach, false)}
                          className="ds-focus-ring inline-flex cursor-pointer items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 font-semibold text-white hover:bg-rose-700"
                        >
                          <Snowflake className="h-3.5 w-3.5" aria-hidden />
                          <span>{isAr ? 'تجميد الصرف' : 'Freeze Spend'}</span>
                        </button>
                      ) : null}

                      {gov ? (
                        <button
                          type="button"
                          onClick={() => gov.openBreachStopCircularPrint(breach)}
                          className="ds-focus-ring inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300/80 bg-white px-2.5 py-1.5 font-semibold text-slate-800 hover:bg-slate-50 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-100"
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden />
                          <span>{isAr ? 'تعميم الإيقاف' : 'Stop Circular'}</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              {isAr
                ? `إجمالي التنبيهات الموثقة من Odoo 17: ${formatInt(breaches.length, locale)}`
                : `Total verified Odoo 17 alerts: ${formatInt(breaches.length, locale)}`}
            </p>
          </div>
        ) : null}
      </SectionCard>
    </div>
  )
}

function AlertsCenterV2I18n(props: Omit<AlertsCenterV2Props, 'locale'>) {
  const { locale } = useI18n()
  return <AlertsCenterV2Body {...props} locale={locale === 'en' ? 'en' : 'ar'} />
}

export function AlertsCenterV2({ locale: explicitLocale, ...rest }: AlertsCenterV2Props) {
  if (explicitLocale !== undefined) {
    return <AlertsCenterV2Body {...rest} locale={explicitLocale} />
  }
  return <AlertsCenterV2I18n {...rest} />
}

export default AlertsCenterV2
