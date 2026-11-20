'use client'

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { cx } from '@/components/ui/cx'
import { formatKuwaitDateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'

export type KpiMetricKindAr = 'فعلي' | 'محسوب بمعادلة' | 'تقدير'
export type KpiMetricKindInput = KpiMetricKindAr | 'actual' | 'formula' | 'estimate'
export type KpiProvenanceKind = KpiMetricKindInput

export interface KpiProvenanceBadgeProps {
  /** Odoo 17 model name(s), e.g. `pos.order`, `account.move.line`, `stock.move`, `purchase.order.line` */
  odooModel?: string
  /** Alias for `odooModel` */
  model?: string
  /** Inclusive date window (`{ from, to }` or formatted ISO range string) */
  dateRange: { from: string; to: string } | string
  /** ISO timestamp of the last Odoo sync (`null` when disconnected/unsynced) */
  lastSyncAt?: string | null
  /** Explicit >24h staleness flag; also computed automatically from `lastSyncAt` when older than 24h */
  isStale24h?: boolean
  /** Classification of the KPI number: `فعلي` | `محسوب بمعادلة` | `تقدير` */
  kind: KpiMetricKindInput
  /** Actual Odoo JSON-RPC domain/read_group query or explicit mathematical formula */
  queryOrFormula?: string
  /** Optional explicit Arabic localization for `queryOrFormula` when `isAr` is true */
  queryOrFormulaAr?: string
  isAr?: boolean
  compact?: boolean
  /** Optional controlled open state */
  open?: boolean
  /** Optional initial open state for uncontrolled usage */
  defaultOpen?: boolean
  /** Callback fired whenever open state changes */
  onOpenChange?: (open: boolean) => void
  className?: string
}

interface PopoverCoords {
  top: number
  left: number
  placement: 'bottom' | 'top'
  horizontalAlign: 'start' | 'end'
}

const VIEWPORT_MARGIN = 12
const TRIGGER_GAP = 8
const FALLBACK_POPOVER_WIDTH = 288
const FALLBACK_POPOVER_HEIGHT = 176

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' && typeof document !== 'undefined'
    ? useLayoutEffect
    : useEffect

function useSafeIsAr(explicitIsAr?: boolean): boolean {
  try {
    const i18n = useI18n()
    return explicitIsAr ?? i18n.locale === 'ar'
  } catch {
    return explicitIsAr ?? true
  }
}

function normalizeKind(kind: KpiMetricKindInput): {
  ar: KpiMetricKindAr
  en: string
  toneClass: string
} {
  if (kind === 'فعلي' || kind === 'actual') {
    return {
      ar: 'فعلي',
      en: 'Actual',
      toneClass:
        'bg-emerald-50 text-emerald-800 ring-emerald-500/25',
    }
  }
  if (kind === 'محسوب بمعادلة' || kind === 'formula') {
    return {
      ar: 'محسوب بمعادلة',
      en: 'Formula',
      toneClass:
        'bg-sky-50 text-sky-800 ring-sky-500/25',
    }
  }
  return {
    ar: 'تقدير',
    en: 'Estimate',
    toneClass:
      'bg-slate-100 text-slate-700 ring-slate-400/30',
  }
}

function formatSyncShort(lastSyncAt?: string | null): {
  labelAr: string
  labelEn: string
  computedStale24h: boolean
} {
  if (!lastSyncAt) {
    return {
      labelAr: 'غير متزامن',
      labelEn: 'Not synced',
      computedStale24h: false,
    }
  }
  const ms = Date.parse(lastSyncAt)
  if (!Number.isFinite(ms)) {
    return {
      labelAr: lastSyncAt,
      labelEn: lastSyncAt,
      computedStale24h: false,
    }
  }
  const ageMs = Date.now() - ms
  const computedStale24h = ageMs > 24 * 3_600_000
  const formatted = formatKuwaitDateTime(ms, { locale: 'en', style: 'iso' })
  return {
    labelAr: formatted,
    labelEn: formatted,
    computedStale24h,
  }
}

const ODOO_MODEL_AR_MAP: Record<string, string> = {
  'pos.order + account.move.line': 'طلبات نقاط البيع + قيود الأستاذ العام',
  'pos.payment + pos.order': 'مدفوعات وطلبات نقاط البيع',
  'pos.order.line / pos.payment': 'بنود ومدفوعات نقاط البيع',
  'pos.payment / pos.order.line': 'مدفوعات وبنود نقاط البيع',
  'pos.order': 'طلبات نقاط البيع',
  'pos.order.line': 'بنود طلبات نقاط البيع',
  'pos.payment': 'مدفوعات نقاط البيع',
  'pos.config': 'أجهزة نقاط البيع',
  'pos.session': 'جلسات نقاط البيع',
  'account.move.line': 'قيود دفتر الأستاذ العام',
  'account.move': 'فواتير وقيود المحاسبة',
  'stock.move': 'حركات المخزون',
  'stock.move (scrap)': 'حركات المخزون (الإتلاف)',
  'stock.move (consumption)': 'حركات المخزون (الاستهلاك)',
  'stock.move / stock.scrap': 'حركات المخزون وقيود الإتلاف',
  'stock.scrap': 'قيود الإتلاف',
  'stock.quant': 'أرصدة المخزون',
  'purchase.order': 'أوامر الشراء',
  'purchase.order.line': 'بنود أوامر الشراء',
  'product.product': 'بطاقات الأصناف',
  'product.product (standard_price)': 'بطاقات الأصناف (التكلفة المعيارية)',
  'product.template': 'قوالب الأصناف',
  'mrp.bom': 'قوائم المكونات',
  'mrp.bom / mrp.bom.line': 'قوائم المكونات وبنودها',
  'hr.attendance': 'سجلات الحضور والانصراف',
  'hr.attendance.overtime / resource.calendar': 'سجل العمل الإضافي وجداول الورديات',
  'hr.employee': 'سجلات الموظفين',
  'hr.employee (work_location_id)': 'سجلات الموظفين (موقع العمل)',
  'res.company': 'إعدادات الشركة',
  'res.company (period_lock_date)': 'إعدادات الشركة (تاريخ قفل الفترة)',
}

export function localizeOdooModelAr(rawModel?: string | null): string {
  const trimmed = (rawModel ?? '').trim()
  if (!trimmed || trimmed === 'unspecified' || trimmed === 'غير محدد' || trimmed === '—') {
    return 'غير محدد'
  }
  const exact = ODOO_MODEL_AR_MAP[trimmed.toLowerCase()]
  if (exact) return exact
  return trimmed
    .replace(/\bpos\.order\.line\b/gi, 'بنود طلبات نقاط البيع')
    .replace(/\bpos\.order\b/gi, 'طلبات نقاط البيع')
    .replace(/\bpos\.payment\b/gi, 'مدفوعات نقاط البيع')
    .replace(/\bpos\.config\b/gi, 'أجهزة نقاط البيع')
    .replace(/\bpos\.session\b/gi, 'جلسات نقاط البيع')
    .replace(/\baccount\.move\.line\b/gi, 'قيود دفتر الأستاذ العام')
    .replace(/\baccount\.move\b/gi, 'فواتير وقيود المحاسبة')
    .replace(/\bpurchase\.order\.line\b/gi, 'بنود أوامر الشراء')
    .replace(/\bpurchase\.order\b/gi, 'أوامر الشراء')
    .replace(/\bproduct\.product\b/gi, 'بطاقات الأصناف')
    .replace(/\bproduct\.template\b/gi, 'قوالب الأصناف')
    .replace(/\bmrp\.bom\.line\b/gi, 'بنود قوائم المكونات')
    .replace(/\bmrp\.bom\b/gi, 'قوائم المكونات')
    .replace(/\bstock\.scrap\b/gi, 'قيود الإتلاف')
    .replace(/\bstock\.move\b/gi, 'حركات المخزون')
    .replace(/\bstock\.quant\b/gi, 'أرصدة المخزون')
    .replace(/\bhr\.attendance\.overtime\b/gi, 'سجل العمل الإضافي')
    .replace(/\bhr\.attendance\b/gi, 'سجلات الحضور والانصراف')
    .replace(/\bhr\.employee\b/gi, 'سجلات الموظفين')
    .replace(/\bresource\.calendar\b/gi, 'جداول الورديات')
    .replace(/\bres\.company\b/gi, 'إعدادات الشركة')
    .replace(/\(scrap\)/gi, '(الإتلاف)')
    .replace(/\(consumption\)/gi, '(الاستهلاك)')
    .replace(/\(standard_price\)/gi, '(التكلفة المعيارية)')
    .replace(/\(period_lock_date\)/gi, '(تاريخ قفل الفترة)')
    .replace(/\(work_location_id\)/gi, '(موقع العمل)')
}

const EXACT_FORMULA_AR_MAP: Record<string, string> = {
  'netsaleskwd / orders': 'صافي المبيعات بالدينار ÷ عدد الطلبات المقبوضة',
  'max(pos.order net sales by mapped branch)':
    'أعلى فرع مربوط من حيث صافي مبيعات نقاط البيع خلال الفترة',
  "account.move.line(parent_state='posted'): income - cogs - deliverycommissions - opex - depreciation":
    'قيود الأستاذ العام المرحّلة: الإيرادات − تكلفة البضاعة المباعة − عمولات التوصيل − المصروفات التشغيلية − الإهلاك',
  "account.move.line(parent_state='posted'): income, expense_direct_cost, expense":
    'قيود الأستاذ العام المرحّلة: الإيرادات وتكلفة البضاعة المباعة والمصروفات التشغيلية',
  "account.move.line(parent_state='posted', delivery commission expense accounts)":
    'قيود الأستاذ العام المرحّلة لحسابات مصروف عمولات منصات التوصيل',
  "account.move.line aggregator commission expense accounts (parent_state='posted')":
    'قيود الأستاذ العام المرحّلة لحسابات مصروف عمولات منصات التوصيل',
  "pos.order.read_group(groupby=['config_id']) mapped via pos-registry.json + unattributed bucket":
    'تجميع طلبات نقاط البيع حسب جهاز الكاشير وربطها بسجل الفروع المعتمد مع فصل غير المنسوب',
  'pos.order daily series grouped by asia/kuwait calendar day':
    'السلسلة اليومية لطلبات نقاط البيع مجمّعة حسب اليوم التقويمي بتوقيت الكويت',
  "account.move.line(account_type='asset_receivable', parent_state='posted', reconciled=false) -> sum(amount_residual)":
    'مجموع الرصيد المتبقي على حسابات الذمم المدينة المرحّلة غير المسوّاة',
  "sum(amount_residual) where account_type = 'asset_receivable' and reconciled = false":
    'مجموع الرصيد المتبقي على حسابات الذمم المدينة غير المسوّاة',
  'pos.order net sales per day/branch + account.move.line posted operating profit ratio':
    'صافي مبيعات نقاط البيع لكل يوم أو فرع مع نسبة صافي الربح التشغيلي المرحّل في الأستاذ العام',
  '(cogs + deliverycommissions + opexrentdepr + operatingprofit) / revenue * 10 kwd':
    '(تكلفة البضاعة المباعة + عمولات التوصيل + المصروفات والإيجار والإهلاك + الربح التشغيلي) ÷ الإيرادات × 10 د.ك',
  "sum(credit - debit) on income accounts where parent_state = 'posted'":
    'مجموع (الدائن − المدين) على حسابات الإيرادات للقيود المرحّلة',
  'pos.order net sales across mapped venture foods branches':
    'صافي مبيعات نقاط البيع عبر فروع فنتشر فودز المربوطة',
  "sum(debit - credit) on direct_cost accounts where parent_state = 'posted'":
    'مجموع (المدين − الدائن) على حسابات تكلفة البضاعة المباعة للقيود المرحّلة',
  "sum(debit - credit) on expense + expense_depreciation accounts where parent_state = 'posted'":
    'مجموع (المدين − الدائن) على حسابات المصروفات التشغيلية والإهلاك المرحّلة',
  'sum(amount_residual > 0) on asset_receivable':
    'مجموع الأرصدة المتبقية الموجبة على حسابات الذمم المدينة',
  'abs(sum(amount_residual < 0)) on asset_receivable':
    'القيمة المطلقة لمجموع الأرصدة الدائنة غير المطبّقة على حسابات الذمم المدينة',
  'pos.order.read_group':
    'تجميع صافي مبيعات طلبات نقاط البيع لفروع الشركة المعتمدة',
  'posted revenue - cogs - aggregator commissions - posted opex & depreciation':
    'الإيراد المرحّل − تكلفة البضاعة المباعة − عمولات التوصيل − المصروفات والإهلاك المرحّلة',
  'revenue - cogs - deliverycommissions - opex - depreciation':
    'الإيرادات المرحّلة − تكلفة البضاعة المباعة − عمولات التوصيل − المصروفات التشغيلية − الإهلاك',
  'open residual': 'رصيد متبقٍ غير مسوّى',
}

export function localizeQueryOrFormulaAr(
  rawQueryOrFormula: string | undefined,
  suppliedModel = '',
  rangeStr = '',
): string {
  const trimmed = (rawQueryOrFormula ?? '').trim()
  const modelAr = localizeOdooModelAr(suppliedModel)
  if (!trimmed) {
    return rangeStr ? `${modelAr} [${rangeStr}]` : modelAr
  }

  const normalizedKey = trimmed.replace(/\s+/g, ' ').toLowerCase()
  const exact = EXACT_FORMULA_AR_MAP[normalizedKey]
  if (exact) return exact

  if (/^pos\.order\.read_group\(/i.test(trimmed)) {
    if (/config_id/i.test(trimmed) && /groupby/i.test(trimmed)) {
      return 'تجميع طلبات نقاط البيع حسب جهاز الكاشير وربطها بسجل الفروع المعتمد مع فصل غير المنسوب'
    }
    return 'مجموع (إجمالي الطلب − الضريبة) لطلبات نقاط البيع المدفوعة والمرحّلة لفروع الشركة المعتمدة'
  }
  if (/^pos\.order\.search_count\(/i.test(trimmed)) {
    return 'عدد طلبات نقاط البيع المدفوعة غير المستردة لفروع الشركة المعتمدة'
  }

  // If already pure Arabic with zero Latin characters, normalize any stray COGS mention and return
  if (/[\u0600-\u06FF]/.test(trimmed) && !/[A-Za-z]/.test(trimmed)) {
    return trimmed
  }

  return trimmed
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\(COGS\)/gi, 'تكلفة البضاعة المباعة')
    .replace(/\bcost of goods sold\b/gi, 'تكلفة البضاعة المباعة')
    .replace(/\bgross margin\b/gi, 'هامش مجمل الربح')
    .replace(/\bgross profit\b/gi, 'مجمل الربح')
    .replace(/\boperating\s*profit\b/gi, 'الربح التشغيلي')
    .replace(/\bdelivery\s*commissions\b/gi, 'عمولات التوصيل')
    .replace(/\baggregator\s*commissions\b/gi, 'عمولات منصات التوصيل')
    .replace(/\bopexrentdepr\b/gi, 'المصروفات والإيجار والإهلاك')
    .replace(/\bposted\s*revenue\b/gi, 'الإيراد المرحّل')
    .replace(/\brevenue\b/gi, 'الإيرادات')
    .replace(/\bincome\s*accounts?\b/gi, 'حسابات الإيرادات')
    .replace(/\bdirect_cost\s*accounts?\b/gi, 'حسابات التكلفة المباشرة')
    .replace(/\bexpense_direct_cost\b/gi, 'تكلفة البضاعة المباعة')
    .replace(/\bexpense_depreciation\b/gi, 'مصروف الإهلاك')
    .replace(/\basset_receivable\b/gi, 'حسابات الذمم المدينة')
    .replace(/\bcogs\b/gi, 'تكلفة البضاعة المباعة')
    .replace(/\bopex\b/gi, 'المصروفات التشغيلية')
    .replace(/\bdepreciation\b/gi, 'الإهلاك')
    .replace(/\bincome\b/gi, 'الإيرادات')
    .replace(/\bexpense\s*accounts?\b/gi, 'حسابات المصروفات')
    .replace(/\bexpense\b/gi, 'المصروفات')
    .replace(/\bpos\.order\.line\b/gi, 'بنود طلبات نقاط البيع')
    .replace(/\bpos\.order\.read_group\b/gi, 'تجميع طلبات نقاط البيع')
    .replace(/\bpos\.order\.search_count\b/gi, 'عدد طلبات نقاط البيع')
    .replace(/\bpos\.order\b/gi, 'طلبات نقاط البيع')
    .replace(/\bpos\.payment\b/gi, 'مدفوعات نقاط البيع')
    .replace(/\bpos\.config\b/gi, 'أجهزة نقاط البيع')
    .replace(/\baccount\.move\.line\b/gi, 'قيود دفتر الأستاذ العام')
    .replace(/\baccount\.move\b/gi, 'قيود المحاسبة')
    .replace(/\bpurchase\.order\.line\b/gi, 'بنود أوامر الشراء')
    .replace(/\bpurchase\.order\b/gi, 'أوامر الشراء')
    .replace(/\bstock\.move\b/gi, 'حركات المخزون')
    .replace(/\bprice_subtotal_incl\b/gi, 'الإجمالي شامل الضريبة')
    .replace(/\bprice_subtotal\b/gi, 'صافي قيمة البند')
    .replace(/\bamount_residual\b/gi, 'الرصيد المتبقي')
    .replace(/\bamount_total\b/gi, 'إجمالي الطلب')
    .replace(/\bamount_tax\b/gi, 'الضريبة')
    .replace(/\bstandard_price\b/gi, 'التكلفة المعيارية')
    .replace(/\bnetsaleskwd\b/gi, 'صافي المبيعات')
    .replace(/\bnet\s*sales\b/gi, 'صافي المبيعات')
    .replace(/\bsettled\s*orders\b/gi, 'الطلبات المقبوضة')
    .replace(/\borders\b/gi, 'الطلبات')
    .replace(/\bparent_state\s*=\s*['"]?posted['"]?/gi, 'الحالة = مرحّل')
    .replace(/\breconciled\s*=\s*false\b/gi, 'غير مسوّى')
    .replace(/\bposted\b/gi, 'المرحّلة')
    .replace(/\bcredit\b/gi, 'الدائن')
    .replace(/\bdebit\b/gi, 'المدين')
    .replace(/\baccounts?\b/gi, 'الحسابات')
    .replace(/\babs\s*\(/gi, 'القيمة المطلقة(')
    .replace(/\bsum\s*\(/gi, 'مجموع(')
    .replace(/\bavg\s*\(/gi, 'متوسط(')
    .replace(/\bmax\s*\(/gi, 'أعلى(')
    .replace(/\bmin\s*\(/gi, 'أدنى(')
    .replace(/\bcount\s*\(/gi, 'عدد(')
    .replace(/\bwhere\b/gi, 'حيث')
    .replace(/\band\b/gi, 'و')
    .replace(/\bor\b/gi, 'أو')
    .replace(/\bon\b/gi, 'على')
    .replace(/\bkwd\b/gi, 'د.ك')
    .replace(/->/g, '←')
    .replace(/\s*\*\s*/g, ' × ')
    .replace(/\s*\/\s*/g, ' ÷ ')
    .replace(/\s*-\s*/g, ' − ')
    .replace(/\s+/g, ' ')
    .trim()
}

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
    .replace(
      /event days \(max (\d+)\),\s*previous occurrence/gi,
      'أيام المناسبة (بحد أقصى $1)، حسب المرة السابقة',
    )
    .replace(/event days \(max (\d+)\)/gi, 'أيام المناسبة (بحد أقصى $1)')
    .replace(/,\s*previous occurrence\b/gi, '، حسب المرة السابقة')
    .replace(/\bprevious occurrence\b/gi, 'المرة السابقة')
    .replace(/\bevent days\b/gi, 'أيام المناسبة')
    .replace(/\(max (\d+)\)/gi, '(بحد أقصى $1)')
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
    .replace(/\s*\(AOV\)/gi, '')
    .replace(/\s*\(POS\)/gi, '')
    .replace(/\s*\(GL\)/gi, '')
    .replace(/\s*\(BoM\)/gi, '')
    .replace(/\s*\(Cost\)/gi, '')
    .replace(/\s*\(TGO\/TMP\)/gi, '')
    .replace(/\s*\(check-in\s*\/\s*check-out\)/gi, '')
    .replace(/\s*\(pos\.order\.line\)/gi, '')
    .replace(/\s*\(pos\.order\)/gi, '')
    .replace(/\s*\(pos\.config\)/gi, '')
    .replace(/\s*\(stock\.quant\)/gi, '')
    .replace(/\s*\(mrp\.bom\)/gi, '')
    .replace(/\s*\(account\.move\.line\)/gi, '')
    .replace(/\s*\(work_location_id\)/gi, '')
    .replace(/\s*\(period_lock_date\)/gi, '')
    .replace(/لـ\s*pos\.payment/gi, 'لمدفوعات نقاط البيع')
    .replace(/لـ\s*stock\.quant/gi, 'لأرصدة المخزون')
    .replace(/كـ\s*stock\.scrap/gi, 'كقيد إتلاف في المخزون')
    .replace(/\bpos\.order\.line\b/gi, 'بنود طلبات نقاط البيع')
    .replace(/\bpos\.order\b/gi, 'طلبات نقاط البيع')
    .replace(/\bpos\.payment\b/gi, 'مدفوعات نقاط البيع')
    .replace(/\bpos\.config\b/gi, 'أجهزة نقاط البيع')
    .replace(/\bpos\.session\b/gi, 'جلسات نقاط البيع')
    .replace(/\baccount\.move\.line\b/gi, 'قيود دفتر الأستاذ العام')
    .replace(/\baccount\.move\b/gi, 'قيود المحاسبة')
    .replace(/\bstock\.quant\b/gi, 'أرصدة المخزون')
    .replace(/\bstock\.scrap\b/gi, 'قيود الإتلاف')
    .replace(/\bstock\.move\b/gi, 'حركات المخزون')
    .replace(/\bmrp\.bom\.line\b/gi, 'بنود قوائم المكونات')
    .replace(/\bmrp\.bom\b/gi, 'قوائم المكونات')
    .replace(/\bhr\.attendance\.overtime\b/gi, 'سجل العمل الإضافي')
    .replace(/\bhr\.attendance\b/gi, 'سجل الحضور والانصراف')
    .replace(/\bhr\.employee\b/gi, 'سجل الموظفين')
    .replace(/\bresource\.calendar\b/gi, 'جداول الورديات')
    .replace(/\bres\.company\b/gi, 'إعدادات الشركة')
    .replace(/\bstandard_price\b/gi, 'التكلفة المعيارية')
    .replace(/\(KOUT\)/g, '(الكوت)')
    .replace(/\bKOUT\b/g, 'الكوت')
    .replace(/\bPRM\b/g, 'بروميناد')
    .replace(/\bASM\b/g, 'العاصمة')
    .replace(/\bAVN\b/g, 'الأفنيوز')
    .replace(/\bSLM\b/g, 'السالمية')
    .replace(/\bARD\b/g, 'العارضية')
    .replace(/\bQRN\b/g, 'القرين')
    .replace(/\bCOGS\b/gi, 'تكلفة البضاعة المباعة')
    .replace(/\bOdoo\b/gi, 'أودو')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function localizeEstimateFormulaEn(formula: string): string {
  const trimmed = formula.trim()
  if (!trimmed || !/[\u0600-\u06FF]/.test(trimmed)) return trimmed
  return trimmed
    .replace(/صافي اليوم بالمناسبة/g, 'window per-day net')
    .replace(/صافي اليوم المرجعي/g, 'baseline per-day net')
    .replace(/أيام المناسبة \(بحد أقصى (\d+)\)،\s*حسب المرة السابقة/g, 'event days (max $1), previous occurrence')
    .replace(/أيام المناسبة \(بحد أقصى (\d+)\)/g, 'event days (max $1)')
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

export function computeCollisionAwarePopoverCoords(params: {
  triggerRect: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>
  popoverWidth: number
  popoverHeight: number
  viewportWidth: number
  viewportHeight: number
  isRtl: boolean
  align?: 'start' | 'end'
}): PopoverCoords {
  const {
    triggerRect,
    popoverWidth,
    popoverHeight,
    viewportWidth,
    viewportHeight,
    isRtl,
    align = 'start',
  } = params

  const vw = Math.max(320, viewportWidth)
  const vh = Math.max(240, viewportHeight)
  const clampedWidth = Math.min(
    popoverWidth > 0 ? popoverWidth : FALLBACK_POPOVER_WIDTH,
    Math.max(200, vw - VIEWPORT_MARGIN * 2),
  )
  const clampedHeight = popoverHeight > 0 ? popoverHeight : FALLBACK_POPOVER_HEIGHT

  const lacksSpaceBelow =
    triggerRect.bottom + TRIGGER_GAP + clampedHeight + VIEWPORT_MARGIN > vh
  const hasMoreSpaceAbove = triggerRect.top > vh - triggerRect.bottom
  const shouldFlipUp =
    lacksSpaceBelow &&
    (triggerRect.top - clampedHeight - TRIGGER_GAP >= VIEWPORT_MARGIN ||
      hasMoreSpaceAbove)

  const rawTop = shouldFlipUp
    ? triggerRect.top - clampedHeight - TRIGGER_GAP
    : triggerRect.bottom + TRIGGER_GAP
  const maxTop = Math.max(VIEWPORT_MARGIN, vh - clampedHeight - VIEWPORT_MARGIN)
  const top = Math.round(Math.min(Math.max(VIEWPORT_MARGIN, rawTop), maxTop))

  const prefersRightEdge = isRtl ? align === 'start' : align === 'end'
  let resolvedAlign: 'start' | 'end' = align
  let rawLeft = prefersRightEdge
    ? triggerRect.right - clampedWidth
    : triggerRect.left

  if (prefersRightEdge && rawLeft < VIEWPORT_MARGIN) {
    if (
      triggerRect.left + clampedWidth <= vw - VIEWPORT_MARGIN ||
      vw - triggerRect.left > triggerRect.right
    ) {
      rawLeft = triggerRect.left
      resolvedAlign = align === 'start' ? 'end' : 'start'
    }
  } else if (!prefersRightEdge && rawLeft + clampedWidth > vw - VIEWPORT_MARGIN) {
    if (
      triggerRect.right - clampedWidth >= VIEWPORT_MARGIN ||
      triggerRect.right > vw - triggerRect.left
    ) {
      rawLeft = triggerRect.right - clampedWidth
      resolvedAlign = align === 'start' ? 'end' : 'start'
    }
  }

  const maxLeft = Math.max(VIEWPORT_MARGIN, vw - clampedWidth - VIEWPORT_MARGIN)
  const left = Math.round(Math.min(Math.max(VIEWPORT_MARGIN, rawLeft), maxLeft))

  return {
    top,
    left,
    placement: shouldFlipUp ? 'top' : 'bottom',
    horizontalAlign: resolvedAlign,
  }
}

/**
 * Mandatory KPI Provenance Badge (`src/components/erp/KpiProvenanceBadge.tsx`).
 * Displays for every KPI via a portal-rendered, collision-aware floating popover:
 *   1. Odoo model (`pos.order`, `account.move.line`, `stock.move`, ...)
 *   2. Date range (`from .. to`)
 *   3. Last sync timestamp (`Asia/Kuwait`)
 *   4. Metric type (`فعلي` | `محسوب بمعادلة` | `تقدير`)
 *   5. `قديمة` badge whenever data is older than 24 hours
 *   6. Exact Odoo query or mathematical formula
 */
export function KpiProvenanceBadge({
  odooModel: rawOdooModel,
  model,
  dateRange,
  lastSyncAt,
  isStale24h,
  kind,
  queryOrFormula: rawQueryOrFormula,
  queryOrFormulaAr: rawQueryOrFormulaAr,
  isAr: explicitIsAr,
  compact = false,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className = '',
}: KpiProvenanceBadgeProps) {
  const isAr = useSafeIsAr(explicitIsAr)
  const resolvedDir = isAr ? 'rtl' : 'ltr'
  const suppliedModel = (rawOdooModel || model || '').trim()
  const odooModel = suppliedModel || (isAr ? 'غير محدد' : 'unspecified')
  const displayModel = isAr ? localizeOdooModelAr(suppliedModel) : odooModel
  const kindMeta = normalizeKind(kind)
  const rangeStr =
    typeof dateRange === 'string'
      ? dateRange
      : dateRange.from === dateRange.to
        ? dateRange.from
        : `${dateRange.from} → ${dateRange.to}`
  const queryOrFormula = rawQueryOrFormula || `${odooModel} [${rangeStr}]`
  const displayQueryOrFormula = isAr
    ? rawQueryOrFormulaAr?.trim()
      ? rawQueryOrFormulaAr.trim()
      : localizeQueryOrFormulaAr(rawQueryOrFormula, suppliedModel, rangeStr)
    : queryOrFormula

  const syncInfo = formatSyncShort(lastSyncAt)
  const stale = Boolean(isStale24h || syncInfo.computedStale24h)

  const accessibleSummary = isAr
    ? [
        `النوع: ${kindMeta.ar}`,
        `المصدر في أودو: ${displayModel}`,
        `نطاق التاريخ: ${rangeStr}`,
        `آخر مزامنة: ${syncInfo.labelAr}${stale ? ' (قديمة > 24 ساعة)' : ''}`,
        `المعادلة: ${displayQueryOrFormula}`,
      ].join(' | ')
    : [
        `Type: ${kindMeta.en}`,
        `Odoo Model: ${odooModel}`,
        `Date Range: ${rangeStr}`,
        `Last Sync: ${syncInfo.labelEn}${stale ? ' (Stale > 24h)' : ''}`,
        `Query / Formula: ${queryOrFormula}`,
      ].join(' | ')

  const [internalOpen, setInternalOpen] = useState<boolean>(defaultOpen)
  const [coords, setCoords] = useState<PopoverCoords>({
    top: VIEWPORT_MARGIN,
    left: VIEWPORT_MARGIN,
    placement: 'bottom',
    horizontalAlign: 'start',
  })

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setInternalOpen(next)
      }
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  const updatePosition = useCallback(() => {
    if (typeof window === 'undefined' || !triggerRef.current) return
    const triggerRect = triggerRef.current.getBoundingClientRect()
    const popRect = panelRef.current?.getBoundingClientRect()
    const next = computeCollisionAwarePopoverCoords({
      triggerRect,
      popoverWidth: popRect?.width ?? FALLBACK_POPOVER_WIDTH,
      popoverHeight: popRect?.height ?? FALLBACK_POPOVER_HEIGHT,
      viewportWidth:
        window.innerWidth || document.documentElement?.clientWidth || 1024,
      viewportHeight:
        window.innerHeight || document.documentElement?.clientHeight || 768,
      isRtl: isAr,
    })
    setCoords((prev) =>
      prev.top === next.top &&
      prev.left === next.left &&
      prev.placement === next.placement &&
      prev.horizontalAlign === next.horizontalAlign
        ? prev
        : next,
    )
  }, [isAr])

  useIsomorphicLayoutEffect(() => {
    if (!open || typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }
    updatePosition()
    const raf = window.requestAnimationFrame(() => updatePosition())
    const handleReposition = () => updatePosition()
    window.addEventListener('scroll', handleReposition, {
      capture: true,
      passive: true,
    })
    window.addEventListener('resize', handleReposition, { passive: true })
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('scroll', handleReposition, { capture: true })
      window.removeEventListener('resize', handleReposition)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onOutsidePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target)) return
      if (rootRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onOutsidePointer)
    document.addEventListener('touchstart', onOutsidePointer, { passive: true })
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onOutsidePointer)
      document.removeEventListener('touchstart', onOutsidePointer)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, setOpen])

  const triggerText = isAr ? 'التفاصيل' : 'Details'

  const popoverPanel = open ? (
    <div
      ref={panelRef}
      id={panelId}
      role="tooltip"
      dir={resolvedDir}
      data-kpi-provenance-portal="true"
      data-placement={coords.placement}
      data-horizontal-align={coords.horizontalAlign}
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 9999,
      }}
      className="fixed z-50 w-72 max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200/90 bg-white/98 p-3.5 text-start text-xs text-slate-700 tabular-nums shadow-[0_20px_48px_-12px_rgba(15,23,42,0.24)] backdrop-blur-xl ring-1 ring-slate-900/[0.05]"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cx(
            'inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-bold ring-1',
            kindMeta.toneClass,
          )}
        >
          {isAr ? kindMeta.ar : kindMeta.en}
        </span>

        <span
          dir={isAr ? 'rtl' : 'ltr'}
          className={cx(
            'inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-900/10',
            !isAr && 'font-mono',
          )}
        >
          {displayModel}
        </span>

        {stale ? (
          <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-yellow-100 px-1.5 py-0.5 text-xs font-bold text-yellow-900 ring-1 ring-yellow-500/35">
            {isAr ? 'قديمة' : 'Stale'}
          </span>
        ) : null}
      </div>

      <div className="mt-2 space-y-1 text-xs text-slate-600">
        <div>
          {isAr ? 'النطاق: ' : 'Range: '}
          <span dir="ltr" className="font-mono font-medium tabular-nums text-slate-800">
            {rangeStr}
          </span>
        </div>
        <div>
          {isAr ? 'آخر مزامنة: ' : 'Last sync: '}
          <span dir="ltr" className="font-mono font-medium tabular-nums text-slate-800">
            {isAr ? syncInfo.labelAr : syncInfo.labelEn}
          </span>
          {stale ? (isAr ? ' • قديمة (>24 ساعة)' : ' • Stale (>24h)') : ''}
        </div>
      </div>

      <div
        dir={isAr ? 'rtl' : 'ltr'}
        data-kpi-formula="true"
        className={cx(
          'mt-2 break-words rounded-xl bg-slate-100 p-2 text-xs text-slate-800 ring-1 ring-slate-900/[0.06]',
          !isAr && 'font-mono',
        )}
      >
        {displayQueryOrFormula}
      </div>
    </div>
  ) : null

  return (
    <div
      ref={rootRef}
      dir={resolvedDir}
      data-details-popover="true"
      data-kpi-provenance={kindMeta.ar}
      data-odoo-model={odooModel}
      data-kpi-stale={stale ? 'true' : 'false'}
      data-compact={compact ? 'true' : 'false'}
      className={cx(
        'relative inline-flex items-center text-xs leading-tight mt-2 tabular-nums',
        className,
      )}
    >
      <button
        ref={triggerRef}
        type="button"
        data-details-trigger="true"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={accessibleSummary}
        onClick={() => setOpen(!open)}
        className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-slate-300/65 bg-white/75 px-2.5 py-1 text-xs font-semibold text-slate-600 backdrop-blur-sm transition-colors hover:border-slate-400/75 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.12] dark:hover:text-white"
      >
        <span aria-hidden="true">ⓘ</span>
        <span>{triggerText}</span>
      </button>

      {popoverPanel
        ? typeof document !== 'undefined' && document.body
          ? createPortal(popoverPanel, document.body)
          : popoverPanel
        : null}
    </div>
  )
}

export default KpiProvenanceBadge
