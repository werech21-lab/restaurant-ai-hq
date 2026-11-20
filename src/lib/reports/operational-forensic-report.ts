/**
 * Detailed Daily Operational & Forensic Report — Structured Monospace (Growdash-style).
 * Deterministic & Fail-Closed: uses ONLY verified forensic snapshot rows. Never invents or hashes metrics.
 */
import { EXCLUSIVE_RADAR_RECIPIENTS } from '@/lib/vf-contact-directory'
import { VENTURE_BRANDS } from '@/lib/venture-hierarchy'
import {
  FORENSIC_MISSING_DATA_REASON,
  FORENSIC_PLATFORMS,
  TALABAT_MP_ACCOUNT,
  TALABAT_TGO_ACCOUNT,
  cleanBranchLabel,
  formatKwdMinor,
  type ForensicRow,
  type ForensicSnapshot,
} from '@/modules/governance/client'

export const OPERATIONAL_REPORT_RADAR_URL = 'https://aetherbi.com/erp/aggregator-radar'

export type ReportLocale = 'en' | 'ar'

export type OperationalCell = {
  key: string
  brandId: string
  brandNameEn: string
  brandNameAr: string
  branchId: string
  areaEn: string
  areaAr: string
  labelEn: string
  labelAr: string
  platform: string
  status: ForensicRow['status']
  mode: ForensicRow['mode']
  offlineMinutes: number
  penaltyMinor: number
  recordedLostMinor: number
  prepMinutes: number | null
  rejectedOrders: number
  conversionPct: number | null
  delayRatePct: number | null
  rank: number | null
  gmvMinor: number
  feedRecords: number
}

export type OperationalReportSections = {
  dataAvailable: boolean
  unavailableReason?: string
  critical: OperationalCell[]
  watch: OperationalCell[]
  clean: OperationalCell[]
  missingFeeds: string[]
  rejectedEstate: number
  recordedLostMinor: number
  penaltyMinor: number
  tmpSharePct: number
  tgoSharePct: number
  generatedAt: Date
  kuwaitDate: string
  kuwaitTime: string
}

export type BilingualOperationalReport = {
  dataAvailable: boolean
  unavailableReason?: string
  en: string
  ar: string
  combined: string
  sections: OperationalReportSections
}

const RULE = '===================================================================='
const ROW_RULE = '--------------------------------------------------------------------'

export function hasCompleteVerifiedForensicData(
  snapshots: readonly ForensicSnapshot[],
): { ok: boolean; reason?: string } {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return { ok: false, reason: FORENSIC_MISSING_DATA_REASON }
  }
  const invalidSnapshot = snapshots.some(
    (s) =>
      !s ||
      !s.dataAvailable ||
      !Array.isArray(s.rows) ||
      s.rows.length === 0 ||
      s.rows.some(
        (r: ForensicRow) =>
          r.verifiedFromOdoo === false ||
          !Number.isFinite(r.gmvMinor) ||
          r.gmvMinor < 0 ||
          !Number.isFinite(r.offlineMinutes) ||
          r.offlineMinutes < 0,
      ),
  )
  if (invalidSnapshot) {
    return { ok: false, reason: FORENSIC_MISSING_DATA_REASON }
  }
  return { ok: true }
}

/** Kuwait peak hours: 12:00–15:00 and 18:00–23:00 Asia/Kuwait. */
function isKuwaitPeakHours(at: Date): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuwait', hour: 'numeric', hour12: false }).format(at),
  )
  return (hour >= 12 && hour < 15) || (hour >= 18 && hour < 23)
}

function kuwaitParts(at: Date): { date: string; time: string } {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuwait',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kuwait',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(at)
  return { date, time }
}

function kwd(minor: number): string {
  return formatKwdMinor(Math.max(0, Math.round(minor)), 'en')
}

function pct1(bpsOrPct: number, asBps = false): string {
  const value = asBps ? bpsOrPct / 100 : bpsOrPct
  return value.toFixed(1)
}

