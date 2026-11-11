'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Check, Columns2, Copy, Flame, Loader2, MessageCircle, RefreshCw, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { FeryalStudioMessage, feryalPlainText } from '@/components/aether/FeryalStudioMessage'
import {
  askDualHeavyBrain,
  BRAIN_HEALTH_EVENT,
  BRAIN_MODE_EVENT,
  getActiveBrainMode,
  normalizeBrainMode,
  probeDualBrainHealth,
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

  const syncLiveModels = useCallback(async () => {
    try {
      const h = await probeDualBrainHealth(false)
      setHealth(h)
    } catch {}
  }, [])

  useEffect(() => {
    setMode(normalizeBrainMode(getActiveBrainMode()))
    void syncLiveModels()

    const onMode = (e: Event) => {
      const detail = (e as CustomEvent<BrainMode>).detail
      setMode(normalizeBrainMode(detail ?? getActiveBrainMode()))
    }
    const onHealth = () => {
      void syncLiveModels()
    }
    window.addEventListener(BRAIN_MODE_EVENT, onMode)
    window.addEventListener(BRAIN_HEALTH_EVENT, onHealth)
    window.addEventListener('storage', onHealth)
    return () => {
      window.removeEventListener(BRAIN_MODE_EVENT, onMode)
      window.removeEventListener(BRAIN_HEALTH_EVENT, onHealth)
      window.removeEventListener('storage', onHealth)
    }
  }, [syncLiveModels])

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
      // askDualHeavyBrain guarantees a deterministic fallback
    } finally {
      setLoading(false)
    }
  }, [filters, isAr, mode, pageContext, promptAr, promptEn, workspace])

  const buttonLabel = (() => {
    if (mode === 'claude') return isAr ? 'تحليل كلاود العميق 🔬' : 'Analyze with Claude Deep 🔬'
    if (mode === 'gemini') return isAr ? 'تحليل جميني Carbon ⚡' : 'Analyze with Gemini Carbon ⚡'
    if (mode === 'grok') return isAr ? 'تحليل جروك Heavy 🧠' : 'Analyze with Grok Heavy 🧠'
    return isAr ? 'تحليل العقل الثلاثي 🔥' : 'Triple-Brain Analysis 🔥'
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

  const individualPanels = [
    result?.claudeReply
      ? {
          key: 'claude',
          titleAr: 'رأي كلاود العميق 🔬',
          titleEn: 'Claude Extended Thinking 🔬',
          model: result.claudeModel,
          reply: result.claudeReply,
        }
      : null,
    result?.geminiReply
      ? {
          key: 'gemini',
          titleAr: 'رأي جميني Carbon Pro ⚡',
          titleEn: 'Gemini Carbon Pro ⚡',
          model: result.geminiModel,
          reply: result.geminiReply,
        }
      : null,
    result?.grokReply
      ? {
          key: 'grok',
          titleAr: 'رأي جروك Heavy (٣ زوايا) 🧠',
          titleEn: 'xAI Grok Heavy (3-Lens) 🧠',
          model: result.grokModel,
          reply: result.grokReply,
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => Boolean(x))

  const hasMultipleBrains = individualPanels.length >= 2
  const statusNote = isAr ? result?.statusNoteAr : result?.statusNoteEn

  const liveClaudeId =
    result?.claudeModel ?? health?.claudeModel ?? 'claude-opus-4-6 (Extended Thinking)'
  const liveGrokId = result?.grokModel ?? health?.grokModel ?? 'grok-4.20-0309-reasoning'
  const liveGeminiId = result?.geminiModel ?? health?.geminiModel ?? 'gemini-2.5-pro'
  const claudeReady = Boolean(result?.claudeModel || health?.claudeReady)
  const grokReady = health ? health.grokReady : true
  const geminiReady = health ? health.geminiReady : true

  return (
    <section
      dir={isAr ? 'rtl' : 'ltr'}
      aria-label={isAr ? 'تحليل العقل الثلاثي للصفحة' : 'Triple-Brain Page Analysis'}
      className="ae-bento-card no-print p-4 sm:p-5"
    >
      {/* Compact 1-Click Trigger Bar + Live 3-Brain Model ID Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
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

          {/* Always-visible Exact Live Resolved Model IDs for All 3 Brains */}
          <div dir="ltr" className="flex flex-wrap items-center gap-1.5 pt-0.5 font-mono text-[11px]">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold ring-1 ${
                mode === 'triple' || mode === 'claude'
                  ? 'bg-slate-900/[0.04] text-slate-800 ring-slate-900/10 dark:bg-white/[0.07] dark:text-slate-100 dark:ring-white/15'
                  : 'bg-slate-900/[0.02] text-slate-500 ring-slate-900/[0.05] dark:bg-white/[0.03] dark:text-slate-400 dark:ring-white/[0.06]'
              }`}
              title="Anthropic Claude Resolved Model ID"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  claudeReady ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span>🔬 {liveClaudeId}</span>
            </span>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold ring-1 ${
                mode === 'triple' || mode === 'grok'
                  ? 'bg-slate-900/[0.04] text-slate-800 ring-slate-900/10 dark:bg-white/[0.07] dark:text-slate-100 dark:ring-white/15'
                  : 'bg-slate-900/[0.02] text-slate-500 ring-slate-900/[0.05] dark:bg-white/[0.03] dark:text-slate-400 dark:ring-white/[0.06]'
              }`}
              title="xAI Grok Resolved Model ID"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  grokReady ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span>🧠 {liveGrokId}</span>
            </span>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold ring-1 ${
                mode === 'triple' || mode === 'gemini'
                  ? 'bg-slate-900/[0.04] text-slate-800 ring-slate-900/10 dark:bg-white/[0.07] dark:text-slate-100 dark:ring-white/15'
                  : 'bg-slate-900/[0.02] text-slate-500 ring-slate-900/[0.05] dark:bg-white/[0.03] dark:text-slate-400 dark:ring-white/[0.06]'
              }`}
              title="Google Gemini Resolved Model ID"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  geminiReady ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span>⚡ {liveGeminiId}</span>
            </span>
          </div>
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
                  {isAr ? 'جارٍ تشغيل مجلس العقل الثلاثي…' : 'Running AI Council…'}
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

      {/* Rendered Consensus + Individual Council Perspectives */}
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
              {hasMultipleBrains ? (
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
                      ? `عرض آراء المحركات منفردة (${individualPanels.length})`
                      : `View Individual Council Brains (${individualPanels.length})`}
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

          {/* Side-by-Side Individual Perspectives (2 or 3 columns) */}
          {showSplit && hasMultipleBrains ? (
            <div
              className={`grid grid-cols-1 gap-4 ${
                individualPanels.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
              }`}
            >
              {individualPanels.map((panel) => (
                <article key={panel.key} className="ae-bento-subcard rounded-2xl p-5">
                  <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5 dark:border-white/[0.06]">
                    <span className="text-[13.5px] font-extrabold text-slate-950 dark:text-white">
                      {isAr ? panel.titleAr : panel.titleEn}
                    </span>
                    {panel.model ? (
                      <span
                        dir="ltr"
                        className="rounded-full bg-white px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
                      >
                        {panel.model}
                      </span>
                    ) : null}
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
