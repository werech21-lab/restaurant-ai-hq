'use client'

import React from 'react'
import { Link2Off } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

function useSafeIsAr(explicitIsAr?: boolean): boolean {
  try {
    const i18n = useI18n()
    return explicitIsAr ?? i18n.locale === 'ar'
  } catch {
    return explicitIsAr ?? true
  }
}

export interface UnlinkedSourceNoticeProps {
  titleAr?: string
  titleEn?: string
  reasonAr?: string
  reasonEn?: string
  requiredSourceAr?: string
  requiredSourceEn?: string
  isAr?: boolean
  compact?: boolean
  className?: string
}

/**
 * Clean honest notice rendered whenever an ERP module, tab, or widget has no
 * connected live Odoo 17 / external telemetry source. Strictly zero invented numbers.
 */
export function UnlinkedSourceNotice({
  titleAr,
  titleEn,
  reasonAr,
  reasonEn,
  requiredSourceAr,
  requiredSourceEn,
  isAr: explicitIsAr,
  compact = false,
  className = '',
}: UnlinkedSourceNoticeProps) {
  const isAr = useSafeIsAr(explicitIsAr)

  const heading = isAr
    ? (titleAr ?? 'غير مربوط بمصدر')
    : (titleEn ?? 'غير مربوط بمصدر — Not Linked to a Data Source')

  const detail = isAr
    ? (reasonAr ??
      'هذه الوحدة غير مربوطة بمصدر بيانات فعلي حالياً، لذلك تم إخفاء جميع المؤشرات والجداول لمنع عرض أي أرقام غير موثقة.')
    : (reasonEn ??
      'This module is not currently linked to an active data source. All figures and tables are hidden to prevent displaying unverified numbers.')

  const sourceHint = isAr ? requiredSourceAr : (requiredSourceEn ?? requiredSourceAr)

  if (compact) {
    return (
      <div
        role="status"
        dir={isAr ? 'rtl' : 'ltr'}
        data-unlinked-source="true"
        className={`flex items-center gap-3 rounded-2xl border border-amber-300/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100 ${className}`}
      >
        <Link2Off className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <span className="font-bold">غير مربوط بمصدر</span>
          {reasonAr || reasonEn ? (
            <span className="ms-2 text-xs text-amber-900/85 dark:text-amber-200/85">
              — {detail}
            </span>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <section
      role="status"
      dir={isAr ? 'rtl' : 'ltr'}
      data-unlinked-source="true"
      className={`mx-auto my-6 max-w-3xl rounded-3xl border border-slate-200/90 bg-white p-8 text-center shadow-xs dark:border-white/10 dark:bg-[#101915] ${className}`}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100/90 text-amber-700 ring-1 ring-amber-500/25 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-400/25">
        <Link2Off className="h-7 w-7" aria-hidden />
      </div>

      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-extrabold text-amber-900 ring-1 ring-amber-500/30 dark:bg-amber-950/70 dark:text-amber-200">
        <span>غير مربوط بمصدر</span>
      </div>

      <h2 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {heading}
      </h2>

      <p className="mx-auto mt-2.5 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {detail}
      </p>

      {sourceHint ? (
        <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-medium text-slate-700 dark:bg-white/[0.05] dark:text-slate-300">
          <span className="font-bold">
            {isAr ? 'المصدر المطلوب للربط المستقبلي:' : 'Required Source for Future Integration:'}
          </span>
          <span className="font-mono">{sourceHint}</span>
        </div>
      ) : null}
    </section>
  )
}

export default UnlinkedSourceNotice
