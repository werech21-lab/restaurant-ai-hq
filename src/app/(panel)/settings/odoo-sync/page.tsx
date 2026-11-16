import { Suspense } from 'react'
import { connection } from 'next/server'
import Link from 'next/link'
import { OdooSyncPanel } from '@/app/(panel)/settings/odoo-sync/odoo-sync-panel'
import { Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { requireUser } from '@/lib/erp-auth'
import { getLocale, tx } from '@/lib/i18n/server'
import { can, firstAllowedHref } from '@/lib/permissions'
import { listLocalOdooDumpSummary } from '@/services/odoo-live-extractor.service'

export const metadata = { title: 'سحب ومزامنة Odoo المباشر | فنتشر فودز' }
export const dynamic = 'force-dynamic'

async function Content() {
  await connection()
  const [user, locale] = await Promise.all([requireUser(), getLocale()])
  if (!can(user, 'saas', 'view') && !can(user, 'saas', 'edit')) {
    return <Forbidden href={firstAllowedHref(user)} />
  }
  const dump = listLocalOdooDumpSummary()
  return (
    <div dir={locale === 'en' ? 'ltr' : 'rtl'}>
      <PageHeader
        title={tx(locale, 'مركز السحب والمزامنة المباشر من أودو', 'Odoo Direct Sync & Extraction Center')}
        description={tx(
          locale,
          'الاتصال بـ Odoo 17 أو استيراد ملفات JSON/CSV/Excel — حفظ نسخة احتياطية آمنة ثم ترحيل للـ ERP.',
          'Connect to Odoo 17 or import JSON/CSV/Excel files with secure snapshot persistence and ERP staging.',
        )}
        actions={
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link className="ds-focus-ring text-emerald-700 dark:text-[#8cc63f]" href="/settings/odoo-data-center">
              {tx(locale, 'مركز البيانات', 'Data Center')}
            </Link>
            <Link className="ds-focus-ring text-emerald-700 dark:text-[#8cc63f]" href="/erp/odoo-sync">
              {tx(locale, 'لوحة ERP المتقدمة', 'Advanced ERP Sync')}
            </Link>
            <Link className="ds-focus-ring text-emerald-700 dark:text-[#8cc63f]" href="/pos">
              {tx(locale, 'الكاشير', 'POS')}
            </Link>
          </div>
        }
      />
      <OdooSyncPanel initialDump={dump} />
    </div>
  )
}

export default function OdooSyncSettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Odoo Sync" />}>
      <Content />
    </Suspense>
  )
}
