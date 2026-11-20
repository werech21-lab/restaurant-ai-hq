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
  'pos.order': 'طلبات نقاط البيع',
  'pos.order.line': 'بنود طلبات نقاط البيع',
  'pos.payment': 'مدفوعات نقاط البيع',
  'pos.config': 'أجهزة نقاط البيع',
  'pos.session': 'جلسات نقاط البيع',
  'account.move.line': 'قيود دفتر الأستاذ العام',
  'account.move': 'فواتير وقيود المحاسبة',
  'stock.move': 'حركات المخزون',
  'stock.quant': 'أرصدة المخزون',
  'purchase.order': 'أوامر الشراء',
  'purchase.order.line': 'بنود أوامر الشراء',
  'hr.attendance': 'سجلات الحضور والانصراف',
  'hr.employee': 'سجلات الموظفين',
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
    .replace(/\bstock\.move\b/gi, 'حركات المخزون')
    .replace(/\bstock\.quant\b/gi, 'أرصدة المخزون')
    .replace(/\bhr\.attendance\b/gi, 'سجلات الحضور والانصراف')
    .replace(/\bhr\.employee\b/gi, 'سجلات الموظفين')
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
