'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, ClipboardCopy, RotateCcw, Settings, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { AI_KEY_STORAGE_KEYS } from '@/lib/ai-keys'
import {
  BRAIN_MODE_EVENT,
  buildGrokUltraClipboardBrief,
  getActiveBrainMode,
  probeDualBrainHealth,
  setActiveBrainMode,
  type BrainLiveHealth,
  type BrainMode,
} from '@/lib/dual-heavy-brain'
import { routeTitle } from '@/lib/aether/route-titles'

const BRAIN_BAR_ROUTES = new Set([
  '/erp',
  '/erp/cores',
  '/erp/before-after',
  '/erp/feryal-ai',
  '/erp/aggregator-radar',
  '/erp/events-intelligence',
])

const MODE_OPTIONS: readonly {
  id: BrainMode
  ar: string
  en: string
}[] = [
  { id: 'dual', ar: 'العقل المزدوج 🔥', en: 'Dual Brain 🔥' },
  { id: 'gemini', ar: 'جميني Carbon ⚡', en: 'Gemini Carbon ⚡' },
  { id: 'grok', ar: 'جروك Heavy 🧠', en: 'Grok Heavy 🧠' },
] as const

export function TopBrainSwitcher() {
  const pathname = usePathname()
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { filters, workspace } = useGlobalFilter()

  const [mode, setMode] = useState<BrainMode>('dual')
  const [health, setHealth] = useState<BrainLiveHealth | null>(null)
  const [copiedUltra, setCopiedUltra] = useState(false)
  const [gearOpen, setGearOpen] = useState(false)

  // Local key override inputs (never pre-filled with built-in obfuscated keys)
  const [customXai, setCustomXai] = useState('')
  const [customGemini, setCustomGemini] = useState('')
  const [customOpenAi, setCustomOpenAi] = useState('')
  const [savedNotice, setSavedNotice] = useState(false)

  const gearWrapRef = useRef<HTMLDivElement>(null)

  const refreshHealth = useCallback(async () => {
    try {
      const h = await probeDualBrainHealth()
      setHealth(h)
    } catch {
      // Keep UI crisp even if offline
    }
  }, [])

  useEffect(() => {
    setMode(getActiveBrainMode())
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        setCustomXai(window.localStorage.getItem(AI_KEY_STORAGE_KEYS.xai) ?? '')
        setCustomGemini(window.localStorage.getItem(AI_KEY_STORAGE_KEYS.gemini) ?? '')
        setCustomOpenAi(window.localStorage.getItem(AI_KEY_STORAGE_KEYS.openai) ?? '')
      }
    } catch {}
    void refreshHealth()

    const onBrainMode = (e: Event) => {
      const detail = (e as CustomEvent<BrainMode>).detail
      if (detail === 'dual' || detail === 'gemini' || detail === 'grok') {
        setMode(detail)
      } else {
        setMode(getActiveBrainMode())
      }
    }
    const onStorage = () => setMode(getActiveBrainMode())

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

  if (!pathname || !BRAIN_BAR_ROUTES.has(pathname)) return null

  const handleSelectMode = (next: BrainMode) => {
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
        if (customXai.trim()) window.localStorage.setItem(AI_KEY_STORAGE_KEYS.xai, customXai.trim())
        else window.localStorage.removeItem(AI_KEY_STORAGE_KEYS.xai)

        if (customGemini.trim()) window.localStorage.setItem(AI_KEY_STORAGE_KEYS.gemini, customGemini.trim())
        else window.localStorage.removeItem(AI_KEY_STORAGE_KEYS.gemini)

        if (customOpenAi.trim()) window.localStorage.setItem(AI_KEY_STORAGE_KEYS.openai, customOpenAi.trim())
        else window.localStorage.removeItem(AI_KEY_STORAGE_KEYS.openai)
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
    setCustomXai('')
    setCustomGemini('')
    setCustomOpenAi('')
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(AI_KEY_STORAGE_KEYS.xai)
        window.localStorage.removeItem(AI_KEY_STORAGE_KEYS.gemini)
        window.localStorage.removeItem(AI_KEY_STORAGE_KEYS.openai)
      }
    } catch {}
    void refreshHealth()
  }

  const hasWarning = Boolean(health?.grokQuotaNoteAr && mode !== 'gemini')
  const statusText = (() => {
    if (!health) return isAr ? 'متصل وجاهز' : 'Live & Ready'
    if (mode === 'gemini') {
      return isAr ? `نشط: ${health.geminiModel}` : `Active: ${health.geminiModel}`
    }
    if (mode === 'grok') {
      if (health.grokQuotaNoteAr) {
        return isAr ? health.grokQuotaNoteAr : (health.grokQuotaNoteEn ?? 'Fallback ready')
      }
      return isAr ? `نشط: ${health.grokModel}` : `Active: ${health.grokModel}`
    }
    if (health.grokQuotaNoteAr) {
      return isAr ? health.grokQuotaNoteAr : (health.grokQuotaNoteEn ?? 'Gemini Carbon active')
    }
    return isAr
      ? `متصل: ${health.geminiModel} + ${health.grokModel}`
      : `Live: ${health.geminiModel} + ${health.grokModel}`
  })()

  return (
    <section
      aria-label={isAr ? 'مبدل العقل الذكي' : 'AI Brain Switcher'}
      dir={isAr ? 'rtl' : 'ltr'}
      className="no-print relative z-30 flex flex-wrap items-center justify-between gap-2.5"
    >
      {/* Left / Start: 3 Clean 2-Word Brain Mode Pills + Live Status Pill */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label={isAr ? 'اختيار محرك التحليل' : 'Select AI Brain'}
          className="inline-flex h-10 items-center gap-1 rounded-full bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.08]"
        >
          {MODE_OPTIONS.map((opt) => {
            const active = mode === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleSelectMode(opt.id)}
                className={`h-8 rounded-full px-3.5 text-[12.5px] font-bold whitespace-nowrap transition-all duration-150 focus:outline-none ${
                  active
                    ? 'bg-neutral-950 text-white ring-1 ring-neutral-900/80 shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-white dark:text-neutral-950'
                    : 'text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-950 dark:text-slate-300 dark:hover:bg-white/[0.06]'
                }`}
              >
                {isAr ? opt.ar : opt.en}
              </button>
            )
          })}
        </div>

        {/* Live Status Dot + Active Models Readout */}
        <div className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3.5 text-[12px] font-semibold text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:text-slate-300 dark:ring-white/[0.08]">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              hasWarning ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
          <span dir="ltr" className="truncate max-w-[260px] sm:max-w-[340px]">
            {statusText}
          </span>
        </div>
      </div>

      {/* Right / End: 1-Click Copy for Grok Ultra + Optional API Keys Gear */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleCopyForGrokUltra()}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[12.5px] font-bold text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.05] transition-all duration-150 hover:bg-neutral-50 hover:ring-neutral-900/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900/80 dark:bg-[#0F1626] dark:text-white dark:ring-white/[0.08]"
          title={
            isAr
              ? 'نسخ أرقام الفلتر الحالي مع أمر جاهز لتطبيق Grok Ultra'
              : 'Copy filtered Odoo figures + executive prompt for Grok Ultra'
          }
        >
          {copiedUltra ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-emerald-700 dark:text-emerald-400">
                {isAr ? 'تم النسخ ✓' : 'Copied ✓'}
              </span>
            </>
          ) : (
            <>
              <ClipboardCopy className="h-3.5 w-3.5 text-neutral-500" />
              <span>{isAr ? 'نسخ لجروك الترا 📋' : 'Copy for Grok Ultra 📋'}</span>
            </>
          )}
        </button>

        {/* Optional Local API Key Override Gear */}
        <div ref={gearWrapRef} className="relative">
          <button
            type="button"
            onClick={() => setGearOpen((v) => !v)}
            aria-label={isAr ? 'إعدادات مفاتيح الذكاء' : 'AI Key Settings'}
            aria-expanded={gearOpen}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 focus:outline-none dark:bg-[#0F1626] dark:text-slate-200 ${
              gearOpen
                ? 'ring-1 ring-neutral-900/80 dark:ring-white/70'
                : 'ring-1 ring-neutral-950/[0.05] hover:text-neutral-950 hover:ring-neutral-900/20 dark:ring-white/[0.08]'
            }`}
          >
            <Settings className="h-4 w-4" />
          </button>

          {gearOpen ? (
            <div className="absolute end-0 z-50 mt-2 w-[320px] sm:w-[360px] rounded-2xl bg-white p-4 shadow-[0_16px_40px_-8px_rgba(15,23,42,0.16),0_2px_6px_rgba(15,23,42,0.04)] ring-1 ring-neutral-950/[0.06] dark:bg-[#0F1626] dark:ring-white/[0.1]">
              <div className="flex items-center justify-between gap-2 pb-2">
                <h3 className="text-[13.5px] font-extrabold text-neutral-950 dark:text-white">
                  {isAr ? 'مفاتيح مخصصة (اختياري)' : 'Custom API Keys (Optional)'}
                </h3>
                <button
                  type="button"
                  onClick={() => setGearOpen(false)}
                  aria-label={isAr ? 'إغلاق' : 'Close'}
                  className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[11.5px] leading-relaxed text-neutral-500 dark:text-slate-400">
                {isAr
                  ? 'المفاتيح الأساسية مدمجة ومؤمنة تلقائياً. يمكنك إضافة مفتاح بديل في متصفحك فقط عند الحاجة.'
                  : 'Built-in keys are active by default. Add optional browser-only overrides if needed.'}
              </p>

              <div className="mt-3 space-y-2.5">
                <label className="block space-y-1">
                  <span className="text-[11.5px] font-bold text-neutral-700 dark:text-slate-300">
                    xAI Grok Heavy Key
                  </span>
                  <input
                    type="password"
                    dir="ltr"
                    value={customXai}
                    onChange={(e) => setCustomXai(e.target.value)}
                    placeholder={isAr ? 'مفعّل تلقائياً (اتركه فارغاً للافتراضي)' : 'Built-in active (leave blank for default)'}
                    className="h-9 w-full rounded-xl bg-[#F7F7F8] px-3 text-[12px] font-mono text-neutral-900 ring-1 ring-neutral-950/[0.05] focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900/80 dark:bg-white/[0.06] dark:text-white"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11.5px] font-bold text-neutral-700 dark:text-slate-300">
                    Google Gemini Carbon Key
                  </span>
                  <input
                    type="password"
                    dir="ltr"
                    value={customGemini}
                    onChange={(e) => setCustomGemini(e.target.value)}
                    placeholder={isAr ? 'مفعّل تلقائياً (اتركه فارغاً للافتراضي)' : 'Built-in active (leave blank for default)'}
                    className="h-9 w-full rounded-xl bg-[#F7F7F8] px-3 text-[12px] font-mono text-neutral-900 ring-1 ring-neutral-950/[0.05] focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900/80 dark:bg-white/[0.06] dark:text-white"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11.5px] font-bold text-neutral-700 dark:text-slate-300">
                    OpenAI Nova Voice Key
                  </span>
                  <input
                    type="password"
                    dir="ltr"
                    value={customOpenAi}
                    onChange={(e) => setCustomOpenAi(e.target.value)}
                    placeholder={isAr ? 'مفعّل تلقائياً (اتركه فارغاً للافتراضي)' : 'Built-in active (leave blank for default)'}
                    className="h-9 w-full rounded-xl bg-[#F7F7F8] px-3 text-[12px] font-mono text-neutral-900 ring-1 ring-neutral-950/[0.05] focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900/80 dark:bg-white/[0.06] dark:text-white"
                  />
                </label>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleClearOverrides}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#F7F7F8] px-3 text-[12px] font-bold text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-950 dark:bg-white/[0.06] dark:text-slate-300"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{isAr ? 'استعادة الافتراضي' : 'Use Defaults'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomKeys}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-neutral-950 px-4 text-[12px] font-bold text-white transition-all duration-150 hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
                >
                  {savedNotice ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : null}
                  <span>{savedNotice ? (isAr ? 'تم الحفظ ✓' : 'Saved ✓') : isAr ? 'حفظ' : 'Save'}</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
