/**
 * Pure, deterministic helpers for AetherBI ERP accuracy & CFO reconciliation:
 * 1. `computePeriodDelta` — Equal-length period-over-period % delta with strict sign/threshold styling
 * 2. `resolveBestBranchBadge` — Prevents "أعلى تحسن" / "Top Lift" on negative branch deltas
 * 3. `sanitizeCampaignName` / `formatCampaignAuditTitle` — Prevents "Campaign: —" / "Campaign: in — in"
 * 4. `isExcludedOdooEntity` — Filters out non-approved legacy brand & decommissioned warehouse records
 * 5. `getKuwaitTodayIso` / `clampPeriodToKuwaitToday` / `sliceDailySeriesToPeriod` — Strict Kuwait period slicing
 */

export type PeriodDeltaTone = 'green' | 'red' | 'neutral'
export type PeriodDeltaArrow = '▲' | '▼' | '•'

export interface PeriodDeltaResult {
  deltaPct: number
  rawDeltaPct: number
  arrow: PeriodDeltaArrow
  tone: PeriodDeltaTone
  formattedPct: string
  badgeLabel: string
}

export const UNMAPPED_TERMINALS_ROW_ID = 'unmapped-terminals' as const
export const UNMAPPED_TERMINALS_LABEL_AR = 'غير منسوب لفرع'
export const UNMAPPED_TERMINALS_LABEL_EN = 'Unattributed to Branch'

const KUWAIT_UTC_OFFSET_MS = 3 * 3600 * 1000

/**
 * Computes exact period-over-period percentage delta:
 *   `((current - prior) / prior) * 100`
 *
 * Strict arrow & tone rules:
 * - `deltaPct >= 0.5`  -> `▲` + `+X.X%` (`green`)
 * - `deltaPct <= -0.5` -> `▼` + `-X.X%` (`red`)
 * - `|deltaPct| < 0.5` -> `•` + `±X.X%` (`neutral` gray)
 * - `prior <= 0`       -> `•` + `±0.0%` (`neutral` gray, safe zero-division guard)
 */
export function computePeriodDelta(current: number, prior: number): PeriodDeltaResult {
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior <= 0) {
    return {
      deltaPct: 0,
      rawDeltaPct: 0,
      arrow: '•',
      tone: 'neutral',
      formattedPct: '±0.0%',
      badgeLabel: '• ±0.0%',
    }
  }

  const rawDeltaPct = ((current - prior) / prior) * 100
  const deltaPct = Math.round(rawDeltaPct * 10) / 10

  if (deltaPct >= 0.5) {
    const formattedPct = `+${deltaPct.toFixed(1)}%`
    return {
      deltaPct,
      rawDeltaPct,
      arrow: '▲',
      tone: 'green',
      formattedPct,
      badgeLabel: `▲ ${formattedPct}`,
    }
  }

  if (deltaPct <= -0.5) {
    const formattedPct = `${deltaPct.toFixed(1)}%`
    return {
      deltaPct,
      rawDeltaPct,
      arrow: '▼',
      tone: 'red',
      formattedPct,
      badgeLabel: `▼ ${formattedPct}`,
    }
  }

  const absFixed = Math.abs(deltaPct).toFixed(1)
  const formattedPct = `±${absFixed}%`
  return {
    deltaPct,
    rawDeltaPct,
    arrow: '•',
    tone: 'neutral',
    formattedPct,
    badgeLabel: `• ${formattedPct}`,
  }
}

export interface BestBranchBadgeResult {
  labelAr: string
  labelEn: string
  tone: 'emerald' | 'neutral'
}

/**
 * Resolves the top-performing branch badge on `/erp/before-after` & comparison views:
 * - `bestBranchDelta > 0`  -> `"أعلى تحسن"` / `"Top Lift"` (`emerald`)
 * - `bestBranchDelta < 0`  -> `"أقل تراجع"` / `"Least Decline"` (`neutral` gray/slate)
 * - `bestBranchDelta === 0` -> `"بدون تغير"` / `"Unchanged"` (`neutral` gray/slate)
 */
