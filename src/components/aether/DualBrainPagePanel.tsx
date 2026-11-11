'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Check, Columns2, Copy, Flame, Loader2, MessageCircle, RefreshCw, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { FeryalStudioMessage, feryalPlainText } from '@/components/aether/FeryalStudioMessage'
import {
  askDualHeavyBrain,
  BRAIN_MODE_EVENT,
  getActiveBrainMode,
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

  const [mode, setMode] = useState<BrainMode>('dual')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DualBrainResponse | null>(null)
  const [showSplit, setShowSplit] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setMode(getActiveBrainMode())
    const onMode = (e: Event) => {
      const detail = (e as CustomEvent<BrainMode>).detail
      if (detail === 'dual' || detail === 'gemini' || detail === 'grok') {
        setMode(detail)
      } else {
        setMode(getActiveBrainMode())
      }
    }
    window.addEventListener(BRAIN_MODE_EVENT, onMode)
    return () => window.removeEventListener(BRAIN_MODE_EVENT, onMode)
  }, [])

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
      // askDualHeavyBrain already guarantees a deterministic fallback
    } finally {
      setLoading(false)
    }
  }, [filters, isAr, mode, pageContext, promptAr, promptEn, workspace])

  const buttonLabel = (() => {
    if (mode === 'gemini') return isAr ? 'تحليل جميني Carbon ⚡' : 'Analyze with Gemini Carbon ⚡'
    if (mode === 'grok') return isAr ? 'تحليل جروك Heavy 🧠' : 'Analyze with Grok Heavy 🧠'
    return isAr ? 'تحليل العقل المزدوج 🔥' : 'Dual-Brain Analysis 🔥'
  })()

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

  const hasBothBrains = Boolean(result?.geminiReply && result?.grokReply)
  const statusNote = isAr ? result?.statusNoteAr : result?.statusNoteEn

  return (
    <section
      dir={isAr ? 'rtl' : 'ltr'}
      aria-label={isAr ? 'تحليل العقل المزدوج للصفحة' : 'Dual-Brain Page Analysis'}
      className="ae-bento-card no-print p-4 sm:p-5"
    >
      {/* Compact 1-Click Trigger Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-extrabold text-slate-950 dark:text-white">
              {isAr ? 'قراءة ذكية فورية لأرقام هذه الصفحة' : 'Instant Executive Readout for This Page'}
            </span>
            {result ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                {isAr ? result.engineLabelAr : result.engineLabelEn}
              </span>
            ) : null}
          </div>
          <p className="truncate text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
            {isAr
              ? `${pageTitleAr} • ${workspace.subtitleAr}`
              : `${pageTitleEn} • ${workspace.subtitleEn}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void runAnalysis()}
            className="ae-btn-primary inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-bold transition-all duration-150 hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {isAr ? 'جارٍ تشغيل جميني + جروك…' : 'Running Gemini + Grok…'}
                </span>
              </>
            ) : result ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{isAr ? 'تحديث التحليل 🔥' : 'Refresh Analysis 🔥'}</span>
              </>
            ) : (
              <>
                <Flame className="h-4 w-4" />
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
              className="ae-bento-subcard inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-all duration-150 hover:opacity-90 dark:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Rendered Consensus + Optional Individual Gemini & Grok Split View */}
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

          {/* Action Row: Toggle Split View + Copy / Send WhatsApp */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {hasBothBrains ? (
                <button
                  type="button"
                  onClick={() => setShowSplit((v) => !v)}
                  aria-expanded={showSplit}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold transition-all duration-150 ${
                    showSplit
                      ? 'ae-btn-primary'
                      : 'ae-bento-subcard text-slate-700 hover:opacity-90 dark:text-slate-200'
                  }`}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                  <span>
                    {isAr
                      ? 'عرض رأي جميني ورأي جروك كلٌّ على حدة'
                      : 'View Gemini & Grok Separately'}
                  </span>
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="ae-bento-subcard inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold text-slate-700 transition-all duration-150 hover:opacity-90 dark:text-slate-200"
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
                    <span>{isAr ? 'نسخ للواتساب' : 'Copy Brief'}</span>
                  </>
                )}
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 text-[12.5px] font-bold text-white transition-all duration-150 hover:bg-emerald-500"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>{isAr ? 'إرسال واتساب' : 'WhatsApp'}</span>
              </a>
            </div>
          </div>

          {/* Side-by-Side Individual Perspectives */}
          {showSplit && hasBothBrains ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <article className="ae-bento-subcard rounded-2xl p-5">
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5 dark:border-white/[0.06]">
                  <span className="text-[13.5px] font-extrabold text-slate-950 dark:text-white">
                    {isAr ? 'رأي جميني Carbon High ⚡' : 'Gemini Carbon High Perspective ⚡'}
                  </span>
                  {result.geminiModel ? (
                    <span dir="ltr" className="rounded-full bg-white px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                      {result.geminiModel}
                    </span>
                  ) : null}
                </div>
                <div className="text-[14px] leading-[1.8] text-slate-700 dark:text-slate-200">
                  <FeryalStudioMessage text={result.geminiReply ?? ''} />
                </div>
              </article>

              <article className="ae-bento-subcard rounded-2xl p-5">
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5 dark:border-white/[0.06]">
                  <span className="text-[13.5px] font-extrabold text-slate-950 dark:text-white">
                    {isAr ? 'رأي جروك Heavy (٣ زوايا) 🧠' : 'xAI Grok Heavy (3-Lens) 🧠'}
                  </span>
                  {result.grokModel ? (
                    <span dir="ltr" className="rounded-full bg-white px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                      {result.grokModel}
                    </span>
                  ) : null}
                </div>
                <div className="text-[14px] leading-[1.8] text-slate-700 dark:text-slate-200">
                  <FeryalStudioMessage text={result.grokReply ?? ''} />
                </div>
              </article>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
