'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, apiRequest } from '@/components/erp/api'
import { errorClass, inputClass, labelClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { useOptionalScope } from '@/components/ScopeProvider'
import { useI18n } from '@/lib/i18n'
import { PREP_CATALOG, type FoodSafetyBoard, type SpoilageReason } from '@/modules/food-safety/client'
import { formatKwdMinor } from '@/modules/food-safety/domain/shelf-life'

type Tab = 'cold' | 'shelf' | 'checkin' | 'dispose' | 'alerts'

function healthLabel(h: string, en: boolean) {
  if (h === 'critical') return en ? '🔴 Critical spoilage risk' : '🔴 خطر تلف حرج'
  if (h === 'warn') return en ? '🟡 Needs inspection' : '🟡 يحتاج فحص'
  if (h === 'offline') return en ? '⚫ Offline' : '⚫ غير متصل'
  return en ? '🟢 Safe & stable' : '🟢 سليم ومستقر'
}

function shelfLabel(s: string, en: boolean) {
  if (s === 'expired') return en ? '🔴 Expired / Spoiled — discard now' : '🔴 منتهية الصلاحية / تالفة — إعدام فوري'
  if (s === 'fefo') return en ? '🟠 FEFO priority — use within 6 hours' : '🟠 تقترب من الانتهاء — أولوية صرف خلال 6 ساعات'
  return en ? '🟢 Fresh — safe to use' : '🟢 صالحة وطازجة'
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

export default function FoodSafetyHub() {
  const { locale } = useI18n()
  const en = locale === 'en'
  const scope = useOptionalScope()
  const [board, setBoard] = useState<FoodSafetyBoard | null>(null)
  const [tab, setTab] = useState<Tab>('cold')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [checkSite, setCheckSite] = useState('')
  const [checkUnit, setCheckUnit] = useState('')
  const [checkSlot, setCheckSlot] = useState<'start' | 'mid' | 'end'>('start')
  const [checkName, setCheckName] = useState('')
  const [checkTemp, setCheckTemp] = useState('')
  const [checkPanel, setCheckPanel] = useState('temp-panel.jpg')
  const [checkProduct, setCheckProduct] = useState('products.jpg')
  const [checkNotes, setCheckNotes] = useState('')

  const [batchSite, setBatchSite] = useState('')
  const [batchCode, setBatchCode] = useState(PREP_CATALOG[0]?.code ?? '')
  const [batchBy, setBatchBy] = useState('')
  const [batchQty, setBatchQty] = useState('1')

  const [dispSite, setDispSite] = useState('')
  const [dispCode, setDispCode] = useState(PREP_CATALOG[0]?.code ?? '')
  const [dispQty, setDispQty] = useState('1')
  const [dispReason, setDispReason] = useState<SpoilageReason>('shelf_life_expired')
  const [dispPhoto, setDispPhoto] = useState('disposal-photo.jpg')
  const [dispBy, setDispBy] = useState('')
  const [dispBatch, setDispBatch] = useState('')

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
      if (!checkSite && res.data.sites[0]) setCheckSite(res.data.sites[0].id)
      if (!batchSite && res.data.sites[0]) setBatchSite(res.data.sites[0].id)
      if (!dispSite && res.data.sites[0]) setDispSite(res.data.sites[0].id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : en ? 'Failed to load food-safety board' : 'تعذر تحميل لوحة سلامة الغذاء')
    } finally {
      setLoading(false)
    }
  }, [qs, en, checkSite, batchSite, dispSite])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 60_000)
    return () => clearInterval(id)
  }, [load])

  const siteUnits = useMemo(
    () => (board?.units ?? []).filter((u) => u.siteId === checkSite),
    [board, checkSite],
  )

  useEffect(() => {
    if (siteUnits[0] && !siteUnits.some((u) => u.id === checkUnit)) {
      setCheckUnit(siteUnits[0].id)
    }
  }, [siteUnits, checkUnit])

  async function submitCheckIn() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await apiRequest<{
        data: { vision: { verdict: string; reasonsEn: string[]; reasonsAr: string[] }; dispatch: unknown }
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
      setNotice(
        en
          ? `AI Vision: ${visionLabel(v.verdict, true)} — ${v.reasonsEn.join('; ')}`
          : `رادار الرؤية: ${visionLabel(v.verdict, false)} — ${v.reasonsAr.join('; ')}`,
      )
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : en ? 'Check-in failed' : 'فشل تسجيل التفتيش')
    } finally {
      setBusy(false)
    }
  }

  async function createBatch() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await apiRequest<{ data: { batch: { id: string; barcode: string }; label: string } }>(
        '/api/food-safety/batches',
        {
          method: 'POST',
          body: {
            siteId: batchSite,
            itemCode: batchCode,
            preparedBy: batchBy || (en ? 'CK Prep Lead' : 'مسؤول التحضير'),
            quantity: Number(batchQty) || 1,
          },
        },
      )
      setNotice(en ? `Batch created · barcode ${res.data.batch.barcode}` : `أُنشئت الدفعة · باركود ${res.data.batch.barcode}`)
      await load()
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
      const res = await apiRequest<{ data: { label: string; batch: { barcode: string } } }>(
        `/api/food-safety/batches/label?batchId=${encodeURIComponent(batchId)}`,
      )
      const w = window.open('', '_blank', 'width=420,height=560')
      if (w) {
        w.document.write(
          `<pre style="font-family:ui-monospace,monospace;padding:16px;background:#0d1117;color:#e6edf3;white-space:pre-wrap">${res.data.label.replace(/</g, '&lt;')}</pre>`,
        )
        w.document.title = `Brother DK-2205 · ${res.data.batch.barcode}`
        w.print()
      }
      setNotice(en ? 'Brother DK-2205 label ready to print' : 'ملصق Brother DK-2205 جاهز للطباعة')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : en ? 'Label print failed' : 'فشلت طباعة الملصق')
    } finally {
      setBusy(false)
    }
  }

  async function dispose() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await apiRequest<{
        data: { accounting: { lossKwd: string; accountCode: string; journalRef: string }; disposal: { id: string } }
      }>('/api/food-safety/dispose', {
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
      })
      setNotice(
        en
          ? `Disposal logged · loss ${res.data.accounting.lossKwd} KWD posted to ${res.data.accounting.accountCode} (${res.data.accounting.journalRef})`
          : `تم تسجيل الإعدام · خسارة ${res.data.accounting.lossKwd} د.ك إلى ${res.data.accounting.accountCode} (${res.data.accounting.journalRef})`,
      )
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : en ? 'Disposal failed' : 'فشل تسجيل الإعدام')
    } finally {
      setBusy(false)
    }
  }

  const tabs: { id: Tab; ar: string; en: string }[] = [
    { id: 'cold', ar: 'مراقب البرادات الحي', en: 'Live cold-chain' },
    { id: 'shelf', ar: 'صلاحية FEFO', en: 'FEFO shelf-life' },
    { id: 'checkin', ar: 'تفتيش وردية بالصورة', en: 'Shift photo check-in' },
    { id: 'dispose', ar: 'إعدام موثق', en: 'Verified disposal' },
    { id: 'alerts', ar: 'إنذارات الطوارئ', en: 'Emergency alerts' },
  ]

  return (
    <div className="space-y-5 text-gray-100" dir={en ? 'ltr' : 'rtl'}>
      <header className={`${panelClass} border-[#30363d] bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#1c2128]`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300/80">
              {en ? 'Smart Cold-Chain · Shelf-Life · AI Spoilage Radar' : 'سلسلة تبريد ذكية · صلاحية · رادار تلف بالذكاء'}
            </p>
            <h1 className="mt-1 text-2xl font-black text-white">
              {en ? 'Food Safety & Cold Chain' : 'سلامة الغذاء والبرادات'}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-400">
              {en
                ? 'Live fridge telemetry across 10 branches + Central Kitchen, mandatory AI vision shift checks, FEFO prep tracking, and scrap posting to 420001 Cost of Scrap.'
                : 'مراقبة حية للبرادات عبر 10 فروع + المطبخ المركزي، تفتيش وردية إلزامي بالرؤية الذكية، تتبع صلاحية التحضيرات FEFO، وترحيل التوالف إلى حساب 420001 تكلفة التوالف والهدر.'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-black text-red-300">
              LIVE · {board?.badgeCount ?? 0}
            </span>
            <a href="/central-kitchen" className="text-xs text-cyan-300 underline">
              {en ? 'Central Kitchen' : 'المطبخ المركزي'}
            </a>
            <a href="/stock-count" className="text-xs text-cyan-300 underline">
              {en ? 'Stock count & waste' : 'الجرد والهدر'}
            </a>
          </div>
        </div>

        {board ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: en ? 'Cold units' : 'وحدات التبريد', value: board.kpis.unitsTotal },
              { label: en ? 'Critical fridges' : 'برادات حرجة', value: board.kpis.unitsCritical, danger: true },
              { label: en ? 'FEFO / Expired' : 'FEFO / منتهية', value: `${board.kpis.batchesFefo} / ${board.kpis.batchesExpired}` },
              {
                label: en ? 'Scrap loss today' : 'هدر اليوم',
                value: formatKwdMinor(board.kpis.scrapLossMinorToday),
              },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-[#30363d] bg-[#0d1117]/60 p-3">
                <p className="text-[11px] text-gray-500">{k.label}</p>
                <p className={`mt-1 text-xl font-black ${k.danger && Number(k.value) > 0 ? 'text-red-300' : 'text-white'}`}>{k.value}</p>
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

      {board && tab === 'cold' ? (
        <section className={panelClass}>
          <h2 className="text-lg font-bold">{en ? 'Cold-Chain & Fridge Telemetry Hub' : 'مركز مراقبة البرادات والفريزرات'}</h2>
          <p className="mt-1 text-xs text-gray-500">
            {en
              ? 'IoT webhook: POST /api/food-safety/telemetry every 5 minutes (temp, humidity, door).'
              : 'ويب هوك الحساسات: POST /api/food-safety/telemetry كل 5 دقائق (حرارة، رطوبة، باب).'}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-2">{en ? 'Site' : 'الموقع'}</th>
                  <th className="px-2 py-2">{en ? 'Unit' : 'الوحدة'}</th>
                  <th className="px-2 py-2">{en ? 'Temp' : 'الحرارة'}</th>
                  <th className="px-2 py-2">{en ? 'Humidity' : 'الرطوبة'}</th>
                  <th className="px-2 py-2">{en ? 'Door' : 'الباب'}</th>
                  <th className="px-2 py-2">{en ? 'Status' : 'الحالة'}</th>
                </tr>
              </thead>
              <tbody>
                {board.units.map((u) => {
                  const site = board.sites.find((s) => s.id === u.siteId)
                  return (
                    <tr key={u.id} className="border-t border-[#30363d]">
                      <td className="px-2 py-2 text-gray-300">{en ? site?.nameEn : site?.nameAr}</td>
                      <td className="px-2 py-2">{en ? u.nameEn : u.nameAr}</td>
                      <td className="px-2 py-2 font-mono">{u.tempC.toFixed(1)}°C</td>
                      <td className="px-2 py-2">{u.humidityPct}%</td>
                      <td className="px-2 py-2">{u.door}</td>
                      <td className="px-2 py-2">{healthLabel(u.health, en)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {board && tab === 'shelf' ? (
        <section className={`${panelClass} space-y-4`}>
          <h2 className="text-lg font-bold">{en ? 'Shelf-Life & FEFO Expiry Tracker' : 'رادار العمر الافتراضي وFEFO'}</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Site' : 'الموقع'}</span>
              <select className={inputClass} value={batchSite} onChange={(e) => setBatchSite(e.target.value)}>
                {board.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {en ? s.nameEn : s.nameAr}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Prep / item' : 'تحضيرة / صنف'}</span>
              <select className={inputClass} value={batchCode} onChange={(e) => setBatchCode(e.target.value)}>
                {PREP_CATALOG.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code} · {en ? p.nameEn : p.nameAr}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Prepared by' : 'المسؤول'}</span>
              <input className={inputClass} value={batchBy} onChange={(e) => setBatchBy(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Qty' : 'الكمية'}</span>
              <input className={inputClass} type="number" min={1} value={batchQty} onChange={(e) => setBatchQty(e.target.value)} />
            </label>
          </div>
          <button type="button" className={primaryButton} disabled={busy} onClick={() => void createBatch()}>
            {en ? 'Create shelf-life batch' : 'إنشاء دفعة صلاحية'}
          </button>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-2">{en ? 'Item' : 'الصنف'}</th>
                  <th className="px-2 py-2">{en ? 'Brand / Site' : 'البراند / الفرع'}</th>
                  <th className="px-2 py-2">{en ? 'Prepared' : 'التحضير'}</th>
                  <th className="px-2 py-2">{en ? 'Expires' : 'الانتهاء'}</th>
                  <th className="px-2 py-2">{en ? 'Remaining' : 'المتبقي'}</th>
                  <th className="px-2 py-2">{en ? 'Status' : 'الحالة'}</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {board.batches.map((b) => (
                  <tr key={b.id} className="border-t border-[#30363d]">
                    <td className="px-2 py-2">
                      <div className="font-semibold">{en ? b.itemNameEn : b.itemNameAr}</div>
                      <div className="text-xs text-gray-500">{b.itemCode}</div>
                    </td>
                    <td className="px-2 py-2 text-gray-300">
                      {en ? b.brandNameEn : b.brandNameAr}
                      <div className="text-xs">{b.siteId}</div>
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{new Date(b.preparedAt).toLocaleString(en ? 'en-GB' : 'ar-KW')}</td>
                    <td className="px-2 py-2 font-mono text-xs">{new Date(b.expiresAt).toLocaleString(en ? 'en-GB' : 'ar-KW')}</td>
                    <td className="px-2 py-2">{b.hoursRemaining}h</td>
                    <td className="px-2 py-2">{shelfLabel(b.status, en)}</td>
                    <td className="px-2 py-2">
                      <button type="button" className={secondaryButton} disabled={busy} onClick={() => void printLabel(b.id)}>
                        {en ? '🖨️ Print Brother DK-2205' : '🖨️ طباعة ملصق Brother DK-2205'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {board && tab === 'checkin' ? (
        <section className={`${panelClass} space-y-4`}>
          <h2 className="text-lg font-bold">
            {en ? 'Mandatory Shift Check-in with Photo (AI Vision)' : 'تفتيش وردية إلزامي بالصورة (رادار الرؤية)'}
          </h2>
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
                <option value="start">{en ? 'Start of shift' : 'بداية الوردية'}</option>
                <option value="mid">{en ? 'Mid shift' : 'منتصف الوردية'}</option>
                <option value="end">{en ? 'End of shift' : 'نهاية الوردية'}</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Supervisor' : 'المشرف'}</span>
              <input className={inputClass} value={checkName} onChange={(e) => setCheckName(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Panel reading °C' : 'قراءة الشاشة °م'}</span>
              <input className={inputClass} value={checkTemp} onChange={(e) => setCheckTemp(e.target.value)} placeholder="e.g. 6.2" />
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Notes / spoilage cues' : 'ملاحظات / علامات تلف'}</span>
              <input className={inputClass} value={checkNotes} onChange={(e) => setCheckNotes(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Temp panel photo file' : 'ملف صورة شاشة الحرارة'}</span>
              <input className={inputClass} value={checkPanel} onChange={(e) => setCheckPanel(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Product photo file' : 'ملف صورة المواد'}</span>
              <input className={inputClass} value={checkProduct} onChange={(e) => setCheckProduct(e.target.value)} />
            </label>
          </div>
          <button type="button" className={primaryButton} disabled={busy || !checkUnit} onClick={() => void submitCheckIn()}>
            {en ? 'Run AI Vision inspection' : 'تشغيل فحص الرؤية الذكية'}
          </button>
          <div className="space-y-2">
            {board.checkIns.slice(0, 12).map((c) => (
              <div key={c.id} className="rounded-lg border border-[#30363d] bg-[#0d1117]/50 p-3 text-sm">
                <div className="font-semibold">{visionLabel(c.visionVerdict, en)}</div>
                <div className="text-xs text-gray-400">
                  {c.siteId} · {c.slot} · {c.supervisorName} · {new Date(c.createdAt).toLocaleString(en ? 'en-GB' : 'ar-KW')}
                </div>
                <div className="mt-1 text-xs text-gray-300">{en ? c.visionReasonsEn.join(' · ') : c.visionReasonsAr.join(' · ')}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {board && tab === 'dispose' ? (
        <section className={`${panelClass} space-y-4`}>
          <h2 className="text-lg font-bold">
            {en ? 'Verified Spoilage Disposal & Auto-Accounting' : 'بروتوكول الإعدام الموثق والترحيل المحاسبي'}
          </h2>
          <p className="text-xs text-gray-500">
            {en
              ? `Deducts branch stock and posts loss to ${board.scrapAccount.code} ${board.scrapAccount.nameEn} (P&L + /stock-count).`
              : `يخصم من مخزون الفرع ويرحّل الخسارة إلى ${board.scrapAccount.code} ${board.scrapAccount.nameAr} (قائمة الدخل + /stock-count).`}
          </p>
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
                    {en ? p.nameEn : p.nameAr}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Qty spoiled' : 'الكمية التالفة'}</span>
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
              <span className={labelClass}>{en ? 'Disposal photo' : 'صورة الإعدام'}</span>
              <input className={inputClass} value={dispPhoto} onChange={(e) => setDispPhoto(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className={labelClass}>{en ? 'Recorded by' : 'المسجّل'}</span>
              <input className={inputClass} value={dispBy} onChange={(e) => setDispBy(e.target.value)} />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className={labelClass}>{en ? 'Linked batch (optional)' : 'دفعة مرتبطة (اختياري)'}</span>
              <select className={inputClass} value={dispBatch} onChange={(e) => setDispBatch(e.target.value)}>
                <option value="">{en ? '— None —' : '— بدون —'}</option>
                {board.batches
                  .filter((b) => b.siteId === dispSite)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id} · {en ? b.itemNameEn : b.itemNameAr}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <button type="button" className="rounded-lg border border-red-500/50 bg-red-600/20 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-600/30" disabled={busy} onClick={() => void dispose()}>
            {en ? '🗑️ Log Spoilage & Dispose' : '🗑️ تسجيل تلف وإعدام موثق بالصورة'}
          </button>
          <div className="space-y-2">
            {board.disposals.map((d) => (
              <div key={d.id} className="rounded-lg border border-[#30363d] bg-[#0d1117]/50 p-3 text-sm">
                <div className="font-semibold">
                  {en ? d.itemNameEn : d.itemNameAr} × {d.quantity} · {formatKwdMinor(d.lossMinor)} → {d.scrapAccountCode}
                </div>
                <div className="text-xs text-gray-400">
                  {en ? d.siteNameEn : d.siteNameAr} · {d.journalRef} · {d.reason} · {d.photoName}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {board && tab === 'alerts' ? (
        <section className={`${panelClass} space-y-4`}>
          <h2 className="text-lg font-bold">{en ? 'Exclusive emergency alerts + maintenance' : 'إنذارات حصرية + الصيانة'}</h2>
          <p className="text-sm text-gray-400">
            {en
              ? 'Critical fridge faults and spoilage alerts go only to these three contacts, with a one-tap maintenance ticket for Rabih Anis Yehia.'
              : 'أعطال البرادات الحرجة وتسجيلات التلف تُرسل حصرياً لهؤلاء الثلاثة، مع زر بلاغ صيانة فوري لرابيح أنيس يحيى.'}
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {board.exclusiveRecipients.map((r) => (
              <div key={r.id} className="rounded-xl border border-[#30363d] bg-[#0d1117] p-3 text-sm">
                <div className="font-bold text-white">{r.name}</div>
                <div className="text-cyan-300">{r.email}</div>
                <div className="text-gray-400">{r.mobileDisplay}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="font-bold text-amber-100">{board.maintenance.name}</div>
            <div className="text-sm text-amber-50/80">{en ? board.maintenance.titleEn : board.maintenance.titleAr}</div>
            <div className="mt-1 text-sm text-amber-100">{board.maintenance.mobileDisplay}</div>
            <a
              href={board.maintenance.waHref}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
            >
              {en ? 'Open urgent maintenance ticket (WhatsApp)' : 'فتح بلاغ صيانة فوري (واتساب)'}
            </a>
          </div>
          <div className="space-y-2">
            {board.alerts.map((a) => (
              <div key={a.id} className="rounded-lg border border-[#30363d] bg-[#0d1117]/50 p-3 text-sm">
                <div className="font-semibold">{en ? a.titleEn : a.titleAr}</div>
                <div className="text-xs text-gray-400">{en ? a.detailEn : a.detailAr}</div>
                <a href={a.maintenanceHref} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-emerald-300 underline">
                  {en ? 'Ping maintenance now' : 'إبلاغ الصيانة الآن'}
                </a>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
