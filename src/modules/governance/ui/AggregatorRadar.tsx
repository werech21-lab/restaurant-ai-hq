'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatCountdown(sec: number) {
  const s = Math.max(0, sec)
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`
}

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
  const [countdown, setCountdown] = useState(300)
  const [period, setPeriod] = useState<ForensicReportPeriod>('daily')
  const [platform, setPlatform] = useState('')
  const [board, setBoard] = useState<BoardPayload | null>(null)
  const [alertBusy, setAlertBusy] = useState(false)

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
      setBoard(page.data)
      setCountdown(page.data.nextScanInSec || page.data.autoScanIntervalSec || 300)
      setPhase('ready')
      setError(null)
    },
    [brandId, branchId, platform, period],
  )

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    load(controller.signal).catch((caught: unknown) => {
      if (controller.signal.aborted) return
      setPhase('error')
      setError(caught instanceof ApiError ? caught.message : t(errorKey(caught)))
    })
    return () => controller.abort()
  }, [load, t])

  const runScan = useCallback(async () => {
    if (!canManage || busy) return
    setBusy(true)
    setNotice(null)
    setError(null)
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
      setScanProgress(100)
      setBoard(result.data)
      setCountdown(result.data.autoScanIntervalSec || 300)
      setNotice(
        en
          ? `Forensic scan complete · ${result.data.recorded} cells · ${new Date(result.data.scannedAt).toLocaleTimeString()}`
          : `اكتمل الفحص الجنائي · ${result.data.recorded} خلية · ${new Date(result.data.scannedAt).toLocaleTimeString('ar-KW')}`,
      )
      setPhase('ready')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t(errorKey(caught)))
    } finally {
      window.clearInterval(tick)
      setBusy(false)
      window.setTimeout(() => setScanProgress(0), 600)
    }
  }, [brandId, branchId, platform, canManage, busy, en, t])

  // Countdown + auto-scan every 5 minutes.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown((value) => {
        if (!autoScan) return value
        if (value <= 1) {
          void runScan()
          return 300
        }
        return value - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [autoScan, runScan])

  async function sendInstantAlert() {
    setAlertBusy(true)
    setNotice(null)
    try {
      const result = await apiRequest<{
        data: { channels: Array<{ name: string; whatsapp: { href: string }; telegram: { href: string }; emailChannel: { href: string } }> }
      }>('/api/v1/governance/aggregator/alerts/test', {
        method: 'POST',
        body: {},
        idempotencyKey: newIdempotencyKey(),
      })
      setNotice(en ? 'Exclusive alert dispatched to the three recipients.' : 'أُرسل الإنذار الحصري للمستلمين الثلاثة.')
      for (const link of result.data.channels) {
        if (link.whatsapp?.href) window.open(link.whatsapp.href, '_blank', 'noopener,noreferrer')
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t(errorKey(caught)))
    } finally {
      setAlertBusy(false)
    }
  }

  function exportCsv() {
    if (!board) return
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
        row.brandNameEn,
        cleanBranchLabel(row.branchNameEn, row.areaEn),
        row.areaEn,
        row.platform,
        row.status,
        row.mode,
        row.offlineMinutes,
        (row.commissionPenaltyMinor / 1000).toFixed(3),
        (row.lostSalesMinor / 1000).toFixed(3),
        (row.financialImpactMinor / 1000).toFixed(3),
        row.accountCode,
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
    if (!board?.snapshot.scannedAt) return '—'
    return new Date(board.snapshot.scannedAt).toLocaleTimeString(en ? 'en-GB' : 'ar-KW', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kuwait',
    })
  }, [board?.snapshot.scannedAt, en])

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
    <div className="space-y-6">
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
          <span className="rounded-full border border-white/10 px-3 py-1">
            {en ? 'Last Scan' : 'آخر فحص'}: <strong className="text-gold-300">{lastScanLabel}</strong>
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1">
            {en ? 'Next auto-scan' : 'الفحص التلقائي التالي'}: <strong className="text-emerald-300">{formatCountdown(countdown)}</strong>
          </span>
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

      <section className="rounded-2xl border border-red-400/30 bg-red-950/30 p-4" aria-labelledby="radar-alert-bar">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="radar-alert-bar" className="text-base font-bold text-red-100">
              {en ? 'Exclusive Instant Alert Recipients' : 'مستلمو الإنذار الفوري الحصري'}
            </h2>
            <p className="mt-1 text-xs text-red-100/80">
              {en
                ? 'Forced Offline / Busy / forced TGO 17% alerts go only to these three (WhatsApp + Telegram + Email).'
                : 'تنبيهات الإغلاق القسري وتقليص التغطية وتحويل TGO 17% تُرسل حصرياً لهؤلاء الثلاثة.'}
            </p>
          </div>
          {canManage ? (
            <button className={primaryButton} type="button" disabled={alertBusy || busy} onClick={() => void sendInstantAlert()}>
              {alertBusy
                ? en
                  ? 'Sending…'
                  : 'جارٍ الإرسال…'
                : en
                  ? '🚨 Send offline incident alert to the three'
                  : '🚨 إرسال تنبيه حادثة إغلاق فوري للثلاثة'}
            </button>
          ) : null}
        </div>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {recipients.map((person) => (
            <li key={person.id} className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-gray-100">
              <p className="font-semibold text-white">{person.name}</p>
              <p className="text-xs text-gray-400">{person.title}</p>
              <p className="mt-2" dir="ltr">
                <a className="text-emerald-300 underline-offset-2 hover:underline" href={`mailto:${person.email}`}>
                  {person.email}
                </a>
              </p>
              <p className="mt-1 font-medium tracking-wide text-gold-300" dir="ltr">
                {'mobile' in person ? person.mobile : ''}
              </p>
            </li>
          ))}
        </ul>
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
              TMP {(kpis.tmpOrderShareBps / 100).toFixed(1)}% · TGO {(kpis.tgoOrderShareBps / 100).toFixed(1)}%
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
        {!board || board.rows.length === 0 ? (
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
                  {board.report.byBrand.map((row) => (
                    <tr key={row.brandId} className="border-t border-white/5">
                      <td className="px-2 py-2">{displayBrandName(row.brandNameEn, row.brandNameAr, locale)}</td>
                      <td className="px-2 py-2">{row.offlineMinutes}</td>
                      <td className="px-2 py-2">{formatKwdMinor(row.penaltyMinor, locale)}</td>
                      <td className="px-2 py-2 text-gold-300">{formatKwdMinor(row.impactMinor, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {period === 'daily' ? (
              <div>
                <h3 className="mb-2 font-semibold text-white">{en ? '24h timeline (5-minute cadence)' : 'خط زمني 24 ساعة (كل 5 دقائق)'}</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {board.report.timeline.slice(0, 24).map((slot) => (
                    <div key={slot.hourLabel} className="rounded-lg border border-white/10 px-3 py-2 text-xs">
                      <p className="font-semibold text-gold-200">{slot.hourLabel}</p>
                      <p>
                        {en ? 'Offline' : 'إغلاق'}: {slot.offlineMinutes}m
                      </p>
                      <p>
                        TGO: {slot.tgoForcedCount} · {formatKwdMinor(slot.impactMinor, locale)}
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
                  {board.report.weekdays.map((day) => (
                    <li key={day.dayLabel} className="rounded-lg border border-white/10 px-3 py-2 text-xs">
                      <p className="font-semibold text-gold-200">{day.dayLabel}</p>
                      <p>
                        {en ? 'Offline' : 'إغلاق'}: {day.offlineMinutes}m · TGO {day.tgoForcedCount}
                      </p>
                      <p>{formatKwdMinor(day.impactMinor, locale)}</p>
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
