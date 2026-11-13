'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Check, Columns2, Copy, Loader2, MessageCircle, RefreshCw, Sparkles, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { FeryalStudioMessage, feryalPlainText } from '@/components/aether/FeryalStudioMessage'
import {
  askDualHeavyBrain,
  BRAIN_HEALTH_EVENT,
  BRAIN_MODE_EVENT,
  FERYAL_PRIMARY_MODES,
  getActiveBrainMode,
  getPrimaryModeBadge,
  normalizeBrainMode,
  probeDualBrainHealth,
  setActiveBrainMode,
  type BrainLiveHealth,
  type BrainMode,
  type DualBrainResponse,
} from '@/lib/dual-heavy-brain'

export interface DualBrainPagePanelProps {
  pageTitleAr: string
  pageTitleEn: string
  promptAr: string
  promptEn: string
  pageContext: string
}

export function DualBrainPagePanel({
  pageTitleAr,
  pageTitleEn,
  promptAr,
  promptEn,
  pageContext,
}: DualBrainPagePanelProps) {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { filters, workspace } = useGlobalFilter()

  const [mode, setMode] = useState<'triple' | 'claude' | 'gemini' | 'grok'>('triple')
  const [health, setHealth] = useState<BrainLiveHealth | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DualBrainResponse | null>(null)
  const [showSplit, setShowSplit] = useState(false)
  const [copied, setCopied] = useState(false)

  const syncLiveModes = useCallback(async () => {
    try {
      const h = await probeDualBrainHealth(false)
      setHealth(h)
    } catch {}
  }, [])

  useEffect(() => {
    setMode(normalizeBrainMode(getActiveBrainMode()))
    void syncLiveModes()

    const onMode = (e: Event) => {
      const detail = (e as CustomEvent<BrainMode>).detail
      setMode(normalizeBrainMode(detail ?? getActiveBrainMode()))
    }
    const onHealth = () => {
      void syncLiveModes()
    }
    window.addEventListener(BRAIN_MODE_EVENT, onMode)
    window.addEventListener(BRAIN_HEALTH_EVENT, onHealth)
    window.addEventListener('storage', onHealth)
    return () => {
      window.removeEventListener(BRAIN_MODE_EVENT, onMode)
      window.removeEventListener(BRAIN_HEALTH_EVENT, onHealth)
      window.removeEventListener('storage', onHealth)
    }
  }, [syncLiveModes])

  const runAnalysis = useCallback(async () => {
    setLoading(true)
    try {
      const res = await askDualHeavyBrain({
        query: isAr ? promptAr : promptEn,
        lang: isAr ? 'ar' : 'en',
        mode,
        filters,
        workspace,
        pageContext,
      })
      setResult(res)
    } catch {
      // Deterministic fallback guaranteed
    } finally {
      setLoading(false)
    }
  }, [filters, isAr, mode, pageContext, promptAr, promptEn, workspace])

  const buttonLabel = getPrimaryModeBadge(mode, isAr)

  const whatsappText = result
    ? isAr
      ? `*${pageTitleAr} — ${result.engineLabelAr}*\n(${workspace.subtitleAr})\n\n${feryalPlainText(result.reply)}`
      : `*${pageTitleEn} — ${result.engineLabelEn}*\n(${workspace.subtitleEn})\n\n${feryalPlainText(result.reply)}`
    : ''

  const handleCopy = async () => {
    if (!whatsappText) return
    try {
      await navigator.clipboard?.writeText(whatsappText)
    } catch {}
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const individualPanels = [
    result?.claudeReply
      ? {
          key: 'claude',
          titleAr: 'تحليل استراتيجي معمّق',
          titleEn: 'Deep Strategic',
          badge: isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic',
          reply: result.claudeReply,
        }
      : null,
    result?.geminiReply
      ? {
          key: 'gemini',
          titleAr: 'إجابة تنفيذية سريعة',
          titleEn: 'Fast Executive',
          badge: isAr ? 'إجابة تنفيذية سريعة' : 'Fast Executive',
          reply: result.geminiReply,
        }
      : null,
    result?.grokReply
      ? {
          key: 'grok',
          titleAr: 'تحليل المخاطر والنمو (3 زوايا)',
          titleEn: 'Growth & Risk Synthesis (3 Angles)',
          badge: isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic',
          reply: result.grokReply,
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => Boolean(x))

  const hasMultipleBrains = individualPanels.length >= 2
  const statusNote = isAr ? result?.statusNoteAr : result?.statusNoteEn

  const liveClaudeId = isAr ? 'دقيق · تحليل دقيق' : 'Deep & Precise'
  const liveGeminiId = isAr ? 'سريع · إجابة سريعة' : 'Fast Answer'
  const liveGrokId = isAr ? 'فحص الصور والفيديو' : 'Vision & Video Inspector'
  const claudeReady = Boolean(health?.claudeReady ?? true)
  const geminiReady = Boolean(health?.geminiReady ?? true)
  const grokReady = Boolean(health?.grokReady ?? true)

  return (
    <section
      dir={isAr ? 'rtl' : 'ltr'}
      aria-label={isAr ? 'قراءة تنفيذية ذكية للصفحة' : 'Executive Page Readout'}
      className="ae-bento-card no-print w-full max-w-full min-w-0 overflow-x-hidden px-4 py-3 sm:px-5 sm:py-3.5"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-extrabold text-slate-950 dark:text-white">
              {isAr ? 'قراءة ذكية فورية لأرقام هذه الصفحة' : 'Instant Executive Readout for This Page'}
            </span>
            {result ? (
              <span className="rounded-xl bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                {isAr ? result.engineLabelAr : result.engineLabelEn}
              </span>
            ) : null}
          </div>
          <p className="whitespace-normal break-words text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
            {isAr
              ? `${pageTitleAr} • ${workspace.subtitleAr}`
              : `${pageTitleEn} • ${workspace.subtitleEn}`}
          </p>

          {/* Friendly 2-Option Mode Toggle (`دقيق` / `سريع`) + Vision Readiness */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11.5px]">
            {FERYAL_PRIMARY_MODES.map((opt) => {
              const active = opt.id === 'gemini' ? mode === 'gemini' : mode !== 'gemini'
              const dotReady = opt.id === 'gemini' ? geminiReady : claudeReady
              const labelText = opt.id === 'gemini' ? liveGeminiId : liveClaudeId
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setMode(opt.id)
                    setActiveBrainMode(opt.id)
                  }}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-0.5 font-semibold ring-1 transition-colors ${
                    active
                      ? 'bg-emerald-50/80 text-emerald-900 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-500/30'
                      : 'bg-slate-900/[0.02] text-slate-500 ring-slate-900/[0.05] hover:bg-slate-900/[0.05] dark:bg-white/[0.03] dark:text-slate-400 dark:ring-white/[0.06]'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${dotReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span>{labelText}</span>
                </button>
              )
            })}

            <span
              className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-0.5 font-semibold ring-1 ${
                mode === 'claude'
                  ? 'bg-emerald-50/80 text-emerald-900 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-500/30'
                  : 'bg-slate-900/[0.02] text-slate-500 ring-slate-900/[0.05] dark:bg-white/[0.03] dark:text-slate-400 dark:ring-white/[0.06]'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${grokReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>{liveGrokId}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void runAnalysis()}
            className="btn-colored inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-4 text-[13px] font-bold text-white transition-all duration-150 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-60 dark:bg-emerald-500 dark:text-emerald-950"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {isAr ? 'جارٍ إعداد القراءة التنفيذية…' : 'Preparing Executive Readout…'}
                </span>
              </>
            ) : result ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{isAr ? 'تحديث التحليل' : 'Refresh Readout'}</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>{buttonLabel}</span>
              </>
            )}
          </button>

          {result ? (
            <button
              type="button"
              onClick={() => {
                setResult(null)
                setShowSplit(false)
              }}
              aria-label={isAr ? 'إغلاق التحليل' : 'Close analysis'}
              className="ae-bento-subcard inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-all duration-150 hover:opacity-90 dark:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {result ? (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4 dark:border-white/[0.06]">
          {statusNote ? (
            <div className="rounded-xl bg-amber-50/80 px-3.5 py-2 text-[12px] font-semibold text-amber-900 ring-1 ring-amber-500/20 dark:bg-amber-950/30 dark:text-amber-200">
              {statusNote}
            </div>
          ) : null}

          <div className="ae-bento-subcard rounded-2xl p-5 text-[14.5px] leading-[1.85] text-slate-800 dark:text-slate-100">
            <FeryalStudioMessage text={result.reply} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {hasMultipleBrains ? (
                <button
                  type="button"
                  onClick={() => setShowSplit((v) => !v)}
                  aria-expanded={showSplit}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-bold tabular-nums transition-all duration-150 ${
                    showSplit
                      ? 'btn-colored bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950'
                      : 'ae-bento-subcard text-slate-700 hover:opacity-90 dark:text-slate-200'
                  }`}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                  <span>
                    {isAr
                      ? `عرض الزوايا التفصيلية (${individualPanels.length})`
                      : `View Detailed Perspectives (${individualPanels.length})`}
                  </span>
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="ae-bento-subcard inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-bold text-slate-700 transition-all duration-150 hover:opacity-90 dark:text-slate-200"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {isAr ? 'تم النسخ ✓' : 'Copied ✓'}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{isAr ? 'نسخ الملخص' : 'Copy Brief'}</span>
                  </>
                )}
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-colored inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-[12.5px] font-bold text-white transition-all duration-150 hover:bg-emerald-500"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>{isAr ? 'إرسال واتساب' : 'WhatsApp'}</span>
              </a>
            </div>
          </div>

          {showSplit && hasMultipleBrains ? (
            <div
              className={`grid grid-cols-1 gap-4 ${
                individualPanels.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
              }`}
            >
              {individualPanels.map((panel) => (
                <article key={panel.key} className="ae-bento-subcard min-w-0 rounded-2xl p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5 dark:border-white/[0.06]">
                    <span className="text-[13.5px] font-extrabold text-slate-950 dark:text-white">
                      {isAr ? panel.titleAr : panel.titleEn}
                    </span>
                    <span className="rounded-lg bg-white px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-white/[0.06] dark:text-emerald-300">
                      {panel.badge}
                    </span>
                  </div>
                  <div className="text-[14px] leading-[1.8] text-slate-700 dark:text-slate-200">
                    <FeryalStudioMessage text={panel.reply} />
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