export function resolveBestBranchBadge(bestBranchDelta: number): BestBranchBadgeResult {
  if (Number.isFinite(bestBranchDelta) && bestBranchDelta > 0) {
    return {
      labelAr: 'أعلى تحسن',
      labelEn: 'Top Lift',
      tone: 'emerald',
    }
  }
  if (Number.isFinite(bestBranchDelta) && bestBranchDelta < 0) {
    return {
      labelAr: 'أقل تراجع',
      labelEn: 'Least Decline',
      tone: 'neutral',
    }
  }
  return {
    labelAr: 'بدون تغير',
    labelEn: 'Unchanged',
    tone: 'neutral',
  }
}

const BROKEN_CAMPAIGN_PATTERNS: readonly RegExp[] = [
  /^[\s—–\-_:.,|/\\()[\]]*$/,
  /^(?:n\/a|na|none|null|undefined|nil)$/i,
  /^(?:بدون\s*حملة|no\s*campaign)$/i,
  /\bin\s*[—–\-]+\s*in\b/i,
  /^(?:campaign|ad|حملة|إعلان)\s*:\s*(?:[—–\-]+|in\s*[—–\-]+\s*in)?\s*$/i,
]

const KNOWN_AR_TO_EN_CAMPAIGN_TITLES: Readonly<Record<string, string>> = {
  'تغطية بلوقر مطاعم الكويت — داينمايت شرمب ونودلز':
    'Kuwait Food Blogger Feature — Dynamite Shrimp & Noodles',
  'فيديو تيك توك وريلز — فيلي ستيك على الصاج':
    'TikTok & Reels Video — Grilled Philly Cheesesteak',
  'إعلان سناب شات — وجبات كرسبي وساندويتشات':
    'Snapchat Ad — Crispy Chicken Combos & Sandwiches',
  'إعلان نقرات ممول بدون حد أدنى للطلب':
    'Sponsored In-App Clicks (No Minimum Order)',
}

export function isBrokenOrEmptyCampaignName(raw: string | null | undefined): boolean {
  if (typeof raw !== 'string') return true
  const trimmed = raw.trim()
  if (!trimmed) return true
  const withoutPrefix = trimmed
    .replace(/^(?:campaign|ad|حملة|إعلان)\s*:\s*/i, '')
    .replace(/\([^)]*\)\s*$/, '')
    .trim()
  if (!withoutPrefix) return true
  return BROKEN_CAMPAIGN_PATTERNS.some((re) => re.test(trimmed) || re.test(withoutPrefix))
}

/**
 * Sanitizes a campaign title so missing, empty, or broken placeholders
 * (`"—"`, `"Campaign: —"`, `"Campaign: in — in"`) always resolve to:
 * - Arabic: `"بدون حملة"`
 * - English: `"No campaign"`
 */
export function sanitizeCampaignName(
  raw: string | null | undefined,
  isAr: boolean,
  explicitEn?: string | null,
): string {
  const fallback = isAr ? 'بدون حملة' : 'No campaign'
  const candidate = !isAr && explicitEn && !isBrokenOrEmptyCampaignName(explicitEn) ? explicitEn : raw
  if (isBrokenOrEmptyCampaignName(candidate)) {
    return fallback
  }
  const cleaned = String(candidate).trim()
  if (!isAr && KNOWN_AR_TO_EN_CAMPAIGN_TITLES[cleaned]) {
    return KNOWN_AR_TO_EN_CAMPAIGN_TITLES[cleaned]
  }
  return cleaned
}

/**
 * Formats an executive audit row / selector title for a campaign.
 * When the campaign name is missing or empty, returns exact `"بدون حملة"` / `"No campaign"`.
 */
