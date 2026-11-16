import { Suspense } from 'react'
import { connection } from 'next/server'
import Link from 'next/link'
import { OdooDataCenterClient } from '@/app/(panel)/settings/odoo-data-center/odoo-data-center-client'
import { Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { requireUser } from '@/lib/erp-auth'
import { getLocale, tx } from '@/lib/i18n/server'
import { can, firstAllowedHref } from '@/lib/permissions'

export const metadata = { title: 'مركز بيانات Odoo والأرشفة الذكية | AetherBI' }
export const dynamic = 'force-dynamic'

async function Content() {
  await connection()
  const [user, locale] = await Promise.all([requireUser(), getLocale()])
  if (!can(user, 'saas', 'view')) {
    return <Forbidden href={firstAllowedHref(user)} />
  }
  return (
    <div dir={locale === 'en' ? 'ltr' : 'rtl'}>
      <PageHeader
        title={tx(locale, 'مركز إدارة بيانات Odoo والأرشفة الذكية', 'Odoo Data Center & Smart Archival')}
        description={tx(
          locale,
          'إحصاءات السجلات المسحوبة، حالة فهارس التسريع، وزمن الاستجابة — بدون المساس بأي صف تاريخي.',
          'Extracted record counts, acceleration index coverage, and query latency with zero alteration to historical rows.',
        )}
        actions={
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link className="ds-focus-ring text-blue-700 dark:text-blue-400" href="/settings">
              {tx(locale, 'الإعدادات', 'Settings')}
            </Link>
            <Link className="ds-focus-ring text-emerald-700 dark:text-[#8cc63f]" href="/settings/odoo-sync">
              {tx(locale, 'سحب مباشر من Odoo', 'Direct Odoo Pull')}
            </Link>
            <Link className="ds-focus-ring text-emerald-700 dark:text-[#8cc63f]" href="/erp/odoo-sync">
              {tx(locale, 'مزامنة ERP', 'ERP Sync')}
            </Link>
          </div>
        }
      />
      <OdooDataCenterClient />
    </div>
  )
}

export default function OdooDataCenterPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Odoo Data Center" />}>
      <Content />
    </Suspense>
  )
}
