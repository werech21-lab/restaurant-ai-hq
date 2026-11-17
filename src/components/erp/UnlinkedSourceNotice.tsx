'use client'

import React from 'react'
import { Link2Off } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

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

const ARABIC_UNLINKED_PREFIX_RE = /^غير مربوط بمصدر\s*[—–-]\s*/

function normalizeEnglishTitle(rawTitleEn?: string): string {
  if (!rawTitleEn) return 'Not Linked to a Data Source'
  if (ARABIC_UNLINKED_PREFIX_RE.test(rawTitleEn)) {
    return rawTitleEn.replace(ARABIC_UNLINKED_PREFIX_RE, 'Unlinked from Source — ')
  }
  return rawTitleEn
}

function UnlinkedSourceNoticeBody({
  titleAr,
  titleEn,
  reasonAr,
  reasonEn,
  requiredSourceAr,
  requiredSourceEn,
  isAr,
  compact = false,
  className = '',
}: Omit<UnlinkedSourceNoticeProps, 'isAr'> & { isAr: boolean }) {
  const pillLabel = isAr ? 'غير مربوط بمصدر' : 'Unlinked from Source'

  const heading = isAr
    ? (titleAr ?? 'غير مربوط بمصدر')
    : normalizeEnglishTitle(titleEn)

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
        className={`flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/75 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-100 ${className}`.trim()}
      >
        <Link2Off className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
        <div className="min-w-0 flex-1 break-words">
          <span className="font-bold">{pillLabel}</span>
          {reasonAr || reasonEn ? (
            <span className="ms-2 text-xs text-amber-900/90 dark:text-amber-200/90">
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
      className={`ds-surface mx-auto my-4 w-full max-w-3xl rounded-3xl p-5 text-center sm:my-6 sm:p-8 ${className}`.trim()}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100/90 text-amber-800 ring-1 ring-amber-500/25 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-400/25">
        <Link2Off className="h-7 w-7" aria-hidden />
      </div>

      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-extrabold text-amber-950 ring-1 ring-amber-500/30 dark:bg-amber-950/75 dark:text-amber-200">
        <span>{pillLabel}</span>
      </div>

      <h2 className="mt-2 break-words text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl dark:text-slate-50">
        {heading}
      </h2>

      <p className="mx-auto mt-2.5 max-w-xl break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {detail}
      </p>

      {sourceHint ? (
        <div className="mx-auto mt-4 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-slate-100 px-3.5 py-2 text-xs font-medium text-slate-800 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
          <span className="font-bold">
            {isAr ? 'المصدر المطلوب للربط المستقبلي:' : 'Required Source for Future Integration:'}
          </span>
          <span dir="ltr" className="break-all font-mono">
            {sourceHint}
          </span>
        </div>
      ) : null}
    </section>
  )
}

function UnlinkedSourceNoticeI18n(props: Omit<UnlinkedSourceNoticeProps, 'isAr'>) {
  const { locale } = useI18n()
  return <UnlinkedSourceNoticeBody {...props} isAr={locale !== 'en'} />
}

/**
 * Clean honest notice rendered whenever an ERP module, tab, or widget has no
 * connected external telemetry or Odoo source. Strictly zero invented numbers.
 */
export function UnlinkedSourceNotice({
  isAr: explicitIsAr,
  ...rest
}: UnlinkedSourceNoticeProps) {
  if (explicitIsAr !== undefined) {
    return <UnlinkedSourceNoticeBody {...rest} isAr={explicitIsAr} />
  }
  return <UnlinkedSourceNoticeI18n {...rest} />
}

export default UnlinkedSourceNotice
