'use client'

import { Printer } from 'lucide-react'
import { cx } from '@/components/ui/primitives'

export function PrintButton({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => window.print()}
      className={cx(
        'no-print print:hidden ds-motion ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98] dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400',
        className,
      )}
    >
      <Printer className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}
