'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { errorClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { useOptionalScope } from '@/components/ScopeProvider'
import { permissions } from '@/lib/auth/permissions'
import { useI18n } from '@/lib/i18n'
import {
  cleanBranchLabel,
  displayBrandName,
  formatKwdMinor,
  type ForensicKpis,
  type ForensicReport,
  type ForensicReportPeriod,
  type ForensicRow,
} from '@/modules/governance/domain/forensic-radar'
import { FORENSIC_PLATFORMS } from '@/modules/governance/domain/forensic-radar'
import { SmartIngestLink } from '@/components/SmartIngestLink'

const FALLBACK_ALERT_RECIPIENTS = [
  {
    id: 'abdullah-abdulghafar',
    name: 'Abdullah Abdulghafar',
    title: 'Executive Secretary',
    email: 'Sec@venturefoodskw.com',
    mobile: '+965 97386418',
  },
  {
    id: 'choukrallah-nassif',
    name: 'Choukrallah Nassif',
    title: 'Operations Manager',
    email: 'operations@venturefoodskw.com',
    mobile: '+965 90061400',
  },
  {
    id: 'abdulrahman-mohamed',
    name: 'Abdulrahman Mohamed',
    title: 'Marketing Coordinator',
    email: 'abdelrahmanm@venturefoodskw.com',
    mobile: '+965 90998227',
  },
] as const

type BoardPayload = {
  rows: ForensicRow[]
  kpis: ForensicKpis
  report: ForensicReport
  historyCount: number
  nextScanInSec: number
  autoScanIntervalSec: number
  snapshot: { bucket: string; scannedAt: string }
  exclusiveAlertRecipients?: Array<{
    id: string
    name: string
    title: string
    email: string
    mobile: string
    mobileE164?: string
    mobileDisplay?: string
  }>
  smtp?: {
    configured: boolean
    enabled: boolean
    from: string
    host: string
    port: number
  }
  recorded?: number
  alerted?: boolean
  scannedAt?: string
  bucket?: string
}

type DeliveryFeedback = {
  ok: boolean
  engine: string
  subject: string
  recipients: string[]
  message: string
  error?: string
  messageId?: string
  response?: string
  summary?: {
    critical: number
    watch: number
    clean: number
    kuwaitDate: string
    kuwaitTime: string
  }
}

