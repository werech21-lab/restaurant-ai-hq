'use client'

import { useState } from 'react'
import type { FormatLocale } from '@/lib/format'

export function CopyIssueDraft({
  draft,
  locale = 'ar',
}: {
  draft: string
  locale?: FormatLocale
}) {
  const [copied, setCopied] = useState(false)
  const isAr = locale !== 'en'

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-2 min-w-0">
      <button
        type="button"
        onClick={copy}
        className="cursor-pointer rounded-lg bg-white px-3 py-1 text-xs font-bold text-slate-900 ring-1 ring-slate-300 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:bg-[#141F1B] dark:text-slate-100 dark:ring-white/15 dark:hover:bg-white/10"
      >
        {isAr ? 'نسخ مسودة GitHub' : 'Copy GitHub Draft'}
      </button>
      {copied ? (
        <p role="status" aria-live="polite" className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
          {isAr
            ? 'نُسخت المسودة. لم يُنشأ شيء ولم يُكتب كود.'
            : 'Draft copied. Nothing was created and no code was written.'}
        </p>
      ) : null}
      <pre
        dir="ltr"
        className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 dark:bg-[#090E0C] dark:text-slate-300"
      >
        {draft}
      </pre>
    </div>
  )
}
