'use client'

import { useEffect, useState } from 'react'

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
  }, [employeeId])

  const title =
    locale === 'en' ? 'Digital HR Dossier' : 'الخزانة الرقمية ومستندات الموظف'

  if (phase === 'loading') {
    return <p className="text-sm text-slate-500">{locale === 'en' ? 'Loading dossier…' : 'جارٍ تحميل الخزانة…'}</p>
  }
  if (phase === 'error') {
    return <p className="text-sm text-red-600">{locale === 'en' ? 'Could not load dossier' : 'تعذر تحميل الخزانة'}</p>
  }

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </header>
      {docs.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">
          {locale === 'en' ? 'No distributed documents yet.' : 'لا توجد مستندات موزّعة بعد.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {docs.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">{doc.fileName}</p>
                <p className="text-xs text-slate-500">
                  {locale === 'en' ? doc.categoryLabelEn : doc.categoryLabelAr}
                  {doc.civilId ? ` · CID ${doc.civilId}` : ''}
                </p>
              </div>
              <div className="text-xs">
                {doc.expiryStatus === 'expired' ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-800">
                    {locale === 'en' ? `Expired ${doc.expiryDate}` : `منتهية ${doc.expiryDate}`}
                  </span>
                ) : doc.expiryStatus === 'soon' ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                    {locale === 'en' ? `Expires in ${doc.daysLeft}d` : `تنتهي خلال ${doc.daysLeft} يوم`}
                  </span>
                ) : doc.expiryDate ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800" dir="ltr">
                    {doc.expiryDate}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
