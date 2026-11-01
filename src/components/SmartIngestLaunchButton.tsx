import { SMART_INGEST_META, type SmartIngestModule } from '@/lib/smart-ingest-modules'

type Props = {
  module: SmartIngestModule
  locale: 'ar' | 'en'
  className?: string
}

/** Emerald CTA linking to the department smart-folder upload screen. */
export function SmartIngestLaunchButton({ module, locale, className }: Props) {
  const meta = SMART_INGEST_META[module]
  return (
    <a
      href={meta.pagePath}
      className={
        className ||
        'inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700'
      }
    >
      {locale === 'en' ? meta.buttonEn : meta.buttonAr}
    </a>
  )
}
