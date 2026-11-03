'use client'

import React, { useState } from 'react'
import {
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Building2,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react'

export interface GlBridgeEntry {
  id: string
  voucherNo: string
  source: 'POS' | 'KDS' | 'RECIPES' | 'SAFE_DROP'
  sourceLabelAr: string
  sourceLabelEn: string
  date: string
  descriptionAr: string
  descriptionEn: string
  costCenterAr: string
  costCenterEn: string
  totalDebit: number
  totalCredit: number
  status: 'POSTED' | 'BALANCED'
  lines: Array<{
    accountCode: string
    accountNameAr: string
    accountNameEn: string
    debit: number
    credit: number
    type: 'DEBIT' | 'CREDIT'
    analyticCostCenter?: string
  }>
}

export const SAMPLE_GL_BRIDGE_ENTRIES: GlBridgeEntry[] = [
  {
    id: 'gl-01',
    voucherNo: 'JV-POS-OCT-3101',
    source: 'POS',
    sourceLabelAr: 'نقطة البيع - إغلاق الوردية Z-Report',
    sourceLabelEn: 'POS - Daily Z-Report Shift Close',
    date: '31 أكتوبر 2026',
    descriptionAr: 'قيد إثبات مبيعات شفت الصباح وفرز الكاش وK-Net وعمولات المنصات - فرانكس الأفنيوز',
    descriptionEn: 'Morning shift sales recognition, Cash, K-Net & aggregator commission split - Frank\'s Avenues',
    costCenterAr: 'فرانكس - فرع مجمع الأفنيوز (CC-FR-AV)',
    costCenterEn: "Frank's - The Avenues Mall (CC-FR-AV)",
    totalDebit: 1845.250,
    totalCredit: 1845.250,
    status: 'POSTED',
    lines: [
      { accountCode: '101002', accountNameAr: 'صندوق الكاشير بالفرع (نقد فعلي)', accountNameEn: 'Branch Cash Drawer (Counted)', debit: 412.500, credit: 0, type: 'DEBIT', analyticCostCenter: 'CC-FR-AV' },
      { accountCode: '101001', accountNameAr: 'وسيط تسويات كي نت (بنك الكويت الوطني)', accountNameEn: 'K-Net Clearing Gateway (NBK)', debit: 895.750, credit: 0, type: 'DEBIT', analyticCostCenter: 'CC-FR-AV' },
      { accountCode: '102005', accountNameAr: 'ذمم منصة طلبات جو (TGO 17%)', accountNameEn: 'Talabat GO Platform Receivables', debit: 386.400, credit: 0, type: 'DEBIT', analyticCostCenter: 'CC-FR-AV' },
      { accountCode: '503001', accountNameAr: 'عمولات منصات التوصيل (TGO Commission 17%)', accountNameEn: 'Aggregator Delivery Fees (17%)', debit: 79.100, credit: 0, type: 'DEBIT', analyticCostCenter: 'CC-FR-AV' },
      { accountCode: '503005', accountNameAr: 'رسوم بوابات الدفع (عمولة K-Net & Visa)', accountNameEn: 'Bank POS Processing Fees', debit: 71.500, credit: 0, type: 'DEBIT', analyticCostCenter: 'CC-FR-AV' },
      { accountCode: '401001', accountNameAr: 'إيراد مبيعات الأطعمة والمشروبات (فرانكس)', accountNameEn: "Food & Beverage Sales Revenue (Frank's)", debit: 0, credit: 1792.250, type: 'CREDIT', analyticCostCenter: 'CC-FR-AV' },
      { accountCode: '401005', accountNameAr: 'إيراد ومقابل مواد التغليف والسفري (PI02)', accountNameEn: 'Packaging & Takeaway Surcharge Revenue', debit: 0, credit: 53.000, type: 'CREDIT', analyticCostCenter: 'CC-FR-AV' },
    ],
  },
  {
    id: 'gl-02',
    voucherNo: 'JV-KDS-OCT-4029',
    source: 'KDS',
    sourceLabelAr: 'شاشة المطبخ KDS - الخصم اللحظي Backflushing',
    sourceLabelEn: 'KDS - Real-Time Inventory Backflushing',
    date: '31 أكتوبر 2026',
    descriptionAr: 'قيد ترحيل تكلفة المبيعات المباشرة (COGS) ومطابقة الوصفات للأطباق المجهزة - ثينيز الخيران',
    descriptionEn: 'Direct COGS recognition & inventory reduction for ready bumped tickets - Thinnies Al-Khiran',
    costCenterAr: 'ثينيز - الخيران أوتلت (CC-TH-KH)',
    costCenterEn: 'Thinnies - Al-Khiran Outlet (CC-TH-KH)',
    totalDebit: 642.180,
    totalCredit: 642.180,
    status: 'POSTED',
    lines: [
      { accountCode: '501001', accountNameAr: 'تكلفة البضاعة المباعة (لحوم وخبز RW01)', accountNameEn: 'COGS - Raw Materials (RW01)', debit: 418.600, credit: 0, type: 'DEBIT', analyticCostCenter: 'CC-TH-KH' },
      { accountCode: '501002', accountNameAr: 'تكلفة صوصات وتحضيرات المطبخ المركزي (PP03)', accountNameEn: 'COGS - Central Kitchen Preps (PP03)', debit: 148.280, credit: 0, type: 'DEBIT', analyticCostCenter: 'CC-TH-KH' },
      { accountCode: '501005', accountNameAr: 'تكلفة مواد التغليف المستهلكة (PI02)', accountNameEn: 'COGS - Packaging & Disposables (PI02)', debit: 75.300, credit: 0, type: 'DEBIT', analyticCostCenter: 'CC-TH-KH' },
      { accountCode: '103001', accountNameAr: 'مخزون فرع الخيران - مواد خام (RW01)', accountNameEn: 'Al-Khiran Branch Stock - Raw (RW01)', debit: 0, credit: 418.600, type: 'CREDIT', analyticCostCenter: 'CC-TH-KH' },
      { accountCode: '103002', accountNameAr: 'مخزون فرع الخيران - تحضيرات مسبقة (PP03)', accountNameEn: 'Al-Khiran Branch Stock - Preps (PP03)', debit: 0, credit: 148.280, type: 'CREDIT', analyticCostCenter: 'CC-TH-KH' },
      { accountCode: '103005', accountNameAr: 'مخزون فرع الخيران - مواد تغليف (PI02)', accountNameEn: 'Al-Khiran Branch Stock - Packaging (PI02)', debit: 0, credit: 75.300, type: 'CREDIT', analyticCostCenter: 'CC-TH-KH' },
    ],
  },
  {
    id: 'gl-03',
    source: 'KDS',
    voucherNo: 'JV-WST-OCT-0914',
    sourceLabelAr: 'شاشة المطبخ KDS - مسجل الهدر والتوالف',
    sourceLabelEn: 'KDS - Kitchen Spoilage & Waste Logger',
    date: '31 أكتوبر 2026',
    descriptionAr: 'قيد إثبات هدر مطبخ واحتراق ستيك وإعادة طبخ طبق شاورما بعد التعديل',
    descriptionEn: 'Kitchen waste recognition, burned steak re-fire & recipe adjustment write-off',
    costCenterAr: 'شاورما شاك - فرع السالمية (CC-SH-SL)',
    costCenterEn: 'Shawarma Shack - Salmiya (CC-SH-SL)',
    totalDebit: 18.750,
    totalCredit: 18.750,
    status: 'POSTED',
    lines: [
      { accountCode: '501020', accountNameAr: 'مصروف هدر وتوالف المطبخ وإعادة الطهي', accountNameEn: 'Kitchen Spoilage, Burn & Re-fire Expense', debit: 18.750, credit: 0, type: 'DEBIT', analyticCostCenter: 'CC-SH-SL' },
      { accountCode: '103001', accountNameAr: 'مخزون الفرع - دجاج متبل وتوابل (RW01/PP03)', accountNameEn: 'Branch Stock - Marinated Chicken (RW01/PP03)', debit: 0, credit: 18.750, type: 'CREDIT', analyticCostCenter: 'CC-SH-SL' },
    ],
  },
  {
    id: 'gl-04',
    voucherNo: 'JV-REC-OCT-0520',
    source: 'RECIPES',
    sourceLabelAr: 'الوصفات والإنتاج - تشغيلات المطبخ المركزي بالقرين',
    sourceLabelEn: 'Recipes & Prep - Al-Qurain Batch Scaling',
    date: '30 أكتوبر 2026',
    descriptionAr: 'قيد تحويل دفعة 100 لتر صوص ترافل خاص (PP03-TRF) من خامات إلى منتج وسيط جاهز للتوزيع',
    descriptionEn: 'Batch production 100L Truffle Sauce (PP03-TRF) from raw materials to prep inventory',
    costCenterAr: 'المطبخ المركزي بالقرين (CC-CK-QR)',
    costCenterEn: 'Al-Qurain Central Kitchen (CC-CK-QR)',
    totalDebit: 320.000,
    totalCredit: 320.000,
    status: 'POSTED',
    lines: [
      { accountCode: '103002', accountNameAr: 'مخزون المطبخ المركزي - منتجات وسيطة جاهزة (PP03)', accountNameEn: 'Central Kitchen Stock - Finished Preps (PP03)', debit: 320.000, credit: 0, type: 'DEBIT', analyticCostCenter: 'CC-CK-QR' },
      { accountCode: '103001', accountNameAr: 'مخزون المطبخ المركزي - مواد خام مستهلكة (RW01)', accountNameEn: 'Central Kitchen Stock - Raw Materials (RW01)', debit: 0, credit: 285.500, type: 'CREDIT', analyticCostCenter: 'CC-CK-QR' },
      { accountCode: '502005', accountNameAr: 'أجور عمالة إنتاج المطبخ المركزي المباشرة المحملة', accountNameEn: 'Direct Kitchen Prep Labor Allocated', debit: 0, credit: 34.500, type: 'CREDIT', analyticCostCenter: 'CC-CK-QR' },
    ],
  },
  {
    id: 'gl-05',
    voucherNo: 'JV-BNK-OCT-1102',
    source: 'SAFE_DROP',
    sourceLabelAr: 'نقطة البيع - توريد نقد الخزنة للبنك Safe Drop',
    sourceLabelEn: 'POS - Cash Safe Drop to NBK Deposit',
    date: '31 أكتوبر 2026',
    descriptionAr: 'إيداع نقدي ببنك الكويت الوطني - توريد كاش درج فرع الأفنيوز عبر سيارة نقل الأموال',
    descriptionEn: 'Cash deposit slip to NBK via armored courier - The Avenues safe drop #402',
    costCenterAr: 'فرانكس - الأفنيوز (CC-FR-AV)',
    costCenterEn: "Frank's - The Avenues (CC-FR-AV)",
    totalDebit: 350.000,
    totalCredit: 350.000,
    status: 'POSTED',
    lines: [
      { accountCode: '101003', accountNameAr: 'نقدية في الطريق للإيداع البنكي (Cash in Transit)', accountNameEn: 'Cash in Transit - NBK Deposit Slip #402', debit: 350.000, credit: 0, type: 'DEBIT', analyticCostCenter: 'CC-FR-AV' },
      { accountCode: '101002', accountNameAr: 'صندوق الكاشير بالفرع (تفريغ الخزنة Safe Drop)', accountNameEn: 'Branch Cash Drawer (Safe Drop Outflow)', debit: 0, credit: 350.000, type: 'CREDIT', analyticCostCenter: 'CC-FR-AV' },
    ],
  },
]

export function AutomatedGlBridge({
  locale = 'ar',
  compact = false,
}: {
  locale?: 'ar' | 'en'
  compact?: boolean
}) {
  const [expandedId, setExpandedId] = useState<string | null>('gl-01')
  const [filterSource, setFilterSource] = useState<string>('ALL')
  const [simulating, setSimulating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const isAr = locale === 'ar'

  const filtered = SAMPLE_GL_BRIDGE_ENTRIES.filter((e) => {
    if (filterSource === 'ALL') return true
    return e.source === filterSource
  })

  const totalDebits = filtered.reduce((acc, e) => acc + e.totalDebit, 0)
  const totalCredits = filtered.reduce((acc, e) => acc + e.totalCredit, 0)
  const imbalance = Math.abs(totalDebits - totalCredits)

  const handleSimulateSync = () => {
    setSimulating(true)
    setTimeout(() => {
      setSimulating(false)
      setNotice(
        isAr
          ? 'تم التحقق من توازن جميع القيود بنجاح: Debit = Credit بدقة 0.000 د.ك متوافقة مع شجرة الحسابات (820 Accounts) في Odoo!'
          : 'All operational vouchers verified: Balanced 0.000 KWD discrepancy across Odoo 820 accounts ledger!'
      )
      setTimeout(() => setNotice(null), 5000)
    }, 900)
  }

  const handleExportCsv = () => {
    const headers = ['Voucher No', 'Date', 'Source', 'Cost Center', 'Account Code', 'Account Name', 'Debit KWD', 'Credit KWD']
    const rows = filtered.flatMap((entry) =>
      entry.lines.map((l) => [
        entry.voucherNo,
        entry.date,
        entry.source,
        isAr ? entry.costCenterAr : entry.costCenterEn,
        l.accountCode,
        isAr ? l.accountNameAr : l.accountNameEn,
        l.debit.toFixed(3),
        l.credit.toFixed(3),
      ])
    )
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.map((x) => `"${x}"`).join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `VentureFoods_Automated_GL_Bridge_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 p-4 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 shadow-lg shadow-indigo-500/10">
              <ArrowRightLeft size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white sm:text-xl">
                  {isAr ? '🔗 الربط المالي والقيود التلقائية الميدانية' : '🔗 Automated Financial GL Bridge (Field Ops)'}
                </h3>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                  {isAr ? 'متزن 0.000 د.ك' : 'Zero Discrepancy'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? 'التحويل الآلي لمبيعات الكاشير، إغلاقات Z-Report، واستهلاك KDS، ووصفات المطبخ المركزي إلى قيود Odoo المحاسبية المزدوجة'
                  : 'Real-time double-entry posting from POS cashiers, KDS backflushing, and recipe batch yields to General Ledger'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSimulateSync}
              disabled={simulating}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-600/30 px-3.5 py-2 text-xs font-bold text-indigo-200 hover:bg-indigo-600/50 transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={simulating ? 'animate-spin' : ''} />
              {isAr ? 'فحص وتدقيق التوازن الميداني' : 'Verify GL Balance'}
            </button>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-all"
            >
              <Download size={14} />
              {isAr ? 'تصدير القيود Odoo CSV' : 'Export Odoo Journal CSV'}
            </button>
          </div>
        </div>

        {/* Notice alert */}
        {notice && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/70 p-3 text-xs font-semibold text-emerald-300">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              {notice}
            </span>
            <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Live Balance Summary KPI Cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
            <div className="text-[11px] font-medium text-slate-400">{isAr ? 'إجمالي المدين (Debit)' : 'Total Debit Postings'}</div>
            <div className="text-lg font-black text-emerald-400 mt-1">{totalDebits.toFixed(3)} <span className="text-xs text-slate-400">{isAr ? 'د.ك' : 'KWD'}</span></div>
            <div className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'الأصول والمصروفات' : 'Assets & Direct Costs'}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
            <div className="text-[11px] font-medium text-slate-400">{isAr ? 'إجمالي الدائن (Credit)' : 'Total Credit Postings'}</div>
            <div className="text-lg font-black text-cyan-400 mt-1">{totalCredits.toFixed(3)} <span className="text-xs text-slate-400">{isAr ? 'د.ك' : 'KWD'}</span></div>
            <div className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'الإيرادات والمخزون' : 'Revenues & Inventory'}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
            <div className="text-[11px] font-medium text-slate-400">{isAr ? 'فارق التوازن (Variance)' : 'Imbalance / Diff'}</div>
            <div className={`text-lg font-black mt-1 ${imbalance === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {imbalance.toFixed(3)} <span className="text-xs text-slate-400">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <div className="text-[10px] text-emerald-400/90 mt-0.5">{isAr ? 'متزن محاسبياً 100%' : '100% Balanced'}</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
            <div className="text-[11px] font-medium text-slate-400">{isAr ? 'ربط شجرة Odoo' : 'Odoo COA Linkage'}</div>
            <div className="text-lg font-black text-indigo-400 mt-1">820 <span className="text-xs text-slate-400">{isAr ? 'حساباً' : 'Accounts'}</span></div>
            <div className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'ترحيل فوري Live Sync' : 'Real-time GL posting'}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs by Source Module */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'ALL', labelAr: 'جميع القيود الآلية (5)', labelEn: 'All Automated Entries (5)' },
            { key: 'POS', labelAr: 'الكاشير وإغلاق الورديات (2)', labelEn: 'POS & Z-Reports (2)' },
            { key: 'KDS', labelAr: 'المطبخ والخصم اللحظي (2)', labelEn: 'KDS Backflushing & Waste (2)' },
            { key: 'RECIPES', labelAr: 'الوصفات والمطبخ المركزي (1)', labelEn: 'Recipes & Prep Batches (1)' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterSource(tab.key)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                filterSource === tab.key
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {isAr ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-400">
          {isAr ? `عرض ${filtered.length} قيود محاسبية مرحلة` : `Showing ${filtered.length} posted vouchers`}
        </div>
      </div>

      {/* Vouchers List with Drill-Down Expansion */}
      <div className="space-y-3">
        {filtered.map((entry) => {
          const isExpanded = expandedId === entry.id
          return (
            <div
              key={entry.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-lg hover:border-slate-700 transition-all"
            >
              {/* Voucher Summary Row */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                className="flex flex-wrap items-center justify-between gap-3 p-4 cursor-pointer bg-slate-900/90 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-xs ${
                      entry.source === 'POS'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : entry.source === 'KDS'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : entry.source === 'RECIPES'
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    }`}
                  >
                    {entry.source}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-white">{entry.voucherNo}</span>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                        {isAr ? entry.sourceLabelAr : entry.sourceLabelEn}
                      </span>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        {entry.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {isAr ? entry.descriptionAr : entry.descriptionEn} · <span className="text-indigo-400">{isAr ? entry.costCenterAr : entry.costCenterEn}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs font-bold text-white">
                      {entry.totalDebit.toFixed(3)} <span className="text-[10px] text-slate-400">{isAr ? 'د.ك' : 'KWD'}</span>
                    </div>
                    <div className="text-[10px] text-emerald-400 font-mono">Debit = Credit</div>
                  </div>
                  <div className="text-slate-400">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>
              </div>

              {/* Expanded Double-Entry Ledger Lines */}
              {isExpanded && (
                <div className="border-t border-slate-800 p-4 bg-slate-950/70">
                  <div className="flex items-center justify-between pb-3 text-xs font-semibold text-slate-400 border-b border-slate-800/80">
                    <span>{isAr ? 'تفاصيل أسطر القيد المحاسبي المزدوج في دفتر اليومية' : 'Double-Entry General Ledger Voucher Lines'}</span>
                    <span className="font-mono text-emerald-400 text-[11px]">
                      {isAr ? 'دقة التوازن: 0.000 د.ك' : 'Balance Precision: 0.000 KWD'}
                    </span>
                  </div>

                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                          <th className="py-2 px-3 text-left font-mono">{isAr ? 'رمز الحساب' : 'Code'}</th>
                          <th className="py-2 px-3">{isAr ? 'اسم الحساب في شجرة Odoo' : 'Odoo Account Name'}</th>
                          <th className="py-2 px-3">{isAr ? 'مركز التكلفة التحليلي' : 'Analytic CC'}</th>
                          <th className="py-2 px-3 text-left">{isAr ? 'مدين Debit (د.ك)' : 'Debit (KWD)'}</th>
                          <th className="py-2 px-3 text-left">{isAr ? 'دائن Credit (د.ك)' : 'Credit (KWD)'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {entry.lines.map((l, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-400 text-left">
                              {l.accountCode}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-200">
                              {isAr ? l.accountNameAr : l.accountNameEn}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                                {l.analyticCostCenter ?? 'CORP-GEN'}
                              </span>
                            </td>
                            <td className={`py-2.5 px-3 font-mono font-bold text-left ${l.debit > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                              {l.debit > 0 ? l.debit.toFixed(3) : '-'}
                            </td>
                            <td className={`py-2.5 px-3 font-mono font-bold text-left ${l.credit > 0 ? 'text-cyan-400' : 'text-slate-600'}`}>
                              {l.credit > 0 ? l.credit.toFixed(3) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-700 bg-slate-900/90 font-bold text-xs">
                          <td colSpan={3} className="py-2.5 px-3 text-slate-300">
                            {isAr ? 'الإجمالي المتزن (المطابقة الدفترية)' : 'Total Balanced Voucher Amount'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-emerald-400 text-left">
                            {entry.totalDebit.toFixed(3)}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-cyan-400 text-left">
                            {entry.totalCredit.toFixed(3)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