const EMPTY_REPORT: ForensicReport = {
  period: 'daily',
  generatedAt: new Date(0).toISOString(),
  totalOfflineMinutes: 0,
  tmpGmvMinor: 0,
  tgoGmvMinor: 0,
  penaltyMinor: 0,
  lostSalesMinor: 0,
  claimMinor: 0,
  byBrand: [],
  timeline: [],
  weekdays: [],
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function safeFixed(value: unknown, digits = 3): string {
  return num(value).toFixed(digits)
}

/** Crash-proof normalizer for GET/POST radar payloads (scan used to omit `snapshot`). */
function normalizeBoard(raw: unknown, previous: BoardPayload | null = null): BoardPayload | null {
  if (!raw || typeof raw !== 'object') return previous
  const data = raw as Partial<BoardPayload> & { scannedAt?: string; bucket?: string }
  const rows = Array.isArray(data.rows) ? data.rows : previous?.rows ?? []
  const kpis = (data.kpis ?? previous?.kpis) as ForensicKpis | undefined
  if (!kpis) return previous
  const reportRaw = (data.report ?? previous?.report) as ForensicReport | undefined
  const report: ForensicReport = reportRaw
    ? {
        period: reportRaw.period ?? 'daily',
        generatedAt: reportRaw.generatedAt || new Date().toISOString(),
        totalOfflineMinutes: num(reportRaw.totalOfflineMinutes),
        tmpGmvMinor: num(reportRaw.tmpGmvMinor),
        tgoGmvMinor: num(reportRaw.tgoGmvMinor),
        penaltyMinor: num(reportRaw.penaltyMinor),
        lostSalesMinor: num(reportRaw.lostSalesMinor),
        claimMinor: num(reportRaw.claimMinor),
        byBrand: Array.isArray(reportRaw.byBrand) ? reportRaw.byBrand : [],
        timeline: Array.isArray(reportRaw.timeline) ? reportRaw.timeline : [],
        weekdays: Array.isArray(reportRaw.weekdays) ? reportRaw.weekdays : [],
      }
    : previous?.report ?? EMPTY_REPORT
  const scannedAt =
    data.snapshot?.scannedAt ||
    data.scannedAt ||
    previous?.snapshot?.scannedAt ||
    new Date().toISOString()
  const bucket = data.snapshot?.bucket || data.bucket || previous?.snapshot?.bucket || scannedAt
  return {
    rows,
    kpis: {
      ...kpis,
      onlineCount: num(kpis.onlineCount),
      offlineCount: num(kpis.offlineCount),
      busyCount: num(kpis.busyCount),
      tmpOrderShareBps: num(kpis.tmpOrderShareBps),
      tgoOrderShareBps: num(kpis.tgoOrderShareBps),
      totalOfflineMinutes: num(kpis.totalOfflineMinutes),
      financialImpactMinor: num(kpis.financialImpactMinor),
      commissionPenaltyMinor: num(kpis.commissionPenaltyMinor),
      lostSalesMinor: num(kpis.lostSalesMinor),
      mpAccount: kpis.mpAccount || previous?.kpis.mpAccount || '101513',
      tgoAccount: kpis.tgoAccount || previous?.kpis.tgoAccount || '101512',
    },
    report,
    historyCount: num(data.historyCount, previous?.historyCount ?? 0),
    nextScanInSec: num(data.nextScanInSec, 300),
    autoScanIntervalSec: num(data.autoScanIntervalSec, 300),
    snapshot: { bucket: String(bucket), scannedAt: String(scannedAt) },
    exclusiveAlertRecipients: Array.isArray(data.exclusiveAlertRecipients)
      ? data.exclusiveAlertRecipients
      : previous?.exclusiveAlertRecipients,
    smtp: data.smtp ?? previous?.smtp,
    recorded: num(data.recorded, rows.length),
    alerted: Boolean(data.alerted),
    scannedAt: String(scannedAt),
    bucket: String(bucket),
  }
}

function pad2(n: number) {
  return String(Math.max(0, Math.floor(num(n)))).padStart(2, '0')
}

function formatCountdown(sec: number) {
  const s = Math.max(0, Math.floor(num(sec)))
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`
}

/** Isolated countdown — does NOT re-render the forensic matrix every second. */
const ScanCountdown = memo(function ScanCountdown({
  initialSec,
  autoScan,
  onExpire,
  en,
}: {
  initialSec: number
  autoScan: boolean
  onExpire: () => void
  en: boolean
}) {
  const [sec, setSec] = useState(() => Math.max(1, Math.floor(num(initialSec, 300))))
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire
  const scanningRef = useRef(false)

  useEffect(() => {
    setSec(Math.max(1, Math.floor(num(initialSec, 300))))
  }, [initialSec])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSec((value) => {
        if (!autoScan) return value
        if (value <= 1) {
          if (!scanningRef.current) {
            scanningRef.current = true
            queueMicrotask(() => {
              try {
                onExpireRef.current()
              } finally {
                window.setTimeout(() => {
                  scanningRef.current = false
                }, 1500)
              }
            })
          }
          return 300
        }
        return value - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [autoScan])

  return (
    <span className="rounded-full border border-white/10 px-3 py-1" data-live-timer="" data-no-translate="">
      {en ? 'Next auto-scan' : 'الفحص التلقائي التالي'}:{' '}
      <strong className="text-emerald-300 tabular-nums">{formatCountdown(sec)}</strong>
    </span>
  )
})

function statusBadge(status: ForensicRow['status'], en: boolean) {
  if (status === 'online') {
    return {
      className: 'bg-emerald-900/70 text-emerald-100',
      label: en ? '🟢 Online' : '🟢 متصل',
    }
  }
  if (status === 'forced_offline') {
    return {
      className: 'bg-red-950/80 text-red-100',
      label: en ? '🔴 Forced Offline' : '🔴 إغلاق قسري',
    }
  }
  return {
    className: 'bg-amber-900/70 text-amber-100',
    label: en ? '🟠 Busy / Throttled' : '🟠 مزدحم / نطاق مقلص',
  }
}

function modeBadge(mode: ForensicRow['mode'], en: boolean) {
  if (mode === 'TMP') {
    return {
      className: 'bg-emerald-900/70 text-emerald-100',
      label: en ? '🚚 TMP — Venture fleet (10%)' : '🚚 TMP — توصيل فنتشر فودز (10%)',
    }
  }
  return {
    className: 'bg-red-950/80 text-red-100',
    label: en ? '🚨 TGO — Platform fleet (17% | +7% loss)' : '🚨 TGO — توصيل المنصة (17% | خسارة +7%)',
  }
}

function Workspace() {
  const { t, locale } = useI18n()
  const en = locale === 'en'
  const scope = useOptionalScope()
  const canManage = useCan(permissions.govAggregatorManage)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [autoScan, setAutoScan] = useState(true)
  const [countdownSeed, setCountdownSeed] = useState(300)
  const [period, setPeriod] = useState<ForensicReportPeriod>('daily')
  const [platform, setPlatform] = useState('')
  const [board, setBoard] = useState<BoardPayload | null>(null)
  const [alertBusy, setAlertBusy] = useState(false)
  const [smtpStatus, setSmtpStatus] = useState<BoardPayload['smtp'] | null>(null)
  const [delivery, setDelivery] = useState<DeliveryFeedback | null>(null)
  const boardRef = useRef<BoardPayload | null>(null)
  boardRef.current = board

  const brandId = scope?.brandId ?? null
  const branchId = scope?.branchId ?? null

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams()
      if (brandId) params.set('brandId', brandId)
      if (branchId) params.set('branchId', branchId)
      if (platform) params.set('platform', platform)
      params.set('period', period)
      const page = await apiRequest<{ data: BoardPayload }>(`/api/aggregator-radar?${params.toString()}`, { signal })
      const next = normalizeBoard(page.data, boardRef.current)
      if (!next) throw new Error('invalid_radar_payload')
      setBoard(next)
      if (next.smtp) setSmtpStatus(next.smtp)
      setCountdownSeed(num(next.nextScanInSec || next.autoScanIntervalSec, 300))
      setPhase('ready')
      setError(null)
    },
    [brandId, branchId, platform, period],
  )

  useEffect(() => {
    const controller = new AbortController()
    setPhase((prev) => (boardRef.current ? prev : 'loading'))
    load(controller.signal).catch((caught: unknown) => {
      if (controller.signal.aborted) return
      // Keep last good board — never blank the screen on a soft reload failure.
      if (boardRef.current) {
        setPhase('ready')
        setError(caught instanceof ApiError ? caught.message : t(errorKey(caught)))
        return
      }
      setPhase('error')
      setError(caught instanceof ApiError ? caught.message : t(errorKey(caught)))
    })
    return () => controller.abort()
  }, [load, t])

  const runScan = useCallback(async () => {
    if (!canManage || busy) return
    setBusy(true)
    setNotice(null)
    setScanProgress(8)
    const tick = window.setInterval(() => {
      setScanProgress((value) => (value >= 92 ? value : value + 7))
    }, 180)
    try {
      const result = await apiRequest<{
        data: BoardPayload & { recorded: number; alerted: boolean; scannedAt: string }
      }>('/api/aggregator-radar/scan', {
        method: 'POST',
        body: { brandId, branchId, platform: platform || undefined, alert: true },
        idempotencyKey: newIdempotencyKey(),
      })
      const next = normalizeBoard(result.data, boardRef.current)
      if (!next) {
        setNotice(en ? 'Scan returned incomplete data — keeping previous matrix.' : 'بيانات الفحص ناقصة — الإبقاء على المصفوفة الحالية.')
        setCountdownSeed(300)
        return
      }
      setScanProgress(100)
      setBoard(next)
      setCountdownSeed(num(next.autoScanIntervalSec, 300))
      setError(null)
      const scannedLabel = (() => {
        try {
          return new Date(next.snapshot.scannedAt).toLocaleTimeString(en ? 'en-GB' : 'ar-KW')
        } catch {
          return '—'
        }
      })()
      setNotice(
        en
          ? `Forensic scan complete · ${num(next.recorded, next.rows.length)} cells · ${scannedLabel}`
          : `اكتمل الفحص الجنائي · ${num(next.recorded, next.rows.length)} خلية · ${scannedLabel}`,
      )
      setPhase('ready')
    } catch (caught) {
      // CRITICAL: never clear board on auto/manual scan failure.
      setNotice(
        en
          ? 'Scan delayed or failed — live matrix kept. Retrying on next cycle.'
          : 'تأخر أو فشل الفحص — المصفوفة الحية محفوظة. سيُعاد في الدورة التالية.',
      )
      setError(caught instanceof ApiError ? caught.message : t(errorKey(caught)))
      setCountdownSeed(300)
    } finally {
      window.clearInterval(tick)
      setBusy(false)
      window.setTimeout(() => setScanProgress(0), 600)
    }
  }, [brandId, branchId, platform, canManage, busy, en, t])

  async function sendInstantAlert() {
    setAlertBusy(true)
    setNotice(null)
    setError(null)
    setDelivery(null)
    try {
      const result = await apiRequest<{
        data: {
          delivery: DeliveryFeedback
          smtp?: BoardPayload['smtp']
          summary: DeliveryFeedback['summary'] & {
            critical: number
            watch: number
            clean: number
            kuwaitDate: string
            kuwaitTime: string
          }
          channels: Array<{
            name: string
            email: string
            emailChannel: { ok: boolean; engine: string; message: string; error?: string }
            whatsapp: { ok: boolean; mode: string }
            telegram: { ok: boolean }
          }>
        }
      }>('/api/aggregator-radar/alert', {
        method: 'POST',
        body: {},
      })
      if (result.data.smtp) setSmtpStatus(result.data.smtp)
      const feedback: DeliveryFeedback = {
        ...result.data.delivery,
        summary: result.data.summary,
      }
      setDelivery(feedback)
      if (feedback.ok) {
        setNotice(
          en
            ? `Server delivered via ${feedback.engine.toUpperCase()} to Sec / operations / abdelrahmanm — no mailto popup.`
            : `وُصل من السيرفر عبر ${feedback.engine.toUpperCase()} إلى Sec / operations / abdelrahmanm — بدون mailto.`,
        )
      } else {
        setError(
          en
            ? `Delivery failed (${feedback.engine}): ${feedback.error || feedback.message}`
            : `فشل التسليم (${feedback.engine}): ${feedback.error || feedback.message}`,
        )
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t(errorKey(caught)))
    } finally {
      setAlertBusy(false)
    }
  }

  function exportCsv() {
    if (!board || !Array.isArray(board.rows)) return
    const header = [
      'brand',
      'branch',
      'area',
      'platform',
      'status',
      'mode',
      'offline_minutes',
      'penalty_kwd',
      'lost_sales_kwd',
      'impact_kwd',
      'account',
    ]
    const lines = board.rows.map((row) =>
      [
        row?.brandNameEn ?? '',
        cleanBranchLabel(row?.branchNameEn ?? '', row?.areaEn ?? ''),
        row?.areaEn ?? '',
        row?.platform ?? '',
        row?.status ?? '',
        row?.mode ?? '',
        num(row?.offlineMinutes),
        safeFixed(num(row?.commissionPenaltyMinor) / 1000),
        safeFixed(num(row?.lostSalesMinor) / 1000),
        safeFixed(num(row?.financialImpactMinor) / 1000),
        row?.accountCode ?? '',
      ].join(','),
    )
    const blob = new Blob([`\uFEFF${header.join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `forensic-radar-${period}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const recipients: Array<{ id: string; name: string; title: string; email: string; mobile: string }> =
    board?.exclusiveAlertRecipients?.length
      ? board.exclusiveAlertRecipients.map((r) => ({
          id: r.id,
          name: r.name,
          title: r.title,
          email: r.email,
          mobile: r.mobileDisplay ?? r.mobile,
        }))
      : FALLBACK_ALERT_RECIPIENTS.map((r) => ({ ...r }))

  const lastScanLabel = useMemo(() => {
    const iso = board?.snapshot?.scannedAt ?? board?.scannedAt
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleTimeString(en ? 'en-GB' : 'ar-KW', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kuwait',
      })
    } catch {
      return '—'
    }
  }, [board?.snapshot?.scannedAt, board?.scannedAt, en])

  if (phase === 'loading' && !board) {
    return <p className="text-sm text-gray-400">{en ? 'Loading forensic radar…' : 'جارٍ تحميل الرادار الجنائي…'}</p>
  }
  if (phase === 'error' && !board) {
    return (
      <p className={errorClass} role="alert">
        {error}
      </p>
    )
  }

  const kpis = board?.kpis

  return (
    <div className="space-y-6" data-no-translate="">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {en ? 'Aggregator Forensic Radar' : 'الرادار الجنائي لمنصات التوصيل'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-400">
              {en
                ? 'Live 5-minute detector for Forced Offline / Busy coverage cuts and Talabat TGO 17% vs TMP 10% commission abuse across all 6 brands × 10 branches.'
                : 'كاشف لحظي كل 5 دقائق لإغلاق الفروع القسري وتقليص التغطية وتحويل العمولة من TMP 10% إلى TGO 17% عبر 6 براندات × 10 فروع.'}
            </p>
          </div>
          <SmartIngestLink module="sales_delivery" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
          <span className="rounded-full border border-white/10 px-3 py-1" data-live-timer="">
            {en ? 'Last Scan' : 'آخر فحص'}: <strong className="text-gold-300">{lastScanLabel}</strong>
          </span>
          <ScanCountdown initialSec={countdownSeed} autoScan={autoScan} onExpire={() => void runScan()} en={en} />
          <button
            type="button"
            className={`rounded-full border px-3 py-1 font-semibold ${autoScan ? 'border-emerald-400/50 bg-emerald-950/50 text-emerald-200' : 'border-white/15 text-gray-400'}`}
            onClick={() => setAutoScan((value) => !value)}
          >
            {autoScan ? (en ? 'Auto-Scan: ON 🟢' : 'المسح التلقائي: يعمل 🟢') : en ? 'Auto-Scan: OFF' : 'المسح التلقائي: متوقف'}
          </button>
          <button
            type="button"
            className={secondaryButton}
            onClick={() => scope?.reset()}
            disabled={!brandId && !branchId}
          >
            {en ? 'Show all 6 brands' : 'عرض كل البراندات الـ 6'}
          </button>
        </div>
      </header>

      <p
        className="rounded-xl border border-emerald-400/40 bg-emerald-950/40 px-3 py-2 text-sm font-semibold text-emerald-100"
        role="status"
        dir="ltr"
      >
        🟢 Google Workspace Direct SMTP Active (sec@venturefoodskw.com -&gt; 3 Authorized Recipients)
      </p>

      <section className="rounded-2xl border border-red-400/30 bg-red-950/30 p-4" aria-labelledby="radar-alert-bar">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="radar-alert-bar" className="text-base font-bold text-red-100">
              {en ? 'Exclusive Instant Alert Recipients' : 'مستلمو الإنذار الفوري الحصري'}
            </h2>
            <p className="mt-1 text-xs text-red-100/80">
              {en
                ? 'Server sends the Detailed Daily Operational & Forensic Report via Google Workspace SMTP (sec@venturefoodskw.com) to these three inboxes only. No mailto. No popups. No FormSubmit.'
                : 'السيرفر يرسل التقرير التشغيلي والجنائي المفصل عبر Google Workspace SMTP (sec@venturefoodskw.com) إلى هؤلاء الثلاثة فقط. بدون mailto وبدون نوافذ وبدون FormSubmit.'}
            </p>
          </div>
          {canManage ? (
            <button className={primaryButton} type="button" disabled={alertBusy || busy} onClick={() => void sendInstantAlert()}>
              {alertBusy
                ? en
                  ? 'Sending from server…'
                  : 'جارٍ الإرسال من السيرفر…'
                : en
                  ? '📋 Send Detailed Daily Operational & Forensic Report'
                  : '📋 إرسال التقرير التشغيلي والجنائي المفصل'}
            </button>
          ) : null}
        </div>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {recipients.map((person) => (
            <li key={person.id} className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-gray-100">
              <p className="font-semibold text-white">{person.name}</p>
              <p className="text-xs text-gray-400">{person.title}</p>
              <p className="mt-2 text-emerald-300" dir="ltr">
                {person.email}
              </p>
              <p className="mt-1 font-medium tracking-wide text-gold-300" dir="ltr">
                {'mobile' in person ? person.mobile : ''}
              </p>
            </li>
          ))}
        </ul>

        {delivery ? (
          <div
            className={`mt-4 rounded-xl border p-3 text-sm ${
              delivery.ok
                ? 'border-emerald-400/40 bg-emerald-950/40 text-emerald-50'
                : 'border-red-400/40 bg-red-950/50 text-red-50'
            }`}
            role="status"
          >
            <p className="font-semibold">
              {delivery.ok
                ? en
                  ? `Delivery OK · engine ${delivery.engine.toUpperCase()}`
                  : `تم التسليم · المحرك ${delivery.engine.toUpperCase()}`
                : en
                  ? `Delivery FAILED · engine ${delivery.engine.toUpperCase()}`
                  : `فشل التسليم · المحرك ${delivery.engine.toUpperCase()}`}
            </p>
            <p className="mt-1 text-xs opacity-90">{delivery.message}</p>
            {delivery.error ? <p className="mt-1 text-xs text-red-200">{delivery.error}</p> : null}
            <p className="mt-2 text-xs" dir="ltr">
              To: {delivery.recipients.join(' · ')}
            </p>
            <p className="mt-1 text-xs" dir="ltr">
              Subject: {delivery.subject}
            </p>
            {delivery.messageId ? (
              <p className="mt-1 text-xs opacity-80" dir="ltr">
                Message-ID: {delivery.messageId}
              </p>
            ) : null}
            {delivery.response ? (
              <p className="mt-1 text-xs opacity-80" dir="ltr">
                SMTP: {delivery.response}
              </p>
            ) : null}
            {delivery.summary ? (
              <p className="mt-2 text-xs">
                SUMMARY: {delivery.summary.critical} CRITICAL · {delivery.summary.watch} WATCH · {delivery.summary.clean}{' '}
                CLEAN · {delivery.summary.kuwaitDate} {delivery.summary.kuwaitTime} Asia/Kuwait
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        {canManage ? (
          <button className={primaryButton} type="button" disabled={busy} onClick={() => void runScan()}>
            {busy
              ? en
                ? `Scanning brands × branches… ${scanProgress}%`
                : `جارٍ فحص البراندات × الفروع… ${scanProgress}%`
              : en
                ? '⚡ Run 5-Minute Forensic Scan Now'
                : '⚡ تشغيل الفحص اللحظي الآن'}
          </button>
        ) : null}
        <label className="text-sm text-gray-300">
          {en ? 'Platform' : 'المنصة'}
          <select
            className="ms-2 rounded-lg border border-white/10 bg-ink-900 px-2 py-1.5"
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
          >
            <option value="">{en ? 'All platforms' : 'كل المنصات'}</option>
            {FORENSIC_PLATFORMS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {scope?.brand ? (
          <span className="rounded-full border border-gold-300/30 bg-gold-400/10 px-3 py-1 text-xs text-gold-200">
            {en ? `Scope: ${scope.brand.nameEn}` : `النطاق: ${scope.brand.nameAr}`}
            {scope.branch ? ` · ${en ? scope.branch.areaEn : scope.branch.areaAr}` : ''}
          </span>
        ) : (
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-gray-400">
            {en ? 'Scope: all 6 brands' : 'النطاق: كل البراندات'}
          </span>
        )}
      </div>

      {scanProgress > 0 ? (
        <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div className="h-full bg-gradient-to-r from-emerald-500 to-gold-400 transition-all" style={{ width: `${scanProgress}%` }} />
        </div>
      ) : null}
      {notice ? <p className={noticeClass}>{notice}</p> : null}
      {error ? (
        <p className={errorClass} role="alert">
          {error}
        </p>
      ) : null}

      {kpis ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className={panelClass}>
            <p className="text-xs text-gray-400">{en ? 'Live Branch Status' : 'حالة البراندات والفروع الآن'}</p>
            <p className="mt-2 text-lg font-bold text-emerald-300">
              🟢 {kpis.onlineCount} {en ? 'ONLINE (TMP 10%)' : 'متصل (TMP 10%)'}
            </p>
            <p className="mt-1 text-sm text-red-300">
              🔴 {kpis.offlineCount} {en ? 'FORCED OFFLINE' : 'إغلاق قسري'} · 🟠 {kpis.busyCount} {en ? 'BUSY' : 'مزدحم'}
            </p>
          </article>
          <article className={panelClass}>
            <p className="text-xs text-gray-400">{en ? 'Talabat TGO 17% vs TMP 10%' : 'رصد TGO 17% مقابل TMP 10%'}</p>
            <p className="mt-2 text-sm text-gray-200">
              TMP {safeFixed(num(kpis.tmpOrderShareBps) / 100, 1)}% · TGO {safeFixed(num(kpis.tgoOrderShareBps) / 100, 1)}%
            </p>
            <p className="mt-2 text-[11px] text-gray-400" dir="ltr">
              {kpis.mpAccount} MP 10% · {kpis.tgoAccount} Go 17%
            </p>
          </article>
          <article className={panelClass}>
            <p className="text-xs text-gray-400">{en ? 'Total Forced Offline Duration' : 'إجمالي دقائق الإغلاق القسري'}</p>
            <p className="mt-2 text-2xl font-bold text-amber-200">{kpis.totalOfflineMinutes}</p>
            <p className="text-xs text-gray-400">{en ? 'minutes in current scope' : 'دقيقة ضمن النطاق الحالي'}</p>
          </article>
          <article className={panelClass}>
            <p className="text-xs text-gray-400">{en ? '7% Commission Penalty & Lost Sales' : 'فارق العمولة 7% + المبيعات الضائعة'}</p>
            <p className="mt-2 text-2xl font-bold text-gold-300">{formatKwdMinor(kpis.financialImpactMinor, locale)}</p>
            <p className="mt-1 text-[11px] text-gray-400">
              {en ? 'Penalty' : 'فارق'}: {formatKwdMinor(kpis.commissionPenaltyMinor, locale)} · {en ? 'Lost' : 'ضائع'}:{' '}
              {formatKwdMinor(kpis.lostSalesMinor, locale)}
            </p>
          </article>
        </section>
      ) : null}

      <section className={panelClass}>
        <h2 className="mb-3 font-semibold text-white">
          {en ? 'Live Forensic Matrix — TMP vs TGO & Offline Tracker' : 'مصفوفة الرصد الجنائي الحي — TMP مقابل TGO وتتبع الإغلاق'}
        </h2>
        {!board || !Array.isArray(board.rows) || board.rows.length === 0 ? (
          <p className="text-sm text-gray-400">{en ? 'No rows in current scope. Run a scan.' : 'لا صفوف في النطاق الحالي. شغّل فحصاً.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm text-gray-100">
              <thead className="text-gray-400">
                <tr>
                  <th className="px-2 py-2 text-start">{en ? 'Brand' : 'البراند'}</th>
                  <th className="px-2 py-2 text-start">{en ? 'Branch / Area' : 'الفرع / المنطقة'}</th>
                  <th className="px-2 py-2 text-start">{en ? 'Platform' : 'المنصة'}</th>
                  <th className="px-2 py-2 text-start">{en ? 'Live Status' : 'الحالة اللحظية'}</th>
                  <th className="px-2 py-2 text-start">{en ? 'Active Mode' : 'قناة التوصيل'}</th>
                  <th className="px-2 py-2 text-start">{en ? 'Offline Period' : 'فترة الإغلاق'}</th>
                  <th className="px-2 py-2 text-start">{en ? 'Impact KWD' : 'الأثر المالي'}</th>
                  <th className="px-2 py-2 text-start">{en ? 'Action' : 'إجراء'}</th>
                </tr>
              </thead>
              <tbody>
                {board.rows.map((row) => {
                  if (!row) return null
                  const status = statusBadge(row.status, en)
                  const mode = modeBadge(row.mode, en)
                  const area = en ? row.areaEn : row.areaAr
                  const branch = en ? cleanBranchLabel(row.branchNameEn, row.areaEn) : row.branchNameAr
                  return (
                    <tr key={row.id} className="border-t border-white/5">
                      <td className="px-2 py-2 font-semibold">{displayBrandName(row.brandNameEn, row.brandNameAr, locale)}</td>
                      <td className="px-2 py-2">
                        <span className="block">{branch}</span>
                        <span className="text-[11px] text-gray-400">{area}</span>
                      </td>
                      <td className="px-2 py-2">{row.platform}</td>
                      <td className="px-2 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${status.className}`}>{status.label}</span>
                      </td>
                      <td className="px-2 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${mode.className}`}>{mode.label}</span>
                        <span className="mt-1 block text-[10px] text-gray-500" dir="ltr">
                          {row.accountCode}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-300">
                        {row.offlineMinutes > 0 ? (
                          <>
                            <span className="block">
                              {row.offlineFromIso
                                ? new Date(row.offlineFromIso).toLocaleTimeString(en ? 'en-GB' : 'ar-KW', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true,
                                    timeZone: 'Asia/Kuwait',
                                  })
                                : '—'}{' '}
                              →{' '}
                              {row.offlineToIso
                                ? new Date(row.offlineToIso).toLocaleTimeString(en ? 'en-GB' : 'ar-KW', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true,
                                    timeZone: 'Asia/Kuwait',
                                  })
                                : '—'}
                            </span>
                            <span className="text-amber-200">
                              {en ? `Duration: ${row.offlineMinutes} min` : `المدة: ${row.offlineMinutes} دقيقة`}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-500">{en ? 'No offline window' : 'لا فترة إغلاق'}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 font-semibold text-gold-300">{formatKwdMinor(row.financialImpactMinor, locale)}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className={secondaryButton}
                          disabled={!canManage || busy}
                          onClick={() => void runScan()}
                        >
                          {en ? '⚡ Reopen TMP 10% + log' : '⚡ إعادة فتح TMP 10% + توثيق'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={panelClass} id="forensic-reports">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-white">
            {en ? '📅 Daily / 📊 Weekly / 📈 Monthly Forensic Reports' : '📅 تقارير يومية / 📊 أسبوعية / 📈 شهرية'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {(['daily', 'weekly', 'monthly'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  period === value ? 'border-gold-300 bg-gold-400/15 text-gold-200' : 'border-white/15 text-gray-400'
                }`}
                onClick={() => setPeriod(value)}
              >
                {value === 'daily' ? (en ? 'Daily' : 'يومي') : value === 'weekly' ? (en ? 'Weekly' : 'أسبوعي') : en ? 'Monthly claim' : 'مطالبة شهرية'}
              </button>
            ))}
            <button type="button" className={secondaryButton} onClick={exportCsv}>
              {en ? '📥 Export forensic proof (CSV)' : '📥 تصدير تقرير الإثبات الجنائي (CSV)'}
            </button>
            <button type="button" className={secondaryButton} onClick={() => window.print()}>
              {en ? '🖨️ Print official Talabat claim' : '🖨️ طباعة مذكرة مطالبة رسمية لطلبات'}
            </button>
          </div>
        </div>

        {board?.report ? (
          <div className="space-y-4 text-sm text-gray-100">
            <div className="grid gap-3 md:grid-cols-4">
              <article className="rounded-xl border border-white/10 p-3">
                <p className="text-gray-400">{en ? 'Offline minutes' : 'دقائق الإغلاق'}</p>
                <p className="mt-1 text-xl font-bold">{board.report.totalOfflineMinutes}</p>
              </article>
              <article className="rounded-xl border border-white/10 p-3">
                <p className="text-gray-400">TMP GMV</p>
                <p className="mt-1 text-xl font-bold text-emerald-300">{formatKwdMinor(board.report.tmpGmvMinor, locale)}</p>
              </article>
              <article className="rounded-xl border border-white/10 p-3">
                <p className="text-gray-400">TGO GMV</p>
                <p className="mt-1 text-xl font-bold text-red-300">{formatKwdMinor(board.report.tgoGmvMinor, locale)}</p>
              </article>
              <article className="rounded-xl border border-white/10 p-3">
                <p className="text-gray-400">{en ? 'Claim (+7% + lost sales)' : 'المطالبة (+7% + ضائع)'}</p>
                <p className="mt-1 text-xl font-bold text-gold-300">{formatKwdMinor(board.report.claimMinor, locale)}</p>
              </article>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="text-gray-400">
                  <tr>
                    <th className="px-2 py-2 text-start">{en ? 'Brand' : 'البراند'}</th>
                    <th className="px-2 py-2 text-start">{en ? 'Offline min' : 'دقائق الإغلاق'}</th>
                    <th className="px-2 py-2 text-start">{en ? 'Penalty' : 'فارق العمولة'}</th>
                    <th className="px-2 py-2 text-start">{en ? 'Impact' : 'الأثر'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(board.report.byBrand ?? []).map((row) => (
                    <tr key={row?.brandId ?? row?.brandNameEn} className="border-t border-white/5">
                      <td className="px-2 py-2">{displayBrandName(row?.brandNameEn ?? '', row?.brandNameAr ?? '', locale)}</td>
                      <td className="px-2 py-2">{num(row?.offlineMinutes)}</td>
                      <td className="px-2 py-2">{formatKwdMinor(row?.penaltyMinor, locale)}</td>
                      <td className="px-2 py-2 text-gold-300">{formatKwdMinor(row?.impactMinor, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {period === 'daily' ? (
              <div>
                <h3 className="mb-2 font-semibold text-white">{en ? '24h timeline (5-minute cadence)' : 'خط زمني 24 ساعة (كل 5 دقائق)'}</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {(board.report.timeline ?? []).slice(0, 24).map((slot, idx) => (
                    <div key={slot?.hourLabel ?? idx} className="rounded-lg border border-white/10 px-3 py-2 text-xs">
                      <p className="font-semibold text-gold-200">{slot?.hourLabel ?? '—'}</p>
                      <p>
                        {en ? 'Offline' : 'إغلاق'}: {num(slot?.offlineMinutes)}m
                      </p>
                      <p>
                        TGO: {num(slot?.tgoForcedCount)} · {formatKwdMinor(slot?.impactMinor, locale)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {period !== 'daily' ? (
              <div>
                <h3 className="mb-2 font-semibold text-white">{en ? 'Weekday / period breakdown' : 'تفصيل الأيام / الفترة'}</h3>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(board.report.weekdays ?? []).map((day, idx) => (
                    <li key={day?.dayLabel ?? idx} className="rounded-lg border border-white/10 px-3 py-2 text-xs">
                      <p className="font-semibold text-gold-200">{day?.dayLabel ?? '—'}</p>
                      <p>
                        {en ? 'Offline' : 'إغلاق'}: {num(day?.offlineMinutes)}m · TGO {num(day?.tgoForcedCount)}
                      </p>
                      <p>{formatKwdMinor(day?.impactMinor, locale)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default function AggregatorRadar({ permissions: granted }: { permissions: readonly string[] }) {
  return (
    <PermissionProvider permissions={granted}>
      <Workspace />
    </PermissionProvider>
  )
}
