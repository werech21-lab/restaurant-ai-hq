'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Lock,
  Megaphone,
  MessageCircle,
  Plus,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import {
  APPROVED_BRANCH_IDS,
  getBranchLabel,
  type GlobalBranch,
} from '@/lib/aether/global-filter-engine'
import { SlidingPillTabs } from '@/components/ui/SlidingPillTabs'
import { useGovernance } from '@/components/erp/GovernanceBellDrawer'
import { buildCircularSerialRef } from '@/lib/governance-compliance'
import {
  buildRegulationCircularText,
  buildRegulationStopDirective,
  DEFAULT_REGULATION_BRANCH_READINESS,
  REG_STOP_ORDERS_STORAGE_KEY,
  REGULATION_TRACK_OPTIONS,
  REGULATIONS_STORAGE_KEY,
  sanitizeRegulations,
  SEEDED_REGULATIONS,
  type RegulationPlaybookItem,
  type RegulationTrackId,
} from '@/lib/aether/regulations-engine'

const CARD_CLS =
  'ae-bento-card bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900'
const KPI_CARD_CLS =
  'ae-kpi-card bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-neutral-900'
const INPUT_CLS =
  'h-10 w-full rounded-xl bg-white px-3 text-[13px] font-medium text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:bg-neutral-950 dark:text-white'

const f0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')

