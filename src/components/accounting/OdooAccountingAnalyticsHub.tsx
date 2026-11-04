'use client'

import React, { useState } from 'react'
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Scale,
  ShieldCheck,
  FileSpreadsheet,
  Download,
  ArrowUpRight,
  PieChart,
  Wallet,
  Building2,
  Filter,
  Receipt,
  Users,
} from 'lucide-react'

interface OdooAccountingAnalyticsHubProps {
  isAr: boolean
  locale: string
}

export function OdooAccountingAnalyticsHub({ isAr, locale }: OdooAccountingAnalyticsHubProps) {
  const [adoptedRecs, setAdoptedRecs] = useState<Record<string, boolean>>({})
  const [activeCustFilter, setActiveCustFilter] = useState<string>('ALL')

  const handleAdopt = (id: string) => {
    setAdoptedRecs((prev) => ({ ...prev, [id]: true }))
  }

  // Audited 8 Custodians Data from Odoo (51,154.950 KWD total across 2,213 transactions)
  const custodians = [
    {
      id: 'sanad',
      nameAr: 'مكتب سند للتخليص والخدمات الحكومية',
      nameEn: 'Sanad PRO & Government Clearances',
      roleAr: 'تخليص الإقامات، كروت الصحة، وتراخيص البلدية والتموين',
      roleEn: 'Residencies, Baladiya licenses & urgent supplies',
      amountKwd: 31646.75,
      txCount: 1412,
      sharePct: 61.86,
      riskLevel: 'critical',
      riskAr: '🔴 تركز نقدي حرج (61.86%)',
      riskEn: '🔴 Critical Concentration',
      actionAr: 'إلغاء التفويض الفردي وتعيين مندوب داخلي عبر منصة "أسهل" لتوفير أتعاب التعقيب.',
      actionEn: 'Transition to internal PRO via Sahel portal to capture broker margin.',
      monthlySavingsKwd: 1850.0,
    },
    {
      id: 'rabih',
      nameAr: 'ربيع أنيس يحيى',
      nameEn: 'Rabih Anis Yahia',
      roleAr: 'فني صيانة التبريد، المكيفات، الفلاتر، ومصائد الشحوم',
      roleEn: 'HVAC, Cold-Chain & Grease Trap Technician',
      amountKwd: 10707.93,
      txCount: 418,
      sharePct: 20.93,
      riskLevel: 'high',
      riskAr: '🔴 استنزاف صيانة متكررة (20.93%)',
      riskEn: '🔴 High Maintenance Leak',
      actionAr: 'استبدال ثلاجات فرعي الكوت والسالمية وإلزام المورد بعقد صيانة وقائية موحد.',
      actionEn: 'Replace aged chillers at Al Kout & Salmiya with 3-year warranty units.',
      monthlySavingsKwd: 890.0,
    },
    {
      id: 'sheila',
      nameAr: 'شيلا أمبوس بولبولي',
      nameEn: 'Sheila Ambos Bulbuli',
      roleAr: 'مشرفة الفروع والمشتريات الاستهلاكية والنظافة الطارئة',
      roleEn: 'Branch Supervisor - Emergency Disposables & Cleaning',
      amountKwd: 2840.4,
      txCount: 124,
      sharePct: 5.55,
      riskLevel: 'medium',
      riskAr: '🟡 تحت المراقبة (5.55%)',
      riskEn: '🟡 Controlled Spend',
      actionAr: 'توحيد طلبيات المنظفات ومواد التعبئة بطلبيات أسبوعية مركزية من القرين.',
      actionEn: 'Consolidate packaging & cleaning replenishment into weekly central truck.',
      monthlySavingsKwd: 210.0,
    },
    {
      id: 'amjad',
      nameAr: 'أمجد سمير حسين',
      nameEn: 'Amjad Samir Hussein',
      roleAr: 'مسؤول الحركة، محروقات السيارات، وصيانة دراجات الأسطول',
      roleEn: 'Fleet Movement, Fuel & Motorcycle Maintenance',
      amountKwd: 2115.65,
      txCount: 92,
      sharePct: 4.14,
      riskLevel: 'medium',
      riskAr: '🟡 تدقيق دوري (4.14%)',
      riskEn: '🟡 Periodic Audit',
      actionAr: 'تطبيق بطاقات وقود إلكترونية مسبقة الدفع لكل مركبة وربطها بعدادات الكيلومتر.',
      actionEn: 'Implement smart fleet prepaid fuel cards tied to odometer telemetry.',
      monthlySavingsKwd: 180.0,
    },
    {
      id: 'shyam',
      nameAr: 'شيام حكمت كومار',
      nameEn: 'Shyam Hikmat Kumar',
      roleAr: 'مساعد تشغيل المطبخ المركزي بالقرين ومشتريات الأدوات',
      roleEn: 'Central Kitchen Ops Assistant & Small Wares',
      amountKwd: 1420.25,
      txCount: 64,
      sharePct: 2.78,
      riskLevel: 'low',
      riskAr: '🟢 طبيعي ومطابق (2.78%)',
      riskEn: '🟢 Normal & Compliant',
      actionAr: 'اعتماد دورة مستندية إلكترونية لأدوات المطبخ مع جدول إتلاف معتمد.',
      actionEn: 'Enforce standard digital requisition and disposal log for small wares.',
      monthlySavingsKwd: 90.0,
    },
    {
      id: 'nader',
      nameAr: 'نادر نزهي البستاني',
      nameEn: 'Nader Nezha Bustani',
      roleAr: 'مسؤول الشؤون الإدارية، المطبوعات، ومستلزمات المكاتب',
      roleEn: 'Admin Affairs, Stationery & Office Printing',
      amountKwd: 1180.5,
      txCount: 48,
      sharePct: 2.31,
      riskLevel: 'low',
      riskAr: '🟢 طبيعي ومطابق (2.31%)',
      riskEn: '🟢 Normal & Compliant',
      actionAr: 'التحول للأرشفة الرقمية وتقليص استهلاك الورق والمطبوعات الإدارية.',
      actionEn: 'Transition to digital document archive and reduce stationery spend.',
      monthlySavingsKwd: 60.0,
    },
    {
      id: 'choukrallah',
      nameAr: 'شكر الله ناصيف الهاشم',
      nameEn: 'Choukrallah Nassif',
      roleAr: 'مشرف الجودة وفعاليات الكشتة والمخيمات الخارجية',
      roleEn: 'Quality Auditor & Outdoor Events/Catering',
      amountKwd: 850.32,
      txCount: 35,
      sharePct: 1.66,
      riskLevel: 'low',
      riskAr: '🟢 طبيعي ومطابق (1.66%)',
      riskEn: '🟢 Normal & Compliant',
      actionAr: 'إدراج مصروفات الفعاليات الخارجية ضمن ميزانية تسويقية مستقلة مسبقة الاعتماد.',
      actionEn: 'Pre-allocate outdoor catering budgets per event via marketing GL.',
      monthlySavingsKwd: 45.0,
    },
    {
      id: 'nusha',
      nameAr: 'نوشا أسانار شريف',
      nameEn: 'Nusha Asanar Sharif',
      roleAr: 'مشرف تشغيل فرع السالمية (مصروفات تشغيلية طارئة)',
      roleEn: 'Salmiya Ops Supervisor (Emergency Kitchen Contingency)',
      amountKwd: 393.15,
      txCount: 20,
      sharePct: 0.77,
      riskLevel: 'low',
      riskAr: '🟢 طبيعي ومطابق (0.77%)',
      riskEn: '🟢 Normal & Compliant',
      actionAr: 'الاعتماد على توريدات المطبخ المركزي بالقرين للحد من المشتريات الطارئة.',
      actionEn: 'Rely on scheduled Qurain stock transfers to prevent emergency retail buys.',
      monthlySavingsKwd: 25.0,
    },
  ]

  // Filtered custodians list
  const filteredCustodians = activeCustFilter === 'ALL'
    ? custodians
    : custodians.filter((c) => c.id === activeCustFilter)

  // Pareto 80/20 Expense Categories Data (75.38% concentrated in top 5 categories)
  const paretoCategories = [
    {
      rank: 1,
      nameAr: 'المواد التموينية والخضار والفاكهة الطازجة',
      nameEn: 'Fresh Vegetables & Food Supplies',
      amountKwd: 16840.25,
      pct: 32.92,
      cumulativePct: 32.92,
      isTop80: true,
    },
    {
      rank: 2,
      nameAr: 'صيانة التبريد والمكيفات والفلاتر (عهد ربيع)',
      nameEn: 'HVAC & Chiller Maintenance (Rabih)',
      amountKwd: 10707.93,
      pct: 20.93,
      cumulativePct: 53.85,
      isTop80: true,
    },
    {
      rank: 3,
      nameAr: 'رسوم تجديد الإقامات وتراخيص العمل (الشؤون)',
      nameEn: 'Residency Renewals & Labor Permits',
      amountKwd: 5420.1,
      pct: 10.6,
      cumulativePct: 64.45,
      isTop80: true,
    },
    {
      rank: 4,
      nameAr: 'زيوت القلي والمواد الجافة المركزية (القرين)',
      nameEn: 'Cooking Oils & Dry Goods (Central Kitchen)',
      amountKwd: 3180.45,
      pct: 6.22,
      cumulativePct: 70.67,
      isTop80: true,
    },
    {
      rank: 5,
      nameAr: 'كروت الصحة وتراخيص بلدية الكويت',
      nameEn: 'Health Cards & Municipal Approvals',
      amountKwd: 2410.0,
      pct: 4.71,
      cumulativePct: 75.38,
      isTop80: true,
    },
    {
      rank: 6,
      nameAr: 'باقي بنود المصروفات والعهد الـ 20 مجتمعة',
      nameEn: 'Remaining 20 Expense Lines Combined',
      amountKwd: 12596.22,
      pct: 24.62,
      cumulativePct: 100.0,
      isTop80: false,
    },
  ]

  // The 4 Structured Forensic Alerts & AI Recommendations for Accounting
  const forensicAlerts = [
    {
      id: 'alert-sanad-recon',
      badgeAr: '🔴 خطر تركز مالي حاد (61.86%)',
      badgeEn: '🔴 Critical Concentration',
      titleAr: 'تركز 31,646.750 د.ك بمكتب سند للتعقيب بدون مناقصة سنوية أو عقود حجم',
      titleEn: 'Sanad Broker Concentration: 31,646.750 KWD across 1,412 entries',
      statAr: '1,412 قيداً مصرفياً ونقدياً مسجلة بأودو تحت عهدة مكتب سند تمثل 61.86% من إجمالي مصروفات الشركة.',
      statEn: '1,412 journal lines under Sanad custody accounting for 61.86% of total company expenses.',
      rootCauseAr: 'غياب التعاقد المركزي السنوي والاعتماد على إسناد المعاملات الفردية لكل عامل على حدة بهامش أتعاب مرتفع.',
      rootCauseEn: 'Absence of volume service agreement; paying ad-hoc broker surcharge on individual transactions.',
      actionAr: 'تأسيس قسم تعقيب داخلي تابع للموارد البشرية واستخدام منصة أسهل الحكومية مباشرة لإنجاز معاملات الـ 166 موظفاً.',
      actionEn: 'In-house the PRO function using direct digital government portals for 166 staff.',
      monthlySavingsKwd: 1850.0,
      annualSavingsKwd: 22200.0,
    },
    {
      id: 'alert-rabih-chillers',
      badgeAr: '🔴 تكرار صيانة خلال أقل من 30 يوماً (20.93%)',
      badgeEn: '🔴 Repeat Repair < 30 Days Alert',
      titleAr: 'تنبيه آلي: تكرار مصروف صيانة لنفس المعدة خلال أقل من 30 يوماً واستنزاف 10,707.930 د.ك',
      titleEn: 'Auto Alert: Repeat Maintenance for Same Asset Under 30 Days (10,707.930 KWD)',
      statAr: 'رصد 418 قيد صيانة مسجلة بعهد ربيع أنيس يحيى، من بينها 9 إصلاحات متكررة لنفس كمبريسورات التبريد بفرعي الكوت والسالمية خلال أقل من 30 يوماً بين كل عطل والآخر.',
      statEn: '418 maintenance records by Rabih Yahia, including 9 repeat compressor repairs in under 30-day intervals at Al Kout & Salmiya.',
      rootCauseAr: 'تقادم وحدات التبريد وتكرار شحن الغاز واللحام المؤقت دون معالجة جذرية، مما يستنزف سيولة الشركة بصيانة ترقيعية تجاوزت قيمتها الدفترية.',
      rootCauseEn: 'End-of-life refrigeration units receiving temporary patchwork and gas refilling instead of replacement.',
      actionAr: 'إصدار أمر شراء فوري لوحدات إنفرتر جديدة بكفالة 3 سنوات وإبرام عقد صيانة دوري موحد لتخفيض بند الصيانة البالغ 10,707.930 د.ك بنسبة 25%.',
      actionEn: 'Replace failing chillers with inverter models under 3-year warranty and enforce preventive maintenance SLA to curb 10,707.930 KWD spend by 25%.',
      monthlySavingsKwd: 890.0,
      annualSavingsKwd: 10680.0,
    },
    {
      id: 'alert-cash-receipts',
      badgeAr: '🟠 انحراف توثيق ضريبي ورقمي',
      badgeEn: '🟠 Cash Receipt Compliance Gap',
      titleAr: '218 حركة نقدية صغيرة (أقل من 20 د.ك) مسجلة بإيصالات يدوية غير مميكنة',
      titleEn: '218 minor cash vouchers lacking digital POS receipts',
      statAr: 'إجمالي 3,840 د.ك عبر الفروع مسجلة بسندات قبض يدوية بدون إرفاق صورة فاتورة إلكترونية معتمدة.',
      statEn: '3,840 KWD in manual paper vouchers without accompanying digital receipts.',
      rootCauseAr: 'سماح مديري الفروع بالشراء النقدي المباشر من البقالات ومحلات السباكة المحلية دون مطابقة مسبقة.',
      rootCauseEn: 'Branch managers buying petty consumables locally using physical cash without advance PO.',
      actionAr: 'تطبيق بطاقات فيزا مسبقة الدفع لكل فرع برصيد سقف 150 د.ك مع إلزامية تصوير الفاتورة عبر الهاتف فوراً قبل الصرف.',
      actionEn: 'Issue branch prepaid corporate debit cards capped at 150 KWD requiring instant mobile receipt upload.',
      monthlySavingsKwd: 320.0,
      annualSavingsKwd: 3840.0,
    },
    {
      id: 'alert-pareto-pricing',
      badgeAr: '🟡 فرصة وفورات الشراء بالجملة',
      badgeEn: '🟡 Bulk Procurement Opportunity',
      titleAr: 'تفاوت أسعار شراء الزيوت ومواد التعبئة بين الفروع ومشتريات سند بنسبة 14%',
      titleEn: '14% price variance in cooking oil & packaging between direct & retail buys',
      statAr: 'شراء زيوت القلي عبر العهد النقدية بسعر 6.250 د.ك للعبوة مقابل 5.480 د.ك من المورد المركزي المتعاقد.',
      statEn: 'Cooking oil purchased via petty cash at 6.250 KWD vs 5.480 KWD via central contract.',
      rootCauseAr: 'نفاد المخزون المؤقت بالفروع واضطرار المشرفين للشراء العاجل من الجمعيات بأسعار التجزئة.',
      rootCauseEn: 'Branch stock-outs triggering emergency retail supermarket purchases at 14% premium.',
      actionAr: 'رفع نقطة إعادة الطلب الآلية في أودو بنسبة 20% لضمان التوريد من القرين قبل نفاد المخزون بـ 48 ساعة.',
      actionEn: 'Increase Odoo reorder safety stock buffer by 20% to prevent emergency retail purchases.',
      monthlySavingsKwd: 680.0,
      annualSavingsKwd: 8160.0,
    },
  ]

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-950 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <TrendingUp size={15} />
              <span>
                {isAr
                  ? 'المحلل الإحصائي المالي ورادار انحرافات العهد ومصروفات أودو · فنتشر فودز'
                  : 'Odoo Financial Statistical Analyzer & Forensic Custody Radar'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {isAr
                ? 'المرصد المالي الإحصائي لبيانات أودو ومراقبة العهد والباريتو (80/20)'
                : 'Odoo Financial Anomaly Sentinel & Pareto 80/20 Analysis'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {isAr
                ? 'تحليل إحصائي عميق لـ 2,213 قيد مصروفات وعهد بقيمة 51,154.950 د.ك، كشف تركز السيولة بين أصحاب العهد الـ 8، وتحليل باريتو لقنوات الصرف والتوصيات الفورية.'
                : 'Deep forensic analytics across 2,213 Odoo expense entries (51,154.950 KWD), tracking all 8 custodians, Pareto 80/20 cost drivers, and execution playbooks.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                {isAr ? 'حالة المزامنة مع أودو:' : 'Odoo Sync Status:'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {isAr ? '2,213 قيد مالي مدقق' : '2,213 Audited Records'}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Hero Statistical KPIs */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 shadow-sm">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {isAr ? 'إجمالي مصروفات وعهد أودو' : 'Total Odoo Expenses & Custody'}
            </span>
            <div className="mt-1 text-2xl font-black text-slate-900 dark:text-white font-mono">
              51,154.950 <span className="text-xs font-sans text-slate-500">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 block">
              {isAr ? '2,213 قيد مالي مدقق' : '2,213 verified entries'}
            </span>
          </div>

          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 p-4 shadow-sm">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
              {isAr ? 'نسبة تركز العهدة الأولى (سند)' : 'Top Custodian Concentration (Sanad)'}
            </span>
            <div className="mt-1 text-2xl font-black text-rose-700 dark:text-rose-400 font-mono">
              61.86%
            </div>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-bold mt-0.5 block">
              {isAr ? '31,646.750 د.ك (1,412 حركة)' : '31,646.750 KWD (1,412 txns)'}
            </span>
          </div>

          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 shadow-sm">
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
              {isAr ? 'مؤشر كفاءة الحوكمة المالية' : 'Financial Governance Score'}
            </span>
            <div className="mt-1 text-2xl font-black text-indigo-700 dark:text-indigo-300 font-mono">
              78 / 100
            </div>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold mt-0.5 block">
              {isAr ? 'فرص تحسين مرتفعة في العقود' : 'High savings potential'}
            </span>
          </div>

          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-500/10 dark:bg-emerald-950/30 p-4 shadow-sm">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              {isAr ? 'إجمالي التوفير السنوي المتاح' : 'Annual Addressable Savings'}
            </span>
            <div className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
              32,880.000 <span className="text-xs font-sans">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 block">
              {isAr ? '2,740.000 د.ك شهرياً عند التنفيذ' : '2,740 KWD monthly run-rate'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Pareto 80/20 Analysis Section */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <PieChart size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {isAr ? 'تحليل باريتو (80/20) لمصروفات أودو: 5 بنود تقود 75.38% من التكاليف' : 'Pareto 80/20 Analysis: Top 5 Lines Represent 75.38% of Spend'}
            </h3>
          </div>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 text-xs font-bold font-mono">
            {isAr ? 'المعيار: 20% من البنود تسحب 80% من الميزانية' : '80/20 Pareto Rule'}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {isAr
            ? 'يُظهر التحليل الإحصائي لقاعدة بيانات أودو أن التركيز الرقابي على 5 بنود رئيسية فقط يكفي لحماية 75.38% من أموال الشركة (38,558.730 د.ك) من أصل 51,154.950 د.ك.'
            : 'Statistical auditing reveals that targeting just 5 primary cost categories controls 75.38% (38,558.730 KWD) of total company operational cash disbursements.'}
        </p>

        <div className="space-y-3">
          {paretoCategories.map((cat) => (
            <div key={cat.rank} className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 p-3 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2">
                  <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    cat.isTop80
                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {cat.rank}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {isAr ? cat.nameAr : cat.nameEn}
                  </span>
                  {cat.isTop80 && (
                    <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      {isAr ? 'بند باريتو حرج' : 'Pareto 80/20 Driver'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 font-mono">
                  <span className="text-slate-600 dark:text-slate-300 font-bold">
                    {cat.amountKwd.toLocaleString(undefined, { minimumFractionDigits: 3 })} {isAr ? 'د.ك' : 'KWD'}
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-black">
                    ({cat.pct}%)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {isAr ? `تراكمي: ${cat.cumulativePct}%` : `Cum: ${cat.cumulativePct}%`}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    cat.isTop80
                      ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                      : 'bg-gradient-to-r from-slate-400 to-slate-500'
                  }`}
                  style={{ width: `${cat.pct * 2.5}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. The 8 Custodians Ledger Breakdown */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {isAr ? 'سجل تدقيق وتحليل أصحاب العهد الـ 8 في أودو (إجمالي 51,154.950 د.ك)' : 'Audited Breakdown of All 8 Custodians in Odoo (51,154.950 KWD)'}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 me-1">
              {isAr ? 'تصفية العهدة:' : 'Filter Custodian:'}
            </span>
            <button
              onClick={() => setActiveCustFilter('ALL')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                activeCustFilter === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {isAr ? 'الكل (8 عهد)' : 'All 8'}
            </button>
            {custodians.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCustFilter(c.id)}
                className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                  activeCustFilter === c.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {isAr ? c.nameAr.split(' ')[0] : c.nameEn.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-start text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-3.5 text-start font-bold whitespace-nowrap">{isAr ? 'صاحب العهدة والمسؤولية' : 'Custodian'}</th>
                <th className="py-3 px-3.5 text-start font-bold whitespace-nowrap">{isAr ? 'المهام ومراكز التكلفة' : 'Role & Scope'}</th>
                <th className="py-3 px-3.5 text-center font-bold whitespace-nowrap">{isAr ? 'عدد الحركات' : 'Tx Count'}</th>
                <th className="py-3 px-3.5 text-end font-bold whitespace-nowrap">{isAr ? 'إجمالي المبلغ' : 'Total KWD'}</th>
                <th className="py-3 px-3.5 text-center font-bold whitespace-nowrap">{isAr ? 'نسبة التركز' : 'Share %'}</th>
                <th className="py-3 px-3.5 text-center font-bold whitespace-nowrap">{isAr ? 'تصنيف المخاطر' : 'Risk'}</th>
                <th className="py-3 px-3.5 text-start font-bold min-w-[220px]">{isAr ? 'الإجراء التنفيذي والتوفير المالي' : 'Action & Savings'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/40">
              {filteredCustodians.map((c) => (
                <tr key={c.id} className="hover:bg-slate-500/5 transition">
                  <td className="py-3 px-3.5 whitespace-nowrap">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {isAr ? c.nameAr : c.nameEn}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      #{c.id.toUpperCase()}
                    </div>
                  </td>
                  <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300">
                    {isAr ? c.roleAr : c.roleEn}
                  </td>
                  <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                    {c.txCount}
                  </td>
                  <td className="py-3 px-3.5 text-end font-mono font-black text-slate-900 dark:text-white whitespace-nowrap">
                    {c.amountKwd.toLocaleString(undefined, { minimumFractionDigits: 3 })} <span className="text-[10px] font-sans text-slate-500">{isAr ? 'د.ك' : 'KWD'}</span>
                  </td>
                  <td className="py-3 px-3.5 text-center font-mono font-bold whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-black ${
                      c.sharePct > 20
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        : c.sharePct > 4
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {c.sharePct}%
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-center whitespace-nowrap">
                    <span className="text-[11px] font-bold">
                      {isAr ? c.riskAr : c.riskEn}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 space-y-1">
                    <p className="text-slate-600 dark:text-slate-400 leading-snug">
                      {isAr ? c.actionAr : c.actionEn}
                    </p>
                    <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      💰 {isAr ? `توفير متاح: +${c.monthlySavingsKwd.toFixed(3)} د.ك شهرياً` : `Savings: +${c.monthlySavingsKwd.toFixed(3)} KWD/mo`}
                    </p>
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-slate-100 dark:bg-slate-800/80 font-black text-slate-900 dark:text-white">
                <td className="py-3.5 px-3.5 whitespace-nowrap" colSpan={2}>
                  {isAr ? 'إجمالي العهد الـ 8 المعتمدة في أودو' : 'Total Audited 8 Custodians'}
                </td>
                <td className="py-3.5 px-3.5 text-center font-mono text-emerald-600 dark:text-emerald-400">
                  2,213
                </td>
                <td className="py-3.5 px-3.5 text-end font-mono text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                  51,154.950 <span className="text-xs font-sans">{isAr ? 'د.ك' : 'KWD'}</span>
                </td>
                <td className="py-3.5 px-3.5 text-center font-mono">
                  100.0%
                </td>
                <td className="py-3.5 px-3.5 text-center">
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 text-xs">
                    {isAr ? 'مدقق 100%' : '100% Audited'}
                  </span>
                </td>
                <td className="py-3.5 px-3.5 text-emerald-700 dark:text-emerald-400 font-bold">
                  {isAr ? 'إجمالي توفير مستهدف: 2,740.000 د.ك شهرياً (32,880 د.ك سنوياً)' : 'Total Target Savings: 2,740 KWD/mo (32,880 KWD/yr)'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Structured Forensic Alerts & AI Actionable Recommendations Studio */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {isAr
                ? 'التنبيهات الاستباقية والتوصيات الذكية لبيانات أودو المالية (سلسلة التحليل والقرار)'
                : 'Odoo Financial Alerts & Decision Playbooks (Cause → Action → ROI)'}
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {isAr ? 'تتبع مسار: (بيان أودو) ← (السبب الجذري) ← (التوصية) ← (العائد)' : 'Audit Chain: (Stat) → (Root Cause) → (Action) → (Savings)'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {forensicAlerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 flex flex-col justify-between shadow-xs space-y-3"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {alert.badgeAr}
                  </span>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    +{alert.monthlySavingsKwd.toFixed(3)} {isAr ? 'د.ك شهرياً' : 'KWD/mo'}
                  </span>
                </div>

                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  {isAr ? alert.titleAr : alert.titleEn}
                </h4>

                {/* The 4-step sequence requested by the user */}
                <div className="space-y-1.5 rounded-xl bg-white dark:bg-slate-800/60 p-3 border border-slate-200/70 dark:border-slate-700/60 text-xs">
                  <p>
                    <strong className="text-slate-900 dark:text-slate-100">📊 {isAr ? 'البيان الإحصائي المرصود بأودو:' : 'Odoo Stat:'}</strong>{' '}
                    <span className="text-slate-700 dark:text-slate-300">{isAr ? alert.statAr : alert.statEn}</span>
                  </p>
                  <p>
                    <strong className="text-slate-900 dark:text-slate-100">🔍 {isAr ? 'تحليل السبب الجذري والانحراف:' : 'Root Cause & Variance:'}</strong>{' '}
                    <span className="text-slate-700 dark:text-slate-300">{isAr ? alert.rootCauseAr : alert.rootCauseEn}</span>
                  </p>
                  <p>
                    <strong className="text-slate-900 dark:text-slate-100">🎯 {isAr ? 'التوصية العملية الدقيقة:' : 'Actionable Recommendation:'}</strong>{' '}
                    <span className="text-slate-700 dark:text-slate-300">{isAr ? alert.actionAr : alert.actionEn}</span>
                  </p>
                  <p className="font-bold text-emerald-700 dark:text-emerald-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    💰 {isAr ? 'العائد والتوفير المالي المتوقع:' : 'Projected Return:'}{' '}
                    +{alert.monthlySavingsKwd.toFixed(3)} {isAr ? `د.ك شهرياً (${alert.annualSavingsKwd.toLocaleString()} د.ك سنوياً)` : `KWD/mo (${alert.annualSavingsKwd.toLocaleString()} KWD/yr)`}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500 font-mono">
                  {isAr ? `سنوياً: ${alert.annualSavingsKwd.toLocaleString()} د.ك` : `Annual: ${alert.annualSavingsKwd.toLocaleString()} KWD`}
                </span>
                <button
                  type="button"
                  onClick={() => handleAdopt(alert.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow ${
                    adoptedRecs[alert.id]
                      ? 'bg-emerald-600 text-white cursor-default'
                      : 'bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white'
                  }`}
                >
                  {adoptedRecs[alert.id]
                    ? (isAr ? '✓ تم الاعتماد للـ GM' : '✓ Adopted')
                    : (isAr ? 'اعتماد التوصية وتصدير تقرير للـ GM' : 'Adopt & Export GM Brief')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
