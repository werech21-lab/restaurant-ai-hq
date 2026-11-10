'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  MessageCircle,
  Radar,
  Search,
  ShieldAlert,
  Truck,
  X,
} from 'lucide-react'
import { CHANNEL_ECONOMICS } from '@/lib/aether-proprietary-brain'
import { BRANDS, CHANNELS, LEDGER } from '@/lib/aether/ledger'
import { ODOO } from '@/lib/odoo/odoo-dataset'
import JOURNEY from '@/lib/odoo/odoo-journey.json'
import { INITIAL_BRANCH_PROFILES, type DeliveryZoneStatus } from '@/lib/radar/talabat-geo-zone-radar'
import { useLang } from '@/components/aether/ui'

const f0 = (n: number) => Math.round(n).toLocaleString('en-US')
const f1 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const f3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

const card = 'ae-studio-card relative min-w-0 overflow-hidden p-5'
const PROMO_CAP = LEDGER.keetaCapPct

type RadarTab = 'commissions' | 'zones' | 'matrix'
type ModeFilter = 'all' | 'Tgo' | 'M' | 'alert'
type PlatformRow = {
  platform: string
  openBalanceKwd: number
  clearingKwd: number
  receivableKwd: number
  booked30Kwd: number
  settled30Kwd: number
}

const J = JOURNEY as unknown as {
  delivery: {
    platforms: PlatformRow[]
    postedCommissions30: Record<string, number>
    postedCommissionsPrior30: Record<string, number>
  }
}

const PLATFORM_AR: Record<string, string> = {
  Talabat: 'طلبات',
  Keeta: 'كيتا',
  Deliveroo: 'ديليفرو',
  Jahez: 'جاهز',
  Snoonu: 'سنونو',
  Cari: 'كاري',
  Bilbayt: 'بالبيت',
}

const PLATFORM_CHANNELS: Record<string, string[]> = {
  Talabat: ['talabat-tgo', 'talabat-tmp'],
  Keeta: ['keeta'],
  Deliveroo: ['deliveroo-go', 'deliveroo-mp'],
  Jahez: ['jahez'],
  Snoonu: ['snoonu'],
}

const WHITELISTED_BRAND_IDS = new Set(BRANDS.map((b) => b.id as string))

function statusMeta(status: DeliveryZoneStatus, isAr: boolean) {
  switch (status) {
    case 'FORCED_TGO_17':
      return {
        cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
        label: isAr ? 'تحول قسري Tgo 17%' : 'Forced Tgo 17%',
      }
    case 'AREA_CLOSED_HIDDEN':
      return {
        cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
        label: isAr ? 'نطاق مقلّص' : 'Polygon Cut',
      }
    case 'BUSY_IN_AREA':
      return {
        cls: 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
        label: isAr ? 'ضغط ذروة' : 'Busy Peak',
      }
    default:
      return {
        cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
        label: isAr ? 'متاح وظاهر' : 'Online & Active',
      }
  }
}

/**
 * Loop AI Superpower #4 — Delivery & Aggregator Radar (Single Clean 1540px 3-Tab Studio Workspace):
 * Tab 1: Commissions & Campaign Net-ROI Autopsy + 1-Click Formal Claim Dossier
 * Tab 2: Fast Searchable Tgo / TMP Zone Coverage Radar
 * Tab 3: Whitelisted Brand × Platform Bank Reconciliation & Settlement Matrix
 */
