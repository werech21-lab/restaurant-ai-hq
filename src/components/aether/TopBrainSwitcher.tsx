'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, ClipboardCopy, RefreshCw, RotateCcw, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { SlidingPillTabs } from '@/components/ui/SlidingPillTabs'
import {
  AI_KEY_STORAGE_KEYS,
  hasAnthropicApiKey,
  hasGeminiApiKey,
  isValidGeminiApiKey,
} from '@/lib/ai-keys'
import {
  BRAIN_HEALTH_EVENT,
  BRAIN_MODE_EVENT,
  buildGrokUltraClipboardBrief,
  formatClaudeModelBadge,
  formatGeminiModelBadge,
  getActiveBrainMode,
  getClaudeSonnetOnly,
  normalizeBrainMode,
  probeDualBrainHealth,
  setActiveBrainMode,
  setClaudeSonnetOnly,
  type BrainLiveHealth,
  type BrainMode,
} from '@/lib/dual-heavy-brain'
import { routeTitle } from '@/lib/aether/route-titles'

export const BRAIN_BAR_ROUTES = new Set([
  '/erp',
  '/erp/cores',
  '/erp/before-after',
  '/erp/feryal-ai',
  '/erp/feryal',
  '/erp/aggregator-radar',
  '/erp/events-intelligence',
  '/erp/booth-feasibility',
  '/erp/planning',
  '/erp/regulations',
])

/** Full AI model switcher controls appear ONLY inside Ask Feryal pages. */
export const AI_SWITCHER_ROUTES = new Set([
  '/erp/feryal-ai',
  '/erp/feryal',
])

const MODE_OPTIONS: readonly {
  id: 'triple' | 'claude' | 'gemini' | 'grok'
  ar: string
  en: string
}[] = [
  { id: 'triple', ar: 'العقل الثلاثي 🔥', en: 'Triple Brain 🔥' },
  { id: 'claude', ar: 'كلاود العميق 🔬', en: 'Claude Deep 🔬' },
  { id: 'gemini', ar: 'جميني كاربون High ⚡', en: 'Gemini Carbon High ⚡' },
  { id: 'grok', ar: 'جروك Heavy 🧠', en: 'Grok Heavy 🧠' },
] as const

/**
 * Compact inline Triple-Brain Council Switcher + Copy Brief + `🔑` Key Vault Modal,
 * active across all 6 executive pages inside the Unified Executive Top Bar.
 */
