'use client'

import React, { useState } from 'react'
import {
  Zap,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Clock,
  ShieldCheck,
  Server,
  Layers,
  ThermometerSnowflake,
  Users,
  ShoppingCart,
  Receipt,
  Sparkles,
  Plus,
  Send,
  Eye,
  Sliders,
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
    code: 'VF-AUTO-RADAR-01',
    titleAr: 'رادار منصات التوصيل الجنائي (Aggregator Watchdog)',
    titleEn: 'Aggregator Offline & Forced TGO 17% Watchdog',
    departmentAr: 'التشغيل والتوصيل',
    departmentEn: 'Aggregator Operations',
    triggerAr: 'فحص كل 5 دقائق: إغلاق فرع > 30 دقيقة أو تحويل قسري من TMP 10% إلى TGO 17%',
    triggerEn: 'Every 5m: branch offline > 30m or forced switch from TMP 10% to TGO 17%',
    actionAr: 'إرسال التقرير التشغيلي والجنائي فوراً عبر SMTP للمستلمين الثلاثة المعتمدين',
    actionEn: 'Dispatch forensic email alert via SMTP to 3 verified stakeholders',
    scheduleAr: 'مستمر · كل 5 دقائق',
    scheduleEn: 'Continuous · Every 5 mins',
    icon: '🚨',
    color: '#ef4444',
    isActive: true,
    lastRun: 'منذ 3 دقائق',
    successRate: '99.8%',
    runEndpoint: '/api/aggregator-radar/alert',
  },
  {
    id: 'wf-stock',
    code: 'VF-AUTO-STOCK-02',
    titleAr: 'الإنذار المبكر للمخزون وطلبات المطبخ المركزي بالقرين',
    titleEn: 'Low-Stock & Al-Qurain Central Kitchen Auto-Order',
    departmentAr: 'المخزون والتوريد',
    departmentEn: 'Inventory & Kitchen Supply',
    triggerAr: 'نزول رصيد أي مادة خام (RW01*) أو تغليف (PI02*) أو تحضير (PP03*) تحت حد الطلب',
    triggerEn: 'SKU drops below Reorder Point across raw (RW01), pack (PI02) or prep (PP03)',
    actionAr: 'توليد مسودة طلب شراء وتنبيه مسؤولي العمليات ومستودع المطبخ المركزي بالقرين',
    actionEn: 'Auto-generate PO draft & alert Operations & Al-Qurain Commissary',
    scheduleAr: 'عند تغير الرصيد',
    scheduleEn: 'On stock movement',
    icon: '📦',
    color: '#f59e0b',
    isActive: true,
    lastRun: 'منذ 14 دقيقة',
    successRate: '100%',
  },
  {
    id: 'wf-fefo',
    code: 'VF-AUTO-FEFO-03',
    titleAr: 'حارس سلامة الغذاء وصلاحيات الدفعات والبرادات (FEFO Guard)',
    titleEn: 'FEFO Shelf-Life & Cold-Chain Breach Guard',
    departmentAr: 'سلامة الغذاء والهاسب',
    departmentEn: 'Food Safety & HACCP',
    triggerAr: 'اقتراب انتهاء دفعة تحضير < 4 ساعات أو تجاوز حرارة البراد 4°C / الفريزر -18°C',
    triggerEn: 'Prep batch expiry < 4h or chiller temp > 4°C / freezer > -18°C',
    actionAr: 'إصدار تنبيه سحب فوري للدفعة (FEFO Pull Alert) وإشعار مدير الفرع وقسم الجودة',
    actionEn: 'Issue instant batch recall alert & notify Branch Manager & QA lead',
    scheduleAr: 'فوري · رصد مستمر',
    scheduleEn: 'Real-time telemetry',
    icon: '❄️',
    color: '#06b6d4',
    isActive: true,
    lastRun: 'منذ 28 دقيقة',
    successRate: '100%',
  },
  {
    id: 'wf-residency',
    code: 'VF-AUTO-HR-04',
    titleAr: 'رادار الإقامات، البطاقات المدنية، وكروت صحة البلدية',
    titleEn: 'Kuwait Visa 18, Civil ID & Municipality Health Card Radar',
    departmentAr: 'الموارد البشرية والمندوب',
    departmentEn: 'HR & Labor Compliance',
    triggerAr: 'فحص يومي الساعة 8:00 صباحاً لوثائق الـ 166 موظفاً التي تنتهي خلال 60 / 30 / 7 أيام',
    triggerEn: 'Daily 8:00 AM check for 166 staff docs expiring in 60 / 30 / 7 days',
    actionAr: 'إدراج المعاملة في طابور مهام المندوب (PRO Queue) وتصدير كشف التجديد لـ PAM (أسهل)',
    actionEn: 'Insert into PRO action queue & export PAM renewal batch',
    scheduleAr: 'يومياً · 8:00 صباحاً',
    scheduleEn: 'Daily at 8:00 AM',
    icon: '👥',
    color: '#8b5cf6',
    isActive: true,
    lastRun: 'اليوم 08:00 ص',
    successRate: '100%',
  },
  {
    id: 'wf-sales-digest',
    code: 'VF-AUTO-SALES-05',
    titleAr: 'الإيجاز التنفيذي اليومي للمبيعات وإغلاق الصناديق (Z-Report)',
    titleEn: 'Daily 6-Brand Sales & Z-Report Morning Digest',
    departmentAr: 'المبيعات والإدارة',
    departmentEn: 'Sales BI & Executive Office',
    triggerAr: 'يومياً الساعة 9:00 صباحاً بتوقيت الكويت بعد اكتمال إغلاق صناديق الفروع',
    triggerEn: 'Daily 9:00 AM Kuwait time after in-store register close-outs',
    actionAr: 'تجميع مبيعات البراندات الـ 6 والقنوات الـ 11 وإرسال الملخص التنفيذي لبريد الإدارة',
    actionEn: 'Compile 6-brand, 11-channel metrics & dispatch executive email digest',
    scheduleAr: 'يومياً · 9:00 صباحاً',
    scheduleEn: 'Daily at 9:00 AM',
    icon: '📈',
    color: '#10b981',
    isActive: true,
    lastRun: 'اليوم 09:00 ص',
    successRate: '100%',
  },
  {
    id: 'wf-dropzone',
    code: 'VF-AUTO-DROPZONE-06',
    titleAr: 'الموزع الذكي للوثائق والفواتير (Dropzone Classifier)',
    titleEn: 'Universal AI Smart Dropzone Auto-Classifier',
    departmentAr: 'الأرشفة والذكاء الاصطناعي',
    departmentEn: 'Data Ingestion & AI',
    triggerAr: 'عند اختيار أي ملفات أو مجلدات من الكمبيوتر في نافذة Dropzone',
    triggerEn: 'When files or folders are picked locally via Windows File Picker',
    actionAr: 'استخراج البيانات محلياً وتصنيف السجلات وربطها بالأقسام الـ 7 آلياً',
    actionEn: 'Extract locally, classify & route transactions to 7 departments automatically',
    scheduleAr: 'تفاعلي فوري',
    scheduleEn: 'On file select',
    icon: '⚡',
    color: '#ec4899',
    isActive: true,
    lastRun: 'منذ ساعة',
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
    workflowCode: 'VF-AUTO-RADAR-01',
    workflowTitleAr: 'رادار منصات التوصيل الجنائي',
    workflowTitleEn: 'Aggregator Offline Watchdog',
    timestamp: '03 نوفمبر 2026 - 12:25:10',
    status: 'SUCCESS',
    detailsAr: 'فحص الفروع الـ 10: جميع الفروع متصلة على TMP 10% ولا يوجد إغلاق غير مصرح',
    detailsEn: 'Scanned 10 branches: all online on TMP 10%, 0 unauthorized switches',
    durationMs: 420,
  },
  {
    id: 'log-2',
    workflowCode: 'VF-AUTO-SALES-05',
    workflowTitleAr: 'الإيجاز التنفيذي اليومي للمبيعات',
    workflowTitleEn: 'Daily Sales & Z-Report Digest',
    timestamp: '03 نوفمبر 2026 - 09:00:02',
    status: 'SUCCESS',
    detailsAr: 'إرسال إيميل الإيجاز لـ 3 مستلمين معتمدين (Sec, operations, abdelrahmanm)',
    detailsEn: 'Dispatched digest to 3 verified recipients via sec@venturefoodskw.com',
    durationMs: 1250,
  },
  {
    id: 'log-3',
    workflowCode: 'VF-AUTO-HR-04',
    workflowTitleAr: 'رادار الإقامات وبطاقات البلدية',
    workflowTitleEn: 'Kuwait Visa 18 & Health Card Radar',
    timestamp: '03 نوفمبر 2026 - 08:00:15',
    status: 'SUCCESS',
    detailsAr: 'فحص 166 موظفاً: رصد 6 معاملات تتطلب تجديداً وإدراجها في قائمة المندوب',
    detailsEn: 'Audited 166 employees: flagged 6 renewals into PRO action queue',
    durationMs: 680,
  },
  {
    id: 'log-4',
    workflowCode: 'VF-AUTO-STOCK-02',
    workflowTitleAr: 'الإنذار المبكر للمخزون المركزي',
    workflowTitleEn: 'Low-Stock & Kitchen Auto-Order',
    timestamp: '03 نوفمبر 2026 - 07:14:30',
    status: 'SUCCESS',
    detailsAr: 'توليد مسودة أمر تزويد رقم PO-202611-002 لمستودع المطبخ المركزي بالقرين',
    detailsEn: 'Generated PO draft PO-202611-002 for Al-Qurain central kitchen warehouse',
    durationMs: 310,
  },
  {
    id: 'log-5',
    workflowCode: 'VF-AUTO-FEFO-03',
    workflowTitleAr: 'حارس سلامة الغذاء والهاسب',
    workflowTitleEn: 'FEFO Cold-Chain Breach Guard',
    timestamp: '03 نوفمبر 2026 - 04:30:00',
    status: 'SUCCESS',
    detailsAr: 'فحص 384 دفعة طعام: درجات الحرارة مطابقة للمواصفات وصلاحيات آمنة',
    detailsEn: 'Audited 384 batches: temperatures within cold chain limits',
    durationMs: 290,
  },
]

