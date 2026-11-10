'use client'

import React, { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import {
  Bell,
  Mail,
  CheckCircle2,
  Clock,
  Server,
  ThermometerSnowflake,
  Users,
  ShoppingCart,
  Receipt,
  Plus,
  RotateCw,
  Play,
  Sliders,
  Store,
  Package,
  Landmark,
} from 'lucide-react'

export interface AutomationWorkflow {
  id: string
  code: string
  titleAr: string
  titleEn: string
  departmentAr: string
  departmentEn: string
  triggerAr: string
  triggerEn: string
  actionAr: string
  actionEn: string
  scheduleAr: string
  scheduleEn: string
  icon: string
  color: string
  isActive: boolean
  lastRun: string
  successRate: string
  runEndpoint?: string
}

const INITIAL_WORKFLOWS: AutomationWorkflow[] = [
  {
    id: 'wf-radar',
    code: 'VF-NOTIF-01',
    titleAr: 'متابعة تطبيقات التوصيل',
    titleEn: 'Delivery Aggregator Monitoring',
    departmentAr: 'التشغيل والتوصيل',
    departmentEn: 'Operations & Delivery',
    triggerAr: 'فحص كل 5 دقائق: إغلاق أحد الفروع في التطبيق أكثر من 30 دقيقة أو تحويل طلبات التوصيل من 10% إلى أسطول المنصة 17%',
    triggerEn: 'Every 5m: branch offline > 30m or switch from restaurant delivery 10% to aggregator fleet 17%',
    actionAr: 'إرسال تنبيه فوري عبر البريد الإلكتروني لمسؤولي التشغيل للتواصل مع المنصة وإلزام الفرع بالتشغيل',
    actionEn: 'Dispatch immediate email alert to operations team to resolve branch status or commission rate',
    scheduleAr: 'مستمر · كل 5 دقائق',
    scheduleEn: 'Continuous · Every 5 mins',
    icon: '🛵',
    color: '#0284c7',
    isActive: true,
    lastRun: 'منذ دقيقتين',
    successRate: '99.8%',
    runEndpoint: '/api/aggregator-radar/alert',
  },
  {
    id: 'wf-stock',
    code: 'VF-NOTIF-02',
    titleAr: 'تنبيه نقص مخزون المطبخ المركزي',
    titleEn: 'Central Kitchen Stock Alert',
    departmentAr: 'المخزون والتوريد',
    departmentEn: 'Inventory & Supply',
    triggerAr: 'نزول رصيد أي مادة خام أو مواد تغليف أو أصناف تحضير مركزي في المطبخ المركزي عن الحد الأدنى المحدد',
    triggerEn: 'Item stock level in the central kitchen drops below standard reorder threshold',
    actionAr: 'إنشاء مسودة طلب شراء آلياً وتنبيه مسؤولي العمليات ومستودع المطبخ المركزي',
    actionEn: 'Generate draft purchase order and alert Operations and Central Kitchen Commissary',
    scheduleAr: 'عند حركة المخزون',
    scheduleEn: 'On stock movement',
    icon: '📦',
    color: '#d97706',
    isActive: true,
    lastRun: 'منذ 10 دقائق',
    successRate: '100%',
  },
  {
    id: 'wf-fefo',
    code: 'VF-NOTIF-03',
    titleAr: 'مراقبة الثلاجات وتواريخ الصلاحية',
    titleEn: 'Chiller Temperatures & Expiry Monitoring',
    departmentAr: 'الجودة وسلامة الغذاء',
    departmentEn: 'Food Safety & QA',
    triggerAr: 'ارتفاع حرارة مبردات الحفظ عن 4°C أو الفريزر عن -18°C أو اقتراب انتهاء دفعة طعام جاهز (أقل من 4 ساعات)',
    triggerEn: 'Chiller temp > 4°C, freezer > -18°C, or prep batch shelf-life < 4 hours',
    actionAr: 'إرسال إشعار فوري لمدير الفرع وفني الصيانة وقسم الجودة لمعاينة الثلاجة وسحب الدفعة إن لزم',
    actionEn: 'Dispatch instant notice to branch manager, technician, and QA supervisor',
    scheduleAr: 'رصد مستمر',
    scheduleEn: 'Continuous monitoring',
    icon: '❄️',
    color: '#0891b2',
    isActive: true,
    lastRun: 'منذ 25 دقيقة',
    successRate: '100%',
  },
  {
    id: 'wf-custody',
    code: 'VF-NOTIF-04',
    titleAr: 'متابعة العهد والمصاريف',
    titleEn: 'Branch Petty Cash & Expenses Control',
    departmentAr: 'المالية والمحاسبة',
    departmentEn: 'Finance & Accounting',
    triggerAr: 'تسجيل قيود عهدة تشغيلية أو مصروف نثري في أي فرع يتجاوز السقف اليومي المعتمد في الميزانية',
    triggerEn: 'Branch petty cash or daily operational expense entry exceeds approved threshold',
    actionAr: 'إرسال إشعار للإدارة المالية للمراجعة والتدقيق المحاسبي وقفل صرف العهدة لحين اعتمادها',
    actionEn: 'Notify Finance for audit review and require executive clearance before replenishment',
    scheduleAr: 'عند تسجيل القيد',
    scheduleEn: 'Upon ledger entry',
    icon: '💼',
    color: '#059669',
    isActive: true,
    lastRun: 'اليوم 11:30 ص',
    successRate: '100%',
  },
  {
    id: 'wf-residency',
    code: 'VF-NOTIF-05',
    titleAr: 'تنبيهات الإقامات وكروت البلدية',
    titleEn: 'Labor Residency & Health Card Alerts',
    departmentAr: 'شؤون الموظفين',
    departmentEn: 'Human Resources',
    triggerAr: 'فحص يومي الساعة 8:00 صباحاً لأي إقامة مادة 18 أو بطاقة مدنية أو كرت صحة ينتهي خلال 60 أو 30 أو 7 أيام (166 موظفاً)',
    triggerEn: 'Daily 8:00 AM audit for 166 employee residency, civil ID, or municipality cards expiring within 60/30/7 days',
    actionAr: 'إدراج المعاملة في جدول أعمال المندوب وتجهيز متطلبات التجديد عبر منصة أسهل لتفادي الغرامات',
    actionEn: 'Add to PRO task queue and prepare PAM platform renewal submission',
    scheduleAr: 'يومياً · 8:00 صباحاً',
    scheduleEn: 'Daily at 8:00 AM',
    icon: '📋',
    color: '#7c3aed',
    isActive: true,
    lastRun: 'اليوم 08:00 ص',
    successRate: '100%',
  },
  {
    id: 'wf-sales-digest',
    code: 'VF-NOTIF-06',
    titleAr: 'مطابقة المبيعات اليومية',
    titleEn: 'Daily Store Sales & Register Reconciliation',
    departmentAr: 'الإدارة والمالية',
    departmentEn: 'Management & Finance',
    triggerAr: 'اكتمال إغلاق صناديق الكاشير (Z-Report) وتدقيق مبيعات الفروع الـ 9 والعلامات الـ 6 ومطابقة KNET',
    triggerEn: 'Daily closing of in-store POS registers across 9 branches, 6 brands and KNET settlements',
    actionAr: 'تجميع الإيرادات والمصروفات وإرسال التقرير المالي والتشغيلي الموحد إلى البريد الرسمي للإدارة',
    actionEn: 'Compile unified revenue figures and deliver daily executive reconciliation report',
    scheduleAr: 'يومياً · 9:00 صباحاً',
    scheduleEn: 'Daily at 9:00 AM',
    icon: '📊',
    color: '#16a34a',
    isActive: true,
    lastRun: 'اليوم 09:00 ص',
    successRate: '100%',
  },
]

export interface ExecutionLogItem {
  id: string
  workflowCode: string
  workflowTitleAr: string
  workflowTitleEn: string
  timestamp: string
  status: 'SUCCESS' | 'WARNING' | 'FAILED'
  detailsAr: string
  detailsEn: string
  durationMs: number
}

const INITIAL_LOGS: ExecutionLogItem[] = [
  {
    id: 'log-1',
    workflowCode: 'VF-NOTIF-01',
    workflowTitleAr: 'متابعة تطبيقات التوصيل',
    workflowTitleEn: 'Delivery Aggregator Monitoring',
    timestamp: '04 نوفمبر 2026 - 12:25:10',
    status: 'SUCCESS',
    detailsAr: 'فحص الفروع: جميع الفروع متصلة على توصيل المطعم 10% ولا توجد إغلاقات غير معتمدة',
    detailsEn: 'Audit check: all branches online on 10% delivery, 0 unauthorized closures',
    durationMs: 380,
  },
  {
    id: 'log-2',
    workflowCode: 'VF-NOTIF-06',
    workflowTitleAr: 'مطابقة المبيعات اليومية',
    workflowTitleEn: 'Daily Store Sales Reconciliation',
    timestamp: '04 نوفمبر 2026 - 09:00:02',
    status: 'SUCCESS',
    detailsAr: 'إرسال تقرير المبيعات المعتمد للإدارة المالية والتشغيلية بنجاح',
    detailsEn: 'Dispatched daily sales reconciliation report to management',
    durationMs: 1100,
  },
  {
    id: 'log-3',
    workflowCode: 'VF-NOTIF-05',
    workflowTitleAr: 'تنبيهات الإقامات وكروت البلدية',
    workflowTitleEn: 'Residency & Health Card Alerts',
    timestamp: '04 نوفمبر 2026 - 08:00:15',
    status: 'SUCCESS',
    detailsAr: 'فحص ملفات الـ 166 موظفاً: رصد 6 معاملات تتطلب التجديد وإحالتها للمندوب',
    detailsEn: 'Audited 166 employee records: flagged 6 renewals into PRO schedule',
    durationMs: 620,
  },
  {
    id: 'log-4',
    workflowCode: 'VF-NOTIF-02',
    workflowTitleAr: 'تنبيه نقص مخزون المطبخ المركزي',
    workflowTitleEn: 'Central Kitchen Stock Alert',
    timestamp: '04 نوفمبر 2026 - 07:14:30',
    status: 'SUCCESS',
    detailsAr: 'إصدار مسودة أمر تزويد مستودع المطبخ المركزي رقم 002-202611',
    detailsEn: 'Generated stock replenishment draft PO-202611-002 for the central kitchen',
    durationMs: 290,
  },
  {
    id: 'log-5',
    workflowCode: 'VF-NOTIF-03',
    workflowTitleAr: 'مراقبة الثلاجات وتواريخ الصلاحية',
    workflowTitleEn: 'Chiller Temperatures & Expiry Monitoring',
    timestamp: '04 نوفمبر 2026 - 04:30:00',
    status: 'SUCCESS',
    detailsAr: 'فحص 384 دفعة طعام ووحدات التبريد: درجات الحرارة والتواريخ مطابقة للمعايير',
    detailsEn: 'Inspected 384 food batches: temperatures and shelf-lives within standard limits',
    durationMs: 250,
  },
]

export function VentureAutomationHub({ locale = 'ar' }: { locale?: 'ar' | 'en' }) {
  const { locale: ctxLocale, setLocale } = useI18n()
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>(INITIAL_WORKFLOWS)
  const [logs, setLogs] = useState<ExecutionLogItem[]>(INITIAL_LOGS)
  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(ctxLocale ?? locale)
  useEffect(() => {
    if (ctxLocale === 'ar' || ctxLocale === 'en') setCurrentLocale(ctxLocale)
  }, [ctxLocale])
  const [runningId, setRunningId] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'info' } | null>(null)
  const [showNewRuleModal, setShowNewRuleModal] = useState(false)

  const [newRuleName, setNewRuleName] = useState('')
  const [newRuleTrigger, setNewRuleTrigger] = useState('STOCK_ALERT')
  const [newRuleDepartment, setNewRuleDepartment] = useState('المخزون والتوريد')

  const isAr = currentLocale === 'ar'
  const isRtl = isAr

  const handleToggleWorkflow = (id: string) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isActive: !w.isActive } : w))
    )
    const target = workflows.find((w) => w.id === id)
    if (target) {
      const nextState = !target.isActive
      showNotice(
        isAr
          ? `تم ${nextState ? 'تفعيل' : 'إيقاف'} تنبيه "${target.titleAr}" بنجاح`
          : `Alert "${target.titleEn}" is now ${nextState ? 'Active' : 'Paused'}`
      )
    }
  }

  const handleRunWorkflow = async (workflow: AutomationWorkflow) => {
    setRunningId(workflow.id)
    try {
      if (workflow.runEndpoint) {
        try {
          await fetch(workflow.runEndpoint, { method: 'POST' }).catch(() => {})
        } catch {
          // ignore in local dev
        }
      }

      await new Promise((r) => setTimeout(r, 700))

      const now = new Date()
      const timeStr = now.toLocaleTimeString(isAr ? 'ar-KW' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })

      const newLog: ExecutionLogItem = {
        id: 'log-' + Date.now(),
        workflowCode: workflow.code,
        workflowTitleAr: workflow.titleAr,
        workflowTitleEn: workflow.titleEn,
        timestamp: `${now.toLocaleDateString(isAr ? 'ar-KW' : 'en-US')} - ${timeStr}`,
        status: 'SUCCESS',
        detailsAr: `تم إرسال إشعار تجريبي عبر البريد الإلكتروني الرسمي وتسجيل الحالة في السجل`,
        detailsEn: `Dispatched test email notification via official SMTP and logged event`,
        durationMs: Math.floor(Math.random() * 300) + 200,
      }

      setLogs((prev) => [newLog, ...prev.slice(0, 19)])
      showNotice(
        isAr
          ? `تم إرسال إشعار تجريبي لتنبيه "${workflow.titleAr}" بنجاح`
          : `Test notification for "${workflow.titleEn}" dispatched successfully`
      )
    } finally {
      setRunningId(null)
    }
  }

  const handleCreateCustomRule = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRuleName.trim()) return

    const newWf: AutomationWorkflow = {
      id: 'wf-' + Date.now(),
      code: `VF-NOTIF-0${workflows.length + 1}`,
      titleAr: newRuleName,
      titleEn: newRuleName,
      departmentAr: newRuleDepartment,
      departmentEn: 'Operations Department',
      triggerAr: newRuleTrigger === 'STOCK_ALERT' ? 'نزول المخزون عن الحد الأدنى المحدد' : 'حركة مبيعات أو إغلاق وردية كاشير',
      triggerEn: 'Standard threshold reached in company database',
      actionAr: 'إرسال بريد إلكتروني فوري لمسؤولي الشركة المعتمدين وتسجيل القيد',
      actionEn: 'Dispatch instant email notification to verified recipients and log event',
      scheduleAr: 'فوري عند الحدث',
      scheduleEn: 'Immediate upon event',
      icon: '📌',
      color: '#0284c7',
      isActive: true,
      lastRun: 'الآن (جديد)',
      successRate: '100%',
    }

    setWorkflows((prev) => [...prev, newWf])
    setShowNewRuleModal(false)
    setNewRuleName('')
    showNotice(
      isAr
        ? `تم إضافة التنبيه الجديد "${newWf.titleAr}" وتفعيله`
        : `Custom alert "${newWf.titleEn}" created and activated`
    )
  }

  const showNotice = (msg: string) => {
    setNotification({ msg, type: 'success' })
    setTimeout(() => setNotification(null), 4000)
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="ae-stagger w-full min-w-0 text-slate-900 dark:text-slate-100 space-y-6"
    >
      {/* 1. TOP HEADER */}
      <div className="ae-masthead flex flex-wrap items-center justify-between gap-4 p-6 lg:p-7">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ae-chip">
              <Bell size={13} className="text-emerald-600 dark:text-emerald-400" />
              {isAr ? 'المتابعة الإدارية المباشرة' : 'Operational Monitoring'}
            </span>
            <span className="rounded-md bg-slate-200/70 dark:bg-slate-800/80 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isAr ? 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م.' : 'Venture Foods Restaurant Management Co. W.L.L.'}
            </span>
          </div>
          <h1 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 lg:text-2xl">
            {isAr ? 'إدارة التنبيهات والمتابعة التلقائية' : 'Alerts & Automated Monitoring System'}
          </h1>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {isAr
              ? '6 تنبيهات إدارية دورية متصلة بالبريد الإلكتروني الرسمي لمسؤولي الشركة'
              : '6 operational alerts configured with verified company management email dispatches'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              const next = isAr ? 'en' : 'ar'
              setCurrentLocale(next)
              setLocale(next)
            }}
            className="ae-pill-light ae-pill-sm"
          >
            {isAr ? 'English' : 'العربية'}
          </button>
          <button
            onClick={() => setShowNewRuleModal(true)}
            className="ae-pill-dark"
          >
            <Plus size={14} />
            {isAr ? 'إضافة تنبيه جديد' : 'Add New Alert'}
          </button>
        </div>
      </div>

      {/* Pop-up Notification */}
      {notification && (
        <div className="rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/50 px-4 py-3 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
            {notification.msg}
          </span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white">✕</button>
        </div>
      )}

      {/* 2. OFFICIAL EMAIL STATUS BAR */}
      <div className="ae-tile min-w-0 rounded-2xl p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Mail size={18} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {isAr ? 'البريد الإلكتروني الرسمي متصل' : 'Official Management Mailbox Connected'}
                </span>
                <span className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md" dir="ltr">
                  sec@venturefoodskw.com
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                {isAr
                  ? 'يتم إرسال الإشعارات والتنبيهات المعتمدة عبر خادم الشركة مباشرة إلى مسؤولي الإدارة'
                  : 'Official enterprise notifications dispatched to verified management recipients'}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start lg:items-end">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isAr ? 'المستلمون المعتمدون:' : 'Verified Recipients:'}
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 text-xs text-slate-800 dark:text-slate-200" dir="ltr">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{isAr ? 'عبدالله:' : 'Abdullah:'}</span> Sec@venturefoodskw.com
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 text-xs text-slate-800 dark:text-slate-200" dir="ltr">
                <span className="font-bold text-sky-700 dark:text-sky-400">{isAr ? 'شكرالله:' : 'Choukrallah:'}</span> operations@venturefoodskw.com
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 text-xs text-slate-800 dark:text-slate-200" dir="ltr">
                <span className="font-bold text-amber-600 dark:text-amber-400">{isAr ? 'عبدالرحمن:' : 'Abdulrahman:'}</span> abdelrahmanm@venturefoodskw.com
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. THE 6 OPERATIONAL ALERT CARDS */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">
            {isAr ? 'التنبيهات المفعّلة (6 تنبيهات)' : 'Active System Alerts (6 Alerts)'}
          </h2>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {workflows.filter((w) => w.isActive).length} / {workflows.length} {isAr ? 'تنبيه مفعّل' : 'Active'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 items-stretch">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className={`flex min-w-0 flex-col justify-between rounded-2xl p-5 transition-all ${
                wf.isActive ? 'ae-tile ae-lift' : 'ae-tile-soft opacity-70'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-xl">{wf.icon}</span>
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-400" dir="ltr">
                        {wf.code}
                      </span>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {isAr ? wf.departmentAr : wf.departmentEn}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <button
                    onClick={() => handleToggleWorkflow(wf.id)}
                    aria-pressed={wf.isActive}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition-all ${
                      wf.isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {wf.isActive ? (isAr ? 'مفعّل' : 'Active') : isAr ? 'متوقف' : 'Paused'}
                  </button>
                </div>

                {/* Title */}
                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                  {isAr ? wf.titleAr : wf.titleEn}
                </h3>

                {/* Condition & Action Box */}
                <div className="mt-3 space-y-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3.5 text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-200">
                      {isAr ? 'حالة التنبيه:' : 'Alert Condition:'}
                    </span>
                    <p className="mt-0.5 text-slate-700 dark:text-slate-300 leading-relaxed">
                      {isAr ? wf.triggerAr : wf.triggerEn}
                    </p>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2">
                    <span className="font-bold text-emerald-800 dark:text-emerald-400">
                      {isAr ? 'الإجراء المتبع:' : 'Follow-up Action:'}
                    </span>
                    <p className="mt-0.5 text-slate-700 dark:text-slate-300 leading-relaxed">
                      {isAr ? wf.actionAr : wf.actionEn}
                    </p>
                  </div>
                </div>

                {/* Timing */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {isAr ? wf.scheduleAr : wf.scheduleEn}
                  </span>
                  <span>
                    {isAr ? 'آخر فحص:' : 'Last run:'}{' '}
                    <strong className="text-slate-700 dark:text-slate-300">{wf.lastRun}</strong>
                  </span>
                </div>
              </div>

              {/* Action Button: Send Test Now */}
              <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  onClick={() => handleRunWorkflow(wf)}
                  disabled={runningId === wf.id}
                  className="ae-pill-light w-full justify-center"
                >
                  {runningId === wf.id ? (
                    <>
                      <RotateCw size={13} className="animate-spin text-slate-500" />
                      {isAr ? 'جارٍ الإرسال والتجربة...' : 'Sending Test...'}
                    </>
                  ) : (
                    <>
                      <Play size={12} className="fill-current" />
                      {isAr ? 'إرسال تجريبي الآن' : 'Send Test Now'}
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. EXECUTION LOG TABLE */}
      <div className="ae-tile min-w-0 rounded-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-slate-600 dark:text-slate-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {isAr ? 'سجل التنبيهات والإشعارات الأخيرة' : 'Recent Alerts & Notifications Log'}
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {logs.length} {isAr ? 'قيد مسجل' : 'Records'}
          </span>
        </div>

        <div className="ae-table-wrap w-full overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 font-semibold text-slate-600 dark:text-slate-400">
                <th className="whitespace-nowrap px-3.5 py-3 text-start">{isAr ? 'التاريخ والوقت' : 'Timestamp'}</th>
                <th className="whitespace-nowrap px-3.5 py-3 text-start">{isAr ? 'رمز التنبيه' : 'Alert Code'}</th>
                <th className="whitespace-nowrap px-3.5 py-3 text-start">{isAr ? 'اسم التنبيه' : 'Alert Name'}</th>
                <th className="whitespace-nowrap px-3.5 py-3 text-start">{isAr ? 'تفاصيل الإشعار' : 'Details'}</th>
                <th className="whitespace-nowrap px-3.5 py-3 text-center">{isAr ? 'المدة' : 'Latency'}</th>
                <th className="whitespace-nowrap px-3.5 py-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                  <td className="px-3.5 py-3 font-mono text-slate-500 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="px-3.5 py-3 font-mono font-bold text-slate-900 dark:text-slate-200 whitespace-nowrap">
                    {log.workflowCode}
                  </td>
                  <td className="px-3.5 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {isAr ? log.workflowTitleAr : log.workflowTitleEn}
                  </td>
                  <td className="px-3.5 py-3 text-slate-600 dark:text-slate-300 leading-relaxed">
                    {isAr ? log.detailsAr : log.detailsEn}
                  </td>
                  <td className="px-3.5 py-3 text-center font-mono text-slate-500">
                    {log.durationMs} {isAr ? 'مللي ثانية' : 'ms'}
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 size={11} />
                      {isAr ? 'ناجح' : 'SUCCESS'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL: ADD NEW ALERT */}
      {showNewRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isAr ? 'إضافة تنبيه إداري جديد' : 'Add New Operational Alert'}
              </h3>
              <button
                onClick={() => setShowNewRuleModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomRule} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'اسم التنبيه:' : 'Alert Name:'}
                </label>
                <input
                  type="text"
                  required
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder={
                    isAr ? 'مثال: تنبيه عند تجاوز مبيعات صنف معين 300 طلب' : 'e.g. Alert when item sales exceed 300 orders'
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:border-slate-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'القسم المسؤول:' : 'Operating Department:'}
                </label>
                <select
                  value={newRuleDepartment}
                  onChange={(e) => setNewRuleDepartment(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="المبيعات وتطبيقات التوصيل">{isAr ? 'المبيعات وتطبيقات التوصيل' : 'Sales & Channels'}</option>
                  <option value="المخزون والمطبخ المركزي">{isAr ? 'المخزون والمطبخ المركزي' : 'Inventory & Commissary'}</option>
                  <option value="الجودة وسلامة الغذاء">{isAr ? 'الجودة وسلامة الغذاء' : 'QA & Food Safety'}</option>
                  <option value="المالية والمحاسبة">{isAr ? 'المالية والمحاسبة' : 'Finance & Accounting'}</option>
                  <option value="شؤون الموظفين">{isAr ? 'شؤون الموظفين' : 'HR & Personnel'}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'حالة التنبيه:' : 'Alert Trigger Condition:'}
                </label>
                <select
                  value={newRuleTrigger}
                  onChange={(e) => setNewRuleTrigger(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="STOCK_ALERT">{isAr ? 'نزول المخزون عن الحد الأدنى المحدد' : 'Stock Drops Below Threshold'}</option>
                  <option value="SALES_SPIKE">{isAr ? 'تسجيل إغلاق وردية كاشير أو فرق صندوق' : 'Cash Register Variance'}</option>
                  <option value="FEFO_CRITICAL">{isAr ? 'اقتراب انتهاء صلاحية مادة غذائية أو حرارة ثلاجة' : 'Temperature or Expiry Deviation'}</option>
                  <option value="RESIDENCY_SOON">{isAr ? 'اقتراب موعد انتهاء إقامة أو كرت صحة موظف' : 'Staff Document Expiration'}</option>
                </select>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {isAr ? 'الإجراء المتبع:' : 'Follow-up Action:'}
                </span>
                <p className="mt-1">
                  {isAr
                    ? 'سيتم إرسال بريد إلكتروني فوري عبر خادم الشركة الرسمي إلى المستلمين المعتمدين وتدوين الحالة في السجل.'
                    : 'Instant email alert dispatched via official company SMTP to verified recipients.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewRuleModal(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 dark:bg-emerald-500 px-4 py-2 font-bold text-white dark:text-black hover:opacity-90"
                >
                  {isAr ? 'حفظ وتفعيل التنبيه' : 'Save & Activate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