export function BrainControlsInline() {
  const pathname = usePathname()
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { filters, workspace } = useGlobalFilter()

  const [mode, setMode] = useState<'triple' | 'claude' | 'gemini' | 'grok'>('triple')
  const [health, setHealth] = useState<BrainLiveHealth | null>(null)
  const [copiedUltra, setCopiedUltra] = useState(false)
  const [gearOpen, setGearOpen] = useState(false)

  // Local key vault overrides (`aether_anthropic_key` + Gemini + xAI + OpenAI)
  const [customAnthropic, setCustomAnthropic] = useState('')
  const [customXai, setCustomXai] = useState('')
  const [customGemini, setCustomGemini] = useState('')
  const [customOpenAi, setCustomOpenAi] = useState('')
  const [claudeActive, setClaudeActive] = useState(true)
  const [sonnetOnly, setSonnetOnlyState] = useState(false)
  const [savedNotice, setSavedNotice] = useState(false)
  const [probing, setProbing] = useState(false)

  const gearWrapRef = useRef<HTMLDivElement>(null)

  const refreshHealth = useCallback(async (forceRefresh = false) => {
    setClaudeActive(hasAnthropicApiKey())
    setSonnetOnlyState(getClaudeSonnetOnly())
    if (forceRefresh) setProbing(true)
    try {
      const h = await probeDualBrainHealth(forceRefresh)
      setHealth(h)
      setClaudeActive(h.claudeReady)
      if (typeof h.sonnetOnly === 'boolean') setSonnetOnlyState(h.sonnetOnly)
    } catch {
      // Keep UI crisp even if offline
    } finally {
      if (forceRefresh) setProbing(false)
    }
  }, [])

  useEffect(() => {
    setMode(normalizeBrainMode(getActiveBrainMode()))
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        setCustomAnthropic(window.localStorage.getItem(AI_KEY_STORAGE_KEYS.anthropic) ?? '')
        setCustomXai(window.localStorage.getItem(AI_KEY_STORAGE_KEYS.xai) ?? '')
        setCustomGemini(window.localStorage.getItem(AI_KEY_STORAGE_KEYS.gemini) ?? '')
        setCustomOpenAi(window.localStorage.getItem(AI_KEY_STORAGE_KEYS.openai) ?? '')
      }
    } catch {}
    void refreshHealth(false)

    const onBrainMode = (e: Event) => {
      const detail = (e as CustomEvent<BrainMode>).detail
      setMode(normalizeBrainMode(detail ?? getActiveBrainMode()))
    }
    const onHealthUpdate = () => {
      void refreshHealth(false)
    }
    const onStorage = () => {
      setMode(normalizeBrainMode(getActiveBrainMode()))
      setClaudeActive(hasAnthropicApiKey())
      void refreshHealth(false)
    }

    window.addEventListener(BRAIN_MODE_EVENT, onBrainMode)
    window.addEventListener(BRAIN_HEALTH_EVENT, onHealthUpdate)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(BRAIN_MODE_EVENT, onBrainMode)
      window.removeEventListener(BRAIN_HEALTH_EVENT, onHealthUpdate)
      window.removeEventListener('storage', onStorage)
    }
  }, [refreshHealth])

  useEffect(() => {
    if (!gearOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (gearWrapRef.current && !gearWrapRef.current.contains(e.target as Node)) {
        setGearOpen(false)
      }
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGearOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [gearOpen])

  const handleSelectMode = (next: 'triple' | 'claude' | 'gemini' | 'grok') => {
    setMode(next)
    setActiveBrainMode(next)
  }

  const handleCopyForGrokUltra = async () => {
    const titleObj = routeTitle(pathname)
    const pageTitle = titleObj ? (isAr ? titleObj.ar : titleObj.en) : undefined
    const text = buildGrokUltraClipboardBrief(filters, workspace, isAr, pageTitle)
    try {
      await navigator.clipboard?.writeText(text)
    } catch {}
    setCopiedUltra(true)
    window.setTimeout(() => setCopiedUltra(false), 2200)
  }

  const handleSaveCustomKeys = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (customAnthropic.trim()) {
          window.localStorage.setItem(AI_KEY_STORAGE_KEYS.anthropic, customAnthropic.trim())
        } else {
          window.localStorage.removeItem(AI_KEY_STORAGE_KEYS.anthropic)
        }

        if (customXai.trim()) window.localStorage.setItem(AI_KEY_STORAGE_KEYS.xai, customXai.trim())
        else window.localStorage.removeItem(AI_KEY_STORAGE_KEYS.xai)

        if (customGemini.trim() && isValidGeminiApiKey(customGemini.trim())) {
          window.localStorage.setItem(AI_KEY_STORAGE_KEYS.gemini, customGemini.trim())
        } else if (!customGemini.trim()) {
          window.localStorage.removeItem(AI_KEY_STORAGE_KEYS.gemini)
        }

        if (customOpenAi.trim()) {
          window.localStorage.setItem(AI_KEY_STORAGE_KEYS.openai, customOpenAi.trim())
        } else {
          window.localStorage.removeItem(AI_KEY_STORAGE_KEYS.openai)
        }
      }
    } catch {}
    setSavedNotice(true)
    void refreshHealth(true)
    window.setTimeout(() => {
      setSavedNotice(false)
      setGearOpen(false)
    }, 900)
  }

  const handleClearOverrides = () => {
    setCustomAnthropic('')
    setCustomXai('')
    setCustomGemini('')
    setCustomOpenAi('')
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(AI_KEY_STORAGE_KEYS.anthropic)
        window.localStorage.removeItem(AI_KEY_STORAGE_KEYS.xai)
        window.localStorage.removeItem(AI_KEY_STORAGE_KEYS.gemini)
        window.localStorage.removeItem(AI_KEY_STORAGE_KEYS.openai)
      }
    } catch {}
    void refreshHealth(true)
  }

  const handleToggleSonnetOnly = () => {
    const next = !sonnetOnly
    setSonnetOnlyState(next)
    setClaudeSonnetOnly(next)
    void refreshHealth(false)
  }

  const sonnetModelRaw = health?.claudeSonnetModel ?? 'claude-sonnet-5-5'
  const opusModelRaw = health?.claudeOpusModel ?? 'claude-opus-5-5'
  const claudeModelId =
    mode === 'claude' && !sonnetOnly
      ? formatClaudeModelBadge(opusModelRaw)
      : formatClaudeModelBadge(sonnetModelRaw)
  const grokModelId = health?.grokModel ?? 'grok-4.20-0309-reasoning'
  const geminiModelId = formatGeminiModelBadge(health?.geminiModel)
  const grokReady = health ? health.grokReady : true
  const geminiReady = health ? health.geminiReady : hasGeminiApiKey()

  const hasWarning = Boolean(health?.grokQuotaNoteAr && mode === 'grok')

  const allThreeModelsSummary = `${claudeModelId} | Grok: ${grokModelId} | Gemini: ${geminiModelId}`

  const activeBadgeModelId =
    mode === 'claude'
      ? claudeModelId
      : mode === 'grok'
        ? `🧠 ${grokModelId}`
        : mode === 'gemini'
          ? `⚡ ${geminiModelId}`
          : `${claudeModelId} · 🧠 ${grokModelId} · ⚡ ${geminiModelId}`

  if (!pathname || !AI_SWITCHER_ROUTES.has(pathname)) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Verdelo Sliding Pill 4-Option Brain Mode Switcher + Rich 3-Brain Live Model Tooltip */}
      <div className="group relative inline-flex flex-col items-end gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <SlidingPillTabs
            ariaLabel={isAr ? 'اختيار محرك التحليل' : 'Select AI Council Mode'}
            surface="white"
            size="sm"
            value={mode}
            onChange={handleSelectMode}
            options={MODE_OPTIONS.map((opt) => ({
              id: opt.id,
              label: isAr ? opt.ar : opt.en,
            }))}
          />

          {/* Always-visible Live Resolved Model Sub-Badge (click to inspect in 🔑/⚙️ modal) */}
          <button
            type="button"
            dir="ltr"
            onClick={() => setGearOpen((v) => !v)}
            title={allThreeModelsSummary}
            className="hidden cursor-pointer items-center gap-1.5 rounded-full bg-slate-900/[0.04] px-2.5 py-1 font-mono text-[10.5px] font-bold text-slate-700 ring-1 ring-slate-900/[0.06] transition-colors hover:bg-slate-900/[0.08] xl:inline-flex dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/[0.1]"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                hasWarning ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
            <span className="max-w-[430px] truncate">{activeBadgeModelId}</span>
          </button>
        </div>

        {/* Hover Popover Card: Exact Live Resolved Model IDs for All 3 Brains */}
        <div
          role="tooltip"
          dir="ltr"
          className="pointer-events-none invisible absolute top-full end-0 z-50 mt-2 w-[340px] rounded-2xl bg-white p-3 text-left text-[11px] text-slate-900 shadow-lg ring-1 ring-slate-900/10 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 dark:bg-[#111A22] dark:text-slate-100 dark:ring-white/15"
        >
          <div className="mb-1.5 flex items-center justify-between border-b border-slate-100 pb-1.5 text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:text-slate-400">
            <span>Live Council Model IDs</span>
            <span className="text-emerald-600 dark:text-emerald-400">3 Brains</span>
          </div>
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-sans font-bold text-slate-600 dark:text-slate-300">
                <span
                  className={`h-2 w-2 rounded-full ${claudeActive ? 'bg-emerald-500' : 'bg-amber-500'}`}
                />
                🔬 Claude
              </span>
              <span className="truncate font-bold text-slate-950 dark:text-white">
                {claudeModelId}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-sans font-bold text-slate-600 dark:text-slate-300">
                <span
                  className={`h-2 w-2 rounded-full ${grokReady ? 'bg-emerald-500' : 'bg-amber-500'}`}
                />
                🧠 Grok
              </span>
              <span className="truncate font-bold text-slate-950 dark:text-white">
                {grokModelId}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-sans font-bold text-slate-600 dark:text-slate-300">
                <span
                  className={`h-2 w-2 rounded-full ${geminiReady ? 'bg-emerald-500' : 'bg-amber-500'}`}
                />
                ⚡ Gemini
              </span>
              <span className="truncate font-bold text-slate-950 dark:text-white">
                {geminiModelId}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 1-Click Copy Brief */}
      <button
        type="button"
        onClick={() => void handleCopyForGrokUltra()}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-bold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.05] transition-all duration-150 hover:bg-slate-50 hover:ring-slate-900/15 active:scale-95 dark:bg-[#111A22] dark:text-slate-100 dark:ring-white/[0.08]"
        title={
          isAr
            ? 'نسخ أرقام الفلتر الحالي مع القواعد المؤسسية لتطبيق Grok Ultra / Claude'
            : 'Copy filtered Odoo figures + institutional prompt'
        }
      >
        {copiedUltra ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="whitespace-nowrap text-emerald-700 dark:text-emerald-400">
              {isAr ? 'تم النسخ ✓' : 'Copied ✓'}
            </span>
          </>
        ) : (
          <>
            <ClipboardCopy className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span className="whitespace-nowrap">
              {isAr ? 'نسخ لجروك الترا 📋' : 'Copy Brief 📋'}
            </span>
          </>
        )}
      </button>

      {/* Top `🔑 / ⚙️` Settings & API Key Vault Modal */}
      <div ref={gearWrapRef} className="relative">
        <button
          type="button"
          onClick={() => setGearOpen((v) => !v)}
          aria-label={isAr ? 'إعدادات ومفاتيح الذكاء الاصطناعي 🔑⚙️' : 'AI Models & Key Vault 🔑⚙️'}
          title={allThreeModelsSummary}
          aria-expanded={gearOpen}
          className={`relative inline-flex h-9 cursor-pointer items-center gap-1 rounded-full bg-white px-2.5 text-[13px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 focus:outline-none dark:bg-[#111A22] ${
            gearOpen
              ? 'ring-1 ring-slate-900/80 dark:ring-emerald-400/70'
              : 'ring-1 ring-slate-900/[0.05] hover:ring-slate-900/20 dark:ring-white/[0.08]'
          }`}
        >
          <span aria-hidden>🔑⚙️</span>
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${
              hasWarning ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
        </button>

        {gearOpen ? (
          <div className="ae-bento-card absolute end-0 z-50 mt-2 w-[350px] p-4 sm:w-[420px]">
            <div className="flex items-center justify-between gap-2 pb-2">
              <h3 className="text-[13.5px] font-extrabold text-slate-950 dark:text-white">
                {isAr ? 'إصدارات ومفاتيح العقل الثلاثي 🔑⚙️' : 'Triple-Brain Models & Key Vault 🔑⚙️'}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void refreshHealth(true)}
                  disabled={probing}
                  title={isAr ? 'فحص وتحديث إصدارات النماذج الآن' : 'Re-probe live model versions now'}
                  className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${probing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setGearOpen(false)}
                  aria-label={isAr ? 'إغلاق' : 'Close'}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Live Resolved Model IDs Box (Exact Running Versions for All 3 Brains) */}
            <div
              dir="ltr"
              className="rounded-2xl bg-[#F4F6F9] p-3 text-left ring-1 ring-slate-950/[0.05] dark:bg-white/[0.05] dark:ring-white/[0.08]"
            >
              <div className="mb-2 flex items-center justify-between text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <span>
                  {isAr ? 'الإصدارات الحية النشطة (Live Model IDs)' : 'Live Resolved Model IDs'}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">Verified</span>
              </div>
              <div className="space-y-1.5 font-mono text-[11.5px]">
                <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 dark:bg-[#0D151C]">
                  <span className="inline-flex shrink-0 items-center gap-1.5 font-sans text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        claudeActive ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    🔬 Claude
                  </span>
                  <span className="truncate font-bold text-slate-950 dark:text-white">
                    {claudeModelId}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 dark:bg-[#0D151C]">
                  <span className="inline-flex shrink-0 items-center gap-1.5 font-sans text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        grokReady ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    🧠 Grok
                  </span>
                  <span className="truncate font-bold text-slate-950 dark:text-white">
                    {grokModelId}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 dark:bg-[#0D151C]">
                  <span className="inline-flex shrink-0 items-center gap-1.5 font-sans text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        geminiReady ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    ⚡ Gemini
                  </span>
                  <span className="truncate font-bold text-slate-950 dark:text-white">
                    {geminiModelId}
                  </span>
                </div>
              </div>
            </div>

            {/* 1-Click Max Economy Toggle (`وضع التوفير الأقصى (Sonnet فقط ⚡)`) */}
            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-2xl bg-emerald-50/70 px-3 py-2.5 ring-1 ring-emerald-500/20 dark:bg-emerald-950/30 dark:ring-emerald-400/20">
              <div className="min-w-0">
                <div className="text-[11.5px] font-extrabold text-slate-900 dark:text-white">
                  {isAr
                    ? 'وضع التوفير الأقصى (Sonnet فقط ⚡)'
                    : 'Max Economy Mode (Sonnet Only ⚡)'}
                </div>
                <div dir="ltr" className="truncate font-mono text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  {sonnetOnly
                    ? `All calls -> ${sonnetModelRaw}`
                    : `Daily: ${sonnetModelRaw} ⚡ · Deep: ${opusModelRaw} 🔬`}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={sonnetOnly}
                onClick={handleToggleSonnetOnly}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  sonnetOnly
                    ? 'bg-emerald-600'
                    : 'bg-slate-300 dark:bg-white/20'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    sonnetOnly
                      ? isAr
                        ? '-translate-x-5'
                        : 'translate-x-5'
                      : isAr
                        ? '-translate-x-1'
                        : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {isAr
                ? 'مفتاح AetherBI-Live متصل عبر الخادم الآمن تلقائياً. التعديلات الاختيارية أدناه تُحفظ محلياً فقط.'
                : 'AetherBI-Live is pre-wired via secure server proxy. Optional overrides stay in localStorage.'}
            </p>

            <div className="mt-2.5 space-y-2.5">
              <label className="block space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">
                    Anthropic Claude (AetherBI-Live) 🔬
                  </span>
                  <span
                    dir="ltr"
                    className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  >
                    {claudeModelId}
                  </span>
                </div>
                <input
                  type="password"
                  dir="ltr"
                  value={customAnthropic}
                  onChange={(e) => setCustomAnthropic(e.target.value)}
                  placeholder={
                    isAr
                      ? 'AetherBI-Live مفعّل تلقائياً عبر الخادم (اتركه فارغاً للافتراضي)'
                      : 'AetherBI-Live active via server proxy (leave blank for default)'
                  }
                  className="h-9 w-full rounded-xl bg-[#F4F6F9] px-3 font-mono text-[12px] text-slate-900 ring-1 ring-slate-950/[0.05] focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900/80 dark:bg-white/[0.06] dark:text-white"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300">
                    Google Gemini Carbon High ⚡
                  </span>
                  <span
                    dir="ltr"
                    className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  >
                    {geminiModelId}
                  </span>
                </div>
                <input
                  type="password"
                  dir="ltr"
                  value={customGemini}
                  onChange={(e) => setCustomGemini(e.target.value)}
                  placeholder={
                    isAr
                      ? 'مفتاح AQ. مفعّل تلقائياً عبر الخادم (اتركه فارغاً للافتراضي)'
                      : 'AQ. Auth Key active via server proxy (leave blank for default)'
                  }
                  className="h-9 w-full rounded-xl bg-[#F4F6F9] px-3 font-mono text-[12px] text-slate-900 ring-1 ring-slate-950/[0.05] focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900/80 dark:bg-white/[0.06] dark:text-white"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300">
                    xAI Grok 🧠
                  </span>
                  <span
                    dir="ltr"
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                      grokReady
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                    }`}
                  >
                    {grokModelId}
                  </span>
                </div>
                <input
                  type="password"
                  dir="ltr"
                  value={customXai}
                  onChange={(e) => setCustomXai(e.target.value)}
                  placeholder={
                    isAr
                      ? 'مفعّل تلقائياً (اتركه فارغاً للافتراضي)'
                      : 'Built-in active (leave blank for default)'
                  }
                  className="h-9 w-full rounded-xl bg-[#F4F6F9] px-3 font-mono text-[12px] text-slate-900 ring-1 ring-slate-950/[0.05] focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900/80 dark:bg-white/[0.06] dark:text-white"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300">
                  OpenAI Nova Voice 🎙️
                </span>
                <input
                  type="password"
                  dir="ltr"
                  value={customOpenAi}
                  onChange={(e) => setCustomOpenAi(e.target.value)}
                  placeholder={
                    isAr
                      ? 'مفعّل تلقائياً (اتركه فارغاً للافتراضي)'
                      : 'Built-in active (leave blank for default)'
                  }
                  className="h-9 w-full rounded-xl bg-[#F4F6F9] px-3 font-mono text-[12px] text-slate-900 ring-1 ring-slate-950/[0.05] focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900/80 dark:bg-white/[0.06] dark:text-white"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleClearOverrides}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#F4F6F9] px-3 text-[12px] font-bold text-slate-600 hover:bg-slate-200/70 hover:text-slate-950 dark:bg-white/[0.06] dark:text-slate-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{isAr ? 'استعادة الافتراضي' : 'Use Defaults'}</span>
              </button>
              <button
                type="button"
                onClick={handleSaveCustomKeys}
                className="ae-btn-primary inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[12px] font-bold transition-all duration-150"
              >
                {savedNotice ? <Check className="h-3.5 w-3.5" /> : null}
                <span>
                  {savedNotice ? (isAr ? 'تم الحفظ ✓' : 'Saved ✓') : isAr ? 'حفظ' : 'Save'}
                </span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function TopBrainSwitcher() {
  const pathname = usePathname()
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  if (!pathname || !AI_SWITCHER_ROUTES.has(pathname)) return null

  return (
    <section
      aria-label={isAr ? 'مبدل العقل الثلاثي' : 'Triple-Brain Switcher'}
      dir={isAr ? 'rtl' : 'ltr'}
      className="no-print relative z-30 flex flex-wrap items-center justify-end gap-2"
    >
      <BrainControlsInline />
    </section>
  )
}
