'use client'

import React, { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { useI18n } from '@/lib/i18n'

/**
 * Tactile Executive Theme Switcher:
 * - Light Studio ("Finance V2" #F4F6F9 / #FFFFFF)
 * - Dark Obsidian-Emerald ("Verdelo" #090F15 / #111A22 / #10B981)
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
      ? 'التبديل إلى الوضع النهاري (Finance V2)'
      : 'Switch to Finance V2 Light Mode'
    : isAr
      ? 'التبديل إلى الوضع الليلي الزمردي (Verdelo)'
      : 'Switch to Verdelo Emerald Dark Mode'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-no-translate=""
      className={`group relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12px] font-bold transition-all duration-150 active:scale-95 ${
        isDark
          ? 'bg-[#111A22] text-emerald-300 ring-1 ring-emerald-500/30 hover:ring-emerald-400/60'
          : 'bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.05] hover:bg-slate-50 hover:ring-slate-900/15'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="h-3.5 w-3.5 text-amber-400 transition-transform duration-200 group-hover:rotate-12" />
      ) : (
        <Moon className="h-3.5 w-3.5 text-emerald-600 transition-transform duration-200 group-hover:-rotate-12" />
      )}
      <span className="whitespace-nowrap tracking-tight">
        {isDark ? (isAr ? 'نهاري ☀️' : 'Light ☀️') : isAr ? 'ليلي 🌙' : 'Emerald 🌙'}
      </span>
    </button>
  )
}

export default ThemeToggle