export function RegulationsComplianceStudio() {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const kwd = isAr ? 'د.ك' : 'KWD'

  const {
    store,
    session,
    requestApproval,
    getApprovalByRef,
    approveItemWithPin,
    requireManagerPin,
    toggleBranchReceipt,
    confirmAllBranchesReceipt,
    issueOfficialCircularWithPin,
    openCircularPrintModal,
    openDrawer,
  } = useGovernance()

  const [trackFilter, setTrackFilter] = useState<'all' | RegulationTrackId>('all')
  const [regulations, setRegulations] = useState<RegulationPlaybookItem[]>(SEEDED_REGULATIONS)
  const [stoppedRegs, setStoppedRegs] = useState<Record<string, string>>({})
  const [formOpen, setFormOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // New Regulation Form State
  const [newTrack, setNewTrack] = useState<RegulationTrackId>('municipality-pafn')
  const [newAuthority, setNewAuthority] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newEffective, setNewEffective] = useState('2026-11-18')
  const [newDeadline, setNewDeadline] = useState('2026-12-20')
  const [newCost, setNewCost] = useState('150')
  const [newPenalty, setNewPenalty] = useState('2000')
  const [newStepsText, setNewStepsText] = useState('')

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(REGULATIONS_STORAGE_KEY)
      if (raw) setRegulations(sanitizeRegulations(JSON.parse(raw)))
    } catch {}
    try {
      const rawStop = window.localStorage.getItem(REG_STOP_ORDERS_STORAGE_KEY)
      if (rawStop) setStoppedRegs(JSON.parse(rawStop) as Record<string, string>)
    } catch {}
  }, [])

  const persistRegulations = useCallback((next: RegulationPlaybookItem[]) => {
    setRegulations(next)
    try {
      window.localStorage.setItem(REGULATIONS_STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }, [])

  const persistStoppedRegs = useCallback((next: Record<string, string>) => {
    setStoppedRegs(next)
    try {
      window.localStorage.setItem(REG_STOP_ORDERS_STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }, [])

  const copyToClipboard = useCallback((key: string, text: string) => {
    try {
      void navigator.clipboard.writeText(text)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 2200)
    } catch {}
  }, [])

  const handleAddRegulation = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const cleanTitle =
        newTitle.trim() || (isAr ? 'اشتراط رقابي جديد للمطاعم' : 'New Kuwait F&B Regulation')
      const cleanAuth =
        newAuthority.trim() ||
        (isAr ? 'بلدية الكويت / هيئة الغذاء' : 'Kuwait Municipality / PAFN')
      const parsedSteps = newStepsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      const steps =
        parsedSteps.length > 0
          ? parsedSteps
          : [
              isAr
                ? 'تعميم الاشتراط الرقابي على الفروع السبعة ومطبخ العارضية وتوثيق التنفيذ.'
                : 'Broadcast compliance steps across all 7 branches and Ardiya Central Kitchen.',
            ]

      const created: RegulationPlaybookItem = {
        id: `reg-custom-${Date.now()}`,
        track: newTrack,
        code: `REG-KW-0${regulations.length + 1}`,
        titleAr: cleanTitle,
        titleEn: cleanTitle,
        authorityAr: cleanAuth,
        authorityEn: cleanAuth,
        effectiveDate: newEffective,
        deadlineDate: newDeadline >= newEffective ? newDeadline : newEffective,
        costImpactKwd: Math.max(0, Number(newCost) || 0),
        penaltyAvoidedKwd: Math.max(0, Number(newPenalty) || 1500),
        severity: 'high',
        summaryAr: cleanTitle,
        summaryEn: cleanTitle,
        mitigationStepsAr: steps,
        mitigationStepsEn: steps,
      }
      persistRegulations([created, ...regulations])
      setNewTitle('')
      setNewAuthority('')
      setNewStepsText('')
      setFormOpen(false)
    },
    [
      isAr,
      newAuthority,
      newCost,
      newDeadline,
      newEffective,
      newPenalty,
      newStepsText,
      newTitle,
      newTrack,
      persistRegulations,
      regulations,
    ],
  )

  const handleStopRegulatoryViolation = useCallback(
    (reg: RegulationPlaybookItem) => {
      requireManagerPin({
        titleAr: `تأكيد إيقاف مخالفة رقابية (${reg.code})`,
        titleEn: `Confirm Regulatory Stop Order (${reg.code})`,
        onSuccess: () => {
          const directive = buildRegulationStopDirective(reg, isAr)
          const next = { ...stoppedRegs, [reg.id]: new Date().toISOString() }
          persistStoppedRegs(next)
          copyToClipboard(`stop-reg-${reg.id}`, directive)
        },
      })
    },
    [copyToClipboard, isAr, persistStoppedRegs, requireManagerPin, stoppedRegs],
  )

  const handleClearRegulatoryStop = useCallback(
    (reg: RegulationPlaybookItem) => {
      requireManagerPin({
        titleAr: `فك تجميد بعد استكمال المطابقة (${reg.code})`,
        titleEn: `Lift Stop Order After Compliance (${reg.code})`,
        onSuccess: () => {
          const next = { ...stoppedRegs }
          delete next[reg.id]
          persistStoppedRegs(next)
        },
      })
    },
    [persistStoppedRegs, requireManagerPin, stoppedRegs],
  )

  const filteredRegulations = useMemo(
    () =>
      trackFilter === 'all'
        ? regulations
        : regulations.filter((r) => r.track === trackFilter),
    [regulations, trackFilter],
  )

  const stats = useMemo(() => {
    const totalCostKwd = regulations.reduce((s, r) => s + r.costImpactKwd, 0)
    const totalPenaltyAvoidedKwd = regulations.reduce((s, r) => s + r.penaltyAvoidedKwd, 0)
    let readyBranchSlots = 0
    const totalSlots = Math.max(1, regulations.length * APPROVED_BRANCH_IDS.length)
    for (const r of regulations) {
      const rec =
        store.branchReceipts[`reg-ready:${r.id}`] ??
        DEFAULT_REGULATION_BRANCH_READINESS[r.id] ??
        {}
      for (const b of APPROVED_BRANCH_IDS) {
        if (rec[b]) readyBranchSlots += 1
      }
    }
    const readinessPct = Math.round((readyBranchSlots / totalSlots) * 100)
    return {
      totalCount: regulations.length,
      totalCostKwd,
      totalPenaltyAvoidedKwd,
      readyBranchSlots,
      totalSlots,
      readinessPct,
    }
  }, [regulations, store.branchReceipts])

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full space-y-4 pb-10">
      {/* ───────────── 1. Executive Header + Track Filter + Add Regulation ───────────── */}
      <header className={`${CARD_CLS} flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Scale className="h-4 w-4" />
            </span>
            <h1 className="text-[20px] font-semibold tracking-tight text-neutral-950 sm:text-[22px] dark:text-white">
              {isAr ? 'التشريعات وخطط التعامل' : 'Kuwait F&B Regulations & Mitigation Playbooks'}
            </h1>
            {session.active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Unlock className="h-3 w-3" />
                <span>{isAr ? 'وضع المدير نشط 🔓' : 'Manager Active 🔓'}</span>
              </span>
            ) : null}
          </div>
          <p className="text-xs text-neutral-400">
            {isAr
              ? 'البلدية وهيئة الغذاء (مطبخ العارضية)، القوى العاملة وتصاريح التوصيل، التجارة والمنصات، وعقود المجمعات والمعارض EXB'
              : 'Municipality & PAFN (Ardiya), Manpower & Rider Permits, MOCI Pricing/Promos, and Mall/EXB/Fire Rules'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openDrawer('all')}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[#F7F7F8] px-3.5 text-xs font-semibold text-neutral-800 transition-colors hover:bg-neutral-200/70 dark:bg-neutral-950 dark:text-slate-200"
          >
            <Bell className="h-3.5 w-3.5 text-emerald-600" />
            <span>{isAr ? 'مركز اعتمادات المدير 🔔' : 'Governance Bell 🔔'}</span>
          </button>

          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="ae-btn-primary inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-all duration-150"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>
              {formOpen
                ? isAr
                  ? 'إغلاق النموذج ✕'
                  : 'Close ✕'
                : isAr
                  ? '+ إضافة تشريع جديد'
                  : '+ Add New Regulation'}
            </span>
          </button>
        </div>
      </header>

      {/* Track Filter Pills */}
      <div className="overflow-x-auto pb-0.5">
        <SlidingPillTabs<'all' | RegulationTrackId>
          ariaLabel={isAr ? 'تصفية المسارات الرقابية' : 'Filter Regulatory Tracks'}
          surface="white"
          size="sm"
          value={trackFilter}
          onChange={setTrackFilter}
          options={REGULATION_TRACK_OPTIONS.map((t) => ({
            id: t.id,
            label: isAr ? t.ar : t.en,
          }))}
        />
      </div>

      {/* Collapsible `+ إضافة تشريع جديد` Form */}
      {formOpen ? (
        <form
          onSubmit={handleAddRegulation}
          className={`${CARD_CLS} space-y-3`}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                {isAr ? 'المسار الرقابي' : 'Regulatory Track'}
              </label>
              <select
                value={newTrack}
                onChange={(e) => setNewTrack(e.target.value as RegulationTrackId)}
                className={INPUT_CLS}
              >
                {REGULATION_TRACK_OPTIONS.filter((t) => t.id !== 'all').map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {isAr ? opt.ar : opt.en}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                {isAr ? 'الجهة الرقابية المصدرة' : 'Issuing Authority'}
              </label>
              <input
                type="text"
                required
                value={newAuthority}
                onChange={(e) => setNewAuthority(e.target.value)}
                placeholder={isAr ? 'مثال: بلدية الكويت / وزارة التجارة...' : 'e.g. Kuwait Municipality / MOCI...'}
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                {isAr ? 'تاريخ السريان' : 'Effective Date'}
              </label>
              <input
                type="date"
                required
                value={newEffective}
                onChange={(e) => setNewEffective(e.target.value)}
                className={`${INPUT_CLS} tabular-nums`}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                {isAr ? 'المهلة النهائية' : 'Deadline'}
              </label>
              <input
                type="date"
                required
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className={`${INPUT_CLS} tabular-nums`}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                {isAr ? 'الأثر المالي (د.ك)' : 'Cost Impact (KWD)'}
              </label>
              <input
                type="number"
                min="0"
                step="10"
                required
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                className={`${INPUT_CLS} tabular-nums`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                {isAr ? 'عنوان التشريع أو القرار' : 'Regulation / Circular Title'}
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={isAr ? 'مثال: تحديث اشتراطات التعبئة الحرارية للتوصيل...' : 'e.g. Updated thermal delivery packaging standard...'}
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                {isAr ? 'الغرامات المتفاداة (د.ك)' : 'Penalties Shielded (KWD)'}
              </label>
              <input
                type="number"
                min="0"
                step="100"
                required
                value={newPenalty}
                onChange={(e) => setNewPenalty(e.target.value)}
                className={`${INPUT_CLS} tabular-nums`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                {isAr ? 'خطوات خطة التعامل (سطر لكل خطوة)' : 'Mitigation Action Steps (one per line)'}
              </label>
              <textarea
                rows={2}
                value={newStepsText}
                onChange={(e) => setNewStepsText(e.target.value)}
                placeholder={
                  isAr
                    ? '١. تعميم القرار على مديري الفروع السبعة...\n٢. توثيق الفحص في مطبخ العارضية...'
                    : '1. Notify all 7 branch managers...\n2. Verify compliance at Ardiya kitchen...'
                }
                className="w-full rounded-xl bg-[#F7F7F8] p-3 text-xs text-neutral-900 outline-none focus:ring-2 focus:ring-emerald-600/30 dark:bg-neutral-950 dark:text-white"
              />
            </div>

            <button
              type="submit"
              className="ae-btn-primary inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-5 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isAr ? 'حفظ التشريع وخطة التعامل' : 'Save Regulation & Playbook'}</span>
            </button>
          </div>
        </form>
      ) : null}

      {/* ───────────── 2. 4 Executive Regulatory KPIs ───────────── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
          <div className="text-xs font-medium text-neutral-500 dark:text-slate-400">
            {isAr ? 'التشريعات الفعالة المتابعة' : 'Active Tracked Regulations'}
          </div>
          <div dir="ltr" className="mt-2 text-[26px] font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white">
            {stats.totalCount}
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {isAr ? 'بلدية، غذاء، قوى عاملة، تجارة، وإطفاء' : 'Municipality, PAFN, PAM, MOCI & KFF'}
          </p>
        </article>

        <article className={`${KPI_CARD_CLS} ae-glow-amber`}>
          <div className="text-xs font-medium text-neutral-500 dark:text-slate-400">
            {isAr ? 'إجمالي تكلفة الامتثال' : 'Total Compliance Cost Impact'}
          </div>
          <div dir="ltr" className="mt-2 text-[26px] font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white">
            {f0(stats.totalCostKwd)} {kwd}
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {isAr ? 'شهادات صحية، تصاريح توصيل، وصيانة سلامة' : 'Permits, health cards & safety calibration'}
          </p>
        </article>

        <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
          <div className="text-xs font-medium text-neutral-500 dark:text-slate-400">
            {isAr ? 'الحماية من الغرامات والإغلاق' : 'Penalty Exposure Shielded'}
          </div>
          <div dir="ltr" className="mt-2 text-[26px] font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
            {f0(stats.totalPenaltyAvoidedKwd)} {kwd}
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {isAr ? 'تفادي غرامات إدارية وتوقف تشغيل الفروع' : 'Fines & closure downtime prevented'}
          </p>
        </article>

        <article className={`${KPI_CARD_CLS} ae-glow-sky`}>
          <div className="text-xs font-medium text-neutral-500 dark:text-slate-400">
            {isAr ? 'مؤشر جاهزية الفروع الـ 7' : '7-Branch Readiness Score'}
          </div>
          <div dir="ltr" className="mt-2 text-[26px] font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white">
            {stats.readinessPct}%
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {isAr
              ? `${stats.readyBranchSlots} من ${stats.totalSlots} نقطة مطابقة مكتملة`
              : `${stats.readyBranchSlots} of ${stats.totalSlots} branch checks verified`}
          </p>
        </article>
      </section>

      {/* ───────────── 3. Regulation Playbook Cards + 7/7 Branch Readiness Checklist ───────────── */}
      <section className="space-y-4">
        {filteredRegulations.map((reg) => {
          const refKey = `regulation:${reg.id}`
          const approval = getApprovalByRef(refKey)
          const readinessKey = `reg-ready:${reg.id}`
          const circularKey = `reg-circular:${reg.id}`
          const issuedCircular = store.issuedCirculars[circularKey]
          const readinessMap =
            store.branchReceipts[readinessKey] ??
            DEFAULT_REGULATION_BRANCH_READINESS[reg.id] ??
            {}
          const readyBranchesCount = APPROVED_BRANCH_IDS.filter((b) => readinessMap[b]).length
          const pendingBranchesCount = APPROVED_BRANCH_IDS.length - readyBranchesCount
          const isStopActive = Boolean(stoppedRegs[reg.id])

          const severityBadge =
            reg.severity === 'critical'
              ? {
                  cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
                  label: isAr ? 'أولوية قصوى' : 'Critical',
                }
              : reg.severity === 'high'
                ? {
                    cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
                    label: isAr ? 'أولوية عالية' : 'High Priority',
                  }
                : {
                    cls: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
                    label: isAr ? 'امتثال دوري' : 'Standard',
                  }

          const circularBodyAr = buildRegulationCircularText(
            reg,
            true,
            issuedCircular?.sealId ?? approval?.seal?.sealId,
          )
          const circularBodyEn = buildRegulationCircularText(
            reg,
            false,
            issuedCircular?.sealId ?? approval?.seal?.sealId,
          )
          const activeCircularText = isAr ? circularBodyAr : circularBodyEn

          return (
            <article key={reg.id} className={`${CARD_CLS} space-y-4`}>
              {/* Top Meta Row */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200">
                      {reg.code}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${severityBadge.cls}`}>
                      {severityBadge.label}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-3 py-0.5 text-xs font-semibold text-neutral-800 dark:bg-neutral-800 dark:text-slate-200">
                      {isAr ? reg.authorityAr : reg.authorityEn}
                    </span>
                    <span
                      dir="ltr"
                      className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
                    >
                      {isAr ? `المهلة: ${reg.deadlineDate}` : `Deadline: ${reg.deadlineDate}`}
                    </span>

                    {approval?.status === 'approved' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>
                          {isAr
                            ? `خطة معتمدة (${approval.seal?.sealId ?? 'VF'}) ✅`
                            : `Approved Playbook (${approval.seal?.sealId ?? 'VF'}) ✅`}
                        </span>
                      </span>
                    ) : approval?.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                        <Bell className="h-3 w-3" />
                        <span>{isAr ? 'بانتظار موافقة المدير 🔔' : 'Pending Approval 🔔'}</span>
                      </span>
                    ) : null}

                    {issuedCircular ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-200">
                        <Megaphone className="h-3 w-3" />
                        <span>{isAr ? 'تم التعميم رسمياً 📢' : 'Broadcasted 📢'}</span>
                      </span>
                    ) : null}

                    {isStopActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
                        <ShieldAlert className="h-3 w-3" />
                        <span>{isAr ? 'أمر إيقاف مخالفة مفعل ⛔' : 'Stop Order Active ⛔'}</span>
                      </span>
                    ) : null}
                  </div>

                  <h2 className="text-[16px] font-semibold text-neutral-950 dark:text-white">
                    {isAr ? reg.titleAr : reg.titleEn}
                  </h2>
                  <p className="text-xs leading-relaxed text-neutral-500 dark:text-slate-300">
                    {isAr ? reg.summaryAr : reg.summaryEn}
                  </p>
                </div>

                {/* Cost Impact vs Penalty Shielded Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-xl bg-[#F7F7F8] px-3.5 py-2 text-end dark:bg-neutral-950">
                    <div className="text-[10.5px] text-neutral-400">
                      {isAr ? 'تكلفة الامتثال' : 'Cost Impact'}
                    </div>
                    <div dir="ltr" className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                      {f0(reg.costImpactKwd)} {kwd}
                    </div>
                  </div>

                  <div className="rounded-xl bg-emerald-50/70 px-3.5 py-2 text-end dark:bg-emerald-950/35">
                    <div className="text-[10.5px] text-emerald-800 dark:text-emerald-300">
                      {isAr ? 'غرامات متفاداة' : 'Fines Shielded'}
                    </div>
                    <div dir="ltr" className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {f0(reg.penaltyAvoidedKwd)} {kwd}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step-by-Step Mitigation Plan (`خطة التعامل`) */}
              <div className="rounded-2xl bg-[#F7F7F8] p-4 dark:bg-neutral-950">
                <div className="mb-2 text-xs font-semibold text-neutral-900 dark:text-white">
                  {isAr ? 'خطة التعامل التنفيذية خطوة بخطوة:' : 'Step-by-Step Mitigation Plan:'}
                </div>
                <ol className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {(isAr ? reg.mitigationStepsAr : reg.mitigationStepsEn).map((step, idx) => (
                    <li
                      key={`${reg.id}-step-${idx}`}
                      className="flex items-start gap-2 rounded-xl bg-white p-2.5 text-xs leading-relaxed text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:bg-neutral-900 dark:text-slate-200"
                    >
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* 7/7 Branch Readiness Checklist */}
              <div className="rounded-2xl bg-[#F7F7F8] p-3.5 space-y-2.5 dark:bg-neutral-950">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-white">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>
                      {isAr
                        ? `قائمة جاهزية الفروع السبعة (${readyBranchesCount}/7 فروع مطابقة)`
                        : `7-Branch Readiness Checklist (${readyBranchesCount}/7 Verified)`}
                    </span>
                    {pendingBranchesCount > 0 ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                        {isAr
                          ? `${pendingBranchesCount} بانتظار الاستكمال قبل ${reg.deadlineDate}`
                          : `${pendingBranchesCount} pending before ${reg.deadlineDate}`}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {isAr ? 'جميع الفروع مطابقة 100% ✓' : '100% Compliant ✓'}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => confirmAllBranchesReceipt(readinessKey)}
                    className="cursor-pointer rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                  >
                    {isAr ? 'اعتماد جاهزية الـ 7 فروع ✓' : 'Verify All 7 Branches ✓'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {APPROVED_BRANCH_IDS.map((branchId) => {
                    const ready = Boolean(readinessMap[branchId])
                    return (
                      <button
                        key={branchId}
                        type="button"
                        onClick={() =>
                          toggleBranchReceipt(
                            readinessKey,
                            branchId as Exclude<GlobalBranch, 'all'>,
                          )
                        }
                        className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          ready
                            ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-200'
                            : 'bg-amber-50 text-amber-800 ring-1 ring-amber-500/25 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200'
                        }`}
                      >
                        {ready ? (
                          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                        )}
                        <span>{getBranchLabel(branchId, isAr)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Governance Action Bar: Request Approval 🔔 | Broadcast Playbook 📢 | Stop Violation ⛔ */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  {!approval ? (
                    <button
                      type="button"
                      onClick={() =>
                        requestApproval({
                          refKey,
                          domain: 'regulations',
                          titleAr: `اعتماد خطة امتثال (${reg.code}): ${reg.titleAr}`,
                          titleEn: `Approve Regulation Playbook (${reg.code}): ${reg.titleEn}`,
                          summaryAr: `${reg.authorityAr} • المهلة: ${reg.deadlineDate} • التكلفة ${f0(reg.costImpactKwd)} د.ك لتفادي غرامات ${f0(reg.penaltyAvoidedKwd)} د.ك.`,
                          summaryEn: `${reg.authorityEn} • Deadline: ${reg.deadlineDate} • Cost ${f0(reg.costImpactKwd)} KWD shielding ${f0(reg.penaltyAvoidedKwd)} KWD fines.`,
                          departmentAr: 'الشؤون القانونية والامتثال والعمليات',
                          departmentEn: 'Legal, Compliance & Ops',
                          budgetOrCostKwd: reg.costImpactKwd,
                          expectedMonthlyReturnKwd: reg.penaltyAvoidedKwd,
                          href: '/erp/regulations',
                        })
                      }
                      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-amber-50 px-3.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
                    >
                      <Bell className="h-3.5 w-3.5" />
                      <span>{isAr ? 'طلب موافقة المدير 🔔' : 'Request Manager Approval 🔔'}</span>
                    </button>
                  ) : approval.status === 'pending' ? (
                    <button
                      type="button"
                      onClick={() =>
                        approveItemWithPin(approval.id, approval.titleAr, approval.titleEn)
                      }
                      className="btn-colored inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      style={{ color: '#FFFFFF' }}
                    >
                      <Lock className="h-3 w-3" />
                      <span>{isAr ? 'موافقة واعتماد بـ PIN ✅' : 'Approve & Seal (PIN) ✅'}</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() =>
                      issueOfficialCircularWithPin({
                        circularKey,
                        kind: 'regulation',
                        titleAr: `${reg.code} — ${reg.titleAr}`,
                        titleEn: `${reg.code} — ${reg.titleEn}`,
                        circularBodyAr,
                        circularBodyEn,
                        scopeAr: `${reg.authorityAr} · الفروع السبعة ومطبخ العارضية`,
                        scopeEn: `${reg.authorityEn} · All 7 Active Branches & Ardiya Kitchen`,
                        effectiveWindow: `${reg.effectiveDate} → ${reg.deadlineDate}`,
                        financialSummaryAr: `تكلفة الامتثال: ${f0(reg.costImpactKwd)} د.ك • غرامات متفاداة: ${f0(reg.penaltyAvoidedKwd)} د.ك`,
                        financialSummaryEn: `Cost Impact: ${f0(reg.costImpactKwd)} KWD • Fines Shielded: ${f0(reg.penaltyAvoidedKwd)} KWD`,
                        mandatoryRulesAr: reg.mitigationStepsAr,
                        mandatoryRulesEn: reg.mitigationStepsEn,
                      })
                    }
                    className="ae-btn-primary inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all duration-150"
                  >
                    <Megaphone className="h-3.5 w-3.5" />
                    <span>
                      {isAr
                        ? 'تعميم خطة التعامل رسمياً 📢'
                        : 'Broadcast Mitigation Plan Officially 📢'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openCircularPrintModal({
                        circularKey: readinessKey,
                        serialRef:
                          issuedCircular?.serialRef ?? buildCircularSerialRef(circularKey),
                        kind: isStopActive ? 'stop-directive' : 'regulation',
                        titleAr: isStopActive
                          ? `أمر إيقاف مخالفة رقابية ⛔ — ${reg.code}: ${reg.titleAr}`
                          : `${reg.code} — ${reg.titleAr}`,
                        titleEn: isStopActive
                          ? `Regulatory Stop-Violation Directive ⛔ — ${reg.code}: ${reg.titleEn}`
                          : `${reg.code} — ${reg.titleEn}`,
                        classificationAr: isStopActive
                          ? 'أمر إيقاف مخالفة رقابية عاجل ⛔'
                          : 'تعميم خطة امتثال تشريعي ورقابي',
                        classificationEn: isStopActive
                          ? 'Urgent Regulatory Stop-Violation Order ⛔'
                          : 'Official Regulatory Compliance Playbook',
                        scopeAr: `${reg.authorityAr} · الفروع السبعة المعتمدة ومطبخ العارضية`,
                        scopeEn: `${reg.authorityEn} · All 7 Active Branches & Ardiya Central Kitchen`,
                        issuedAtIso:
                          stoppedRegs[reg.id] ??
                          issuedCircular?.issuedAtIso ??
                          approval?.seal?.approvedAtIso ??
                          new Date().toISOString(),
                        effectiveWindow: `${isAr ? 'المهلة:' : 'Deadline:'} ${reg.deadlineDate}`,
                        sealId: issuedCircular?.sealId ?? approval?.seal?.sealId,
                        financialSummaryAr: `تكلفة الامتثال: ${f0(reg.costImpactKwd)} د.ك • الحماية من غرامات: ${f0(reg.penaltyAvoidedKwd)} د.ك`,
                        financialSummaryEn: `Compliance Cost: ${f0(reg.costImpactKwd)} KWD • Penalties Shielded: ${f0(reg.penaltyAvoidedKwd)} KWD`,
                        mandatoryRulesAr: reg.mitigationStepsAr,
                        mandatoryRulesEn: reg.mitigationStepsEn,
                        bodyAr: isStopActive
                          ? buildRegulationStopDirective(reg, true)
                          : circularBodyAr,
                        bodyEn: isStopActive
                          ? buildRegulationStopDirective(reg, false)
                          : circularBodyEn,
                      })
                    }
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-white px-3 text-xs font-semibold text-emerald-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-emerald-50 dark:bg-[#0C141B] dark:text-emerald-300"
                  >
                    <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      {isAr ? 'طباعة / تصدير تعميم رسمي 📄' : 'Print Official Circular 📄'}
                    </span>
                  </button>

                  {!isStopActive ? (
                    <button
                      type="button"
                      onClick={() => handleStopRegulatoryViolation(reg)}
                      className="btn-colored inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-rose-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700"
                      style={{ color: '#FFFFFF' }}
                    >
                      <Lock className="h-3 w-3" />
                      <span>
                        {isAr ? 'إيقاف أي مخالفة رقابية ⛔' : 'Stop Regulatory Violation ⛔'}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleClearRegulatoryStop(reg)}
                      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-neutral-200/80 px-3.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-300 dark:bg-white/10 dark:text-slate-200"
                    >
                      <Unlock className="h-3 w-3" />
                      <span>{isAr ? 'فك التجميد بعد التصحيح 🔓' : 'Lift Stop Order 🔓'}</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`reg-circ-${reg.id}`, activeCircularText)}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-[#F7F7F8] px-3 text-xs font-medium text-neutral-800 hover:bg-neutral-200/70 dark:bg-neutral-950 dark:text-slate-200"
                  >
                    {copiedKey === `reg-circ-${reg.id}` ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{isAr ? 'تم النسخ ✓' : 'Copied ✓'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>{isAr ? 'نسخ التعميم 📋' : 'Copy Circular 📋'}</span>
                      </>
                    )}
                  </button>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(activeCircularText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>{isAr ? 'واتساب 📲' : 'WhatsApp 📲'}</span>
                  </a>

                  {!SEEDED_REGULATIONS.some((s) => s.id === reg.id) ? (
                    <button
                      type="button"
                      onClick={() =>
                        persistRegulations(regulations.filter((x) => x.id !== reg.id))
                      }
                      className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs text-neutral-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}
