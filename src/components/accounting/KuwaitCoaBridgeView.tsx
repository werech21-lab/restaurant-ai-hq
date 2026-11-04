'use client'

import React, { useState } from 'react'
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Truck,
  Users,
  UtensilsCrossed,
  Layers,
  Sparkles,
  ArrowRightLeft,
  Store,
  Clock,
  Download,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Filter,
} from 'lucide-react'
import {
  KUWAIT_DIMENSION_BRANDS,
  KUWAIT_DIMENSION_LOCATIONS,
  KUWAIT_DIMENSION_DEPARTMENTS,
  KUWAIT_DIMENSION_CHANNELS,
  KUWAIT_FNB_COA,
  AMC_CONTRACTS_REGISTRY,
  EXPIRY_RADAR_REGISTRY,
  HR_ACCOUNTING_7WAY_BRIDGE,
  generateFourWallPl,
  type CoaAccount,
  type AmcContractItem,
  type ExpiryRadarItem,
  type HrAccountingBridgeRow,
} from '@/lib/accounting/kuwait-coa-engine'

interface Props {
  isAr: boolean
  activeSubView: 'amcHub' | 'expiryRadar' | 'hrBridge' | 'transitRecon' | 'fourWallPnl' | 'coa4d'
  onSelectSubView?: (view: any) => void
}