function enrichRow(row: ForensicRow): OperationalCell {
  const areaEn = cleanBranchLabel(row.branchNameEn, row.areaEn)
  const areaAr = row.areaAr
  const offlineMinutes = Math.max(0, Math.round(row.offlineMinutes))
  const prepMinutes =
    typeof row.prepMinutes === 'number' && Number.isFinite(row.prepMinutes) && row.prepMinutes >= 0
      ? Math.round(row.prepMinutes * 10) / 10
      : null
  const rejectedOrders =
    typeof row.rejectedOrders === 'number' && Number.isFinite(row.rejectedOrders) && row.rejectedOrders >= 0
      ? Math.round(row.rejectedOrders)
      : 0
  const conversionPct =
    typeof row.conversionPct === 'number' && Number.isFinite(row.conversionPct) && row.conversionPct >= 0
      ? Math.round(row.conversionPct * 100) / 100
      : null
  const delayRatePct =
    typeof row.delayRatePct === 'number' && Number.isFinite(row.delayRatePct) && row.delayRatePct >= 0
      ? Math.round(row.delayRatePct * 10) / 10
      : null
  const rank =
    typeof row.rank === 'number' && Number.isFinite(row.rank) && row.rank >= 1 ? Math.round(row.rank) : null
  const recordedLostMinor = Math.max(0, Math.round(row.lostSalesMinor))

  return {
    key: `${row.branchId}|${row.platform}`,
    brandId: row.brandId,
    brandNameEn: row.brandNameEn,
    brandNameAr: row.brandNameAr,
    branchId: row.branchId,
    areaEn,
    areaAr,
    labelEn: `${row.brandNameEn} ${areaEn}`,
    labelAr: `${row.brandNameAr} ${areaAr}`,
    platform: row.platform,
    status: row.status,
    mode: row.mode,
    offlineMinutes,
    penaltyMinor: Math.max(0, Math.round(row.commissionPenaltyMinor)),
    recordedLostMinor,
    prepMinutes,
    rejectedOrders,
    conversionPct,
    delayRatePct,
    rank,
    gmvMinor: Math.max(0, Math.round(row.gmvMinor)),
    feedRecords: 1,
  }
}

function mergeCells(rows: ForensicRow[]): OperationalCell[] {
  const map = new Map<string, OperationalCell>()
  for (const row of rows) {
    const next = enrichRow(row)
    const prev = map.get(next.key)
    if (!prev) {
      map.set(next.key, next)
      continue
    }
    prev.offlineMinutes += next.offlineMinutes
    prev.penaltyMinor += next.penaltyMinor
    prev.recordedLostMinor += next.recordedLostMinor
    prev.rejectedOrders += next.rejectedOrders
    if (next.prepMinutes !== null) {
      prev.prepMinutes = prev.prepMinutes === null ? next.prepMinutes : Math.max(prev.prepMinutes, next.prepMinutes)
    }
    if (next.conversionPct !== null) {
      prev.conversionPct =
        prev.conversionPct === null ? next.conversionPct : Math.min(prev.conversionPct, next.conversionPct)
    }
    if (next.delayRatePct !== null) {
      prev.delayRatePct =
        prev.delayRatePct === null ? next.delayRatePct : Math.max(prev.delayRatePct, next.delayRatePct)
    }
    if (next.rank !== null) {
      prev.rank = prev.rank === null ? next.rank : Math.max(prev.rank, next.rank)
    }
    prev.gmvMinor += next.gmvMinor
    prev.feedRecords += next.feedRecords
    if (next.status === 'forced_offline' || (next.status === 'busy_throttled' && prev.status === 'online')) {
      prev.status = next.status
      prev.mode = next.mode
    }
  }
  return [...map.values()]
}

function isCritical(cell: OperationalCell, at: Date): boolean {
  if (cell.offlineMinutes > 120) return true
  if (cell.status === 'forced_offline') return true
  if (cell.rejectedOrders > 5) return true
  if (cell.delayRatePct !== null && cell.delayRatePct > 20) return true
  if (cell.mode === 'TGO' && isKuwaitPeakHours(at) && cell.status !== 'online') return true
  if (cell.mode === 'TGO' && cell.offlineMinutes >= 120) return true
  return false
}

