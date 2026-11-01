import { Suspense } from 'react'
import { connection } from 'next/server'
import Link from 'next/link'
import { OdooSyncPanel } from '@/app/(panel)/settings/odoo-sync/odoo-sync-panel'
import { Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { requireUser } from '@/lib/erp-auth'
import { can, firstAllowedHref } from '@/lib/permissions'
import { listLocalOdooDumpSummary } from '@/services/odoo-live-extractor.service'

export const metadata = { title: 'سحب ومزامنة Odoo المباشر | فنتشر فودز' }
export const dynamic = 'force-dynamic'

async function Content() {
  await connection()
  const user = await requireUser()
  if (!can(user, 'saas', 'view') && !can(user, 'saas', 'edit')) {
    return <Forbidden href={firstAllowedHref(user)} />
  }
  const dump = listLocalOdooDumpSummary()
  return (
    <div>
      <PageHeader
        title="مركز السحب والمزامنة المباشر من أودو"
        description="الاتصال بـ venturefoods.walnutss.com أو رفع dump/CSV/Excel — حفظ أبدي في backups/odoo-full-dump ثم ترحيل للـ ERP."
        actions={
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link className="text-[#8cc63f]" href="/settings/odoo-data-center">
              مركز البيانات
            </Link>
            <Link className="text-[#8cc63f]" href="/erp/odoo-sync">
              لوحة ERP المتقدمة
            </Link>
            <Link className="text-[#8cc63f]" href="/pos">
              الكاشير
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
    <Suspense fallback={<PageSkeleton title="مزامنة Odoo" />}>
      <Content />
    </Suspense>
  )
}
