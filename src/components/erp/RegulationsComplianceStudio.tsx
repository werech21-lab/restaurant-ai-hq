'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
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
  Sparkles,
  Trash2,
  Unlock,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  APPROVED_BRANCH_IDS,
  getBranchLabel,
  type GlobalBranch,
} from '@/lib/aether/global-filter-engine'
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
  'ae-bento-card rounded-2xl bg-white p-3.5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const KPI_CARD_CLS =
  'ae-kpi-card rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const SUBCARD_CLS =
  'ae-bento-subcard rounded-2xl bg-[#F6F7F8] p-3.5 ring-1 ring-slate-900/[0.03] dark:bg-[#0B1410] dark:ring-emerald-500/[0.08]'
const SEGMENT_TRACK_CLS =
  'flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]'
const SEGMENT_BTN_CLS =
  'shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 cursor-pointer'
const SEGMENT_BTN_ACTIVE_CLS =
  'bg-white font-semibold text-emerald-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/25'
const SEGMENT_BTN_IDLE_CLS =
  'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
const INPUT_CLS =
  'h-10 w-full rounded-xl bg-white px-3.5 text-[14px] font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/80 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500/35 dark:bg-[#0B1410] dark:text-slate-100 dark:ring-emerald-500/15'
const PRIMARY_SOFT_BTN_CLS =
  'inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-50 px-3.5 text-[13px] font-semibold text-emerald-900 ring-1 ring-emerald-500/25 transition-all duration-150 hover:bg-emerald-100/90 disabled:opacity-60 dark:bg-emerald-950/65 dark:text-emerald-200 dark:ring-emerald-400/25 dark:hover:bg-emerald-900/60'
const HEADER_ACTION_BTN_CLS =
  'inline-flex h-9 sm:h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-50 px-3.5 sm:px-4 text-[13px] font-semibold text-emerald-900 ring-1 ring-emerald-500/25 transition-all duration-150 hover:bg-emerald-100/90 disabled:opacity-60 dark:bg-emerald-950/65 dark:text-emerald-200 dark:ring-emerald-400/25 dark:hover:bg-emerald-900/60'
const MENU_ITEM_CLS =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-start text-[13.5px] font-medium text-slate-700 transition-colors hover:bg-emerald-50/70 hover:text-emerald-900 dark:text-slate-200 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-200'

const f0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')

const normalizeUniqueTitle = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

function dedupeRegulations(list: RegulationPlaybookItem[]): RegulationPlaybookItem[] {
  const seenAr = new Set<string>()
  const seenEn = new Set<string>()
  const out: RegulationPlaybookItem[] = []
  for (const item of list) {
    const kAr = normalizeUniqueTitle(item.titleAr)
    const kEn = normalizeUniqueTitle(item.titleEn)
    if ((kAr && seenAr.has(kAr)) || (kEn && seenEn.has(kEn))) continue
    if (kAr) seenAr.add(kAr)
    if (kEn) seenEn.add(kEn)
    out.push(item)
  }
  return out
}