export function formatCampaignAuditTitle(
  rawCampaignName: string | null | undefined,
  brandLabel: string | null | undefined,
  isAr: boolean,
  options?: {
    explicitNameEn?: string | null
    prefixAr?: string
    prefixEn?: string
  },
): string {
  const candidate =
    !isAr && options?.explicitNameEn && !isBrokenOrEmptyCampaignName(options.explicitNameEn)
      ? options.explicitNameEn
      : rawCampaignName

  if (isBrokenOrEmptyCampaignName(candidate)) {
    return isAr ? 'بدون حملة' : 'No campaign'
  }

  const cleanTitle = sanitizeCampaignName(rawCampaignName, isAr, options?.explicitNameEn)
  const prefix = isAr ? (options?.prefixAr ?? 'حملة') : (options?.prefixEn ?? 'Campaign')
  const cleanBrand = (brandLabel ?? '').trim()
  return cleanBrand ? `${prefix}: ${cleanTitle} (${cleanBrand})` : `${prefix}: ${cleanTitle}`
}

import { isExcludedOdooEntity, isExcludedRecordId } from '@/lib/odoo/excluded-entities'

export { isExcludedOdooEntity, isExcludedRecordId }

/** Current calendar date (`YYYY-MM-DD`) in `Asia/Kuwait` (`UTC+3`). */
export function getKuwaitTodayIso(referenceNowMs = Date.now()): string {
  const safeMs = Number.isFinite(referenceNowMs) ? referenceNowMs : Date.now()
  return new Date(safeMs + KUWAIT_UTC_OFFSET_MS).toISOString().slice(0, 10)
}

/** Enforces `period.to <= today` (Kuwait time) and `period.from <= period.to`. */
export function clampPeriodToKuwaitToday(
  period: { from: string; to: string },
  referenceNowMs = Date.now(),
): { from: string; to: string; todayKwIso: string } {
  const todayKwIso = getKuwaitTodayIso(referenceNowMs)
  const isoRe = /^\d{4}-\d{2}-\d{2}$/
  let to = isoRe.test(period.to) ? period.to : todayKwIso
  if (to > todayKwIso) {
    to = todayKwIso
  }
  let from = isoRe.test(period.from) ? period.from : to
  if (from > to) {
    from = to
  }
  return { from, to, todayKwIso }
}

/** Slices `dailySeries` strictly to `[period.from, period.to]` with `period.to <= today` (Kuwait). */
export function sliceDailySeriesToPeriod<T extends { day: string }>(
  dailySeries: readonly T[] | undefined | null,
  period: { from: string; to: string },
  referenceNowMs = Date.now(),
): T[] {
  if (!Array.isArray(dailySeries) || dailySeries.length === 0) return []
  const clamped = clampPeriodToKuwaitToday(period, referenceNowMs)
  return dailySeries
    .filter((row) => row.day >= clamped.from && row.day <= clamped.to)
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))
}

/** Formats admin-only unmapped sales alert banner copy in Arabic & English. */
export function formatAdminUnmappedAlertCopy(unmappedNetKwd: number, isAr: boolean): string {
  const rounded = Math.round(Math.max(0, unmappedNetKwd)).toLocaleString('en-US')
  return isAr
    ? `${rounded} د.ك من مبيعات الشركة غير مربوطة بفرع`
    : `${rounded} KWD of company sales are not mapped to a branch`
}

export interface EqualPeriodComparisonInput {
  period: 'today' | 'week' | 'month' | 'year' | 'custom'
  workspaceSalesKwd: number
  isUnfilteredCompanyScope: boolean
  customFrom?: string
  customTo?: string
  journeyPulse?: {
    rolling30?: { netKwd: number; days?: number }
    prior30?: { netKwd: number; days?: number }
  } | null
  bucketPeriodComparison?: {
    currentNetKwd: number
    priorNetKwd: number
    days: number
  } | null
  fullDailySeries?: readonly { day: string; netKwd: number; orders?: number }[] | null
  liveConnected?: boolean
  referenceNowMs?: number
  sameHoursLikeForLike?: boolean
}

export interface KuwaitTimeContext {
  todayIso: string
  yesterdayIso: string
  hhMm: string
  hour24: number
  minute: number
}