export function DeliveryRadarV5() {
  const { isAr, T } = useLang()
  const [tab, setTab] = useState<RadarTab>('commissions')
  const [statement, setStatement] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [activeClaimModal, setActiveClaimModal] = useState<{ title: string; body: string } | null>(null)

  // Tab 2 filters
  const [zoneQuery, setZoneQuery] = useState('')
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all')

  // Tab 3 brand filter (strictly whitelisted Venture Foods brands)
  const [selectedBrandId, setSelectedBrandId] = useState<string>('all')

  const kwd = (n: number, d = 0) => (isAr ? `${d ? f3(n) : f0(n)} د.ك` : `${d ? f3(n) : f0(n)} KWD`)

  const commissionAudit = useMemo(
    () =>
      Object.entries(PLATFORM_CHANNELS)
        .map(([platform, ids]) => {
          const chans = ids.map((id) => CHANNELS.find((c) => c.id === id)).filter((c): c is (typeof CHANNELS)[number] => !!c)
          const sales = chans.reduce((s, c) => s + c.sales, 0)
          const orders = chans.reduce((s, c) => s + c.orders, 0)
          const contract = sales ? chans.reduce((s, c) => s + c.sales * (c.commissionPct / 100), 0) : 0
          const posted = J.delivery.postedCommissions30[platform] ?? 0
          const prior = J.delivery.postedCommissionsPrior30[platform] ?? 0
          const clearing = J.delivery.platforms.find((p) => p.platform === platform)?.clearingKwd ?? 0
          const overchargeKwd = Math.max(0, posted - contract)
          return {
            platform,
            sales,
            orders,
            contract,
            posted,
            prior,
            clearing,
            overchargeKwd,
            effectivePct: sales ? (posted / sales) * 100 : 0,
            contractPct: sales ? (contract / sales) * 100 : 0,
          }
        })
        .filter((r) => r.sales > 0),
    [],
  )

  const tabs: { id: RadarTab; en: string; ar: string }[] = [
    { id: 'commissions', en: 'Commissions & Campaign ROI Verdict', ar: 'ملخص العمولات وحكم ربحية العروض' },
    { id: 'zones', en: 'Zone Accounts Coverage · Tgo / TMP', ar: 'تغطية حسابات المناطق Tgo / TMP' },
    { id: 'matrix', en: 'Bank Reconciliation & Settlement Matrix', ar: 'مصفوفة المطابقة والتسويات البنكية' },
  ]

  // Flattened searchable zone accounts for Tab 2 (whitelisted brands & branches only)
  const allZoneAccounts = useMemo(() => {
    const out = []
    for (const p of INITIAL_BRANCH_PROFILES) {
      const loc = ODOO.restaurants.find((r) => r.en === p.branchNameEn)
      for (const acc of p.zoneAccounts) {
        if (!WHITELISTED_BRAND_IDS.has(acc.brandId)) continue
        out.push({
          ...acc,
          branchNetKwd: loc?.netKwd ?? 0,
        })
      }
    }
    return out
  }, [])

  const filteredZones = useMemo(() => {
    const q = zoneQuery.trim().toLowerCase()
    return allZoneAccounts.filter((acc) => {
      if (modeFilter === 'Tgo' && acc.deliveryMode !== 'Tgo') return false
      if (modeFilter === 'M' && acc.deliveryMode !== 'M') return false
      if (modeFilter === 'alert' && acc.status === 'ONLINE_VISIBLE') return false
      if (!q) return true
      const hay = [
        acc.branchNameEn,
        acc.branchNameAr,
        acc.brandNameEn,
        acc.brandNameAr,
        acc.platform,
        acc.sectorNameEn,
        acc.sectorNameAr,
        ...acc.coveredAreasEn,
        ...acc.coveredAreasAr,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [allZoneAccounts, modeFilter, zoneQuery])

  // Brand share multiplier for Tab 3 filtering
  const selectedBrandScale = useMemo(() => {
    if (selectedBrandId === 'all') return 1
    const totalBrandSales = BRANDS.reduce((s, b) => s + b.sales, 0)
    const hit = BRANDS.find((b) => b.id === selectedBrandId)
    return hit && totalBrandSales > 0 ? hit.sales / totalBrandSales : 1
  }, [selectedBrandId])

  const buildPlatformClaimDossier = (r: (typeof commissionAudit)[number]) => {
    const pName = isAr ? PLATFORM_AR[r.platform] ?? r.platform : r.platform
    const variance = r.overchargeKwd > 50 ? r.overchargeKwd : r.clearing
    if (isAr) {
      return [
        `📋 ملف مطالبة رسمية ومطابقة عمولات — شركة فنتشر فودز لإدارة المطاعم ذ.م.م (ترخيص ${LEDGER.licence})`,
        `إلى: مدير الحسابات الرئيسية — منصة ${pName}`,
        `الفترة المرجعية الموثقة في أودو 17: ${LEDGER.periodLabelAr}`,
        ``,
        `1. إجمالي مبيعات نقاط البيع الموثقة (${f0(r.orders)} طلب): ${f3(r.sales)} د.ك`,
        `2. العمولة التعاقدية المتفق عليها (${f1(r.contractPct)}%): ${f3(r.contract)} د.ك`,
        r.posted > 0
          ? `3. المبلغ المستقطع فعلياً في فواتير المنصة (${f1(r.effectivePct)}%): ${f3(r.posted)} د.ك`
          : `3. الرصيد المفتوح المعلّق في حساب تسوية أودو: ${f3(r.clearing)} د.ك`,
        `4. صافي الفرق المطالب بتسويته / إشعار دائن فوري: ${f3(variance)} د.ك`,
        ``,
        `المطلوب خلال 5 أيام عمل:`,
        `• كشف تفصيلي على مستوى الطلب للرسوم غير التعاقدية (CPC / رسوم توصيل إضافية / استقطاعات ملغاة).`,
        `• إصدار إشعار دائن ورد مبلغ ${f3(variance)} د.ك في التحويل البنكي القادم.`,
      ].join('\n')
    }
    return [
      `📋 FORMAL AGGREGATOR DISPUTE & CLAIM DOSSIER — Venture Foods Restaurants Management Co. W.L.L. (Licence ${LEDGER.licence})`,
      `To: Key Account Manager — ${r.platform} Kuwait`,
      `Audited Odoo 17 Period: ${LEDGER.periodLabelEn}`,
      ``,
      `1. Verified Odoo POS Gross Platform Takings (${f0(r.orders)} orders): ${f3(r.sales)} KWD`,
      `2. Contractual Commission (${f1(r.contractPct)}%): ${f3(r.contract)} KWD`,
      r.posted > 0
        ? `3. Posted Platform Charges on Account (${f1(r.effectivePct)}% effective): ${f3(r.posted)} KWD`
        : `3. Unsettled Open Clearing Balance in Odoo 17: ${f3(r.clearing)} KWD`,
      `4. Total Variance Claimed for Credit / Immediate Payout: ${f3(variance)} KWD`,
      ``,
      `Required Action within 5 Business Days:`,
      `• Provide order-level breakdown of non-contractual deductions (CPC ads, logistics add-ons, disputed refunds).`,
      `• Issue formal Credit Note / bank remittance for ${f3(variance)} KWD in the upcoming payout cycle.`,
    ].join('\n')
  }

  const buildChannelClaimDossier = (c: (typeof CHANNEL_ECONOMICS)[number], actual?: number) => {
    const scaledSales = c.sales * selectedBrandScale
    const scaledExpected = c.expectedPayout * selectedBrandScale
    const scaledOrders = Math.max(1, Math.round(c.orders * selectedBrandScale))
    const scaledPromo = c.promo * selectedBrandScale
    const brandTagAr = selectedBrandId === 'all' ? 'جميع علامات فنتشر فودز المعتمدة' : BRANDS.find((b) => b.id === selectedBrandId)?.ar ?? ''
    const brandTagEn = selectedBrandId === 'all' ? 'All Approved Venture Foods Brands' : BRANDS.find((b) => b.id === selectedBrandId)?.en ?? ''
    const gap = actual !== undefined && Number.isFinite(actual) ? scaledExpected - actual : scaledPromo * 0.35

    if (isAr) {
      return [
        `📋 مذكرة مطالبة تسوية ومراجعة عروض — شركة فنتشر فودز لإدارة المطاعم ذ.م.م (ترخيص ${LEDGER.licence})`,
        `إلى: مدير حساب ${c.ar} | النطاق: ${brandTagAr}`,
        `الفترة: ${LEDGER.periodLabelAr}`,
        ``,
        `• المدفوعات المسجلة في نقاط بيع أودو 17: ${f3(scaledSales)} د.ك (${f0(scaledOrders)} طلب)`,
        `• الصافي التعاقدي المتوقع بعد عمولة ${c.commissionPct}%: ${f3(scaledExpected)} د.ك`,
        actual !== undefined && Number.isFinite(actual)
          ? `• المبلغ الوارد في كشف البنك/المنصة: ${f3(actual)} د.ك — فرق التسوية المطالب به: ${f3(gap)} د.ك`
          : `• استنزاف الخصومات المشتركة المرصود: ${f3(scaledPromo)} د.ك (${f1(c.promoPct)}%) — يطالب بسقف مساهمة 50% واسترداد ${f3(gap)} د.ك من الحسميات غير المعتمدة.`,
        ``,
        `يرجى اعتماد المطابقة وإيداع الفرق (${f3(gap)} د.ك) خلال 7 أيام عمل.`,
      ].join('\n')
    }
    return [
      `📋 FORMAL SETTLEMENT & CAMPAIGN CLAIM MEMO — Venture Foods Restaurants Management Co. W.L.L. (Licence ${LEDGER.licence})`,
      `To: ${c.en} Account Manager | Scope: ${brandTagEn}`,
      `Period: ${LEDGER.periodLabelEn}`,
      ``,
      `• Verified Odoo 17 POS Takings: ${f3(scaledSales)} KWD (${f0(scaledOrders)} orders)`,
      `• Expected Net Payout after ${c.commissionPct}% contract rate: ${f3(scaledExpected)} KWD`,
      actual !== undefined && Number.isFinite(actual)
        ? `• Statement Remittance Received: ${f3(actual)} KWD — Disputed Variance Claimed: ${f3(gap)} KWD`
        : `• Audited Co-Funded Promo Burn: ${f3(scaledPromo)} KWD (${f1(c.promoPct)}%) — Requesting immediate 50% co-fund cap & ${f3(gap)} KWD credit adjustment on unapproved promo deductions.`,
      ``,
      `Please confirm reconciliation and credit ${f3(gap)} KWD within 7 business days.`,
    ].join('\n')
  }

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard?.writeText(text)
    } catch {
      // ignore
    }
    setCopied(id)
    window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800)
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full space-y-6">
      {/* Studio Header */}
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0F172A] text-white shadow-sm dark:bg-white dark:text-slate-950">
            <Radar className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight text-slate-950 sm:text-[25px] dark:text-white">
              {T('Delivery & Aggregator Radar', 'رادار منصات التوصيل')}
            </h1>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
              {T(
                `Contract vs. posted commissions, Campaign Net-ROI Autopsy, Tgo/TMP zone accounts & 1-click claim dossiers · ${LEDGER.periodLabelEn}`,
                `العمولات التعاقدية مقابل المرحّلة، تشريح ربحية العروض، حسابات المناطق Tgo/TMP ومطالبات التسوية الفورية · ${LEDGER.periodLabelAr}`,
              )}
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label={T('Radar view', 'عرض الرادار')}
          className="grid w-full grid-cols-1 gap-1 rounded-2xl bg-slate-200/75 p-1 sm:grid-cols-3 xl:w-auto xl:rounded-full dark:bg-white/[0.07]"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`truncate rounded-full px-4 py-2 text-[12.5px] font-semibold transition-all ${
                tab === t.id
                  ? 'bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_12px_rgba(15,23,42,0.06)] dark:bg-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              {isAr ? t.ar : t.en}
            </button>
          ))}
        </div>
      </header>

      {/* ─────────────── TAB 1: Commissions, Campaign Net-ROI Autopsy & Formal Claim Dossiers ─────────────── */}
      {tab === 'commissions' && (
        <div className="space-y-6">
          {/* Posted Commission vs Contract Audit */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
                {T('Posted Odoo 17 Commission vs. Contractual Rate (Rolling 30 Days)', 'العمولة المرحّلة في أودو 17 مقابل النسبة التعاقدية (آخر 30 يوماً)')}
              </h2>
              <span className="text-[12px] font-medium text-slate-400">
                {T('Click any platform to generate a formal dispute claim dossier', 'اضغط على أي منصة لتوليد ملف مطالبة رسمية جاهز للإرسال')}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              {commissionAudit.map((r) => {
                const over = r.posted > 0 && r.effectivePct > r.contractPct + 3
                const pLabel = isAr ? PLATFORM_AR[r.platform] ?? r.platform : r.platform
                return (
                  <article key={r.platform} className={`${card} ${over ? 'ae-glow-rose' : 'ae-glow-emerald'} flex flex-col justify-between gap-3`}>
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[15px] font-bold text-slate-950 dark:text-white">{pLabel}</h3>
                        {over ? (
                          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10.5px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                            {T('Overcharge Gap', 'استقطاع زائد')}
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {T('Within Tier', 'ضمن التعاقد')}
                          </span>
                        )}
                      </div>
                      <div dir="ltr" className={`mt-2.5 text-[25px] font-extrabold tabular-nums ${over ? 'text-rose-600' : 'text-slate-950 dark:text-white'}`}>
                        {r.posted > 0 ? `${f1(r.effectivePct)}%` : `${f1(r.contractPct)}%`}
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {r.posted > 0
                          ? T(
                              `${kwd(r.posted)} posted on ${kwd(r.sales)} takings · contract ${f1(r.contractPct)}%`,
                              `${kwd(r.posted)} مرحّلة على ${kwd(r.sales)} متحصلات · التعاقدي ${f1(r.contractPct)}%`,
                            )
                          : T(
                              `${kwd(r.sales)} POS takings · ${kwd(r.clearing)} open in Odoo clearing`,
                              `${kwd(r.sales)} متحصلات نقاط بيع · ${kwd(r.clearing)} مفتوح بالتسوية`,
                            )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveClaimModal({
                          title: isAr ? `ملف مطالبة رسمية — ${pLabel}` : `Formal Dispute Dossier — ${r.platform}`,
                          body: buildPlatformClaimDossier(r),
                        })
                      }
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#F6F7F9] px-3 py-1.5 text-[11.5px] font-bold text-slate-800 transition hover:bg-slate-200/80 dark:bg-white/[0.07] dark:text-slate-100"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {T('Generate Claim Dossier', 'توليد مطالبة رسمية جاهزة للإرسال')}
                    </button>
                  </article>
                )
              })}
            </div>
          </section>

          {/* Channel Economics + Campaign Net-ROI Autopsy Badges */}
          <section className="space-y-3">
            <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
              {T('Channel Net Payout & Campaign Net-ROI Autopsy', 'صافي عائد القنوات وحكم ربحية العروض والحملات')}
            </h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {CHANNEL_ECONOMICS.map((c) => {
                const pocketMarginPct = c.sales > 0 ? ((c.orders * c.pocketPerOrder) / c.sales) * 100 : 0
                // Campaign Net-ROI Autopsy Classification
                const roiVerdict: 'profit' | 'eroding' | 'negative' =
                  pocketMarginPct < 24 || c.promoPct > PROMO_CAP * 2.4
                    ? 'negative'
                    : c.promoPct > PROMO_CAP || pocketMarginPct < 36
                      ? 'eroding'
                      : 'profit'

                const badge =
                  roiVerdict === 'profit'
                    ? {
                        cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
                        icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />,
                        label: T('Net Cash Positive', 'رابح صافياً'),
                      }
                    : roiVerdict === 'eroding'
                      ? {
                          cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
                          icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
                          label: T('Margin Eroding (Cap Promos)', 'يستنزف الهامش'),
                        }
                      : {
                          cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
                          icon: <ShieldAlert className="h-3.5 w-3.5 shrink-0" />,
                          label: T('Cash Negative After Comm. & Dish Cost', 'خاسر نقداً بعد العمولة وتكلفة الطبق'),
                        }

                return (
                  <article key={c.id} className={`${card} flex flex-col gap-4`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-[15.5px] font-bold text-slate-950 dark:text-white">{isAr ? c.ar : c.en}</h3>
                        <span className="text-[11.5px] font-medium text-slate-400">
                          {c.riderCostPerOrder > 0 ? T('Own Restaurant Fleet (TMP)', 'أسطول المطعم (TMP)') : T('Platform Logistics Fleet', 'أسطول المنصة')}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.cls}`}>
                        {badge.icon}
                        {badge.label}
                      </span>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-[#F6F7F9] p-3.5 text-[12.5px] dark:bg-white/[0.04]">
                      <div>
                        <dt className="text-slate-500">{T('Odoo POS Sales', 'مدفوعات أودو')}</dt>
                        <dd dir="ltr" className="mt-0.5 font-extrabold tabular-nums text-slate-950 dark:text-white">{kwd(c.sales)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{T('Orders', 'عدد الطلبات')}</dt>
                        <dd dir="ltr" className="mt-0.5 font-extrabold tabular-nums text-slate-950 dark:text-white">{f0(c.orders)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{T('Contract Commission', 'العمولة التعاقدية')}</dt>
                        <dd dir="ltr" className="mt-0.5 font-bold tabular-nums text-slate-900 dark:text-white">
                          {c.commissionPct}% · {kwd(c.commissionKwd)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{T('Expected Bank Payout', 'الصافي المتوقع بالبنك')}</dt>
                        <dd dir="ltr" className="mt-0.5 font-bold tabular-nums text-slate-900 dark:text-white">{kwd(c.expectedPayout)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{T('Campaign Promo Burn', 'استنزاف خصومات العروض')}</dt>
                        <dd dir="ltr" className={`mt-0.5 font-extrabold tabular-nums ${c.promoPct > PROMO_CAP ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                          {f1(c.promoPct)}% · {kwd(c.promo)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{T('Net Pocket / Order', 'صافي الجيب للطلب')}</dt>
                        <dd dir="ltr" className="mt-0.5 font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                          {kwd(c.pocketPerOrder, 3)} ({f1(pocketMarginPct)}%)
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-auto flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveClaimModal({
                            title: isAr ? `مطالبة رسمية — ${c.ar}` : `Formal Claim Dossier — ${c.en}`,
                            body: buildChannelClaimDossier(c),
                          })
                        }
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#0F172A] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {T('1-Click Formal Claim Dossier', 'توليد مطالبة رسمية جاهزة للإرسال')}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {/* ─────────────── TAB 2: Fast Searchable Tgo / TMP Zone Coverage Radar ─────────────── */}
      {tab === 'zones' && (
        <section className="space-y-4">
          <div className={`${card} flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={zoneQuery}
                onChange={(e) => setZoneQuery(e.target.value)}
                placeholder={T(
                  'Search branch (Salmiya, Avenues…), residential area, brand or platform…',
                  'ابحث سريعاً باسم الفرع (السالمية، الأفنيوز…) أو المنطقة السكنية أو العلامة أو المنصة…',
                )}
                className="w-full rounded-full bg-[#F6F7F9] py-2.5 pe-4 ps-10 text-[13px] font-medium text-slate-900 outline-none ring-1 ring-slate-900/[0.05] focus:ring-slate-900/20 dark:bg-white/[0.06] dark:text-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', en: `All (${allZoneAccounts.length})`, ar: `الكل (${allZoneAccounts.length})` },
                  { id: 'Tgo', en: 'Tgo Platform Fleet (17%)', ar: 'حسابات Tgo أسطول المنصة (17%)' },
                  { id: 'M', en: 'TMP Own Fleet (10%)', ar: 'حسابات TMP أسطول المطعم (10%)' },
                  { id: 'alert', en: 'Active Zone Alerts', ar: 'تنبيهات التحول القسري والنطاق' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModeFilter(m.id)}
                  className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                    modeFilter === m.id
                      ? 'bg-[#0F172A] text-white dark:bg-white dark:text-slate-950'
                      : 'bg-[#F6F7F9] text-slate-600 hover:bg-slate-200/70 dark:bg-white/[0.06] dark:text-slate-300'
                  }`}
                >
                  {isAr ? m.ar : m.en}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredZones.slice(0, 24).map((acc) => {
              const st = statusMeta(acc.status, isAr)
              const areas = isAr ? acc.coveredAreasAr : acc.coveredAreasEn
              return (
                <article key={acc.accountId} className={`${card} flex flex-col gap-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-[#0F172A] px-2.5 py-0.5 text-[10.5px] font-bold text-white dark:bg-white dark:text-slate-950">
                          {acc.deliveryMode === 'Tgo' ? `Tgo · ${acc.commissionPct}%` : `TMP · ${acc.commissionPct}%`}
                        </span>
                        <span className="rounded-full bg-[#F6F7F9] px-2.5 py-0.5 text-[10.5px] font-bold text-slate-700 dark:bg-white/[0.08] dark:text-slate-200">
                          {isAr ? PLATFORM_AR[acc.platform] ?? acc.platform : acc.platform}
                        </span>
                      </div>
                      <h3 className="mt-1.5 truncate text-[14.5px] font-bold text-slate-950 dark:text-white">
                        {isAr ? `${acc.brandNameAr} — ${acc.branchNameAr}` : `${acc.brandNameEn} — ${acc.branchNameEn}`}
                      </h3>
                      <p className="text-[11.5px] font-medium text-slate-500">{isAr ? acc.sectorNameAr : acc.sectorNameEn}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${st.cls}`}>{st.label}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {areas.slice(0, 6).map((area) => (
                      <span key={area} className="rounded-full bg-[#F6F7F9] px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
                        {area}
                      </span>
                    ))}
                    {areas.length > 6 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-500 dark:bg-white/[0.06]">
                        +{areas.length - 6}
                      </span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
          {filteredZones.length > 24 && (
            <p className="text-center text-[12px] font-medium text-slate-400">
              {T(
                `Showing top 24 of ${filteredZones.length} matching zone accounts — type a branch or area name above to narrow instantly.`,
                `يُعرض أول 24 من أصل ${filteredZones.length} حساب منطقة مطابق — اكتب اسم الفرع أو المنطقة السكنية أعلاه للفرز الفوري.`,
              )}
            </p>
          )}
        </section>
      )}

      {/* ─────────────── TAB 3: Whitelisted Brand × Platform Settlement Matrix ─────────────── */}
      {tab === 'matrix' && (
        <div className="space-y-6">
          {/* Open Odoo Clearing Balances */}
          <section className="space-y-3">
            <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">
              {T('Platform Takings Awaiting Bank Settlement in Odoo 17', 'متحصلات المنصات المعلّقة بانتظار المطابقة البنكية في أودو 17')}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              {J.delivery.platforms
                .filter((p) => p.booked30Kwd > 0 || p.clearingKwd > 0)
                .map((p) => {
                  const stuck = p.clearingKwd > 1000 && p.settled30Kwd < p.booked30Kwd * 0.2
                  return (
                    <article key={p.platform} className={`${card} ${stuck ? 'ae-glow-amber' : ''}`}>
                      <h3 className="text-[14.5px] font-bold text-slate-900 dark:text-white">
                        {isAr ? PLATFORM_AR[p.platform] ?? p.platform : p.platform}
                      </h3>
                      <div dir="ltr" className={`mt-2 text-[22px] font-extrabold tabular-nums ${stuck ? 'text-rose-600' : 'text-slate-950 dark:text-white'}`}>
                        {kwd(p.clearingKwd)}
                      </div>
                      <p className="mt-1 text-[12px] text-slate-500">
                        {T(
                          `Booked 30d: ${kwd(p.booked30Kwd)} · Settled: ${kwd(p.settled30Kwd)}`,
                          `مسجل 30 يوماً: ${kwd(p.booked30Kwd)} · مسوّى: ${kwd(p.settled30Kwd)}`,
                        )}
                      </p>
                    </article>
                  )
                })}
            </div>
          </section>

          {/* Filterable Settlement Matrix */}
          <section className={`${card} space-y-4`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-slate-500" />
                <div>
                  <h2 className="text-[15.5px] font-bold text-slate-950 dark:text-white">
                    {T('Bank Reconciliation & Automated Dispute Matrix', 'مصفوفة المطابقة البنكية وتوليد المطالبات الرسمية')}
                  </h2>
                  <p className="text-[12px] text-slate-500">
                    {T(
                      'Filter by whitelisted Venture Foods brand or enter statement remittance to auto-generate a claim memo when gap > 1%.',
                      'افرز حسب علامات فنتشر فودز المعتمدة أو أدخل مبلغ كشف التحويل لتوليد مطالبة رسمية تلقائياً عند تجاوز الفرق 1%.',
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedBrandId('all')}
                  className={`rounded-full px-3 py-1 text-[11.5px] font-semibold ${
                    selectedBrandId === 'all'
                      ? 'bg-[#0F172A] text-white dark:bg-white dark:text-slate-950'
                      : 'bg-[#F6F7F9] text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'
                  }`}
                >
                  {T('All 7 Brands', 'كل العلامات الـ 7')}
                </button>
                {BRANDS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBrandId(b.id)}
                    className={`rounded-full px-3 py-1 text-[11.5px] font-semibold ${
                      selectedBrandId === b.id
                        ? 'bg-[#0F172A] text-white dark:bg-white dark:text-slate-950'
                        : 'bg-[#F6F7F9] text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'
                    }`}
                  >
                    {isAr ? b.ar : b.en}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[780px] text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 dark:border-white/[0.06]">
                    <th className="px-3 py-2.5 text-start font-semibold">{T('Channel', 'القناة')}</th>
                    <th className="px-3 py-2.5 text-end font-semibold">{T('POS Sales', 'مبيعات نقاط البيع')}</th>
                    <th className="px-3 py-2.5 text-end font-semibold">{T('Expected Net Payout', 'التسوية المتوقعة')}</th>
                    <th className="px-3 py-2.5 text-end font-semibold">{T('Bank Statement Received', 'المبلغ المحوّل فعلياً')}</th>
                    <th className="px-3 py-2.5 text-end font-semibold">{T('Variance Gap', 'فرق التسوية')}</th>
                    <th className="px-3 py-2.5 text-end font-semibold">{T('Formal Claim', 'ملف المطالبة')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {CHANNEL_ECONOMICS.map((c) => {
                    const expected = c.expectedPayout * selectedBrandScale
                    const sales = c.sales * selectedBrandScale
                    const key = `${selectedBrandId}-${c.id}`
                    const raw = statement[key]
                    const actual = raw ? Number(raw) : NaN
                    const gap = Number.isFinite(actual) ? expected - actual : 0
                    const claimable = Number.isFinite(actual) && gap > expected * 0.01
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-900 dark:text-white">{isAr ? c.ar : c.en}</td>
                        <td dir="ltr" className="whitespace-nowrap px-3 py-3 text-end tabular-nums text-slate-600 dark:text-slate-300">
                          {kwd(sales, 3)}
                        </td>
                        <td dir="ltr" className="whitespace-nowrap px-3 py-3 text-end font-bold tabular-nums text-slate-950 dark:text-white">
                          {kwd(expected, 3)}
                        </td>
                        <td className="px-3 py-3 text-end">
                          <input
                            inputMode="decimal"
                            value={raw ?? ''}
                            onChange={(e) => setStatement((s) => ({ ...s, [key]: e.target.value.replace(/[^0-9.]/g, '') }))}
                            placeholder={f3(expected * 0.96)}
                            className="w-32 rounded-xl bg-[#F6F7F9] px-3 py-1.5 text-end font-bold tabular-nums text-slate-900 outline-none ring-1 ring-slate-900/[0.06] focus:ring-2 focus:ring-slate-900/20 dark:bg-white/[0.06] dark:text-white"
                          />
                        </td>
                        <td
                          dir="ltr"
                          className={`whitespace-nowrap px-3 py-3 text-end font-extrabold tabular-nums ${
                            claimable ? 'text-rose-600' : 'text-slate-400'
                          }`}
                        >
                          {Number.isFinite(actual) ? kwd(gap, 3) : '—'}
                        </td>
                        <td className="px-3 py-3 text-end">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveClaimModal({
                                title: isAr ? `مطالبة تسوية — ${c.ar}` : `Settlement Claim — ${c.en}`,
                                body: buildChannelClaimDossier(c, Number.isFinite(actual) ? actual : undefined),
                              })
                            }
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11.5px] font-bold transition ${
                              claimable
                                ? 'bg-rose-600 text-white hover:bg-rose-700'
                                : 'bg-[#0F172A] text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950'
                            }`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {claimable ? T('Claim Variance Now', 'مطالبة بالفرق الآن') : T('Open Claim Memo', 'فتح مذكرة المطالبة')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* 1-Click Formal Claim Dossier Modal */}
      {activeClaimModal && (
        <div
          className="ae-palette-backdrop fixed inset-0 z-[95] flex items-center justify-center p-4"
          role="dialog"
          aria-modal
          onClick={() => setActiveClaimModal(null)}
        >
          <div
            className="ae-pop w-full max-w-2xl overflow-hidden rounded-[24px] bg-slate-950 p-6 text-slate-100 shadow-2xl ring-1 ring-white/10"
            dir={isAr ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  {T('Loop AI Automated Dispute Dossier', 'ملف مطالبة رسمية موثق من أودو 17')}
                </span>
                <h3 className="mt-0.5 text-[17px] font-bold text-white">{activeClaimModal.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveClaimModal(null)}
                className="rounded-full bg-white/10 p-1.5 text-slate-300 hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <pre className="mt-4 max-h-[52vh] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-white/[0.06] p-4 font-sans text-[12.5px] leading-relaxed text-slate-100">
              {activeClaimModal.body}
            </pre>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => void copy('modal-claim', activeClaimModal.body)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-white/25"
              >
                {copied === 'modal-claim' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {copied === 'modal-claim' ? T('Copied to clipboard', 'تم النسخ للحافظة') : T('Copy Formal Claim', 'نسخ المطالبة الرسمية')}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(activeClaimModal.body)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-emerald-500"
              >
                <MessageCircle className="h-4 w-4" />
                {T('Send to Account Manager (WhatsApp)', 'إرسال لمدير المنصة عبر واتساب')}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
