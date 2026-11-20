'use client'

/**
 * /erp/decisions — Decision Room.
 *
 * Turns live read-only Odoo telemetry and the advisor council's findings into executive decisions:
 * an executive summary, ranked decision cards with verified Odoo evidence (`Odoo Verified Actual`)
 * and mathematical simulation impacts (`Deterministic Simulation`), Approve / Test / Dismiss actions,
 * a persisted decision log with measured before/after outcomes, and browser-side Odoo analytical views.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { ADVISOR_LABEL, estimateValue, evidenceValue, syncLabel } from '@/components/aether/TodaysDiscoveries'
import { useLang } from '@/components/aether/ui'
import { localizeOdooModelAr } from '@/components/erp/KpiProvenanceBadge'
import { StateBlock } from '@/components/ui/state-block'
import {
  buildLiveDecisionSnapshotFromSummary,
  fetchDecisionSwr,
  peekDecisionSwrCache,
  writeDecisionSwrCache,
} from '@/lib/aether/live-decision-generator'
import { branchKpis, weekdayMatrix } from '@/lib/council/advisors/benchmark'
import { contributions, driverWindows } from '@/lib/council/advisors/drivers'
import { detectAnomalies, forecastNext7, marketWideDays } from '@/lib/council/advisors/forecast'
import { splitOrdersAov } from '@/lib/council/analytics'
import type { DecisionRecord, DecisionStatus } from '@/lib/council/decisions'
import type { ExecutiveSummary } from '@/lib/council/executive-summary'
import { WEEKDAY_AR, WEEKDAY_EN, branchLabel, kuwaitDayOf } from '@/lib/council/helpers'
import { findingImpactScore } from '@/lib/council/runner'
import { completedDailyByBranch } from '@/lib/council/series'
import type { AdvisorId, AdvisorReport, CouncilFinding } from '@/lib/council/types'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'

export type DecisionRoomTab = 'all' | 'drivers' | 'menu' | 'benchmark' | 'forecast' | 'log'

const TAB_ADVISORS: Record<Exclude<DecisionRoomTab, 'all' | 'log'>, AdvisorId[]> = {
  drivers: ['drivers', 'cfo', 'delivery'],
  menu: ['menu'],
  benchmark: ['benchmark'],
  forecast: ['forecast', 'seasons'],
}

const STATUS_LABEL: Record<DecisionStatus, { ar: string; en: string; cls: string }> = {
  accepted: {
    ar: 'معتمد',
    en: 'Approved',
    cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/20',
  },
  testing: {
    ar: 'قيد الاختبار',
    en: 'Testing',
    cls: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-400/20',
  },
  rejected: {
    ar: 'مستبعد',
    en: 'Dismissed',
    cls: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15',
  },
}

const PENDING_STATUS_CLS =
  'bg-indigo-50 text-indigo-800 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-200 dark:ring-indigo-400/20'

const CARD =
  'relative overflow-visible rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03] dark:border-white/10 dark:bg-white/[0.04] dark:ring-white/5'
const fmt = (n: number, d = 3) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const signed = (n: number, d = 1) => `${n > 0 ? '+' : ''}${n.toFixed(d)}`

const ESTIMATE_INPUT_KEY_AR: Record<string, string> = {
  top_branch_kwd: 'أعلى فرع (د.ك)',
  lowest_branch_kwd: 'أقل فرع نشط (د.ك)',
  peer_median_kwd: 'وسيط الفروع (د.ك)',
  gap_kwd: 'الفجوة (د.ك)',
  period_days: 'أيام الفترة',
  aggregator_kwd: 'مبيعات المنصات (د.ك)',
  direct_kwd: 'المبيعات المباشرة (د.ك)',
  posted_commissions_kwd: 'العمولات المرحّلة (د.ك)',
  quiet_hours_kwd: 'مبيعات الساعات الهادئة (د.ك)',
  total_hourly_kwd: 'إجمالي السلاسل الساعية (د.ك)',
  afternoon_30d_pool_kwd: 'وعاء فترة ما بعد الظهر (د.ك)',
  open_debits_kwd: 'الذمم المدينة المفتوحة (د.ك)',
  overdue_over_30d_kwd: 'الذمم المتأخرة فوق 30 يوماً (د.ك)',
  unapplied_credits_abs_kwd: 'الأرصدة الدائنة غير المطبّقة (د.ك)',
  tier_a_kwd: 'مبيعات الفئة أ (د.ك)',
  tier_c_kwd: 'مبيعات الفئة ج (د.ك)',
  tier_a_skus: 'عدد أصناف الفئة أ',
  tier_c_skus: 'عدد أصناف الفئة ج',
  unattributed_kwd: 'المبيعات غير المنسوبة (د.ك)',
  peerMedianTicketKwd: 'وسيط فاتورة الفروع (د.ك)',
  branchTicketKwd: 'متوسط فاتورة الفرع (د.ك)',
  weeklyOrders: 'الطلبات الأسبوعية',
  closeShare: 'نسبة تقليص الفجوة',
  priorWeekNetKwd: 'صافي الأسبوع الأسبق (د.ك)',
  lastWeekNetKwd: 'صافي الأسبوع الماضي (د.ك)',
  recoveryShare: 'نسبة الاسترداد',
  ordersLast28: 'طلبات آخر 28 يوماً',
  priorAovKwd: 'متوسط الفاتورة السابق (د.ك)',
  currentAovKwd: 'متوسط الفاتورة الحالي (د.ك)',
  ticketDropKwd: 'تراجع الفاتورة (د.ك)',
  siblingIndexPct: 'مؤشر الفروع الأخرى (%)',
  branchIndexPct: 'مؤشر الفرع (%)',
  branchAverageDayKwd: 'متوسط يوم الفرع (د.ك)',
  branchDaySharePct: 'حصة يوم الفرع (%)',
  companyHourKwd: 'صافي ساعة الشركة (د.ك)',
  branchHourKwd: 'صافي ساعة الفرع (د.ك)',
  days: 'عدد الأيام',
  priorNetKwd: 'الصافي السابق (د.ك)',
  currentNetKwd: 'الصافي الحالي (د.ك)',
  pauseHours: 'ساعات التوقف',
  lostKwd: 'المبيعات المفقودة (د.ك)',
  weeks: 'عدد الأسابيع',
  historyWeeks: 'أسابيع المقارنة',
  weeklyLostKwd: 'الفاقد الأسبوعي (د.ك)',
  weeklyDropKwd: 'التراجع الأسبوعي (د.ك)',
  segmentDeltaKwd: 'تغيّر القسم (د.ك)',
  windowDays: 'أيام الفترة',
  normalKwd: 'المعتاد (د.ك)',
  actualKwd: 'الفعلي (د.ك)',
  lastWeekActualKwd: 'فعلي الأسبوع الماضي (د.ك)',
  mapePct: 'متوسط نسبة خطأ الاختبار (%)',
  wapePct: 'الخطأ المرجّح (%)',
  overtimeHours: 'ساعات العمل الإضافي',
  standardShiftHours: 'ساعات الوردية المعيارية',
  weeklyOvertimeHours: 'الإضافي الأسبوعي (ساعة)',
  reductionShare: 'نسبة الخفض',
  weeklyQty: 'الكمية الأسبوعية',
  avgPriceKwd: 'متوسط السعر (د.ك)',
  priceStepKwd: 'خطوة السعر (د.ك)',
  elasticity: 'معامل المرونة',
  thresholdSharePct: 'حصة العتبة (%)',
  dishSharePct: 'حصة الصنف (%)',
  totalQty: 'إجمالي الكمية',
  weeklyDiscountKwd: 'الخصم الأسبوعي (د.ك)',
  retainedShare: 'نسبة الاحتفاظ',
  windowPerDayKwd: 'صافي اليوم بالمناسبة (د.ك)',
  baselinePerDayKwd: 'صافي اليوم المرجعي (د.ك)',
  eventDays: 'أيام المناسبة',
}

export function localizeEstimateInputKeyAr(key: string): string {
  const exact = ESTIMATE_INPUT_KEY_AR[key]
  if (exact) return exact
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\bkwd\b/gi, 'د.ك')
    .replace(/\bpct\b/gi, '%')
    .replace(/\bweekly\b/gi, 'أسبوعي')
    .replace(/\bnet\b/gi, 'صافي')
    .replace(/\borders?\b/gi, 'الطلبات')
    .replace(/\bdays?\b/gi, 'أيام')
    .replace(/\bhours?\b/gi, 'ساعات')
    .replace(/\bbranch\b/gi, 'الفرع')
    .replace(/\bshare\b/gi, 'الحصة')
    .trim()
}

export function localizeEstimateFormulaAr(formula: string): string {
  const trimmed = formula.trim()
  if (!trimmed) return ''
  if (/[\u0600-\u06FF]/.test(trimmed) && !/[A-Za-z]/.test(trimmed)) {
    return trimmed
  }

  return trimmed
    .replace(/peer_median_([\d.,+-]+)/gi, 'وسيط الفروع $1')
    .replace(/branch_gap_([\d.,+-]+)/gi, 'فجوة الفروع $1')
    .replace(/posted_commissions_([\d.,+-]+)/gi, 'العمولات المرحّلة $1')
    .replace(/aggregator_sales_([\d.,+-]+)/gi, 'مبيعات المنصات $1')
    .replace(/afternoon_30d_pool_([\d.,+-]+)/gi, 'مبيعات فترة ما بعد الظهر $1')
    .replace(/overdue_30d_([\d.,+-]+)/gi, 'الذمم المتأخرة فوق 30 يوماً $1')
    .replace(/open_debits_([\d.,+-]+)/gi, 'الذمم المدينة المفتوحة $1')
    .replace(/abs\(unapplied_credits_([\d.,+-]+)\)/gi, 'القيمة المطلقة للأرصدة الدائنة ($1)')
    .replace(/tier_a_([\d.,+-]+)/gi, 'مبيعات الفئة أ $1')
    .replace(/tier_c_([\d.,+-]+)/gi, 'مبيعات الفئة ج $1')
    .replace(/unattributed_sales_([\d.,+-]+)/gi, 'المبيعات غير المنسوبة $1')
    .replace(/\b(?:360-mall)_([\d.,+-]+)/gi, 'مول 360 ($1)')
    .replace(/\b(?:al-kout)_([\d.,+-]+)/gi, 'الكوت ($1)')
    .replace(/\bavenues_([\d.,+-]+)/gi, 'الأفنيوز ($1)')
    .replace(/\bassima_([\d.,+-]+)/gi, 'العاصمة ($1)')
    .replace(/\bpromenade_([\d.,+-]+)/gi, 'بروميناد ($1)')
    .replace(/\bsalmiya_([\d.,+-]+)/gi, 'السالمية ($1)')
    .replace(/\bardiya_([\d.,+-]+)/gi, 'العارضية ($1)')
    .replace(/(\d+)\s*d\b/gi, '$1 يوم')
    .replace(/\bdirect shift volume\b/gi, 'حجم التحويل للقنوات المباشرة')
    .replace(/\bweekly clearing pace\b/gi, 'وتيرة التسوية الأسبوعية')
    .replace(/\bnet revenue simulation\b/gi, 'محاكاة صافي الإيرادات')
    .replace(/\battributed to branch p&l\b/gi, 'منسوبة لقائمة دخل الفروع')
    .replace(/\bpeer median ticket\b/gi, 'وسيط فاتورة الفروع')
    .replace(/\bbranch ticket\b/gi, 'متوسط فاتورة الفرع')
    .replace(/\bweekly orders\b/gi, 'الطلبات الأسبوعية')
    .replace(/\bprior-week net\b/gi, 'صافي الأسبوع الأسبق')
    .replace(/\blast-week net\b/gi, 'صافي الأسبوع الماضي')
    .replace(/\borders last (\d+) days\b/gi, 'طلبات آخر $1 يوماً')
    .replace(/\bprior average ticket\b/gi, 'متوسط الفاتورة السابق')
    .replace(/\bcurrent average ticket\b/gi, 'متوسط الفاتورة الحالي')
    .replace(/\bticket drop per order\b/gi, 'تراجع الفاتورة لكل طلب')
    .replace(/\bsiblings weekday index\b/gi, 'مؤشر يوم الأسبوع للفروع الأخرى')
    .replace(/\bbranch weekday index\b/gi, 'مؤشر يوم الأسبوع للفرع')
    .replace(/\bsiblings index\b/gi, 'مؤشر الفروع الأخرى')
    .replace(/\bbranch index\b/gi, 'مؤشر الفرع')
    .replace(/\bbranch average day\b/gi, 'متوسط يوم الفرع')
    .replace(/\bbranch day share\b/gi, 'حصة يوم الفرع')
    .replace(/\bcompany hour net\b/gi, 'صافي ساعة الشركة')
    .replace(/\bbranch hour net\b/gi, 'صافي ساعة الفرع')
    .replace(/\bprior net\b/gi, 'الصافي السابق')
    .replace(/\bcurrent net\b/gi, 'الصافي الحالي')
    .replace(
      /Σ over pause hours of median\(same weekday-hour net, last N weeks\)\s*÷\s*weeks in window/gi,
      'مجموع ساعات التوقف لوسيط (صافي نفس اليوم والساعة للأسابيع السابقة) ÷ عدد الأسابيع',
    )
    .replace(/\bweekly lost-sales estimate\b/gi, 'تقدير المبيعات الأسبوعية المفقودة')
    .replace(/\bweekly drop of the segment\b/gi, 'التراجع الأسبوعي للقسم')
    .replace(/\|segment Δ\|/gi, '|تغيّر القسم|')
    .replace(/\bwindow days\b/gi, 'أيام الفترة')
    .replace(/\bnormal\b/gi, 'المعتاد')
    .replace(/\bactual\b/gi, 'الفعلي')
    .replace(/\(one day,\s*flagged branches\)/gi, '(يوم واحد للفروع المتأثرة)')
    .replace(/\(one day\)/gi, '(يوم واحد)')
    .replace(/next-7-day forecast/gi, 'توقع الأيام السبعة القادمة')
    .replace(
      /Σ max\(0,\s*shift hours\s*−\s*(\d+)\)\s*over shifts\s*≤\s*(\d+)\s*h/gi,
      'مجموع الساعات الإضافية فوق $1 ساعات للورديات ≤ $2 ساعة',
    )
    .replace(/\bweekly overtime hours\b/gi, 'ساعات العمل الإضافي الأسبوعية')
    .replace(/\bweekly qty\b/gi, 'الكمية الأسبوعية')
    .replace(/\btotal qty\b/gi, 'إجمالي الكمية')
    .replace(/\bstep%/gi, 'نسبة الزيادة')
    .replace(/\belasticity\b/gi, 'المرونة')
    .replace(/\bthreshold share\b/gi, 'حصة العتبة')
    .replace(/\bdish share\b/gi, 'حصة الصنف')
    .replace(/\bweekly discount on the dish\b/gi, 'الخصم الأسبوعي على الصنف')
    .replace(/\bwindow per-day net\b/gi, 'صافي اليوم بالمناسبة')
    .replace(/\bbaseline per-day net\b/gi, 'صافي اليوم المرجعي')
    .replace(/\bwindow per-day\b/gi, 'صافي اليوم بالمناسبة')
    .replace(/\bbaseline per-day\b/gi, 'صافي اليوم المرجعي')
    .replace(/event days \(max 7\)(?:,\s*previous occurrence)?/gi, 'أيام المناسبة (بحد أقصى 7)')
    .replace(/\bprice\b/gi, 'السعر')
    .replace(/\bdays\b/gi, 'أيام')
    .replace(/\bcogs\b/gi, 'تكلفة البضاعة المباعة')
    .replace(/\brevenue\b/gi, 'الإيرادات')
    .replace(/Σ/g, 'مجموع')
    .replace(/\s+/g, ' ')
    .trim()
}

export function localizeDecisionProseAr(text: string): string {
  if (!text) return text
  return text
    .replace(/\s*\(COGS\)/gi, '')
    .replace(/\s*\(MAPE\)/gi, '')
    .replace(/\s*\(BoM\)/gi, '')
    .replace(/\s*\(check-in\s*\/\s*check-out\)/gi, '')
    .replace(/\s*\(pos\.order\.line\)/gi, '')
    .replace(/\s*\(stock\.quant\)/gi, '')
    .replace(/\s*\(mrp\.bom\)/gi, '')
    .replace(/\s*\(account\.move\.line\)/gi, '')
    .replace(/لـ\s*pos\.payment/gi, 'لمدفوعات نقاط البيع')
    .replace(/كـ\s*stock\.scrap/gi, 'كقيد إتلاف في المخزون')
    .replace(/\bpos\.order\.line\b/gi, 'بنود طلبات نقاط البيع')
    .replace(/\bpos\.order\b/gi, 'طلبات نقاط البيع')
    .replace(/\bpos\.payment\b/gi, 'مدفوعات نقاط البيع')
    .replace(/\baccount\.move\.line\b/gi, 'قيود دفتر الأستاذ العام')
    .replace(/\baccount\.move\b/gi, 'قيود المحاسبة')
    .replace(/\bstock\.quant\b/gi, 'أرصدة المخزون')
    .replace(/\bstock\.scrap\b/gi, 'قيود الإتلاف')
    .replace(/\bstock\.move\b/gi, 'حركات المخزون')
    .replace(/\bmrp\.bom\b/gi, 'قوائم المكونات')
    .replace(/\bhr\.attendance\b/gi, 'سجل الحضور والانصراف')
    .replace(/\bstandard_price\b/gi, 'التكلفة المعيارية')
    .replace(/\bCOGS\b/gi, 'تكلفة البضاعة المباعة')
    .replace(/\bOdoo\b/gi, 'أودو')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function localizeEstimateFormulaEn(formula: string): string {
  const trimmed = formula.trim()
  if (!trimmed || !/[\u0600-\u06FF]/.test(trimmed)) return trimmed
  return trimmed
    .replace(/وسيط الفروع/g, 'peer median')
    .replace(/فجوة الفروع/g, 'branch gap')
    .replace(/العمولات المرحّلة/g, 'posted commissions')
    .replace(/مبيعات المنصات/g, 'aggregator sales')
    .replace(/حجم التحويل للقنوات المباشرة/g, 'direct shift volume')
    .replace(/مبيعات فترة ما بعد الظهر/g, 'afternoon 30d pool')
    .replace(/الذمم المتأخرة فوق 30 يوماً/g, 'overdue >30d')
    .replace(/الذمم المدينة المفتوحة/g, 'open debits')
    .replace(/القيمة المطلقة للأرصدة الدائنة/g, 'abs(unapplied credits)')
    .replace(/وتيرة التسوية الأسبوعية/g, 'weekly clearing pace')
    .replace(/مبيعات الفئة أ/g, 'Tier-A sales')
    .replace(/مبيعات الفئة ج/g, 'Tier-C sales')
    .replace(/محاكاة صافي الإيرادات/g, 'net revenue simulation')
    .replace(/المبيعات غير المنسوبة/g, 'unattributed sales')
    .replace(/منسوبة لقائمة دخل الفروع/g, 'attributed to branch P&L')
    .replace(/الأفنيوز/g, 'Avenues')
    .replace(/مول 360/g, '360 Mall')
    .replace(/العاصمة/g, 'Assima')
    .replace(/بروميناد/g, 'Promenade')
    .replace(/السالمية/g, 'Salmiya')
    .replace(/الكوت/g, 'Al Kout')
    .replace(/العارضية/g, 'Ardiya')
    .replace(/(\d+)\s*يوم/g, '$1d')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface DecisionRoomViewProps {
  locale: 'ar' | 'en'
  loading?: boolean
  generatedAt: string | null
  reports: AdvisorReport[]
  summary: ExecutiveSummary | null
  decisions: DecisionRecord[]
  canDecide: boolean
  liveSummary: OdooLiveSummary | null
  initialTab?: DecisionRoomTab
  onDecide?: (fingerprint: string, status: DecisionStatus, finding?: CouncilFinding) => void
  busyFingerprint?: string | null
}

/* ------------------------------------------------------------------ finding card */

