'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, ClipboardCopy, RefreshCw, RotateCcw, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
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
  FERYAL_EXECUTIVE_MODES,
  getActiveBrainMode,
  getClaudeSonnetOnly,
  getExecutiveModeLabel,
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
  '/erp/weekday-comparison',
  '/erp/before-after',
  '/erp/warehouse-chain',
  '/erp/prep-sla',
  '/erp/delivery-sla',
  '/erp/aggregator-radar',
  '/erp/social-reviews',
  '/erp/feryal-ai',
  '/erp/feryal',
  '/erp/planning',
  '/erp/regulations',
  '/erp/booth-feasibility',
  '/erp/events-intelligence',
])

/** Full executive mode switcher controls appear ONLY inside Ask Feryal pages. */
export const AI_SWITCHER_ROUTES = new Set([
  '/erp/feryal-ai',
  '/erp/feryal',
])

export function BrainControlsInline() {
  const pathname = usePathname()
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { filters, workspace } = useGlobalFilter()

  const [mode, setMode] = useState<'triple' | 'claude' | 'gemini' | 'grok'>('triple')
  const [health, setHealth] = useState<BrainLiveHealth | null>(null)
  const [copiedBrief, setCopiedBrief] = useState(false)
  const [gearOpen, setGearOpen] = useState(false)

  const [customAnthropic, setCustomAnthropic] = useState('')
  const [customXai, setCustomXai] = useState('')
  const [customGemini, setCustomGemini] = useState('')
  const [customOpenAi, setCustomOpenAi] = useState('')
  const [deepActive, setDeepActive] = useState(true)
  const [economyMode, setEconomyMode] = useState(false)
  const [savedNotice, setSavedNotice] = useState(false)
  const [probing, setProbing] = useState(false)

  const gearWrapRef = useRef<HTMLDivElement>(null)

  const refreshHealth = useCallback(async (forceRefresh = false) => {
    setDeepActive(hasAnthropicApiKey())
    setEconomyMode(getClaudeSonnetOnly())
    if (forceRefresh) setProbing(true)
    try {
      const h = await probeDualBrainHealth(forceRefresh)
      setHealth(h)
      setDeepActive(h.claudeReady)
      if (typeof h.sonnetOnly === 'boolean') setEconomyMode(h.sonnetOnly)
    } catch {
      // Keep UI responsive offline
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
      setDeepActive(hasAnthropicApiKey())
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

  const handleSelectMode = (next: 'triple' | 'claude' | 'gemini') => {
    setMode(next)
    setActiveBrainMode(next)
  }

  const handleCopyExecutiveBrief = async () => {
    const titleObj = routeTitle(pathname)
    const pageTitle = titleObj ? (isAr ? titleObj.ar : titleObj.en) : undefined
    const text = buildGrokUltraClipboardBrief(filters, workspace, isAr, pageTitle)
    try {
      await navigator.clipboard?.writeText(text)
    } catch {}
    setCopiedBrief(true)
    window.setTimeout(() => setCopiedBrief(false), 2200)
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

  const handleToggleEconomy = () => {
    const next = !economyMode
    setEconomyMode(next)
    setClaudeSonnetOnly(next)
    void refreshHealth(false)
  }

  const fastReady = health ? health.geminiReady : hasGeminiApiKey()
  const visionReady = deepActive || fastReady
  const activeModeId: 'triple' | 'gemini' | 'claude' =
    mode === 'gemini' ? 'gemini' : mode === 'claude' ? 'claude' : 'triple'
  const activeModeLabel = getExecutiveModeLabel(activeModeId, isAr)

  if (!pathname || !AI_SWITCHER_ROUTES.has(pathname)) {
    return null
  }

  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
      {/* 3 Friendly Executive Modes Switcher */}
      <div
        role="tablist"
        aria-label={isAr ? 'اختيار نمط فريال التنفيذي' : 'Select Feryal Executive Mode'}
        className="flex min-w-0 max-w-full flex-wrap items-center gap-1 rounded-2xl bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ring-1 ring-slate-900/[0.06] dark:bg-[#111A22] dark:ring-white/[0.08]"
      >
        {FERYAL_EXECUTIVE_MODES.map((opt) => {
          const active = activeModeId === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleSelectMode(opt.id)}
              className={`inline-flex min-h-[30px] min-w-0 cursor-pointer items-center justify-center rounded-xl px-3 py-1 text-[12px] font-bold whitespace-normal transition-all duration-150 focus:outline-none ${
                active
                  ? 'btn-colored bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-[#04130D]'
                  : 'text-slate-600 hover:bg-[#F4F6F9] hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
              }`}
            >
              <span>{isAr ? opt.ar : opt.en}</span>
            </button>
          )
        })}
      </div>

      {/* 1-Click Copy Executive Brief */}
      <button
        type="button"
        onClick={() => void handleCopyExecutiveBrief()}
        className="inline-flex min-h-[34px] min-w-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-1 text-[12px] font-bold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.05] transition-all duration-150 hover:bg-slate-50 hover:ring-slate-900/15 active:scale-95 dark:bg-[#111A22] dark:text-slate-100 dark:ring-white/[0.08]"
        title={
          isAr
            ? 'نسخ ملخص أرقام الفلتر الحالي مع القواعد المؤسسية'
            : 'Copy filtered Odoo figures + executive brief'
        }
      >
        {copiedBrief ? (
          <>
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="whitespace-normal text-emerald-700 dark:text-emerald-400">
              {isAr ? 'تم النسخ ✓' : 'Copied ✓'}
            </span>
          </>
        ) : (
          <>
            <ClipboardCopy className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
            <span className="whitespace-normal">
              {isAr ? 'نسخ الملخص التنفيذي 📋' : 'Copy Executive Brief 📋'}
            </span>
          </>
        )}
      </button>

      {/* Settings & API Key Vault Modal (`🔑⚙️`) */}
      <div ref={gearWrapRef} className="relative">
        <button
          type="button"
          onClick={() => setGearOpen((v) => !v)}
          aria-label={isAr ? 'إعدادات أنماط فريال ومفاتيح الاتصال 🔑⚙️' : 'Executive Modes & Key Vault 🔑⚙️'}
          title={activeModeLabel}
          aria-expanded={gearOpen}
          className={`relative inline-flex h-9 cursor-pointer items-center gap-1 rounded-xl bg-white px-2.5 text-[13px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 focus:outline-none dark:bg-[#111A22] ${
            gearOpen
              ? 'ring-1 ring-emerald-500/50 dark:ring-emerald-400/70'
              : 'ring-1 ring-slate-900/[0.05] hover:ring-slate-900/20 dark:ring-white/[0.08]'
          }`}
        >
          <span aria-hidden>🔑⚙️</span>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </button>

        {gearOpen ? (
          <div className="ae-bento-card absolute end-0 z-50 mt-2 w-[min(350px,calc(100vw-2rem))] p-4 sm:w-[400px]">
            <div className="flex items-center justify-between gap-2 pb-2">
              <h3 className="text-[13.5px] font-extrabold text-slate-950 dark:text-white">
                {isAr ? 'أنماط فريال التنفيذية ومفاتيح الاتصال 🔑⚙️' : 'Executive Modes & Key Vault 🔑⚙️'}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void refreshHealth(true)}
                  disabled={probing}
                  title={isAr ? 'تحديث حالة الاتصال الآن' : 'Refresh connection status'}
                  className="rounded-xl p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${probing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setGearOpen(false)}
                  aria-label={isAr ? 'إغلاق' : 'Close'}
                  className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-[#F4F6F9] p-3 ring-1 ring-slate-950/[0.05] dark:bg-white/[0.05] dark:ring-white/[0.08]">
              <div className="mb-2 flex items-center justify-between text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                <span>{isAr ? 'الأنماط التنفيذية المعتمدة' : 'Active Executive Modes'}</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {isAr ? 'جاهز' : 'Verified'}
                </span>
              </div>
              <div className="space-y-1.5 text-[12px]">
                <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 dark:bg-[#0D151C]">
                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                    <span className={`h-2 w-2 rounded-full ${deepActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {isAr ? 'تحليل استراتيجي معمّق' : 'Deep Strategic'}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {isAr ? 'نشط' : 'Active'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 dark:bg-[#0D151C]">
                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                    <span className={`h-2 w-2 rounded-full ${fastReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {isAr ? 'إجابة تنفيذية سريعة' : 'Fast Executive'}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {isAr ? 'نشط' : 'Active'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 dark:bg-[#0D151C]">
                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                    <span className={`h-2 w-2 rounded-full ${visionReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {isAr ? 'فحص الصور والفيديو' : 'Vision & Video Inspector'}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {isAr ? 'نشط' : 'Active'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-2xl bg-emerald-50/70 px-3 py-2.5 ring-1 ring-emerald-500/20 dark:bg-emerald-950/30 dark:ring-emerald-400/20">
              <div className="min-w-0">
                <div className="text-[11.5px] font-extrabold text-slate-900 dark:text-white">
                  {isAr ? 'وضع الاستجابة الاقتصادية السريعة ⚡' : 'Fast Economy Routing ⚡'}
                </div>
                <div className="truncate text-[10.5px] font-medium text-slate-600 dark:text-slate-300">
                  {economyMode
                    ? isAr
                      ? 'توجيه كافة الاستشارات اليومية للسرعة القصوى'
                      : 'All daily consultations routed for maximum speed'
                    : isAr
                      ? 'توازن ذكي بين الإجابة التنفيذية السريعة والتحليل الاستراتيجي المعمّق'
                      : 'Balanced routing across Fast Executive and Deep Strategic'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={economyMode}
                onClick={handleToggleEconomy}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  economyMode ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-white/20'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    economyMode
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

            <div className="mt-2.5 space-y-2">
              <label className="block space-y-1">
                <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">
                  {isAr ? 'مفتاح التحليل الاستراتيجي المعمّق (اختياري)' : 'Deep Strategic API Key (Optional)'}
                </span>
                <input
                  type="password"
                  dir="ltr"
                  value={customAnthropic}
                  onChange={(e) => setCustomAnthropic(e.target.value)}
                  placeholder={
                    isAr
                      ? 'متصل تلقائياً عبر الخادم (اتركه فارغاً للافتراضي)'
                      : 'Connected via server proxy (leave blank for default)'
                  }
                  className="h-9 w-full rounded-xl bg-[#F4F6F9] px-3 font-mono text-[12px] text-slate-900 ring-1 ring-slate-950/[0.05] focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 dark:bg-white/[0.06] dark:text-white"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? 'مفتاح الإجابة التنفيذية السريعة والصور (اختياري)' : 'Fast Executive & Vision API Key (Optional)'}
                </span>
                <input
                  type="password"
                  dir="ltr"
                  value={customGemini}
                  onChange={(e) => setCustomGemini(e.target.value)}
                  placeholder={
                    isAr
                      ? 'متصل تلقائياً عبر الخادم (اتركه فارغاً للافتراضي)'
                      : 'Connected via server proxy (leave blank for default)'
                  }
                  className="h-9 w-full rounded-xl bg-[#F4F6F9] px-3 font-mono text-[12px] text-slate-900 ring-1 ring-slate-950/[0.05] focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 dark:bg-white/[0.06] dark:text-white"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? 'مفتاح المحرك المساند متعدد الزوايا (اختياري)' : 'Auxiliary Multi-Angle Key (Optional)'}
                </span>
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
                  className="h-9 w-full rounded-xl bg-[#F4F6F9] px-3 font-mono text-[12px] text-slate-900 ring-1 ring-slate-950/[0.05] focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 dark:bg-white/[0.06] dark:text-white"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300">
                  {isAr ? 'مفتاح النطق الصوتي (اختياري)' : 'Voice Synthesis Key (Optional)'}
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
                  className="h-9 w-full rounded-xl bg-[#F4F6F9] px-3 font-mono text-[12px] text-slate-900 ring-1 ring-slate-950/[0.05] focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 dark:bg-white/[0.06] dark:text-white"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleClearOverrides}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#F4F6F9] px-3 text-[12px] font-bold text-slate-600 hover:bg-slate-200/70 hover:text-slate-950 dark:bg-white/[0.06] dark:text-slate-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{isAr ? 'استعادة الافتراضي' : 'Use Defaults'}</span>
              </button>
              <button
                type="button"
                onClick={handleSaveCustomKeys}
                className="btn-colored inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-[12px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
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
      aria-label={isAr ? 'اختيار النمط التنفيذي' : 'Executive Mode Switcher'}
      dir={isAr ? 'rtl' : 'ltr'}
      className="no-print relative z-30 mx-auto flex w-full max-w-[1920px] min-w-0 flex-wrap items-center justify-end gap-2"
    >
      <BrainControlsInline />
    </section>
  )
}
