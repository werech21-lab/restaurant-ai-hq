import { Suspense } from 'react'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/erp-auth'
import { Forbidden, PageHeader, PageSkeleton } from '@/components/erp-ui'
import { getLocale, tx } from '@/lib/i18n/server'
import { can, firstAllowedHref } from '@/lib/permissions'
import { isSmartIngestModule, permissionModulesFor, SMART_INGEST_META } from '@/lib/smart-ingest-modules'
import { SmartDepartmentFolderUpload } from '@/components/SmartDepartmentFolderUpload'

export const metadata = { title: 'Smart Department Folder Upload | AetherBI' }

async function Content({ moduleParam }: { moduleParam: string }) {
  await connection()
  if (!isSmartIngestModule(moduleParam)) notFound()
  const meta = SMART_INGEST_META[moduleParam]
  const locale = await getLocale()
  const user = await requireUser()
  const mods = permissionModulesFor(meta)
  if (!mods.some((m) => can(user, m, 'view')) && !user.role.isAdmin) {
    return <Forbidden href={firstAllowedHref(user)} />
  }
  if (!mods.some((m) => can(user, m, 'create') || can(user, m, 'edit')) && !user.role.isAdmin) {
    return <Forbidden href={firstAllowedHref(user)} />
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={locale === 'en' ? meta.titleEn : meta.titleAr}
        description={locale === 'en' ? meta.descEn : meta.descAr}
      />
      <div className="flex flex-wrap gap-2 text-sm">
        {meta.launchHrefs.map((href) => (
          <a key={href} href={href} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700">
            {href}
          </a>
        ))}
        <a href="/hr/smart-folder-upload" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
          {tx(locale, 'رفع HR الذكي', 'HR smart upload')}
        </a>
      </div>
      <SmartDepartmentFolderUpload module={moduleParam} locale={locale} />
    </div>
  )
}

export default async function SmartIngestModulePage({
  params,
}: {
  params: Promise<{ module: string }>
}) {
  const { module: moduleParam } = await params
  return (
    <Suspense fallback={<PageSkeleton title="Smart ingest" />}>
      <Content moduleParam={moduleParam} />
    </Suspense>
  )
}