function FindingCard({
  f,
  locale,
  decision,
  canDecide,
  onDecide,
  busy,
}: {
  f: CouncilFinding
  locale: 'ar' | 'en'
  decision: DecisionRecord | null
  canDecide: boolean
  onDecide?: DecisionRoomViewProps['onDecide']
  busy: boolean
}) {
  const isAr = locale === 'ar'
  const t = (en: string, ar: string) => (isAr ? ar : en)
  const est = f.weeklyImpact ?? f.proposals[0]?.expectedImpact ?? null
  return (
    <li data-room-finding={f.fingerprint} className={`${CARD} flex min-w-0 flex-col gap-2.5`}>
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs font-semibold">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="shrink-0 whitespace-nowrap rounded-full bg-blue-50 px-2 py-0.5 text-blue-800 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-400/20">
            {isAr ? ADVISOR_LABEL[f.advisorId].ar : ADVISOR_LABEL[f.advisorId].en}
          </span>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-white/10 dark:text-slate-300">
            {f.severity === 'high'
              ? t('High priority', 'أولوية عالية')
              : f.severity === 'medium'
                ? t('Medium priority', 'أولوية متوسطة')
                : t('Low priority', 'أولوية منخفضة')}
          </span>
        </div>
        {decision ? (
          <span
            data-decision-status={decision.status}
            className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 ring-1 ${STATUS_LABEL[decision.status].cls}`}
          >
            {isAr ? STATUS_LABEL[decision.status].ar : STATUS_LABEL[decision.status].en}
          </span>
        ) : (
          <span
            data-decision-status="pending"
            className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 ring-1 ${PENDING_STATUS_CLS}`}
          >
            {t('Pending Review', 'بانتظار المراجعة')}
          </span>
        )}
      </div>

      <h3 className="min-w-0 break-words text-[15px] font-bold leading-snug text-slate-900 dark:text-white">
        {isAr ? localizeDecisionProseAr(f.titleAr) : f.titleEn}
      </h3>

      <div className="rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            {t('Verified Evidence & Financial Volume', 'الأدلة والحجم المالي الموثّق')}
          </span>
          <span
            data-provenance-tag="odoo-verified-actual"
            className="shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/20"
          >
            {t('Odoo Verified Actual', 'فعلي موثّق من أودو')}
          </span>
        </div>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-[13px] text-slate-700 sm:grid-cols-2 dark:text-slate-300">
          {f.evidence.slice(0, 6).map((e) => (
            <div
              key={`${e.labelEn}-${e.period.from}-${e.domain}`}
              className="flex min-w-0 items-baseline justify-between gap-x-2 border-b border-slate-200/60 py-1 dark:border-white/5"
            >
              <dt
                className="min-w-0 truncate text-slate-500 dark:text-slate-400"
                title={isAr ? localizeDecisionProseAr(e.labelAr) : e.labelEn}
              >
                {isAr ? localizeDecisionProseAr(e.labelAr) : e.labelEn}
              </dt>
              <dd className="shrink-0 whitespace-nowrap font-semibold tabular-nums" dir="ltr">
                {evidenceValue(e, locale)}
              </dd>
            </div>
          ))}
        </dl>
        <p
          className="mt-1.5 text-xs text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {isAr ? (
            <>
              {'أودو · '}
              {localizeOdooModelAr(f.evidence[0]?.odooModel)}
              {' · '}
              <bdi dir="ltr">{`${f.evidence[0]?.period.from ?? ''} → ${f.evidence[0]?.period.to ?? ''}`}</bdi>
              {' · مزامنة '}
              <bdi dir="ltr">{syncLabel(f.evidence[0]?.syncAt ?? null, locale)}</bdi>
            </>
          ) : (
            `Odoo · ${f.evidence[0]?.odooModel ?? '—'} · ${f.evidence[0]?.period.from ?? ''} → ${f.evidence[0]?.period.to ?? ''} · sync ${syncLabel(f.evidence[0]?.syncAt ?? null, locale)}`
          )}
        </p>
      </div>

      <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
        <span className="font-semibold">{t('Why: ', 'لماذا: ')}</span>
        {isAr ? localizeDecisionProseAr(f.rootCause.ar) : f.rootCause.en}
      </p>

      {f.proposals.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t('Concrete Action Steps', 'خطوات التنفيذ المعتمدة')}
          </div>
          <ol className="space-y-1.5 text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">
            {f.proposals.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10"
              >
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600/15 text-xs font-bold tabular-nums text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="font-semibold">{isAr ? localizeDecisionProseAr(p.who.ar) : p.who.en}</span>
                  {`: ${isAr ? localizeDecisionProseAr(p.what.ar) : p.what.en} — `}
                  <span className="font-medium text-slate-600 dark:text-slate-400">
                    {isAr ? localizeDecisionProseAr(p.when.ar) : p.when.en}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {est ? (
        <details
          open
          data-room-estimate="true"
          className="rounded-xl bg-sky-50/70 px-3 py-2 text-xs text-sky-950 ring-1 ring-sky-200/70 dark:bg-sky-400/10 dark:text-sky-100 dark:ring-sky-300/20"
        >
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 font-semibold">
            <span className="min-w-0 break-words">{`${t('Estimate', 'تقدير')}: ${estimateValue(est, locale)}`}</span>
            <span
              data-provenance-tag="deterministic-simulation"
              className="shrink-0 whitespace-nowrap rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-sky-900 ring-1 ring-sky-300/60 dark:bg-white/10 dark:text-sky-100 dark:ring-sky-400/30"
            >
              {t('Deterministic Simulation', 'محاكاة رقمية حتمية')}
            </span>
          </summary>
          <p className="mt-1 [overflow-wrap:anywhere]" dir={isAr ? 'rtl' : 'ltr'}>
            {isAr ? localizeEstimateFormulaAr(est.formula) : localizeEstimateFormulaEn(est.formula)}
          </p>
          <p className="mt-1 [overflow-wrap:anywhere] tabular-nums" dir={isAr ? 'rtl' : 'ltr'}>
            {Object.entries(est.inputs)
              .map(([k, v]) =>
                isAr ? `${localizeEstimateInputKeyAr(k)} = ${v}` : `${k} = ${v}`,
              )
              .join(' · ')}
          </p>
        </details>
      ) : null}

      {canDecide && onDecide ? (
        <div className="mt-auto flex flex-wrap gap-2 pt-1" role="group" aria-label={t('Decision', 'القرار')}>
          {(['accepted', 'testing', 'rejected'] as const).map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              data-decide={s}
              aria-pressed={decision?.status === s}
              onClick={() => onDecide(f.fingerprint, s, f)}
              className={`min-h-9 shrink-0 whitespace-nowrap cursor-pointer rounded-xl px-3.5 text-[13px] font-semibold ring-1 transition-colors disabled:opacity-60 ${
                decision?.status === s
                  ? STATUS_LABEL[s].cls
                  : s === 'accepted'
                    ? 'bg-emerald-600 text-white ring-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D] dark:ring-emerald-400 dark:hover:bg-emerald-400'
                    : 'bg-white text-slate-800 ring-slate-300 hover:bg-slate-50 dark:bg-white/[0.04] dark:text-slate-100 dark:ring-white/15 dark:hover:bg-white/10'
              }`}
            >
              {s === 'accepted'
                ? t('Approve', 'اعتماد')
                : s === 'testing'
                  ? t('Test first', 'اختبار أولاً')
                  : t('Dismiss', 'استبعاد')}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  )
}

/* ------------------------------------------------------------------ analysis views */

function DriversView({ summary, locale }: { summary: OdooLiveSummary | null; locale: 'ar' | 'en' }) {
  const isAr = locale === 'ar'
  const t = (en: string, ar: string) => (isAr ? ar : en)
  const w = useMemo(() => driverWindows({ summary }), [summary])
  if (!w) return null
  const rows = contributions(w, 'branch')
  const split = splitOrdersAov(w.total.a, w.total.b)
  const total = w.total.a.netFils - w.total.b.netFils
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.deltaFils)))
  return (
    <section data-room-view="drivers" className={`${CARD} space-y-3`}>
      <header>
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{t('Why did sales move? Contribution by branch', 'لماذا تغيّرت المبيعات؟ مساهمة كل فرع')}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400" dir={isAr ? 'rtl' : 'ltr'}>
          {isAr ? (
            <>
              {'طلبات نقاط البيع · '}
              <bdi dir="ltr">{`${w.a.from} → ${w.a.to}`}</bdi>
              {' مقابل '}
              <bdi dir="ltr">{`${w.b.from} → ${w.b.to}`}</bdi>
            </>
          ) : (
            `pos.order · ${w.a.from} → ${w.a.to} vs ${w.b.from} → ${w.b.to}`
          )}
        </p>
      </header>
      <div className={`grid grid-cols-1 gap-2 text-[13px] ${split ? 'sm:grid-cols-3' : 'sm:grid-cols-1'}`}>
        <p className="min-w-0 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/[0.03]"><span className="block truncate text-xs text-slate-500">{t('Company change', 'تغيّر الشركة')}</span><b className="tabular-nums" dir="ltr">{`${signed(total / 1000, 3)} ${t('KWD', 'د.ك')}`}</b></p>
        {split ? (
          <>
            <p className="min-w-0 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/[0.03]"><span className="block truncate text-xs text-slate-500">{t('Orders effect', 'أثر عدد الطلبات')}</span><b className="tabular-nums" dir="ltr">{`${signed(split.ordersEffectFils / 1000, 3)} ${t('KWD', 'د.ك')}`}</b></p>
            <p className="min-w-0 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/[0.03]"><span className="block truncate text-xs text-slate-500">{t('Basket effect', 'أثر متوسط الفاتورة')}</span><b className="tabular-nums" dir="ltr">{`${signed(split.basketEffectFils / 1000, 3)} ${t('KWD', 'د.ك')}`}</b></p>
          </>
        ) : null}
      </div>
      <ul className="space-y-1.5" aria-label={t('Contribution by branch', 'المساهمة حسب الفرع')}>
        {rows.map((r) => {
          const lbl = branchLabel(r.id)
          const pct = (Math.abs(r.deltaFils) / max) * 50
          const neg = r.deltaFils < 0
          return (
            <li key={r.id} data-driver-row={r.id} className="grid grid-cols-[7.5rem_1fr_6.5rem] items-center gap-2 text-[13px] sm:grid-cols-[9rem_1fr_8rem]">
              <span className="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-200" title={isAr ? lbl.ar : lbl.en}>{isAr ? lbl.ar : lbl.en}</span>
              <span className="relative h-4 rounded bg-slate-100 dark:bg-white/[0.06]" dir="ltr" aria-hidden="true">
                <span className="absolute inset-y-0 left-1/2 w-px bg-slate-400/60" />
                <span className={`absolute inset-y-0 rounded ${neg ? 'right-1/2 bg-red-500/80' : 'left-1/2 bg-emerald-600/80'}`} style={{ width: `${pct}%` }} />
              </span>
              <span className={`whitespace-nowrap text-end font-semibold tabular-nums ${neg ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`} dir="ltr">{signed(r.deltaFils / 1000, 3)}</span>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t('Branch contributions add up exactly to the company change. Orders effect + basket effect = the change.', 'مساهمات الفروع تساوي تغيّر الشركة بالضبط، وأثر الطلبات + أثر الفاتورة = التغيّر.')}</p>
    </section>
  )
}

function BenchmarkView({ summary, locale }: { summary: OdooLiveSummary | null; locale: 'ar' | 'en' }) {
  const isAr = locale === 'ar'
  const t = (en: string, ar: string) => (isAr ? ar : en)
  const d = useMemo(() => completedDailyByBranch(summary), [summary])
  const k = useMemo(() => (d ? branchKpis(d) : null), [d])
  const m = useMemo(() => (d ? weekdayMatrix(d) : null), [d])
  if (!d || !k) return null
  const order = [0, 1, 2, 3, 4, 5, 6]
  return (
    <section data-room-view="benchmark" className={`${CARD} space-y-4`}>
      <header>
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{t('Branches against their peers', 'الفروع مقابل بعضها')}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400" dir={isAr ? 'rtl' : 'ltr'}>
          {isAr ? (
            <>
              {'طلبات نقاط البيع · '}
              <bdi dir="ltr">{`${k.from} → ${k.to}`}</bdi>
              {' · المقارنة = وسيط باقي الفروع'}
            </>
          ) : (
            `pos.order · ${k.from} → ${k.to} · peer = median of the other branches`
          )}
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th className="whitespace-nowrap px-2 py-2 text-start">{t('Branch', 'الفرع')}</th>
              <th className="whitespace-nowrap px-2 py-2 text-end">{t('Net / day', 'الصافي / يوم')}</th>
              <th className="whitespace-nowrap px-2 py-2 text-end">{t('Orders / day', 'الطلبات / يوم')}</th>
              <th className="whitespace-nowrap px-2 py-2 text-end">{t('Avg ticket', 'متوسط الفاتورة')}</th>
              <th className="whitespace-nowrap px-2 py-2 text-end">{t('Ticket vs peers', 'الفاتورة مقابل الفروع')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {k.rows.map((r) => (
              <tr key={r.branchId} data-benchmark-row={r.branchId}>
                <td className="whitespace-nowrap px-2 py-2 font-semibold">{isAr ? branchLabel(r.branchId).ar : branchLabel(r.branchId).en}</td>
                <td className="whitespace-nowrap px-2 py-2 text-end tabular-nums"><bdi dir="ltr">{`${fmt(r.netPerDayKwd)} ${t('KWD', 'د.ك')}`}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2 text-end tabular-nums"><bdi dir="ltr">{fmt(r.ordersPerDay, 1)}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2 text-end tabular-nums"><bdi dir="ltr">{r.aovKwd === null ? '—' : `${fmt(r.aovKwd)} ${t('KWD', 'د.ك')}`}</bdi></td>
                <td className={`whitespace-nowrap px-2 py-2 text-end font-semibold tabular-nums ${r.aovVsPeersPct !== null && r.aovVsPeersPct < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}><bdi dir="ltr">{r.aovVsPeersPct === null ? '—' : `${signed(r.aovVsPeersPct)}%`}</bdi></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {m ? (
        <div className="space-y-1.5">
          <h4 className="text-[13px] font-bold text-slate-900 dark:text-white">{t('Weekday share of weekly sales vs peers (points, last 8 weeks)', 'نصيب كل يوم من مبيعات الأسبوع مقابل الفروع (نقاط، آخر 8 أسابيع)')}</h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs" data-weekday-heatmap="true">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400">
                  <th className="px-1.5 py-1.5 text-start">{t('Branch', 'الفرع')}</th>
                  {order.map((wd) => <th key={wd} className="px-1.5 py-1.5 text-center">{isAr ? WEEKDAY_AR[wd] : WEEKDAY_EN[wd].slice(0, 3)}</th>)}
                </tr>
              </thead>
              <tbody>
                {m.rows.map((r) => (
                  <tr key={r.branchId}>
                    <td className="px-1.5 py-1 font-semibold text-slate-800 dark:text-slate-200">{isAr ? branchLabel(r.branchId).ar : branchLabel(r.branchId).en}</td>
                    {order.map((wd) => {
                      const g = r.gapPts[wd]
                      const a = Math.min(1, Math.abs(g) / 6)
                      return (
                        <td key={wd} className="px-1 py-1 text-center">
                          <span className="block rounded-md px-1 py-1 font-semibold tabular-nums text-slate-900 dark:text-white" dir="ltr" style={{ backgroundColor: g < 0 ? `rgba(220,38,38,${0.08 + a * 0.32})` : `rgba(5,150,105,${0.08 + a * 0.32})` }}>
                            {signed(g)}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('Red: the branch sells a smaller share of its week on that day than the peer median — a candidate day for a local offer or crew change.', 'الأحمر: الفرع يبيع في ذلك اليوم نصيباً أقل من أسبوعه مقارنة بوسيط الفروع — يوم مرشّح لعرض محلي أو تعديل الطاقم.')}</p>
        </div>
      ) : null}
    </section>
  )
}

function ForecastView({ summary, locale }: { summary: OdooLiveSummary | null; locale: 'ar' | 'en' }) {
  const isAr = locale === 'ar'
  const t = (en: string, ar: string) => (isAr ? ar : en)
  const d = useMemo(() => completedDailyByBranch(summary), [summary])
  const fc = useMemo(() => (d ? forecastNext7(d, null) : null), [d])
  const anomalies = useMemo(() => (d ? detectAnomalies(d) : []), [d])
  const market = useMemo(() => marketWideDays(anomalies), [anomalies])
  if (!d || (!fc && anomalies.length === 0)) return null
  const max = fc ? Math.max(...fc.next7.map((p) => p.highKwd), 1) : 1
  return (
    <section data-room-view="forecast" className={`${CARD} space-y-4`}>
      <header>
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{t('Next 7 days and unusual days', 'الأيام السبعة القادمة والأيام غير المعتادة')}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400" dir={isAr ? 'rtl' : 'ltr'}>
          {isAr ? (
            <>
              {'طلبات نقاط البيع · '}
              <bdi dir="ltr">{`${d.days[0]} → ${d.days[d.days.length - 1]}`}</bdi>
              {' · أيام مكتملة فقط'}
            </>
          ) : (
            `pos.order · ${d.days[0]} → ${d.days[d.days.length - 1]} · completed days only`
          )}
        </p>
      </header>
      {fc ? (
        <div className="space-y-2">
          <p className="text-[13px] text-slate-700 dark:text-slate-300">
            {t('Expected', 'المتوقع')} <b className="tabular-nums" dir="ltr">{`${fmt(fc.totalKwd)} ${t('KWD', 'د.ك')}`}</b> · {t('same days last week', 'نفس الأيام الأسبوع الماضي')} <b className="tabular-nums" dir="ltr">{`${fmt(fc.lastWeekActualKwd)} ${t('KWD', 'د.ك')}`}</b> · {t('model error in backtest (MAPE)', 'متوسط نسبة خطأ النموذج في الاختبار الرجعي')} <b className="tabular-nums" dir="ltr">{`${fc.backtest.mapePct.toFixed(1)}%`}</b>
          </p>
          <div className="overflow-x-auto pb-1">
            <ol className="grid min-w-[320px] grid-cols-7 items-end gap-1.5" data-forecast-bars="true" aria-label={t('Forecast by day', 'التوقع حسب اليوم')}>
              {fc.next7.map((p) => {
                const wd = new Date(`${p.day}T00:00:00Z`).getUTCDay()
                return (
                  <li key={p.day} className="flex min-w-0 flex-col items-center gap-1">
                    <span className="max-w-full truncate text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300" dir="ltr">{fmt(p.forecastKwd / 1000, 1)}{t('k', ' ألف')}</span>
                    <span className="relative w-full rounded-md bg-slate-100 dark:bg-white/[0.06]" style={{ height: '7rem' }} title={`${fmt(p.lowKwd)} – ${fmt(p.highKwd)}`}>
                      <span className="absolute inset-x-0 bottom-0 rounded-md bg-sky-200/70 dark:bg-sky-400/20" style={{ height: `${(p.highKwd / max) * 100}%` }} />
                      <span className="absolute inset-x-1 bottom-0 rounded-md bg-sky-600/85" style={{ height: `${(p.forecastKwd / max) * 100}%` }} />
                    </span>
                    <span className="max-w-full truncate text-xs text-slate-500 dark:text-slate-400">{isAr ? WEEKDAY_AR[wd] : WEEKDAY_EN[wd].slice(0, 3)}</span>
                  </li>
                )
              })}
            </ol>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('Thousands of KWD. Dark bar: forecast. Light band: upper end of the range (± the backtest error). The model does not know upcoming offers or events.', 'بآلاف الدنانير. العمود الداكن: التوقع. الشريط الفاتح: الحد الأعلى للمدى (± خطأ الاختبار الرجعي). النموذج لا يعرف العروض أو المناسبات القادمة.')}</p>
        </div>
      ) : null}
      {anomalies.length > 0 ? (
        <div className="space-y-1.5">
          <h4 className="text-[13px] font-bold text-slate-900 dark:text-white">{t('Unusual days (last 7 completed days)', 'أيام غير معتادة (آخر 7 أيام مكتملة)')}</h4>
          {market.length > 0 ? (
            <p data-market-wide="true" className="rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-800 ring-1 ring-slate-200 dark:bg-white/[0.03] dark:text-slate-200 dark:ring-white/10">
              {market.map((mw) => `${mw.day}: ${mw.anomalies.length} ${t('branches moved together — a market-wide cause', 'فروع تحركت معاً — سبب عام')}`).join(' · ')}
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <th className="whitespace-nowrap px-2 py-2 text-start">{t('Branch', 'الفرع')}</th>
                  <th className="whitespace-nowrap px-2 py-2 text-start">{t('Day', 'اليوم')}</th>
                  <th className="whitespace-nowrap px-2 py-2 text-end">{t('Actual', 'الفعلي')}</th>
                  <th className="whitespace-nowrap px-2 py-2 text-end">{t('Normal', 'المعتاد')}</th>
                  <th className="whitespace-nowrap px-2 py-2 text-end">{t('Gap', 'الفارق')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {anomalies.map((a) => (
                  <tr key={`${a.branchId}-${a.day}`} data-anomaly={`${a.branchId}:${a.day}`}>
                    <td className="whitespace-nowrap px-2 py-1.5 font-semibold">{isAr ? branchLabel(a.branchId).ar : branchLabel(a.branchId).en}</td>
                    <td className="whitespace-nowrap px-2 py-1.5"><bdi dir="ltr">{a.day}</bdi></td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-end tabular-nums"><bdi dir="ltr">{fmt(a.actualKwd)}</bdi></td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-end tabular-nums"><bdi dir="ltr">{fmt(a.expectedKwd)}</bdi></td>
                    <td className={`whitespace-nowrap px-2 py-1.5 text-end font-semibold tabular-nums ${a.gapPct < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}><bdi dir="ltr">{`${signed(a.gapPct)}%`}</bdi></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  )
}

/** Which analysis views have data in this payload (a view without data is not offered at all). */
export function analysisAvailability(summary: OdooLiveSummary | null): { drivers: boolean; benchmark: boolean; forecast: boolean } {
  const d = completedDailyByBranch(summary)
  return {
    drivers: driverWindows({ summary }) !== null,
    benchmark: Boolean(d && branchKpis(d)),
    forecast: Boolean(d && (forecastNext7(d, null) || detectAnomalies(d).length > 0)),
  }
}

function DecisionLog({ decisions, locale }: { decisions: DecisionRecord[]; locale: 'ar' | 'en' }) {
  const isAr = locale === 'ar'
  const t = (en: string, ar: string) => (isAr ? ar : en)
  if (decisions.length === 0) return null

  return (
    <section data-decision-log="true" className={`${CARD} overflow-x-auto`}>
      <table className="w-full min-w-[720px] text-[13px]">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
            <th className="whitespace-nowrap px-2 py-2 text-start">{t('Proposal', 'المقترح')}</th>
            <th className="whitespace-nowrap px-2 py-2 text-start">{t('Decision', 'القرار')}</th>
            <th className="whitespace-nowrap px-2 py-2 text-end">{t('Expected / week', 'المتوقع / أسبوع')}</th>
            <th className="whitespace-nowrap px-2 py-2 text-end">{t('Change after', 'التغيّر بعد')}</th>
            <th className="whitespace-nowrap px-2 py-2 text-end">{t('Peers', 'الفروع الأخرى')}</th>
            <th className="whitespace-nowrap px-2 py-2 text-end">{t('Measured lift / week', 'الأثر المقاس / أسبوع')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {decisions.map((d) => {
            const o = d.outcome
            const measured = o?.state === 'measured'
            const pending = !o ? t('Measured nightly', 'يُقاس ليلاً') : o.state === 'too-early' ? t(`Too early (${o.daysAfter} of 7 days)`, `مبكر (${o.daysAfter} من 7 أيام)`) : o.state === 'no-data' ? t('No data for this scope', 'لا بيانات لهذا النطاق') : ''
            return (
              <tr key={d.id} data-decision-row={d.fingerprint}>
                <td className="max-w-[22rem] px-2 py-2 font-semibold text-slate-800 dark:text-slate-200">{isAr ? d.titleAr : d.titleEn}<span className="block text-xs font-normal tabular-nums text-slate-500" dir="ltr">{d.decidedDay}</span></td>
                <td className="whitespace-nowrap px-2 py-2"><span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${STATUS_LABEL[d.status].cls}`}>{isAr ? STATUS_LABEL[d.status].ar : STATUS_LABEL[d.status].en}</span></td>
                <td className="whitespace-nowrap px-2 py-2 text-end tabular-nums"><bdi dir="ltr">{d.expectedWeeklyKwd === null ? '—' : fmt(d.expectedWeeklyKwd)}</bdi></td>
                {measured ? (
                  <>
                    <td className="whitespace-nowrap px-2 py-2 text-end tabular-nums"><bdi dir="ltr">{`${signed(o.changePct ?? 0)}%`}</bdi></td>
                    <td className="whitespace-nowrap px-2 py-2 text-end tabular-nums"><bdi dir="ltr">{o.peersChangePct === null ? '—' : `${signed(o.peersChangePct)}%`}</bdi></td>
                    <td className={`whitespace-nowrap px-2 py-2 text-end font-semibold tabular-nums ${(o.weeklyLiftKwd ?? 0) < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}><bdi dir="ltr">{o.weeklyLiftKwd === null ? '—' : signed(o.weeklyLiftKwd, 3)}</bdi></td>
                  </>
                ) : (
                  <td colSpan={3} className="whitespace-nowrap px-2 py-2 text-end text-xs text-slate-500 dark:text-slate-400">{d.status === 'rejected' ? t('Not measured (dismissed)', 'لا يُقاس (مستبعد)') : pending}</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('Measured on equal, weekday-aligned windows before and after the decision day; for a branch, the other branches over the same weeks are the control. This is before vs after on the same scope, not proof of cause.', 'يُقاس على فترتين متساويتين ومتطابقتين في أيام الأسبوع قبل يوم القرار وبعده؛ وللفرع تكون الفروع الأخرى في نفس الأسابيع هي المرجع. هذه مقارنة قبل وبعد على نفس النطاق، وليست إثباتاً للسبب.')}</p>
    </section>
  )
}

/* ------------------------------------------------------------------ view */

export function DecisionRoomView(props: DecisionRoomViewProps) {
  const { locale, loading = false, generatedAt, reports, summary, decisions, canDecide, liveSummary, onDecide, busyFingerprint = null } = props
  const isAr = locale === 'ar'
  const t = (en: string, ar: string) => (isAr ? ar : en)
  const avail = useMemo(() => analysisAvailability(liveSummary), [liveSummary])
  const hasMenu = reports.some((r) => r.advisorId === 'menu' && r.findings.length > 0)
  const showCouncil = reports.length > 0
  const tabHasContent = (id: DecisionRoomTab): boolean =>
    id === 'all' ? showCouncil : id === 'log' ? decisions.length > 0 : id === 'menu' ? hasMenu : avail[id]
  const [chosenTab, setTab] = useState<DecisionRoomTab>(props.initialTab ?? 'all')
  // A tab with nothing to show falls back to "all" (an empty section is never rendered).
  const fallbackTab: DecisionRoomTab = tabHasContent('all')
    ? 'all'
    : avail.drivers
      ? 'drivers'
      : avail.benchmark
        ? 'benchmark'
        : avail.forecast
          ? 'forecast'
          : 'all'
  const tab: DecisionRoomTab = tabHasContent(chosenTab) ? chosenTab : fallbackTab
  const decisionBy = useMemo(() => new Map(decisions.map((d) => [d.fingerprint, d])), [decisions])
  const findings = useMemo(() => {
    const all = reports.flatMap((r) => r.findings).filter((f) => f.proposals.length > 0 || f.kind === 'company-split' || f.kind === 'forecast-next7')
    const scoped = tab === 'all' || tab === 'log' ? all : all.filter((f) => TAB_ADVISORS[tab].includes(f.advisorId))
    return [...scoped].sort((a, b) => findingImpactScore(b) - findingImpactScore(a) || a.fingerprint.localeCompare(b.fingerprint))
  }, [reports, tab])
  const gaps = useMemo(() => {
    const ids = tab === 'all' || tab === 'log' ? null : TAB_ADVISORS[tab]
    return reports.filter((r) => !ids || ids.includes(r.advisorId)).flatMap((r) => r.dataGaps.map((g) => ({ advisorId: r.advisorId, g })))
  }, [reports, tab])
  const sized = findings.filter((f) => f.weeklyImpact?.unit === 'KWD')
  const sizedCount = sized.length
  const totalWeekly = sized.reduce((s, f) => s + (f.weeklyImpact?.value ?? 0), 0)
  const allTabs: { id: DecisionRoomTab; ar: string; en: string }[] = [
    { id: 'all', ar: 'كل المقترحات', en: 'All proposals' },
    { id: 'drivers', ar: 'محرّكات المبيعات', en: 'Sales drivers' },
    { id: 'menu', ar: 'المنيو والخصومات', en: 'Menu & discounts' },
    { id: 'benchmark', ar: 'الفروع والساعات', en: 'Branches & hours' },
    { id: 'forecast', ar: 'التوقع والأيام غير المعتادة', en: 'Forecast & unusual days' },
    { id: 'log', ar: `سجل القرارات (${decisions.length})`, en: `Decision log (${decisions.length})` },
  ]
  const tabs = allTabs.filter((x) => tabHasContent(x.id))
  const openCount = reports.flatMap((r) => r.findings).filter((f) => f.proposals.length > 0 && !decisionBy.has(f.fingerprint)).length
  const measuringCount = decisions.filter((d) => d.status !== 'rejected').length
  const visibleTileCount = Number(openCount > 0) + Number(sizedCount > 0) + Number(measuringCount > 0)
  const tilesGridCols =
    visibleTileCount === 1
      ? 'sm:grid-cols-1'
      : visibleTileCount === 2
        ? 'sm:grid-cols-2'
        : 'sm:grid-cols-3'
  return (
    <div dir={isAr ? 'rtl' : 'ltr'} data-decision-room="true" className="min-w-0 space-y-5 p-3 sm:p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">{t('Decision Room', 'غرفة القرار')}</h1>
          <p className="max-w-3xl text-[13px] text-slate-600 dark:text-slate-400">
            {t('What changed, why, what to do and what it is worth — derived directly from verified Odoo telemetry and council advisors. Approve or dismiss here; outcomes are tracked afterwards.', 'ما الذي تغيّر، ولماذا، وماذا نفعل، وكم يساوي — مباشرة من بيانات أودو الفعلية ومجلس المستشارين. اعتمد أو استبعد هنا، وتُقاس النتيجة بعدها.')}
          </p>
        </div>
        {generatedAt ? <p className="shrink-0 whitespace-nowrap text-xs tabular-nums text-slate-500 dark:text-slate-400" dir="ltr">{`${t('Council run', 'تشغيل المجلس')}: ${syncLabel(generatedAt, locale)}`}</p> : null}
      </header>

      {loading ? (
        <div className={`${CARD} text-[13px] text-slate-500`} aria-busy="true">{t('Loading executive decisions from Odoo…', 'جاري استخراج البطاقات التنفيذية من أودو…')}</div>
      ) : (
        <>
          {showCouncil && summary && summary.ar.length > 0 ? (
            <section data-executive-summary={summary.source} className="min-w-0 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm sm:p-5 dark:border-emerald-400/20 dark:bg-emerald-400/[0.06]">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="min-w-0 truncate text-[15px] font-bold text-slate-900 dark:text-white">{t('Executive summary', 'الملخص التنفيذي')}</h2>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200 dark:bg-white/10 dark:text-emerald-100 dark:ring-emerald-400/20">
                  {summary.source === 'ai' ? t('AI Council — number-verified against Odoo', 'مجلس الذكاء التنفيذي — متحقق رقمياً من أودو') : t('Built from Odoo council findings', 'مبني من نتائج أودو والمجلس')}
                </span>
              </div>
              <ol className="list-decimal space-y-1.5 ps-5 text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">
                {(isAr ? summary.ar : summary.en.length > 0 ? summary.en : summary.ar).map((line, i) => <li key={i}>{line}</li>)}
              </ol>
            </section>
          ) : null}

          {showCouncil && visibleTileCount > 0 ? (
            <div className={`grid grid-cols-1 gap-3 ${tilesGridCols}`} data-room-tiles="true">
              {openCount > 0 ? <p className={`${CARD} min-w-0`}><span className="block truncate text-xs text-slate-500 dark:text-slate-400">{t('Pending review proposals', 'مقترحات بانتظار المراجعة')}</span><b className="text-xl tabular-nums" dir="ltr">{openCount}</b></p> : null}
              {sizedCount > 0 ? (
                <p className={`${CARD} min-w-0`} data-room-sized="true"><span className="block truncate text-xs text-slate-500 dark:text-slate-400">{t('Sized opportunity in this view', 'الفرصة المقدّرة في هذا العرض')}</span><b className="text-xl tabular-nums" dir="ltr">{`${fmt(totalWeekly)} ${t('KWD / week', 'د.ك / أسبوع')}`}</b><span className="block text-xs text-slate-500">{t(`Deterministic simulation across ${sizedCount} cards`, `محاكاة رقمية حتمية عبر ${sizedCount} بطاقات`)}</span></p>
              ) : null}
              {measuringCount > 0 ? <p className={`${CARD} min-w-0`}><span className="block truncate text-xs text-slate-500 dark:text-slate-400">{t('Approved & active decisions', 'قرارات معتمدة وقيد القياس')}</span><b className="text-xl tabular-nums" dir="ltr">{measuringCount}</b></p> : null}
            </div>
          ) : null}

          {tabs.length > 0 ? (
            <nav role="tablist" aria-label={t('Decision Room sections', 'أقسام غرفة القرار')} className="flex flex-nowrap gap-1.5 overflow-x-auto no-scrollbar rounded-2xl bg-slate-100 p-1 dark:bg-white/[0.05]">
              {tabs.map((x) => (
                <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} data-room-tab={x.id} onClick={() => setTab(x.id)}
                  className={`min-h-9 shrink-0 whitespace-nowrap cursor-pointer rounded-xl px-3 text-[13px] font-semibold transition-colors ${tab === x.id ? 'bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}>
                  {isAr ? x.ar : x.en}
                </button>
              ))}
            </nav>
          ) : null}

          {tab === 'drivers' ? <DriversView summary={liveSummary} locale={locale} /> : null}
          {tab === 'benchmark' ? <BenchmarkView summary={liveSummary} locale={locale} /> : null}
          {tab === 'forecast' ? <ForecastView summary={liveSummary} locale={locale} /> : null}

          {tab === 'log' ? (
            <DecisionLog decisions={decisions} locale={locale} />
          ) : showCouncil && findings.length > 0 ? (
            <ol className={`grid grid-cols-1 gap-3 ${findings.length === 1 ? 'xl:grid-cols-1' : 'xl:grid-cols-2'}`}>
              {findings.map((f) => (
                <FindingCard key={f.fingerprint} f={f} locale={locale} decision={decisionBy.get(f.fingerprint) ?? null} canDecide={canDecide} onDecide={onDecide} busy={busyFingerprint === f.fingerprint} />
              ))}
            </ol>
          ) : null}

          {showCouncil && tab !== 'log' && gaps.length > 0 ? (
            <section data-room-gaps="true" className="space-y-1.5 text-[13px] text-slate-600 dark:text-slate-400">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">{t('What Odoo does not record yet (and what to record)', 'ما لا يسجله أودو بعد (وما يجب تسجيله)')}</h2>
              <ul className="list-disc space-y-1 ps-5">
                {gaps.map(({ advisorId, g }, i) => (
                  <li key={i}><span className="font-semibold">{isAr ? ADVISOR_LABEL[advisorId].ar : ADVISOR_LABEL[advisorId].en}:</span> {isAr ? `${localizeDecisionProseAr(g.missingAr)} ← ${localizeDecisionProseAr(g.recordAr)}` : `${g.missingEn} → ${g.recordEn}`}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {showCouncil ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('Today’s top three also appear on ', 'أهم ثلاثة اكتشافات تظهر أيضاً في ')}
              <Link href="/erp" className="font-semibold underline underline-offset-2">{t('the Executive Dashboard', 'لوحة القيادة التنفيذية')}</Link>.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ demand forecast page */

/** /erp/demand-forecast: the forecast & unusual-days view on its own (same engine as the Decision Room). */
export interface DemandForecastPanelProps {
  initialSummary?: OdooLiveSummary | null
}

export function DemandForecastPanel({
  initialSummary = null,
}: DemandForecastPanelProps) {
  const { isAr } = useLang()
  const { liveSummary } = useGlobalFilter()
  const locale = isAr ? 'ar' : 'en'
  const [hydrated, setHydrated] = useState(false)
  const [roomSummary, setRoomSummary] = useState<OdooLiveSummary | null>(initialSummary)
  const [loadingRoom, setLoadingRoom] = useState<boolean>(
    () => !analysisAvailability(initialSummary).forecast,
  )

  useEffect(() => {
    setHydrated(true)
    if (analysisAvailability(liveSummary).forecast) {
      setLoadingRoom(false)
      return
    }
    const cached = peekDecisionSwrCache<RoomApiBody>('room')
    if (cached?.data?.liveSummary) {
      setRoomSummary(cached.data.liveSummary)
      if (cached.isFresh || analysisAvailability(cached.data.liveSummary).forecast) {
        setLoadingRoom(false)
        if (cached.isFresh) return
      }
    }
    let active = true
    if (!cached?.data?.liveSummary) {
      setLoadingRoom(true)
    }
    void fetchDecisionSwr<RoomApiBody>('room', async () => {
      const r = await fetch('/api/erp/council/room', { credentials: 'same-origin' })
      if (!r.ok) return null
      return (await r.json()) as RoomApiBody
    })
      .then((b) => {
        if (!active) return
        if (b?.liveSummary) setRoomSummary(b.liveSummary)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingRoom(false)
      })
    return () => {
      active = false
    }
  }, [liveSummary])

  const activeLiveSummary = hydrated ? liveSummary : initialSummary
  const activeRoomSummary = hydrated ? roomSummary : initialSummary

  const effectiveSummary = useMemo(
    () =>
      analysisAvailability(activeLiveSummary).forecast
        ? activeLiveSummary
        : (activeRoomSummary ?? activeLiveSummary),
    [activeLiveSummary, activeRoomSummary],
  )
  const available = useMemo(
    () => analysisAvailability(effectiveSummary).forecast,
    [effectiveSummary],
  )
  const showLoading = (!hydrated && initialSummary === null) || (loadingRoom && !available)

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} data-demand-forecast-panel="true" className="min-w-0 space-y-4">
      <header className="space-y-1">
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">
          {isAr ? 'توقع الطلب والأيام غير المعتادة' : 'Demand Forecast & Unusual Days'}
        </h2>
        <p className="max-w-3xl text-[13px] text-slate-600 dark:text-slate-400">
          {isAr
            ? 'توقع مبيعات الأيام السبعة القادمة لكل الفروع من مبيعات أودو اليومية المكتملة، مع خطأ الاختبار الرجعي والأيام غير المعتادة.'
            : '7-day sales projection built directly from completed Odoo daily branch receipts, including backtest MAPE error and anomaly detection.'}
        </p>
      </header>

      {showLoading ? (
        <StateBlock
          state="loading"
          locale={locale}
          skeletonRows={3}
          title={
            isAr
              ? 'جارٍ استخراج السلسلة اليومية المكتملة من أودو 17...'
              : 'Loading completed daily POS series from Odoo 17...'
          }
        />
      ) : available ? (
        <>
          <ForecastView summary={effectiveSummary} locale={locale} />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isAr ? 'القرارات المبنية على هذا التوقع تُتخذ في ' : 'Decisions based on this forecast are taken in the '}
            <Link href="/erp/decisions" className="font-semibold underline underline-offset-2">{isAr ? 'غرفة القرار' : 'Decision Room'}</Link>.
          </p>
        </>
      ) : (
        <StateBlock
          state="empty"
          locale={locale}
          title={
            isAr
              ? 'لا تتوفر سلسلة أيام مكتملة كافية في أودو لحساب التوقع حالياً'
              : 'Insufficient completed daily POS history in Odoo for this forecast window'
          }
          description={
            isAr
              ? 'يتطلب نموذج التوقع وجود سلسلة مبيعات يومية مكتملة من نقاط البيع في أودو 17.'
              : 'The 7-day forecast requires completed daily POS series from Odoo 17.'
          }
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ container */

interface RoomApiBody {
  generatedAt?: string | null
  reports?: AdvisorReport[]
  summary?: ExecutiveSummary | null
  liveSummary?: OdooLiveSummary | null
  canDecide?: boolean
}

export function DecisionRoomStudio({ initialTab }: { initialTab?: DecisionRoomTab }) {
  const { isAr } = useLang()
  const { liveSummary, sessionRole } = useGlobalFilter()
  const roleCanDecide = sessionRole === 'admin' || sessionRole === 'gm' || sessionRole === 'dgm'
  const [hydrated, setHydrated] = useState(false)

  const [room, setRoom] = useState<{
    loading: boolean
    generatedAt: string | null
    reports: AdvisorReport[]
    summary: ExecutiveSummary | null
    serverLiveSummary: OdooLiveSummary | null
    canDecide: boolean
  }>({
    loading: true,
    generatedAt: null,
    reports: [],
    summary: null,
    serverLiveSummary: null,
    canDecide: roleCanDecide,
  })

  const [decisions, setDecisions] = useState<DecisionRecord[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadDecisions = useCallback(() => {
    void fetchDecisionSwr<DecisionRecord[]>('decisions', async () => {
      const r = await fetch('/api/erp/council/decisions', { credentials: 'same-origin' })
      if (!r.ok) return null
      const b = (await r.json()) as { decisions?: DecisionRecord[] } | null
      return b?.decisions ?? []
    })
      .then((list) => {
        if (list) setDecisions(list)
      })
      .catch(() => {})
  }, [])

  const loadRoom = useCallback(
    (force = false) => {
      const fetchFn = async (): Promise<RoomApiBody | null> => {
        const url = force ? '/api/erp/council/room?force=1' : '/api/erp/council/room'
        const r = await fetch(url, { credentials: 'same-origin' })
        if (!r.ok) return null
        return (await r.json()) as RoomApiBody
      }
      const promise = force ? fetchFn() : fetchDecisionSwr<RoomApiBody>('room', fetchFn)
      void promise
        .then((b) => {
          if (b && force) writeDecisionSwrCache('room', b)
          setRoom((prev) => ({
            loading: false,
            generatedAt: b?.generatedAt ?? prev.generatedAt,
            reports: b?.reports ?? prev.reports,
            summary: b?.summary ?? prev.summary,
            serverLiveSummary: b?.liveSummary ?? prev.serverLiveSummary,
            canDecide: b?.canDecide !== undefined ? Boolean(b.canDecide) : roleCanDecide,
          }))
        })
        .catch(() => {
          setRoom((s) => ({ ...s, loading: false }))
        })
    },
    [roleCanDecide],
  )

  useEffect(() => {
    setHydrated(true)
    const cachedRoom = peekDecisionSwrCache<RoomApiBody>('room')
    if (cachedRoom?.data && Array.isArray(cachedRoom.data.reports) && cachedRoom.data.reports.length > 0) {
      setRoom({
        loading: false,
        generatedAt: cachedRoom.data.generatedAt ?? null,
        reports: cachedRoom.data.reports,
        summary: cachedRoom.data.summary ?? null,
        serverLiveSummary: cachedRoom.data.liveSummary ?? null,
        canDecide: cachedRoom.data.canDecide ?? roleCanDecide,
      })
      if (!cachedRoom.isFresh) {
        loadRoom(false)
      }
    } else {
      loadRoom(false)
    }
    const cachedDec = peekDecisionSwrCache<DecisionRecord[]>('decisions')
    if (cachedDec?.data) {
      setDecisions(cachedDec.data)
      if (!cachedDec.isFresh) {
        loadDecisions()
      }
    } else {
      loadDecisions()
    }
    const onSync = () => {
      loadRoom(true)
      loadDecisions()
    }
    window.addEventListener('aether:odoo-sync', onSync)
    return () => {
      window.removeEventListener('aether:odoo-sync', onSync)
    }
  }, [loadDecisions, loadRoom, roleCanDecide])

  const effectiveLiveSummary = hydrated ? (room.serverLiveSummary ?? liveSummary) : null

  const clientFallback = useMemo(() => {
    if (room.reports.length > 0) return null
    if (!effectiveLiveSummary || effectiveLiveSummary.connected === false || effectiveLiveSummary.noData) {
      return null
    }
    const built = buildLiveDecisionSnapshotFromSummary(effectiveLiveSummary)
    return built.available ? built : null
  }, [effectiveLiveSummary, room.reports.length])

  const effectiveReports = room.reports.length > 0 ? room.reports : (clientFallback?.reports ?? [])
  const effectiveSummary = room.reports.length > 0 ? room.summary : (clientFallback?.summary ?? null)
  const effectiveGeneratedAt =
    room.generatedAt ?? clientFallback?.generatedAt ?? effectiveLiveSummary?.lastSyncAt ?? null
  const effectiveLoading = room.loading && effectiveReports.length === 0

  const onDecide = useCallback(
    (fingerprint: string, status: DecisionStatus, finding?: CouncilFinding) => {
      setBusy(fingerprint)
      setError(null)
      const nowIso = new Date().toISOString()
      const optimisticRecord: DecisionRecord | null = finding
        ? {
            id: `opt-${fingerprint}`,
            fingerprint,
            advisorId: finding.advisorId,
            kind: finding.kind,
            branchId: finding.entities.branchId ?? null,
            titleAr: finding.titleAr,
            titleEn: finding.titleEn,
            status,
            note: null,
            decidedBy: sessionRole,
            decidedAt: nowIso,
            decidedDay: kuwaitDayOf(nowIso) ?? nowIso.slice(0, 10),
            expectedWeeklyKwd:
              finding.weeklyImpact?.unit === 'KWD' ? finding.weeklyImpact.value : null,
            outcome: null,
            outcomeAt: null,
          }
        : null

      if (optimisticRecord) {
        setDecisions((prev) => {
          const next = [optimisticRecord, ...prev.filter((d) => d.fingerprint !== fingerprint)]
          writeDecisionSwrCache('decisions', next)
          return next
        })
      }

      fetch('/api/erp/council/decisions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fingerprint,
          status,
          findingMeta: finding
            ? {
                advisorId: finding.advisorId,
                kind: finding.kind,
                branchId: finding.entities.branchId ?? null,
                titleAr: finding.titleAr,
                titleEn: finding.titleEn,
                expectedWeeklyKwd:
                  finding.weeklyImpact?.unit === 'KWD' ? finding.weeklyImpact.value : null,
              }
            : undefined,
        }),
      })
        .then(async (r) => {
          if (!r.ok) {
            const b = (await r.json().catch(() => null)) as { errorAr?: string; error?: string } | null
            setError((isAr ? b?.errorAr : b?.error) ?? (isAr ? 'تعذّر حفظ القرار.' : 'The decision could not be saved.'))
            loadDecisions()
            return
          }
          const saved = (await r.json().catch(() => null)) as { decision?: DecisionRecord } | null
          if (saved?.decision) {
            setDecisions((prev) => {
              const next = [
                saved.decision!,
                ...prev.filter((d) => d.fingerprint !== saved.decision!.fingerprint),
              ]
              writeDecisionSwrCache('decisions', next)
              return next
            })
          } else {
            loadDecisions()
          }
        })
        .catch(() => {
          setError(isAr ? 'تعذّر حفظ القرار.' : 'The decision could not be saved.')
          loadDecisions()
        })
        .finally(() => setBusy(null))
    },
    [isAr, loadDecisions, sessionRole],
  )

  return (
    <>
      {error ? <p role="alert" className="mx-3 mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-800 ring-1 ring-red-200 sm:mx-5 dark:bg-red-500/10 dark:text-red-200">{error}</p> : null}
      <DecisionRoomView
        locale={isAr ? 'ar' : 'en'}
        loading={effectiveLoading}
        generatedAt={effectiveGeneratedAt}
        reports={effectiveReports}
        summary={effectiveSummary}
        decisions={decisions}
        canDecide={room.canDecide || roleCanDecide}
        liveSummary={effectiveLiveSummary}
        initialTab={initialTab}
        onDecide={onDecide}
        busyFingerprint={busy}
      />
    </>
  )
}
