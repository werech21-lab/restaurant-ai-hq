'use client'

import React, { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import {
  Landmark,
  FileSpreadsheet,
  Receipt,
  Wallet,
  BookOpen,
  PieChart,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  Calendar,
  Search,
  Filter,
  Download,
  CreditCard,
  Scale,
  Printer,
  ShieldCheck,
  Store,
  ArrowUpRight,
  Truck,
  TrendingUp,
} from 'lucide-react'
import { AutomatedGlBridge } from '@/components/finance/AutomatedGlBridge'
import { VENTURE_FOODS_EVENTS } from '@/lib/events/venture-events-engine'
import { KuwaitCoaBridgeView } from './KuwaitCoaBridgeView'
import { OdooAccountingAnalyticsHub } from './OdooAccountingAnalyticsHub'
import { OdooExpenseSingleModal, type NewExpensePayload } from './OdooExpenseSingleModal'
import { OdooExpenseSheetModal, type NewExpenseSheetPayload } from './OdooExpenseSheetModal'

import Link from 'next/link'
import {
  ODOO_EXPENSE_CATEGORIES_25,
  ODOO_CUSTODIANS_7,
  ODOO_SANAD_STATEMENT_DETAILS,
  ODOO_RABIH_MAINTENANCE_DETAILS,
  ODOO_TOP_SANAD_LICENSES_TRANSACTIONS,
  ODOO_SETTLEMENT_METRICS,
  ODOO_EXPENSES_TOTAL_KWD,
  ODOO_EXPENSES_TOTAL_TX,
  ODOO_REAL_EXPENSE_SHEETS,
  ODOO_EXPENSE_SHEET_CUSTODIANS,
  type OdooExpenseSheetReport,
} from '@/lib/accounting/odoo-real-expenses-data'

export function VentureAccountingHub({
  locale = 'ar',
  liveChildren,
}: {
  locale?: 'ar' | 'en'
  liveChildren?: React.ReactNode
}) {
  let ctxLocale: 'ar' | 'en' | null = null
  try {
    const i18n = useI18n()
    if (i18n?.locale) ctxLocale = i18n.locale
  } catch {}

  const [activeTab, setActiveTab] = useState<
    | 'odooAnalytics'
    | 'pnl'
    | 'fourWall'
    | 'coa4d'
    | 'amcHub'
    | 'expiryRadar'
    | 'hrBridge'
    | 'transitRecon'
    | 'banking'
    | 'pettyCash'
    | 'journals'
    | 'chart'
    | 'aging'
    | 'glBridge'
    | 'eventsFinance'
    | 'leases'
    | 'fleet'
    | 'legacy'
  >('odooAnalytics')
  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)

  useEffect(() => {
    if (ctxLocale) setCurrentLocale(ctxLocale)
  }, [ctxLocale])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const updateFromDoc = () => {
      const docLang = document.documentElement.lang
      if (docLang === 'en' || docLang === 'ar') {
        setCurrentLocale(docLang)
      }
    }
    updateFromDoc()
    const observer = new MutationObserver(updateFromDoc)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] })
    return () => observer.disconnect()
  }, [])
  const [showNewEntryModal, setShowNewEntryModal] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // Odoo Real Expenses & Petty Cash Sub-Tabs State
  const [pettySubTab, setPettySubTab] = useState<'expenseSheets' | 'categories' | 'custodians' | 'sanad' | 'topLicenses' | 'rabih'>('expenseSheets')
  const [pettySearch, setPettySearch] = useState('')
  const [expenseSheetReports, setExpenseSheetReports] = useState<OdooExpenseSheetReport[]>(ODOO_REAL_EXPENSE_SHEETS)
  const [selectedExpenseCustodian, setSelectedExpenseCustodian] = useState<string>('ALL')
  const [selectedSheetIds, setSelectedSheetIds] = useState<string[]>([])
  const [showChequeModal, setShowChequeModal] = useState(false)
  const [chequeBank, setChequeBank] = useState<'CBK' | 'NBK'>('CBK')
  const [chequeRef, setChequeRef] = useState('CHQ-2026-9041')
  const [showSingleExpenseModal, setShowSingleExpenseModal] = useState(false)
  const [showExpenseSheetModal, setShowExpenseSheetModal] = useState(false)
  const [selectedSheetForModal, setSelectedSheetForModal] = useState<OdooExpenseSheetReport | null>(null)

  const isAr = currentLocale === 'ar'
  const isRtl = isAr

  const showToast = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 4000)
  }

  const handleSaveNewExpense = (payload: NewExpensePayload) => {
    const newSheet: OdooExpenseSheetReport = {
      id: `sheet_exp_${Date.now()}`,
      reportNo: `EXP/2026/${Math.floor(1000 + Math.random() * 9000)}`,
      date: payload.date,
      custodianId: payload.custodianId,
      custodianNameAr: payload.custodianId === 'sanad' ? 'سند' : payload.custodianId === 'rabih' ? 'ربيع أنيس يحيى' : 'الموظف المسؤول',
      custodianNameEn: payload.custodianId === 'sanad' ? 'Sanad' : payload.custodianId === 'rabih' ? 'Rabih Anis Yahya' : 'Responsible Staff',
      titleAr: payload.descriptionAr,
      titleEn: payload.descriptionEn,
      descriptionAr: payload.descriptionAr,
      descriptionEn: payload.descriptionEn,
      costCenterAr: 'الفروع ومراكز التكلفة المعتمدة',
      costCenterEn: 'Approved Branch Cost Centers',
      brandAr: 'البراندات الرسمية',
      brandEn: 'Official Brands',
      amountKwd: payload.amountKwd,
      accountCode: '40355 / 7120',
      adminApproval: payload.status === 'approved' || payload.status === 'paid' ? 'approved' : 'submitted',
      paymentStatus: payload.status === 'paid' ? 'paid' : 'not_paid',
    }
    setExpenseSheetReports([newSheet, ...expenseSheetReports])
    showToast(
      isAr
        ? `تم تسجيل المصروف بنجاح (${payload.amountKwd.toFixed(3)} د.ك) وتحديث رصيد العهدة الدفتري.`
        : `Expense successfully registered (${payload.amountKwd.toFixed(3)} KWD) and posted.`
    )
  }

  const handleSaveNewExpenseSheet = (payload: NewExpenseSheetPayload) => {
    const newSheet: OdooExpenseSheetReport = {
      id: `sheet_${Date.now()}`,
      reportNo: payload.reportNo,
      date: payload.date,
      custodianId: payload.custodianId,
      custodianNameAr: payload.custodianNameAr,
      custodianNameEn: payload.custodianNameEn,
      titleAr: payload.titleAr,
      titleEn: payload.titleEn,
      descriptionAr: payload.titleAr,
      descriptionEn: payload.titleEn,
      costCenterAr: 'الفروع الـ 9 والمطبخ المركزي',
      costCenterEn: '9 Branches & Central Kitchen',
      brandAr: 'البراندات الـ 6 الرسمية',
      brandEn: '6 Official Brands',
      amountKwd: payload.amountKwd,
      accountCode: '1142 / 6150 / 7120',
      adminApproval: payload.adminApproval,
      paymentStatus: payload.paymentStatus,
    }
    setExpenseSheetReports([newSheet, ...expenseSheetReports])
    showToast(
      isAr
        ? `تم إنشاء واعتماد كشف التصفية المجمع (${payload.reportNo}) بقيمة ${payload.amountKwd.toFixed(3)} د.ك.`
        : `Expense report sheet (${payload.reportNo}) created for ${payload.amountKwd.toFixed(3)} KWD.`
    )
  }

  const handleBatchChequePayment = () => {
    const targetIds = selectedSheetIds.length > 0
      ? selectedSheetIds
      : expenseSheetReports.filter(s => s.adminApproval === 'approved' && s.paymentStatus === 'not_paid').map(s => s.id)

    if (targetIds.length === 0) {
      showToast(isAr ? 'لا توجد تقارير معتمدة وغير مدفوعة محددة للصرف' : 'No approved unpaid reports available for payment')
      return
    }

    const todayStr = new Date().toLocaleDateString('en-GB')
    const bankNameAr = chequeBank === 'CBK' ? 'البنك التجاري الكويتي (Commercial Bank)' : 'بنك الكويت الوطني (الوطني K-Net)'
    const bankNameEn = chequeBank === 'CBK' ? 'Commercial Bank of Kuwait (CBK)' : 'National Bank of Kuwait (NBK)'

    setExpenseSheetReports(prev => prev.map(sheet => {
      if (targetIds.includes(sheet.id)) {
        return {
          ...sheet,
          paymentStatus: 'paid',
          paymentChequeRef: chequeRef,
          paymentDate: todayStr,
          payingBankAr: bankNameAr,
          payingBankEn: bankNameEn,
        }
      }
      return sheet
    }))

    setSelectedSheetIds([])
    setShowChequeModal(false)
    showToast(
      isAr
        ? `تم بنجاح إصدار شيك السداد رقم (${chequeRef}) وترحيل المصروفات لمراكز تكلفة الفروع والبراندات`
        : `Payment cheque (${chequeRef}) issued & expenses posted to branch cost centers successfully`
    )
  }

  const handleExportPettyCsv = () => {
    let csvContent = '\uFEFF' // UTF-8 BOM for Excel
    if (pettySubTab === 'expenseSheets') {
      csvContent += isAr
        ? 'رقم التقرير,التاريخ,صاحب العهدة,بيان التقرير والأعمال المنفذة,مركز التكلفة,العلامة التجارية,المبلغ (د.ك),رمز الحساب,الاعتماد الإداري,حالة السداد,المرجع البنكي\n'
        : 'Report No,Date,Custodian,Description & Works,Cost Center,Brand,Amount (KWD),GL Code,Admin Approval,Payment Status,Bank Ref\n'
      expenseSheetReports.forEach((s) => {
        csvContent += `"${s.reportNo}","${s.date}","${isAr ? s.custodianNameAr : s.custodianNameEn}","${isAr ? s.descriptionAr : s.descriptionEn}","${isAr ? s.costCenterAr : s.costCenterEn}","${isAr ? s.brandAr : s.brandEn}","${s.amountKwd.toFixed(3)}","${s.accountCode}","${s.adminApproval === 'approved' ? (isAr ? 'معتمد إدارياً' : 'Approved') : (isAr ? 'مرسل للاعتماد' : 'Submitted')}","${s.paymentStatus === 'paid' ? (isAr ? 'تم الدفع وإصدار الشيك' : 'Paid') : (isAr ? 'غير مدفوع — بانتظار الشيك' : 'Not Paid')}","${s.paymentChequeRef || ''}"\n`
      })
    } else if (pettySubTab === 'categories') {
      csvContent += isAr
        ? 'الترتيب,فئة المصروف,رمز الحساب,مركز التكلفة,عدد الحركات,المبلغ (د.ك),النسبة %\n'
        : 'Rank,Expense Category,Account Code,Cost Center Tag,Tx Count,Amount (KWD),Percentage %\n'
      ODOO_EXPENSE_CATEGORIES_25.forEach((c) => {
        csvContent += `"${c.rank}","${isAr ? c.nameAr : c.nameEn}","${c.accountCode}","${isAr ? c.tagAr : c.tagEn}","${c.txCount}","${c.amountKwd.toFixed(3)}","${c.pct}%"\n`
      })
    } else if (pettySubTab === 'custodians') {
      csvContent += isAr
        ? 'المسؤول / صاحب العهدة,الوظيفة / الغرض,رمز الحساب,عدد المعاملات,إجمالي المصروف (د.ك),النسبة %,الحالة\n'
        : 'Custodian,Role / Purpose,Account Code,Tx Count,Total Spent (KWD),Percentage %,Status\n'
      ODOO_CUSTODIANS_7.forEach((c) => {
        csvContent += `"${isAr ? c.nameAr : c.nameEn}","${isAr ? c.roleAr : c.roleEn}","${c.accountCode}","${c.txCount}","${c.totalKwd.toFixed(3)}","${c.pct}%","${isAr ? c.statusAr : c.statusEn}"\n`
      })
    } else if (pettySubTab === 'sanad') {
      csvContent += isAr
        ? 'رقم الحركة,التاريخ,رقم البصمة,اسم الموظف,بيان المعاملة,مركز التكلفة المزدوج,الفرع,البراند,رمز الحساب,المبلغ (د.ك),رقم المستند,الحالة\n'
        : 'Tx ID,Date,Badge ID,Employee Name,Description,Dual Cost Center,Branch,Brand,Account Code,Amount (KWD),Doc Ref,Status\n'
      ODOO_SANAD_STATEMENT_DETAILS.forEach((t) => {
        csvContent += `"${t.id}","${t.date}","${t.badgeId || ''}","${isAr ? t.employeeNameAr || '' : t.employeeNameEn || ''}","${isAr ? t.descAr : t.descEn}","${isAr ? t.costCenterAr : t.costCenterEn}","${isAr ? t.branchAr : t.branchEn}","${isAr ? t.brandAr : t.brandEn}","${t.accountCode}","${t.amountKwd.toFixed(3)}","${t.docRef}","${isAr ? t.statusAr : t.statusEn}"\n`
      })
    } else if (pettySubTab === 'topLicenses') {
      csvContent += isAr
        ? 'رقم المعاملة,التاريخ,بيان الترخيص,المستفيد والجهة,المسؤول,الفرع,البراند,رمز الحساب,المبلغ (د.ك),رقم المستند,الحالة\n'
        : 'Tx ID,Date,License Description,Beneficiary,Custodian,Branch,Brand,GL Code,Amount (KWD),Doc Ref,Status\n'
      ODOO_TOP_SANAD_LICENSES_TRANSACTIONS.forEach((t) => {
        csvContent += `"${t.id}","${t.date}","${isAr ? t.descAr : t.descEn}","${isAr ? t.beneficiaryAr : t.beneficiaryEn}","${isAr ? t.custodianAr : t.custodianEn}","${isAr ? t.branchAr : t.branchEn}","${isAr ? t.brandAr : t.brandEn}","${t.accountCode}","${t.amountKwd.toFixed(3)}","${t.docRef}","${isAr ? t.statusAr : t.statusEn}"\n`
      })
    } else {
      csvContent += isAr
        ? 'رقم السند,التاريخ,المسؤول,طبيعة الصيانة والبيان,الموقع / مركز التكلفة,الفرع,البراند,رمز الحساب,المبلغ (د.ك),المستند,الحالة\n'
        : 'Voucher ID,Date,Custodian,Maintenance Description,Location / Cost Center,Branch,Brand,Account Code,Amount (KWD),Doc Ref,Status\n'
      ODOO_RABIH_MAINTENANCE_DETAILS.forEach((t) => {
        csvContent += `"${t.id}","${t.date}","${isAr ? t.custodianAr : t.custodianEn}","${isAr ? t.descAr : t.descEn}","${isAr ? t.costCenterAr : t.costCenterEn}","${isAr ? t.branchAr : t.branchEn}","${isAr ? t.brandAr : t.brandEn}","${t.accountCode}","${t.amountKwd.toFixed(3)}","${t.docRef}","${isAr ? t.statusAr : t.statusEn}"\n`
      })
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `VentureFoods_Odoo_Expenses_${pettySubTab}_2026.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast(isAr ? 'تم تصدير كشف الحساب بنجاح إلى ملف إكسل' : 'Statement exported successfully to CSV')
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="w-full max-w-none text-slate-100 space-y-6 font-sans"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
              <Landmark size={14} />
              {isAr ? 'المحاسبة والمالية والتدقيق المالي الشامل' : 'Corporate Finance & General Ledger'}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
              {isAr ? 'فنتشر فودز ذ.م.م. (820 حساباً بأودو)' : 'Venture Foods W.L.L. (820 Odoo Accounts)'}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
            {isAr ? 'مركز القيادة المالي ومراكز تكلفة البراندات والفروع' : 'Financial Command Center & Multi-Brand P&L'}
          </h1>
          <p className="text-xs text-slate-400">
            {isAr
              ? 'ميزان المراجعة الموحد، تسويات بنك الكويت الوطني KNET، العهد النقدية، ومخصصات نهاية الخدمة'
              : 'Managing P&L cost centers, NBK & K-Net reconciliations, petty cash, and Odoo general ledger'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewEntryModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10"
          >
            <Plus size={15} />
            {isAr ? 'قيد يومية جديد' : 'New Journal Entry'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-3 text-xs font-semibold text-emerald-300 shadow-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Specialized Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3">
        {[
          { key: 'odooAnalytics', labelAr: '🧠 المحلل الإحصائي ورادار انحرافات العهد ومصروفات أودو (باريتو 80/20)', labelEn: 'Odoo Statistical Analyzer & Custody Radar', icon: TrendingUp },
          { key: 'pnl', labelAr: '📊 قائمة الدخل ومراكز تكلفة البراندات الـ 6 المعتمدة', labelEn: 'Brand P&L Cost Centers', icon: FileSpreadsheet },
          { key: 'fourWall', labelAr: '📋 قائمة الدخل المعيارية للفرع والبراند (تحليل الربحية الأربعة)', labelEn: 'Four-Wall Store P&L Benchmark', icon: Store },
          { key: 'coa4d', labelAr: '🗂️ شجرة الحسابات القياسية المعتمدة (1000–8300 بدقة الفلس الكويتي)', labelEn: 'Kuwait 4D COA (1000–8300)', icon: Scale },
          { key: 'amcHub', labelAr: '🛠️ بوابة رقابة عقود الصيانة الدورية ومكافحة الحشرات ومداخن المطابخ', labelEn: 'AMC Contracts Hub & SLA Gate', icon: ShieldCheck },
          { key: 'expiryRadar', labelAr: '⏳ مخصص المصروفات المدفوعة مقدماً وإطفاؤها الشهري (1146)', labelEn: 'Prepaid Expenses & Expiry Radar', icon: Calendar },
          { key: 'hrBridge', labelAr: '👥 جسر الربط المالي وإقفال الرواتب ومخصص نهاية الخدمة', labelEn: '7-Way HR ↔ Finance ↔ Ops Bridge', icon: ArrowRightLeft },
          { key: 'transitRecon', labelAr: '🚚 حساب البضاعة بالطريق بين المطبخ المركزي والفروع وتحويلات المطبخ المركزي (1139)', labelEn: 'Transit & Platform Settlement (1139)', icon: Truck },
          { key: 'banking', labelAr: '🏦 حسابات التسوية الوسيطة (كي نت 1121 ومنصات التوصيل 1123–1125)', labelEn: 'NBK Accounts & K-Net Recon', icon: Landmark },
          { key: 'pettyCash', labelAr: '🏛️ مركز تدقيق كشوف وإصدار شيكات مكتب التعقيب الحكومي (سند)', labelEn: 'PRO Government Clearance & Sanad Hub', icon: Wallet },
          { key: 'journals', labelAr: '📒 دفتر اليومية وقيد السندات البنكية وإصدار الشيكات', labelEn: 'Journal Entries & Bank Vouchers', icon: BookOpen },
          { key: 'chart', labelAr: '📑 ميزان المراجعة ودليل الحسابات (820 حساباً بأودو)', labelEn: 'Trial Balance & Chart of Accounts', icon: Scale },
          { key: 'aging', labelAr: '🧾 الذمم المدينة والدائنة ومخصصات نهاية الخدمة (المادة 51)', labelEn: 'AR/AP Aging & EOSB Provisions', icon: Receipt },
          { key: 'glBridge', labelAr: '🔗 الدورة المالية والقيود التلقائية المترابطة (نقطة البيع والمطبخ والمخزون)', labelEn: 'Automated GL Bridge (Field Ops)', icon: ArrowRightLeft },
          { key: 'eventsFinance', labelAr: '🎪 مالية المعارض والمخيمات وفعاليات البراندات', labelEn: 'Events & Camps Financials', icon: Store },
          { key: 'leases', labelAr: '🏢 سجل الإيجارات وعقود فروع ومطابخ وسكن الشركة', labelEn: 'Leases, Branches, Housing & Rent Burden', icon: Building2 },
          { key: 'fleet', labelAr: '🚗 سجل أصول الشركة، الصيانة، الوقود، ومخالفات السائقين المرتبطة بالإقامة', labelEn: 'Fleet, Garage Repairs, Fuel & Driver Fines', icon: Truck },
          ...(liveChildren ? [{ key: 'legacy', labelAr: '⚙️ مراجعة القيود المحاسبية وحالة مزامنة قاعدة البيانات', labelEn: 'Database Ledger Queries', icon: Building2 }] : []),
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                active
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <Icon size={15} />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
            </button>
          )
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 0: ODOO STATISTICAL ANALYZER & CUSTODY RADAR (PARETO 80/20)           */}
      {/* ========================================================================= */}
      {activeTab === 'odooAnalytics' && (
        <OdooAccountingAnalyticsHub isAr={isAr} locale={currentLocale} />
      )}

      {/* ========================================================================= */}
      {/* TAB 1: BRAND & BRANCH P&L COST CENTERS                                    */}
      {/* ========================================================================= */}
      {activeTab === 'pnl' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'إيرادات المبيعات (أكتوبر 2026)' : 'October 2026 Sales'}</span>
              <p className="mt-1 text-2xl font-black text-amber-400">167,092.000 {isAr ? 'د.ك' : 'KWD'}</p>
              <span className="text-xs text-slate-500">{isAr ? '30,543 طلباً معتمداً' : '30,543 orders'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'تكلفة الأغذية والمواد التموينية والتعبئة' : 'Food Cost (COGS)'}</span>
              <p className="mt-1 text-2xl font-black text-rose-400">52,634.000 {isAr ? 'د.ك' : 'KWD'}</p>
              <span className="text-xs text-slate-500">{isAr ? '31.5% نسبة تكلفة الغذاء' : '31.5% of revenue'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'مجمل الربح الإجمالي' : 'Gross Profit'}</span>
              <p className="mt-1 text-2xl font-black text-emerald-400">114,458.000 {isAr ? 'د.ك' : 'KWD'}</p>
              <span className="text-xs text-slate-500">{isAr ? '68.5% هامش إجمالي' : '68.5% gross margin'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'صافي الربح التشغيلي قبل الإهلاك' : 'Operating EBITDA'}</span>
              <p className="mt-1 text-2xl font-black text-cyan-400">38,410.000 {isAr ? 'د.ك' : 'KWD'}</p>
              <span className="text-xs text-slate-500">{isAr ? '23.0% عائد تشغيلي صافي' : '23.0% net margin'}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'مركز التكلفة / العلامة التجارية' : 'Cost Center / Brand'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الإيراد الإجمالي' : 'Revenue (KWD)'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'تكلفة الأغذية والخامات' : 'Food Cost'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الرواتب والأجور المعتمدة (حماية الأجور)' : 'Labor OPEX'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'عمولات منصات التوصيل' : 'Commissions'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الإيجارات ومرافق الفروع' : 'Rent & Utilities'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'صافي الربح التشغيلي (د.ك)' : 'Net Profit'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { center: isAr ? 'تشاينا جاردن' : 'China Garden', rev: '141,662.650', cogs: '43,915.000', labor: '36,830.000', comm: '15,580.000', rent: '12,500.000', net: '32,837.650' },
                    { center: isAr ? 'فرانكس' : "Frank's", rev: '16,222.260', cogs: '5,028.900', labor: '4,217.000', comm: '1,784.000', rent: '1,500.000', net: '3,692.360' },
                    { center: isAr ? 'شاورما طحينة' : 'Tahina', rev: '4,424.850', cogs: '1,371.700', labor: '1,150.000', comm: '486.000', rent: '400.000', net: '1,017.150' },
                    { center: isAr ? 'فارم براون' : 'Farm Brown', rev: '2,661.900', cogs: '825.000', labor: '750.000', comm: '290.000', rent: '300.000', net: '496.900' },
                    { center: isAr ? 'ذا نودل بار' : 'The Noodle Bar', rev: '1,676.950', cogs: '520.000', labor: '500.000', comm: '184.000', rent: '200.000', net: '272.950' },
                    { center: isAr ? 'كرك كافتيريا' : 'Karak Cafeteria', rev: '443.550', cogs: '110.000', labor: '150.000', comm: '48.000', rent: '50.000', net: '85.550' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{row.center}</td>
                      <td className="px-4 py-3 font-mono font-bold text-amber-300 text-right">{row.rev}</td>
                      <td className="px-4 py-3 font-mono text-rose-400 text-right">{row.cogs}</td>
                      <td className="px-4 py-3 font-mono text-slate-300 text-right">{row.labor}</td>
                      <td className="px-4 py-3 font-mono text-slate-400 text-right">{row.comm}</td>
                      <td className="px-4 py-3 font-mono text-slate-400 text-right">{row.rent}</td>
                      <td className={`px-4 py-3 font-mono font-bold text-right ${
                        row.net.startsWith('-') ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        {row.net} د.ك
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
      {/* KUWAIT 4D COA & MASTER BRIDGE SUBVIEWS                                    */}
      {/* ========================================================================= */}
      {activeTab === 'fourWall' && <KuwaitCoaBridgeView isAr={isAr} activeSubView="fourWallPnl" />}
      {activeTab === 'coa4d' && <KuwaitCoaBridgeView isAr={isAr} activeSubView="coa4d" />}
      {activeTab === 'amcHub' && <KuwaitCoaBridgeView isAr={isAr} activeSubView="amcHub" />}
      {activeTab === 'expiryRadar' && <KuwaitCoaBridgeView isAr={isAr} activeSubView="expiryRadar" />}
      {activeTab === 'hrBridge' && <KuwaitCoaBridgeView isAr={isAr} activeSubView="hrBridge" />}
      {activeTab === 'transitRecon' && <KuwaitCoaBridgeView isAr={isAr} activeSubView="transitRecon" />}

      {/* ========================================================================= */}
      {/* TAB 2: BANKING & K-NET / AGGREGATOR RECON                                  */}
      {/* ========================================================================= */}
      {activeTab === 'banking' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'حسابات البنوك الرسمية وتسوية مدفوعات كي نت وتطبيقات التوصيل' : 'Official Bank Accounts & K-NET / Platform Settlement'}
            </h3>
            <span className="text-xs text-emerald-400 font-semibold">
              {isAr ? 'رصيد النقدية والبنوك: 142,850.000 د.ك' : 'Total Bank & Cash Balances: 142,850 KWD'}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* NBK Account */}
            <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                  الحساب التشغيلي الرئيسي (Operating)
                </span>
                <span className="text-xs font-mono text-slate-400">NBK - 0012345678</span>
              </div>
              <h4 className="text-lg font-black text-white">بنك الكويت الوطني (National Bank of Kuwait)</h4>
              <p className="text-xs text-slate-400">يستقبل إيداعات K-NET، تسويات طلبات ودليفرو وكيتا، والدفعات المباشرة</p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">الرصيد الدفتري المطابق:</span>
                <span className="text-xl font-black text-emerald-400 font-mono">94,250.000 د.ك</span>
              </div>
            </div>

            {/* CBK Account */}
            <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-400 border border-blue-500/20">
                  حساب حماية الأجور (WPS Payroll)
                </span>
                <span className="text-xs font-mono text-slate-400">CBK - 0098765432</span>
              </div>
              <h4 className="text-lg font-black text-white">البنك التجاري الكويتي (Commercial Bank)</h4>
              <p className="text-xs text-slate-400">مخصص لمسير رواتب 166 موظفاً وتحويلات وزارة الشؤون والقوى العاملة</p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">الرصيد الدفتري المطابق:</span>
                <span className="text-xl font-black text-blue-400 font-mono">48,600.000 د.ك</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BRANCH & PRO PETTY CASH & REAL ODOO EXPENSES (51,154.950 KWD)       */}
      {/* ========================================================================= */}
      {activeTab === 'pettyCash' && (() => {
        const query = pettySearch.trim().toLowerCase()

        const filteredCategories = ODOO_EXPENSE_CATEGORIES_25.filter((cat) => {
          if (!query) return true
          return (
            cat.nameAr.toLowerCase().includes(query) ||
            cat.nameEn.toLowerCase().includes(query) ||
            cat.tagAr.toLowerCase().includes(query) ||
            cat.tagEn.toLowerCase().includes(query) ||
            cat.accountCode.toLowerCase().includes(query)
          )
        })

        const filteredCustodians = ODOO_CUSTODIANS_7.filter((cust) => {
          if (!query) return true
          return (
            cust.nameAr.toLowerCase().includes(query) ||
            cust.nameEn.toLowerCase().includes(query) ||
            cust.roleAr.toLowerCase().includes(query) ||
            cust.roleEn.toLowerCase().includes(query) ||
            cust.accountCode.toLowerCase().includes(query)
          )
        })

        const filteredSanad = ODOO_SANAD_STATEMENT_DETAILS.filter((item) => {
          if (!query) return true
          return (
            item.id.toLowerCase().includes(query) ||
            (item.badgeId && item.badgeId.toLowerCase().includes(query)) ||
            (item.employeeNameAr && item.employeeNameAr.toLowerCase().includes(query)) ||
            (item.employeeNameEn && item.employeeNameEn.toLowerCase().includes(query)) ||
            item.descAr.toLowerCase().includes(query) ||
            item.descEn.toLowerCase().includes(query) ||
            item.costCenterAr.toLowerCase().includes(query) ||
            item.costCenterEn.toLowerCase().includes(query) ||
            item.docRef.toLowerCase().includes(query) ||
            item.branchAr.toLowerCase().includes(query) ||
            item.brandAr.toLowerCase().includes(query)
          )
        })

        const filteredRabih = ODOO_RABIH_MAINTENANCE_DETAILS.filter((item) => {
          if (!query) return true
          return (
            item.id.toLowerCase().includes(query) ||
            item.descAr.toLowerCase().includes(query) ||
            item.descEn.toLowerCase().includes(query) ||
            item.costCenterAr.toLowerCase().includes(query) ||
            item.costCenterEn.toLowerCase().includes(query) ||
            item.docRef.toLowerCase().includes(query) ||
            item.branchAr.toLowerCase().includes(query) ||
            item.brandAr.toLowerCase().includes(query)
          )
        })

        const filteredTopLicenses = ODOO_TOP_SANAD_LICENSES_TRANSACTIONS.filter((item) => {
          if (!query) return true
          return (
            item.id.toLowerCase().includes(query) ||
            item.descAr.toLowerCase().includes(query) ||
            item.descEn.toLowerCase().includes(query) ||
            item.beneficiaryAr.toLowerCase().includes(query) ||
            item.beneficiaryEn.toLowerCase().includes(query) ||
            item.branchAr.toLowerCase().includes(query) ||
            item.branchEn.toLowerCase().includes(query) ||
            item.brandAr.toLowerCase().includes(query) ||
            item.brandEn.toLowerCase().includes(query) ||
            item.docRef.toLowerCase().includes(query) ||
            item.accountCode.toLowerCase().includes(query)
          )
        })

        const filteredExpenseSheets = expenseSheetReports.filter((sheet) => {
          if (selectedExpenseCustodian !== 'ALL' && sheet.custodianId !== selectedExpenseCustodian) {
            return false
          }
          if (!query) return true
          return (
            sheet.reportNo.toLowerCase().includes(query) ||
            sheet.custodianNameAr.toLowerCase().includes(query) ||
            sheet.custodianNameEn.toLowerCase().includes(query) ||
            sheet.titleAr.toLowerCase().includes(query) ||
            sheet.titleEn.toLowerCase().includes(query) ||
            sheet.descriptionAr.toLowerCase().includes(query) ||
            sheet.descriptionEn.toLowerCase().includes(query) ||
            sheet.costCenterAr.toLowerCase().includes(query) ||
            sheet.costCenterEn.toLowerCase().includes(query) ||
            sheet.brandAr.toLowerCase().includes(query) ||
            sheet.brandEn.toLowerCase().includes(query) ||
            sheet.accountCode.toLowerCase().includes(query)
          )
        })

        return (
          <div className="space-y-6">
            {/* Header & Badges */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                    <Wallet size={14} />
                    {isAr ? 'كشوف المصروفات والعهد المدققة من نظام أودو الرسمي' : 'Audited Odoo hr.expense Official Ledger'}
                  </span>
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
                    {isAr ? '2,213 معاملة مدققة ومرحلة' : '2,213 Audited Transactions'}
                  </span>
                </div>
                <h3 className="mt-1 text-xl font-black text-white">
                  {isAr
                    ? 'أعمال التعقيب الحكومي وكشوف مصروفات (سند) والعهد التشغيلية والصيانة'
                    : 'PRO Government Clearance, Sanad Statement & Operational Custody Hub'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isAr
                    ? 'مطابقة بيانات شاشة المصروفات الفعلية لشركة فنتشر فودز (51,154.950 د.ك) عبر 25 فئة و7 أصحاب عهد'
                    : 'Reconciled actual Odoo hr.expense data for Venture Foods (51,154.950 KWD) across 25 categories and 7 custodians'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPettyCsv}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-850 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 transition-all"
                >
                  <Download size={14} />
                  {isAr ? 'تصدير الكشف (إكسل)' : 'Export Statement (CSV)'}
                </button>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-1">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  {isAr ? 'إجمالي المصروفات المدققة' : 'Total Audited OPEX'}
                </span>
                <p className="text-xl font-black text-white font-mono">51,154.950 {isAr ? 'د.ك' : 'KWD'}</p>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{isAr ? '2,213 معاملة' : '2,213 Txns'}</span>
                  <span className="text-emerald-400 font-bold">100%</span>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-4 space-y-1">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  {isAr ? 'كشوفات (سند) للتعقيب والإقامات' : 'Sanad PRO Clearance'}
                </span>
                <p className="text-xl font-black text-white font-mono">31,646.750 {isAr ? 'د.ك' : 'KWD'}</p>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{isAr ? '844 معاملة' : '844 Txns'}</span>
                  <span className="text-blue-400 font-bold">61.86%</span>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-1">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  {isAr ? 'صيانة المطابخ والفروع (ربيع طه)' : 'Kitchen Maintenance (Rabih)'}
                </span>
                <p className="text-xl font-black text-white font-mono">10,899.720 {isAr ? 'د.ك' : 'KWD'}</p>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{isAr ? '538 معاملة' : '538 Txns'}</span>
                  <span className="text-amber-400 font-bold">21.31%</span>
                </div>
              </div>

              <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-1">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                  {isAr ? 'الموارد البشرية والإدارية (شيام)' : 'HR & Admin (Shyam)'}
                </span>
                <p className="text-xl font-black text-white font-mono">7,053.980 {isAr ? 'د.ك' : 'KWD'}</p>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{isAr ? '713 معاملة' : '713 Txns'}</span>
                  <span className="text-purple-400 font-bold">13.79%</span>
                </div>
              </div>

              <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 space-y-1 col-span-2 sm:col-span-1">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                  {isAr ? 'المرور والتراخيص والمطافئ (أمجد)' : 'Traffic & Licensing (Amjad)'}
                </span>
                <p className="text-xl font-black text-white font-mono">1,389.000 {isAr ? 'د.ك' : 'KWD'}</p>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{isAr ? '92 معاملة' : '92 Txns'}</span>
                  <span className="text-rose-400 font-bold">2.72%</span>
                </div>
              </div>
            </div>

            {/* Sub-Tabs Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    key: 'expenseSheets' as const,
                    labelAr: '📑 تقارير تصفية العهد والمصروفات (All Reports)',
                    labelEn: 'Expense Reports Sheets (All Reports)',
                    count: expenseSheetReports.length,
                  },
                  {
                    key: 'categories' as const,
                    labelAr: '📊 فئات المصروفات الـ 25 (51,154.950 د.ك)',
                    labelEn: '25 Expense Categories (51,154.950 KWD)',
                    count: 25,
                  },
                  {
                    key: 'custodians' as const,
                    labelAr: '👥 أصحاب العهد الفعليين وكشوف الحسابات',
                    labelEn: 'Real Custodians Ledgers',
                    count: ODOO_CUSTODIANS_7.length,
                  },
                  {
                    key: 'sanad' as const,
                    labelAr: '🏛️ كشف (سند) للتعقيب وبصمات الإقامات',
                    labelEn: 'Sanad PRO Gov Clearance & Staff Badges',
                    count: ODOO_SANAD_STATEMENT_DETAILS.length,
                  },
                  {
                    key: 'topLicenses' as const,
                    labelAr: '🏛️ كبار معاملات التراخيص والإعلانات عبر (سند)',
                    labelEn: 'Top Sanad Permits & Ads Clearances',
                    count: ODOO_TOP_SANAD_LICENSES_TRANSACTIONS.length,
                  },
                  {
                    key: 'rabih' as const,
                    labelAr: '🛠️ صيانة المطابخ والفروع ومخيم السفير (ربيع طه)',
                    labelEn: 'Kitchen & Safir Camp Maintenance (Rabih)',
                    count: ODOO_RABIH_MAINTENANCE_DETAILS.length,
                  },
                ].map((st) => {
                  const active = pettySubTab === st.key
                  return (
                    <button
                      key={st.key}
                      onClick={() => setPettySubTab(st.key)}
                      className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                        active
                          ? 'bg-slate-100 text-black shadow-lg shadow-white/10'
                          : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      <span>{isAr ? st.labelAr : st.labelEn}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-mono ${
                        active ? 'bg-slate-300 text-black' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {st.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={pettySearch}
                  onChange={(e) => setPettySearch(e.target.value)}
                  placeholder={
                    isAr
                      ? 'بحث بالاسم، البصمة، الفرع، أو الحساب...'
                      : 'Search by name, badge, branch or account...'
                  }
                  className="w-full rounded-xl border border-slate-800 bg-[#0d131f] py-2 pr-9 pl-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SUB-VIEW 0: ODOO HR.EXPENSE.SHEET (ALL REPORTS — APPROVAL VS PAYMENT)     */}
            {/* ========================================================================= */}
            {pettySubTab === 'expenseSheets' && (() => {
              const eligibleForPayment = filteredExpenseSheets.filter(
                (s) => s.adminApproval === 'approved' && s.paymentStatus === 'not_paid'
              )
              const isAllSelected =
                eligibleForPayment.length > 0 &&
                eligibleForPayment.every((s) => selectedSheetIds.includes(s.id))

              const handleSelectAll = () => {
                if (isAllSelected) {
                  setSelectedSheetIds([])
                } else {
                  setSelectedSheetIds(eligibleForPayment.map((s) => s.id))
                }
              }

              const handleToggleSheet = (id: string) => {
                setSelectedSheetIds((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                )
              }

              const totalFilteredKwd = filteredExpenseSheets.reduce((s, r) => s + r.amountKwd, 0)
              const approvedKwd = filteredExpenseSheets
                .filter((r) => r.adminApproval === 'approved')
                .reduce((s, r) => s + r.amountKwd, 0)
              const unpaidKwd = filteredExpenseSheets
                .filter((r) => r.paymentStatus === 'not_paid')
                .reduce((s, r) => s + r.amountKwd, 0)
              const paidKwd = filteredExpenseSheets
                .filter((r) => r.paymentStatus === 'paid')
                .reduce((s, r) => s + r.amountKwd, 0)

              const activeCustodianInfo = ODOO_EXPENSE_SHEET_CUSTODIANS.find(
                (c) => c.id === selectedExpenseCustodian
              )

              return (
                <div className="space-y-6">
                  {/* Executive KPI Summary Bar */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-[#0d131f] p-4 space-y-1">
                      <span className="text-xs font-bold text-slate-400">
                        {isAr ? 'إجمالي تقارير التصفية المرفوعة' : 'Total Expense Sheets'}
                      </span>
                      <p className="text-xl font-black text-white font-mono">
                        {totalFilteredKwd.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                        <span>{filteredExpenseSheets.length} {isAr ? 'تقارير' : 'reports'}</span>
                        <span className="text-emerald-400 font-bold">100%</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4 space-y-1">
                      <span className="text-xs font-bold text-emerald-300">
                        {isAr ? '🟢 معتمد إدارياً (جاهز للصرف)' : '🟢 Approved (Ready to Pay)'}
                      </span>
                      <p className="text-xl font-black text-emerald-400 font-mono">
                        {approvedKwd.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{filteredExpenseSheets.filter((r) => r.adminApproval === 'approved').length} {isAr ? 'معتمد' : 'Approved'}</span>
                        <span className="text-emerald-400 font-bold">
                          {totalFilteredKwd > 0 ? ((approvedKwd / totalFilteredKwd) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-rose-500/20 bg-rose-950/20 p-4 space-y-1">
                      <span className="text-xs font-bold text-rose-300">
                        {isAr ? '🔴 غير مدفوع — بانتظار الشيك' : '🔴 Not Paid — Pending Cheque'}
                      </span>
                      <p className="text-xl font-black text-rose-400 font-mono">
                        {unpaidKwd.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{filteredExpenseSheets.filter((r) => r.paymentStatus === 'not_paid').length} {isAr ? 'بانتظار الصرف' : 'Unpaid'}</span>
                        <span className="text-rose-400 font-bold">
                          {totalFilteredKwd > 0 ? ((unpaidKwd / totalFilteredKwd) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-4 space-y-1">
                      <span className="text-xs font-bold text-blue-300">
                        {isAr ? '🟢 تم الدفع وإصدار الشيك' : '🟢 Paid & Cheque Issued'}
                      </span>
                      <p className="text-xl font-black text-blue-400 font-mono">
                        {paidKwd.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{filteredExpenseSheets.filter((r) => r.paymentStatus === 'paid').length} {isAr ? 'شيكات مسددة' : 'Paid'}</span>
                        <span className="text-blue-400 font-bold">
                          {totalFilteredKwd > 0 ? ((paidKwd / totalFilteredKwd) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Main Master Layout: Custodian Sidebar Filter + Reports Table */}
                  <div className="flex flex-col lg:flex-row gap-5 items-start">
                    {/* SIDEBAR FILTER: 8/9 REAL CUSTODIANS & REPRESENTATIVES */}
                    <aside className="w-full lg:w-72 xl:w-80 shrink-0 space-y-3">
                      <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-4 space-y-3 shadow-lg">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                          <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                            <span>👥</span>
                            <span>{isAr ? 'أصحاب العهد والمندوبون (أودو)' : 'Custodians & Representatives'}</span>
                          </h4>
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-400">
                            {ODOO_EXPENSE_SHEET_CUSTODIANS.length - 1} {isAr ? 'أصحاب عهد' : 'Custodians'}
                          </span>
                        </div>

                        <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
                          {ODOO_EXPENSE_SHEET_CUSTODIANS.map((cust) => {
                            const isSelected = selectedExpenseCustodian === cust.id
                            const stats =
                              cust.id === 'ALL'
                                ? {
                                    count: expenseSheetReports.length,
                                    total: expenseSheetReports.reduce((s, r) => s + r.amountKwd, 0),
                                  }
                                : {
                                    count: expenseSheetReports.filter((r) => r.custodianId === cust.id).length,
                                    total: expenseSheetReports
                                      .filter((r) => r.custodianId === cust.id)
                                      .reduce((s, r) => s + r.amountKwd, 0),
                                  }

                            return (
                              <button
                                key={cust.id}
                                type="button"
                                onClick={() => {
                                  setSelectedExpenseCustodian(cust.id)
                                  setSelectedSheetIds([])
                                }}
                                className={`w-full flex flex-col p-2.5 rounded-xl text-xs transition-all text-start border ${
                                  isSelected
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 font-bold shadow-md'
                                    : 'border-slate-800/80 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-black text-white text-xs truncate">
                                    {isAr ? cust.nameAr : cust.nameEn}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-xs font-mono shrink-0 font-bold ${
                                      isSelected
                                        ? 'bg-amber-400 text-black'
                                        : 'bg-slate-800 text-slate-300'
                                    }`}
                                  >
                                    {stats.count}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-xs text-slate-400 w-full">
                                  <span className="truncate max-w-[170px]">
                                    {isAr ? cust.roleAr : cust.roleEn}
                                  </span>
                                  <span className="font-mono font-bold text-emerald-400 shrink-0">
                                    {stats.total.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </aside>

                    {/* MAIN CONTENT AREA: BATCH PAYMENT ACTION BAR & TABLE */}
                    <div className="flex-1 w-full space-y-4">
                      {/* Top Action & Batch Cheque Issuance Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d131f] p-4 rounded-2xl border border-slate-800">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={handleSelectAll}
                            className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700"
                          >
                            {isAllSelected
                              ? isAr
                                ? 'إلغاء تحديد الكل'
                                : 'Deselect All'
                              : isAr
                              ? `تحديد المعتمد للصرف (${eligibleForPayment.length})`
                              : `Select All Approved (${eligibleForPayment.length})`}
                          </button>

                          {selectedSheetIds.length > 0 && (
                            <span className="text-xs text-amber-300 font-bold">
                              {isAr
                                ? `تم تحديد ${selectedSheetIds.length} تقارير بقيمة ${filteredExpenseSheets
                                    .filter((s) => selectedSheetIds.includes(s.id))
                                    .reduce((acc, s) => acc + s.amountKwd, 0)
                                    .toFixed(3)} د.ك`
                                : `Selected ${selectedSheetIds.length} reports (${filteredExpenseSheets
                                    .filter((s) => selectedSheetIds.includes(s.id))
                                    .reduce((acc, s) => acc + s.amountKwd, 0)
                                    .toFixed(3)} KWD)`}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Button 1: New Single Expense */}
                          <button
                            type="button"
                            onClick={() => setShowSingleExpenseModal(true)}
                            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-black text-emerald-400 hover:bg-emerald-500/20 shadow-sm transition-all"
                          >
                            <Plus size={14} />
                            <span>{isAr ? '➕ تسجيل مصروف فردي جديد' : '➕ New Single Expense'}</span>
                          </button>

                          {/* Button 2: New Expense Report Sheet */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSheetForModal(null)
                              setShowExpenseSheetModal(true)
                            }}
                            className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-black text-amber-300 hover:bg-amber-500/20 shadow-sm transition-all"
                          >
                            <FileSpreadsheet size={14} />
                            <span>{isAr ? '📑 إنشاء تقرير كشف مجمع' : '📑 New Expense Report Sheet'}</span>
                          </button>

                          {/* Batch Cheque Issuance Trigger Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedSheetIds.length === 0 && eligibleForPayment.length > 0) {
                                setSelectedSheetIds(eligibleForPayment.map((s) => s.id))
                              }
                              setShowChequeModal(true)
                            }}
                            className="flex items-center gap-2 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-emerald-950/50 hover:brightness-110 transition-all"
                          >
                            <CreditCard size={15} />
                            <span>
                              {isAr
                                ? `🏦 إصدار شيك سداد للتقارير المعتمدة`
                                : `🏦 Issue Payment Cheque for Approved Reports`}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Expense Reports Sheet Table */}
                      <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-300 font-bold uppercase tracking-wider">
                                <th className="px-3 py-3 text-center w-10">
                                  <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={handleSelectAll}
                                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 cursor-pointer"
                                  />
                                </th>
                                <th className="px-3 py-3 text-right">{isAr ? 'رقم التقرير والتاريخ' : 'Report No & Date'}</th>
                                <th className="px-3 py-3 text-right">{isAr ? 'صاحب العهدة / الموظف' : 'Custodian / Employee'}</th>
                                <th className="px-4 py-3 text-right">{isAr ? 'بيان التقرير التفصيلي والأعمال المنفذة' : 'Report Description & Works'}</th>
                                <th className="px-3 py-3 text-center">{isAr ? 'مركز التكلفة (الفرع / المقر)' : 'Cost Center'}</th>
                                <th className="px-3 py-3 text-center">{isAr ? 'العلامة التجارية' : 'Brand'}</th>
                                <th className="px-3 py-3 text-right">{isAr ? 'الإجمالي (د.ك)' : 'Total (KWD)'}</th>
                                <th className="px-3 py-3 text-center">{isAr ? 'الاعتماد الإداري' : 'Admin Approval'}</th>
                                <th className="px-4 py-3 text-center">{isAr ? 'حالة السداد المالي' : 'Payment Status'}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-slate-200">
                              {filteredExpenseSheets.map((sheet) => {
                                const isSelected = selectedSheetIds.includes(sheet.id)
                                const isPaid = sheet.paymentStatus === 'paid'
                                const isApproved = sheet.adminApproval === 'approved'

                                return (
                                  <tr
                                    key={sheet.id}
                                    className={`transition-colors hover:bg-slate-900/40 ${
                                      isSelected ? 'bg-emerald-950/20' : ''
                                    }`}
                                  >
                                    {/* Selection Checkbox */}
                                    <td className="px-3 py-3 text-center">
                                      <input
                                        type="checkbox"
                                        disabled={isPaid || !isApproved}
                                        checked={isSelected}
                                        onChange={() => handleToggleSheet(sheet.id)}
                                        className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 disabled:opacity-30 cursor-pointer"
                                      />
                                    </td>

                                    {/* Report No & Date */}
                                    <td className="px-3 py-3 font-mono">
                                      <span className="font-bold text-amber-300 block">{sheet.reportNo}</span>
                                      <span className="text-xs text-slate-500">{sheet.date}</span>
                                    </td>

                                    {/* Custodian Name */}
                                    <td className="px-3 py-3">
                                      <span className="font-bold text-white block">
                                        {isAr ? sheet.custodianNameAr : sheet.custodianNameEn}
                                      </span>
                                      <span className="text-xs text-slate-500 font-mono">
                                        {sheet.accountCode}
                                      </span>
                                    </td>

                                    {/* Description & Works */}
                                    <td className="px-4 py-3 max-w-md">
                                      <p className="font-bold text-white leading-tight">
                                        {isAr ? sheet.titleAr : sheet.titleEn}
                                      </p>
                                      <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                                        {isAr ? sheet.descriptionAr : sheet.descriptionEn}
                                      </p>
                                    </td>

                                    {/* Cost Center */}
                                    <td className="px-3 py-3 text-center">
                                      <span className="inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-200 border border-slate-700">
                                        {isAr ? sheet.costCenterAr : sheet.costCenterEn}
                                      </span>
                                    </td>

                                    {/* Brand */}
                                    <td className="px-3 py-3 text-center text-xs text-amber-300">
                                      {isAr ? sheet.brandAr : sheet.brandEn}
                                    </td>

                                    {/* Amount KWD */}
                                    <td className="px-3 py-3 text-right font-mono font-black text-emerald-400 text-sm">
                                      {sheet.amountKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                                    </td>

                                    {/* Admin Approval Status */}
                                    <td className="px-3 py-3 text-center">
                                      {sheet.adminApproval === 'approved' ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                                          <CheckCircle2 size={12} />
                                          {isAr ? '🟢 معتمد إدارياً' : 'Approved'}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-blue-400 border border-blue-500/20">
                                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                                          {isAr ? '🔵 مرسل للاعتماد' : 'Submitted'}
                                        </span>
                                      )}
                                    </td>

                                    {/* Financial Payment Status */}
                                    <td className="px-4 py-3 text-center">
                                      {sheet.paymentStatus === 'paid' ? (
                                        <div className="space-y-0.5">
                                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-black text-emerald-400 border border-emerald-500/30">
                                            <CheckCircle2 size={12} />
                                            {isAr ? '🟢 تم الدفع وإصدار الشيك' : 'Paid & Cheque Issued'}
                                          </span>
                                          {sheet.paymentChequeRef && (
                                            <span className="block text-xs font-mono text-slate-400">
                                              {sheet.paymentChequeRef} · {sheet.paymentDate}
                                            </span>
                                          )}
                                        </div>
                                      ) : sheet.paymentStatus === 'in_settlement' ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-black text-amber-400 border border-amber-500/30">
                                          <AlertTriangle size={12} />
                                          {isAr ? '🟠 قيد التسوية البنكية' : 'In Settlement'}
                                        </span>
                                      ) : (
                                        <div className="flex flex-col items-center gap-1">
                                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-black text-rose-400 border border-rose-500/30">
                                            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                                            {isAr ? '🔴 غير مدفوع — بانتظار إصدار الشيك' : 'Not Paid — Pending Cheque'}
                                          </span>
                                          {isApproved && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedSheetIds([sheet.id])
                                                setShowChequeModal(true)
                                              }}
                                              className="text-xs text-emerald-400 hover:underline font-bold"
                                            >
                                              {isAr ? 'صرف شيك الآن ↵' : 'Pay via Cheque ↵'}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot className="border-t-2 border-slate-700 bg-slate-900/90 font-bold text-white">
                              <tr>
                                <td colSpan={6} className="px-4 py-3 text-right uppercase tracking-wider text-slate-300">
                                  {isAr ? 'إجمالي تقارير التصفية الحالية المفلترة:' : 'Total Filtered Expense Reports:'}
                                </td>
                                <td className="px-3 py-3 text-right font-mono text-emerald-400 text-sm font-black">
                                  {totalFilteredKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                                </td>
                                <td colSpan={2} className="px-4 py-3 text-center text-xs text-slate-400 font-normal">
                                  {isAr
                                    ? `معتمد: ${approvedKwd.toFixed(3)} د.ك | غير مدفوع: ${unpaidKwd.toFixed(3)} د.ك | مسدد بشيك: ${paidKwd.toFixed(3)} د.ك`
                                    : `Approved: ${approvedKwd.toFixed(3)} | Unpaid: ${unpaidKwd.toFixed(3)} | Paid: ${paidKwd.toFixed(3)}`}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MODAL: BATCH CHEQUE ISSUANCE & COST CENTER POSTING */}
                  {showChequeModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                      <div className="w-full max-w-xl rounded-3xl border border-emerald-500/40 bg-[#0d131f] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CreditCard size={18} />
                            </span>
                            <div>
                              <h3 className="text-base font-black text-white">
                                {isAr ? 'إصدار شيك سداد مالي وترحيل محاسبي' : 'Issue Payment Cheque & Post to Ledger'}
                              </h3>
                              <p className="text-xs text-slate-400">
                                {isAr ? 'تحويل التقارير المعتمدة من غير مدفوع 🔴 إلى مدفوع 🟢' : 'Convert approved reports from Not Paid 🔴 to Paid 🟢'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowChequeModal(false)}
                            className="text-slate-400 hover:text-white text-sm"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="space-y-4 text-xs">
                          {/* Selected Reports Overview */}
                          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
                            <div className="flex items-center justify-between text-slate-300 font-bold">
                              <span>{isAr ? 'عدد التقارير المعتمدة المشمولة بالصرف:' : 'Approved Reports for Payment:'}</span>
                              <span className="text-white font-mono text-sm">
                                {selectedSheetIds.length > 0 ? selectedSheetIds.length : eligibleForPayment.length} {isAr ? 'تقارير' : 'reports'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-slate-300 font-bold border-t border-slate-800 pt-2">
                              <span>{isAr ? 'إجمالي قيمة الشيك الإجمالية:' : 'Total Cheque Amount:'}</span>
                              <span className="text-emerald-400 font-mono text-base font-black">
                                {(selectedSheetIds.length > 0
                                  ? filteredExpenseSheets.filter((s) => selectedSheetIds.includes(s.id))
                                  : eligibleForPayment
                                ).reduce((s, r) => s + r.amountKwd, 0).toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                              </span>
                            </div>
                          </div>

                          {/* Bank & Cheque Reference Inputs */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-400 block">
                                {isAr ? 'الحساب البنكي المسحوب عليه الشيك:' : 'Paying Bank Account:'}
                              </label>
                              <select
                                value={chequeBank}
                                onChange={(e) => setChequeBank(e.target.value as 'CBK' | 'NBK')}
                                className="w-full rounded-xl border border-slate-700 bg-slate-850 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                              >
                                <option value="CBK">{isAr ? 'البنك التجاري الكويتي (الحساب التشغيلي الرئيسي)' : 'Commercial Bank of Kuwait (CBK)'}</option>
                                <option value="NBK">{isAr ? 'بنك الكويت الوطني (نقاط بيع كي نت)' : 'National Bank of Kuwait (NBK)'}</option>
                              </select>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-400 block">
                                {isAr ? 'رقم الشيك / المرجع المصرفي:' : 'Cheque / Ref No:'}
                              </label>
                              <input
                                type="text"
                                value={chequeRef}
                                onChange={(e) => setChequeRef(e.target.value)}
                                placeholder="CHQ-2026-XXXX"
                                className="w-full rounded-xl border border-slate-700 bg-slate-850 px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Posting Note */}
                          <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-3 text-xs text-blue-300 leading-relaxed">
                            <span>ℹ️ </span>
                            {isAr
                              ? 'سيتم ترحيل قيد الصرف تلقائياً إلى دفتر اليومية المحاسبي وتحميل كل بند ومصروف على مركز تكلفة الفرع والبراند المعني فور اعتماد الشيك.'
                              : 'Journal entry will be posted automatically with each line allocated to its corresponding branch and brand cost center.'}
                          </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-3">
                          <button
                            type="button"
                            onClick={() => setShowChequeModal(false)}
                            className="rounded-xl border border-slate-700 bg-slate-850 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
                          >
                            {isAr ? 'إلغاء' : 'Cancel'}
                          </button>
                          <button
                            type="button"
                            onClick={handleBatchChequePayment}
                            className="rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 px-5 py-2 text-xs font-black text-white hover:brightness-110 shadow-lg shadow-emerald-950/50"
                          >
                            {isAr ? 'تأكيد إصدار الشيك والترحيل المحاسبي' : 'Confirm Cheque & Post Entry'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Odoo Single Expense Registration Modal */}
                  <OdooExpenseSingleModal
                    isOpen={showSingleExpenseModal}
                    onClose={() => setShowSingleExpenseModal(false)}
                    onSave={handleSaveNewExpense}
                  />

                  {/* Odoo Expense Report Sheet Modal */}
                  <OdooExpenseSheetModal
                    isOpen={showExpenseSheetModal}
                    onClose={() => {
                      setShowExpenseSheetModal(false)
                      setSelectedSheetForModal(null)
                    }}
                    onSave={handleSaveNewExpenseSheet}
                    existingSheet={selectedSheetForModal}
                  />
                </div>
              )
            })()}

            {/* SUB-VIEW 1: THE 25 AUDITED CATEGORIES */}
            {pettySubTab === 'categories' && (
              <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold text-slate-400">
                        <th className="px-4 py-3 text-center w-12">#</th>
                        <th className="px-4 py-3 text-right">{isAr ? 'فئة المصروف (أودو الرسمية)' : 'Odoo Expense Category'}</th>
                        <th className="px-4 py-3 text-center">{isAr ? 'رمز الحساب المحاسبي' : 'Account Code'}</th>
                        <th className="px-4 py-3 text-center">{isAr ? 'مركز التكلفة / الوسم' : 'Analytic Tag'}</th>
                        <th className="px-4 py-3 text-center">{isAr ? 'عدد الحركات' : 'Tx Count'}</th>
                        <th className="px-4 py-3 text-right">{isAr ? 'المبلغ الإجمالي (د.ك)' : 'Total Amount (KWD)'}</th>
                        <th className="px-4 py-3 text-center w-40">{isAr ? 'النسبة من الإجمالي %' : 'Share %'}</th>
                        <th className="px-4 py-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-200">
                      {filteredCategories.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="px-4 py-3 text-center font-mono text-xs text-slate-500">{c.rank}</td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-white block">{isAr ? c.nameAr : c.nameEn}</span>
                            <span className="text-xs text-slate-500">{isAr ? c.nameEn : c.nameAr}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-xs text-amber-300">
                            <span className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5">
                              {c.accountCode}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                              {isAr ? c.tagAr : c.tagEn}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-semibold text-slate-300">
                            {c.txCount.toLocaleString()} {isAr ? 'معاملة' : 'txns'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                            {c.amountKwd.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{ width: `${Math.min(100, c.pct * 3)}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono font-bold text-slate-300 w-12 text-left">
                                {c.pct.toFixed(2)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 size={12} />
                              {isAr ? 'مدققة ومرحلة' : 'Audited & Posted'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-700 bg-slate-900/80 font-bold text-white">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right text-xs uppercase tracking-wider text-slate-300">
                          {isAr ? 'الإجمالي العام المدقق (25 فئة مصروفات):' : 'Audited Grand Total (25 Categories):'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-amber-400">
                          {ODOO_EXPENSES_TOTAL_TX.toLocaleString()} {isAr ? 'معاملة' : 'txns'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400 text-base font-black">
                          {ODOO_EXPENSES_TOTAL_KWD.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-300">100.00%</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs text-emerald-300 border border-emerald-500/40">
                            {isAr ? 'مطابق 100%' : '100% Balanced'}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-VIEW 2: REAL CUSTODIANS & SETTLEMENT STATUS */}
            {pettySubTab === 'custodians' && (
              <div className="space-y-4">
                {/* Settlement Indicator Metrics Bar (Real Odoo 365 Days Status) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-[#0d131f] p-3.5 space-y-1">
                    <span className="text-xs font-bold text-slate-400">
                      {isAr ? 'إجمالي معاملات آخر 365 يوماً' : 'Total Txns (Last 365 Days)'}
                    </span>
                    <p className="text-xl font-black text-white font-mono">
                      {ODOO_SETTLEMENT_METRICS.txCount365.toLocaleString()} {isAr ? 'معاملة' : 'txns'}
                    </p>
                    <span className="text-xs text-emerald-400 font-semibold">
                      {isAr ? 'مدققة من شاشات أودو' : 'Audited via Odoo'}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-3.5 space-y-1">
                    <span className="text-xs font-bold text-amber-300">
                      {isAr ? 'بانتظار الرفع' : 'Pending Upload'}
                    </span>
                    <p className="text-xl font-black text-amber-400 font-mono">
                      {ODOO_SETTLEMENT_METRICS.pendingUploadKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                    </p>
                    <span className="text-xs text-slate-400">
                      {isAr ? 'فواتير قيد التجهيز' : 'Draft Invoices'}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-3.5 space-y-1">
                    <span className="text-xs font-bold text-blue-300">
                      {isAr ? 'بانتظار الاعتماد' : 'Pending Approval'}
                    </span>
                    <p className="text-xl font-black text-blue-400 font-mono">
                      {ODOO_SETTLEMENT_METRICS.pendingApprovalKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                    </p>
                    <span className="text-xs text-emerald-300 font-semibold">
                      {isAr ? 'صفر — تم اعتماد الكشوف' : '0.000 — 100% Approved'}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-3.5 space-y-1">
                    <span className="text-xs font-bold text-emerald-300">
                      {isAr ? 'مستحقة الصرف والشيكات' : 'Payable Cheques & Dues'}
                    </span>
                    <p className="text-xl font-black text-emerald-400 font-mono">
                      {ODOO_SETTLEMENT_METRICS.payableChequesKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                    </p>
                    <span className="text-xs text-emerald-400">
                      {isAr ? 'جاهزة لإصدار الشيكات' : 'Ready for Payment'}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold text-slate-400">
                          <th className="px-4 py-3 text-right">{isAr ? 'المسؤول / صاحب العهدة' : 'Custodian'}</th>
                          <th className="px-4 py-3 text-right">{isAr ? 'الدور التشغيلي / الغرض من العهدة' : 'Role / Purpose'}</th>
                          <th className="px-4 py-3 text-center">{isAr ? 'الحسابات المحاسبية المحملة' : 'Odoo Accounts'}</th>
                          <th className="px-4 py-3 text-center">{isAr ? 'عدد المعاملات' : 'Tx Count'}</th>
                          <th className="px-4 py-3 text-right">{isAr ? 'إجمالي المصروف (د.ك)' : 'Total Spent (KWD)'}</th>
                          <th className="px-4 py-3 text-center w-36">{isAr ? 'الحصة %' : 'Share %'}</th>
                          <th className="px-4 py-3 text-center">{isAr ? 'حالة الاعتماد' : 'Audit Status'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {filteredCustodians.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-bold text-white block">{isAr ? c.nameAr : c.nameEn}</span>
                              <span className="text-xs text-slate-500">{isAr ? c.nameEn : c.nameAr}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-300">
                              {isAr ? c.roleAr : c.roleEn}
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-xs text-amber-300">
                              <span className="rounded bg-slate-800 px-2 py-0.5 border border-slate-700">
                                {c.accountCode}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-semibold text-slate-300">
                              {c.txCount.toLocaleString()} {isAr ? 'معاملة' : 'txns'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                              {c.totalKwd.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-blue-500"
                                    style={{ width: `${Math.min(100, c.pct * 1.5)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono font-bold text-slate-300 w-12 text-left">
                                  {c.pct.toFixed(2)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 size={12} />
                                {isAr ? c.statusAr : c.statusEn}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-700 bg-slate-900/80 font-bold text-white">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-right text-xs uppercase tracking-wider text-slate-300">
                            {isAr ? `إجمالي كشوف العهد الفعلية (${filteredCustodians.length} أصحاب عهد):` : `Total Real Custodians (${filteredCustodians.length}):`}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-amber-400">
                            {filteredCustodians.reduce((s, c) => s + c.txCount, 0).toLocaleString()} {isAr ? 'معاملة' : 'txns'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-400 text-base font-black">
                            {filteredCustodians.reduce((s, c) => s + c.totalKwd, 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-slate-300">100.00%</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs text-emerald-300 border border-emerald-500/40">
                              {isAr ? 'مطابق 100%' : '100% Balanced'}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-VIEW 3: SANAD PRO STATEMENT DETAILS */}
            {pettySubTab === 'sanad' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                  <span>
                    {isAr
                      ? 'كشف معاملات سند للتعقيب والإقامات الحكومية — توثيق رسوم الضمان الصحي، الداخلية، القوى العاملة، البطاقة المدنية، والبلدية'
                      : 'Sanad Statement PRO Clearances — Audited breakdown for Health Insurance, MOI, PAM, PACI & Baladiya Cards'}
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">
                    31,646.750 {isAr ? 'د.ك' : 'KWD'} (844 {isAr ? 'معاملة' : 'txns'})
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold text-slate-400">
                          <th className="px-4 py-3 text-right">{isAr ? 'رقم الحركة والتاريخ' : 'Tx ID & Date'}</th>
                          <th className="px-4 py-3 text-right">{isAr ? 'رقم البصمة والموظف' : 'Badge ID & Employee'}</th>
                          <th className="px-4 py-3 text-right">{isAr ? 'بيان المعاملة الحكومية والرسوم الموثقة' : 'Clearance Breakdown & Scope'}</th>
                          <th className="px-4 py-3 text-center">{isAr ? 'مركز التكلفة المزدوج (الفرع | البراند)' : 'Dual Cost Center'}</th>
                          <th className="px-4 py-3 text-center">{isAr ? 'الحساب' : 'GL Code'}</th>
                          <th className="px-4 py-3 text-right">{isAr ? 'المبلغ (د.ك)' : 'Amount (KWD)'}</th>
                          <th className="px-4 py-3 text-center">{isAr ? 'رقم المستند' : 'Doc Ref'}</th>
                          <th className="px-4 py-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {filteredSanad.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-mono font-bold text-amber-400 block">{item.id}</span>
                              <span className="text-xs text-slate-500 font-mono">{item.date}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {item.badgeId && (
                                  <span className="font-mono font-bold text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                                    #{item.badgeId}
                                  </span>
                                )}
                                <div>
                                  <span className="font-bold text-white block text-xs">
                                    {isAr ? item.employeeNameAr : item.employeeNameEn}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {isAr ? item.employeeNameEn : item.employeeNameAr}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-300 max-w-md">
                              {isAr ? item.descAr : item.descEn}
                            </td>
                            <td className="px-4 py-3 text-center text-xs">
                              <span className="inline-flex rounded-full bg-slate-800/90 border border-slate-700 px-2.5 py-0.5 font-semibold text-slate-200">
                                {isAr ? item.costCenterAr : item.costCenterEn}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-xs text-amber-300">
                              {item.accountCode}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                              {item.amountKwd.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-xs text-slate-400">
                              {item.docRef}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 size={12} />
                                {isAr ? item.statusAr : item.statusEn}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-VIEW 5: TOP GOVERNMENT CLEARANCES, ADVERTISING & RESIDENCY TRANSACTIONS VIA SANAD */}
            {pettySubTab === 'topLicenses' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 bg-slate-900/40 p-3 rounded-xl border border-slate-800 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-400">🏛️ {isAr ? 'كبار معاملات التراخيص والإعلانات عبر (سند)' : 'Top Government Permits & Ads Clearances'}</span>
                    <span>—</span>
                    <span>{isAr ? 'توثيق تراخيص إعلانات وشاشات بلدية الكويت (بروميناد، الأفنيوز، السالمية، العاصمة، 360) وتمديدات الكهرباء والإقامات' : 'Kuwait Municipality Ads Permits, Electrical Setup, & Residency Issuance'}</span>
                  </div>
                  <span className="font-mono text-emerald-400 font-bold">
                    {filteredTopLicenses.reduce((s, t) => s + t.amountKwd, 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'} ({filteredTopLicenses.length} {isAr ? 'معاملات' : 'txns'})
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold text-slate-400">
                          <th className="px-4 py-3 text-right">{isAr ? 'رقم المعاملة والتاريخ' : 'Tx ID & Date'}</th>
                          <th className="px-4 py-3 text-right">{isAr ? 'بيان الترخيص والمعاملة الحكومية' : 'License / Description'}</th>
                          <th className="px-4 py-3 text-right">{isAr ? 'الجهة والمستفيد' : 'Entity / Beneficiary'}</th>
                          <th className="px-4 py-3 text-center">{isAr ? 'مركز التكلفة المزدوج (الفرع | البراند)' : 'Dual Cost Center'}</th>
                          <th className="px-4 py-3 text-center">{isAr ? 'رمز الحساب' : 'GL Code'}</th>
                          <th className="px-4 py-3 text-right">{isAr ? 'المبلغ (د.ك)' : 'Amount (KWD)'}</th>
                          <th className="px-4 py-3 text-center">{isAr ? 'رقم المستند' : 'Doc Ref'}</th>
                          <th className="px-4 py-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {filteredTopLicenses.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-mono font-bold text-amber-400 block">{item.id}</span>
                              <span className="text-xs text-slate-500 font-mono">{item.date}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-bold text-white block text-xs">
                                {isAr ? item.descAr : item.descEn}
                              </span>
                              <span className="text-xs text-slate-400">
                                {isAr ? item.categoryAr : item.categoryEn}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-300">
                              <span className="block text-slate-200 font-semibold">{isAr ? item.beneficiaryAr : item.beneficiaryEn}</span>
                              <span className="text-xs text-slate-500">{isAr ? item.custodianAr : item.custodianEn}</span>
                            </td>
                            <td className="px-4 py-3 text-center text-xs">
                              <span className="inline-flex rounded-full bg-slate-800/90 border border-slate-700 px-2.5 py-0.5 font-semibold text-slate-200">
                                {isAr ? `${item.branchAr} | ${item.brandAr}` : `${item.branchEn} | ${item.brandEn}`}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-xs text-amber-300">
                              <span className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5">
                                {item.accountCode}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400 text-sm">
                              {item.amountKwd.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-xs text-slate-400">
                              {item.docRef}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 size={12} />
                                {isAr ? item.statusAr : item.statusEn}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-700 bg-slate-900/80 font-bold text-white">
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-right text-xs uppercase tracking-wider text-slate-300">
                            {isAr ? 'إجمالي كبار معاملات التراخيص والإعلانات (10 معاملات موثقة):' : 'Total Top Licenses & Clearances (10 Transactions):'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-400 text-base font-black">
                            {filteredTopLicenses.reduce((s, t) => s + t.amountKwd, 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                          </td>
                          <td colSpan={2} className="px-4 py-3 text-center">
                            <span className="inline-flex rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs text-emerald-300 border border-emerald-500/40">
                              {isAr ? 'معتمدة ومرحلة بالكامل' : '100% Approved & Posted'}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-VIEW 4: RABIH ATTA TAHA MAINTENANCE DETAILS */}
            {pettySubTab === 'rabih' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                  <span>
                    {isAr
                      ? 'كشف عهدة صيانة المطابخ والفروع ومخيم السفير (ربيع عطا طه) — توثيق أعمال التكييف، التبريد، السباكة، وتمديدات المخيم'
                      : 'Rabih Atta Taha Maintenance Custody — Documenting Kitchen, AC, Refrigeration & Safir Camp Setups'}
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">
                    10,899.720 {isAr ? 'د.ك' : 'KWD'} (538 {isAr ? 'معاملة' : 'txns'})
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold text-slate-400">
                          <th className="px-4 py-3 text-right">{isAr ? 'رقم السند والتاريخ' : 'Voucher ID & Date'}</th>
                          <th className="px-4 py-3 text-right">{isAr ? 'الموقع / مركز التكلفة' : 'Location / Cost Center'}</th>
                          <th className="px-4 py-3 text-right">{isAr ? 'طبيعة الصيانة والأعمال المنفذة' : 'Maintenance Description & Scope'}</th>
                          <th className="px-4 py-3 text-center">{isAr ? 'الفرع والبراند' : 'Branch & Brand'}</th>
                          <th className="px-4 py-3 text-center">{isAr ? 'رمز الحساب' : 'GL Code'}</th>
                          <th className="px-4 py-3 text-right">{isAr ? 'المبلغ (د.ك)' : 'Amount (KWD)'}</th>
                          <th className="px-4 py-3 text-center">{isAr ? 'رقم الفاتورة / المستند' : 'Doc Ref'}</th>
                          <th className="px-4 py-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {filteredRabih.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-mono font-bold text-amber-400 block">{item.id}</span>
                              <span className="text-xs text-slate-500 font-mono">{item.date}</span>
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-white">
                              {isAr ? item.costCenterAr : item.costCenterEn}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-300 max-w-md">
                              {isAr ? item.descAr : item.descEn}
                            </td>
                            <td className="px-4 py-3 text-center text-xs">
                              <span className="inline-flex rounded-full bg-slate-800/90 border border-slate-700 px-2.5 py-0.5 text-slate-200">
                                {isAr ? item.branchAr : item.branchEn}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-xs text-amber-300">
                              {item.accountCode}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                              {item.amountKwd.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-xs text-slate-400">
                              {item.docRef}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 size={12} />
                                {isAr ? item.statusAr : item.statusEn}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ========================================================================= */}
      {/* TAB 4: GENERAL JOURNAL ENTRIES & VOUCHERS                                 */}
      {/* ========================================================================= */}
      {activeTab === 'journals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'دفتر اليومية والقيود المزدوجة وسندات الصرف والقبض' : 'Dual-Entry General Journal & Vouchers'}
            </h3>
            <span className="text-xs text-emerald-400 font-semibold">
              {isAr ? 'القيود متوازنة: المدين = الدائن = 1,485,210.000 د.ك' : 'Balanced: Total Debit = Total Credit'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'رقم القيد' : 'Entry No'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'البيان والوصف المحاسبي' : 'Narrative'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'المدين' : 'Debit (KWD)'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الدائن' : 'Credit (KWD)'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'المستخدم والمراجع' : 'Auditor'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { no: 'JV-202611-001', date: '03 نوفمبر 2026', desc: 'إثبات مبيعات الفروع المباشرة وإيداعات K-NET اليومية', dr: '1,840.500', cr: '1,840.500', auditor: 'أحمد العوضي (محاسب أول)' },
                    { no: 'JV-202611-002', date: '02 نوفمبر 2026', desc: 'استحقاق فاتورة توريد لحوم أنجوس من شركة المواشي', dr: '4,850.000', cr: '4,850.000', auditor: 'أحمد العوضي (محاسب أول)' },
                    { no: 'JV-202611-003', date: '01 نوفمبر 2026', desc: 'صرف مسير رواتب موظفي فنتشر فودز لشهر أكتوبر (WPS)', dr: '48,250.000', cr: '48,250.000', auditor: 'طارق عبد المنعم (شيف/مدير)' },
                    { no: 'JV-202611-004', date: '31 أكتوبر 2026', desc: 'تسوية وإيداع مستحقات منصة طلبات جو (Talabat Go Payout)', dr: '12,410.000', cr: '12,410.000', auditor: 'أحمد العوضي (محاسب أول)' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-emerald-400">{row.no}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{row.date}</td>
                      <td className="px-4 py-3 font-semibold text-white">{row.desc}</td>
                      <td className="px-4 py-3 font-mono text-emerald-400 font-bold text-right">{row.dr}</td>
                      <td className="px-4 py-3 font-mono text-amber-300 font-bold text-right">{row.cr}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-400">{row.auditor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CHART OF ACCOUNTS (820 ODOO ACCOUNTS) & TRIAL BALANCE              */}
      {/* ========================================================================= */}
      {activeTab === 'chart' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'شجرة الحسابات وميزان المراجعة الموحد المعتمد في أودو (820 حساباً)' : 'Odoo Chart of Accounts & Unified Trial Balance'}
            </h3>
            <span className="text-xs text-slate-400">
              {isAr ? 'تطابق محاسبي تام بين نظام أودو ودفاتر فنتشر فودز' : '100% Synced with Odoo Data Lake'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-center">{isAr ? 'رقم الحساب' : 'Account Code'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'اسم الحساب المحاسبي' : 'Account Name'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'التبويب' : 'Class'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'المدين (د.ك)' : 'Debit'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الدائن (د.ك)' : 'Credit'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الرصيد الصافي' : 'Net Balance'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { code: '101100', name: 'بنك الكويت الوطني (NBK - Main Operating)', cls: 'أصول نقدية', dr: '94,250.000', cr: '0.000', bal: '94,250.000' },
                    { code: '101200', name: 'البنك التجاري الكويتي (CBK - Payroll WPS)', cls: 'أصول نقدية', dr: '48,600.000', cr: '0.000', bal: '48,600.000' },
                    { code: '102000', name: 'عهد وصناديق الفروع النقدية (Branch Petty Cash)', cls: 'نقدية فروع', dr: '7,500.000', cr: '0.000', bal: '7,500.000' },
                    { code: '105000', name: 'مخزون المواد الغذائية والتعبئة والمطبخ المركزي', cls: 'مخزون متداول', dr: '124,500.000', cr: '0.000', bal: '124,500.000' },
                    { code: '106000', name: 'مدينو منصات التوصيل (طلبات، جاهز، دليفرو، كيتا)', cls: 'عملاء ومدينون', dr: '28,450.000', cr: '0.000', bal: '28,450.000' },
                    { code: '201000', name: 'موردو المواد الخام واللحوم والخضار (Payables)', cls: 'خصوم متداولة', dr: '0.000', cr: '68,420.000', bal: '-68,420.000' },
                    { code: '202000', name: 'مستحقات رواتب العاملين ومسير WPS', cls: 'خصوم متداولة', dr: '0.000', cr: '48,250.000', bal: '-48,250.000' },
                    { code: '203000', name: 'مخصص مكافأة نهاية الخدمة (EOSB Provision)', cls: 'مخصصات التزامات', dr: '0.000', cr: '25,640.000', bal: '-25,640.000' },
                    { code: '301000', name: 'رأس مال شركة فنتشر فودز المصرح به والمدفوع', cls: 'حقوق ملكية', dr: '0.000', cr: '250,000.000', bal: '-250,000.000' },
                  ].map((acc, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 text-center font-mono font-bold text-amber-400">{acc.code}</td>
                      <td className="px-4 py-3 font-semibold text-white">{acc.name}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-400">{acc.cls}</td>
                      <td className="px-4 py-3 font-mono text-emerald-400 text-right">{acc.dr}</td>
                      <td className="px-4 py-3 font-mono text-amber-300 text-right">{acc.cr}</td>
                      <td className="px-4 py-3 font-mono font-bold text-white text-right">{acc.bal} د.ك</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: AR/AP AGING & PROVISIONS                                           */}
      {/* ========================================================================= */}
      {activeTab === 'aging' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'الذمم المدينة والدائنة ومخصصات نهاية الخدمة (مادة 51)' : 'AR/AP Aging & Kuwait Labor Law EOSB Provisions'}
            </h3>
            <span className="text-xs text-emerald-400 font-semibold">
              {isAr ? 'تغطية مالية كاملة لالتزامات الموظفين والموردين' : '100% Fully Funded Provisions'}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 space-y-2">
              <span className="text-xs text-slate-400">مخصص مكافأة نهاية الخدمة (EOSB):</span>
              <p className="text-2xl font-black text-amber-400 font-mono">25,640.000 د.ك</p>
              <p className="text-xs text-slate-500">محسوب وفق المادة 51 من قانون العمل الكويتي لـ 166 موظفاً</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 space-y-2">
              <span className="text-xs text-slate-400">مخصص رصيد الإجازات المستحقة:</span>
              <p className="text-2xl font-black text-blue-400 font-mono">8,920.000 د.ك</p>
              <p className="text-xs text-slate-500">رصيد الإجازات السنوية غير المستنفدة للكادر التشغيلي</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 space-y-2">
              <span className="text-xs text-slate-400">صافي المستحق لموردي المواد:</span>
              <p className="text-2xl font-black text-rose-400 font-mono">68,420.000 د.ك</p>
              <p className="text-xs text-slate-500">مجدولة للشيكات والتحويلات البنكية خلال شهر نوفمبر</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: AUTOMATED FINANCIAL GL BRIDGE (FIELD OPS)                          */}
      {/* ========================================================================= */}
      {activeTab === 'glBridge' && (
        <AutomatedGlBridge locale={currentLocale} />
      )}

      {/* ========================================================================= */}
      {/* TAB: EVENTS & CAMPS FINANCIALS (GL LINKAGE & COST CENTERS)                */}
      {/* ========================================================================= */}
      {activeTab === 'eventsFinance' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#0d131f] p-5 shadow-xl sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-gold-400" />
                <h3 className="text-base font-black text-white">
                  {isAr ? 'الرقابة المالية لمشاريع المعارض والمخيمات والفعاليات' : 'Events, Expos & Ministry Camps Financial Control'}
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {isAr
                  ? 'مراكز التكلفة المستقلة (Cost Centers)، قيود اليومية الآلية، وتتبع شيكات التأمين المستردة (حساب 110400)'
                  : 'Event cost centers, double-entry automated postings, and refundable security deposit audit (GL 110400)'}
              </p>
            </div>
            <Link
              href="/erp/events-projects"
              className="inline-flex items-center gap-2 rounded-xl bg-gold-400/20 border border-gold-300/30 px-4 py-2 text-xs font-bold text-gold-300 hover:bg-gold-400/30 transition-colors"
            >
              <span>{isAr ? 'فتح مركز القيادة الشامل للفعاليات' : 'Open Full Events Command Hub'}</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Events Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'إجمالي إيرادات الفعاليات' : 'Total Revenue'}</span>
              <div className="mt-2 text-xl font-black text-emerald-400 font-mono">
                {VENTURE_FOODS_EVENTS.reduce((acc, e) => acc + e.revenue.grossSalesKwd, 0).toLocaleString('en-US', { minimumFractionDigits: 3 })} KWD
              </div>
              <span className="text-xs text-slate-500">{isAr ? 'من 6 فعاليات ومخيمات موثقة' : 'Across 6 events & camps'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'صافي الأرباح المحققة' : 'Net Profit'}</span>
              <div className="mt-2 text-xl font-black text-gold-300 font-mono">
                {VENTURE_FOODS_EVENTS.reduce((acc, e) => acc + e.profitability.netProfitKwd, 0).toLocaleString('en-US', { minimumFractionDigits: 3 })} KWD
              </div>
              <span className="text-xs text-emerald-400 font-bold">▲ 43.4% {isAr ? 'هامش ربح صافي' : 'Net margin'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'التأمينات المستردة المعلقة (حساب 110400)' : 'Pending Deposits'}</span>
              <div className="mt-2 text-xl font-black text-cyan-300 font-mono">
                {VENTURE_FOODS_EVENTS.filter(e => e.costs.securityDepositStatus === 'pending').reduce((acc, e) => acc + e.costs.securityDepositKwd, 0).toLocaleString('en-US', { minimumFractionDigits: 3 })} KWD
              </div>
              <span className="text-xs text-amber-400">{isAr ? 'بانتظار خطابات إخلاء الطرف' : 'Awaiting site clearances'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'متوسط العائد على الاستثمار' : 'Average ROI'}</span>
              <div className="mt-2 text-xl font-black text-purple-300 font-mono">
                ▲ 77.3%
              </div>
              <span className="text-xs text-slate-400">{isAr ? 'استرداد كامل خلال 5-26 يوم' : '5-26 days payback'}</span>
            </div>
          </div>

          {/* Events Cost Center Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d131f]">
            <div className="border-b border-slate-800 px-5 py-3.5 bg-slate-900/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {isAr ? 'سجل مراكز تكلفة الفعاليات وقيود الأرباح والخسائر' : 'Events Cost Center Ledger & P&L Statement'}
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold">
                    <th className="px-4 py-3 text-start">{isAr ? 'مركز التكلفة والفعالية' : 'Cost Center & Event'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'الأيام' : 'Days'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'الإيجار (501010)' : 'Rental (501010)'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'الديكور (120400)' : 'Fitout (120400)'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'الأغذية (501000)' : 'COGS (501000)'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'المبيعات' : 'Sales'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'صافي الربح' : 'Net Profit'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'شيك التأمين' : 'Deposit'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {VENTURE_FOODS_EVENTS.map((evt) => (
                    <tr key={evt.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-sans">
                        <span className="font-mono text-gold-400 font-bold text-xs">{evt.costCenterCode}</span>
                        <div className="font-bold text-white text-xs">{isAr ? evt.nameAr : evt.nameEn}</div>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-300">{evt.daysCount}</td>
                      <td className="px-3 py-3 text-end text-slate-300">{evt.costs.boothRentalKwd.toFixed(3)}</td>
                      <td className="px-3 py-3 text-end text-slate-300">{evt.costs.constructionFitoutKwd.toFixed(3)}</td>
                      <td className="px-3 py-3 text-end text-slate-300">{evt.costs.foodPackagingCogsKwd.toFixed(3)}</td>
                      <td className="px-3 py-3 text-end font-bold text-emerald-400">{evt.revenue.grossSalesKwd.toFixed(3)}</td>
                      <td className="px-3 py-3 text-end font-bold text-gold-300">{evt.profitability.netProfitKwd.toFixed(3)}</td>
                      <td className="px-3 py-3 text-center font-sans">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                          evt.costs.securityDepositStatus === 'refunded'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {evt.costs.securityDepositKwd.toFixed(0)} KWD ({evt.costs.securityDepositStatus})
                        </span>
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
      {/* TAB 8: LEGACY DATABASE ACCOUNTING                                         */}
      {/* ========================================================================= */}
      
      {/* ========================================================================= */}
      {/* TAB: COMPREHENSIVE LEASES, HOUSING & RENT BURDEN RATIO                    */}
      {/* ========================================================================= */}
      {activeTab === 'leases' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#0d131f] p-5 shadow-xl sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-black text-white">
                  {isAr ? 'منظومة الإيجارات الشاملة ونسب عبء الإيجار ومخاطر العقود' : 'Comprehensive Leases, Rent-to-Sales Burden & Facility Rents'}
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {isAr
                  ? 'عقود إيجار الفروع الـ 10، سكنات العمال (4 مباني)، المطبخ المركزي ومخازن الشويخ، وتأمينات المعارض'
                  : 'Auditing 10 branch leases, 4 staff housing buildings, Central Kitchen & warehouses, and event booth deposits'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300">
                {isAr ? 'متوسط عبء الإيجار الموحد: 10.89%' : 'Weighted Rent Burden: 10.89%'}
              </span>
            </div>
          </div>

          {/* Lease Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'إجمالي الإيجارات الشهرية' : 'Total Monthly Leases'}</span>
              <div className="mt-2 text-xl font-black text-amber-400 font-mono">27,850.000 KWD</div>
              <span className="text-xs text-slate-500">{isAr ? 'فروع 18,200 + سكن 4,600 + مخازن 5,050' : '10 branches + 4 housing + 3 hubs'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'نسبة عبء الإيجار من المبيعات' : 'Rent-to-Sales Ratio'}</span>
              <div className="mt-2 text-xl font-black text-emerald-400 font-mono">10.89%</div>
              <span className="text-xs text-emerald-300 font-bold">🟢 {isAr ? 'ضمن المعدل العالمي الممتاز (< 15%)' : 'Healthy benchmark (< 15%)'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'التأمينات الإيجارية المستردة (حساب 110400)' : 'Security Deposits in GL'}</span>
              <div className="mt-2 text-xl font-black text-cyan-300 font-mono">24,500.000 KWD</div>
              <span className="text-xs text-slate-400">{isAr ? 'تأمينات فروع وسكنات معتمدة' : 'Recoverable upon vacate'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'عقود تتطلب التجديد قريباً' : 'Expiring Soon'}</span>
              <div className="mt-2 text-xl font-black text-rose-400 font-mono">2 {isAr ? 'عقود' : 'Leases'}</div>
              <span className="text-xs text-rose-300 font-bold">{isAr ? 'بنيد القار والمهبولة (نوفمبر/ديسمبر 2026)' : 'Bneid Al-Qar & Mahboula'}</span>
            </div>
          </div>

          {/* Table 1: 10 Branch Leases & Rent-to-Sales Burden */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d131f]">
            <div className="border-b border-slate-800 px-5 py-3.5 bg-slate-900/40 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {isAr ? '1. عقود إيجارات الفروع الـ 10 ونسبة عبء الإيجار من مبيعات أكتوبر 2026' : '1. 10 Branch Leases & October 2026 Rent-to-Sales Burden'}
              </h4>
              <span className="text-xs text-slate-400 font-mono">18,200.000 KWD / 167,092.000 KWD = 10.89%</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold">
                    <th className="px-4 py-3 text-start">{isAr ? 'الفرع والموقع' : 'Branch & Location'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'المساحة' : 'Area'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'الإيجار الشهري' : 'Monthly Rent'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'مبيعات أكتوبر' : 'Oct Sales'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'نسبة عبء الإيجار %' : 'Rent Burden %'}</th>
                    <th className="px-3 py-3 text-start">{isAr ? 'المالك / المؤجر' : 'Landlord'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'انتهاء العقد' : 'Expiry'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'حالة التجديد' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {[
                    { branchAr: 'فرع السالمية (شارع سالم المبارك)', branchEn: 'Salmiya - Salem Al-Mubarak', area: '140 m²', rent: 2400, sales: 24150, landlord: 'Al-Bahar Real Estate', expiry: '2027-12-31', status: 'ACTIVE', statusAr: 'سارٍ ومستقر' },
                    { branchAr: 'فرع الأفنيوز (المرحلة 2)', branchEn: 'The Avenues - Phase 2', area: '110 m²', rent: 3800, sales: 36400, landlord: 'Mabanee Co. S.A.K.', expiry: '2028-06-15', status: 'ACTIVE', statusAr: 'سارٍ ومستقر' },
                    { branchAr: 'فرع حولي (شارع بيروت)', branchEn: 'Hawally - Beirut St.', area: '130 m²', rent: 1850, sales: 18200, landlord: 'Al-Tijaria Real Estate', expiry: '2027-09-30', status: 'ACTIVE', statusAr: 'سارٍ ومستقر' },
                    { branchAr: 'فرع الفروانية (شارع حبيب مناور)', branchEn: 'Farwaniya - Habib Munawer St.', area: '125 m²', rent: 1600, sales: 15900, landlord: 'Al-Hamra Real Estate', expiry: '2027-03-31', status: 'ACTIVE', statusAr: 'سارٍ ومستقر' },
                    { branchAr: 'فرع المهبولة (الشريط الساحلي)', branchEn: 'Mahboula - Coastal Road', area: '150 m²', rent: 1450, sales: 13800, landlord: 'United Real Estate', expiry: '2026-11-30', status: 'EXPIRING', statusAr: 'قيد تجديد العقد' },
                    { branchAr: 'فرع العارضية الحرفية (شارع 20)', branchEn: 'Ardiya Craft Hub - St. 20', area: '160 m²', rent: 1750, sales: 16800, landlord: 'Kuwait Industrial Properties', expiry: '2028-08-31', status: 'ACTIVE', statusAr: 'سارٍ ومستقر' },
                    { branchAr: 'فرع خيطان (شارع عثمان بن عفان)', branchEn: 'Khaitan - Othman Bin Affan', area: '115 m²', rent: 1250, sales: 11400, landlord: 'Al-Safat Investment', expiry: '2027-10-31', status: 'ACTIVE', statusAr: 'سارٍ ومستقر' },
                    { branchAr: 'فرع بنيد القار (شارع الاستقلال)', branchEn: 'Bneid Al-Qar - Istiklal St.', area: '95 m²', rent: 1350, sales: 12800, landlord: 'Al-Safir Holdings', expiry: '2026-12-31', status: 'EXPIRING', statusAr: 'قيد التفاوض للتجديد' },
                    { branchAr: 'فرع الري (طريق الغزالي السريع)', branchEn: 'Al-Rai - Ghazali Hub', area: '140 m²', rent: 1550, sales: 11900, landlord: 'Al-Rai Logistics Co.', expiry: '2028-04-30', status: 'ACTIVE', statusAr: 'سارٍ ومستقر' },
                    { branchAr: 'فرع الفحيحيل (شارع مكة)', branchEn: 'Fahaheel - Makkah St.', area: '100 m²', rent: 1200, sales: 8342, landlord: 'Al-Koot Mall Complex', expiry: '2027-01-31', status: 'ACTIVE', statusAr: 'مراقبة العبء (< 15%)' },
                  ].map((row, idx) => {
                    const ratio = (row.rent / row.sales) * 100
                    return (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-medium text-white">{isAr ? row.branchAr : row.branchEn}</td>
                        <td className="px-3 py-3 text-center text-slate-400 font-mono">{row.area}</td>
                        <td className="px-3 py-3 text-end font-mono font-bold text-amber-300">{row.rent.toFixed(3)} KWD</td>
                        <td className="px-3 py-3 text-end font-mono text-slate-300">{row.sales.toLocaleString()} KWD</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                            ratio < 11 ? 'bg-emerald-500/20 text-emerald-300' : ratio < 14 ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {ratio.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-400">{row.landlord}</td>
                        <td className="px-3 py-3 text-center font-mono text-slate-300">{row.expiry}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            row.status === 'EXPIRING' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {isAr ? row.statusAr : row.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Staff Housing Flats & Dormitories */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d131f]">
              <div className="border-b border-slate-800 px-5 py-3.5 bg-slate-900/40">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {isAr ? '2. سكنات الموظفين والعمالة (حساب 502040)' : '2. Staff Housing & Flats (GL 502040)'}
                </h4>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { building: 'عمارة المهبولة ق4 (4 شقق)', en: 'Mahboula Bldg 4 (4 Flats)', staff: '28 موظفاً', rent: 1400, deposit: 1400, landlord: 'شركة الأحمدية العقارية' },
                  { building: 'عمارة خيطان ق12 (3 شقق)', en: 'Khaitan Bldg 12 (3 Flats)', staff: '22 موظفاً', rent: 1150, deposit: 1150, landlord: 'عقارات العثمان' },
                  { building: 'شقق السالمية ق10 (شقتان)', en: 'Salmiya Block 10 (2 Flats)', staff: '14 موظفاً', rent: 950, deposit: 950, landlord: 'مجموعة الكاظمي' },
                  { building: 'فيلا سكن الفحيحيل (فيلا كاملة)', en: 'Fahaheel Villa (Full Villa)', staff: '16 موظفاً', rent: 1100, deposit: 1100, landlord: 'عقارات المطوع' },
                ].map((flat, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
                    <div>
                      <div className="font-bold text-white">{isAr ? flat.building : flat.en}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{flat.staff} • {flat.landlord}</div>
                    </div>
                    <div className="text-end">
                      <div className="font-mono font-bold text-amber-300">{flat.rent.toFixed(3)} KWD</div>
                      <div className="text-xs text-cyan-400 font-mono">تأمين: {flat.deposit} KWD</div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs font-bold px-1">
                  <span className="text-slate-300">{isAr ? 'إجمالي إيجار سكن الموظفين الشهري:' : 'Total Monthly Housing:'}</span>
                  <span className="font-mono text-amber-400 text-sm">4,600.000 KWD</span>
                </div>
              </div>
            </div>

            {/* Table 3: Central Commissary & Storage Warehouses */}
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d131f]">
              <div className="border-b border-slate-800 px-5 py-3.5 bg-slate-900/40">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {isAr ? '3. المطبخ المركزي ومخازن التوزيع' : '3. Commissary & Logistics Warehouses'}
                </h4>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { name: 'المطبخ المركزي والمقر الإنتاجي', en: 'Central Kitchen Commissary', area: '600 m²', rent: 3200, gl: 'GL 501000', landlord: 'إدارة مبارك الكبير' },
                  { name: 'مستودع الشويخ الجاف والتغليف (الشويخ الصناعية)', en: 'Shuwaikh Dry & Packaging Warehouse', area: '450 m²', rent: 1850, gl: 'GL 501005', landlord: 'عقارات الشويخ الصناعية' },
                  { name: 'وحدة التبريد والتجميد المركزي (الري)', en: 'Al-Rai Cold Storage Unit', area: '200 m²', rent: 1200, gl: 'GL 501006', landlord: 'أجيليتي للمجمعات اللوجستية' },
                ].map((wh, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
                    <div>
                      <div className="font-bold text-white">{isAr ? wh.name : wh.en}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{wh.area} • {wh.gl} • {wh.landlord}</div>
                    </div>
                    <div className="text-end">
                      <div className="font-mono font-bold text-amber-300">{wh.rent.toFixed(3)} KWD</div>
                      <div className="text-xs text-emerald-400 font-bold">{isAr ? 'عقد طويل الأجل' : 'Long-Term Lease'}</div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs font-bold px-1">
                  <span className="text-slate-300">{isAr ? 'إجمالي إيجارات المنشآت اللوجستية:' : 'Total Facilities Leases:'}</span>
                  <span className="font-mono text-amber-400 text-sm">6,250.000 KWD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: FLEET, VEHICLES, GARAGE REPAIRS, FUEL & DRIVER FINES                 */}
      {/* ========================================================================= */}
      {activeTab === 'fleet' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#0d131f] p-5 shadow-xl sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-sky-400" />
                <h3 className="text-base font-black text-white">
                  {isAr ? 'منظومة إدارة الأسطول وتكاليف الكراجات والمحروقات ومخالفات السائقين' : 'Fleet Management, Garage Repairs, Fuel Cards & Driver Fines'}
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {isAr
                  ? 'أسطول التوصيل المبرد (18 مركبة)، تكاليف الصيانة وقطع الغيار بالكراجات، كروت الوقود، والخصم المباشر لمخالفات المرور من الرواتب'
                  : 'Managing 18 fleet vehicles, garage work orders (GL 503010), fuel allowances (GL 503020), and driver payroll deductions (GL 210500)'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-300">
                {isAr ? '18 مركبة نشطة تحت المراقبة' : '18 Active Vehicles Monitored'}
              </span>
            </div>
          </div>

          {/* Fleet Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'حجم الأسطول النشط' : 'Active Fleet Size'}</span>
              <div className="mt-2 text-xl font-black text-sky-400 font-mono">18 {isAr ? 'مركبة' : 'Units'}</div>
              <span className="text-xs text-slate-500">{isAr ? '6 سيارات فان مبردة + 8 دراجات + 4 عمليات' : '6 Vans + 8 Bikes + 4 SUVs'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'صيانة الكراجات وقطع الغيار (حساب 503010)' : 'Garage Repairs & Parts'}</span>
              <div className="mt-2 text-xl font-black text-amber-400 font-mono">1,280.000 KWD</div>
              <span className="text-xs text-slate-400">{isAr ? 'كراجات الشويخ والري المعتمدة' : 'Approved Shuwaikh workshops'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'محروقات وبترول الأسطول (حساب 503020)' : 'Fuel & Petrol (Monthly)'}</span>
              <div className="mt-2 text-xl font-black text-emerald-400 font-mono">1,420.000 KWD</div>
              <span className="text-xs text-emerald-300 font-bold">{isAr ? 'كروت الأولى وبترول الوطنية' : 'Oula & KNPC Fuel Cards'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'المخالفات المرورية المربوطة بالرواتب' : 'Driver Traffic Fines'}</span>
              <div className="mt-2 text-xl font-black text-rose-400 font-mono">285.000 KWD</div>
              <span className="text-xs text-rose-300 font-bold">100% {isAr ? 'مربوطة بخصم مسير الرواتب (حساب 210500)' : 'Linked to WPS Payroll'}</span>
            </div>
          </div>

          {/* Table 1: Garage Work Orders & Repairs (GL 503010) */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d131f]">
            <div className="border-b border-slate-800 px-5 py-3.5 bg-slate-900/40 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {isAr ? '1. فواتير وتصليحات كراجات صيانة المركبات والتبريد (حساب 503010)' : '1. Garage Repair Orders & Chiller Maintenance (GL 503010)'}
              </h4>
              <span className="text-xs text-slate-400 font-mono">{isAr ? 'كراجات الشويخ الصناعية المعتمدة' : 'Shuwaikh Industrial Hub'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold">
                    <th className="px-4 py-3 text-start">{isAr ? 'رقم اللوحة والمركبة' : 'Plate & Vehicle'}</th>
                    <th className="px-3 py-3 text-start">{isAr ? 'الكراج / الورشة المعتمدة' : 'Workshop / Garage'}</th>
                    <th className="px-3 py-3 text-start">{isAr ? 'طبيعة الإصلاح وقطع الغيار' : 'Work Done & Parts'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'المبلغ بالفاتورة' : 'Amount KWD'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'الحساب المحاسبي' : 'GL Account'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {[
                    { plate: '12-49811', vehicle: 'Toyota HiAce Chilled Van', garage: 'كراج الشويخ المركزي للتبريد', work: 'صيانة كمبروسر التبريد Thermo King وتعبئة غاز R404A', amount: 145.0, date: '2026-10-28', gl: '503010 صيانة سيارات' },
                    { plate: '15-88201', vehicle: 'Nissan Urvan Refrig Van', garage: 'كراج الري المتخصص للمكابح', work: 'تبديل سفايف فرامل أمامية وخلفية + خرط ديسكات', amount: 85.0, date: '2026-10-24', gl: '503010 صيانة سيارات' },
                    { plate: '18-33104', vehicle: 'Isuzu Chilled 3-Ton Truck', garage: 'الورشة الفنية لمحركات الديزل (الأحمدي)', work: 'سيرفس كامل 40,000 كم + تبديل بوشات ومساعدات', amount: 260.0, date: '2026-10-18', gl: '503010 صيانة سيارات' },
                    { plate: 'BK-103', vehicle: 'Honda 150cc Delivery Bike', garage: 'ورشة الفروانية لصيانة الدراجات', work: 'تبديل جنزير ومسننات + إطار خلفي توبلس أصلي', amount: 38.0, date: '2026-10-29', gl: '503010 صيانة سيارات' },
                    { plate: '12-49812', vehicle: 'Toyota HiAce Chilled Van', garage: 'كراج كهرباء وبطاريات الشويخ', work: 'تبديل دينمو شحن أصلي + طقم بطاريتين هيفي ديوتي', amount: 120.0, date: '2026-10-12', gl: '503010 صيانة سيارات' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-sky-400 text-xs">{row.plate}</span>
                        <div className="text-xs text-slate-300">{row.vehicle}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-300">{row.garage}</td>
                      <td className="px-3 py-3 text-slate-300">{row.work}</td>
                      <td className="px-3 py-3 text-end font-mono font-bold text-amber-300">{row.amount.toFixed(3)} KWD</td>
                      <td className="px-3 py-3 text-center font-mono text-slate-400">{row.date}</td>
                      <td className="px-3 py-3 text-center font-mono text-emerald-400">{row.gl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Traffic Violations Linked to Driver Payroll Deductions */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d131f]">
            <div className="border-b border-slate-800 px-5 py-3.5 bg-slate-900/40 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {isAr ? '2. رادار المخالفات المرورية وربطها التلقائي بخصومات رواتب السائقين (حساب 210500)' : '2. Traffic Violations & Automated Driver Payroll Deductions (GL 210500)'}
              </h4>
              <span className="text-xs text-rose-400 font-mono font-bold">{isAr ? 'إجمالي المخالفات المسجلة: 285.000 د.ك' : 'Total Fines: 285.000 KWD'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold">
                    <th className="px-4 py-3 text-start">{isAr ? 'رقم المخالفة والتاريخ' : 'Violation Ref & Date'}</th>
                    <th className="px-3 py-3 text-start">{isAr ? 'المركبة واللوحة' : 'Vehicle & Plate'}</th>
                    <th className="px-3 py-3 text-start">{isAr ? 'وصف المخالفة المرورية' : 'Violation Detail'}</th>
                    <th className="px-3 py-3 text-start">{isAr ? 'السائق المسؤول' : 'Driver'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'قيمة الغرامة' : 'Fine (KWD)'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'مسير الرواتب المربوط' : 'Payroll Month'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'حالة القيد والخصم' : 'GL Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {[
                    { ref: 'MOH-TRF-90218', date: '2026-10-25 14:20', plate: '15-88201', desc: 'تجاوز السرعة المقررة (20-30 كم/س) - طريق الدائري الخامس', driver: 'محمد عمران (EMP-0042)', fine: 20.0, month: 'نوفمبر 2026', glStatus: 'مربوط بخصم الراتب', statusBadge: 'bg-amber-500/20 text-amber-300' },
                    { ref: 'MOH-TRF-90245', date: '2026-10-22 11:15', plate: 'BK-104', desc: 'الوقوف في مواقف الحافلات / فوق الرصيف بالسالمية', driver: 'جاسم الدين (EMP-0078)', fine: 15.0, month: 'نوفمبر 2026', glStatus: 'مربوط بخصم الراتب', statusBadge: 'bg-amber-500/20 text-amber-300' },
                    { ref: 'MOH-TRF-90302', date: '2026-10-19 18:40', plate: '12-49812', desc: 'عدم ارتداء حزام الأمان واستخدام الهاتف أثناء القيادة', driver: 'سونيل كومار (EMP-0036)', fine: 15.0, month: 'نوفمبر 2026', glStatus: 'مربوط بخصم الراتب', statusBadge: 'bg-amber-500/20 text-amber-300' },
                    { ref: 'MOH-TRF-90380', date: '2026-10-14 09:30', plate: '18-33104', desc: 'مخالفة السير في الحارة اليسرى لمركبة نقل بضائع في وقت الذروة', driver: 'كبير حسين (EMP-0051)', fine: 30.0, month: 'نوفمبر 2026', glStatus: 'مربوط بخصم الراتب', statusBadge: 'bg-amber-500/20 text-amber-300' },
                    { ref: 'MOH-TRF-90411', date: '2026-10-08 20:05', plate: 'BK-101', desc: 'عدم وضوح العاكس الضوئي لصندوق التوصيل الخلفي للدراجة', driver: 'بلال حسين (EMP-0081)', fine: 5.0, month: 'أكتوبر 2026', glStatus: 'تم الخصم والسداد بالمرور', statusBadge: 'bg-emerald-500/20 text-emerald-300' },
                  ].map((fine, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-rose-400 text-xs">{fine.ref}</span>
                        <div className="text-xs text-slate-400">{fine.date}</div>
                      </td>
                      <td className="px-3 py-3 font-mono text-sky-400">{fine.plate}</td>
                      <td className="px-3 py-3 text-slate-300">{fine.desc}</td>
                      <td className="px-3 py-3 font-medium text-white">{fine.driver}</td>
                      <td className="px-3 py-3 text-end font-mono font-bold text-rose-400">{fine.fine.toFixed(3)} KWD</td>
                      <td className="px-3 py-3 text-center text-slate-300 font-medium">{fine.month}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${fine.statusBadge}`}>
                          {fine.glStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'legacy' && liveChildren && (
        <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 shadow-xl">
          {liveChildren}
        </div>
      )}

      {/* New Journal Entry Modal */}
      {showNewEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {isAr ? 'إنشاء قيد يومية محاسبي مزدوج' : 'Create General Journal Entry'}
              </h3>
              <button onClick={() => setShowNewEntryModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setShowNewEntryModal(false)
                showToast(isAr ? '✅ تم حفظ القيد المحاسبي وتحديث ميزان المراجعة بنجاح' : '✅ Journal entry posted to ledger')
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'البيان المحاسبي:' : 'Narrative / Description:'}</label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'مثال: إثبات إيداع مبيعات الكاش فرع السالمية بالبنك' : 'e.g. In-store cash deposit to NBK'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'الحساب المدين:' : 'Debit Account:'}</label>
                  <select className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none">
                    <option value="101100">101100 - بنك الكويت الوطني NBK</option>
                    <option value="105000">105000 - مخزون المواد الغذائية</option>
                    <option value="601000">601000 - مصروف الرواتب</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'الحساب الدائن:' : 'Credit Account:'}</label>
                  <select className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none">
                    <option value="401000">401000 - إيرادات مبيعات الفروع</option>
                    <option value="102000">102000 - نقدية وصناديق الفروع</option>
                    <option value="201000">201000 - حسابات الموردين</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'المبلغ بالدينار الكويتي:' : 'Amount in KWD:'}</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  placeholder="1250.000"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewEntryModal(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 font-semibold text-slate-300"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-4 py-2 font-bold text-black hover:bg-emerald-400"
                >
                  {isAr ? 'ترحيل واعتماد القيد' : 'Post Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
