'use client'

import React, { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { useI18n } from '@/lib/i18n'

/**
 * Tactile Executive Theme Switcher:
 * - Light Studio ("Alabaster" #F6F7F8 / #FFFFFF)
 * - Dark Obsidian-Emerald ("Verdelo" #09110E / #101C17 / #10B981)
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const { locale } = useI18n()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isAr = locale === 'ar'
  const isDark = mounted ? theme === 'dark' : false

  const ariaLabel = isDark
    ? isAr
      ? 'التبديل إلى الوضع النهاري'
      : 'Switch to Light Mode'
    : isAr
      ? 'التبديل إلى الوضع الزمردي الداكن'
      : 'Switch to Emerald Dark Mode'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-no-translate=""
      className={`group relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-[12px] font-semibold transition-all duration-[160ms] active:scale-95 ${
        isDark
          ? 'bg-[#101C17] text-emerald-300 ring-1 ring-emerald-500/25 hover:ring-emerald-400/50'
          : 'bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.06] hover:bg-slate-50 hover:ring-slate-900/15'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="h-3.5 w-3.5 shrink-0 text-amber-400 transition-transform duration-200 group-hover:rotate-12" />
      ) : (
        <Moon className="h-3.5 w-3.5 shrink-0 text-emerald-600 transition-transform duration-200 group-hover:-rotate-12" />
      )}
      <span className="whitespace-nowrap tracking-tight">
        {isDark ? (isAr ? 'نهاري' : 'Light') : isAr ? 'زمردي' : 'Emerald'}
      </span>
    </button>
  )
}

export default ThemeToggle