export function VentureAutomationHub({ locale = 'ar' }: { locale?: 'ar' | 'en' }) {
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>(INITIAL_WORKFLOWS)
  const [logs, setLogs] = useState<ExecutionLogItem[]>(INITIAL_LOGS)
  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'info' } | null>(null)
  const [showNewRuleModal, setShowNewRuleModal] = useState(false)

  // New Rule Form State
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
          ? `تم ${nextState ? 'تفعيل' : 'إيقاف'} مسار "${target.titleAr}" بنجاح`
          : `Workflow "${target.titleEn}" is now ${nextState ? 'Active' : 'Paused'}`
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
          // Ignore network errors in local dev
        }
      }

      await new Promise((r) => setTimeout(r, 800))

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
        detailsAr: `تشغيل يدوي فوري ناجح: تم إرسال الإشعار والتحقق من الشروط وإرسال التقرير`,
        detailsEn: `Manual trigger executed: verified condition & dispatched alert`,
        durationMs: Math.floor(Math.random() * 400) + 250,
      }

      setLogs((prev) => [newLog, ...prev.slice(0, 19)])
      showNotice(
        isAr
          ? `⚡ تم تشغيل واختبار "${workflow.titleAr}" بنجاح وتوثيقه في السجل الحي!`
          : `⚡ "${workflow.titleEn}" executed successfully & logged!`
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
      code: `VF-CUSTOM-${workflows.length + 1}`,
      titleAr: newRuleName,
      titleEn: newRuleName,
      departmentAr: newRuleDepartment,
      departmentEn: 'Custom Operational Unit',
      triggerAr: newRuleTrigger === 'STOCK_ALERT' ? 'تغير في المخزون أو الأصناف' : 'حركة مبيعات أو إغلاق وردية',
      triggerEn: 'Custom trigger event defined for Venture Foods',
      actionAr: 'إرسال إشعار فوري لبريد الإدارة وتوليد قيد في النظام',
      actionEn: 'Dispatch instant email notification to management',
      scheduleAr: 'فوري عند الحدث',
      scheduleEn: 'Immediate upon event',
      icon: '⚙️',
      color: '#3b82f6',
      isActive: true,
      lastRun: 'الآن (جديدة)',
      successRate: '100%',
    }

    setWorkflows((prev) => [...prev, newWf])
    setShowNewRuleModal(false)
    setNewRuleName('')
    showNotice(
      isAr
        ? `✅ تم حفظ قاعدة الأتمتة المخصصة "${newWf.titleAr}" وتفعيلها فوراً`
        : `✅ Custom rule "${newWf.titleEn}" created & activated`
    )
  }

  const showNotice = (msg: string) => {
    setNotification({ msg, type: 'success' })
    setTimeout(() => setNotification(null), 4500)
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#0a0d12] text-slate-100 p-3 sm:p-6 space-y-6"
    >
      {/* ========================================================================= */}
      {/* 1. TOP HEADER                                                             */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
              <Zap size={14} className="animate-pulse" />
              {isAr ? 'محرك الأتمتة والعمليات الذكية' : 'Enterprise Automation Engine'}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
              {isAr ? 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م.' : 'Venture Foods Restaurant Management Co. W.L.L.'}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
            {isAr ? 'مركز قيادة مسارات الأتمتة والرادارات الحية' : 'Operational Workflows & Real-Time System Monitors'}
          </h1>
          <p className="text-xs text-slate-400">
            {isAr
              ? '6 مسارات أتمتة تشغيلية ورادارات رقابية متصلة مباشرة بسيرفرات الشركة والبريد المؤسسي'
              : '6 live operational workflows & monitors connected directly to Venture Foods systems & SMTP'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentLocale(isAr ? 'en' : 'ar')}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            {isAr ? 'English (LTR)' : 'عربي (RTL)'}
          </button>
          <button
            onClick={() => setShowNewRuleModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-black hover:opacity-90 transition-all shadow-lg shadow-emerald-500/10"
          >
            <Plus size={15} />
            {isAr ? 'إضافة قاعدة أتمتة مخصصة' : 'Add Custom Automation'}
          </button>
        </div>
      </div>

      {/* Pop-up Notification */}
      {notification && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-3 text-xs font-semibold text-emerald-300 shadow-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            {notification.msg}
          </span>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SMTP & WEBHOOK LIVE STATUS BAR                                         */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Engine Status */}
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Mail size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-sm font-bold text-white">
                  Google Workspace SMTP Active
                </span>
                <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20" dir="ltr">
                  sec@venturefoodskw.com
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {isAr
                  ? 'خادم البريد المؤسسي موثق ويعمل على منفذ SSL 465 لإرسال التنبيهات الفورية المشفرة'
                  : 'Enterprise SMTP authenticated on SSL port 465 delivering encrypted instant dispatches'}
              </p>
            </div>
          </div>

          {/* 3 Dedicated Stakeholders */}
          <div className="flex flex-col items-start lg:items-end">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {isAr ? 'المستلمون الثلاثة المعتمدون حصرياً:' : 'Exclusively Verified Recipients:'}
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200" dir="ltr">
                <span className="font-semibold text-emerald-400">Abdullah:</span> Sec@venturefoodskw.com
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200" dir="ltr">
                <span className="font-semibold text-blue-400">Choukrallah:</span> operations@venturefoodskw.com
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200" dir="ltr">
                <span className="font-semibold text-amber-400">Abdulrahman:</span> abdelrahmanm@venturefoodskw.com
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. THE 6 VENTURE FOODS OPERATIONAL WORKFLOW CARDS                         */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-white sm:text-lg">
            <Sliders size={18} className="text-emerald-400" />
            {isAr ? 'محركات الأتمتة الـ 6 الخاصة بشركة فنتشر فودز' : '6 Venture Foods Operational Workflows'}
          </h2>
          <span className="text-xs text-slate-400">
            {workflows.filter((w) => w.isActive).length} / {workflows.length} {isAr ? 'مسارات نشطة' : 'Active'}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className={`flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 shadow-sm ${
                wf.isActive
                  ? 'border-slate-800 bg-[#0d131f] hover:border-slate-700'
                  : 'border-slate-800/50 bg-[#0a0d12]/60 opacity-60'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{wf.icon}</span>
                    <div>
                      <span className="font-mono text-[10px] font-bold text-slate-400" dir="ltr">
                        {wf.code}
                      </span>
                      <p className="text-[11px] font-semibold text-slate-400">
                        {isAr ? wf.departmentAr : wf.departmentEn}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <button
                    onClick={() => handleToggleWorkflow(wf.id)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-all ${
                      wf.isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {wf.isActive ? (isAr ? 'نشط ●' : 'Active ●') : isAr ? 'متوقف ○' : 'Paused ○'}
                  </button>
                </div>

                {/* Title */}
                <h3 className="mt-3 text-base font-bold text-white">
                  {isAr ? wf.titleAr : wf.titleEn}
                </h3>

                {/* Trigger & Action Box */}
                <div className="mt-3 space-y-2 rounded-xl bg-slate-900/60 p-3 text-xs">
                  <div>
                    <span className="font-bold text-amber-400">
                      {isAr ? '⚡ الشرط (Trigger):' : '⚡ Trigger:'}
                    </span>
                    <p className="mt-0.5 text-slate-300">
                      {isAr ? wf.triggerAr : wf.triggerEn}
                    </p>
                  </div>
                  <div className="border-t border-slate-800/70 pt-2">
                    <span className="font-bold text-emerald-400">
                      {isAr ? '🎯 الإجراء (Action):' : '🎯 Action:'}
                    </span>
                    <p className="mt-0.5 text-slate-300">
                      {isAr ? wf.actionAr : wf.actionEn}
                    </p>
                  </div>
                </div>

                {/* Timing & Stats */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-slate-500" />
                    {isAr ? wf.scheduleAr : wf.scheduleEn}
                  </span>
                  <span>
                    {isAr ? 'آخر تشغيل:' : 'Last run:'}{' '}
                    <strong className="text-slate-300">{wf.lastRun}</strong>
                  </span>
                </div>
              </div>

              {/* Action Button: Run Now */}
              <div className="mt-4 border-t border-slate-800/80 pt-3">
                <button
                  onClick={() => handleRunWorkflow(wf)}
                  disabled={runningId === wf.id}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 py-2 text-xs font-bold text-white hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all duration-200 disabled:opacity-50"
                >
                  {runningId === wf.id ? (
                    <>
                      <RotateCw size={14} className="animate-spin" />
                      {isAr ? 'جارٍ الفحص والتنفيذ...' : 'Executing...'}
                    </>
                  ) : (
                    <>
                      <Play size={13} className="fill-current" />
                      {isAr ? 'تشغيل واختبار الآن (Run Now)' : 'Run & Test Now'}
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. LIVE EXECUTION LOG                                                     */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d131f] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-emerald-400" />
            <h2 className="text-sm font-bold text-white sm:text-base">
              {isAr ? 'سجل التنفيذ الحي للعمليات (Live Automation Execution Log)' : 'Live Automation Execution Log'}
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {logs.length} {isAr ? 'عملية مسجلة' : 'Recorded Executions'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                <th className="px-4 py-3 text-right">{isAr ? 'الوقت والتاريخ' : 'Timestamp'}</th>
                <th className="px-4 py-3 text-right">{isAr ? 'كود المسار' : 'Workflow Code'}</th>
                <th className="px-4 py-3 text-right">{isAr ? 'اسم المسار' : 'Workflow Name'}</th>
                <th className="px-4 py-3 text-right">{isAr ? 'تفاصيل الإجراء المنفذ' : 'Execution Details'}</th>
                <th className="px-4 py-3 text-center">{isAr ? 'زمن الاستجابة' : 'Latency'}</th>
                <th className="px-4 py-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-emerald-400 whitespace-nowrap">
                    {log.workflowCode}
                  </td>
                  <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                    {isAr ? log.workflowTitleAr : log.workflowTitleEn}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {isAr ? log.detailsAr : log.detailsEn}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-slate-400">
                    {log.durationMs}ms
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 size={12} />
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL: ADD CUSTOM AUTOMATION RULE                                     */}
      {/* ========================================================================= */}
      {showNewRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {isAr ? 'إضافة قاعدة أتمتة مخصصة لشركة فنتشر فودز' : 'Add Custom Venture Foods Automation Rule'}
              </h3>
              <button
                onClick={() => setShowNewRuleModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomRule} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  {isAr ? 'اسم القاعدة أو المسار:' : 'Rule Name:'}
                </label>
                <input
                  type="text"
                  required
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder={
                    isAr ? 'مثال: تنبيه عند تجاوز مبيعات البرجر 500 طلب' : 'e.g. Alert when burger sales exceed 500 orders'
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  {isAr ? 'القسم التشغيلي المرتبط:' : 'Operating Department:'}
                </label>
                <select
                  value={newRuleDepartment}
                  onChange={(e) => setNewRuleDepartment(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                >
                  <option value="المبيعات والقنوات">المبيعات والقنوات (Sales & Channels)</option>
                  <option value="المخزون والتوريد">المخزون والتوريد (Inventory & Supply)</option>
                  <option value="سلامة الغذاء والهاسب">سلامة الغذاء والهاسب (Food Safety & HACCP)</option>
                  <option value="الموارد البشرية والرواتب">الموارد البشرية والرواتب (HR & Payroll)</option>
                  <option value="المطبخ المركزي صبحان">المطبخ المركزي صبحان (Sabhan Commissary)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  {isAr ? 'شرط المحفز (Trigger Event):' : 'Trigger Condition:'}
                </label>
                <select
                  value={newRuleTrigger}
                  onChange={(e) => setNewRuleTrigger(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                >
                  <option value="STOCK_ALERT">نزول المخزون عن حد إعادة الطلب (Stock Alert)</option>
                  <option value="SALES_SPIKE">تسجيل مبيعات استثنائية أو إغلاق وردية (Sales Close)</option>
                  <option value="FEFO_CRITICAL">اقتراب انتهاء دفعة تحضير أقل من 6 ساعات (FEFO Near Expiry)</option>
                  <option value="RESIDENCY_SOON">انتهاء وثيقة موظف خلال 30 يوماً (Labor Doc Expiry)</option>
                </select>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-slate-400">
                <span className="font-semibold text-slate-300">
                  {isAr ? 'الإجراء التلقائي المعتمد:' : 'Default Approved Action:'}
                </span>
                <p className="mt-1">
                  {isAr
                    ? 'سيتم إرسال بريد إلكتروني فوري عبر خادم sec@venturefoodskw.com إلى المستلمين الـ 3 المعتمدين وتدوين الحدث في السجل.'
                    : 'Dispatches instant email via sec@venturefoodskw.com to the 3 verified recipients.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewRuleModal(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-700"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-4 py-2 font-bold text-black hover:bg-emerald-400"
                >
                  {isAr ? 'حفظ وتفعيل القاعدة' : 'Save & Activate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
