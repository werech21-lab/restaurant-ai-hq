'use client'

import { useEffect, useState } from 'react'
import { SectionCard, StateBlock } from '@/components/ui'
import {
  UNAVAILABLE_DASH,
  formatDate,
  formatInt,
  getUnavailableTooltip,
} from '@/lib/format'

type Doc = {
  id: string
  fileName: string
  category: string
  categoryLabelAr: string
  categoryLabelEn: string
  civilId: string | null
  expiryDate: string | null
  daysLeft: number | null
  expiryStatus: 'none' | 'expired' | 'soon' | 'ok'
  hasContent: boolean
  createdAt: string
}

export function HrDigitalDossier({
  employeeId,
  locale,
}: {
  employeeId: string
  locale: 'ar' | 'en'
}) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reloadNonce, setReloadNonce] = useState(0)
  const isAr = locale !== 'en'
  const unavailableTooltip = getUnavailableTooltip(locale)

  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    fetch(`/api/hr/ingest-folder?employeeId=${encodeURIComponent(employeeId)}`, {
      signal: controller.signal,
      credentials: 'same-origin',
    })
      .then(async (res) => {
        const json = (await res.json()) as { data?: { dossier?: Doc[] } }
        if (!res.ok) throw new Error('load_failed')
        setDocs(json.data?.dossier || [])
        setPhase('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) setPhase('error')
      })
    return () => controller.abort()
  }, [employeeId, reloadNonce])

  const title = isAr ? 'الخزانة الرقمية ومستندات الموظف' : 'Digital HR Dossier'

  const cardState = phase === 'loading' ? 'loading' : phase === 'error' ? 'error' : docs.length === 0 ? 'empty' : 'ready'

  return (
    <SectionCard
      title={title}
      locale={locale}
      state={cardState}
      stateTitle={
        phase === 'ready' && docs.length === 0
          ? isAr
            ? 'لا توجد مستندات موزّعة بعد'
            : 'No distributed documents yet'
          : undefined
      }
      stateDescription={
        phase === 'ready' && docs.length === 0
          ? isAr
            ? 'ارفع ملفات الموظفين من صفحة رفع المجلد الذكي لربطها هنا تلقائياً.'
            : 'Upload employee files from Smart Folder Upload to attach them automatically.'
          : undefined
      }
      onRetry={() => setReloadNonce((n) => n + 1)}
      className="mt-4"
    >
      <ul className="divide-y divide-[var(--ds-border-hairline)]">
        {docs.map((doc) => {
          const formattedExpiry = doc.expiryDate ? formatDate(doc.expiryDate, locale) : UNAVAILABLE_DASH
          const formattedCreated = formatDate(doc.createdAt, locale)
          const formattedDaysLeft =
            doc.daysLeft !== null && Number.isFinite(doc.daysLeft)
              ? formatInt(doc.daysLeft, locale)
              : UNAVAILABLE_DASH

          return (
            <li key={doc.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
              <div className="min-w-0">
                <p className="break-words font-semibold text-[var(--ds-text-primary)]">{doc.fileName}</p>
                <p className="mt-0.5 text-xs text-[var(--ds-text-muted)]">
                  {isAr ? doc.categoryLabelAr : doc.categoryLabelEn}
                  {doc.civilId ? (
                    <>
                      {' · '}
                      <span dir="ltr" className="ds-num tabular-nums">
                        CID {doc.civilId}
                      </span>
                    </>
                  ) : null}
                  {formattedCreated !== UNAVAILABLE_DASH ? (
                    <>
                      {' · '}
                      <span dir="ltr" className="ds-num tabular-nums">
                        {formattedCreated}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="shrink-0 text-xs">
                {doc.expiryStatus === 'expired' ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-semibold"
                    style={{
                      backgroundColor: 'var(--ds-negative-bg)',
                      borderColor: 'var(--ds-negative-border)',
                      color: 'var(--ds-negative)',
                    }}
                  >
                    <span>{isAr ? 'منتهية' : 'Expired'}</span>
                    <span dir="ltr" className="ds-num tabular-nums">
                      {formattedExpiry}
                    </span>
                  </span>
                ) : doc.expiryStatus === 'soon' ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-semibold"
                    style={{
                      backgroundColor: 'var(--ds-warning-bg)',
                      borderColor: 'var(--ds-warning-border)',
                      color: 'var(--ds-warning)',
                    }}
                  >
                    <span>{isAr ? 'تنتهي خلال' : 'Expires in'}</span>
                    <span dir="ltr" className="ds-num tabular-nums">
                      {formattedDaysLeft}
                      {isAr ? ' يوم' : 'd'}
                    </span>
                  </span>
                ) : formattedExpiry !== UNAVAILABLE_DASH ? (
                  <span
                    dir="ltr"
                    className="ds-num inline-flex rounded-full border px-2.5 py-0.5 font-semibold tabular-nums"
                    style={{
                      backgroundColor: 'var(--ds-positive-bg)',
                      borderColor: 'var(--ds-positive-border)',
                      color: 'var(--ds-positive)',
                    }}
                  >
                    {formattedExpiry}
                  </span>
                ) : (
                  <span
                    dir="ltr"
                    title={unavailableTooltip}
                    aria-label={unavailableTooltip}
                    data-unavailable="true"
                    className="ds-num tabular-nums"
                    style={{ color: 'var(--ds-unavailable)' }}
                  >
                    {UNAVAILABLE_DASH}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}
