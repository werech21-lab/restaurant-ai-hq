'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, apiRequest } from '@/components/erp/api'
import { errorClass, inputClass, labelClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { useOptionalScope } from '@/components/ScopeProvider'
import { useI18n } from '@/lib/i18n'
import {
  brandScopeLabel,
  categoryLabel,
  countdownParts,
  defaultStorageMode,
  formatKuwaitStamp,
  getShelfLifeRule,
  PREP_CATALOG,
  resolveShelfHours,
  SHELF_LIFE_MATRIX,
  storageModeLabel,
  type BrandScope,
  type FoodSafetyBoard,
  type ShelfCategory,
  type ShelfLifeBatch,
  type ShelfLifeRule,
  type SpoilageReason,
  type StorageMode,
} from '@/modules/food-safety/client'
import { formatKwdMinor } from '@/modules/food-safety/domain/shelf-life'
import { VENTURE_BRANDS } from '@/lib/venture-hierarchy'

type Tab = 'matrix' | 'cold' | 'checkin' | 'dispose' | 'alerts'

function healthLabel(h: string, en: boolean) {
  if (h === 'critical') return en ? '🔴 Critical spoilage risk' : '🔴 خطر تلف حرج'
  if (h === 'warn') return en ? '🟡 Needs inspection' : '🟡 يحتاج فحص'
  if (h === 'offline') return en ? '⚫ Offline' : '⚫ غير متصل'
  return en ? '🟢 Safe & stable' : '🟢 سليم ومستقر'
}

function shelfLabel(s: string, en: boolean) {
  if (s === 'expired') return en ? '🔴 EXPIRED — ban use now' : '🔴 منتهي الصلاحية — حظر استخدام فوري'
  if (s === 'fefo') return en ? '🟠 FEFO priority — use first (< 6h)' : '🟠 أولوية صرف قصوى FEFO (< 6 ساعات)'
  return en ? '🟢 Fresh & safe (> 6h left)' : '🟢 طازج وآمن (> 6 ساعات)'
}

function visionLabel(v: string, en: boolean) {
  if (v === 'danger') return en ? '🔴 Danger: stop use immediately' : '🔴 خطر تلف/عفن: إيقاف استخدام فوري'
  if (v === 'warn') return en ? '🟡 Warning: needs inspection' : '🟡 تحذير: يحتاج فحص'
  return en ? '🟢 Safe & sound' : '🟢 سليم وآمن'
}

const REASONS: { value: SpoilageReason; ar: string; en: string }[] = [
  { value: 'fridge_breakdown', ar: 'عطل ثلاجة', en: 'Fridge breakdown' },
  { value: 'shelf_life_expired', ar: 'انتهاء صلاحية', en: 'Shelf-life expired' },
  { value: 'poor_storage', ar: 'سوء تخزين', en: 'Poor storage' },
  { value: 'supplier_defect', ar: 'تلف من المورد', en: 'Supplier defect' },
]

const BRAND_FILTERS: BrandScope[] = [
  'CENTRAL-KITCHEN',
  'FARM-BROWN',
  'CHINA-GARDEN',
  'FRANKS-STEAK',
  'KARAK-CAFETERIA',
  'THE-NOODLE-BAR',
  'SHAWARMA-TAHINA',
  'SHARED',
]

function LiveCountdown({ expiresAt, status }: { expiresAt: string; status: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const parts = countdownParts(expiresAt, new Date(now))
  const color =
    status === 'expired' || parts.expired
      ? 'text-red-300 animate-pulse'
      : status === 'fefo'
        ? 'text-amber-300'
        : 'text-emerald-300'
  return (
    <span className={`font-mono text-base font-black tabular-nums ${color}`} data-live-timer="" data-no-translate="">
      {parts.display}
    </span>
  )
}

function openLabelHtml(html: string, title: string) {
  const w = window.open('', '_blank', 'width=320,height=420')
  if (!w) return
  w.document.write(html)
  w.document.title = title
  w.document.close()
}

export default function FoodSafetyHub() {
  const { locale } = useI18n()
  const en = locale === 'en'
  const scope = useOptionalScope()
  const [board, setBoard] = useState<FoodSafetyBoard | null>(null)
  const [tab, setTab] = useState<Tab>('matrix')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [genBrand, setGenBrand] = useState<BrandScope>('CENTRAL-KITCHEN')
  const [batchSite, setBatchSite] = useState('')
  const [batchCode, setBatchCode] = useState('PP03192')
  const [batchMode, setBatchMode] = useState<StorageMode>('chiller')
  const [batchBy, setBatchBy] = useState('')
  const [batchQty, setBatchQty] = useState('1')

  const [matrixBrand, setMatrixBrand] = useState<string>('')
  const [matrixCat, setMatrixCat] = useState<string>('')
  const [matrixQ, setMatrixQ] = useState('')

  const [checkSite, setCheckSite] = useState('')
  const [checkUnit, setCheckUnit] = useState('')
  const [checkSlot, setCheckSlot] = useState<'start' | 'mid' | 'end'>('start')
  const [checkName, setCheckName] = useState('')
  const [checkTemp, setCheckTemp] = useState('')
  const [checkPanel, setCheckPanel] = useState('temp-panel.jpg')
  const [checkProduct, setCheckProduct] = useState('products.jpg')
  const [checkNotes, setCheckNotes] = useState('')

  const [dispSite, setDispSite] = useState('')
  const [dispCode, setDispCode] = useState('PP03192')
  const [dispQty, setDispQty] = useState('1')
  const [dispReason, setDispReason] = useState<SpoilageReason>('shelf_life_expired')
  const [dispPhoto, setDispPhoto] = useState('disposal-photo.jpg')
  const [dispBy, setDispBy] = useState('')
  const [dispBatch, setDispBatch] = useState('')

  const selectedRule = useMemo(() => getShelfLifeRule(batchCode), [batchCode])
  const allowedModes = useMemo(
    () => (selectedRule ? (Object.keys(selectedRule.hours) as StorageMode[]).filter((m) => selectedRule.hours[m] != null) : []),
    [selectedRule],
  )
  const previewHours = selectedRule ? resolveShelfHours(selectedRule, batchMode) : null
  const previewExpiry = previewHours != null ? new Date(Date.now() + previewHours * 3_600_000) : null

  useEffect(() => {
    if (!selectedRule) return
    if (!allowedModes.includes(batchMode)) setBatchMode(defaultStorageMode(selectedRule))
  }, [selectedRule, allowedModes, batchMode])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (scope?.brandId) p.set('brandId', scope.brandId)
    if (scope?.branchId) p.set('branchId', scope.branchId)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [scope?.brandId, scope?.branchId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiRequest<{ data: FoodSafetyBoard }>(`/api/food-safety${qs}`)
      setBoard(res.data)
      if (!batchSite && res.data.sites[0]) setBatchSite(res.data.sites.find((s) => s.id === 'CK-QURAIN')?.id ?? res.data.sites[0].id)
      if (!checkSite && res.data.sites[0]) setCheckSite(res.data.sites[0].id)
      if (!dispSite && res.data.sites[0]) setDispSite(res.data.sites[0].id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : en ? 'Failed to load food-safety board' : 'تعذر تحميل لوحة سلامة الغذاء')
    } finally {
      setLoading(false)
    }
  }, [qs, en, batchSite, checkSite, dispSite])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 60_000)
    return () => clearInterval(id)
  }, [load])

  const siteUnits = useMemo(() => (board?.units ?? []).filter((u) => u.siteId === checkSite), [board, checkSite])
  useEffect(() => {
    if (siteUnits[0] && !siteUnits.some((u) => u.id === checkUnit)) setCheckUnit(siteUnits[0].id)
  }, [siteUnits, checkUnit])

  const filteredMatrix = useMemo(() => {
    const q = matrixQ.trim().toLowerCase()
    return SHELF_LIFE_MATRIX.filter((r) => {
      if (matrixCat && r.category !== matrixCat) return false
      if (matrixBrand) {
        const b = matrixBrand as BrandScope
        if (!r.brands.includes(b) && !r.brands.includes('SHARED')) {
          if (b !== 'CENTRAL-KITCHEN' || !r.brands.includes('CENTRAL-KITCHEN')) return false
        }
      }
      if (!q) return true
      return r.code.toLowerCase().includes(q) || r.nameEn.toLowerCase().includes(q) || r.nameAr.includes(q)
    })
  }, [matrixBrand, matrixCat, matrixQ])

  async function createBatchAndPrint() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await apiRequest<{
        data: { batch: ShelfLifeBatch; labelHtml: string; preview: { shelfHours: number } }
      }>('/api/food-safety/batches', {
        method: 'POST',
        body: {
          siteId: batchSite,
          itemCode: batchCode,
          preparedBy: batchBy || (en ? 'CK Prep Lead' : 'مسؤول التحضير'),
          quantity: Number(batchQty) || 1,
          storageMode: batchMode,
          brandId: genBrand === 'CENTRAL-KITCHEN' || genBrand === 'SHARED' ? null : genBrand,
        },
      })
      openLabelHtml(res.data.labelHtml, res.data.batch.barcode)
      setNotice(
        en
          ? `Batch registered · ${res.data.preview.shelfHours}h shelf-life · Brother DK-2205 label opened`
          : `تم تسجيل الدفعة · صلاحية ${res.data.preview.shelfHours} ساعة · فُتح ملصق Brother DK-2205`,
      )
      await load()
      setTab('matrix')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : en ? 'Batch create failed' : 'فشل إنشاء الدفعة')
    } finally {
      setBusy(false)
    }
  }

  async function printLabel(batchId: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await apiRequest<{ data: { labelHtml: string; batch: { barcode: string } } }>(
        `/api/food-safety/batches/label?batchId=${encodeURIComponent(batchId)}`,
      )
      openLabelHtml(res.data.labelHtml, res.data.batch.barcode)
      setNotice(en ? 'Brother DK-2205 (62mm) label ready' : 'ملصق Brother DK-2205 (62مم) جاهز')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : en ? 'Label print failed' : 'فشلت طباعة الملصق')
    } finally {
      setBusy(false)
    }
  }

  async function disposeBatch(batch: ShelfLifeBatch) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await apiRequest<{ data: { accounting: { lossKwd: string; accountCode: string; journalRef: string } } }>(
        '/api/food-safety/dispose',
        {
          method: 'POST',
          body: {
            siteId: batch.siteId,
            itemCode: batch.itemCode,
            quantity: batch.quantity,
            reason: 'shelf_life_expired',
            photoName: `expired-${batch.id}.jpg`,
            createdBy: en ? 'FEFO Auto Dispose' : 'إعدام FEFO',
            batchId: batch.id,
          },
        },
      )
      setNotice(
        en
          ? `Disposed → ${res.data.accounting.accountCode} · ${res.data.accounting.lossKwd} KWD (${res.data.accounting.journalRef})`
          : `أُعدم → ${res.data.accounting.accountCode} · ${res.data.accounting.lossKwd} د.ك (${res.data.accounting.journalRef})`,
      )
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : en ? 'Disposal failed' : 'فشل الإعدام')
    } finally {
      setBusy(false)
    }
  }

  async function alertBatch(batchId: string) {
    setBusy(true)
    setError(null)
    try {
      await apiRequest('/api/food-safety/batches/alert', { method: 'POST', body: { batchId } })
      setNotice(en ? 'Exclusive alert sent to Sec / Operations / Abdelrahman' : 'أُرسل الإنذار الحصري إلى Sec / العمليات / عبدالرحمن')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : en ? 'Alert failed' : 'فشل الإنذار')
    } finally {
      setBusy(false)
    }
  }

  async function submitCheckIn() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await apiRequest<{
        data: { vision: { verdict: string; reasonsEn: string[]; reasonsAr: string[] } }
      }>('/api/food-safety/check-in', {
        method: 'POST',
        body: {
          siteId: checkSite,
          unitId: checkUnit,
          slot: checkSlot,
          supervisorName: checkName || (en ? 'Branch Supervisor' : 'مشرف الفرع'),
          tempPanelPhotoName: checkPanel,
          productPhotoName: checkProduct,
          reportedTempC: checkTemp.trim() ? Number(checkTemp) : null,
          notes: checkNotes || undefined,
        },
      })
      const v = res.data.vision
      setNotice(en ? `AI Vision: ${visionLabel(v.verdict, true)} — ${v.reasonsEn.join('; ')}` : `رادار الرؤية: ${visionLabel(v.verdict, false)} — ${v.reasonsAr.join('; ')}`)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : en ? 'Check-in failed' : 'فشل تسجيل التفتيش')
    } finally {
      setBusy(false)
    }
  }

  async function dispose() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await apiRequest<{ data: { accounting: { lossKwd: string; accountCode: string; journalRef: string } } }>(
        '/api/food-safety/dispose',
        {
          method: 'POST',
          body: {
            siteId: dispSite,
            itemCode: dispCode,
            quantity: Number(dispQty) || 1,
            reason: dispReason,
            photoName: dispPhoto,
            createdBy: dispBy || (en ? 'Branch Supervisor' : 'مشرف الفرع'),
            batchId: dispBatch || null,
          },
        },
      )
      setNotice(
        en
          ? `Disposal logged · ${res.data.accounting.lossKwd} KWD → ${res.data.accounting.accountCode}`
          : `تم الإعدام · ${res.data.accounting.lossKwd} د.ك → ${res.data.accounting.accountCode}`,
      )
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : en ? 'Disposal failed' : 'فشل تسجيل الإعدام')
    } finally {
      setBusy(false)
    }
  }

  function exportMatrix(format: 'csv' | 'pdf') {
    const rows = filteredMatrix.map((r) => {
      const hours = Object.entries(r.hours)
        .map(([m, h]) => `${m}:${h}h`)
        .join(' | ')
      return [r.code, r.nameEn, r.nameAr, categoryLabel(r.category, true), hours, r.keepTempEn, r.fefoWarnHours]
    })
    if (format === 'csv') {
      const header = ['Code', 'Name EN', 'Name AR', 'Category', 'Hours by mode', 'Keep temp', 'FEFO warn h']
      const csv = [header, ...rows].map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'VF-HACCP-Shelf-Life-Matrix.csv'
      a.click()
      URL.revokeObjectURL(url)
      setNotice(en ? 'Excel/CSV matrix exported for kitchen posting' : 'تم تصدير جدول الصلاحيات (CSV) لتعليقه في المطابخ')
      return
    }
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>VF Shelf-Life Matrix</title>
      <style>body{font-family:Arial;background:#0d1117;color:#e6edf3;padding:24px}table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #30363d;padding:6px;text-align:left}th{background:#161b22}</style></head><body>
      <h1>Venture Foods · HACCP Shelf-Life Matrix</h1>
      <p>Kuwait Municipality / FEFO reference — print for all 10 branches + CK</p>
      <table><thead><tr><th>Code</th><th>Item</th><th>Category</th><th>Hours</th><th>Keep</th><th>FEFO</th></tr></thead>
      <tbody>${filteredMatrix
        .map(
          (r) =>
            `<tr><td>${r.code}</td><td>${r.nameEn}</td><td>${categoryLabel(r.category, true)}</td><td>${Object.entries(r.hours)
              .map(([m, h]) => `${m}: ${h}h`)
              .join('<br/>')}</td><td>${r.keepTempEn}</td><td>${r.fefoWarnHours}h</td></tr>`,
        )
        .join('')}</tbody></table>
      <script>window.print()</script></body></html>`)
    w.document.close()
    setNotice(en ? 'PDF print view opened' : 'فُتحت معاينة الطباعة PDF')
  }

  const tabs: { id: Tab; ar: string; en: string }[] = [
    { id: 'matrix', ar: 'مصفوفة الصلاحية وFEFO', en: 'Shelf-life matrix & FEFO' },
    { id: 'cold', ar: 'مراقب البرادات الحي', en: 'Live cold-chain' },
    { id: 'checkin', ar: 'تفتيش وردية بالصورة', en: 'Shift photo check-in' },
    { id: 'dispose', ar: 'إعدام موثق', en: 'Verified disposal' },
    { id: 'alerts', ar: 'إنذارات الطوارئ', en: 'Emergency alerts' },
  ]

  const catalogOptions = useMemo(() => {
    if (genBrand === 'SHARED' || genBrand === 'CENTRAL-KITCHEN') return PREP_CATALOG
    return PREP_CATALOG.filter((p) => {
      const rule = getShelfLifeRule(p.code)
      return rule?.brands.includes(genBrand) || rule?.brands.includes('SHARED') || rule?.brands.includes('CENTRAL-KITCHEN')
    })
  }, [genBrand])

  return (
    <div className="space-y-5 text-gray-100" dir={en ? 'ltr' : 'rtl'}>
      <header className={`${panelClass} border-[#30363d] bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#1c2128]`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300/80">
              {en ? 'HACCP Shelf-Life Matrix · Live FEFO Countdown · Brother DK-2205' : 'مصفوفة صلاحية HACCP · عدّاد FEFO حي · Brother DK-2205'}
            </p>
            <h1 className="mt-1 text-2xl font-black text-white">
              {en ? 'Food Safety & Cold Chain' : 'سلامة الغذاء والبرادات'}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-400">
              {en
                ? 'Standard Kuwait shelf-life hours for all CK PP03* preps and RW01* raw items across 6 brands and 10 branches — exact expiry to the minute, live second countdown, thermal labels.'
                : 'ساعات الصلاحية القياسية لكل تحضيرات PP03* ومواد RW01* عبر 6 براندات و10 فروع — انتهاء بالدقيقة، عدّاد بالثانية، وملصقات حرارية.'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-black text-red-300">
              LIVE · {board?.badgeCount ?? 0}
            </span>
            <a href="/central-kitchen" className="text-xs text-cyan-300 underline">
              {en ? 'Central Kitchen' : 'المطبخ المركزي'}
            </a>
            <a href="/inventory" className="text-xs text-cyan-300 underline">
              {en ? 'Inventory' : 'المخزون'}
            </a>
            <a href="/erp/inventory" className="text-xs text-cyan-300 underline">
              {en ? 'ERP Inventory' : 'مخازن ERP'}
            </a>
            <a href="/stock-count" className="text-xs text-cyan-300 underline">
              {en ? 'Stock count & waste' : 'الجرد والهدر'}
            </a>
          </div>
        </div>
        {board ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: en ? 'Matrix SKUs' : 'أصناف المصفوفة', value: board.matrixCount },
              { label: en ? 'Active batches' : 'دفعات نشطة', value: board.batches.length },
              { label: en ? 'FEFO / Expired' : 'FEFO / منتهية', value: `${board.kpis.batchesFefo} / ${board.kpis.batchesExpired}` },
              { label: en ? 'Critical fridges' : 'برادات حرجة', value: board.kpis.unitsCritical },
              { label: en ? 'Scrap today' : 'هدر اليوم', value: formatKwdMinor(board.kpis.scrapLossMinorToday) },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-[#30363d] bg-[#0d1117]/60 p-3">
                <p className="text-[11px] text-gray-500">{k.label}</p>
                <p className="mt-1 text-xl font-black text-white">{k.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </header>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              tab === t.id ? 'bg-cyan-600 text-white' : 'border border-[#30363d] bg-[#161b22] text-gray-300 hover:bg-[#1c2128]'
            }`}
          >
            {en ? t.en : t.ar}
          </button>
        ))}
        <button type="button" className={secondaryButton} disabled={loading || busy} onClick={() => void load()}>
          {en ? 'Refresh' : 'تحديث'}
        </button>
      </nav>

      {error ? <p className={errorClass}>{error}</p> : null}
      {notice ? <p className={noticeClass}>{notice}</p> : null}
      {loading && !board ? <p className="text-sm text-gray-400">{en ? 'Loading…' : 'جاري التحميل…'}</p> : null}

      {board && tab === 'matrix' ? (
        <div className="space-y-5">
          <section className={`${panelClass} space-y-4 border-cyan-500/20`}>
            <h2 className="text-lg font-bold">
              {en ? 'Instant Batch & Shelf-Life Generator' : 'حاسبة ومولّد دفعات الصلاحية الفوري'}
            </h2>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <label className="block text-sm">
                <span className={labelClass}>{en ? 'Brand' : 'البراند'}</span>
                <select className={inputClass} value={genBrand} onChange={(e) => setGenBrand(e.target.value as BrandScope)}>
                  {BRAND_FILTERS.map((b) => (
                    <option key={b} value={b}>
                      {brandScopeLabel(b, en)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className={labelClass}>{en ? 'Site / CK' : 'الفرع / المطبخ المركزي'}</span>
                <select className={inputClass} value={batchSite} onChange={(e) => setBatchSite(e.target.value)}>
                  {board.sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {en ? s.nameEn : s.nameAr}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm md:col-span-2">
                <span className={labelClass}>{en ? 'Prep / raw SKU' : 'تحضيرة / مادة خام'}</span>
                <select
                  className={inputClass}
                  value={batchCode}
                  onChange={(e) => {
                    setBatchCode(e.target.value)
                    const r = getShelfLifeRule(e.target.value)
                    if (r) setBatchMode(defaultStorageMode(r))
                  }}
                >
                  {catalogOptions.map((p) => (
                    <option key={p.code} value={p.code}>
                      [{p.code}] {en ? p.nameEn : p.nameAr}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className={labelClass}>{en ? 'Storage state' : 'حالة التخزين'}</span>
                <select className={inputClass} value={batchMode} onChange={(e) => setBatchMode(e.target.value as StorageMode)}>
                  {allowedModes.map((m) => (
                    <option key={m} value={m}>
                      {storageModeLabel(m, en)}
                      {selectedRule?.hours[m] != null ? ` · ${selectedRule.hours[m]}h` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className={labelClass}>{en ? 'Qty' : 'الكمية'}</span>
                <input className={inputClass} type="number" min={1} value={batchQty} onChange={(e) => setBatchQty(e.target.value)} />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className={labelClass}>{en ? 'Chef / supervisor' : 'الشيف / المشرف'}</span>
                <input className={inputClass} value={batchBy} onChange={(e) => setBatchBy(e.target.value)} />
              </label>
            </div>
            <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-4 text-sm">
              <p className="text-gray-400">{en ? 'Auto-calculated (Asia/Kuwait)' : 'محسوب تلقائياً (توقيت الكويت)'}</p>
              <p className="mt-1 text-lg font-black text-cyan-200">
                {previewHours != null
                  ? en
                    ? `Standard shelf-life: ${previewHours} hours · EXPIRES ${formatKuwaitStamp(previewExpiry!)}`
                    : `الصلاحية القياسية: ${previewHours} ساعة · ينتهي ${formatKuwaitStamp(previewExpiry!)}`
                  : en
                    ? 'Select a permitted storage mode'
                    : 'اختر حالة تخزين مسموحة'}
              </p>
              {selectedRule ? (
                <p className="mt-1 text-xs text-gray-500">
                  {en ? selectedRule.keepTempEn : selectedRule.keepTempAr}
                  {selectedRule.notesEn ? ` · ${en ? selectedRule.notesEn : selectedRule.notesAr}` : ''}
                </p>
              ) : null}
            </div>
            <button type="button" className={primaryButton} disabled={busy || previewHours == null} onClick={() => void createBatchAndPrint()}>
              {en
                ? '➕ Register batch & print Brother DK-2205 (62mm) barcode label'
                : '➕ تسجيل الدفعة وطباعة ملصق باركود Brother DK-2205 (62مم)'}
            </button>
          </section>

          <section className={`${panelClass} space-y-3`}>
            <h2 className="text-lg font-bold">{en ? 'Live FEFO Countdown Matrix' : 'جدول العد التنازلي الحي للدفعات'}</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-2 py-2">{en ? 'Item' : 'الصنف'}</th>
                    <th className="px-2 py-2">{en ? 'Site' : 'الموقع'}</th>
                    <th className="px-2 py-2">{en ? 'Storage' : 'التخزين'}</th>
                    <th className="px-2 py-2">{en ? 'Prepared' : 'التحضير'}</th>
                    <th className="px-2 py-2">{en ? 'Expires' : 'الانتهاء'}</th>
                    <th className="px-2 py-2">{en ? 'Countdown' : 'العد التنازلي'}</th>
                    <th className="px-2 py-2">{en ? 'Status' : 'الحالة'}</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {board.batches.map((b) => {
                    const site = board.sites.find((s) => s.id === b.siteId)
                    return (
                      <tr key={b.id} className={`border-t border-[#30363d] ${b.status === 'expired' ? 'bg-red-950/30' : b.status === 'fefo' ? 'bg-amber-950/20' : ''}`}>
                        <td className="px-2 py-2">
                          <div className="font-semibold">[{b.itemCode}] {en ? b.itemNameEn : b.itemNameAr}</div>
                          <div className="text-[10px] text-gray-500">{b.barcode}</div>
                        </td>
                        <td className="px-2 py-2 text-gray-300">{en ? site?.nameEn : site?.nameAr}</td>
                        <td className="px-2 py-2">{storageModeLabel(b.storageMode, en)} · {b.shelfHoursApplied}h</td>
                        <td className="px-2 py-2 font-mono text-xs">{formatKuwaitStamp(new Date(b.preparedAt))}</td>
                        <td className="px-2 py-2 font-mono text-xs font-bold">{formatKuwaitStamp(new Date(b.expiresAt))}</td>
                        <td className="px-2 py-2">
                          <LiveCountdown expiresAt={b.expiresAt} status={b.status} />
                        </td>
                        <td className="px-2 py-2">{shelfLabel(b.status, en)}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-1">
                            <button type="button" className={secondaryButton} disabled={busy} onClick={() => void printLabel(b.id)}>
                              {en ? '🖨️ DK-2205' : '🖨️ ملصق'}
                            </button>
                            {b.status === 'expired' ? (
                              <>
                                <button
                                  type="button"
                                  className="rounded-lg border border-red-500/50 bg-red-600/20 px-3 py-1.5 text-xs font-bold text-red-200"
                                  disabled={busy}
                                  onClick={() => void disposeBatch(b)}
                                >
                                  {en ? '🗑️ Dispose → 420001' : '🗑️ إعدام فوري → 420001'}
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-100"
                                  disabled={busy}
                                  onClick={() => void alertBatch(b.id)}
                                >
                                  {en ? '🚨 Alert Sec / Ops / Marketing' : '🚨 إبلاغ الإدارة الثلاثة فوراً'}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`${panelClass} space-y-3`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-bold">
                {en ? 'Master Shelf-Life Reference Guide' : 'جدول المرجع القياسي لساعات الصلاحية'}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondaryButton} onClick={() => exportMatrix('csv')}>
                  {en ? '📥 Export Excel/CSV' : '📥 تصدير Excel/CSV'}
                </button>
                <button type="button" className={secondaryButton} onClick={() => exportMatrix('pdf')}>
                  {en ? '📥 Export PDF for kitchens' : '📥 تصدير PDF للمطابخ'}
                </button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block text-sm">
                <span className={labelClass}>{en ? 'Filter brand' : 'فلتر البراند'}</span>
                <select className={inputClass} value={matrixBrand} onChange={(e) => setMatrixBrand(e.target.value)}>
                  <option value="">{en ? 'All brands' : 'كل البراندات'}</option>
                  {BRAND_FILTERS.map((b) => (
                    <option key={b} value={b}>
                      {brandScopeLabel(b, en)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className={labelClass}>{en ? 'Category' : 'الفئة'}</span>
                <select className={inputClass} value={matrixCat} onChange={(e) => setMatrixCat(e.target.value)}>
                  <option value="">{en ? 'All categories' : 'كل الفئات'}</option>
                  {(['meat_poultry_seafood', 'dim_sum_dough_noodles', 'salads_veg_dairy', 'sauces_dressings'] as ShelfCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c, en)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className={labelClass}>{en ? 'Search' : 'بحث'}</span>
                <input className={inputClass} value={matrixQ} onChange={(e) => setMatrixQ(e.target.value)} placeholder={en ? 'PP03192 / Dynamite…' : 'PP03192 / دايناميت…'} />
              </label>
            </div>
            <p className="text-xs text-gray-500">
              {en
                ? `${filteredMatrix.length} SKUs · Ops Manager / Executive Chef editable reference (HACCP + Kuwait Municipality). Brands: ${VENTURE_BRANDS.map((b) => b.nameEn).join(', ')}.`
                : `${filteredMatrix.length} صنفاً · مرجع قابل للتعديل من مدير العمليات / الشيف التنفيذي (HACCP + بلدية الكويت).`}
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-2 py-2">{en ? 'Code' : 'الكود'}</th>
                    <th className="px-2 py-2">{en ? 'Item' : 'الصنف'}</th>
                    <th className="px-2 py-2">{en ? 'Category' : 'الفئة'}</th>
                    <th className="px-2 py-2">{en ? 'Hours by mode' : 'الساعات حسب الحالة'}</th>
                    <th className="px-2 py-2">{en ? 'Keep temp' : 'درجة الحفظ'}</th>
                    <th className="px-2 py-2">FEFO</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatrix.map((r: ShelfLifeRule) => (
                    <tr key={r.code} className="border-t border-[#30363d]">
                      <td className="px-2 py-2 font-mono text-cyan-300">{r.code}</td>
                      <td className="px-2 py-2">{en ? r.nameEn : r.nameAr}</td>
                      <td className="px-2 py-2 text-gray-400">{categoryLabel(r.category, en)}</td>
                      <td className="px-2 py-2 text-xs">
                        {(Object.entries(r.hours) as [StorageMode, number][]).map(([m, h]) => (
                          <div key={m}>
                            {storageModeLabel(m, en)}: <strong>{h}h</strong>
                          </div>
                        ))}
                      </td>
                      <td className="px-2 py-2 text-xs">{en ? r.keepTempEn : r.keepTempAr}</td>
                      <td className="px-2 py-2">{r.fefoWarnHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {board && tab === 'cold' ? (
        <section className={panelClass}>
          <h2 className="text-lg font-bold">{en ? 'Cold-Chain & Fridge Telemetry Hub' : 'مركز مراقبة البرادات والفريزرات'}</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-2">{en ? 'Site' : 'الموقع'}</th>
                  <th className="px-2 py-2">{en ? 'Unit' : 'الوحدة'}</th>
                  <th className="px-2 py-2">{en ? 'Temp' : 'الحرارة'}</th>
                  <th className="px-2 py-2">{en ? 'Status' : 'الحالة'}</th>
                </tr>
              </thead>
              <tbody>
                {board.units.map((u) => {
                  const site = board.sites.find((s) => s.id === u.siteId)
                  return (
                    <tr key={u.id} className="border-t border-[#30363d]">
                      <td className="px-2 py-2">{en ? site?.nameEn : site?.nameAr}</td>
                      <td className="px-2 py-2">{en ? u.nameEn : u.nameAr}</td>
                      <td className="px-2 py-2 font-mono">{u.tempC.toFixed(1)}°C</td>
                      <td className="px-2 py-2">{healthLabel(u.health, en)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {board && tab === 'checkin' ? (
        <section className={`${panelClass} space-y-4`}>
          <h2 className="text-lg font-bold">{en ? 'Mandatory Shift Check-in (AI Vision)' : 'تفتيش وردية إلزامي (رادار الرؤية)'}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Site' : 'الموقع'}</span>
              <select className={inputClass} value={checkSite} onChange={(e) => setCheckSite(e.target.value)}>
                {board.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {en ? s.nameEn : s.nameAr}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Cold unit' : 'وحدة التبريد'}</span>
              <select className={inputClass} value={checkUnit} onChange={(e) => setCheckUnit(e.target.value)}>
                {siteUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {en ? u.nameEn : u.nameAr}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Shift slot' : 'وقت الوردية'}</span>
              <select className={inputClass} value={checkSlot} onChange={(e) => setCheckSlot(e.target.value as typeof checkSlot)}>
                <option value="start">{en ? 'Start' : 'بداية'}</option>
                <option value="mid">{en ? 'Mid' : 'منتصف'}</option>
                <option value="end">{en ? 'End' : 'نهاية'}</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Supervisor' : 'المشرف'}</span>
              <input className={inputClass} value={checkName} onChange={(e) => setCheckName(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Panel °C' : 'شاشة °م'}</span>
              <input className={inputClass} value={checkTemp} onChange={(e) => setCheckTemp(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Notes' : 'ملاحظات'}</span>
              <input className={inputClass} value={checkNotes} onChange={(e) => setCheckNotes(e.target.value)} />
            </label>
          </div>
          <button type="button" className={primaryButton} disabled={busy || !checkUnit} onClick={() => void submitCheckIn()}>
            {en ? 'Run AI Vision inspection' : 'تشغيل فحص الرؤية الذكية'}
          </button>
        </section>
      ) : null}

      {board && tab === 'dispose' ? (
        <section className={`${panelClass} space-y-4`}>
          <h2 className="text-lg font-bold">{en ? 'Verified Spoilage → 420001 Cost of Scrap' : 'إعدام موثق → 420001 تكلفة التوالف'}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Site' : 'الموقع'}</span>
              <select className={inputClass} value={dispSite} onChange={(e) => setDispSite(e.target.value)}>
                {board.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {en ? s.nameEn : s.nameAr}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Item' : 'الصنف'}</span>
              <select className={inputClass} value={dispCode} onChange={(e) => setDispCode(e.target.value)}>
                {PREP_CATALOG.map((p) => (
                  <option key={p.code} value={p.code}>
                    [{p.code}] {en ? p.nameEn : p.nameAr}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Qty' : 'الكمية'}</span>
              <input className={inputClass} type="number" min={1} value={dispQty} onChange={(e) => setDispQty(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Reason' : 'السبب'}</span>
              <select className={inputClass} value={dispReason} onChange={(e) => setDispReason(e.target.value as SpoilageReason)}>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {en ? r.en : r.ar}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Photo' : 'الصورة'}</span>
              <input className={inputClass} value={dispPhoto} onChange={(e) => setDispPhoto(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'By' : 'المسجّل'}</span>
              <input className={inputClass} value={dispBy} onChange={(e) => setDispBy(e.target.value)} />
            </label>
          </div>
          <button type="button" className="rounded-lg border border-red-500/50 bg-red-600/20 px-4 py-2 text-sm font-bold text-red-200" disabled={busy} onClick={() => void dispose()}>
            {en ? '🗑️ Log Spoilage & Dispose' : '🗑️ تسجيل تلف وإعدام موثق'}
          </button>
        </section>
      ) : null}

      {board && tab === 'alerts' ? (
        <section className={`${panelClass} space-y-4`}>
          <h2 className="text-lg font-bold">{en ? 'Exclusive alerts + maintenance' : 'إنذارات حصرية + الصيانة'}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {board.exclusiveRecipients.map((r) => (
              <div key={r.id} className="rounded-xl border border-[#30363d] bg-[#0d1117] p-3 text-sm">
                <div className="font-bold">{r.name}</div>
                <div className="text-cyan-300">{r.email}</div>
                <div className="text-gray-400">{r.mobileDisplay}</div>
              </div>
            ))}
          </div>
          <a href={board.maintenance.waHref} target="_blank" rel="noreferrer" className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
            {en ? `WhatsApp maintenance · ${board.maintenance.name}` : `واتساب صيانة · ${board.maintenance.name}`}
          </a>
        </section>
      ) : null}
    </div>
  )
}