function isWatch(cell: OperationalCell): boolean {
  if (cell.offlineMinutes >= 30 && cell.offlineMinutes <= 120) return true
  if (cell.status === 'busy_throttled') return true
  if (cell.prepMinutes !== null && cell.prepMinutes > 22) return true
  if (cell.conversionPct !== null && cell.conversionPct < 2.0) return true
  return false
}

function isClean(cell: OperationalCell): boolean {
  const prepClean = cell.prepMinutes === null || cell.prepMinutes < 18
  return (
    cell.status === 'online' &&
    cell.mode === 'TMP' &&
    cell.rejectedOrders === 0 &&
    prepClean &&
    cell.offlineMinutes === 0
  )
}

function modeLabel(cell: OperationalCell, locale: ReportLocale): string {
  if (locale === 'ar') {
    if (cell.mode === 'TMP') return 'MP 10%'
    return cell.status === 'forced_offline' || cell.status === 'busy_throttled'
      ? 'TGO قسري 17%'
      : 'TGO 17%'
  }
  if (cell.mode === 'TMP') return 'MP 10%'
  return cell.status !== 'online' ? 'Forced TGO 17%' : 'TGO 17%'
}

function criticalIssue(cell: OperationalCell, locale: ReportLocale): { issue: string; value: string; money: string } {
  if (cell.offlineMinutes > 120 || cell.status === 'forced_offline') {
    const money =
      cell.recordedLostMinor === 0
        ? locale === 'ar'
          ? '0.000 د.ك (غير مقيس على المنصة أثناء الإغلاق)'
          : '0.000 KWD (Unmeasured on platform while offline)'
        : kwd(cell.recordedLostMinor)
    return {
      issue: locale === 'ar' ? 'زمن الإغلاق' : 'Offline time',
      value: `${cell.offlineMinutes} min`,
      money,
    }
  }
  if (cell.mode === 'TGO' && cell.status === 'busy_throttled') {
    return {
      issue: locale === 'ar' ? 'ازدحام / خنق' : 'Busy Throttled',
      value: `${cell.offlineMinutes} min`,
      money: `+7% Commission Penalty: ${kwd(cell.penaltyMinor)}`,
    }
  }
  if (cell.mode === 'TGO') {
    return {
      issue: locale === 'ar' ? 'إغلاق TMP 10%' : 'TMP 10% Closed',
      value: `${cell.offlineMinutes} min`,
      money: `+7% Commission Penalty: ${kwd(cell.penaltyMinor)}`,
    }
  }
  if (cell.rejectedOrders > 5) {
    return {
      issue: locale === 'ar' ? 'طلبات مرفوضة' : 'Rejected orders',
      value: String(cell.rejectedOrders),
      money: kwd(cell.recordedLostMinor),
    }
  }
  return {
    issue: locale === 'ar' ? 'تأخير مرتفع' : 'Delay rate',
    value: `${pct1(cell.delayRatePct ?? 0)}%`,
    money: kwd(cell.recordedLostMinor),
  }
}