export function KuwaitCoaBridgeView({ isAr, activeSubView }: Props) {
  // Filters for 4D COA
  const [selectedBrand, setSelectedBrand] = useState('ALL')
  const [selectedLoc, setSelectedLoc] = useState('ALL')
  const [selectedDept, setSelectedDept] = useState('ALL')
  const [selectedChannel, setSelectedChannel] = useState('ALL')
  const [accountCategoryFilter, setAccountCategoryFilter] = useState('ALL')
  const [coaSearch, setCoaSearch] = useState('')

  // Toast / notification state
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setActionNotice(msg)
    setTimeout(() => setActionNotice(null), 4000)
  }

  // Four-Wall P&L Calculations
  const pnl = generateFourWallPl(167092.160)

  // Filtered Accounts
  const filteredAccounts = KUWAIT_FNB_COA.filter((acc) => {
    const matchCat = accountCategoryFilter === 'ALL' || acc.category === accountCategoryFilter
    const matchSearch =
      !coaSearch.trim() ||
      acc.code.includes(coaSearch) ||
      acc.nameAr.includes(coaSearch) ||
      acc.nameEn.toLowerCase().includes(coaSearch.toLowerCase())
    return matchCat && matchSearch
  })

  // Export CSV for 4D Chart of Accounts
  const handleExportCoaCsv = () => {
    const headers = ['Account Code', 'Account Name (AR)', 'Account Name (EN)', 'Category', 'Normal Balance', 'Balance KWD']
    const rows = filteredAccounts.map((a) => [
      a.code,
      `"${a.nameAr}"`,
      `"${a.nameEn}"`,
      a.category,
      a.normalBalance,
      a.balanceKwd.toFixed(3),
    ])
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `VentureFoods_Kuwait_COA_1000-8300_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    showToast(isAr ? '✅ تم تصدير شجرة الحسابات القياسية بنجاح (إكسل) بدقة 3 خانات عشرية!' : '✅ Kuwait 4D Chart of Accounts exported successfully!')
  }

  return (
    <div className="w-full max-w-none space-y-6">
      {actionNotice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-3 text-xs font-bold text-emerald-300 shadow-lg flex items-center justify-between">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. FOUR-WALL STORE & MULTI-BRAND P&L (KUWAIT TARGET PERCENTAGES)          */}
      {/* ========================================================================= */}
      {activeSubView === 'fourWallPnl' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  {isAr ? 'قائمة الدخل المعيارية لمطاعم الكويت' : 'Kuwait Multi-Brand & Four-Wall Store P&L'}
                </span>
                <h2 className="text-xl font-black text-white mt-1">
                  {isAr ? 'نموذج قائمة الدخل التشغيلي للفرع والبراند (تحليل أرباح الجدران الأربعة)' : 'Store Four-Wall EBITDA & Controllable Margin Statement'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAr
                    ? 'تسلسل الدخل المعياري لشركة فنتشر فودز: مجمل الربح 65%-73% · التكلفة الأولية المعيارية (الأغذية والأجور 45%-55%) · صافي تشغيلي الفرع 10%-20%'
                    : 'Kuwait F&B benchmark: Gross Margin 65%-73% · Prime Cost 45%-55% · Controllable Profit 20%-35% · Store EBITDA 10%-20%'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-400">
                  {isAr ? 'صافي المبيعات: 167,092.160 د.ك (100%)' : 'Net Sales: 167,092.160 KWD (100%)'}
                </span>
              </div>
            </div>

            {/* P&L Visual Stepper Flow */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-800 bg-[#0d121d] p-3.5">
                <span className="text-[11px] font-bold text-slate-400">{isAr ? '1. إجمالي المبيعات والخصومات' : '1. Gross Sales & Net'}</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-lg font-black text-white">{pnl.netSales.toLocaleString(undefined, { minimumFractionDigits: 3 })} د.ك</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">100.0%</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {isAr ? `إجمالي المبيعات: ${pnl.grossSales.toFixed(3)} د.ك | الخصومات: -${pnl.discounts.toFixed(3)} د.ك (4.2%)` : `Gross: ${pnl.grossSales.toFixed(3)} KWD | Promo: -${pnl.discounts.toFixed(3)} KWD (4.2%)`}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#0d121d] p-3.5">
                <span className="text-[11px] font-bold text-slate-400">{isAr ? '2. إجمالي تكلفة البضاعة المباعة (المستهدف 27%-35%)' : '2. Total COGS (27%-35%)'}</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-lg font-black text-amber-400">-{pnl.totalCogs.toLocaleString(undefined, { minimumFractionDigits: 3 })} د.ك</span>
                  <span className="text-xs font-mono font-bold text-amber-400">30.1%</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {isAr ? `أطعمة ومشروبات: 26.3% | تغليف مفصول: ${pnl.packagingCost.toFixed(3)} د.ك (3.8%)` : `F&B: 26.3% | Segregated Packaging: ${pnl.packagingCost.toFixed(3)} KWD (3.8%)`}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#0d121d] p-3.5">
                <span className="text-[11px] font-bold text-slate-400">{isAr ? '3. مجمل الربح (المستهدف 65%-73%)' : '3. Gross Profit (65%-73%)'}</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-lg font-black text-emerald-400">{pnl.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 3 })} د.ك</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">69.9%</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {isAr ? 'هامش تصنيع ممتاز يغطي تكلفة العمالة والإشغال والمنصات' : 'Strong product margin supporting store labor & delivery fees'}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
                <span className="text-[11px] font-bold text-emerald-400">{isAr ? '4. التكلفة الأولية المعيارية (الأغذية والعمالة 45%-55%)' : '4. Prime Cost (COGS + Labor 45%-55%)'}</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-lg font-black text-white">{pnl.primeCost.toLocaleString(undefined, { minimumFractionDigits: 3 })} د.ك</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">49.7% ✅</span>
                </div>
                <p className="text-[10px] text-emerald-300/80 mt-1">
                  {isAr ? 'ضمن النطاق الذهبي الممتاز للمطاعم العالمية في الكويت' : 'Within prime target threshold (COGS: 30.1% + Labor: 19.6%)'}
                </p>
              </div>
            </div>

            {/* Detailed P&L Waterfall Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-xs text-slate-200">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                    <th className="py-2.5 px-3 text-start">{isAr ? 'بند قائمة الدخل التشغيلي' : 'P&L Line Item'}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? 'رمز الحساب' : 'GL Account'}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? 'النسبة المستهدفة بالكويت' : 'Kuwait Benchmark %'}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? 'القيمة الفعلية (د.ك)' : 'Actual Amount (KWD)'}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? 'النسبة الفعلية %' : 'Actual %'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {/* Revenue Lines */}
                  <tr className="bg-slate-900/40 font-bold">
                    <td className="py-2 px-3 text-white">{isAr ? 'إجمالي المبيعات' : 'Gross Sales'}</td>
                    <td className="py-2 px-3 text-center text-slate-400">4110-4130</td>
                    <td className="py-2 px-3 text-center text-slate-400">100% - 105%</td>
                    <td className="py-2 px-3 text-end text-white">{pnl.grossSales.toFixed(3)}</td>
                    <td className="py-2 px-3 text-end text-slate-300">104.2%</td>
                  </tr>
                  <tr className="text-rose-400">
                    <td className="py-2 px-3 ps-6">{isAr ? '(-) الخصومات والحملات المشتركة للمنصات' : '(-) Aggregator Discounts & Campaigns'}</td>
                    <td className="py-2 px-3 text-center text-slate-500">4210</td>
                    <td className="py-2 px-3 text-center text-slate-500">3% - 6%</td>
                    <td className="py-2 px-3 text-end">-{pnl.discounts.toFixed(3)}</td>
                    <td className="py-2 px-3 text-end">4.2%</td>
                  </tr>
                  <tr className="bg-emerald-950/20 font-black text-emerald-400">
                    <td className="py-2.5 px-3">{isAr ? '= صافي المبيعات المعتمد' : '= Net Sales'}</td>
                    <td className="py-2.5 px-3 text-center">4000</td>
                    <td className="py-2.5 px-3 text-center">100.0%</td>
                    <td className="py-2.5 px-3 text-end">{pnl.netSales.toFixed(3)}</td>
                    <td className="py-2.5 px-3 text-end">100.0%</td>
                  </tr>

                  {/* COGS Lines */}
                  <tr>
                    <td className="py-2 px-3 ps-6 text-slate-300">{isAr ? '(-) تكلفة الأطعمة المباشرة' : '(-) Direct Food Cost'}</td>
                    <td className="py-2 px-3 text-center text-slate-500">5110</td>
                    <td className="py-2 px-3 text-center text-slate-500">24% - 27%</td>
                    <td className="py-2 px-3 text-end text-amber-300">-{pnl.foodCost.toFixed(3)}</td>
                    <td className="py-2 px-3 text-end text-amber-300">23.0%</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 ps-6 text-slate-300">{isAr ? '(-) تكلفة المشروبات والكرك' : '(-) Direct Beverage Cost'}</td>
                    <td className="py-2 px-3 text-center text-slate-500">5120</td>
                    <td className="py-2 px-3 text-center text-slate-500">1.5% - 2.5%</td>
                    <td className="py-2 px-3 text-end text-amber-300">-{pnl.beverageCost.toFixed(3)}</td>
                    <td className="py-2 px-3 text-end text-amber-300">1.5%</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 ps-6 text-slate-300">{isAr ? '(-) تكلفة مواد التعبئة والتغليف (مفصولة بدقة)' : '(-) Packaging Cost (Segregated)'}</td>
                    <td className="py-2 px-3 text-center text-slate-500">5130</td>
                    <td className="py-2 px-3 text-center text-slate-500">3% - 5%</td>
                    <td className="py-2 px-3 text-end text-amber-300">-{pnl.packagingCost.toFixed(3)}</td>
                    <td className="py-2 px-3 text-end text-amber-300">3.5%</td>
                  </tr>
                  <tr className="bg-slate-900/60 font-bold text-white">
                    <td className="py-2 px-3">{isAr ? '= إجمالي تكلفة المبيعات' : '= Total COGS'}</td>
                    <td className="py-2 px-3 text-center text-slate-400">5000</td>
                    <td className="py-2 px-3 text-center text-slate-400">27% - 35%</td>
                    <td className="py-2 px-3 text-end text-amber-400">-{pnl.totalCogs.toFixed(3)}</td>
                    <td className="py-2 px-3 text-end text-amber-400">28.0%</td>
                  </tr>
                  <tr className="bg-emerald-950/30 font-black text-emerald-300">
                    <td className="py-2.5 px-3">{isAr ? '= مجمل الربح التشغيلي الأول' : '= Gross Profit'}</td>
                    <td className="py-2.5 px-3 text-center">-</td>
                    <td className="py-2.5 px-3 text-center">65% - 73%</td>
                    <td className="py-2.5 px-3 text-end">{pnl.grossProfit.toFixed(3)}</td>
                    <td className="py-2.5 px-3 text-end">72.0%</td>
                  </tr>

                  {/* Labor Costs */}
                  <tr>
                    <td className="py-2 px-3 ps-6 text-slate-300">{isAr ? '(-) الرواتب المباشرة والإضافي (حماية الأجور)' : '(-) Direct Store Wages & OT'}</td>
                    <td className="py-2 px-3 text-center text-slate-500">6110</td>
                    <td className="py-2 px-3 text-center text-slate-500">11% - 15%</td>
                    <td className="py-2 px-3 text-end text-rose-300">-{pnl.laborDirectWages.toFixed(3)}</td>
                    <td className="py-2 px-3 text-end text-rose-300">12.5%</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 ps-6 text-slate-300">{isAr ? '(-) إيجارات ومرافق سكن الموظفين المحملة' : '(-) Staff Housing Allocation'}</td>
                    <td className="py-2 px-3 text-center text-slate-500">6120</td>
                    <td className="py-2 px-3 text-center text-slate-500">2.5% - 3.5%</td>
                    <td className="py-2 px-3 text-end text-rose-300">-{pnl.laborHousing.toFixed(3)}</td>
                    <td className="py-2 px-3 text-end text-rose-300">2.8%</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 ps-6 text-slate-300">{isAr ? '(-) مخصص مكافأة نهاية الخدمة (المادة 51 من قانون العمل الكويتي) والإجازات' : '(-) Monthly EOSB & Leave Amortization'}</td>
                    <td className="py-2 px-3 text-center text-slate-500">6130-6140</td>
                    <td className="py-2 px-3 text-center text-slate-500">2% - 3%</td>
                    <td className="py-2 px-3 text-end text-rose-300">-{(pnl.laborEosbProvision + pnl.laborLeaveTickets).toFixed(3)}</td>
                    <td className="py-2 px-3 text-end text-rose-300">2.2%</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 ps-6 text-slate-300">{isAr ? '(-) إطفاء الإقامات وكروت الصحة ووجبات الموظفين (5230)' : '(-) PAM Residencies & Staff Meals (5230)'}</td>
                    <td className="py-2 px-3 text-center text-slate-500">6150/5230</td>
                    <td className="py-2 px-3 text-center text-slate-500">1.5% - 2.5%</td>
                    <td className="py-2 px-3 text-end text-rose-300">-{(pnl.laborResidencyAmort + pnl.laborMealsCost).toFixed(3)}</td>
                    <td className="py-2 px-3 text-end text-rose-300">1.9%</td>
                  </tr>
                  <tr className="bg-slate-900/60 font-bold text-white">
                    <td className="py-2 px-3">{isAr ? '= إجمالي تكلفة العمالة والمخصصات' : '= Total Direct Labor'}</td>
                    <td className="py-2 px-3 text-center text-slate-400">6000</td>
                    <td className="py-2 px-3 text-center text-slate-400">15% - 22%</td>
                    <td className="py-2 px-3 text-end text-rose-400">-{pnl.totalLabor.toFixed(3)}</td>
                    <td className="py-2 px-3 text-end text-rose-400">19.4%</td>
                  </tr>

                  {/* Prime Cost Gold Alert Row */}
                  <tr className="bg-amber-950/40 border-y-2 border-amber-500/50 font-black text-amber-300">
                    <td className="py-3 px-3 flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-400" />
                      <span>{isAr ? '⭐ التكلفة الأولية المعيارية (الأغذية + العمالة المباشرة)' : '⭐ PRIME COST (COGS + LABOR)'}</span>
                    </td>
                    <td className="py-3 px-3 text-center text-amber-400">5000+6000</td>
                    <td className="py-3 px-3 text-center text-amber-400">45% - 55%</td>
                    <td className="py-3 px-3 text-end text-white">{pnl.primeCost.toFixed(3)}</td>
                    <td className="py-3 px-3 text-end text-amber-400">47.4% ✅</td>
                  </tr>

                  {/* Delivery & Controllables */}
                  <tr>
                    <td className="py-2 px-3 ps-6 text-slate-300">{isAr ? '(-) عمولات المنصات والتوصيل (طلبات، كيتا، ديليفرو)' : '(-) Aggregator & Fleet Delivery Commissions'}</td>
                    <td className="py-2 px-3 text-center text-slate-500">5310-5330</td>
                    <td className="py-2 px-3 text-center text-slate-500">12% - 20%</td>
                    <td className="py-2 px-3 text-end text-rose-300">-{pnl.totalDeliveryCosts.toFixed(3)}</td>
                    <td className="py-2 px-3 text-end text-rose-300">16.8%</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 ps-6 text-slate-300">{isAr ? '(-) المصاريف التشغيلية وعقود الصيانة والحشرات والمداخن (7111-7123)' : '(-) Controllables: AMC Maintenance, Cleaning & Utilities'}</td>
                    <td className="py-2 px-3 text-center text-slate-500">7100</td>
                    <td className="py-2 px-3 text-center text-slate-500">4% - 7%</td>
                    <td className="py-2 px-3 text-end text-rose-300">-{pnl.totalControllables.toFixed(3)}</td>
                    <td className="py-2 px-3 text-end text-rose-300">5.5%</td>
                  </tr>
                  <tr className="bg-cyan-950/30 font-bold text-cyan-300">
                    <td className="py-2.5 px-3">{isAr ? '= الربح التشغيلي الخاضع لرقابة مدير الفرع والتشغيل' : '= Controllable Store Profit (Operations Target)'}</td>
                    <td className="py-2.5 px-3 text-center">-</td>
                    <td className="py-2.5 px-3 text-center">20% - 35%</td>
                    <td className="py-2.5 px-3 text-end">{pnl.controllableProfit.toFixed(3)}</td>
                    <td className="py-2.5 px-3 text-end">30.3%</td>
                  </tr>

                  {/* Occupancy & Store EBITDA */}
                  <tr>
                    <td className="py-2 px-3 ps-6 text-slate-300">{isAr ? '(-) تكاليف الإشغال: إيجار الفرع + إطفاء الخلو + الإهلاك + التراخيص' : '(-) Occupancy & Fixed: Store Rent, Key Money Amort, Depreciation'}</td>
                    <td className="py-2 px-3 text-center text-slate-500">7510-7540</td>
                    <td className="py-2 px-3 text-center text-slate-500">10% - 18%</td>
                    <td className="py-2 px-3 text-end text-rose-300">-{pnl.totalOccupancy.toFixed(3)}</td>
                    <td className="py-2 px-3 text-end text-rose-300">15.1%</td>
                  </tr>
                  <tr className="bg-emerald-900/30 font-black text-emerald-400">
                    <td className="py-3 px-3">{isAr ? '= صافي ربح الفرع قبل المصروفات العامة (الربح التشغيلي للجدران الأربعة)' : '= Four-Wall Store EBITDA Profit'}</td>
                    <td className="py-3 px-3 text-center">{isAr ? 'الربح التشغيلي' : 'EBITDA'}</td>
                    <td className="py-3 px-3 text-center">10% - 20%</td>
                    <td className="py-3 px-3 text-end">{pnl.storeEbitda.toFixed(3)}</td>
                    <td className="py-3 px-3 text-end">15.2% ✅</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 ps-6 text-slate-400">{isAr ? '(-) نصيب الفرع من مصاريف المقر الرئيسي والإدارة المركزية' : '(-) Corporate HQ Shared Services Overhead'}</td>
                    <td className="py-2 px-3 text-center text-slate-500">8000</td>
                    <td className="py-2 px-3 text-center text-slate-500">3% - 6%</td>
                    <td className="py-2 px-3 text-end text-slate-400">-{pnl.corporateOverheadAllocation.toFixed(3)}</td>
                    <td className="py-2 px-3 text-end text-slate-400">4.5%</td>
                  </tr>
                  <tr className="bg-emerald-500/20 border-t-2 border-emerald-500 font-black text-emerald-300">
                    <td className="py-3.5 px-3 text-sm">{isAr ? '🏆 صافي الربح النهائي للشركة' : '🏆 Venture Foods Final Net Profit'}</td>
                    <td className="py-3.5 px-3 text-center text-emerald-400">FINAL</td>
                    <td className="py-3.5 px-3 text-center text-emerald-400">7% - 14%</td>
                    <td className="py-3.5 px-3 text-end text-base text-white">{pnl.netProfit.toFixed(3)} د.ك</td>
                    <td className="py-3.5 px-3 text-end text-base text-emerald-400">10.7% 🎯</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. AMC & PEST CONTROL HUB WITH OPERATIONAL SLA GATE                       */}
      {/* ========================================================================= */}
      {activeSubView === 'amcHub' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                  {isAr ? 'مركز عقود الصيانة الدورية ومكافحة الحشرات ومداخن المطابخ' : 'Operations ↔ Accounting Preventative Maintenance Hub'}
                </span>
                <h2 className="text-xl font-black text-white mt-1">
                  {isAr ? 'بوابة التحقق التشغيلي من مستوى الخدمة قبل الصرف المحاسبي' : 'Automated SLA Payment Gate & Contract Allocation'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAr
                    ? 'عقود الفروع الـ 9 والمطبخ المركزي بالقرين (7111–7123 و 1146): لا يصرف أي شيك لمقاول إلا بعد تأكيد زيارة العمليات وشهادات البلدية والإطفاء'
                    : 'Preventative contracts for 9 active stores + Qurain CK: payments automatically held on SLA breach or missing MOH/KFSD certs'}
                </p>
              </div>
              <div className="flex gap-2">
                <span className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-black text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert size={14} />
                  {isAr ? 'عقد موقوف الصرف تلقائياً لعدم اكتمال شروط الخدمة: 1' : 'SLA Payment Hold: 1'}
                </span>
              </div>
            </div>

            {/* Contracts Cards / Table */}
            <div className="mt-5 space-y-4">
              {AMC_CONTRACTS_REGISTRY.map((amc) => {
                const isHeld = amc.slaStatus === 'OVERDUE_SLA_HOLD'
                return (
                  <div
                    key={amc.id}
                    className={`rounded-2xl border p-4.5 transition-all ${
                      isHeld
                        ? 'border-rose-500/50 bg-rose-950/20 shadow-lg shadow-rose-950/30'
                        : 'border-slate-800 bg-[#0d121d] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-black text-cyan-300">
                            {amc.contractCode}
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            GL: {amc.glAccount} (إطفاء شهري من {amc.prepaidAccount})
                          </span>
                          <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            {isAr ? `${amc.coveredLocationsCount} مواقع مغطاة (9 فروع + مطبخ القرين)` : `${amc.coveredLocationsCount} Monitored Units (9 Stores + CK)`}
                          </span>
                        </div>
                        <h3 className="text-base font-black text-white">{isAr ? amc.nameAr : amc.nameEn}</h3>
                        <p className="text-xs text-slate-300">{amc.vendorName}</p>
                      </div>

                      <div className="text-end">
                        <div className="font-mono text-base font-black text-white">
                          {amc.monthlyAllocationKwd.toFixed(3)} د.ك <span className="text-xs text-slate-400">/ {isAr ? 'شهرياً' : 'mo'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {isAr ? `إجمالي العقد السنوي: ${amc.totalAnnualKwd.toFixed(3)} د.ك` : `Annual: ${amc.totalAnnualKwd.toFixed(3)} KWD`}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500">{isAr ? 'دورية الزيارات:' : 'Frequency:'} </span>
                        <span className="text-slate-300 font-semibold">{isAr ? amc.visitFrequencyAr : amc.visitFrequencyEn}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">{isAr ? 'آخر زيارة / القادمة:' : 'Last / Next Visit:'} </span>
                        <span className="text-slate-300 font-mono">{amc.lastVisitDate} ➔ {amc.nextScheduledVisit}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">{isAr ? 'رقم الشهادة الرسمية:' : 'Official Cert #:'} </span>
                        <span className="text-amber-400 font-mono font-bold">{amc.healthCertNumber}</span>
                      </div>
                    </div>

                    {/* SLA Status Banner */}
                    <div className={`mt-3.5 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 ${
                      isHeld ? 'bg-rose-900/40 border border-rose-500/40 text-rose-200' : 'bg-emerald-950/30 border border-emerald-500/30 text-emerald-200'
                    }`}>
                      <div className="flex items-center gap-2 text-xs font-bold">
                        {isHeld ? <AlertTriangle size={16} className="text-rose-400 shrink-0" /> : <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
                        <span>{isAr ? amc.slaMessageAr : amc.slaMessageEn}</span>
                      </div>
                      <div>
                        {amc.paymentAllowed ? (
                          <span className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-[11px] font-black text-emerald-300">
                            {isAr ? '✅ مسموح بصرف الدفعة بالمحاسبة' : '✅ Payment Approved for GL Release'}
                          </span>
                        ) : (
                          <button
                            onClick={() => showToast(isAr ? '⛔ تم تفعيل إيقاف الصرف التلقائي حتى قيام شركة الشعلة بتسليم شهادات الإطفاء' : '⛔ SLA Payment Hold active pending KFSD inspection')}
                            className="rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1 text-[11px] font-black text-white shadow-md transition"
                          >
                            {isAr ? '⛔ إيقاف الصرف مفعل لعدم اكتمال شروط الخدمة' : '⛔ SLA Payment Hold Active'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. 90 / 60 / 30 DAYS EXPIRY & DEPOSIT RECOVERY RADAR                      */}
      {/* ========================================================================= */}
      {activeSubView === 'expiryRadar' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                  {isAr ? 'رادار الرقابة والانتهاء المالي والتشغيلي' : 'Operations & Finance Expiry & Recovery Radar'}
                </span>
                <h2 className="text-xl font-black text-white mt-1">
                  {isAr ? 'رادار انتهاء العقود والتراخيص واسترداد التأمينات (90 / 60 / 30 يوماً)' : '90 / 60 / 30 Days Contract & Deposit Recovery Radar'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAr
                    ? 'ينبه قبل 90/60 يوماً من إيجارات الفروع والسكن، وقبل 30 يوماً من تراخيص البلدية والإطفاء، وينبه في 3 يناير 2027 لاسترداد تأمين كشتة المارينا (250 د.ك)'
                    : 'Alerts for leases, Baladiya/fire licenses, and alerts on Jan 3, 2027 to recover the 250.000 KWD Marina Kashta deposit'}
                </p>
              </div>
              <div>
                <span className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-black text-cyan-400">
                  {isAr ? 'إجمالي التأمينات المستردة قيد المتابعة: 1,250.000 د.ك' : 'Monitored Refundable Deposits: 1,250.000 KWD'}
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-3.5">
              {EXPIRY_RADAR_REGISTRY.map((item) => {
                const isDeposit = item.itemType === 'EVENT_DEPOSIT'
                const isUrgent = item.urgency === 'URGENT_30'

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 transition-all ${
                      isDeposit
                        ? 'border-emerald-500/40 bg-emerald-950/15'
                        : isUrgent
                        ? 'border-rose-500/40 bg-rose-950/15'
                        : 'border-slate-800 bg-[#0d121d]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-black ${
                            isDeposit ? 'bg-emerald-500/20 text-emerald-300' : isUrgent ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {item.reference}
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            مركز التكلفة: {item.costCenter} | حساب {item.accountCode}
                          </span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isDeposit ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40' : isUrgent ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}>
                            {item.daysRemaining} {isAr ? 'يوماً متبقية' : 'days left'}
                          </span>
                        </div>
                        <h4 className="mt-1.5 text-base font-black text-white">{isAr ? item.titleAr : item.titleEn}</h4>
                        <p className="mt-1 text-xs text-slate-300">{isAr ? item.actionRequiredAr : item.actionRequiredEn}</p>
                      </div>

                      <div className="text-end">
                        <span className="text-[10px] text-slate-400 block">{isAr ? 'تاريخ الاستحقاق / الانتهاء' : 'Expiry / Claim Date'}</span>
                        <span className="text-sm font-black font-mono text-amber-300">{item.expiryDate}</span>
                        <div className="mt-1 font-mono text-base font-black text-white">
                          {item.financialAmountKwd.toFixed(3)} د.ك
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. HR ↔ ACCOUNTING ↔ OPERATIONS 7-WAY LIVE INTEGRATION BRIDGE             */}
      {/* ========================================================================= */}
      {activeSubView === 'hrBridge' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                  {isAr ? 'الترابط العضوي الآلي ثلاثي الأبعاد' : 'Operations ↔ HR ↔ Accounting 7-Way Live Bridge'}
                </span>
                <h2 className="text-xl font-black text-white mt-1">
                  {isAr ? 'محرك الربط الآلي بين الموارد البشرية والعمليات والشجرة المالية' : '7-Way Automated Integration & Labor Allocation Engine'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAr
                    ? 'يربط بيانات الـ 166 موظفاً الفعليين بنظام قيود اليومية الآلية (حماية الأجور، إطفاء الإقامات، مخصص المادة 51، سكن العمال، ووجبات الموظفين)'
                    : 'Real-time bidirectional posting between biometric attendance, HR records, and General Ledger accounts'}
                </p>
              </div>
              <div>
                <span className="rounded-xl border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-xs font-black text-purple-300">
                  {isAr ? '7 مسارات قيود مؤتمتة 100%' : '7 Fully Automated Integration Paths'}
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-3.5">
              {HR_ACCOUNTING_7WAY_BRIDGE.map((b) => (
                <div key={b.bridgeStep} className="rounded-2xl border border-slate-800 bg-[#0d121d] p-4.5 hover:border-slate-700 transition">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 font-bold text-xs">
                          {isAr ? `مسار الربط #${b.bridgeStep}` : `Bridge Path #${b.bridgeStep}`}
                        </span>
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                          {b.sourceModule}
                        </span>
                        <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          {b.auditStatus}
                        </span>
                      </div>
                      <h4 className="text-base font-black text-white mt-1">{isAr ? b.ruleNameAr : b.ruleNameEn}</h4>
                      <p className="text-xs text-slate-300 mt-0.5">{isAr ? b.mechanismAr : b.mechanismEn}</p>
                    </div>

                    <div className="text-end">
                      <span className="text-[10px] text-slate-400 block">{isAr ? 'الأثر المالي الشهري' : 'Monthly GL Impact'}</span>
                      <span className="font-mono text-base font-black text-white">{b.monthlyImpactKwd.toFixed(3)} د.ك</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">{isAr ? 'مدين:' : 'Debit (Dr):'}</span>
                      <span className="font-mono text-slate-200">{b.debitAccount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-rose-400 font-bold">{isAr ? 'دائن:' : 'Credit (Cr):'}</span>
                      <span className="font-mono text-slate-200">{b.creditAccount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. 4D KUWAIT CHART OF ACCOUNTS (1000–8300) EXPLORER                       */}
      {/* ========================================================================= */}
      {activeSubView === 'coa4d' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5 shadow-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  {isAr ? 'الهيكلة المحاسبية المعتمدة لمطاعم الكويت (1000–8300)' : 'Standard Kuwait F&B 4D Chart of Accounts'}
                </span>
                <h2 className="text-xl font-black text-white mt-1">
                  {isAr ? 'شجرة الحسابات القياسية لمطاعم الكويت والأبعاد الأربعة الإجبارية' : 'Enterprise 4D Chart of Accounts (3 Decimal Precision)'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAr
                    ? 'كل قيد محاسبي مقترن بـ: Brand (BR-00 إلى BR-06) · Location (9 فروع + مطبخ مركزي) · Department · Channel'
                    : 'Every transaction is tagged with 4 mandatory dimensions: Brand, Location, Department, and Channel'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportCoaCsv}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg transition flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>{isAr ? 'تصدير شجرة الحسابات (إكسل)' : 'Export COA CSV'}</span>
                </button>
              </div>
            </div>

            {/* 4D Dimensions Selector Bar */}
            <div className="mt-4 rounded-xl border border-slate-800 bg-[#0d121d] p-3.5 space-y-3">
              <span className="text-[11px] font-bold text-slate-400 block">
                {isAr ? '🏷️ الأبعاد الأربعة الإلزامية للتوجيه المالي ومراكز التكلفة:' : '🏷️ The 4 Mandatory Accounting Dimensions:'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                {/* Brand */}
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">{isAr ? '1. العلامة التجارية:' : '1. Brand:'}</label>
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-slate-200 text-xs focus:border-emerald-500"
                  >
                    <option value="ALL">{isAr ? 'جميع البراندات الـ 6 الرسمية + المقر الرئيسي' : 'All 6 Brands + HQ'}</option>
                    {KUWAIT_DIMENSION_BRANDS.map((b) => (
                      <option key={b.code} value={b.code}>{b.code} · {isAr ? b.nameAr : b.nameEn}</option>
                    ))}
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">{isAr ? '2. الموقع ومستودع الفرع:' : '2. Location / Cost Center:'}</label>
                  <select
                    value={selectedLoc}
                    onChange={(e) => setSelectedLoc(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-slate-200 text-xs focus:border-emerald-500"
                  >
                    <option value="ALL">{isAr ? 'جميع الفروع الـ 9 النشطة + المطبخ المركزي' : 'All 9 Active Stores + Central Kitchen'}</option>
                    {KUWAIT_DIMENSION_LOCATIONS.map((l) => (
                      <option key={l.code} value={l.code}>{l.code} · {isAr ? l.nameAr : l.nameEn}</option>
                    ))}
                  </select>
                </div>

                {/* Department */}
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">{isAr ? '3. القسم التشغيلي وموقع العمل:' : '3. Department:'}</label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-slate-200 text-xs focus:border-emerald-500"
                  >
                    <option value="ALL">{isAr ? 'جميع الأقسام (المطبخ / الصالة / التوصيل / الإدارة)' : 'All Departments'}</option>
                    {KUWAIT_DIMENSION_DEPARTMENTS.map((d) => (
                      <option key={d.code} value={d.code}>{d.code} · {isAr ? d.nameAr : d.nameEn}</option>
                    ))}
                  </select>
                </div>

                {/* Channel */}
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">{isAr ? '4. قناة البيع وقناة التوزيع:' : '4. Sales Channel:'}</label>
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-slate-200 text-xs focus:border-emerald-500"
                  >
                    <option value="ALL">{isAr ? 'جميع قنوات البيع والتوصيل' : 'All Channels (Dine, Take, Aggregators)'}</option>
                    {KUWAIT_DIMENSION_CHANNELS.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} · {isAr ? c.nameAr : c.nameEn}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Filter by Category & Search */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', labelAr: 'الكل (1000-8300)', labelEn: 'All' },
                  { id: 'ASSET', labelAr: '1000 الأصول', labelEn: '1000 Assets' },
                  { id: 'LIABILITY', labelAr: '2000 الالتزامات', labelEn: '2000 Liabilities' },
                  { id: 'REVENUE', labelAr: '4000 الإيرادات', labelEn: '4000 Revenues' },
                  { id: 'COGS', labelAr: '5000 تكلفة المبيعات والتوصيل', labelEn: '5000 COGS' },
                  { id: 'LABOR', labelAr: '6000 تكلفة العمالة', labelEn: '6000 Labor' },
                  { id: 'CONTROLLABLES', labelAr: '7000 المصاريف التشغيلية', labelEn: '7000 Controllables' },
                  { id: 'OCCUPANCY', labelAr: '7500 الإشغال والإيجارات', labelEn: '7500 Occupancy' },
                  { id: 'ADMIN', labelAr: '8000 الإدارة المركزية', labelEn: '8000 Admin' },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    onClick={() => setAccountCategoryFilter(pill.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                      accountCategoryFilter === pill.id
                        ? 'bg-emerald-500 text-black font-extrabold shadow'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {isAr ? pill.labelAr : pill.labelEn}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder={isAr ? 'بحث برقم أو اسم الحساب...' : 'Search by code or title...'}
                  value={coaSearch}
                  onChange={(e) => setCoaSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Accounts Table */}
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs text-slate-200">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] text-slate-400">
                    <th className="py-2.5 px-3 text-start">{isAr ? 'رمز الحساب' : 'Account Code'}</th>
                    <th className="py-2.5 px-3 text-start">{isAr ? 'اسم الحساب القياسي' : 'Account Title'}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? 'التصنيف' : 'Category'}</th>
                    <th className="py-2.5 px-3 text-center">{isAr ? 'الطبيعة' : 'Normal'}</th>
                    <th className="py-2.5 px-3 text-end">{isAr ? 'الرصيد الفعلي (د.ك)' : 'Balance (KWD)'}</th>
                    <th className="py-2.5 px-3 text-start">{isAr ? 'الوصف الرقابي ومسار الصرف' : 'Description & Policy'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredAccounts.map((acc) => (
                    <tr key={acc.code} className="hover:bg-slate-800/30 transition">
                      <td className="py-2.5 px-3 font-bold text-cyan-300">{acc.code}</td>
                      <td className="py-2.5 px-3 font-sans font-bold text-white">
                        {isAr ? acc.nameAr : acc.nameEn}
                        <span className="block text-[10px] font-normal text-slate-400 font-sans">
                          {isAr ? acc.nameEn : acc.nameAr}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                          {acc.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-[10px] text-slate-400">
                        {acc.normalBalance}
                      </td>
                      <td className="py-2.5 px-3 text-end font-bold text-emerald-400">
                        {acc.balanceKwd.toLocaleString(undefined, { minimumFractionDigits: 3 })} د.ك
                      </td>
                      <td className="py-2.5 px-3 font-sans text-[11px] text-slate-300 max-w-xs">
                        {isAr ? acc.descriptionAr : acc.descriptionEn}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SETTLEMENT RECONCILIATIONS & 1139 INVENTORY IN TRANSIT                 */}
      {/* ========================================================================= */}
      {activeSubView === 'transitRecon' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  {isAr ? 'دورة التسويات والتحويلات المركزية' : 'Platform Clearing & Central Kitchen Transit'}
                </span>
                <h2 className="text-xl font-black text-white mt-1">
                  {isAr ? 'مطابقة ذمم المنصات (1121–1125) ومخزون التحويلات (1139 بضاعة بالطريق بين القرين والفروع)' : 'Platform Clearing & In-Transit Depletion Control'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAr
                    ? 'مطابقة مبيعات الـ POS مع إيداعات البنك بعد حسم العمولات 5310 والإعلانات 7150، وتتبع تحويلات مطبخ القرين للفروع عبر 1139'
                    : 'Reconciling daily POS batches with NBK net deposits and tracking CK transfers via 1139 transit ledger'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-black text-emerald-400">
                  {isAr ? 'فروقات الجرد تحت السيطرة: 0.8% (حد الأمان 1.5%)' : 'Variance: 0.8% (Target < 1.5%)'}
                </span>
              </div>
            </div>

            {/* Transit Transfers Table */}
            <div className="mt-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck size={16} className="text-emerald-400" />
                <span>{isAr ? 'الإرساليات الحالية بطريق التحويل من المطبخ المركزي (حساب 1139):' : 'Current Active Transfers in Transit from Qurain CK (1139):'}</span>
              </h3>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-xs text-slate-200">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900 text-[11px] text-slate-400">
                      <th className="py-2.5 px-3 text-start">{isAr ? 'رقم الإرسالية' : 'Transfer #'}</th>
                      <th className="py-2.5 px-3 text-start">{isAr ? 'من / إلى' : 'From / To'}</th>
                      <th className="py-2.5 px-3 text-start">{isAr ? 'الأصناف والمكونات' : 'Batch Items'}</th>
                      <th className="py-2.5 px-3 text-center">{isAr ? 'الوزن المعياري' : 'BOM Weight'}</th>
                      <th className="py-2.5 px-3 text-end">{isAr ? 'القيمة (د.ك)' : 'Value (KWD)'}</th>
                      <th className="py-2.5 px-3 text-center">{isAr ? 'حالة الاستلام بالفرع' : 'Receiving Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-cyan-300">TR-QRN-SLM-084</td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-white">
                        {isAr ? 'مطبخ القرين المركزي ➔ فرع السالمية' : 'Qurain CK ➔ Salmiya Branch'}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-300">
                        {isAr ? 'لحم تندرلوين متبل صيني (35 كجم) + صوص منجوليان (15 كجم)' : 'Marinated Tenderloin (35kg) + Mongolian Sauce (15kg)'}
                      </td>
                      <td className="py-2.5 px-3 text-center text-amber-300">50.000 KG</td>
                      <td className="py-2.5 px-3 text-end font-bold text-white">485.500 د.ك</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="rounded bg-amber-500/20 text-amber-300 px-2 py-0.5 text-[10px] font-bold">
                          {isAr ? '🚚 بطريق التحويل (1139)' : 'In Transit (1139)'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-cyan-300">TR-QRN-360-085</td>
                      <td className="py-2.5 px-3 font-sans font-semibold text-white">
                        {isAr ? 'مطبخ القرين المركزي ➔ فرع 360 مول' : 'Qurain CK ➔ 360 Mall Branch'}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-300">
                        {isAr ? 'دجاج تيكا شاورما طحينة (40 كجم) + خبز صاج خاص' : 'Tahina Marinated Chicken (40kg) + Fresh Saj Bread'}
                      </td>
                      <td className="py-2.5 px-3 text-center text-amber-300">48.200 KG</td>
                      <td className="py-2.5 px-3 text-end font-bold text-white">320.000 د.ك</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="rounded bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                          {isAr ? '✅ تم الاستلام بالوزن ومطابقة الجرد' : 'Received & Matched by Weight'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
