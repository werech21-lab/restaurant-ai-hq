import { Suspense } from 'react'
import { connection } from 'next/server'
import Link from 'next/link'
import { OdooDataCenterClient } from '@/app/(panel)/settings/odoo-data-center/odoo-data-center-client'
import { Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { requireUser } from '@/lib/erp-auth'
import { can, firstAllowedHref } from '@/lib/permissions'

export const metadata = { title: 'مركز بيانات Odoo والأرشفة الذكية | AetherBI' }
export const dynamic = 'force-dynamic'

async function Content() {
  await connection()
  const user = await requireUser()
  if (!can(user, 'saas', 'view')) {
    return <Forbidden href={firstAllowedHref(user)} />
  }
  return (
    <div>
      <PageHeader
        title="مركز إدارة بيانات Odoo والأرشفة الذكية"
        description="إحصاءات السجلات المسحوبة، حالة فهارس التسريع، وزمن الاستجابة — بدون المساس بأي صف تاريخي."
        actions={
          <div className="flex gap-3 text-sm font-semibold">
            <Link className="text-blue-700" href="/settings">
              الإعدادات
            </Link>
            <Link className="text-blue-700" href="/erp/odoo-sync">
              مزامنة Odoo
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
    <Suspense fallback={<PageSkeleton title="مركز بيانات Odoo" />}>
      <Content />
    </Suspense>
  )
}