function watchIssue(cell: OperationalCell, locale: ReportLocale): { issue: string; value: string; action: string } {
  if (cell.status === 'busy_throttled' || (cell.offlineMinutes >= 30 && cell.offlineMinutes <= 120)) {
    const prepLabel =
      cell.prepMinutes !== null ? ` (Prep: ${cell.prepMinutes.toFixed(1)} min)` : ''
    return {
      issue: locale === 'ar' ? 'مزدحم، تغطية مقلّصة' : 'Busy, coverage reduced',
      value: `${cell.offlineMinutes} min${prepLabel}`,
      action:
        locale === 'ar'
          ? `استعادة نصف قطر ${cell.areaAr} وأسطول TMP`
          : `Restore full ${cell.areaEn} radius & TMP fleet`,
    }
  }
  if (cell.conversionPct !== null && cell.conversionPct < 2.0) {
    const rankSuffix = cell.rank !== null ? ` #${cell.rank}` : ''
    return {
      issue: locale === 'ar' ? `تراجع التحويل${rankSuffix}` : `Conversion drop${rankSuffix}`,
      value: locale === 'ar' ? `تحويل ${cell.conversionPct.toFixed(2)}%` : `Conversion ${cell.conversionPct.toFixed(2)}%`,
      action:
        locale === 'ar'
          ? 'إعادة تفعيل TMP 10% وفحص توفر القائمة'
          : 'Re-enable TMP 10% & check menu availability',
    }
  }
  return {
    issue: locale === 'ar' ? 'تحذير تأخير التحضير' : 'Prep delay warning',
    value: cell.prepMinutes !== null ? `${cell.prepMinutes.toFixed(1)} min` : '—',
    action: locale === 'ar' ? 'تنبيه مشرف الفرع' : 'Alert branch supervisor',
  }
}

export function classifyOperationalReport(
  snapshots: ForensicSnapshot[],
  at = new Date(),
): OperationalReportSections {
  const { date, time } = kuwaitParts(at)
  const gate = hasCompleteVerifiedForensicData(snapshots)
  if (!gate.ok) {
    return {
      dataAvailable: false,
      unavailableReason: gate.reason ?? FORENSIC_MISSING_DATA_REASON,
      critical: [],
      watch: [],
      clean: [],
      missingFeeds: [],
      rejectedEstate: 0,
      recordedLostMinor: 0,
      penaltyMinor: 0,
      tmpSharePct: 0,
      tgoSharePct: 0,
      generatedAt: at,
      kuwaitDate: date,
      kuwaitTime: time,
    }
  }

  const rows = snapshots.flatMap((s) => s.rows)
  const cells = mergeCells(rows)
  const peak = isKuwaitPeakHours(at)

  const critical: OperationalCell[] = []
  const watch: OperationalCell[] = []
  const cleanCandidates: OperationalCell[] = []
  const used = new Set<string>()

  for (const cell of cells) {
    if (isCritical(cell, at) || (peak && cell.mode === 'TGO' && cell.status === 'busy_throttled')) {
      critical.push(cell)
      used.add(cell.key)
    }
  }
  for (const cell of cells) {
    if (used.has(cell.key)) continue
    if (isWatch(cell)) {
      watch.push(cell)
      used.add(cell.key)
    }
  }
  const cleanByBranch = new Map<string, OperationalCell>()
  for (const cell of cells) {
    if (!isClean(cell)) continue
    const prev = cleanByBranch.get(cell.branchId)
    if (!prev || cell.platform === 'Talabat') cleanByBranch.set(cell.branchId, cell)
  }
  for (const cell of cleanByBranch.values()) cleanCandidates.push(cell)

  critical.sort((a, b) => b.offlineMinutes - a.offlineMinutes || b.penaltyMinor - a.penaltyMinor)
  watch.sort(
    (a, b) => b.offlineMinutes - a.offlineMinutes || (b.prepMinutes ?? 0) - (a.prepMinutes ?? 0),
  )
  cleanCandidates.sort((a, b) => a.labelEn.localeCompare(b.labelEn))

  const totalGmv = cells.reduce((s, c) => s + c.gmvMinor, 0)
  const tmpGmv = cells.filter((c) => c.mode === 'TMP').reduce((s, c) => s + c.gmvMinor, 0)
  const tgoGmv = cells.filter((c) => c.mode === 'TGO').reduce((s, c) => s + c.gmvMinor, 0)

  const missingFeeds = cells
    .filter((c) => c.feedRecords <= 0)
    .map((c) => c.labelEn)
  const uniqueMissing = [...new Set(missingFeeds)]

  return {
    dataAvailable: true,
    critical: critical.slice(0, 12),
    watch: watch.slice(0, 12),
    clean: cleanCandidates.slice(0, 14),
    missingFeeds: uniqueMissing.length ? uniqueMissing : [],
    rejectedEstate: cells.reduce((s, c) => s + c.rejectedOrders, 0),
    recordedLostMinor: cells.reduce((s, c) => s + c.recordedLostMinor, 0),
    penaltyMinor: cells.reduce((s, c) => s + c.penaltyMinor, 0),
    tmpSharePct: totalGmv > 0 ? Math.round((tmpGmv * 1000) / totalGmv) / 10 : 0,
    tgoSharePct: totalGmv > 0 ? Math.round((tgoGmv * 1000) / totalGmv) / 10 : 0,
    generatedAt: at,
    kuwaitDate: date,
    kuwaitTime: time,
  }
}

