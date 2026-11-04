'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from '@/lib/theme'
import { useI18n } from '@/lib/i18n'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const { locale } = useI18n()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isAr = locale === 'ar'
  const isDark = theme === 'dark'

  // Label text strictly adheres to language selection (zero English in Arabic mode)
  // When currently Dark: displays button to switch to Light mode (☀️ وضع نهاري / ☀️ Light)
  // When currently Light: displays button to switch to Dark mode (🌙 وضع ليلي / 🌙 Dark)
  const label = isDark
    ? (isAr ? '☀️ وضع نهاري' : '☀️ Light')
    : (isAr ? '🌙 وضع ليلي' : '🌙 Dark')

  const ariaLabel = isDark
    ? (isAr ? 'التبديل إلى الوضع النهاري' : 'Switch to Light Mode')
    : (isAr ? 'التبديل إلى الوضع الليلي' : 'Switch to Dark Mode')

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-no-translate=""
      className={`group relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 shadow-sm ${
        isDark
          ? 'border-amber-400/30 bg-ink-900/80 text-amber-300 hover:border-amber-400 hover:bg-amber-400/15 hover:text-amber-200 shadow-amber-950/20'
          : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400 hover:bg-slate-50 hover:text-indigo-900 shadow-slate-200/50'
      } ${className}`}
    >
      <span className="text-sm leading-none transition-transform duration-200 group-hover:scale-110" aria-hidden>
        {isDark ? '☀️' : '🌙'}
      </span>
      <span className="tracking-tight whitespace-nowrap">
        {mounted ? (isDark ? (isAr ? 'وضع نهاري' : 'Light') : (isAr ? 'وضع ليلي' : 'Dark')) : (isDark ? (isAr ? 'وضع نهاري' : 'Light') : (isAr ? 'وضع ليلي' : 'Dark'))}
      </span>
    </button>
  )
}

export default ThemeToggle
