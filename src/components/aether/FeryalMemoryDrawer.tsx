'use client'

import React, { useEffect, useState } from 'react'
import { Brain, CheckCircle2, Plus, Sparkles, Trash2, TrendingUp, X } from 'lucide-react'
import {
  FERYAL_MEMORY_UPDATED_EVENT,
  getFeryalMemorySync,
  hydrateFeryalMemory,
  recordDecisionOutcome,
  removeLearnedRule,
  teachPermanentFact,
  type FeryalMemoryState,
  type RuleCategory,
} from '@/lib/feryal-learning-engine'

export interface FeryalMemoryDrawerProps {
  open: boolean
  onClose: () => void
  isAr: boolean
  isAuditor?: boolean
  onAskScalePlan: (prompt: string) => void
}

const CATEGORY_OPTIONS: readonly { id: RuleCategory; ar: string; en: string }[] = [
  { id: 'supply_chain', ar: 'المشتريات والمخزن والعارضية', en: 'Supply Chain & Ardiya' },
  { id: 'delivery_fleet', ar: 'التوصيل وأسطول TMP/Tgo', en: 'TMP/Tgo Delivery Fleet' },
  { id: 'branches_menu', ar: 'الفروع والمنيو', en: 'Branches & Menu' },
  { id: 'finance_policy', ar: 'السياسة المالية والهوامش', en: 'CFO Policy & Margins' },
] as const