function brandFeedNote(locale: ReportLocale): string {
  const namesEn = VENTURE_BRANDS.map((b) => b.nameEn).join(', ')
  const namesAr = VENTURE_BRANDS.map((b) => b.nameAr).join('، ')
  if (locale === 'ar') {
    return `ملاحظة التغذية: رادار جنائي كل 5 دقائق نشط عبر ${namesAr}.`
  }
  return `Feed note: 5-minute forensic radar active across ${namesEn}.`
}

function recipientsLine(): string {
  return EXCLUSIVE_RADAR_RECIPIENTS.map((r) => r.email).join(' | ')
}

export function renderOperationalReportText(sections: OperationalReportSections, locale: ReportLocale): string {
  const L = locale
  const title =
    L === 'ar'
      ? 'التقرير التشغيلي والجنائي اليومي المفصل — فنتشر فودز (6 علامات تجارية و7 فروع نشطة — ملخص نهاية اليوم 11:59 مساءً بتوقيت الكويت)'
      : 'DAILY OPERATIONAL & FORENSIC REPORT — VENTURE FOODS (ALL 6 BRANDS & 7 ACTIVE BRANCHES — END OF DAY SUMMARY 11:59 PM KW TIME)'

  const lines: string[] = []
  lines.push(title)
  lines.push(
    L === 'ar'
      ? `التاريخ: ${sections.kuwaitDate} (توقيت الكويت: ${sections.kuwaitTime})`
      : `Date: ${sections.kuwaitDate} (Kuwait Time: ${sections.kuwaitTime})`,
  )
  lines.push(
    L === 'ar'
      ? 'التغطية: طلبات (TMP 10% مقابل TGO 17%)، Deliveroo، جاهز، كيتا، سنونو'
      : 'Coverage: Talabat (TMP 10% vs TGO 17%), Deliveroo, Jahez, Keeta, Snoonu',
  )
  lines.push(brandFeedNote(L))
  lines.push(
    L === 'ar'
      ? 'أوقات التحضير مقربة لرقم عشري واحد | العملة: د.ك (0.000)'
      : 'Prep times rounded to 1 decimal | Currency: KWD (0.000)',
  )
  lines.push('')
  lines.push(
    L === 'ar'
      ? `الملخص: ${sections.critical.length} حرج 🔴 | ${sections.watch.length} مراقبة 🟠 | ${sections.clean.length} سليم 🟢 | ${sections.rejectedEstate} طلبات مرفوضة على مستوى الشبكة | ${kwd(sections.recordedLostMinor)} إيراد ضائع مسجّل | ${kwd(sections.penaltyMinor)} غرامة TGO إضافية (17% مقابل 10%)`
      : `SUMMARY: ${sections.critical.length} CRITICAL 🔴 | ${sections.watch.length} WATCH 🟠 | ${sections.clean.length} CLEAN 🟢 | ${sections.rejectedEstate} rejected orders estate-wide | ${kwd(sections.recordedLostMinor)} recorded lost revenue | ${kwd(sections.penaltyMinor)} extra TGO (17% vs 10%) penalty`,
  )
  lines.push('')
  lines.push(RULE)
  lines.push('')
  lines.push(L === 'ar' ? '1. الحوادث الحرجة 🔴' : '1. CRITICAL ISSUES 🔴')
  lines.push(
    L === 'ar'
      ? 'المعايير: إغلاق > 120 د، تحويل قسري إلى TGO (17%) في الذروة، معدل تأخير > 20%، طلبات مرفوضة > 5'
      : 'Criteria: offline > 120 min, forced TGO (17%) switch during peak hours, delay rate > 20%, rejected orders > 5',
  )
  lines.push('')
  lines.push(
    L === 'ar'
      ? 'الفرع والبراند | القناة | الوضع | المشكلة | القيمة | الإيراد الضائع / الغرامة (د.ك)'
      : 'Branch & Brand | Channel | Mode | Issue | Value | Lost Revenue / Penalty (KWD)',
  )
  lines.push(ROW_RULE)
  if (sections.critical.length === 0) {
    lines.push(L === 'ar' ? '(لا حوادث حرجة في هذه الدورة)' : '(No critical issues in this cycle)')
  } else {
    for (const cell of sections.critical) {
      const detail = criticalIssue(cell, L)
      lines.push(
        `${L === 'ar' ? cell.labelAr : cell.labelEn} | ${cell.platform} | ${modeLabel(cell, L)} | ${detail.issue} | ${detail.value} | ${detail.money}`,
      )
    }
  }
  lines.push('')
  lines.push(L === 'ar' ? 'ملاحظة التحليل الجنائي:' : 'Forensic Analysis Note:')
  lines.push(
    L === 'ar'
      ? 'الإيراد الضائع المسجّل على المنصة يظهر 0.000 د.ك أثناء الإغلاق لأنه لا يمكن إنشاء طلب أثناء الإغلاق؛ يُعامل كتعرض غير مقيس وليس خسارة صفرية. الفروع التي أُجبرت من TMP (10%) إلى TGO (17%) تتكبد استنزاف عمولة إضافي بنسبة 7%.'
      : 'Recorded lost revenue shows 0.000 KWD on the platform while offline because no orders can be placed during closure; treat as unmeasured exposure, not zero loss. Branches forced from TMP (10%) to TGO (17%) incurred an extra 7% commission drain.',
  )
  lines.push('')
  lines.push(RULE)
  lines.push('')
  lines.push(L === 'ar' ? '2. قائمة المراقبة 🟠' : '2. WATCH LIST 🟠')
  lines.push(
    L === 'ar'
      ? 'المعايير: إغلاق 30–120 د، تقليل نطاق التغطية (مزدحم)، تحضير > 22 د، أو انخفاض التحويل < 2.0%'
      : 'Criteria: offline 30–120 min, coverage area reduced (Busy), prep time > 22 min, or conversion drop < 2.0%',
  )
  lines.push('')
  lines.push(
    L === 'ar'
      ? 'الفرع والبراند | القناة | المشكلة | القيمة | الإجراء المطلوب'
      : 'Branch & Brand | Channel | Issue | Value | Action Required',
  )
  lines.push(ROW_RULE)
  if (sections.watch.length === 0) {
    lines.push(L === 'ar' ? '(قائمة المراقبة فارغة)' : '(Watch list empty)')
  } else {
    for (const cell of sections.watch) {
      const detail = watchIssue(cell, L)
      lines.push(
        `${L === 'ar' ? cell.labelAr : cell.labelEn} | ${cell.platform} | ${detail.issue} | ${detail.value} | ${detail.action}`,
      )
    }
  }
  lines.push('')
  lines.push(RULE)
  lines.push('')
  lines.push(
    L === 'ar'
      ? '3. تدقيق عمولة طلبات والمجمّعات (TMP 10% مقابل TGO 17%) ⚖️'
      : '3. TALABAT & AGGREGATORS COMMISSION AUDIT (TMP 10% vs TGO 17%) ⚖️',
  )
  lines.push(
    L === 'ar'
      ? `الحساب ${TALABAT_MP_ACCOUNT} (طلبات MP — أسطول داخلي 10%) مقابل الحساب ${TALABAT_TGO_ACCOUNT} (طلبات Go — أسطول المجمّع 17%):`
      : `Account ${TALABAT_MP_ACCOUNT} (Talabat MP - 10% In-House Fleet) vs Account ${TALABAT_TGO_ACCOUNT} (Talabat Go - 17% Aggregator Fleet):`,
  )
  lines.push(
    L === 'ar'
      ? `- إجمالي طلبات الشبكة على TMP (10%): ${pct1(sections.tmpSharePct)}% (توفير 7% عمولة لكل طلب)`
      : `- Total Estate Orders on TMP (10%): ${pct1(sections.tmpSharePct)}% (Saved 7% commission per order)`,
  )
  lines.push(
    L === 'ar'
      ? `- إجمالي الطلبات المُجبرة على TGO (17%): ${pct1(sections.tgoSharePct)}% (غرامة 7% إضافية = ${kwd(sections.penaltyMinor)})`
      : `- Total Estate Orders Forced to TGO (17%): ${pct1(sections.tgoSharePct)}% (Extra 7% penalty deducted = ${kwd(sections.penaltyMinor)})`,
  )
  lines.push(
    L === 'ar'
      ? `- تغذيات مفقودة / صفرية: ${sections.missingFeeds.length ? sections.missingFeeds.join('، ') : 'لا يوجد'}`
      : `- Missing / Zero-Record Feeds Detected: ${sections.missingFeeds.length ? sections.missingFeeds.join(', ') : 'None'}`,
  )
  lines.push('')
  lines.push(RULE)
  lines.push('')
  lines.push(
    L === 'ar'
      ? '4. الفروع السليمة 🟢 (أونلاين 100% على TMP 10% | 0 مرفوض | تحضير < 18 د)'
      : '4. CLEAN BRANCHES 🟢 (100% Online on TMP 10% | 0 Rejected Orders | Prep < 18 min)',
  )
  if (sections.clean.length === 0) {
    lines.push(L === 'ar' ? '- (لا فروع ضمن معايير السليم في هذه الدورة)' : '- (No branches met clean criteria this cycle)')
  } else {
    for (const cell of sections.clean) {
      const prepStrAr = cell.prepMinutes !== null ? `تحضير: ${cell.prepMinutes.toFixed(1)} د` : 'تحضير: غير متاح'
      const prepStrEn = cell.prepMinutes !== null ? `Prep: ${cell.prepMinutes.toFixed(1)} min` : 'Prep: —'
      lines.push(
        L === 'ar'
          ? `- ${cell.labelAr} (أونلاين | TMP 10% | ${prepStrAr} | 0 مرفوض)`
          : `- ${cell.labelEn} (Online | TMP 10% | ${prepStrEn} | 0 Rejected)`,
      )
    }
  }
  lines.push(RULE)
  lines.push(
    L === 'ar'
      ? `المستلمون المعتمدون: ${recipientsLine()}`
      : `Authorized Recipients: ${recipientsLine()}`,
  )
  lines.push(
    L === 'ar'
      ? `مولَّد بواسطة محرك AetherBI الجنائي المؤسسي — ${OPERATIONAL_REPORT_RADAR_URL}`
      : `Generated by AetherBI Enterprise Forensic Engine — ${OPERATIONAL_REPORT_RADAR_URL}`,
  )
  lines.push(`Platforms monitored: ${FORENSIC_PLATFORMS.join(', ')}`)
  return lines.join('\n')
}

/** Build bilingual detailed daily operational & forensic report from verified forensic snapshots. */
export function buildOperationalForensicReport(
  snapshots: ForensicSnapshot[],
  at = new Date(),
): BilingualOperationalReport {
  const sections = classifyOperationalReport(snapshots, at)
  if (!sections.dataAvailable) {
    return {
      dataAvailable: false,
      unavailableReason: sections.unavailableReason ?? FORENSIC_MISSING_DATA_REASON,
      en: '',
      ar: '',
      combined: '',
      sections,
    }
  }
  const en = renderOperationalReportText(sections, 'en')
  const ar = renderOperationalReportText(sections, 'ar')
  const combined = `${en}\n\n${RULE}\n\n${ar}`
  return { dataAvailable: true, en, ar, combined, sections }
}
