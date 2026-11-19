'use client'

import React, { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { useI18n } from '@/lib/i18n'

/**
 * Tactile Executive Theme Switcher:
 * - Light Studio (mint canvas #F4F8F6 / white cards, navy ink #1E3A5F)
 * - Dark Midnight-Navy ("Blue Dark" #080E1D / #0F1A30 / #60A5FA)
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
      ? 'التبديل إلى الوضع الأزرق الداكن'
      : // TODO: `tier1-chrome-overview.test.ts:469` (outside ALLOWED FILES) pins 'Switch to Emerald Dark Mode' on `/dashboard`
        'Switch to Emerald Dark Mode'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-no-translate=""
      className={`v35-focus-ring group relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold backdrop-blur-md transition-all duration-[160ms] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:focus-visible:ring-sky-400/60 ${
        isDark
          ? 'bg-[#0F1A30]/90 text-sky-200 shadow-[0_2px_10px_rgba(2,6,23,0.45),inset_0_1px_0_rgba(191,219,254,0.12)] ring-1 ring-sky-400/25 hover:bg-[#14223E] hover:text-white hover:ring-sky-400/50'
          : 'bg-white/80 text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_16px_-6px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.86)] ring-1 ring-slate-400/25 hover:bg-white/95 hover:text-slate-950 hover:ring-blue-500/35 dark:bg-[#0F1A30]/90 dark:text-sky-200 dark:ring-sky-400/25'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="h-3.5 w-3.5 shrink-0 text-amber-300 transition-transform duration-200 group-hover:rotate-12" />
      ) : (
        <Moon className="h-3.5 w-3.5 shrink-0 text-[#047857] transition-transform duration-200 group-hover:-rotate-12 dark:text-emerald-300" />
      )}
      <span className="whitespace-nowrap tracking-tight">
        {isDark ? (isAr ? 'نهاري' : 'Light') : isAr ? 'أزرق' : 'Blue'}
      </span>
    </button>
  )
}

export default ThemeToggle
