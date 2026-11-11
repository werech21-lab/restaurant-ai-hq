'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, ClipboardCopy, RotateCcw, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { SlidingPillTabs } from '@/components/ui/SlidingPillTabs'
import { AI_KEY_STORAGE_KEYS, hasAnthropicApiKey } from '@/lib/ai-keys'
import {
  BRAIN_MODE_EVENT,
  buildGrokUltraClipboardBrief,
  getActiveBrainMode,
  normalizeBrainMode,
  probeDualBrainHealth,
  setActiveBrainMode,
  type BrainLiveHealth,
  type BrainMode,
} from '@/lib/dual-heavy-brain'
import { routeTitle } from '@/lib/aether/route-titles'

export const BRAIN_BAR_ROUTES = new Set([
  '/erp',
  '/erp/cores',
  '/erp/before-after',
  '/erp/feryal-ai',
  '/erp/aggregator-radar',
  '/erp/events-intelligence',
])

const MODE_OPTIONS: readonly {
  id: 'triple' | 'claude' | 'gemini' | 'grok'
  ar: string
  en: string
}[] = [
  { id: 'triple', ar: 'العقل الثلاثي 🔥', en: 'Triple Brain 🔥' },
  { id: 'claude', ar: 'كلاود العميق 🔬', en: 'Claude Deep 🔬' },
  { id: 'gemini', ar: 'جميني Carbon ⚡', en: 'Gemini Carbon ⚡' },
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
  const [claudeActive, setClaudeActive] = useState(false)
  const [savedNotice, setSavedNotice] = useState(false)

  const gearWrapRef = useRef<HTMLDivElement>(null)

  const refreshHealth = useCallback(async () => {
    setClaudeActive(hasAnthropicApiKey())
    try {
      const h = await probeDualBrainHealth()
      setHealth(h)
      setClaudeActive(h.claudeReady)
    } catch {
      // Keep UI crisp even if offline
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
    void refreshHealth()

    const onBrainMode = (e: Event) => {
      const detail = (e as CustomEvent<BrainMode>).detail
      setMode(normalizeBrainMode(detail ?? getActiveBrainMode()))
    }
    const onStorage = () => {
      setMode(normalizeBrainMode(getActiveBrainMode()))
      setClaudeActive(hasAnthropicApiKey())
    }

    window.addEventListener(BRAIN_MODE_EVENT, onBrainMode)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(BRAIN_MODE_EVENT, onBrainMode)
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

        if (customGemini.trim()) {
          window.localStorage.setItem(AI_KEY_STORAGE_KEYS.gemini, customGemini.trim())
        } else {
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
    void refreshHealth()
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
    void refreshHealth()
  }

  const hasWarning = Boolean(
    (mode === 'claude' && !claudeActive) ||
      (health?.grokQuotaNoteAr && mode === 'grok'),
  )

  const statusText = (() => {
    if (!health) return isAr ? 'متصل وجاهز' : 'Live & Ready'
    if (mode === 'claude') {
      if (!health.claudeReady) {
        return isAr
          ? 'اضغط 🔑 للصق مفتاح كلاود (يعمل جميني Pro احتياطياً)'
          : 'Click 🔑 to paste Anthropic key (Gemini Pro active as backup)'
      }
      return isAr ? `نشط: ${health.claudeModel}` : `Active: ${health.claudeModel}`
    }
    if (mode === 'gemini') {
      return isAr ? `نشط: ${health.geminiModel}` : `Active: ${health.geminiModel}`
    }
    if (mode === 'grok') {
      if (health.grokQuotaNoteAr) {
        return isAr ? health.grokQuotaNoteAr : (health.grokQuotaNoteEn ?? 'Fallback ready')
      }
      return isAr ? `نشط: ${health.grokModel}` : `Active: ${health.grokModel}`
    }
    const activeEngines = [
      health.claudeReady ? health.claudeModel : null,
      health.geminiModel,
      health.grokReady ? health.grokModel : null,
    ].filter(Boolean)
    return isAr
      ? `متصل: ${activeEngines.join(' + ')}`
      : `Live: ${activeEngines.join(' + ')}`
  })()

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Verdelo Sliding Pill 4-Option Brain Mode Switcher */}
      <div className="group relative inline-flex items-center">
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
        <span
          role="tooltip"
          dir="ltr"
          className="pointer-events-none invisible absolute top-full start-1/2 z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-white px-3 py-1.5 text-[11.5px] font-bold text-slate-900 shadow-md ring-1 ring-slate-900/10 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 dark:bg-[#111A22] dark:text-slate-100"
        >
          <span
            className={`me-1.5 inline-block h-2 w-2 rounded-full ${
              hasWarning ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
          {statusText}
        </span>
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

      {/* Top `🔑` API Key Vault Modal */}
      <div ref={gearWrapRef} className="relative">
        <button
          type="button"
          onClick={() => setGearOpen((v) => !v)}
          aria-label={isAr ? 'مفاتيح الذكاء الاصطناعي 🔑' : 'AI Key Vault 🔑'}
          title={statusText}
          aria-expanded={gearOpen}
          className={`relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white text-[14px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 focus:outline-none dark:bg-[#111A22] ${
            gearOpen
              ? 'ring-1 ring-slate-900/80 dark:ring-emerald-400/70'
              : 'ring-1 ring-slate-900/[0.05] hover:ring-slate-900/20 dark:ring-white/[0.08]'
          }`}
        >
          <span aria-hidden>🔑</span>
          <span
            aria-hidden
            className={`absolute top-1 end-1 h-1.5 w-1.5 rounded-full ${
              hasWarning ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
        </button>

        {gearOpen ? (
          <div className="ae-bento-card absolute end-0 z-50 mt-2 w-[330px] p-4 sm:w-[380px]">
            <div className="flex items-center justify-between gap-2 pb-2">
              <h3 className="text-[13.5px] font-extrabold text-slate-950 dark:text-white">
                {isAr ? 'خزنة مفاتيح العقل الثلاثي 🔑' : 'Triple-Brain Key Vault 🔑'}
              </h3>
              <button
                type="button"
                onClick={() => setGearOpen(false)}
                aria-label={isAr ? 'إغلاق' : 'Close'}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
              {isAr
                ? 'تُحفظ المفاتيح محلياً في متصفحك فقط بدون رفعها لأي خادم. الصق مفتاح كلاود لتشغيل التفكير العميق (Extended Thinking).'
                : 'Keys stay strictly in your browser localStorage. Add your Anthropic key to activate Claude Opus Extended Thinking.'}
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#F4F6F9] px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  hasWarning ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              <span dir="ltr" className="truncate">
                {statusText}
              </span>
            </div>

            <div className="mt-3 space-y-2.5">
              <label className="block space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200">
                    Anthropic Claude Opus / Sonnet 🔬
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      claudeActive || customAnthropic.trim().length > 14
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                    }`}
                  >
                    {claudeActive || customAnthropic.trim().length > 14
                      ? isAr
                        ? 'مفعّل ✅'
                        : 'Active ✅'
                      : isAr
                        ? 'اختياري — الصق للتفعيل'
                        : 'Paste to enable'}
                  </span>
                </div>
                <input
                  type="password"
                  dir="ltr"
                  value={customAnthropic}
                  onChange={(e) => setCustomAnthropic(e.target.value)}
                  placeholder={
                    claudeActive
                      ? isAr
                        ? 'مفتاح كلاود مفعّل وجاهز'
                        : 'Anthropic key active'
                      : isAr
                        ? 'الصق مفتاح Anthropic هنا (aether_anthropic_key)'
                        : 'Paste Anthropic API key (aether_anthropic_key)'
                  }
                  className="h-9 w-full rounded-xl bg-[#F4F6F9] px-3 font-mono text-[12px] text-slate-900 ring-1 ring-slate-950/[0.05] focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900/80 dark:bg-white/[0.06] dark:text-white"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300">
                  Google Gemini Carbon Pro ⚡
                </span>
                <input
                  type="password"
                  dir="ltr"
                  value={customGemini}
                  onChange={(e) => setCustomGemini(e.target.value)}
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
                  xAI Grok Heavy 🧠
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
  if (!pathname || !BRAIN_BAR_ROUTES.has(pathname)) return null

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
