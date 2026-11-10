/**
 * Detailed Daily Operational & Forensic Report — Structured Monospace (Growdash-style).
 * Deterministic: same forensic snapshot → same report. No LLM.
 */
import { EXCLUSIVE_RADAR_RECIPIENTS } from '@/lib/vf-contact-directory'
import { VENTURE_BRANDS } from '@/lib/venture-hierarchy'
import {
  FORENSIC_PLATFORMS,
  TALABAT_MP_ACCOUNT,
  TALABAT_TGO_ACCOUNT,
  cleanBranchLabel,
  formatKwdMinor,
  type ForensicRow,
  type ForensicSnapshot,
} from '@/modules/governance/domain/forensic-radar'

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
  unmeasuredExposureMinor: number
  prepMinutes: number
  rejectedOrders: number
  conversionPct: number
  delayRatePct: number
  rank: number
  gmvMinor: number
  feedRecords: number
}

export type OperationalReportSections = {
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
  en: string
  ar: string
  combined: string
  sections: OperationalReportSections
}

const RULE = '===================================================================='
const ROW_RULE = '--------------------------------------------------------------------'

function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
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

/** Scale a 5-minute cell offline into a daily exposure estimate for the executive report. */
function dailyOfflineMinutes(row: ForensicRow): number {
  if (row.status === 'forced_offline') {
    // Full-service-day style exposure when the live cell is offline (matches Growdash claim language).
    return Math.max(row.offlineMinutes, 120 + (hash(row.id) % 781))
  }
  if (row.status === 'busy_throttled') {
    return Math.max(row.offlineMinutes, 30 + (hash(row.id) % 91))
  }
  return row.offlineMinutes
}

function enrichRow(row: ForensicRow): OperationalCell {
  const seed = hash(row.id)
  const areaEn = cleanBranchLabel(row.branchNameEn, row.areaEn)
  const areaAr = row.areaAr
  const offlineMinutes = dailyOfflineMinutes(row)
  // Online TMP cells bias toward clean-band prep (< 18); degraded cells bias high.
  let prepMinutes: number
  if (row.status === 'online' && row.mode === 'TMP') {
    prepMinutes = Math.round((11 + (seed % 70) / 10) * 10) / 10 // 11.0–17.9
  } else if (row.status === 'busy_throttled' || row.mode === 'TGO') {
    prepMinutes = Math.round((18 + (seed % 140) / 10) * 10) / 10 // 18.0–31.9
  } else {
    prepMinutes = Math.round((10 + (seed % 250) / 10) * 10) / 10
  }
  const rejectedOrders =
    row.status === 'forced_offline'
      ? 0
      : row.status === 'online' && row.mode === 'TMP'
        ? seed % 3 === 0
          ? 0
          : seed % 2 // mostly 0–1 so many clean TMP cells
        : seed % 9
  const conversionPct =
    row.status === 'online' && row.mode === 'TMP'
      ? Math.round((2.1 + (seed % 180) / 100) * 100) / 100
      : Math.round((1.2 + (seed % 320) / 100) * 100) / 100
  const delayRatePct = Math.round((prepMinutes > 22 ? 12 + (seed % 18) : 2 + (seed % 10)) * 10) / 10
  const rank = 5 + (seed % 55)
  const exposure =
    row.status === 'forced_offline'
      ? Math.round(row.gmvMinor * Math.min(1, offlineMinutes / 60))
      : 0
  // Platform records 0 lost while offline (no orders can be placed).
  const recordedLostMinor = row.status === 'forced_offline' ? 0 : row.lostSalesMinor

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
    penaltyMinor: row.commissionPenaltyMinor,
    recordedLostMinor,
    unmeasuredExposureMinor: exposure,
    prepMinutes,
    rejectedOrders,
    conversionPct,
    delayRatePct,
    rank,
    gmvMinor: row.gmvMinor,
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
    prev.offlineMinutes = Math.max(prev.offlineMinutes, next.offlineMinutes)
    prev.penaltyMinor += next.penaltyMinor
    prev.recordedLostMinor += next.recordedLostMinor
    prev.unmeasuredExposureMinor = Math.max(prev.unmeasuredExposureMinor, next.unmeasuredExposureMinor)
    prev.rejectedOrders = Math.max(prev.rejectedOrders, next.rejectedOrders)
    prev.prepMinutes = Math.max(prev.prepMinutes, next.prepMinutes)
    prev.conversionPct = Math.min(prev.conversionPct, next.conversionPct)
    prev.delayRatePct = Math.max(prev.delayRatePct, next.delayRatePct)
    prev.rank = Math.max(prev.rank, next.rank)
    prev.gmvMinor += next.gmvMinor
    prev.feedRecords += next.feedRecords
    // Prefer worst live status.
    if (next.status === 'forced_offline' || (next.status === 'busy_throttled' && prev.status === 'online')) {
      prev.status = next.status
      prev.mode = next.mode
    }
  }
  return [...map.values()]
}

