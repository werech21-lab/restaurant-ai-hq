'use client'

import React, { useEffect, useState } from 'react'
import {
  Brain,
  CheckCircle2,
  Plus,
  RotateCcw,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import {
  deleteLearnedRule,
  FERYAL_MEMORY_UPDATED_EVENT,
  getFeryalMemorySync,
  hydrateFeryalMemory,
  recordDecisionOutcome,
  resetFeryalMemoryToDefaults,
  teachPermanentFact,
  type FeryalMemoryState,
  type LearnedRuleCategory,
} from '@/lib/feryal-learning-engine'

export interface FeryalMemoryDrawerProps {
  open: boolean
  onClose: () => void
  isAr: boolean
  isAuditor?: boolean
}

const CATEGORY_LABELS: Record<LearnedRuleCategory, { ar: string; en: string }> = {
  operations: { ar: 'التشغيل والمخزن', en: 'Ops & Warehouse' },
  suppliers: { ar: 'الموردون والمشتريات', en: 'Suppliers & POs' },
  pricing: { ar: 'التسعير والخصومات', en: 'Pricing & Discounts' },
  delivery: { ar: 'قنوات التوصيل', en: 'Delivery Channels' },
  branches: { ar: 'الفروع السبعة', en: '7 Branches' },
  menu: { ar: 'الأصناف والمنيو', en: 'Menu & Items' },
  custom: { ar: 'ملاحظة إدارية', en: 'Executive Note' },
}

export function FeryalMemoryDrawer({ open, onClose, isAr, isAuditor = false }: FeryalMemoryDrawerProps) {
  const [mem, setMem] = useState<FeryalMemoryState>(() => getFeryalMemorySync())
  const [newFact, setNewFact] = useState('')
  const [category, setCategory] = useState<LearnedRuleCategory>('operations')
  const [tab, setTab] = useState<'rules' | 'outcomes'>('rules')
  const [outcomeTitle, setOutcomeTitle] = useState('')
  const [outcomeBranch, setOutcomeBranch] = useState('')
  const [savedToast, setSavedToast] = useState<string | null>(null)

  useEffect(() => {
    hydrateFeryalMemory().then(setMem)
    const onUpdate = () => setMem(getFeryalMemorySync())
    window.addEventListener(FERYAL_MEMORY_UPDATED_EVENT, onUpdate)
    return () => window.removeEventListener(FERYAL_MEMORY_UPDATED_EVENT, onUpdate)
  }, [])

  if (!open) return null

  const flashToast = (msg: string) => {
    setSavedToast(msg)
    window.setTimeout(() => setSavedToast(null), 2600)
  }

  const handleAddFact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isAuditor) return
    const trimmed = newFact.trim()
    if (!trimmed) return
    const next = await teachPermanentFact({ text: trimmed, category, source: 'user' })
    setMem(next)
    setNewFact('')
    flashToast(isAr ? 'تم حفظ الملاحظة الإدارية' : 'Executive note saved')
  }

  const handleDeleteRule = async (id: string) => {
    if (isAuditor) return
    const next = await deleteLearnedRule(id)
    setMem(next)
  }

  const handleLogOutcome = async (status: 'approved' | 'rejected') => {
    if (isAuditor) return
    const title = outcomeTitle.trim()
    if (!title) return
    const next = await recordDecisionOutcome({
      titleAr: title,
      titleEn: title,
      branchOrBrandAr: outcomeBranch.trim() || 'الفروع السبعة المعتمدة',
      branchOrBrandEn: outcomeBranch.trim() || '7 Approved Branches',
      status,
      monthlyGainKwd: 0,
    })
    setMem(next)
    setOutcomeTitle('')
    setOutcomeBranch('')
    flashToast(
      status === 'approved'
        ? isAr
          ? 'تم توثيق القرار المعتمد'
          : 'Approved decision logged'
        : isAr
          ? 'تم تسجيل رفض المقترح'
          : 'Rejected proposal logged',
    )
  }

  const handleReset = async () => {
    if (isAuditor) return
    const next = await resetFeryalMemoryToDefaults()
    setMem(next)
    flashToast(isAr ? 'تم تفريغ سجل الملاحظات بالكامل' : 'Notes cleared')
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex justify-end bg-slate-950/45 backdrop-blur-[2px]"
      dir={isAr ? 'rtl' : 'ltr'}
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-slate-900 border-s border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 px-5 py-4 bg-gradient-to-l from-emerald-50/70 via-white to-white dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[16px] font-black text-slate-900 dark:text-white">
                {isAr ? 'سجل الملاحظات والقرارات المسجلة' : 'Recorded Executive Notes & Decisions'}
              </h2>
              <p className="mt-0.5 text-[12px] text-slate-600 dark:text-slate-400">
                {isAr
                  ? 'يعرض فقط القواعد والقرارات التي يدخلها المستخدم فعلياً دون أي ذاكرة مسبقة أو أرقام مفترضة.'
                  : 'Displays only user-entered notes and decisions with zero pre-loaded rules or synthetic figures.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 border-b border-slate-200/80 dark:border-slate-800 px-5 py-2.5 bg-slate-50/80 dark:bg-slate-950/40">
          {(
            [
              {
                id: 'rules',
                ar: `الملاحظات المحفوظة (${mem.rules.length})`,
                en: `Saved Notes (${mem.rules.length})`,
              },
              {
                id: 'outcomes',
                ar: `سجل القرارات (${mem.outcomes.length})`,
                en: `Decision Log (${mem.outcomes.length})`,
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-xl px-3 py-1.5 text-[12px] font-bold transition ${
                tab === t.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {isAr ? t.ar : t.en}
            </button>
          ))}
        </div>

        {savedToast && (
          <div className="mx-5 mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-[12.5px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200">
            {savedToast}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tab === 'rules' && (
            <>
              {!isAuditor && (
                <form
                  onSubmit={handleAddFact}
                  className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-black text-emerald-950 dark:text-emerald-200">
                      {isAr ? 'إضافة ملاحظة إدارية' : 'Add Executive Note'}
                    </span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as LearnedRuleCategory)}
                      className="rounded-lg border border-emerald-300 bg-white dark:bg-slate-900 dark:border-slate-700 px-2 py-1 text-[11.5px] font-semibold text-slate-700 dark:text-slate-200"
                    >
                      {(Object.keys(CATEGORY_LABELS) as LearnedRuleCategory[]).map((cat) => (
                        <option key={cat} value={cat}>
                          {isAr ? CATEGORY_LABELS[cat].ar : CATEGORY_LABELS[cat].en}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    rows={2}
                    value={newFact}
                    onChange={(e) => setNewFact(e.target.value)}
                    placeholder={
                      isAr
                        ? 'اكتب ملاحظة تشغيلية أو رقابية حقيقية لحفظها...'
                        : 'Enter a factual operational or governance note...'
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[12.5px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-emerald-700 transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {isAr ? 'حفظ الملاحظة' : 'Save Note'}
                    </button>
                  </div>
                </form>
              )}

              {mem.rules.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-[12.5px] text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'لا توجد قواعد أو ملاحظات محفوظة حالياً. جميع إجابات فريال تعتمد مباشرة على استعلامات Odoo الحية.'
                    : 'No saved notes. All Feryal answers are sourced directly from live Odoo queries.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {mem.rules.map((r) => (
                    <div
                      key={r.id}
                      className="group flex items-start justify-between gap-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-3 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                            {isAr ? CATEGORY_LABELS[r.category].ar : CATEGORY_LABELS[r.category].en}
                          </span>
                          <span className="text-[10.5px] text-slate-400">{r.createdAt}</span>
                        </div>
                        <p className="text-[13px] leading-relaxed font-medium text-slate-800 dark:text-slate-100">
                          {isAr ? r.textAr : r.textEn}
                        </p>
                      </div>
                      {!isAuditor && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(r.id)}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                          title={isAr ? 'حذف الملاحظة' : 'Delete note'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'outcomes' && (
            <>
              {!isAuditor && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3.5 space-y-2.5">
                  <div className="text-[12.5px] font-black text-slate-900 dark:text-white">
                    {isAr ? 'توثيق قرار إداري فعلي' : 'Log Executive Decision'}
                  </div>
                  <input
                    type="text"
                    value={outcomeTitle}
                    onChange={(e) => setOutcomeTitle(e.target.value)}
                    placeholder={isAr ? 'عنوان القرار...' : 'Decision title...'}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-[12.5px] text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={outcomeBranch}
                    onChange={(e) => setOutcomeBranch(e.target.value)}
                    placeholder={isAr ? 'النطاق أو الفرع المعتمد...' : 'Approved branch or scope...'}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-[12.5px] text-slate-900 dark:text-slate-100"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleLogOutcome('approved')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-1.5 text-[12px] font-bold text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isAr ? 'تسجيل قرار معتمد' : 'Log Approved'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLogOutcome('rejected')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-1.5 text-[12px] font-bold text-white hover:bg-rose-700"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {isAr ? 'تسجيل مقترح مرفوض' : 'Log Rejected'}
                    </button>
                  </div>
                </div>
              )}

              {mem.outcomes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-[12.5px] text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'لا توجد قرارات موثقة في هذا السجل حتى الآن.'
                    : 'No logged decisions yet.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {mem.outcomes.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            o.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {o.status === 'approved'
                            ? isAr
                              ? 'معتمد'
                              : 'Approved'
                            : isAr
                              ? 'مرفوض'
                              : 'Rejected'}
                        </span>
                        <span className="text-[11px] text-slate-400">{o.recordedAt}</span>
                      </div>
                      <div className="text-[13px] font-bold text-slate-900 dark:text-white">
                        {isAr ? o.decisionTitleAr : o.decisionTitleEn}
                      </div>
                      <div className="text-[12px] text-slate-600 dark:text-slate-300">
                        {isAr ? o.lessonAr : o.lessonEn}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200/80 dark:border-slate-800 px-5 py-3 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="text-[11.5px] text-slate-500 dark:text-slate-400">
            {isAr
              ? `إجمالي المحادثات: ${mem.totalInteractions}`
              : `Total Interactions: ${mem.totalInteractions}`}
          </div>
          {!isAuditor && (mem.rules.length > 0 || mem.outcomes.length > 0) && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11.5px] font-semibold text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {isAr ? 'مسح السجل' : 'Clear Log'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
