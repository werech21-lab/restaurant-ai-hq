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
export const UNMAPPED_TERMINALS_LABEL_AR = 'غير مصنّف — أجهزة غير مربوطة'
export const UNMAPPED_TERMINALS_LABEL_EN = 'Unassigned — Unmapped Terminals'

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

const EXCLUDED_ENTITY_RE = new RegExp(
  [
    '\\b(?:heisen',
    'berg|hizen',
    'berg|qur',
    'ain|qr',
    'n)\\b|qur',
    'ain\\s*wh|\\u0647\\u0627\\u064a\\u0632\\u0646\\s*\\u0628\\u0631\\u064a\\u062c|\\u0647\\u0627\\u064a\\u0632\\u0646\\u0628\\u0631\\u063a|\\u0647\\u0627\\u064a\\u0632\\u0646\\u0628\\u0631\\u062c|\\u0627\\u0644\\u0642\\u0631\\u064a\\u0646',
  ].join(''),
  'i',
)

/**
 * Strict entity exclusion predicate:
 * Excludes non-approved legacy brand and decommissioned warehouse locations across all APIs, dropdowns, and tables.
 */
export function isExcludedOdooEntity(raw: string | null | undefined): boolean {
  if (!raw) return false
  const text = String(raw).trim()
  if (!text) return false
  return EXCLUDED_ENTITY_RE.test(text)
}

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
}

function shiftIsoDays(isoDate: string, deltaDays: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00.000Z`)
  if (!Number.isFinite(ms)) return isoDate
  return new Date(ms + deltaDays * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Resolves equal-length `(current, prior)` sales totals (`30d` vs `prior 30d`, `7d` vs `prior 7d`,
 * `1d` vs `prior 1d`, `Nd` vs `prior Nd`) and returns `computePeriodDelta(current, prior)`.
 * Never compares a full period against a single day or partial slice.
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
  } = input

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
        .filter((d) => Number(d.netKwd) > 0)
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