export function FeryalMemoryDrawer({
  open,
  onClose,
  isAr,
  isAuditor = false,
  onAskScalePlan,
}: FeryalMemoryDrawerProps) {
  const [memory, setMemory] = useState<FeryalMemoryState>(() => getFeryalMemorySync())
  const [teachText, setTeachText] = useState('')
  const [teachCat, setTeachCat] = useState<RuleCategory>('supply_chain')
  const [teachSaved, setTeachSaved] = useState(false)

  const [showAddOutcome, setShowAddOutcome] = useState(false)
  const [outTitle, setOutTitle] = useState('')
  const [outBrand, setOutBrand] = useState('تشاينا جاردن')
  const [outBranch, setOutBranch] = useState('السالمية')
  const [outGain, setOutGain] = useState('1200')

  useEffect(() => {
    void hydrateFeryalMemory().then(setMemory)
    const onUpdate = () => setMemory(getFeryalMemorySync())
    window.addEventListener(FERYAL_MEMORY_UPDATED_EVENT, onUpdate)
    return () => window.removeEventListener(FERYAL_MEMORY_UPDATED_EVENT, onUpdate)
  }, [])

  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose, open])

  if (!open) return null

  const handleTeachSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const created = teachPermanentFact({
      textAr: teachText,
      textEn: teachText,
      category: teachCat,
      source: 'manual_taught',
    })
    if (created) {
      setTeachText('')
      setTeachSaved(true)
      window.setTimeout(() => setTeachSaved(false), 2000)
    }
  }

  const handleRecordOutcome = (e: React.FormEvent) => {
    e.preventDefault()
    const created = recordDecisionOutcome({
      titleAr: outTitle,
      originBrandAr: outBrand,
      originBranchAr: outBranch,
      beforeMetricAr: 'خط الأساس قبل التطبيق',
      afterMetricAr: 'نتيجة ميدانية رابحة وموثقة',
      monthlyGainKwd: Number(outGain) || 1000,
    })
    if (created) {
      setOutTitle('')
      setShowAddOutcome(false)
    }
  }

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex justify-end bg-[#09110E]/45 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[560px] flex-col overflow-hidden bg-white shadow-2xl dark:bg-[#101C17]"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="btn-colored flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white dark:bg-[#10B981] dark:text-[#04130D]">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-extrabold text-slate-950 dark:text-white">
                {isAr ? 'ذاكرة وتطور فريال 🧠' : 'Feryal Institutional Memory 🧠'}
              </h2>
              <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                {isAr
                  ? '٤ طبقات تعلم مستمر تُحقن تلقائياً في العقل الثلاثي (كلاود + جميني + جروك)'
                  : '4-layer continuous learning injected into cached Triple-Brain prompts'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* 4 Live Layer Counters */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="ae-bento-subcard rounded-2xl p-3 text-center">
              <div className="text-[20px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                {memory.rules.length}
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'قواعد الشركة' : 'Firm Rules'}
              </div>
            </div>
            <div className="ae-bento-subcard rounded-2xl p-3 text-center">
              <div className="text-[20px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                {memory.outcomes.length}
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'خطة رابحة ✅' : 'Proven Wins'}
              </div>
            </div>
            <div className="ae-bento-subcard rounded-2xl p-3 text-center">
              <div className="text-[20px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                {memory.preferences.length}
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'تفضيلات الإدارة' : 'Preferences'}
              </div>
            </div>
            <div className="ae-bento-subcard rounded-2xl p-3 text-center">
              <div className="text-[20px] font-extrabold tabular-nums text-slate-950 dark:text-white">
                {memory.snapshots.length}
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'لقطات أودو' : 'Snapshots'}
              </div>
            </div>
          </div>

          {/* + علّم فريال معلومة دائمة */}
          {!isAuditor ? (
            <form onSubmit={handleTeachSubmit} className="ae-bento-card space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-extrabold text-slate-950 dark:text-white">
                  {isAr ? '+ علّم فريال معلومة دائمة' : '+ Teach Feryal a Permanent Rule'}
                </span>
                {teachSaved ? (
                  <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">
                    {isAr ? 'تم الحفظ في الذاكرة الدائمة ✓' : 'Saved to permanent memory ✓'}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setTeachCat(c.id)}
                    className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-bold transition-all ${
                      teachCat === c.id
                        ? 'btn-colored bg-emerald-600 text-white dark:bg-[#10B981] dark:text-[#04130D]'
                        : 'ae-bento-subcard text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isAr ? c.ar : c.en}
                  </button>
                ))}
              </div>

              <textarea
                rows={2}
                value={teachText}
                onChange={(e) => setTeachText(e.target.value)}
                placeholder={
                  isAr
                    ? 'مثال: عقد الدواجن الجديد مع المورد ثابت بسعر أقل ٦٪ ويُستلم في المخزن المركزي كل أحد وأربعاء…'
                    : 'Example: New poultry contract is 6% lower and delivered to Central Warehouse every Sun & Wed…'
                }
                className="ae-bento-subcard w-full rounded-xl p-3 text-[13px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 dark:text-white"
              />

              <button
                type="submit"
                disabled={teachText.trim().length < 4}
                className="btn-colored inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 text-[12.5px] font-extrabold text-white transition hover:bg-emerald-500 disabled:opacity-40 dark:bg-emerald-500 dark:text-[#04130D]"
              >
                <Plus className="h-4 w-4" />
                <span>
                  {isAr ? 'حفظ وتثبيت في ذاكرة العقل الثلاثي' : 'Save to Council Memory'}
                </span>
              </button>
            </form>
          ) : null}

          {/* Layer 1: Confirmed Institutional & Learned Rules */}
          <section className="space-y-2.5">
            <h3 className="text-[14px] font-extrabold text-slate-950 dark:text-white">
              {isAr
                ? '١. القواعد المؤسسية المعتمدة والمكتسبة'
                : '1. Institutional & Auto-Learned Rules'}
            </h3>
            <div className="space-y-2">
              {memory.rules.map((r) => (
                <div key={r.id} className="ae-bento-subcard rounded-2xl p-3.5">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        r.source === 'preseeded'
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                      }`}
                    >
                      {r.source === 'preseeded'
                        ? isAr
                          ? 'قاعدة تأسيسية معتمدة'
                          : 'Core Verified Rule'
                        : r.source === 'auto_chat'
                          ? isAr
                            ? 'تعلّم تلقائي من المحادثة'
                            : 'Auto-Learned from Chat'
                          : isAr
                            ? 'تعليم مباشر من الإدارة'
                            : 'Taught by Executive'}
                    </span>
                    {!isAuditor && r.source !== 'preseeded' ? (
                      <button
                        type="button"
                        onClick={() => removeLearnedRule(r.id)}
                        className="rounded-full p-1 text-slate-400 hover:text-rose-600"
                        title={isAr ? 'حذف القاعدة' : 'Remove rule'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  <p className="text-[12.5px] leading-relaxed font-medium text-slate-800 dark:text-slate-200">
                    {isAr ? r.textAr : r.textEn}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Layer 3: Proven Outcomes (`خطة مجرّبة ورابحة ✅`) & Auto-Scaling */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-extrabold text-slate-950 dark:text-white">
                {isAr
                  ? '٢. نتائج قبل/بعد وتعميم الخطط الرابحة'
                  : '2. Proven Winners & Cross-Branch Scaling'}
              </h3>
              {!isAuditor ? (
                <button
                  type="button"
                  onClick={() => setShowAddOutcome((v) => !v)}
                  className="text-[13px] font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {isAr ? '+ تسجيل خطة رابحة' : '+ Log Winner'}
                </button>
              ) : null}
            </div>

            {!isAuditor && showAddOutcome ? (
              <form onSubmit={handleRecordOutcome} className="ae-bento-subcard space-y-2 rounded-2xl p-3.5">
                <input
                  type="text"
                  value={outTitle}
                  onChange={(e) => setOutTitle(e.target.value)}
                  placeholder={isAr ? 'اسم الخطة المجرّبة…' : 'Tested play title…'}
                  className="h-8 w-full rounded-xl bg-white px-3 text-[12px] text-slate-900 ring-1 ring-slate-200 dark:bg-[#09110E] dark:text-white dark:ring-white/10"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={outBrand}
                    onChange={(e) => setOutBrand(e.target.value)}
                    placeholder={isAr ? 'المطعم' : 'Brand'}
                    className="h-8 rounded-xl bg-white px-2.5 text-[12px] text-slate-900 ring-1 ring-slate-200 dark:bg-[#09110E] dark:text-white dark:ring-white/10"
                  />
                  <input
                    type="text"
                    value={outBranch}
                    onChange={(e) => setOutBranch(e.target.value)}
                    placeholder={isAr ? 'الفرع' : 'Branch'}
                    className="h-8 rounded-xl bg-white px-2.5 text-[12px] text-slate-900 ring-1 ring-slate-200 dark:bg-[#09110E] dark:text-white dark:ring-white/10"
                  />
                  <input
                    type="number"
                    value={outGain}
                    onChange={(e) => setOutGain(e.target.value)}
                    placeholder="KWD/mo"
                    className="h-8 rounded-xl bg-white px-2.5 text-[12px] text-slate-900 ring-1 ring-slate-200 dark:bg-[#09110E] dark:text-white dark:ring-white/10"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-colored h-8 w-full rounded-full bg-emerald-600 text-[12px] font-bold text-white transition hover:bg-emerald-500 dark:bg-emerald-500 dark:text-[#04130D]"
                >
                  {isAr ? 'اعتماد كخطة مجرّبة ورابحة ✅' : 'Mark as Proven Winner ✅'}
                </button>
              </form>
            ) : null}

            <div className="space-y-2.5">
              {memory.outcomes.map((o) => (
                <div key={o.id} className="ae-bento-subcard space-y-2 rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isAr ? 'خطة مجرّبة ورابحة ✅' : 'Proven Winner ✅'}
                    </span>
                    <span className="font-mono text-[12px] font-extrabold text-emerald-700 dark:text-emerald-400">
                      +{o.monthlyGainKwd.toLocaleString('en-US')} {isAr ? 'د.ك/شهر' : 'KWD/mo'}
                    </span>
                  </div>
                  <div className="text-[13.5px] font-extrabold text-slate-950 dark:text-white">
                    {isAr ? o.titleAr : o.titleEn}
                  </div>
                  <div className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                    {isAr
                      ? `${o.originBrandAr} • ${o.originBranchAr} — ${o.afterMetricAr}`
                      : `${o.originBrandEn} • ${o.originBranchEn}`}
                  </div>
                  <div className="rounded-xl bg-white/80 p-2.5 text-[12px] leading-relaxed text-slate-700 dark:bg-white/[0.04] dark:text-slate-200">
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                      <TrendingUp className="me-1 inline h-3.5 w-3.5" />
                      {isAr ? 'فرصة التعميم التلقائي: ' : 'Auto-Scale Play: '}
                    </span>
                    {isAr ? o.scaleSuggestionAr : o.scaleSuggestionEn}
                  </div>
                  {!isAuditor ? (
                    <button
                      type="button"
                      onClick={() => {
                        onAskScalePlan(
                          isAr
                            ? `اعتمدت الشركة "${o.titleAr}" كخطة مجرّبة ورابحة ✅ في (${o.originBrandAr} - ${o.originBranchAr}) بعائد +${o.monthlyGainKwd} د.ك شهرياً. ضع خطة تنفيذية لتعميمها فوراً على باقي فروع وعلامات فنتشر فودز المناسبة مع الجدول المالي.`
                            : `We verified "${o.titleEn}" as a Proven Winner ✅ at (${o.originBrandEn} - ${o.originBranchEn}) yielding +${o.monthlyGainKwd} KWD/mo. Build an immediate rollout plan across our other eligible Venture Foods brands and branches.`,
                        )
                        onClose()
                      }}
                      className="btn-colored inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-emerald-600 text-[12px] font-bold text-white transition hover:bg-emerald-500 dark:bg-emerald-500 dark:text-[#04130D]"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>
                        {isAr
                          ? 'اطلب خطة تعميمها على باقي الفروع'
                          : 'Generate Cross-Branch Rollout Plan'}
                      </span>
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {/* Layer 4: Longitudinal Odoo Daily Snapshots */}
          <section className="space-y-2">
            <h3 className="text-[14px] font-extrabold text-slate-950 dark:text-white">
              {isAr ? '٣. سجل لقطات أودو الطولية (تتبع الاتجاه)' : '3. Longitudinal Odoo Daily Snapshots'}
            </h3>
            <div className="ae-bento-subcard overflow-x-auto rounded-2xl p-3">
              <table className="w-full text-start text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200/70 text-slate-500 dark:border-white/10">
                    <th className="pb-2 text-start font-bold">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="pb-2 text-start font-bold">{isAr ? 'مبيعات ٣٠ي' : '30d Sales'}</th>
                    <th className="pb-2 text-start font-bold">{isAr ? 'الصافي/١٠د.ك' : 'Net/10'}</th>
                    <th className="pb-2 text-start font-bold">{isAr ? 'الأكل/١٠د.ك' : 'Food/10'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                  {[...memory.snapshots].reverse().map((s) => (
                    <tr key={s.dateKey} className="tabular-nums">
                      <td className="py-2 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {s.dateKey}
                      </td>
                      <td className="py-2 font-semibold text-slate-700 dark:text-slate-300">
                        {s.sales30dKwd.toLocaleString('en-US')} {isAr ? 'د.ك' : 'KWD'}
                      </td>
                      <td className="py-2 font-extrabold text-emerald-700 dark:text-emerald-400">
                        {s.netPocket10.toFixed(2)}
                      </td>
                      <td className="py-2 font-semibold text-slate-600 dark:text-slate-400">
                        {s.food10.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
