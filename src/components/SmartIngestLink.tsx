'use client'

import { SMART_INGEST_META, type SmartIngestModule } from '@/lib/smart-ingest-modules'
import { useI18n } from '@/lib/i18n'

/** Client-safe emerald CTA for ERP suite hubs. */
export function SmartIngestLink({ module }: { module: SmartIngestModule }) {
  const { locale } = useI18n()
  const meta = SMART_INGEST_META[module]
  return (
    <a
      href={meta.pagePath}
      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-500"
    >
      {locale === 'en' ? meta.buttonEn : meta.buttonAr}
    </a>
  )
}