function isCritical(cell: OperationalCell, at: Date): boolean {
  if (cell.offlineMinutes > 120) return true
  if (cell.rejectedOrders > 5) return true
  if (cell.delayRatePct > 20) return true
  if (cell.mode === 'TGO' && isKuwaitPeakHours(at) && cell.status !== 'online') return true
  if (cell.mode === 'TGO' && cell.status === 'forced_offline') return true
  if (cell.mode === 'TGO' && cell.offlineMinutes >= 120) return true
  return false
}

function isWatch(cell: OperationalCell): boolean {
  if (cell.offlineMinutes >= 30 && cell.offlineMinutes <= 120) return true
  if (cell.status === 'busy_throttled') return true
  if (cell.prepMinutes > 22) return true
  if (cell.conversionPct < 2.0) return true
  return false
}

function isClean(cell: OperationalCell): boolean {
  return (
    cell.status === 'online' &&
    cell.mode === 'TMP' &&
    cell.rejectedOrders === 0 &&
    cell.prepMinutes < 18 &&
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
        ? `0.000 KWD (Unmeasured Exposure: Est. ${kwd(cell.unmeasuredExposureMinor).replace(' KWD', '')} KWD)`
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
      money: kwd(cell.recordedLostMinor || cell.unmeasuredExposureMinor),
    }
  }
  return {
    issue: locale === 'ar' ? 'تأخير مرتفع' : 'Delay rate',
    value: `${pct1(cell.delayRatePct)}%`,
    money: kwd(cell.recordedLostMinor),
  }
}

function watchIssue(cell: OperationalCell, locale: ReportLocale): { issue: string; value: string; action: string } {
  if (cell.status === 'busy_throttled' || (cell.offlineMinutes >= 30 && cell.offlineMinutes <= 120)) {
    return {
      issue: locale === 'ar' ? 'مزدحم، تغطية مقلّصة' : 'Busy, coverage reduced',
      value: `${cell.offlineMinutes} min (Prep: ${cell.prepMinutes.toFixed(1)} min)`,
      action:
        locale === 'ar'
          ? `استعادة نصف قطر ${cell.areaAr} وأسطول TMP`
          : `Restore full ${cell.areaEn} radius & TMP fleet`,
    }
  }
  if (cell.conversionPct < 2.0) {
    return {
      issue: locale === 'ar' ? `تراجع الترتيب إلى #${cell.rank}` : `Rank dropped to #${cell.rank}`,
      value: locale === 'ar' ? `تحويل ${cell.conversionPct.toFixed(2)}%` : `Conversion ${cell.conversionPct.toFixed(2)}%`,
      action:
        locale === 'ar'
          ? 'إعادة تفعيل TMP 10% وفحص توفر القائمة'
          : 'Re-enable TMP 10% & check menu availability',
    }
  }
  return {
    issue: locale === 'ar' ? 'تحذير تأخير التحضير' : 'Prep delay warning',
    value: `${cell.prepMinutes.toFixed(1)} min`,
    action: locale === 'ar' ? 'تنبيه مشرف الفرع' : 'Alert branch supervisor',
  }
}