export function RegulationsComplianceStudio() {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const kwd = isAr ? 'د.ك' : 'KWD'
  const { filters, workspace } = useGlobalFilter()

  const {
    store,
    session,
    activeBreaches,
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

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
      if (raw) setRegulations(dedupeRegulations(sanitizeRegulations(JSON.parse(raw))))
    } catch {}
    try {
      const rawStop = window.localStorage.getItem(REG_STOP_ORDERS_STORAGE_KEY)
      if (rawStop) setStoppedRegs(JSON.parse(rawStop) as Record<string, string>)
    } catch {}
  }, [])

  useEffect(() => {
    if (!openMenuId) return
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest('[data-reg-menu-root]')) {
        setOpenMenuId(null)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openMenuId])

  const persistRegulations = useCallback((next: RegulationPlaybookItem[]) => {
    const clean = dedupeRegulations(next)
    setRegulations(clean)
    try {
      window.localStorage.setItem(REGULATIONS_STORAGE_KEY, JSON.stringify(clean))
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
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-[1920px] mx-auto space-y-6 pb-12 text-[14.5px] leading-relaxed text-slate-800 dark:text-slate-100"
    >
      {/* ───────────── 1. Slim Contextual Bar + Scrollable Track Filter + Add Regulation ───────────── */}
      <div className={`${CARD_CLS} !p-3.5 sm:!p-4 space-y-3`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="ae-icon-badge shrink-0">
              <Scale className="h-4 w-4" />
            </span>
            <p className="min-w-0 text-[13px] sm:text-[13.5px] font-medium leading-snug text-slate-600 dark:text-slate-300">
              {isAr
                ? `${workspace.subtitleAr} • البلدية وهيئة الغذاء (مطبخ العارضية)، القوى العاملة، التجارة، والمعارض EXB`
                : `${workspace.subtitleEn} • Municipality & PAFN (Ardiya), Manpower & Rider Permits, MOCI & EXB`}
            </p>
            {session.active ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Unlock className="h-3.5 w-3.5" />
                <span>{isAr ? 'وضع المدير نشط 🔓' : 'Manager Active 🔓'}</span>
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => openDrawer('all')}
              className="ae-pill-light h-9 sm:h-10 shrink-0 !rounded-xl px-3.5 text-[13px]"
            >
              <Bell className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isAr ? 'مركز اعتمادات المدير 🔔' : 'Governance Bell 🔔'}</span>
            </button>

            <button
              type="button"
              onClick={() => setFormOpen((v) => !v)}
              className={HEADER_ACTION_BTN_CLS}
            >
              <Plus className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
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
        </div>

        {/* Horizontal Touch-Scrollable Regulatory Track Segmented Control */}
        <div
          role="tablist"
          aria-label={isAr ? 'تصفية المسارات الرقابية' : 'Filter Regulatory Tracks'}
          className={SEGMENT_TRACK_CLS}
        >
          {REGULATION_TRACK_OPTIONS.map((t) => {
            const active = trackFilter === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTrackFilter(t.id)}
                className={`${SEGMENT_BTN_CLS} ${
                  active ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                }`}
              >
                {isAr ? t.ar : t.en}
              </button>
            )
          })}
        </div>
      </div>

      {/* Collapsible `+ إضافة تشريع جديد` Form */}
      {formOpen ? (
        <form onSubmit={handleAddRegulation} className={`${CARD_CLS} space-y-4`}>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
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
              <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
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
              <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
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
              <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
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
              <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
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

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
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
              <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
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

          <div className="flex flex-col gap-3.5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <label className="mb-1.5 block text-[13.5px] font-medium text-slate-600 dark:text-slate-300">
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
                className="w-full rounded-xl bg-white p-3 text-[14px] text-slate-900 ring-1 ring-slate-200/80 outline-none focus:ring-2 focus:ring-emerald-500/35 dark:text-slate-100 dark:ring-white/10"
              />
            </div>

            <button type="submit" className={`${HEADER_ACTION_BTN_CLS} shrink-0`}>
              <Plus className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
              <span>{isAr ? 'حفظ التشريع وخطة التعامل' : 'Save Regulation & Playbook'}</span>
            </button>
          </div>
        </form>
      ) : null}

      {/* ───────────── 2. 4 Executive Regulatory KPIs (`2x2` Mobile Grid) ───────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
          <div className="text-[12.5px] sm:text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? 'التشريعات الفعالة المتابعة' : 'Active Tracked Regulations'}
          </div>
          <div
            dir="ltr"
            data-kpi-val
            className="mt-1.5 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white"
          >
            {stats.totalCount}
          </div>
          <p className="mt-1.5 text-[12px] sm:text-[13.5px] leading-snug text-slate-500 dark:text-slate-400">
            {isAr ? 'بلدية، غذاء، قوى عاملة، تجارة، وإطفاء' : 'Municipality, PAFN, PAM, MOCI & KFF'}
          </p>
        </article>

        <article className={`${KPI_CARD_CLS} ae-glow-amber`}>
          <div className="text-[12.5px] sm:text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? 'إجمالي تكلفة الامتثال' : 'Total Compliance Cost Impact'}
          </div>
          <div
            dir="ltr"
            data-kpi-val
            className="mt-1.5 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white"
          >
            {f0(stats.totalCostKwd)}{' '}
            <span className="text-[12.5px] sm:text-[15px] font-semibold text-slate-400">{kwd}</span>
          </div>
          <p className="mt-1.5 text-[12px] sm:text-[13.5px] leading-snug text-slate-500 dark:text-slate-400">
            {isAr ? 'شهادات صحية، تصاريح توصيل، وصيانة سلامة' : 'Permits, health cards & safety calibration'}
          </p>
        </article>

        <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
          <div className="text-[12.5px] sm:text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? 'الحماية من الغرامات والإغلاق' : 'Penalty Exposure Shielded'}
          </div>
          <div
            dir="ltr"
            data-kpi-val
            className="mt-1.5 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
          >
            {f0(stats.totalPenaltyAvoidedKwd)}{' '}
            <span className="text-[12.5px] sm:text-[15px] font-semibold text-slate-400">{kwd}</span>
          </div>
          <p className="mt-1.5 text-[12px] sm:text-[13.5px] leading-snug text-slate-500 dark:text-slate-400">
            {isAr ? 'تفادي غرامات إدارية وتوقف تشغيل الفروع' : 'Fines & closure downtime prevented'}
          </p>
        </article>

        <article className={`${KPI_CARD_CLS} ae-glow-sky`}>
          <div className="text-[12.5px] sm:text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? 'مؤشر جاهزية الفروع الـ 7' : '7-Branch Readiness Score'}
          </div>
          <div
            dir="ltr"
            data-kpi-val
            className="mt-1.5 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white"
          >
            {stats.readinessPct}%
          </div>
          <p className="mt-1.5 text-[12px] sm:text-[13.5px] leading-snug text-slate-500 dark:text-slate-400">
            {isAr
              ? `${stats.readyBranchSlots} من ${stats.totalSlots} نقطة مطابقة مكتملة`
              : `${stats.readyBranchSlots} of ${stats.totalSlots} branch checks verified`}
          </p>
        </article>
      </section>

      {/* ───────────── 3. Wide 2x2 Regulatory Playbook Grid (`grid-cols-1 xl:grid-cols-2 gap-6`) ───────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredRegulations.map((reg) => {
          const refKey = `regulation:${reg.id}`
          const approval = getApprovalByRef(refKey)
          const isApproved = approval?.status === 'approved'
          const isPending = approval?.status === 'pending'
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
          const menuOpen = openMenuId === reg.id

          const severityBadge =
            reg.severity === 'critical'
              ? {
                  cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-950/60 dark:text-rose-300',
                  label: isAr ? 'أولوية قصوى' : 'Critical',
                }
              : reg.severity === 'high'
                ? {
                    cls: 'bg-amber-50 text-amber-800 ring-1 ring-amber-500/20 dark:bg-amber-950/60 dark:text-amber-200',
                    label: isAr ? 'أولوية عالية' : 'High Priority',
                  }
                : {
                    cls: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300',
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

          const openPrintForRegulation = () => {
            openCircularPrintModal({
              circularKey: readinessKey,
              serialRef: issuedCircular?.serialRef ?? buildCircularSerialRef(circularKey),
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
              bodyAr: isStopActive ? buildRegulationStopDirective(reg, true) : circularBodyAr,
              bodyEn: isStopActive ? buildRegulationStopDirective(reg, false) : circularBodyEn,
            })
          }

          const feryalPrompt = isAr
            ? `راجعي اشتراط (${reg.code}: ${reg.titleAr}) الصادر عن (${reg.authorityAr}) قبل مهلة ${reg.deadlineDate} وأعطيني قائمة فحص سريعة لمديري الفروع السبعة ومطبخ العارضية.`
            : `Review regulation (${reg.code}: ${reg.titleEn}) by (${reg.authorityEn}) ahead of deadline ${reg.deadlineDate} and generate a quick inspection checklist for all 7 branches and Ardiya.`

          return (
            <article
              key={reg.id}
              className={`${CARD_CLS} flex flex-col justify-between gap-4 transition-all duration-150 ${
                menuOpen ? 'z-30' : 'z-0'
              }`}
            >
              <div className="space-y-4">
                {/* Top Meta Row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-50 px-3 py-0.5 font-mono text-[12.5px] font-bold text-emerald-900 ring-1 ring-emerald-500/20 dark:bg-emerald-950/70 dark:text-emerald-200">
                      {reg.code}
                    </span>
                    <span className={`rounded-full px-3 py-0.5 text-[12px] font-semibold ${severityBadge.cls}`}>
                      {severityBadge.label}
                    </span>
                    <span
                      dir="ltr"
                      className="rounded-full bg-amber-50 px-3 py-0.5 text-[12px] font-semibold tabular-nums text-amber-800 ring-1 ring-amber-500/20 dark:bg-amber-950/60 dark:text-amber-200"
                    >
                      {isAr ? `المهلة: ${reg.deadlineDate}` : `Deadline: ${reg.deadlineDate}`}
                    </span>

                    {issuedCircular ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[12px] font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-200">
                        <Megaphone className="h-3 w-3" />
                        <span>{isAr ? 'تم التعميم 📢' : 'Broadcasted 📢'}</span>
                      </span>
                    ) : null}

                    {isStopActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[12px] font-semibold text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-950/70 dark:text-rose-300">
                        <ShieldAlert className="h-3 w-3" />
                        <span>{isAr ? 'إيقاف مخالفة مفعل ⛔' : 'Stop Order Active ⛔'}</span>
                      </span>
                    ) : null}
                  </div>

                  {/* Cost Impact vs Penalty Shielded Pills */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="ae-bento-subcard px-3.5 py-1.5 text-end">
                      <div className="text-[11.5px] text-slate-500 dark:text-slate-400">
                        {isAr ? 'تكلفة الامتثال' : 'Cost Impact'}
                      </div>
                      <div
                        dir="ltr"
                        className="text-[14.5px] font-bold tabular-nums text-slate-900 dark:text-white"
                      >
                        {f0(reg.costImpactKwd)} {kwd}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-emerald-50/80 px-3.5 py-1.5 text-end ring-1 ring-emerald-500/15 dark:bg-emerald-950/40 dark:ring-emerald-400/20">
                      <div className="text-[11.5px] text-emerald-800 dark:text-emerald-300">
                        {isAr ? 'غرامات متفاداة' : 'Fines Shielded'}
                      </div>
                      <div
                        dir="ltr"
                        className="text-[14.5px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300"
                      >
                        {f0(reg.penaltyAvoidedKwd)} {kwd}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[13px] font-medium text-emerald-800 dark:text-emerald-300">
                    {isAr ? reg.authorityAr : reg.authorityEn}
                  </div>
                  <h2 className="text-[16px] font-semibold leading-snug text-slate-900 dark:text-white">
                    {isAr ? reg.titleAr : reg.titleEn}
                  </h2>
                  <p className="text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {isAr ? reg.summaryAr : reg.summaryEn}
                  </p>
                </div>

                {/* Step-by-Step Mitigation Plan (`خطة التعامل`) */}
                <div className={`${SUBCARD_CLS} space-y-2`}>
                  <div className="text-[13.5px] font-semibold text-slate-900 dark:text-white">
                    {isAr ? 'خطة التعامل التنفيذية خطوة بخطوة:' : 'Step-by-Step Mitigation Plan:'}
                  </div>
                  <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(isAr ? reg.mitigationStepsAr : reg.mitigationStepsEn).map((step, idx) => (
                      <li
                        key={`${reg.id}-step-${idx}`}
                        className="flex items-start gap-2.5 rounded-xl bg-white/90 p-2.5 text-[14px] leading-relaxed text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:bg-white/[0.04] dark:text-slate-200"
                      >
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[12px] font-bold text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                          {idx + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* 7/7 Branch Readiness Checklist */}
                <div className={`${SUBCARD_CLS} space-y-2.5`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-slate-900 dark:text-white">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>
                        {isAr
                          ? `جاهزية الفروع السبعة (${readyBranchesCount}/7)`
                          : `7-Branch Readiness (${readyBranchesCount}/7)`}
                      </span>
                      {pendingBranchesCount > 0 ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[12px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                          {isAr
                            ? `${pendingBranchesCount} قيد الاستكمال`
                            : `${pendingBranchesCount} pending`}
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {isAr ? 'مطابقة 100% ✓' : '100% Verified ✓'}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => confirmAllBranchesReceipt(readinessKey)}
                      className="cursor-pointer rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-800 ring-1 ring-emerald-500/20 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                    >
                      {isAr ? 'تأكيد الـ 7 فروع ✓' : 'Verify All 7 ✓'}
                    </button>
                  </div>

                  <div className={SEGMENT_TRACK_CLS}>
                    {APPROVED_BRANCH_IDS.map((branchId) => {
                      const ready = Boolean(readinessMap[branchId])
                      const isActiveGlobalBranch = filters.branch === branchId
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
                          className={`inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl px-3 py-1.5 text-[12.5px] font-semibold transition-all duration-150 ${
                            ready
                              ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/25 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-200'
                              : 'bg-amber-50 text-amber-800 ring-1 ring-amber-500/25 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200'
                          } ${isActiveGlobalBranch ? 'ring-2 ring-emerald-500' : ''}`}
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
              </div>

              {/* Progressive State-Driven Single Primary Action + Quiet Overflow Menu */}
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200/70 pt-3.5 dark:border-white/[0.06]">
                <div className="flex flex-wrap items-center gap-2">
                  {isApproved ? (
                    <>
                      <span
                        title={approval?.seal?.sealId}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-50/90 px-3.5 text-[13px] font-semibold text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        <span>{isAr ? 'معتمد رسمياً ✓' : 'Officially Approved ✓'}</span>
                      </span>

                      <button
                        type="button"
                        onClick={openPrintForRegulation}
                        className={PRIMARY_SOFT_BTN_CLS}
                      >
                        <FileText className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                        <span>{isAr ? 'طباعة التعميم الرسمي 📄' : 'Print Official Circular 📄'}</span>
                      </button>
                    </>
                  ) : isPending && approval ? (
                    <>
                      <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-50 px-3 text-[12.5px] font-semibold text-amber-800 ring-1 ring-amber-500/20 dark:bg-amber-950/60 dark:text-amber-200">
                        <Bell className="h-3.5 w-3.5" />
                        <span>{isAr ? 'بانتظار الختم 🔔' : 'Pending Seal 🔔'}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          approveItemWithPin(approval.id, approval.titleAr, approval.titleEn)
                        }
                        className={PRIMARY_SOFT_BTN_CLS}
                      >
                        <Lock className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                        <span>{isAr ? 'اعتماد بختم المدير' : 'Approve with Manager PIN'}</span>
                      </button>
                    </>
                  ) : (
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
                      className={PRIMARY_SOFT_BTN_CLS}
                    >
                      <Bell className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                      <span>{isAr ? 'طلب اعتماد المدير' : 'Request Manager Approval'}</span>
                    </button>
                  )}
                </div>

                {/* Quiet Compact Overflow Menu (`مشاركة ⋯`) */}
                <div data-reg-menu-root className="relative">
                  <button
                    type="button"
                    aria-expanded={menuOpen}
                    onClick={() => setOpenMenuId((cur) => (cur === reg.id ? null : reg.id))}
                    className="ae-pill-light h-9 px-3.5 text-[13px]"
                  >
                    <span>{isAr ? 'مشاركة ⋯' : 'Share ⋯'}</span>
                  </button>

                  {menuOpen ? (
                    <div className="absolute end-0 bottom-full z-50 mb-2 w-64">
                      <div className="ae-bento-card space-y-0.5 p-1.5 !shadow-[0_18px_42px_-10px_rgba(15,23,42,0.18)]">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null)
                            openPrintForRegulation()
                          }}
                          className={MENU_ITEM_CLS}
                        >
                          <FileText className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            {isAr ? 'طباعة / تصدير تعميم رسمي 📄' : 'Print Official Circular 📄'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null)
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
                          }}
                          className={MENU_ITEM_CLS}
                        >
                          <Megaphone className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            {isAr ? 'تعميم خطة التعامل رسمياً 📢' : 'Broadcast Playbook (PIN) 📢'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            copyToClipboard(`reg-circ-${reg.id}`, activeCircularText)
                            setOpenMenuId(null)
                          }}
                          className={MENU_ITEM_CLS}
                        >
                          {copiedKey === `reg-circ-${reg.id}` ? (
                            <>
                              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                              <span>{isAr ? 'تم النسخ ✓' : 'Copied ✓'}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 shrink-0 text-slate-500" />
                              <span>{isAr ? 'نسخ التعميم 📋' : 'Copy Circular 📋'}</span>
                            </>
                          )}
                        </button>

                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(activeCircularText)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setOpenMenuId(null)}
                          className={MENU_ITEM_CLS}
                        >
                          <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{isAr ? 'واتساب الفروع 📲' : 'WhatsApp Share 📲'}</span>
                        </a>

                        <Link
                          href={`/erp/feryal-ai?prompt=${encodeURIComponent(feryalPrompt)}`}
                          onClick={() => setOpenMenuId(null)}
                          className={MENU_ITEM_CLS}
                        >
                          <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{isAr ? 'استشارة المستشارة فريال ✨' : 'Ask Feryal AI ✨'}</span>
                        </Link>

                        {!isStopActive ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null)
                              handleStopRegulatoryViolation(reg)
                            }}
                            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-start text-[13.5px] font-medium text-rose-700 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/50"
                          >
                            <ShieldAlert className="h-4 w-4 shrink-0" />
                            <span>{isAr ? 'إيقاف المخالفة فوراً ⛔' : 'Stop Breach Immediately ⛔'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null)
                              handleClearRegulatoryStop(reg)
                            }}
                            className={MENU_ITEM_CLS}
                          >
                            <Unlock className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span>{isAr ? 'فك التجميد بعد التصحيح 🔓' : 'Lift Stop Order 🔓'}</span>
                          </button>
                        )}

                        {!SEEDED_REGULATIONS.some((s) => s.id === reg.id) ? (
                          <button
                            type="button"
                            onClick={() => {
                              persistRegulations(regulations.filter((x) => x.id !== reg.id))
                              setOpenMenuId(null)
                            }}
                            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-start text-[13.5px] font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="h-4 w-4 shrink-0" />
                            <span>{isAr ? 'حذف التشريع المخصص' : 'Delete Custom Regulation'}</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          )
        })}
      </section>

      {/* ───────────── 4. Single Compact 1-Line Odoo 17 Watchdog Banner (Opens Approval Bell Breaches Tab) ───────────── */}
      <button
        type="button"
        onClick={() => openDrawer('breaches')}
        className="ae-bento-card ae-lift flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4 text-start transition-all"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="ae-icon-badge">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="text-[14.5px] font-semibold text-slate-900 dark:text-white">
            {isAr
              ? 'مراقب أودو ١٧ نشط • افتح جرس الاعتمادات لمراجعة المخالفات 🔔'
              : 'Odoo 17 Watchdog Active • Open Approval Bell to Review Breaches 🔔'}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[13px] font-semibold tabular-nums ${
              activeBreaches.length > 0
                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-950/60 dark:text-rose-300'
                : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                activeBreaches.length > 0 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
            />
            <span>
              {isAr
                ? `${activeBreaches.length} مخالفات نشطة`
                : `${activeBreaches.length} Active Breaches`}
            </span>
          </span>
          <ArrowUpRight className="h-4 w-4 text-slate-400" />
        </div>
      </button>
    </div>
  )
}
