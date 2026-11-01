import { Suspense } from 'react'
import { connection } from 'next/server'
import { requireUser } from '@/lib/erp-auth'
import { Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { getLocale, tx } from '@/lib/i18n/server'
import { can, firstAllowedHref } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { SmartFolderUploadClient } from './upload-client'

export const metadata = { title: 'Smart HR Folder Upload | AetherBI ERP' }

async function Content() {
  await connection()
  const locale = await getLocale()
  const user = await requireUser()
  if (!can(user, 'hr', 'view')) return <Forbidden href={firstAllowedHref(user)} />
  if (!can(user, 'hr', 'create') && !can(user, 'hr', 'edit') && !user.role.isAdmin) {
    return <Forbidden href={firstAllowedHref(user)} />
  }
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, code: true, department: true },
    orderBy: { name: 'asc' },
    take: 500,
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title={tx(
          locale,
          '📁 رفع مجلد الموظفين الذكي (توزيع تلقائي بالـ AI)',
          '📁 Smart HR Folder Upload (Auto-Distribute)',
        )}
        description={tx(
          locale,
          'ارفع مجلد فنتشر فودز كاملاً — النظام يطابق الموظفين ويوزّع Excel والمستندات في الخزانة الرقمية تلقائياً.',
          'Upload a full Venture Foods folder — the system matches employees and distributes Excel/docs into each digital dossier.',
        )}
      />
      <div className="flex flex-wrap gap-2 text-sm">
        <a href="/hr" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700">
          {tx(locale, 'العودة للموارد البشرية', 'Back to HR')}
        </a>
        <a href="/erp/hr" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700">
          {tx(locale, 'ERP HR', 'ERP HR')}
        </a>
        <a href="/directory" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
          {tx(locale, 'دليل الهواتف', 'Phone directory')}
        </a>
      </div>
      <SmartFolderUploadClient employees={employees} locale={locale} />
    </div>
  )
}

export default function SmartFolderUploadPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Smart HR Upload" />}>
      <Content />
    </Suspense>
  )
}