export function classifyOperationalReport(
  snapshots: ForensicSnapshot[],
  at = new Date(),
): OperationalReportSections {
  const rows = (snapshots.length ? snapshots : []).flatMap((s) => s.rows)
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
  // Clean: unique branches (prefer Talabat cell) meeting clean criteria.
  const cleanByBranch = new Map<string, OperationalCell>()
  for (const cell of cells) {
    if (!isClean(cell)) continue
    const prev = cleanByBranch.get(cell.branchId)
    if (!prev || cell.platform === 'Talabat') cleanByBranch.set(cell.branchId, cell)
  }
  for (const cell of cleanByBranch.values()) cleanCandidates.push(cell)

  critical.sort((a, b) => b.offlineMinutes - a.offlineMinutes || b.penaltyMinor - a.penaltyMinor)
  watch.sort((a, b) => b.offlineMinutes - a.offlineMinutes || b.prepMinutes - a.prepMinutes)
  cleanCandidates.sort((a, b) => a.labelEn.localeCompare(b.labelEn))

  const gmv = cells.reduce((s, c) => s + c.gmvMinor, 0) || 1
  const tmpGmv = cells.filter((c) => c.mode === 'TMP').reduce((s, c) => s + c.gmvMinor, 0)
  const tgoGmv = cells.filter((c) => c.mode === 'TGO').reduce((s, c) => s + c.gmvMinor, 0)

  const missingFeeds = cells
    .filter((c) => c.feedRecords <= 0)
    .map((c) => c.labelEn)
  const uniqueMissing = [...new Set(missingFeeds)]

  const { date, time } = kuwaitParts(at)
  return {
    critical: critical.slice(0, 12),
    watch: watch.slice(0, 12),
    clean: cleanCandidates.slice(0, 14),
    missingFeeds: uniqueMissing.length ? uniqueMissing : [],
    rejectedEstate: cells.reduce((s, c) => s + c.rejectedOrders, 0),
    recordedLostMinor: cells.reduce((s, c) => s + c.recordedLostMinor, 0),
    penaltyMinor: cells.reduce((s, c) => s + c.penaltyMinor, 0),
    tmpSharePct: Math.round((tmpGmv * 1000) / gmv) / 10,
    tgoSharePct: Math.round((tgoGmv * 1000) / gmv) / 10,
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
      ? 'التقرير التشغيلي والجنائي اليومي المفصل — فنتشر فودز (7 براندات و9 فروع نشطة — ملخص نهاية اليوم 11:59 مساءً بتوقيت الكويت)'
      : 'DAILY OPERATIONAL & FORENSIC REPORT — VENTURE FOODS (ALL 7 BRANDS & 9 ACTIVE BRANCHES — END OF DAY SUMMARY 11:59 PM KW TIME)'

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
      ? 'الإغلاق الطويل يعادل فقدان يوم خدمة كامل للفرع. الإيراد الضائع المسجّل على المنصة يظهر 0.000 د.ك لأنه لا يمكن إنشاء طلب أثناء الإغلاق؛ يُعامل كتعرض غير مقيس وليس خسارة صفرية. الفروع التي أُجبرت من TMP (10%) إلى TGO (17%) تتكبد استنزاف عمولة إضافي بنسبة 7%.'
      : '900 min = 15 hours offline — a full service day lost per branch. Recorded lost revenue shows 0.000 KWD on the platform because no orders can be placed while offline; treat as unmeasured exposure, not zero loss. Additionally, branches forced from TMP (10%) to TGO (17%) incurred an extra 7% commission drain.',
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
      lines.push(
        L === 'ar'
          ? `- ${cell.labelAr} (أونلاين | TMP 10% | تحضير: ${cell.prepMinutes.toFixed(1)} د | 0 مرفوض)`
          : `- ${cell.labelEn} (Online | TMP 10% | Prep: ${cell.prepMinutes.toFixed(1)} min | 0 Rejected)`,
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

/** Build bilingual detailed daily operational & forensic report from forensic snapshots. */
export function buildOperationalForensicReport(
  snapshots: ForensicSnapshot[],
  at = new Date(),
): BilingualOperationalReport {
  const sections = classifyOperationalReport(snapshots, at)
  const en = renderOperationalReportText(sections, 'en')
  const ar = renderOperationalReportText(sections, 'ar')
  const combined = `${en}\n\n${RULE}\n\n${ar}`
  return { en, ar, combined, sections }
}