function shiftIsoDays(isoDate: string, deltaDays: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00.000Z`)
  if (!Number.isFinite(ms)) return isoDate
  return new Date(ms + deltaDays * 86_400_000).toISOString().slice(0, 10)
}

export function getKuwaitTimeContext(referenceNowMs = Date.now()): KuwaitTimeContext {
  const safeMs = Number.isFinite(referenceNowMs) ? referenceNowMs : Date.now()
  const kwDate = new Date(safeMs + KUWAIT_UTC_OFFSET_MS)
  const todayIso = kwDate.toISOString().slice(0, 10)
  const yesterdayIso = shiftIsoDays(todayIso, -1)
  const hour24 = kwDate.getUTCHours()
  const minute = kwDate.getUTCMinutes()
  const hhMm = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  return { todayIso, yesterdayIso, hhMm, hour24, minute }
}

/**
 * Resolves equal-length `(current, prior)` sales totals (`30d` vs `prior 30d`, `7d` vs `prior 7d`,
 * `1d` vs `prior 1d`, `Nd` vs `prior Nd`) and returns `computePeriodDelta(current, prior)`.
 * By default (`!sameHoursLikeForLike`), excludes incomplete `today` in `Asia/Kuwait` so comparison
 * windows end cleanly at the last completed calendar day (`yesterday`).
 */
export function resolveEqualPeriodSalesDelta(
  input: EqualPeriodComparisonInput,
): PeriodDeltaResult & { currentKwd: number; priorKwd: number } {
  const {
    period,
    workspaceSalesKwd,
    isUnfilteredCompanyScope,
    customFrom,
    customTo,
    journeyPulse,
    bucketPeriodComparison,
    fullDailySeries,
    liveConnected,
    referenceNowMs,
    sameHoursLikeForLike,
  } = input

  const kwCtx = getKuwaitTimeContext(referenceNowMs)
  const activeIncompleteTodayIso = kwCtx.todayIso

  const rolling30Net = Number(journeyPulse?.rolling30?.netKwd ?? 0)
  const prior30Net = Number(journeyPulse?.prior30?.netKwd ?? 0)
  const validRolling30 =
    (journeyPulse?.rolling30?.days ?? 30) >= 28 &&
    (journeyPulse?.prior30?.days ?? 30) >= 28 &&
    rolling30Net > 50_000 &&
    prior30Net > 50_000
  const rollingRatio = validRolling30 ? prior30Net / rolling30Net : null

  const sortedDays = Array.isArray(fullDailySeries)
    ? [...fullDailySeries]
        .filter(
          (d) =>
            Number(d.netKwd) > 0 &&
            (sameHoursLikeForLike === true ||
              (d.day < activeIncompleteTodayIso && d.day < kwCtx.todayIso)),
        )
        .sort((a, b) => a.day.localeCompare(b.day))
    : []

  let currentKwd = Math.max(0, Number(workspaceSalesKwd) || 0)
  let priorKwd = 0

  if (period === 'month') {
    if (isUnfilteredCompanyScope && validRolling30) {
      currentKwd = rolling30Net
      priorKwd = prior30Net
    } else if (
      isUnfilteredCompanyScope &&
      bucketPeriodComparison &&
      bucketPeriodComparison.currentNetKwd > 0 &&
      bucketPeriodComparison.priorNetKwd > 0
    ) {
      currentKwd = bucketPeriodComparison.currentNetKwd
      priorKwd = bucketPeriodComparison.priorNetKwd
    } else if (rollingRatio !== null && currentKwd > 0) {
      priorKwd = currentKwd * rollingRatio
    }
  } else if (period === 'week') {
    if (
      bucketPeriodComparison &&
      bucketPeriodComparison.currentNetKwd > 0 &&
      bucketPeriodComparison.priorNetKwd > 0
    ) {
      if (isUnfilteredCompanyScope) {
        currentKwd = bucketPeriodComparison.currentNetKwd
        priorKwd = bucketPeriodComparison.priorNetKwd
      } else {
        const weekRatio =
          bucketPeriodComparison.priorNetKwd / bucketPeriodComparison.currentNetKwd
        priorKwd = currentKwd * weekRatio
      }
    } else if (sortedDays.length >= 14) {
      const cur7 = sortedDays.slice(-7).reduce((s, d) => s + d.netKwd, 0)
      const prev7 = sortedDays.slice(-14, -7).reduce((s, d) => s + d.netKwd, 0)
      if (isUnfilteredCompanyScope && cur7 > 0 && prev7 > 0) {
        currentKwd = cur7
        priorKwd = prev7
      } else if (cur7 > 0 && prev7 > 0) {
        priorKwd = currentKwd * (prev7 / cur7)
      }
    } else if (rollingRatio !== null && currentKwd > 0) {
      priorKwd = currentKwd * rollingRatio
    }
  } else if (period === 'today') {
    if (
      bucketPeriodComparison &&
      bucketPeriodComparison.currentNetKwd > 0 &&
      bucketPeriodComparison.priorNetKwd > 0
    ) {
      if (isUnfilteredCompanyScope) {
        currentKwd = bucketPeriodComparison.currentNetKwd
        priorKwd = bucketPeriodComparison.priorNetKwd
      } else {
        const dayRatio =
          bucketPeriodComparison.priorNetKwd / bucketPeriodComparison.currentNetKwd
        priorKwd = currentKwd * dayRatio
      }
    } else if (sortedDays.length >= 2) {
      const cur1 = sortedDays[sortedDays.length - 1].netKwd
      const prev1 = sortedDays[sortedDays.length - 2].netKwd
      if (isUnfilteredCompanyScope && cur1 > 0 && prev1 > 0) {
        currentKwd = cur1
        priorKwd = prev1
      } else if (cur1 > 0 && prev1 > 0) {
        priorKwd = currentKwd * (prev1 / cur1)
      }
    } else if (rollingRatio !== null && currentKwd > 0) {
      priorKwd = currentKwd * rollingRatio
    }
  } else if (period === 'custom' && customFrom && customTo) {
    const startIso = customFrom <= customTo ? customFrom : customTo
    const endIso = customFrom <= customTo ? customTo : customFrom
    const spanDays = Math.max(
      1,
      Math.round(
        (Date.parse(`${endIso}T00:00:00Z`) - Date.parse(`${startIso}T00:00:00Z`)) / 86_400_000,
      ) + 1,
    )
    const priorEndIso = shiftIsoDays(startIso, -1)
    const priorStartIso = shiftIsoDays(startIso, -spanDays)
    const curDays = sortedDays.filter((d) => d.day >= startIso && d.day <= endIso)
    const prevDays = sortedDays.filter((d) => d.day >= priorStartIso && d.day <= priorEndIso)
    if (curDays.length > 0 && prevDays.length === curDays.length) {
      const curSum = curDays.reduce((s, d) => s + d.netKwd, 0)
      const prevSum = prevDays.reduce((s, d) => s + d.netKwd, 0)
      if (isUnfilteredCompanyScope && curSum > 0 && prevSum > 0) {
        currentKwd = curSum
        priorKwd = prevSum
      } else if (curSum > 0 && prevSum > 0) {
        priorKwd = currentKwd * (prevSum / curSum)
      }
    } else if (rollingRatio !== null && currentKwd > 0) {
      priorKwd = currentKwd * rollingRatio
    }
  } else if (rollingRatio !== null && currentKwd > 0) {
    priorKwd = currentKwd * rollingRatio
  }

  return {
    ...computePeriodDelta(currentKwd, priorKwd),
    currentKwd,
    priorKwd,
  }
}

const BRANCH_LABELS_BY_ID: Readonly<Record<string, { labelEn: string; labelAr: string }>> = {
  '360-mall': { labelEn: '360 Mall', labelAr: 'مول 360' },
  promenade: { labelEn: 'Promenade Mall', labelAr: 'مجمع البروميناد' },
  ardiya: { labelEn: 'Ardiya', labelAr: 'العارضية' },
  assima: { labelEn: 'Assima Mall', labelAr: 'مجمع العاصمة' },
  salmiya: { labelEn: 'Salmiya', labelAr: 'السالمية' },
  'al-kout': { labelEn: 'Al-Kout Mall', labelAr: 'مجمع الكوت' },
  avenues: { labelEn: 'The Avenues', labelAr: 'الأفنيوز' },
}

export const VERIFIED_MONTH_BRANCHES_2026_11_14: ReadonlyArray<{
  id: string
  name: string
  netSalesKwd: number
  orders: number
}> = []

export type EqualComparisonPeriod = EqualPeriodComparisonInput['period']

export interface TopBranchCardSummary {
  id: string
  labelEn: string
  labelAr: string
  netSalesKwd: number
  orders: number
  subtitleEn: string
  subtitleAr: string
}

/**
 * Resolves the Lead Branch card directly from the active period's live `branches[]` array
 * (`branches.reduce((max, b) => (b.netSalesKwd > max.netSalesKwd ? b : max))`),
 * dynamically matching the period label (`الشهر` on Month, `اليوم` ONLY when `period === 'today'`).
 * Returns `null` when Odoo is disconnected or no live branch data exists.
 */
export function resolveTopBranchCard(params: {
  branches?: ReadonlyArray<{
    id: string
    name?: string
    netSalesKwd: number
    orders?: number
  }> | null
  period: EqualComparisonPeriod
  branchFilter?: string
  subScopeRatio?: number
  fallbackBranches?: ReadonlyArray<{
    id: string
    labelEn: string
    labelAr: string
    salesKwd: number
    orders: number
  }>
}): TopBranchCardSummary | null {
  const {
    branches,
    period,
    branchFilter = 'all',
    subScopeRatio = 1,
    fallbackBranches,
  } = params

  const subtitleByPeriod: Record<EqualComparisonPeriod, { en: string; ar: string }> = {
    today: {
      en: 'Peak POS Revenue · Today',
      ar: 'أعلى إيراد نقاط بيع · اليوم',
    },
    week: {
      en: 'Peak POS Revenue · This Week',
      ar: 'أعلى إيراد نقاط بيع · الأسبوع',
    },
    month: {
      en: 'Peak POS Revenue · This Month',
      ar: 'أعلى إيراد نقاط بيع · الشهر',
    },
    year: {
      en: 'Peak POS Revenue · This Year',
      ar: 'أعلى إيراد نقاط بيع · السنة',
    },
    custom: {
      en: 'Peak POS Revenue · Selected Period',
      ar: 'أعلى إيراد نقاط بيع · الفترة',
    },
  }

  const subtitle = subtitleByPeriod[period] ?? subtitleByPeriod.month
  const safeRatio =
    Number.isFinite(subScopeRatio) && subScopeRatio > 0 ? subScopeRatio : 1

  const effectiveSource =
    Array.isArray(branches) && branches.length > 0 ? branches : null

  if (effectiveSource && effectiveSource.length > 0) {
    const eligible = effectiveSource.filter(
      (b) =>
        b &&
        !isExcludedOdooEntity(b.id) &&
        !isExcludedOdooEntity(b.name) &&
        (branchFilter === 'all' || b.id === branchFilter),
    )
    if (eligible.length > 0) {
      const top = eligible.reduce((max, b) =>
        b.netSalesKwd > max.netSalesKwd ? b : max,
      )
      const meta = BRANCH_LABELS_BY_ID[top.id]
      const scaledNet =
        Math.abs(safeRatio - 1) < 1e-6
          ? Math.round(top.netSalesKwd * 1000) / 1000
          : Math.round(top.netSalesKwd * safeRatio * 1000) / 1000
      return {
        id: top.id,
        labelEn: meta?.labelEn ?? top.name ?? top.id,
        labelAr: meta?.labelAr ?? top.name ?? top.id,
        netSalesKwd: scaledNet,
        orders: Math.max(0, Math.round((top.orders ?? 0) * safeRatio)),
        subtitleEn: subtitle.en,
        subtitleAr: subtitle.ar,
      }
    }
  }

  if (fallbackBranches && fallbackBranches.length > 0) {
    const eligibleFallback = fallbackBranches.filter(
      (b) =>
        b &&
        !isExcludedOdooEntity(b.id) &&
        (branchFilter === 'all' || b.id === branchFilter),
    )
    if (eligibleFallback.length > 0) {
      const top = eligibleFallback.reduce((max, b) =>
        b.salesKwd > max.salesKwd ? b : max,
      )
      return {
        id: top.id,
        labelEn: top.labelEn,
        labelAr: top.labelAr,
        netSalesKwd: Math.round(top.salesKwd * 1000) / 1000,
        orders: Math.max(0, Math.round(top.orders)),
        subtitleEn: subtitle.en,
        subtitleAr: subtitle.ar,
      }
    }
  }

  return null
}

/**
 * Formats a margin or share ratio pill strictly WITHOUT
 * `▲` or `▼` directional delta arrows (arrows are reserved exclusively for period-over-period deltas).
 */
export function formatStaticMarginPill(pct: number, suffix?: string): string {
  const safe = Number.isFinite(pct) ? Math.round(pct * 10) / 10 : 0
  const base = `${safe.toFixed(1)}%`
  return suffix ? `${base} ${suffix}` : base
}

const WEEKDAY_FULL_AR = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const
const WEEKDAY_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export interface WeeklyChartBarMeta {
  id: string
  dow: number
  shortDate: string
  dayFullAr: string
  dayShortEn: string
  isPartialToday: boolean
  partialBadgeAr: string | null
  partialBadgeEn: string | null
}

export interface WeeklyChartDynamicMeta {
  rangeLabelAr: string
  rangeLabelEn: string
  subtitleAr: string
  subtitleEn: string
  partialTodayIso: string
  bars: WeeklyChartBarMeta[]
}

/**
 * Dynamically derives the Weekly Performance Analytics chart range subtitle from the actual
 * first and last rendered bars (e.g. `الأحد 08/11 – السبت 14/11` / `Sun 08/11 – Sat 14/11`),
 * and marks today's incomplete bar (`14/11` / Kuwait `today`) with `جزئي` (`Partial`).
 */
export function buildWeeklyChartMeta(
  dayIds: readonly string[],
  options?: {
    liveConnected?: boolean
    referenceNowMs?: number
  },
): WeeklyChartDynamicMeta {
  const kwCtx = getKuwaitTimeContext(options?.referenceNowMs)
  const partialTodayIso = kwCtx.todayIso

  const bars: WeeklyChartBarMeta[] = dayIds.map((id, idx) => {
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(id)
    const dow = isoMatch
      ? new Date(
          Date.UTC(
            Number(isoMatch[1]),
            Number(isoMatch[2]) - 1,
            Number(isoMatch[3]),
            12,
            0,
            0,
          ),
        ).getUTCDay()
      : (idx + 6) % 7
    const shortDate = isoMatch ? `${isoMatch[3]}/${isoMatch[2]}` : id
    const isPartialToday = id === partialTodayIso || id === kwCtx.todayIso
    return {
      id,
      dow,
      shortDate,
      dayFullAr: WEEKDAY_FULL_AR[dow] ?? id,
      dayShortEn: WEEKDAY_SHORT_EN[dow] ?? id,
      isPartialToday,
      partialBadgeAr: isPartialToday ? 'جزئي' : null,
      partialBadgeEn: isPartialToday ? 'Partial' : null,
    }
  })

  const first = bars[0]
  const last = bars[bars.length - 1]
  const rangeLabelAr =
    first && last
      ? `${first.dayFullAr} ${first.shortDate} – ${last.dayFullAr} ${last.shortDate}`
      : ''
  const rangeLabelEn =
    first && last
      ? `${first.dayShortEn} ${first.shortDate} – ${last.dayShortEn} ${last.shortDate}`
      : ''

  return {
    rangeLabelAr,
    rangeLabelEn,
    subtitleAr: rangeLabelAr
      ? `مسار 7 أيام من نقاط البيع (${rangeLabelAr}) · اختر أي عمود كبسولة`
      : 'مسار 7 أيام من نقاط البيع · اختر أي عمود كبسولة',
    subtitleEn: rangeLabelEn
      ? `7-day POS ledger trajectory (${rangeLabelEn}) · Select any pill bar`
      : '7-day POS ledger trajectory · Select any pill bar',
    partialTodayIso,
    bars,
  }
}

